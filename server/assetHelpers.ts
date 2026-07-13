import { healMisalignedCategoryFields, matchMainCategoryLabel, normalizeMainCategory } from "../src/lib/assetCatalogByType.js";
import { healMisalignedAssetFields } from "../src/lib/healAssetFields.js";
import { isGroupedSubCategory, resolveSpecificAssetType, inferCctvDeviceType, defaultAssetTypeForCategory } from "../src/lib/assetDisplay.js";
import { dedupeAssets } from "./dedupeAssets.js";

export interface MappedAsset {
  id: string;
  location: string;
  plantCode: string;
  department: string;
  make: string;
  model: string;
  serialNumber: string;
  assetCode: string;
  accountAssetCode: string;
  vendorName: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  ram: string;
  ssd: string;
  cpu: string;
  windowsVersion: string;
  assetType: string;
  ipAddress: string;
  hostName: string;
  macAddress: string;
  monitorSerial: string;
  monitorAssetCode: string;
  keyboardSerial: string;
  keyboardAssetCode: string;
  mouseSerial: string;
  mouseAssetCode: string;
  upsSerial: string;
  upsAssetCode: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  documentUrl: string;
  imageUrl: string;
  additionalItems: string;
  qrCodeText: string;
  uniqueCode: string;
  binaryCode: string;

  // New fields
  assetName: string;
  mainCategory: string;
  subCategory: string;
  quantity: string;
  employeeId: string;
  purchaseDate: string;
  purchaseCost: string;
  invoiceNumber: string;
  condition: string;
  status: string;
  maintenanceRequired: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
  extraItems: string;
  missingItems: string;
  assignedDate: string;
  returnDate: string;
  amcVendor?: string;
  amcStartDate?: string;
  amcEndDate?: string;
  amcCost?: string;
  dynamicDetails?: Record<string, string>;
  assetTypeId?: string;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getVal(item: Record<string, unknown>, keys: string[], camelKey?: string): string {
  // First attempt: exact match
  for (const key of keys) {
    const v = item[key];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }

  // Second attempt: lenient/normalized match
  const normalizedKeys = keys.map(k => normalizeKey(k));
  for (const itemKey of Object.keys(item)) {
    if (normalizedKeys.includes(normalizeKey(itemKey))) {
      const v = item[itemKey];
      if (v !== undefined && v !== null && v !== "") return String(v);
    }
  }

  if (camelKey) {
    const v = item[camelKey];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }

  return "";
}

function isLikelyEmail(value: string): boolean {
  const v = String(value || "").trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v);
}

function isLikelyDate(value: string): boolean {
  const v = String(value || "").trim();
  if (!v) return false;
  return !Number.isNaN(Date.parse(v));
}

