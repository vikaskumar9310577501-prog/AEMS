import type { JsonTable } from "./sqlStoreMssql.js";
import { DATA_BUCKET, downloadFromStorage, uploadToStorage } from "./supabaseClient.js";
import {
  deleteMirroredAsset,
  mirrorAssetToPostgres,
  mirrorUserToPostgres,
  deleteMirroredUser,
  mirrorEmployeeToPostgres,
  deleteMirroredEmployee,
} from "./postgresMirror.js";

const TABLES: Record<JsonTable, { table: string; id: string }> = {
  Assets: { table: "assets", id: "id" },
  Employees: { table: "employees", id: "employee_id" },
  Users: { table: "users", id: "email" },
  Inventory: { table: "inventory", id: "item_id" },
  AssignmentHistory: { table: "assignment_history", id: "record_id" },
  DamagedItems: { table: "damaged_items", id: "record_id" },
  MissingItems: { table: "missing_items", id: "record_id" },
  ExtraItems: { table: "extra_items", id: "record_id" },
  Assignments: { table: "assignments", id: "record_id" },
  AuditLogs: { table: "audit_logs", id: "log_id" },
  Categories: { table: "categories", id: "category_name" },
  AssetTypesLookup: { table: "asset_types_lookup", id: "type_id" },
};

type Row = Record<string, unknown>;
const locks = new Map<string, Promise<unknown>>();

function rowJson<T>(row: Row | null | undefined): T | null {
  if (!row) return null;
  return (row.json_data ?? row) as T;
}

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(name) || Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    name,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function loadFile<T>(name: string, fallback: T): Promise<T> {
  const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
  if (!remote) return fallback;
  try {
    return JSON.parse(new TextDecoder().decode(remote.bytes)) as T;
  } catch {
    return fallback;
  }
}

async function saveFile(name: string, data: unknown): Promise<void> {
  await uploadToStorage(`tables/${name}.json`, Buffer.from(JSON.stringify(data)), "application/json", DATA_BUCKET);
}

async function loadRows(table: JsonTable): Promise<Row[]> {
  return loadFile<Row[]>(TABLES[table].table, []);
}

async function saveRows(table: JsonTable, rows: Row[]): Promise<void> {
  await saveFile(TABLES[table].table, rows);
}

export async function listJsonRows<T = Record<string, unknown>>(table: JsonTable): Promise<T[]> {
  const rows = await loadRows(table);
  return rows.map((row) => rowJson<T>(row)).filter(Boolean) as T[];
}

export async function countJsonRows(table: JsonTable): Promise<number> {
  return (await loadRows(table)).length;
}

export async function getJsonRow<T = Record<string, unknown>>(table: JsonTable, id: string): Promise<T | null> {
  const meta = TABLES[table];
  const rows = await loadRows(table);
  return rowJson<T>(rows.find((row) => String(row[meta.id] || "") === id));
}

