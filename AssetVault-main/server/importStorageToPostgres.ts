import dotenv from "dotenv";
dotenv.config();

import { DATA_BUCKET, downloadFromStorage, sbFetch, sbJson } from "./supabaseClient.js";

type Row = Record<string, unknown>;

async function loadTableFile<T>(name: string): Promise<T[]> {
  const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
  if (!remote) return [];
  try {
    const parsed = JSON.parse(new TextDecoder().decode(remote.bytes));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function txt(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => txt(item)).filter(Boolean).join(", ");
  return String(value);
}

function dataOf(row: Row): Row {
  const nested = row.json_data;
  return nested && typeof nested === "object" && !Array.isArray(nested) ? (nested as Row) : row;
}

async function upsert(table: string, rows: Row[], onConflict: string) {
  if (!rows.length) {
    console.log(`  ${table}: 0`);
    return;
  }
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sbJson(`/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" } as unknown as HeadersInit,
      body: JSON.stringify(chunk),
    });
  }
  console.log(`  ${table}: ${rows.length}`);
}

export async function importStorageToPostgres(): Promise<void> {
  const probe = await sbFetch("/rest/v1/assets?select=id&limit=1");
  if (!probe.ok) {
    throw new Error("Tables missing. SQL Editor me supabaseSchema.sql Run karo, phir ye command dubara chalao.");
  }

  const assets = await loadTableFile<Row>("assets");
  await upsert(
    "assets",
    assets.map((row) => {
      const data = dataOf(row);
      return {
        id: txt(data.id || row.id),
        asset_code: txt(data.assetCode || row.asset_code),
        account_asset_code: txt(data.accountAssetCode),
        asset_name: txt(data.assetName),
        main_category: txt(data.mainCategory || row.main_category),
        sub_category: txt(data.subCategory),
        asset_type: txt(data.assetType),
        brand: txt(data.make),
        model: txt(data.model),
        serial_number: txt(data.serialNumber || row.serial_number),
        quantity: txt(data.quantity),
        plant_code: txt(data.plantCode || row.plant_code),
        location: txt(data.location || row.location),
        department: txt(data.department),
        assigned_to: txt(data.contactName),
        employee_id: txt(data.employeeId || row.employee_id),
        assigned_date: txt(data.assignedDate),
        purchase_date: txt(data.purchaseDate),
        purchase_cost: txt(data.purchaseCost),
        vendor_name: txt(data.vendorName),
        invoice_number: txt(data.invoiceNumber),
        warranty_start: txt(data.warrantyStartDate),
        warranty_end: txt(data.warrantyEndDate),
        condition: txt(data.condition),
        status: txt(data.status || row.status),
        ram: txt(data.ram),
        ssd: txt(data.ssd),
        cpu: txt(data.cpu),
        windows_version: txt(data.windowsVersion),
        mac_address: txt(data.macAddress),
        ip_address: txt(data.ipAddress),
        host_name: txt(data.hostName),
        contact_email: txt(data.contactEmail),
        contact_mobile: txt(data.contactMobile),
        photo_url: txt(data.imageUrl),
        document_url: txt(data.documentUrl),
        json_data: data,
      };
    }).filter((row) => row.id),
    "id"
  );

  const employees = await loadTableFile<Row>("employees");
  await upsert(
    "employees",
    employees.map((row) => {
      const data = dataOf(row);
      return {
        employee_id: txt(data.employeeId || row.employee_id),
        name: txt(data.name),
        email: txt(data.email || row.email),
        phone: txt(data.phone),
        department: txt(data.department),
        designation: txt(data.designation),
        location: txt(data.location),
        plant: txt(data.plant),
        status: txt(data.status),
        json_data: data,
      };
    }).filter((row) => row.employee_id),
    "employee_id"
  );

  const users = await loadTableFile<Row>("users");
  await upsert(
    "users",
    users.map((row) => {
      const data = dataOf(row);
      return {
        email: txt(data.email || row.email).toLowerCase(),
        role: txt(data.role || row.role),
        locations: txt(data.locations),
        plants: txt(data.plants),
        categories: txt(data.categories),
        json_data: data,
      };
    }).filter((row) => row.email),
    "email"
  );

  const history = await loadTableFile<Row>("assignment_history");
  await upsert(
    "assignment_history",
    history.map((row) => {
      const data = dataOf(row);
      return {
        record_id: txt(data.id || row.record_id),
        asset_id: txt(data.assetId || row.asset_id),
        action: txt(data.action),
        employee_id: txt(data.employeeId),
        employee_name: txt(data.employeeName),
        assigned_date: txt(data.assignedDate),
        returned_date: txt(data.returnedDate),
        assigned_by: txt(data.assignedBy),
        remarks: txt(data.remarks),
        json_data: data,
      };
    }).filter((row) => row.record_id),
    "record_id"
  );

  const locations = await loadTableFile<Row>("locations");
  await upsert(
    "locations",
    locations.map((row) => ({
      location_name: txt(row.location_name || row.name),
      department: txt(row.department),
      created_date: txt(row.created_date),
    })).filter((row) => row.location_name),
    "location_name"
  );

  const plants = await loadTableFile<Row>("plants");
  await upsert(
    "plants",
    plants.map((row) => ({
      plant_code: txt(row.plant_code || row.code),
      plant_name: txt(row.plant_name || row.name),
      location_name: txt(row.location_name || row.location),
      created_date: txt(row.created_date),
    })).filter((row) => row.plant_code),
    "plant_code"
  );

  console.log("[Supabase] Table Editor data ready");
}

const isDirect = /importStorageToPostgres/.test(process.argv[1] || "");
if (isDirect) {
  importStorageToPostgres()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