function isLikelyPhone(value: string): boolean {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

export function mapSheetRow(item: Record<string, unknown>): MappedAsset {
  const subCategoryRaw = getVal(item, ["Sub Category", "subCategory"]);
  const assetTypeRaw = getVal(item, ["Asset Type", "Type"]);
  let subCategory = subCategoryRaw;
  if (!subCategory && assetTypeRaw) {
    const tLower = assetTypeRaw.toLowerCase();
    if (tLower === "laptop" || tLower === "desktop") subCategory = "Laptop / Desktop";
    else if (isGroupedSubCategory(assetTypeRaw)) subCategory = assetTypeRaw;
    else subCategory = assetTypeRaw;
  }

  const make = getVal(item, ["Brand", "Make", "Brand/Make", "make"]);
  const assetCode = getVal(item, ["Asset Code"]);

  const healed = healMisalignedCategoryFields({
    mainCategory: getVal(item, ["Category", "Main Category", "mainCategory"]),
    subCategory,
    assetType: assetTypeRaw,
    make,
    assetCode,
  });
  let mainCategory = healed.mainCategory;
  subCategory = healed.subCategory || subCategory;
  const healedAssetType = healed.assetType || assetTypeRaw;
  
  // Backward compatible subCategory mapping for IT Assets:
  let mappedSubCategory = subCategory;
  if (mainCategory === "IT Assets" && subCategory) {
    const tLower = subCategory.toLowerCase();
    if (matchMainCategoryLabel(subCategory)) {
      mappedSubCategory = healed.subCategory || "Other IT Asset";
    } else if (tLower === "laptop" || tLower === "desktop" || tLower === "laptop kit" || tLower === "laptop / desktop") {
      mappedSubCategory = "Laptop / Desktop";
    } else if (tLower === "keyboard" || tLower === "mouse" || tLower === "qr scanner" || tLower === "input device") {
      mappedSubCategory = "Input Device";
    } else if (tLower === "monitor" || tLower === "output device") {
      mappedSubCategory = "Output Device";
    } else if (tLower.includes("switch") || tLower.includes("rack") || tLower.includes("access point") || tLower.includes("firewall") || tLower.includes("controller") || tLower === "network device") {
      mappedSubCategory = "Network Device";
    } else if (tLower === "external hdd" || tLower === "storage device") {
      mappedSubCategory = "Storage Device";
    } else if (tLower === "printer" || tLower === "printer / scanner") {
      mappedSubCategory = "Printer / Scanner";
    } else if (tLower === "camera" || tLower === "nvr" || tLower === "cctv / security device") {
      mappedSubCategory = "CCTV / Security Device";
    } else if (tLower === "ups" || tLower === "server / ups") {
      mappedSubCategory = "Server / UPS";
    } else if (!mappedSubCategory) {
      mappedSubCategory = "Other IT Asset";
    }
  }

  const vehicleNumber = getVal(item, ["Vehicle Number", "vehicle_number"]);
  const dynamicFromRow = vehicleNumber ? { vehicle_number: vehicleNumber } : undefined;

  const model = getVal(item, ["Model"]);
  const assetName = getVal(item, ["Asset Name"]);
  const monitorSerial = getVal(item, ["Monitor Serial", "Monitor SN"]);
  const monitorAssetCode = getVal(item, ["Monitor Asset Code", "Monitor Code"]);
  const keyboardSerial = getVal(item, ["Keyboard Serial", "Keyboard SN"]);
  const keyboardAssetCode = getVal(item, ["Keyboard Asset Code", "Keyboard Code"]);
  const mouseSerial = getVal(item, ["Mouse Serial", "Mouse SN"]);
  const mouseAssetCode = getVal(item, ["Mouse Asset Code", "Mouse Code"]);
  const upsSerial = getVal(item, ["UPS Serial", "UPS SN"]);
  const upsAssetCode = getVal(item, ["UPS Asset Code", "UPS Code"]);
  const assetTypeId = getVal(item, ["assetTypeId", "Asset Type ID"]);

  const resolvedAssetType =
    resolveSpecificAssetType({
      assetType: healedAssetType,
      subCategory: mappedSubCategory,
      assetTypeId,
      make,
      model,
      mainCategory,
      assetName,
      monitorSerial,
      monitorAssetCode,
      keyboardSerial,
      keyboardAssetCode,
      mouseSerial,
      mouseAssetCode,
      upsSerial,
      upsAssetCode,
    }) ||
    (healedAssetType && !isGroupedSubCategory(healedAssetType) && !matchMainCategoryLabel(healedAssetType)
      ? healedAssetType
      : "") ||
    (assetTypeRaw && !isGroupedSubCategory(assetTypeRaw) && !matchMainCategoryLabel(assetTypeRaw)
      ? assetTypeRaw
      : "") ||
    inferCctvDeviceType({ assetType: healedAssetType || assetTypeRaw, subCategory: mappedSubCategory, make, model }) ||
    defaultAssetTypeForCategory(mainCategory, mappedSubCategory);

  const mapped: MappedAsset = {
    id: getVal(item, ["Asset ID", "S No", "ID", "SR.NO", "id"]),
    location: getVal(item, ["Location", "Loc"]),
    plantCode: getVal(item, ["Plant Code", "Plant", "plantCode", "Plant Name"]),
    department: getVal(item, ["Department", "Dept"]),
    make: getVal(item, ["Brand", "Make", "Brand/Make", "make"]),
    model,
    serialNumber: getVal(item, ["Serial Number", "SN", "SERIAL NO."]),
    assetCode: getVal(item, ["Asset Code"]),
    accountAssetCode: getVal(item, ["Account Asset Code"]),
    vendorName: getVal(item, ["Vendor Name", "Vendor"]),
    warrantyStartDate: getVal(item, ["Warranty Start Date", "Warranty Start"], "warrantyStartDate"),
    warrantyEndDate: getVal(item, ["Warranty Expiry Date", "Warranty End", "Warranty Date"], "warrantyEndDate"),
    ram: getVal(item, ["RAM"]),
    ssd: getVal(item, ["SSD", "Storage"]),
    cpu: getVal(item, ["CPU", "Processor"]),
    windowsVersion: getVal(item, ["Windows Version", "OS"]),
    assetType: resolvedAssetType,
    ipAddress: getVal(item, ["IP Address", "ipAddress"]),
    hostName: getVal(item, ["Host Name", "hostName", "Hostname"]),
    macAddress: getVal(item, ["MAC Address", "MAC"]),
    monitorSerial,
    monitorAssetCode,
    keyboardSerial,
    keyboardAssetCode,
    mouseSerial,
    mouseAssetCode,
    upsSerial,
    upsAssetCode,
    contactName: getVal(item, [
      "Assigned To",
      "Contact Person Name",
      "Auth Target / Owner",
      "Owner",
      "ASSIGNEE NAME ",
    ], "contactName"),
    contactEmail: (() => {
      const email = getVal(item, ["Contact Email", "Contact Person Email", "Email", "MAIL ID "], "contactEmail");
      const mobile = getVal(item, [
        "Contact Number",
        "Contact Person Mobile Number",
        "Mobile",
        "CONTACT NUMBER ",
      ], "contactMobile");
      if (!isLikelyEmail(email) && isLikelyEmail(mobile)) {
        if (!email || isLikelyDate(email) || isLikelyPhone(email)) return mobile;
      }
      return email;
    })(),
    contactMobile: (() => {
      const email = getVal(item, ["Contact Email", "Contact Person Email", "Email", "MAIL ID "], "contactEmail");
      const mobile = getVal(item, [
        "Contact Number",
        "Contact Person Mobile Number",
        "Mobile",
        "CONTACT NUMBER ",
      ], "contactMobile");
      if (!isLikelyEmail(email) && isLikelyEmail(mobile)) {
        if (!email || isLikelyDate(email) || isLikelyPhone(email)) return email;
      }
      return mobile;
    })(),
    documentUrl: getVal(item, ["Document URL / Attached Documents", "Document Link", "Document URL", "Document"], "documentUrl"),
    imageUrl: getVal(item, ["Photo URL", "Photo URL / Photo Upload", "Asset Image", "Image", "Image URL"]),
    additionalItems: getVal(item, ["Remarks", "Remarks", "Additional Items"]),
    qrCodeText: getVal(item, ["QR Code / Barcode", "QR Code Text"]),
    uniqueCode: getVal(item, ["Unique Code"]),
    binaryCode: getVal(item, ["Binary Code"]),

    // New columns
    assetName: getVal(item, ["Asset Name"]) || getVal(item, ["Model"]) || "",
    mainCategory,
    subCategory: mappedSubCategory || "Other IT Asset",
    quantity: getVal(item, ["Quantity"]) || "1",
    employeeId: getVal(item, ["Employee ID"]),
    purchaseDate: getVal(item, ["Purchase Date"]),
    purchaseCost: getVal(item, ["Purchase Cost"]),
    invoiceNumber: getVal(item, ["Invoice Number"]),
    condition: (() => {
      let cond = getVal(item, ["Condition"]);
      if (cond === "New") return "NEW PURCHASE";
      if (cond === "Good" || !cond) return "EXISTING ASSETS";
      return cond;
    })(),
    status: getVal(item, ["Status"]) || "Available",
    maintenanceRequired: getVal(item, ["Maintenance Required"]),
    lastMaintenanceDate: getVal(item, ["Last Maintenance Date"]),
    nextMaintenanceDate: getVal(item, ["Next Maintenance Date"]),
    createdBy: getVal(item, ["Created By"]),
    createdDate: getVal(item, ["Created Date"]),
    updatedBy: getVal(item, ["Updated By"]),
    updatedDate: getVal(item, ["Updated Date"]),
    extraItems: getVal(item, ["Extra Items", "extraItems"]),
    missingItems: getVal(item, ["Missing Items", "missingItems"]),
    assignedDate: getVal(item, ["Assigned Date", "Assign Date", "Assignment Date", "assignedDate"]),
    returnDate: getVal(item, ["Return Date", "returnDate"]),
    amcVendor: getVal(item, ["AMC Vendor", "amcVendor"]),
    amcStartDate: getVal(item, ["AMC Start Date", "amcStartDate"]),
    amcEndDate: getVal(item, ["AMC End Date", "amcEndDate"]),
    amcCost: getVal(item, ["AMC Cost", "amcCost"]),
    dynamicDetails: dynamicFromRow,
    assetTypeId,
  };

  return healMisalignedAssetFields(mapped);
}

import { gasGet, gasPost } from "./gasClient.js";

function mapGasRowsToAssets(parsed: unknown): MappedAsset[] {
  const data = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { assets?: unknown }).assets)
      ? ((parsed as { assets: unknown[] }).assets)
      : [];

  if (!data.length) return [];

  if (data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) {
    const assets = (data as Record<string, unknown>[]).map((item) => mapSheetRow(item));
    return dedupeAssets(assets);
  }

  const headers = data[0] as string[];
  const rows = data.slice(1) as unknown[][];
  const assets = rows.map((row) => {
    const item: Record<string, unknown> = {};
    headers.forEach((header: string, index: number) => {
      item[header] = row[index];
    });
    return mapSheetRow(item);
  });

  return dedupeAssets(assets);
}

