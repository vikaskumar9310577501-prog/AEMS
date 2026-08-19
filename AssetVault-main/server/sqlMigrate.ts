import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { mapSheetRow, type MappedAsset } from "./assetHelpers.js";
import { readAppData, writeAppData, type AppUser } from "./dataStore.js";
import {
  countJsonRows,
  getAssetDetailsMap,
  replaceLocationsPlants,
  saveAppSettingsJson,
  saveAssetDetails,
  saveTypeDefinitionsJson,
  upsertJsonRow,
} from "./sqlStore.js";
import { initSqlServer } from "./sqlPool.js";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_DIR = path.join(DATA_DIR, "cache");

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function unwrap<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw) || (typeof raw === "object" && raw && !("data" in (raw as object)))) {
    return raw as T;
  }
  if (typeof raw === "object" && raw && "data" in (raw as object)) {
    return ((raw as { data: T }).data ?? null) as T;
  }
  return raw as T;
}

function mergeAsset(a: MappedAsset, b: MappedAsset): MappedAsset {
  const merged = { ...a } as Record<string, unknown>;
  for (const [key, value] of Object.entries(b)) {
    const current = merged[key];
    if (value == null || value === "") continue;
    if (current == null || current === "") merged[key] = value;
    else if (key === "dynamicDetails" && typeof value === "object") {
      merged[key] = { ...((current as object) || {}), ...(value as object) };
    }
  }
  return merged as unknown as MappedAsset;
}

async function importAssets(assets: MappedAsset[]) {
  for (const asset of assets) {
    const id = String(asset.id || "").trim();
    if (!id) continue;
    await upsertJsonRow("Assets", id, asset, {
      AssetCode: asset.assetCode || "",
      SerialNumber: asset.serialNumber || "",
      MainCategory: asset.mainCategory || "",
      Location: asset.location || "",
      PlantCode: asset.plantCode || "",
      EmployeeId: asset.employeeId || "",
      Status: asset.status || "",
    });
  }
}

function collectAssetsFromCache(): MappedAsset[] {
  const byId = new Map<string, MappedAsset>();
  const add = (asset: MappedAsset) => {
    const id = String(asset.id || "").trim();
    if (!id) return;
    const existing = byId.get(id);
    byId.set(id, existing ? mergeAsset(existing, asset) : asset);
  };

  const cached = unwrap<unknown[]>(readJsonFile(path.join(CACHE_DIR, "assets.json")));
  if (Array.isArray(cached)) {
    for (const item of cached) {
      if (item && typeof item === "object") add(mapSheetRow(item as Record<string, unknown>));
    }
  }

  const logs = unwrap<unknown[]>(readJsonFile(path.join(CACHE_DIR, "audit_logs.json")));
  if (Array.isArray(logs)) {
    for (const log of logs) {
      const rec = (log || {}) as Record<string, unknown>;
      const raw = rec["New Value"];
      if (typeof raw !== "string" || !raw.trim().startsWith("{")) continue;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        add(mapSheetRow(parsed));
      } catch {
        /* ignore */
      }
    }
  }

  return Array.from(byId.values());
}

async function importSqliteAssets(): Promise<number> {
  const dbPath = path.join(DATA_DIR, "assets.db");
  if (!fs.existsSync(dbPath)) return 0;
  try {
    const [{ default: sqlite3 }, { open }] = await Promise.all([import("sqlite3"), import("sqlite")]);
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    const tables = (await db.all("SELECT name FROM sqlite_master WHERE type='table'")) as { name: string }[];
    let count = 0;
    for (const table of tables) {
      if (!table?.name || table.name.startsWith("sqlite_")) continue;
      const rows = (await db.all(`SELECT * FROM "${table.name}"`)) as Record<string, unknown>[];
      for (const row of rows) {
        const asset = mapSheetRow(row);
        if (!asset.id) continue;
        await upsertJsonRow("Assets", String(asset.id), asset, {
          AssetCode: asset.assetCode || "",
          SerialNumber: asset.serialNumber || "",
          MainCategory: asset.mainCategory || "",
          Location: asset.location || "",
          PlantCode: asset.plantCode || "",
          EmployeeId: asset.employeeId || "",
          Status: asset.status || "",
        });
        count += 1;
      }
    }
    await db.close();
    return count;
  } catch (error) {
    console.warn("[SQL] SQLite import skipped:", error instanceof Error ? error.message : error);
    return 0;
  }
}

