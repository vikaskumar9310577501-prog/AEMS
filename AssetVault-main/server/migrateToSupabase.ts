import dotenv from "dotenv";
dotenv.config();

import { initSqlServer } from "./sqlPool.js";
import * as mssql from "./sqlStoreMssql.js";
import * as sb from "./supabaseStore.js";
import { initSupabase } from "./initSupabase.js";
import { isSupabaseMode } from "./sqlConfig.js";
import type { MappedAsset } from "./assetHelpers.js";
import type { JsonTable } from "./sqlStoreMssql.js";

function extras(asset: MappedAsset) {
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

function rowId(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] || "").trim();
    if (value) return value;
  }
  return "";
}

async function copyTable(table: JsonTable, keys: string[], extraFn?: (row: Record<string, unknown>) => Record<string, string>) {
  const rows = await mssql.listJsonRows<Record<string, unknown>>(table);
  await sb.replaceAllJsonRows(
    table,
    rows
      .map((row) => {
        const id = rowId(row, keys);
        return id ? { id, data: row, extra: extraFn?.(row) } : null;
      })
      .filter(Boolean) as Array<{ id: string; data: unknown; extra?: Record<string, string> }>
  );
}

export async function migrateSqlServerToSupabase(force = false): Promise<Record<string, number>> {
  if (!isSupabaseMode()) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY missing");
  await initSupabase();

  const existing = await sb.countJsonRows("Assets").catch(() => 0);
  if (existing > 0 && !force) {
    console.log(`[Supabase] Already has ${existing} assets — skip copy`);
    return { assets: existing };
  }

  console.log("[Supabase] Copying data from local SQL Server...");
  await initSqlServer();

  const assets = await mssql.listJsonRows<MappedAsset>("Assets");
  await sb.replaceAllJsonRows(
    "Assets",
    assets
      .map((asset) => {
        const id = String(asset.id || "").trim();
        return id ? { id, data: asset, extra: extras(asset) } : null;
      })
      .filter(Boolean) as Array<{ id: string; data: unknown; extra?: Record<string, string> }>
  );

  await sb.replaceAssetDetailsMap(await mssql.getAssetDetailsMap());

  await copyTable("Employees", ["employeeId", "Employee ID"], (row) => ({ Email: String(row.email || "") }));
  await copyTable("Users", ["email"], (row) => ({ Role: String(row.role || "") }));
  await copyTable("AssignmentHistory", ["id", "Record ID"], (row) => ({ AssetId: String(row.assetId || "") }));
  await copyTable("DamagedItems", ["Record ID", "id"]);
  await copyTable("MissingItems", ["Record ID", "id"]);
  await copyTable("ExtraItems", ["Record ID", "id"]);
  await copyTable("Assignments", ["id", "Assignment ID"]);
  await copyTable("Inventory", ["itemId", "Item ID"]);
  await copyTable("AuditLogs", ["Log ID", "id"]);
  await copyTable("Categories", ["Category Name", "categoryName"]);
  await copyTable("AssetTypesLookup", ["Type ID", "typeId", "id"]);

  const locations = await mssql.listLocations();
  const plants = await mssql.listPlants();
  await sb.replaceLocationsPlants(
    locations.map((item) => item.name),
    plants
  );

  const options = await mssql.listCatalogOptions();
  for (const [type, values] of Object.entries(options)) {
    for (const value of values) await sb.addCatalogOption(type, value);
  }

  const settings = await mssql.getAppSettingsJson();
  if (settings) await sb.saveAppSettingsJson(settings);
  const types = await mssql.getTypeDefinitionsJson();
  if (types) await sb.saveTypeDefinitionsJson(types);

  const counts = {
    assets: await sb.countJsonRows("Assets"),
    employees: await sb.countJsonRows("Employees"),
    users: await sb.countJsonRows("Users"),
    history: await sb.countJsonRows("AssignmentHistory"),
  };
  console.log("[Supabase] Copy complete", counts);
  return counts;
}

const isDirect = /migrateToSupabase/.test(process.argv[1] || "");
if (isDirect) {
  migrateSqlServerToSupabase(process.argv.includes("--force"))
    .then((counts) => {
      console.log("[Supabase] Done", counts);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[Supabase] Migration failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
