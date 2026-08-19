import fs from "fs";
import path from "path";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

import { mapSheetRow, type MappedAsset } from "./assetHelpers.js";
import { initSqlServer } from "./sqlPool.js";
import { getSqlPool } from "./sqlPool.js";
import {
  addCatalogOption,
  countJsonRows,
  replaceLocationsPlants,
  saveAssetDetails,
  upsertJsonRow,
} from "./sqlStore.js";
import { writeAppData, readAppData, type AppUser } from "./dataStore.js";

const CATEGORY_SHEETS = [
  "IT Assets",
  "Office Assets",
  "Electrical Assets",
  "Production Assets",
  "Safety Assets",
  "Vehicle Assets",
  "Furniture Assets",
  "Software License Assets",
  "Admin Facility Assets",
  "Maintenance Assets",
];

function sheetRows(workbook: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

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

function rowHasAsset(item: Record<string, unknown>): boolean {
  const id = String(item["Asset ID"] || item["S No"] || item.id || "").trim();
  const code = String(item["Asset Code"] || item.assetCode || "").trim();
  const serial = String(item["Serial Number"] || item.serialNumber || "").trim();
  const name = String(item["Asset Name"] || item.assetName || "").trim();
  return Boolean(id || code || serial || name);
}

async function clearTable(name: string) {
  const pool = await getSqlPool();
  await pool.request().query(`DELETE FROM ${name}`);
}

export async function importAssetsFromXlsx(filePath: string) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const assets: MappedAsset[] = [];
  for (const sheetName of CATEGORY_SHEETS) {
    for (const row of sheetRows(workbook, sheetName)) {
      if (!rowHasAsset(row)) continue;
      if (!row["Main Category"]) row["Main Category"] = sheetName;
      const asset = mapSheetRow(row);
      if (!String(asset.id || "").trim()) continue;
      assets.push(asset);
    }
  }

  await initSqlServer();
  await clearTable("dbo.Assets");
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const asset of assets) {
    await upsertJsonRow("Assets", String(asset.id), asset, extras(asset));
    const cat = asset.mainCategory || "Unknown";
    const type = asset.assetType || "Unknown";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  const detailsByAsset: Record<string, Record<string, string>> = {};
  for (const row of sheetRows(workbook, "Asset_Details")) {
    const assetId = String(row["Asset ID"] || "").trim();
    const key = String(row["Field Key"] || "").trim();
    if (!assetId || !key) continue;
    if (!detailsByAsset[assetId]) detailsByAsset[assetId] = {};
    detailsByAsset[assetId][key] = String(row["Field Value"] ?? "");
  }
  await clearTable("dbo.AssetDetails");
  for (const [assetId, fields] of Object.entries(detailsByAsset)) {
    await saveAssetDetails(assetId, fields);
  }

  const employees = sheetRows(workbook, "Employees").filter((row) => String(row["Employee ID"] || "").trim());
  await clearTable("dbo.Employees");
  for (const row of employees) {
    const employee = {
      employeeId: String(row["Employee ID"] || "").trim().toUpperCase(),
      name: String(row["Name"] || "").trim(),
      email: String(row["Email"] || "").trim().toLowerCase(),
      phone: String(row["Phone"] || "").replace(/\D/g, "").slice(0, 10),
      department: String(row["Department"] || "").trim(),
      location: String(row["Location"] || "").trim(),
      designation: String(row["Designation"] || "").trim(),
      plant: String(row["Plant Code"] || "").trim(),
      status: String(row["Status"] || "Active").trim() || "Active",
      createdAt: String(row["Created Date"] || ""),
      updatedAt: String(row["Updated Date"] || ""),
    };
    await upsertJsonRow("Employees", employee.employeeId, employee, { Email: employee.email });
  }

  const history = sheetRows(workbook, "Assignment_History").filter((row) => String(row["Record ID"] || "").trim());
  await clearTable("dbo.AssignmentHistory");
  for (const row of history) {
    const entry = {
      id: String(row["Record ID"] || "").trim(),
      assetId: String(row["Asset ID"] || "").trim(),
      action: String(row["Action"] || "").trim(),
      employeeId: String(row["Employee ID"] || "").trim(),
      employeeName: String(row["Employee Name"] || "").trim(),
      assignedDate: String(row["Assigned Date"] || "").trim(),
      returnedDate: String(row["Returned Date"] || "").trim(),
      assignedBy: String(row["Assigned By"] || "").trim(),
      remarks: String(row["Remarks"] || "").trim(),
      fromEmployeeId: String(row["From Employee ID"] || "").trim(),
      fromEmployeeName: String(row["From Employee Name"] || "").trim(),
    };
    await upsertJsonRow("AssignmentHistory", entry.id, entry, { AssetId: entry.assetId });
  }

  const users = sheetRows(workbook, "Users")
    .map((row) => ({
      email: String(row["Email"] || "").trim().toLowerCase(),
      role: String(row["Role"] || "User").trim() || "User",
      locations: String(row["Locations"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      plants: String(row["Plants"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      categories: String(row["Categories"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((user) => user.email.includes("@"));
  await clearTable("dbo.Users");
  for (const user of users) {
    await upsertJsonRow("Users", user.email, user, { Role: user.role });
  }
  const appData = readAppData();
  appData.users = users as AppUser[];
  writeAppData(appData);

  const locations = sheetRows(workbook, "Locations")
    .map((row) => String(row["Location Name"] || "").trim())
    .filter(Boolean);
  const plants = sheetRows(workbook, "Plants")
    .map((row) => ({
      code: String(row["Plant Code"] || "").trim(),
      name: String(row["Plant Name"] || "").trim(),
      location: String(row["Location Name"] || "").trim(),
    }))
    .filter((plant) => plant.code);
  if (locations.length || plants.length) {
    await replaceLocationsPlants(locations, plants);
    appData.settings.locations = locations.length ? locations : appData.settings.locations;
    appData.settings.plants = plants.length ? plants : appData.settings.plants;
    writeAppData(appData);
  }

  await clearTable("dbo.CatalogOptions");
  for (const row of sheetRows(workbook, "Options")) {
    const type = String(row["Type"] || "").trim();
    const value = String(row["Value"] || "").trim();
    if (type && value) await addCatalogOption(type, value);
  }

  await clearTable("dbo.AuditLogs");
  for (const row of sheetRows(workbook, "Audit_Logs")) {
    const id = String(row["Log ID"] || "").trim();
    if (!id) continue;
    await upsertJsonRow("AuditLogs", id, row);
  }

  return {
    filePath,
    assets: assets.length,
    byCategory,
    byType,
    employees: employees.length,
    history: history.length,
    users: users.length,
    details: Object.keys(detailsByAsset).length,
    totalInDb: await countJsonRows("Assets"),
  };
}

function findExportFile(): string | null {
  const named = [
    path.join(process.cwd(), "aems-export.xlsx"),
    path.join(process.cwd(), "aems-export.xlsx.xlsx"),
    path.join(process.env.USERPROFILE || "", "Downloads", "ASSET ENTRY MANAGEMENT SYSTEM.xlsx"),
  ];
  for (const file of named) if (file && fs.existsSync(file)) return file;
  const arg = process.argv.find((value) => value.toLowerCase().endsWith(".xlsx") || value.toLowerCase().endsWith(".xls"));
  if (arg && fs.existsSync(arg)) return arg;
  return null;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]).includes("importFromXlsx");
if (isDirect) {
  const file = findExportFile();
  if (!file) {
    console.error("Excel file not found.");
    process.exit(1);
  }
  importAssetsFromXlsx(file)
    .then((result) => {
      console.log("[SQL] Excel import complete", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[SQL] Excel import failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