export async function migrateLocalDataToSql(opts: { force?: boolean } = {}): Promise<{
  assets: number;
  employees: number;
  users: number;
}> {
  await initSqlServer();
  const existingAssets = await countJsonRows("Assets");
  if (existingAssets > 0 && !opts.force) {
    console.log(`[SQL] Database already has ${existingAssets} assets — keeping existing data`);
    return { assets: existingAssets, employees: await countJsonRows("Employees"), users: await countJsonRows("Users") };
  }

  console.log("[SQL] Importing existing app data (no overwrite of extra fields)");
  const assets = collectAssetsFromCache();
  await importAssets(assets);
  const sqliteCount = await importSqliteAssets();

  const details = unwrap<Record<string, Record<string, string>>>(readJsonFile(path.join(CACHE_DIR, "asset-details.json")));
  if (details && typeof details === "object") {
    for (const [assetId, fields] of Object.entries(details)) {
      await saveAssetDetails(assetId, fields || {});
    }
  }

  const employees = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "employees.json")));
  if (Array.isArray(employees)) {
    for (const employee of employees) {
      const id = String(employee.employeeId || "").trim().toUpperCase();
      if (!id) continue;
      await upsertJsonRow("Employees", id, { ...employee, employeeId: id }, { Email: String(employee.email || "") });
    }
  }

  const appData = readAppData();
  const cachedUsers = unwrap<AppUser[]>(readJsonFile(path.join(CACHE_DIR, "users.json")));
  const users = [
    ...(Array.isArray(cachedUsers) ? cachedUsers : []),
    ...appData.users,
  ];
  const userMap = new Map<string, AppUser>();
  for (const user of users) {
    if (!user?.email) continue;
    userMap.set(user.email.toLowerCase(), { ...user, email: user.email.toLowerCase() });
  }
  for (const user of userMap.values()) {
    await upsertJsonRow("Users", user.email, user, { Role: user.role });
  }
  appData.users = Array.from(userMap.values());
  writeAppData(appData);

  const history = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "assignment-history.json")));
  if (Array.isArray(history)) {
    for (const entry of history) {
      const id = String(entry.id || `AH-${Date.now()}`);
      await upsertJsonRow("AssignmentHistory", id, { ...entry, id }, { AssetId: String(entry.assetId || "") });
    }
  }

  const damaged = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "damaged_items.json")));
  if (Array.isArray(damaged)) {
    for (const item of damaged) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow("DamagedItems", id, item);
    }
  }

  const missing = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "missing_items.json")));
  if (Array.isArray(missing)) {
    for (const item of missing) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow("MissingItems", id, item);
    }
  }

  const extra = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "extra_items.json")));
  if (Array.isArray(extra)) {
    for (const item of extra) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow("ExtraItems", id, item);
    }
  }

  const assignments = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "assignments.json")));
  if (Array.isArray(assignments)) {
    for (const item of assignments) {
      const id = String(item["Assignment ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow("Assignments", id, item);
    }
  }

  const logs = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "audit_logs.json")));
  if (Array.isArray(logs)) {
    for (const item of logs) {
      const id = String(item["Log ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow("AuditLogs", id, item);
    }
  }

  const inventory = unwrap<Array<Record<string, unknown>>>(readJsonFile(path.join(CACHE_DIR, "inventory.json")));
  if (Array.isArray(inventory)) {
    for (const item of inventory) {
      const id = String(item.itemId || "").trim().toUpperCase();
      if (!id) continue;
      await upsertJsonRow("Inventory", id, { ...item, itemId: id });
    }
  }

  await replaceLocationsPlants(appData.settings.locations || [], appData.settings.plants || []);
  await saveAppSettingsJson(appData.settings);
  if (appData.settings.typeDefinitions) {
    await saveTypeDefinitionsJson(appData.settings.typeDefinitions);
  }

  const catalog = appData.settings.catalog;
  if (catalog) {
    const { addCatalogOption } = await import("./sqlStore.js");
    for (const dept of catalog.departments || []) await addCatalogOption("departments", dept);
    for (const vendor of catalog.vendors || []) await addCatalogOption("vendors", vendor);
    for (const [brand, models] of Object.entries(catalog.brands || {})) {
      await addCatalogOption("brands", brand);
      for (const model of models) await addCatalogOption("models", `${brand}:${model}`);
    }
    for (const value of catalog.ram || []) await addCatalogOption("ram", value);
    for (const value of catalog.ssd || []) await addCatalogOption("ssd", value);
    for (const value of catalog.cpu || []) await addCatalogOption("cpu", value);
    for (const value of catalog.windowsVersion || []) await addCatalogOption("windowsVersion", value);
    for (const value of catalog.licenseTypes || []) await addCatalogOption("licenseTypes", value);
  }

  const finalAssets = await countJsonRows("Assets");
  const finalEmployees = await countJsonRows("Employees");
  const finalUsers = await countJsonRows("Users");
  const detailsCount = Object.keys(await getAssetDetailsMap()).length;
  console.log(
    `[SQL] Import complete — assets: ${finalAssets} (sqlite rows touched: ${sqliteCount}), employees: ${finalEmployees}, users: ${finalUsers}, asset-details: ${detailsCount}`
  );
  return { assets: finalAssets, employees: finalEmployees, users: finalUsers };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]).includes("sqlMigrate");
if (isDirectRun) {
  migrateLocalDataToSql({ force: process.argv.includes("--force") })
    .then((result) => {
      console.log("[SQL] Migration finished", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[SQL] Migration failed", error);
      process.exit(1);
    });
}
