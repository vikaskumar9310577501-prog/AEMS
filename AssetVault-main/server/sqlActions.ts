import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { mapSheetRow, type MappedAsset } from "./assetHelpers.js";
import { getDefaultAssetHeaders } from "./sheetHeaders.js";
import { readAppData, writeAppData, normalizeStringList, type AppUser } from "./dataStore.js";
import { getEnv } from "./env.js";
import { buildOtpEmailHtml } from "./emailTemplates.js";
import { APP_NAME, APP_SHORT_NAME } from "../src/lib/constants.js";
import { saveLocalUpload, readLocalUpload } from "./sqlFiles.js";
import {
  addCatalogOption,
  bumpOtpAttempts,
  deleteAssetDetails,
  deleteCatalogOption,
  deleteJsonRow,
  deleteOtp,
  getAppSettingsJson,
  getAssetDetailsMap,
  getJsonRow,
  getTypeDefinitionsJson,
  listCatalogOptions,
  listJsonRows,
  listLocations,
  listPlants,
  readOtp,
  replaceLocationsPlants,
  saveAppSettingsJson,
  saveAssetDetails,
  saveOtp,
  saveTypeDefinitionsJson,
  upsertJsonRow,
} from "./sqlStore.js";

type Payload = Record<string, unknown>;

function ok(extra: Record<string, unknown> = {}) {
  return { success: true, ok: true, ...extra };
}

