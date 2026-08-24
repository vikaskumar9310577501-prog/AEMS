import { sbFetch, sbJson } from "./supabaseClient.js";

function txt(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => txt(item)).filter(Boolean).join(", ");
  return String(value);
}

export function assetToPostgresRow(id: string, data: Record<string, unknown>, extra?: Record<string, string | null | undefined>) {
  return {
    id,
    asset_code: txt(extra?.AssetCode || data.assetCode),
    account_asset_code: txt(data.accountAssetCode),
    asset_name: txt(data.assetName),
    main_category: txt(extra?.MainCategory || data.mainCategory),
    sub_category: txt(data.subCategory),
    asset_type: txt(data.assetType),
    brand: txt(data.make),
    model: txt(data.model),
    serial_number: txt(extra?.SerialNumber || data.serialNumber),
    quantity: txt(data.quantity),
    plant_code: txt(extra?.PlantCode || data.plantCode),
    location: txt(extra?.Location || data.location),
    department: txt(data.department),
    assigned_to: txt(data.contactName),
    employee_id: txt(extra?.EmployeeId || data.employeeId),
    assigned_date: txt(data.assignedDate),
    purchase_date: txt(data.purchaseDate),
    purchase_cost: txt(data.purchaseCost),
    vendor_name: txt(data.vendorName),
    invoice_number: txt(data.invoiceNumber),
    warranty_start: txt(data.warrantyStartDate),
    warranty_end: txt(data.warrantyEndDate),
    condition: txt(data.condition),
    status: txt(extra?.Status || data.status),
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
}

export async function mirrorAssetToPostgres(
  id: string,
  data: unknown,
  extra?: Record<string, string | null | undefined>
): Promise<void> {
  const probe = await sbFetch("/rest/v1/assets?select=id&limit=1");
  if (!probe.ok) return;
  await sbJson("/rest/v1/assets?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" } as unknown as HeadersInit,
    body: JSON.stringify(assetToPostgresRow(id, (data || {}) as Record<string, unknown>, extra)),
  });
}

export async function mirrorUserToPostgres(
  email: string,
  data: unknown
): Promise<void> {
  const probe = await sbFetch("/rest/v1/users?select=email&limit=1");
  if (!probe.ok) return;
  const d = (data || {}) as Record<string, unknown>;
  const row = {
    email: String(d.email || email).trim().toLowerCase(),
    role: String(d.role || "User"),
    locations: txt(d.locations),
    plants: txt(d.plants),
    categories: txt(d.categories),
    json_data: data,
  };
  await sbJson("/rest/v1/users?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" } as unknown as HeadersInit,
    body: JSON.stringify(row),
  });
}

export async function deleteMirroredUser(email: string): Promise<void> {
  await sbJson(`/rest/v1/users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => undefined);
}

export async function mirrorEmployeeToPostgres(
  employeeId: string,
  data: unknown
): Promise<void> {
  const probe = await sbFetch("/rest/v1/employees?select=employee_id&limit=1");
  if (!probe.ok) return;
  const d = (data || {}) as Record<string, unknown>;
  const row = {
    employee_id: String(d.employeeId || employeeId).trim().toUpperCase(),
    name: txt(d.name),
    email: txt(d.email),
    phone: txt(d.phone),
    department: txt(d.department),
    designation: txt(d.designation),
    location: txt(d.location),
    plant: txt(d.plant),
    status: txt(d.status || "Active"),
    json_data: data,
  };
  await sbJson("/rest/v1/employees?on_conflict=employee_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" } as unknown as HeadersInit,
    body: JSON.stringify(row),
  });
}

export async function deleteMirroredEmployee(employeeId: string): Promise<void> {
  await sbJson(`/rest/v1/employees?employee_id=eq.${encodeURIComponent(employeeId)}`, { method: "DELETE" }).catch(() => undefined);
}

export async function mirrorOtpToPostgres(
  email: string,
  otp: string,
  expiry: Date,
  status = "sent"
): Promise<void> {
  const probe = await sbFetch("/rest/v1/otp_log?select=email&limit=1");
  if (!probe.ok) return;
  const row = {
    email: email.trim().toLowerCase(),
    otp,
    expiry: expiry.toISOString(),
    status,
    attempts: 0,
    requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await sbJson("/rest/v1/otp_log?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" } as unknown as HeadersInit,
    body: JSON.stringify(row),
  });
}

export async function deleteMirroredOtp(email: string): Promise<void> {
  await sbJson(`/rest/v1/otp_log?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => undefined);
}

export async function deleteMirroredAsset(id: string): Promise<void> {
  await sbJson(`/rest/v1/assets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
}