async function readGasAssetsAttempt(
  label: string,
  reader: () => Promise<unknown>
): Promise<{ label: string; assets: MappedAsset[]; error?: unknown }> {
  try {
    return { label, assets: mapGasRowsToAssets(await reader()) };
  } catch (error) {
    return { label, assets: [], error };
  }
}

export async function fetchAllAssets(gasWebappUrl: string, dbMode?: string): Promise<MappedAsset[]> {
  const attempts =
    dbMode === "redesigned"
      ? [
          ["redesigned-get", () => gasGet(gasWebappUrl, { action: "list_assets_redesigned" })] as const,
          ["legacy-get", () => gasGet(gasWebappUrl)] as const,
          ["redesigned-post", () => gasPost(gasWebappUrl, { action: "list_assets_redesigned" })] as const,
          ["legacy-post", () => gasPost(gasWebappUrl, { action: "read_all_assets" })] as const,
        ]
      : [
          ["legacy-get", () => gasGet(gasWebappUrl)] as const,
          ["redesigned-get", () => gasGet(gasWebappUrl, { action: "list_assets_redesigned" })] as const,
          ["legacy-post", () => gasPost(gasWebappUrl, { action: "read_all_assets" })] as const,
          ["redesigned-post", () => gasPost(gasWebappUrl, { action: "list_assets_redesigned" })] as const,
        ];

  let firstEmpty: { label: string; assets: MappedAsset[] } | null = null;
  const errors: string[] = [];

  for (const [label, reader] of attempts) {
    const result = await readGasAssetsAttempt(label, reader);
    if (result.assets.length > 0) {
      if (firstEmpty) {
        console.warn(
          `[AMS] Asset sync fallback: ${firstEmpty.label} returned 0 rows; using ${label} with ${result.assets.length} rows.`
        );
      }
      return result.assets;
    }
    if (result.error) {
      errors.push(`${label}: ${result.error instanceof Error ? result.error.message : String(result.error)}`);
    } else if (!firstEmpty) {
      firstEmpty = { label, assets: result.assets };
    }
  }

  if (firstEmpty) {
    if (errors.length) {
      console.warn(`[AMS] Asset sync returned 0 rows after fallback attempts. ${errors.join(" | ")}`);
    }
    return firstEmpty.assets;
  }

  throw new Error(errors.join(" | ") || "Failed to load assets from Database");
}