function fail(error: string) {
  return { success: false, ok: false, error };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickId(payload: Payload, row: unknown, keys: string[]): string {
  for (const key of keys) {
    if (payload[key] != null && String(payload[key]).trim()) return String(payload[key]).trim();
  }
  const rec = asRecord(row);
  for (const key of keys) {
    if (rec[key] != null && String(rec[key]).trim()) return String(rec[key]).trim();
  }
  return "";
}

function normalizeUser(raw: Record<string, unknown>): AppUser {
  return {
    email: String(raw.email || raw.Email || "").trim().toLowerCase(),
    role: String(raw.role || raw.Role || "User"),
    locations: normalizeStringList(raw.locations ?? raw.Locations),
    plants: normalizeStringList(raw.plants ?? raw.Plants),
    categories: normalizeStringList(raw.categories ?? raw.Categories),
    allowDelete: !!raw.allowDelete || String(raw.allowDelete) === "true",
  };
}

function syncLocalUsers(users: AppUser[]) {
  const data = readAppData();
  data.users = users;
  writeAppData(data);
}

function assetExtras(asset: MappedAsset) {
  return {
    AssetCode: asset.assetCode || "",
    SerialNumber: asset.serialNumber || "",
    MainCategory: asset.mainCategory || "",
    Location: asset.location || "",
    PlantCode: asset.plantCode || "",
    EmployeeId: asset.employeeId || "",
    Status: asset.status || "",
  };
}

function assetFromPayload(payload: Payload): MappedAsset {
  const row = payload.row;
  if (row && typeof row === "object" && !Array.isArray(row)) {
    return mapSheetRow(row as Record<string, unknown>);
  }
  if (Array.isArray(row)) {
    const headers = getDefaultAssetHeaders();
    const item: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    if (payload.id != null) item["Asset ID"] = payload.id;
    return mapSheetRow(item);
  }
  return mapSheetRow(payload);
}

async function upsertAsset(asset: MappedAsset) {
  const id = String(asset.id || "").trim();
  if (!id) throw new Error("Asset ID is required");
  const existing = await getJsonRow<MappedAsset>("Assets", id);
  const merged = { ...(existing || {}), ...asset, id } as MappedAsset;
  await upsertJsonRow("Assets", id, merged, assetExtras(merged));
  return merged;
}

function userFromPayload(payload: Payload): AppUser {
  const nested = asRecord(payload.user);
  return normalizeUser({ ...payload, ...nested });
}

async function handleUsers(action: string, payload: Payload) {
  if (action === "list_users" || action === "get_users" || action === "read_users") {
    const users = await listJsonRows<AppUser>("Users");
    if (users.length) syncLocalUsers(users);
    return ok({ users });
  }
  if (action === "add_user" || action === "addUser" || action === "append_user") {
    const user = userFromPayload(payload);
    if (!user.email) return fail("Email is required");
    await upsertJsonRow("Users", user.email, user, { Role: user.role });
    const users = await listJsonRows<AppUser>("Users");
    syncLocalUsers(users);
    return ok({ user });
  }
  if (action === "update_user" || action === "updateUser" || action === "edit_user") {
    const user = userFromPayload(payload);
    if (!user.email) return fail("Email is required");
    const existing = await getJsonRow<AppUser>("Users", user.email);
    const merged = { ...(existing || {}), ...user };
    await upsertJsonRow("Users", merged.email, merged, { Role: merged.role });
    const users = await listJsonRows<AppUser>("Users");
    syncLocalUsers(users);
    return ok({ user: merged });
  }
  if (action === "delete_user" || action === "deleteUser" || action === "remove_user") {
    const email = String(payload.email || userFromPayload(payload).email || "")
      .trim()
      .toLowerCase();
    if (!email) return fail("Email is required");
    await deleteJsonRow("Users", email);
    const users = await listJsonRows<AppUser>("Users");
    syncLocalUsers(users);
    return ok();
  }
  return null;
}

async function sendOtpMail(email: string, otp: string): Promise<boolean> {
  const user = getEnv("SMTP_EMAIL");
  const pass = getEnv("SMTP_PASSWORD");
  if (!user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_EMAIL and SMTP_PASSWORD.");
  }
  const transporter = nodemailer.createTransport({
    host: getEnv("SMTP_HOST") || "smtp.office365.com",
    port: parseInt(getEnv("SMTP_PORT") || "587", 10),
    secure: getEnv("SMTP_SECURE") === "true",
    auth: { user, pass },
  });
  const from = getEnv("OTP_FROM_EMAIL") || user;
  await transporter.sendMail({
    from: `"${APP_NAME}" <${from}>`,
    to: email,
    subject: `${otp} - Your ${APP_SHORT_NAME} login code`,
    html: buildOtpEmailHtml(otp, 10),
    text: `Your ${APP_NAME} login code is ${otp}. It expires in 10 minutes.`,
  });
  return true;
}

async function handleOtp(action: string, payload: Payload) {
  if (action !== "request_otp" && action !== "verify_otp") return null;
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) return fail("Email is required");
  const users = await listJsonRows<AppUser>("Users");
  const user = users.find((u) => u.email === email) || readAppData().users.find((u) => u.email === email);
  if (!user) return fail("Your mail is not authorized. Please contact IT Admin only.");

  if (action === "request_otp") {
    const otp = String(crypto.randomInt(100000, 1000000));
    await saveOtp(email, otp, new Date(Date.now() + 10 * 60 * 1000));
    try {
      await sendOtpMail(email, otp);
    } catch (error) {
      console.warn("[SQL] OTP email failed:", error instanceof Error ? error.message : error);
      return fail(
        error instanceof Error
          ? error.message
          : "Could not send OTP email via SMTP. Check SMTP_EMAIL / SMTP_PASSWORD."
      );
    }
    return ok({ message: "OTP sent to your email" });
  }

  if (action === "verify_otp") {
    const code = String(payload.otp || "").trim();
    const record = await readOtp(email);
    if (!record) return fail("OTP expired or not requested. Request a new code.");
    if (Date.now() > record.expiry.getTime()) {
      await deleteOtp(email);
      return fail("OTP has expired. Request a new code.");
    }
    if (record.attempts >= 5) {
      await deleteOtp(email);
      return fail("Too many failed attempts. Request a new OTP.");
    }
    if (record.otp !== code) {
      await bumpOtpAttempts(email, record.attempts + 1);
      return fail(`Invalid OTP. ${5 - record.attempts - 1} attempts left.`);
    }
    await deleteOtp(email);
    return ok({ user });
  }
  return null;
}