export async function upsertJsonRow(
  table: JsonTable,
  id: string,
  data: unknown,
  extra?: Record<string, string | null | undefined>
): Promise<void> {
  await withLock(table, async () => {
    const meta = TABLES[table];
    const rows = await loadRows(table);
    const body: Row = { [meta.id]: id, json_data: data ?? {} };
    if (table === "Assets") {
      body.asset_code = extra?.AssetCode ?? null;
      body.serial_number = extra?.SerialNumber ?? null;
      body.main_category = extra?.MainCategory ?? null;
      body.location = extra?.Location ?? null;
      body.plant_code = extra?.PlantCode ?? null;
      body.employee_id = extra?.EmployeeId ?? null;
      body.status = extra?.Status ?? null;
    }
    if (table === "Employees") body.email = extra?.Email ?? null;
    if (table === "Users") body.role = extra?.Role ?? null;
    if (table === "AssignmentHistory") body.asset_id = extra?.AssetId ?? null;
    const index = rows.findIndex((row) => String(row[meta.id] || "") === id);
    if (index >= 0) rows[index] = body;
    else rows.push(body);
    await saveRows(table, rows);
    if (table === "Assets") {
      await mirrorAssetToPostgres(id, data, extra).catch((error) => {
        console.warn("[Supabase] Postgres mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
    if (table === "Users") {
      await mirrorUserToPostgres(id, data).catch((error) => {
        console.warn("[Supabase] Users mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
    if (table === "Employees") {
      await mirrorEmployeeToPostgres(id, data).catch((error) => {
        console.warn("[Supabase] Employees mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
  });
}

export async function deleteJsonRow(table: JsonTable, id: string): Promise<boolean> {
  return withLock(table, async () => {
    const meta = TABLES[table];
    const rows = await loadRows(table);
    const next = rows.filter((row) => String(row[meta.id] || "") !== id);
    await saveRows(table, next);
    if (table === "Assets") {
      await deleteMirroredAsset(id).catch(() => undefined);
    }
    if (table === "Users") {
      await deleteMirroredUser(id).catch(() => undefined);
    }
    if (table === "Employees") {
      await deleteMirroredEmployee(id).catch(() => undefined);
    }
    return next.length !== rows.length;
  });
}

export async function replaceAllJsonRows(
  table: JsonTable,
  rows: Array<{ id: string; data: unknown; extra?: Record<string, string | null | undefined> }>
): Promise<void> {
  await withLock(table, async () => {
    const meta = TABLES[table];
    const built: Row[] = rows.map((row) => {
      const body: Row = { [meta.id]: row.id, json_data: row.data ?? {} };
      if (table === "Assets") {
        body.asset_code = row.extra?.AssetCode ?? null;
        body.serial_number = row.extra?.SerialNumber ?? null;
        body.main_category = row.extra?.MainCategory ?? null;
        body.location = row.extra?.Location ?? null;
        body.plant_code = row.extra?.PlantCode ?? null;
        body.employee_id = row.extra?.EmployeeId ?? null;
        body.status = row.extra?.Status ?? null;
      }
      if (table === "Employees") body.email = row.extra?.Email ?? null;
      if (table === "Users") body.role = row.extra?.Role ?? null;
      if (table === "AssignmentHistory") body.asset_id = row.extra?.AssetId ?? null;
      return body;
    });
    await saveRows(table, built);
  });
}

export async function getAssetDetailsMap(): Promise<Record<string, Record<string, string>>> {
  const rows = await loadFile<Array<{ asset_id: string; field_key: string; field_value: string }>>("asset_details", []);
  const map: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!map[row.asset_id]) map[row.asset_id] = {};
    map[row.asset_id][row.field_key] = String(row.field_value ?? "");
  }
  return map;
}

export async function replaceAssetDetailsMap(map: Record<string, Record<string, string>>): Promise<void> {
  const rows: Array<{ asset_id: string; field_key: string; field_value: string }> = [];
  for (const [assetId, fields] of Object.entries(map || {})) {
    for (const [field_key, field_value] of Object.entries(fields || {})) {
      if (!field_key.trim()) continue;
      rows.push({ asset_id: assetId, field_key, field_value: String(field_value ?? "") });
    }
  }
  await saveFile("asset_details", rows);
}

export async function saveAssetDetails(assetId: string, details: Record<string, string>): Promise<void> {
  await withLock("asset_details", async () => {
    const rows = await loadFile<Array<{ asset_id: string; field_key: string; field_value: string }>>("asset_details", []);
    const kept = rows.filter((row) => row.asset_id !== assetId);
    for (const [field_key, field_value] of Object.entries(details || {})) {
      if (!field_key.trim()) continue;
      kept.push({ asset_id: assetId, field_key, field_value: String(field_value ?? "") });
    }
    await saveFile("asset_details", kept);
  });
}

export async function deleteAssetDetails(assetId: string): Promise<void> {
  await withLock("asset_details", async () => {
    const rows = await loadFile<Array<{ asset_id: string; field_key: string; field_value: string }>>("asset_details", []);
    await saveFile(
      "asset_details",
      rows.filter((row) => row.asset_id !== assetId)
    );
  });
}

export async function listLocations(): Promise<Array<{ name: string; department?: string }>> {
  const rows = await loadFile<Array<{ location_name: string; department?: string }>>("locations", []);
  return rows.map((row) => ({ name: row.location_name, department: row.department || "" }));
}

export async function listPlants(): Promise<Array<{ code: string; name: string; location: string }>> {
  const rows = await loadFile<Array<{ plant_code: string; plant_name: string; location_name: string }>>("plants", []);
  return rows.map((row) => ({
    code: row.plant_code,
    name: row.plant_name || "",
    location: row.location_name || "",
  }));
}

export async function replaceLocationsPlants(
  locations: string[],
  plants: Array<{ code: string; name: string; location: string }>
): Promise<void> {
  await withLock("locations_plants", async () => {
    await saveFile(
      "locations",
      locations.filter(Boolean).map((name) => ({
        location_name: name,
        created_date: new Date().toISOString(),
      }))
    );
    await saveFile(
      "plants",
      plants
        .filter((plant) => plant.code)
        .map((plant) => ({
          plant_code: plant.code,
          plant_name: plant.name || "",
          location_name: plant.location || "",
          created_date: new Date().toISOString(),
        }))
    );
  });
}

export async function listCatalogOptions(): Promise<Record<string, string[]>> {
  const rows = await loadFile<Array<{ option_type: string; option_value: string }>>("catalog_options", []);
  const options: Record<string, string[]> = {};
  for (const row of rows) {
    if (!options[row.option_type]) options[row.option_type] = [];
    options[row.option_type].push(row.option_value);
  }
  return options;
}

export async function addCatalogOption(type: string, value: string): Promise<void> {
  await withLock("catalog_options", async () => {
    const rows = await loadFile<Array<{ option_type: string; option_value: string }>>("catalog_options", []);
    if (rows.some((row) => row.option_type === type && row.option_value === value)) return;
    rows.push({ option_type: type, option_value: value });
    await saveFile("catalog_options", rows);
  });
}

export async function deleteCatalogOption(type: string, value: string): Promise<void> {
  await withLock("catalog_options", async () => {
    const rows = await loadFile<Array<{ option_type: string; option_value: string }>>("catalog_options", []);
    await saveFile(
      "catalog_options",
      rows.filter((row) => !(row.option_type === type && row.option_value === value))
    );
  });
}

export async function getAppSettingsJson(): Promise<Record<string, unknown> | null> {
  return loadFile<Record<string, unknown> | null>("app_settings", null);
}

export async function saveAppSettingsJson(data: unknown): Promise<void> {
  await saveFile("app_settings", data ?? {});
}

export async function getTypeDefinitionsJson(): Promise<unknown | null> {
  return loadFile<unknown>("type_definitions", null);
}

export async function saveTypeDefinitionsJson(data: unknown): Promise<void> {
  await saveFile("type_definitions", data ?? {});
}

export async function saveOtp(email: string, otp: string, expiry: Date): Promise<void> {
  await withLock("otp_log", async () => {
    const rows = await loadFile<Array<Row>>("otp_log", []);
    const next = rows.filter((row) => String(row.email || "") !== email);
    next.push({
      email,
      otp,
      expiry: expiry.toISOString(),
      attempts: 0,
      requested_at: new Date().toISOString(),
      status: "sent",
    });
    await saveFile("otp_log", next);
  });
}

export async function readOtp(email: string): Promise<{ otp: string; expiry: Date; attempts: number } | null> {
  const rows = await loadFile<Array<Row>>("otp_log", []);
  const row = rows.find((item) => String(item.email || "") === email);
  if (!row) return null;
  return { otp: String(row.otp || ""), expiry: new Date(String(row.expiry || "")), attempts: Number(row.attempts || 0) };
}

export async function bumpOtpAttempts(email: string, attempts: number): Promise<void> {
  await withLock("otp_log", async () => {
    const rows = await loadFile<Array<Row>>("otp_log", []);
    await saveFile(
      "otp_log",
      rows.map((row) => (String(row.email || "") === email ? { ...row, attempts } : row))
    );
  });
}

export async function deleteOtp(email: string): Promise<void> {
  await withLock("otp_log", async () => {
    const rows = await loadFile<Array<Row>>("otp_log", []);
    await saveFile(
      "otp_log",
      rows.filter((row) => String(row.email || "") !== email)
    );
  });
}

export async function saveUploadedFile(record: {
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
}): Promise<void> {
  await withLock("uploaded_files", async () => {
    const rows = await loadFile<Array<Row>>("uploaded_files", []);
    const body = {
      file_id: record.fileId,
      file_name: record.fileName,
      mime_type: record.mimeType,
      disk_path: record.diskPath,
      url: record.url,
    };
    const index = rows.findIndex((row) => String(row.file_id || "") === record.fileId);
    if (index >= 0) rows[index] = body;
    else rows.push(body);
    await saveFile("uploaded_files", rows);
  });
}

export async function getUploadedFile(fileId: string): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  diskPath: string;
  url: string;
} | null> {
  const rows = await loadFile<Array<Row>>("uploaded_files", []);
  const row = rows.find((item) => String(item.file_id || "") === fileId);
  if (!row) return null;
  return {
    fileId: String(row.file_id || ""),
    fileName: String(row.file_name || ""),
    mimeType: String(row.mime_type || ""),
    diskPath: String(row.disk_path || ""),
    url: String(row.url || ""),
  };
}