function normalizeScanKey(value: string): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const s = raw.toLowerCase();
  const stripped = s.replace(/^0+/, "") || s;
  const keys = new Set([s, stripped]);

  // Strip all non-alphanumeric characters (ignores spaces/hyphens/slashes)
  const alphanumeric = s.replace(/[^a-z0-9]/g, "");
  if (alphanumeric) {
    keys.add(alphanumeric);
    keys.add(alphanumeric.replace(/^0+/, "") || alphanumeric);
  }

  // Only add pure digit-only fallbacks if the original value does NOT contain letters
  const hasLetters = /[a-z]/i.test(s);
  if (!hasLetters) {
    const digits = s.replace(/[^0-9]/g, "");
    if (digits) {
      keys.add(digits);
      keys.add(digits.replace(/^0+/, "") || digits);
    }
  }

  return Array.from(keys);
}

/** Stable ID embedded in QR — prefer business keys over timestamp S No */
export function getCanonicalScanId(asset: MappedAsset): string {
  const code = String(asset.uniqueCode || "").trim();
  if (code) return code;
  const ac = String(asset.assetCode || "").trim();
  if (ac) return ac;
  const sn = String(asset.serialNumber || "").trim();
  if (sn) return sn;
  return String(asset.id || "").trim();
}

function extractScanIdFromQrUrl(qr: string): string[] {
  const out: string[] = [];
  const m = String(qr || "").match(/\/scan\/([^/?#]+)/i);
  if (m?.[1]) out.push(decodeURIComponent(m[1]));
  return out;
}

export function findAssetByScanId(assets: MappedAsset[], scanId: string): MappedAsset | undefined {
  const decoded = decodeURIComponent(String(scanId || ""));
  const searchKeys = normalizeScanKey(decoded);

  let found = assets.find((a) => {
    const candidates = [
      a.id,
      a.uniqueCode,
      a.serialNumber,
      a.assetCode,
      getCanonicalScanId(a),
      ...extractScanIdFromQrUrl(a.qrCodeText),
      a.monitorSerial,
      a.monitorAssetCode,
      a.keyboardSerial,
      a.keyboardAssetCode,
      a.mouseSerial,
      a.mouseAssetCode,
      a.upsSerial,
      a.upsAssetCode,
    ]
      .filter(Boolean)
      .flatMap((v) => normalizeScanKey(String(v)));
    return candidates.some((c) => searchKeys.includes(c));
  });

  if (found) return found;

  // Loose match: embedded scan path in stored QR text
  found = assets.find((a) => {
    const qr = String(a.qrCodeText || "").toLowerCase();
    return qr.includes(`/scan/${decoded.toLowerCase()}`);
  });

  return found;
}

export function getScanUrl(baseUrl: string, asset: MappedAsset): string {
  const id = getCanonicalScanId(asset);
  return `${baseUrl.replace(/\/$/, "")}/scan/${encodeURIComponent(id)}`;
}

export function isDesktopAsset(asset: Pick<MappedAsset, "assetType" | "subCategory">): boolean {
  if (asset.assetType === "Desktop" || asset.subCategory === "Desktop") return true;
  return asset.assetType === "Laptop / Desktop";
}

export function formatPeripheralLine(code?: string, serial?: string): string {
  const c = String(code || "").trim();
  const s = String(serial || "").trim();
  if (!c && !s) return "Not Assigned";
  return `${c || "—"} / ${s || "—"}`;
}