export async function handleSqlAction(payload: Payload): Promise<Record<string, unknown>> {
  const action = String(payload.action || payload.type || "read_all_assets").trim();
  const type = String(payload.type || "").trim();

  try {
    if (type === "options" || action === "options") {
      return ok({ options: await listCatalogOptions() });
    }
    if (action === "add_option") {
      await addCatalogOption(String(payload.type || ""), String(payload.value || ""));
      return ok();
    }
    if (action === "delete_option") {
      await deleteCatalogOption(String(payload.type || ""), String(payload.value || ""));
      return ok();
    }

    const usersResult = await handleUsers(action, payload);
    if (usersResult) return usersResult;
    const otpResult = await handleOtp(action, payload);
    if (otpResult) return otpResult;

    if (action === "read_all_assets" || action === "list_assets_redesigned" || action === "get_asset_headers") {
      const assets = await listJsonRows<MappedAsset>("Assets");
      return ok({ assets, headers: getDefaultAssetHeaders() });
    }

    if (action === "add" || action === "add_asset_redesigned") {
      const asset = await upsertAsset(assetFromPayload(payload));
      return ok({ id: asset.id, assetCode: asset.assetCode });
    }

    if (action === "update" || action === "update_asset_redesigned") {
      const incoming = assetFromPayload(payload);
      const id = String(payload.id || incoming.id || "").trim();
      if (!id) return fail("Asset ID is required");
      const existing = await getJsonRow<MappedAsset>("Assets", id);
      const merged = { ...(existing || {}), ...incoming, id } as MappedAsset;
      await upsertJsonRow("Assets", id, merged, assetExtras(merged));
      return ok({ id, assetCode: merged.assetCode });
    }

    if (action === "delete" || action === "delete_asset_redesigned") {
      const id = String(payload.id || "").trim();
      if (!id) return fail("Asset ID is required");
      await deleteJsonRow("Assets", id);
      await deleteAssetDetails(id);
      return ok();
    }

    if (action === "get_asset_details") {
      return ok({ details: await getAssetDetailsMap() });
    }
    if (action === "save_asset_details") {
      await saveAssetDetails(String(payload.assetId || ""), asRecord(payload.details) as Record<string, string>);
      return ok();
    }
    if (action === "delete_asset_details") {
      await deleteAssetDetails(String(payload.assetId || ""));
      return ok();
    }

    if (action === "list_employees" || action === "get_employees" || action === "read_employees") {
      return ok({ employees: await listJsonRows("Employees") });
    }
    if (action === "add_employee" || action === "update_employee") {
      const employee = asRecord(payload.employee);
      const id = String(employee.employeeId || "").trim().toUpperCase();
      if (!id) return fail("Employee ID is required");
      const existing = await getJsonRow("Employees", id);
      const merged = { ...(existing || {}), ...employee, employeeId: id };
      await upsertJsonRow("Employees", id, merged, { Email: String(employee.email || "") });
      return ok({ employee: merged });
    }
    if (action === "delete_employee") {
      const employee = asRecord(payload.employee);
      const id = String(employee.employeeId || payload.employeeId || "").trim().toUpperCase();
      await deleteJsonRow("Employees", id);
      return ok();
    }

    if (action === "list_inventory") {
      return ok({ inventory: await listJsonRows("Inventory") });
    }
    if (action === "add_inventory_item" || action === "update_inventory_item") {
      const item = asRecord(payload.item);
      const id = String(item.itemId || "").trim().toUpperCase();
      if (!id) return fail("Item ID is required");
      const existing = await getJsonRow("Inventory", id);
      const merged = { ...(existing || {}), ...item, itemId: id };
      await upsertJsonRow("Inventory", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_inventory_item") {
      const item = asRecord(payload.item);
      await deleteJsonRow("Inventory", String(item.itemId || "").trim().toUpperCase());
      return ok();
    }
    if (action === "replace_inventory") {
      const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
      for (const raw of inventory) {
        const item = asRecord(raw);
        const id = String(item.itemId || "").trim().toUpperCase();
        if (id) await upsertJsonRow("Inventory", id, { ...item, itemId: id });
      }
      return ok();
    }

    if (action === "get_assignment_history") {
      return ok({ history: await listJsonRows("AssignmentHistory") });
    }
    if (action === "add_assignment_history") {
      const entry = asRecord(payload.entry);
      const id = String(entry.id || `AH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const merged = { ...entry, id };
      await upsertJsonRow("AssignmentHistory", id, merged, { AssetId: String(entry.assetId || "") });
      return ok({ entry: merged });
    }
    if (action === "delete_assignment_history") {
      await deleteJsonRow("AssignmentHistory", String(payload.id || ""));
      return ok();
    }
    if (action === "clear_assignment_history") {
      const rows = await listJsonRows<{ id?: string }>("AssignmentHistory");
      for (const row of rows) {
        if (row.id) await deleteJsonRow("AssignmentHistory", String(row.id));
      }
      return ok();
    }

    if (action === "list_damaged_items") {
      return ok({ items: await listJsonRows("DamagedItems") });
    }
    if (action === "add_damaged_item" || action === "update_damaged_item") {
      const row = payload.row ?? payload;
      const rec = asRecord(row);
      const id = pickId(payload, row, ["id", "Record ID"]);
      const merged = { ...rec, "Record ID": id || String(rec["Record ID"] || crypto.randomUUID()) };
      await upsertJsonRow("DamagedItems", String(merged["Record ID"]), merged);
      return ok({ item: merged });
    }
    if (action === "delete_damaged_item") {
      await deleteJsonRow("DamagedItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }

    if (action === "list_missing_items") {
      return ok({ items: await listJsonRows("MissingItems") });
    }
    if (action === "add_missing_item" || action === "update_missing_item") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Record ID"]) || crypto.randomUUID();
      const merged = { ...rec, "Record ID": id };
      await upsertJsonRow("MissingItems", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_missing_item") {
      await deleteJsonRow("MissingItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }

    if (action === "list_extra_items") {
      return ok({ items: await listJsonRows("ExtraItems") });
    }
    if (action === "add_extra_item" || action === "update_extra_item") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Record ID"]) || crypto.randomUUID();
      const merged = { ...rec, "Record ID": id };
      await upsertJsonRow("ExtraItems", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_extra_item") {
      await deleteJsonRow("ExtraItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }

    if (action === "list_assignments") {
      return ok({ assignments: await listJsonRows("Assignments") });
    }
    if (action === "add_assignment" || action === "update_assignment") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Assignment ID"]) || crypto.randomUUID();
      const merged = { ...rec, "Assignment ID": id };
      await upsertJsonRow("Assignments", id, merged);
      return ok();
    }
    if (action === "delete_assignment") {
      await deleteJsonRow("Assignments", pickId(payload, payload.row, ["id", "Assignment ID"]));
      return ok();
    }

    if (action === "list_audit_logs") {
      return ok({ logs: await listJsonRows("AuditLogs") });
    }
    if (action === "add_audit_log") {
      const rec = asRecord(payload.row ?? payload);
      const id = String(rec["Log ID"] || `L-${Math.floor(100000 + Math.random() * 900000)}`);
      await upsertJsonRow("AuditLogs", id, { ...rec, "Log ID": id });
      return ok();
    }

    if (action === "list_categories") {
      return ok({ categories: await listJsonRows("Categories") });
    }
    if (action === "add_category" || action === "update_category") {
      const rec = asRecord(payload.row ?? payload);
      const name = String(rec["Category Name"] || payload.id || "").trim();
      if (!name) return fail("Category Name is required");
      await upsertJsonRow("Categories", name, { ...rec, "Category Name": name });
      return ok();
    }
    if (action === "delete_category") {
      await deleteJsonRow("Categories", String(payload.id || asRecord(payload.row)["Category Name"] || ""));
      return ok();
    }

    if (action === "list_asset_types") {
      return ok({ types: await listJsonRows("AssetTypesLookup") });
    }
    if (action === "add_asset_type") {
      const rec = asRecord(payload.row ?? payload);
      const id = String(rec["Type ID"] || payload.id || crypto.randomUUID());
      await upsertJsonRow("AssetTypesLookup", id, { ...rec, "Type ID": id });
      return ok();
    }
    if (action === "delete_asset_type") {
      await deleteJsonRow("AssetTypesLookup", String(payload.id || ""));
      return ok();
    }

    if (action === "get_type_definitions") {
      const saved = await getTypeDefinitionsJson();
      const types = saved && typeof saved === "object" ? (saved as { types?: unknown[] }).types || saved : [];
      return ok({ types });
    }
    if (action === "save_type_definitions") {
      await saveTypeDefinitionsJson({ types: payload.types || payload });
      return ok();
    }

    if (action === "list_locations_plants") {
      const locations = (await listLocations()).map((l) => l.name).filter(Boolean);
      const plants = await listPlants();
      if (!locations.length) {
        const settings = readAppData().settings;
        return ok({ locations: settings.locations || [], plants: settings.plants || [] });
      }
      return ok({ locations, plants });
    }
    if (action === "sync_locations_plants") {
      const locations = Array.isArray(payload.locations) ? payload.locations.map((v) => String(v)) : [];
      const plants = Array.isArray(payload.plants)
        ? payload.plants.map((p) => {
            const rec = asRecord(p);
            return {
              code: String(rec.code || ""),
              name: String(rec.name || ""),
              location: String(rec.location || ""),
            };
          })
        : [];
      await replaceLocationsPlants(locations, plants);
      const data = readAppData();
      data.settings.locations = locations;
      data.settings.plants = plants;
      writeAppData(data);
      await saveAppSettingsJson(data.settings);
      return ok();
    }
    if (action === "rename_location") {
      const oldName = String(payload.oldName || "");
      const newName = String(payload.newName || "");
      const data = readAppData();
      data.settings.locations = data.settings.locations.map((name) => (name === oldName ? newName : name));
      data.settings.plants = data.settings.plants.map((plant) =>
        plant.location === oldName ? { ...plant, location: newName } : plant
      );
      writeAppData(data);
      await replaceLocationsPlants(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson(data.settings);
      return ok();
    }
    if (action === "delete_location") {
      const name = String(payload.name || "");
      const data = readAppData();
      data.settings.locations = data.settings.locations.filter((item) => item !== name);
      data.settings.plants = data.settings.plants.filter((plant) => plant.location !== name);
      writeAppData(data);
      await replaceLocationsPlants(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson(data.settings);
      return ok();
    }
    if (action === "rename_plant") {
      const oldCode = String(payload.oldCode || "");
      const newCode = String(payload.newCode || oldCode);
      const newName = String(payload.newName || "");
      const location = String(payload.location || "");
      const data = readAppData();
      data.settings.plants = data.settings.plants.map((plant) =>
        plant.code === oldCode ? { code: newCode, name: newName || plant.name, location: location || plant.location } : plant
      );
      writeAppData(data);
      await replaceLocationsPlants(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson(data.settings);
      return ok();
    }
    if (action === "delete_plant") {
      const code = String(payload.code || "");
      const data = readAppData();
      data.settings.plants = data.settings.plants.filter((plant) => plant.code !== code);
      writeAppData(data);
      await replaceLocationsPlants(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson(data.settings);
      return ok();
    }

    if (action === "upload_file") {
      const saved = await saveLocalUpload({
        filename: String(payload.filename || "file"),
        mimeType: String(payload.mimeType || "application/octet-stream"),
        base64Data: String(payload.fileData || ""),
      });
      return ok(saved);
    }
    if (action === "get_file_base64") {
      const file = await readLocalUpload(String(payload.fileId || ""));
      if (!file) return fail("File not found");
      return ok({
        base64: Buffer.from(file.bytes).toString("base64"),
        mimeType: file.contentType,
        fileName: file.fileName,
      });
    }

    if (action === "setup" || action === "sync_location_plant_sheets" || action === "rebuild_asset_sheets") {
      return ok({ message: "SQL Server is ready" });
    }

    if (action === "next_code_lock") {
      return { success: false };
    }

    if (!action || action === "read_all_assets") {
      const assets = await listJsonRows<MappedAsset>("Assets");
      return ok({ assets, headers: getDefaultAssetHeaders() });
    }

    console.warn("[SQL] Unhandled action:", action);
    return fail(`Unsupported SQL action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SQL] Action failed:", action, message);
    return fail(message);
  }
}
