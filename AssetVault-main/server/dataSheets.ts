import { createRequire } from "module";
import {
  listJsonRows,
  listLocations,
  listPlants,
  type JsonTable,
} from "./sqlStore.js";
import type { MappedAsset } from "./assetHelpers.js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

export type SheetView = {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, string>[];
};

function cell(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => cell(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pickRow(source: Record<string, unknown>, columns: Array<[string, string]>): Record<string, string> {
  const row: Record<string, string> = {};
  const used = new Set(columns.map(([key]) => key));
  for (const [key, label] of columns) {
    row[label] = cell(source[key] ?? source[label]);
  }
  for (const [key, value] of Object.entries(source)) {
    if (used.has(key) || key === "dynamicDetails" || key === "json_data") continue;
    if (value == null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const label = nestedKey;
        if (row[label]) continue;
        const text = cell(nestedValue);
        if (text) row[label] = text;
      }
      continue;
    }
    const label = key;
    if (!row[label]) row[label] = cell(value);
  }
  return row;
}

function columnsFromRows(preferred: string[], rows: Record<string, string>[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const label of preferred) {
    if (!seen.has(label)) {
      seen.add(label);
      columns.push(label);
    }
  }
  for (const row of rows) {
    for (const label of Object.keys(row)) {
      if (!seen.has(label)) {
        seen.add(label);
        columns.push(label);
      }
    }
  }
  return columns.filter((label) => rows.some((row) => row[label]));
}

const ASSET_COLUMNS: Array<[string, string]> = [
  ["id", "Asset ID"],
  ["assetCode", "Asset Code"],
  ["accountAssetCode", "Account Asset Code"],
  ["assetName", "Asset Name"],
  ["mainCategory", "Main Category"],
  ["subCategory", "Sub Category"],
  ["assetType", "Asset Type"],
  ["make", "Brand"],
  ["model", "Model"],
  ["serialNumber", "Serial Number"],
  ["status", "Status"],
  ["condition", "Condition"],
  ["employeeId", "Employee ID"],
  ["contactName", "Assigned To"],
  ["location", "Location"],
  ["plantCode", "Plant Code"],
  ["department", "Department"],
  ["quantity", "Quantity"],
  ["vendorName", "Vendor"],
  ["purchaseDate", "Purchase Date"],
  ["purchaseCost", "Purchase Cost"],
  ["invoiceNumber", "Invoice Number"],
  ["warrantyStartDate", "Warranty Start"],
  ["warrantyEndDate", "Warranty End"],
  ["ram", "RAM"],
  ["ssd", "SSD"],
  ["cpu", "CPU"],
  ["windowsVersion", "Windows"],
  ["ipAddress", "IP Address"],
  ["hostName", "Host Name"],
  ["macAddress", "MAC Address"],
  ["contactEmail", "Contact Email"],
  ["contactMobile", "Contact Mobile"],
  ["imageUrl", "Photo"],
  ["documentUrl", "Document"],
  ["createdBy", "Created By"],
  ["createdDate", "Created Date"],
  ["updatedBy", "Updated By"],
  ["updatedDate", "Updated Date"],
];

const EMPLOYEE_COLUMNS: Array<[string, string]> = [
  ["employeeId", "Employee ID"],
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["department", "Department"],
  ["designation", "Designation"],
  ["location", "Location"],
  ["plant", "Plant"],
  ["status", "Status"],
];

const USER_COLUMNS: Array<[string, string]> = [
  ["email", "Email"],
  ["role", "Role"],
  ["locations", "Locations"],
  ["plants", "Plants"],
  ["categories", "Categories"],
];

const HISTORY_COLUMNS: Array<[string, string]> = [
  ["id", "Record ID"],
  ["assetId", "Asset ID"],
  ["action", "Action"],
  ["employeeId", "Employee ID"],
  ["employeeName", "Employee Name"],
  ["assignedDate", "Assigned Date"],
  ["returnedDate", "Returned Date"],
  ["assignedBy", "Assigned By"],
  ["remarks", "Remarks"],
];

async function tableSheet(id: string, name: string, table: JsonTable, columns: Array<[string, string]>): Promise<SheetView> {
  const records = await listJsonRows<Record<string, unknown>>(table);
  const rows = records.map((record) => pickRow(record, columns));
  return { id, name, columns: columnsFromRows(columns.map(([, label]) => label), rows), rows };
}

export async function buildDataSheets(): Promise<SheetView[]> {
  const assets = (await listJsonRows<MappedAsset>("Assets")).map((asset) =>
    pickRow(asset as unknown as Record<string, unknown>, ASSET_COLUMNS)
  );
  const locations = await listLocations();
  const plants = await listPlants();
  const sheets: SheetView[] = [
    {
      id: "assets",
      name: "Assets",
      columns: columnsFromRows(ASSET_COLUMNS.map(([, label]) => label), assets),
      rows: assets,
    },
    await tableSheet("employees", "Employees", "Employees", EMPLOYEE_COLUMNS),
    await tableSheet("users", "Users", "Users", USER_COLUMNS),
    await tableSheet("history", "Assignment History", "AssignmentHistory", HISTORY_COLUMNS),
    await tableSheet("inventory", "Inventory", "Inventory", [["itemId", "Item ID"]]),
    await tableSheet("damaged", "Damaged Items", "DamagedItems", [["Record ID", "Record ID"]]),
    {
      id: "locations",
      name: "Locations",
      columns: ["Location", "Department"],
      rows: locations.map((item) => ({ Location: item.name, Department: item.department || "" })),
    },
    {
      id: "plants",
      name: "Plants",
      columns: ["Plant Code", "Plant Name", "Location"],
      rows: plants.map((item) => ({
        "Plant Code": item.code,
        "Plant Name": item.name,
        Location: item.location,
      })),
    },
  ];
  return sheets.filter((sheet) => sheet.rows.length > 0 || ["assets", "employees", "users"].includes(sheet.id));
}

export function sheetsToXlsxBuffer(sheets: SheetView[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [
      sheet.columns,
      ...sheet.rows.map((row) => sheet.columns.map((column) => row[column] || "")),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
