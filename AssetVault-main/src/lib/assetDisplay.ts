/** Helpers for safe asset field display when sheet data may be legacy/corrupted */

import { CATEGORY_SUBCATEGORIES, PERIPHERAL_TYPES } from "./assetCatalogByType";

const IT_PRIMARY_TYPES = new Set(["Laptop", "Desktop"]);

function normToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function isItOnlyAssetType(type: string): boolean {
  const t = type.trim();
  if (!t) return false;
  return IT_PRIMARY_TYPES.has(t) || (PERIPHERAL_TYPES as readonly string[]).includes(t);
}

/** Match asset name to a catalog sub-type within a main category (e.g. Meeting Table). */
export function inferCategoryAssetType(
  mainCategory: string,
  assetName?: string,
  subCategory?: string,
  assetType?: string
): string {
  const main = (mainCategory || "").trim();
  if (!main || main === "IT Assets") return "";

  const subs = CATEGORY_SUBCATEGORIES[main] || [];
  const sub = (subCategory || "").trim();
  const type = (assetType || "").trim();
  const name = (assetName || "").trim();

  if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) {
    if (subs.some((s) => normToken(s) === normToken(sub))) return sub;
  }

  if (type && !isGroupedSubCategory(type) && !isItOnlyAssetType(type)) {
    if (subs.some((s) => normToken(s) === normToken(type))) return type;
  }

  if (name) {
    const nameNorm = normToken(name);
    const exact = subs.find((s) => normToken(s) === nameNorm);
    if (exact) return exact;
    const partial = subs.find(
      (s) => nameNorm.includes(normToken(s)) || normToken(s).includes(nameNorm)
    );
    if (partial) return partial;
  }

  return subs[subs.length - 1] || "";
}

export function defaultAssetTypeForCategory(mainCategory: string, subCategory?: string): string {
  const main = (mainCategory || "").trim();
  if (!main || main === "IT Assets") return "Laptop";
  const sub = (subCategory || "").trim();
  if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) return sub;
  const subs = CATEGORY_SUBCATEGORIES[main] || [];
  return subs[subs.length - 1] || sub || main;
}
export function looksLikeDate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/GMT[+-]\d{4}/i.test(v)) return true;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(v)) return true;
  return false;
}

export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Primary system identifier for table display — prefer numeric Asset ID over corrupted uniqueCode */
export function formatSystemDisplayId(asset: {
  id?: number | string;
  uniqueCode?: string;
  assetCode?: string;
}): string {
  const idStr = asset.id != null ? String(asset.id).trim() : "";
  if (idStr && /^\d+$/.test(idStr.replace(/^0+/, "") || "0")) {
    return idStr.padStart(3, "0");
  }

  const code = (asset.uniqueCode || asset.assetCode || "").trim();
  if (code && !looksLikeDate(code) && !looksLikeUrl(code) && !looksLikeEmail(code)) {
    return code;
  }

  return idStr ? idStr.padStart(3, "0") : code || "—";
}

export function formatAssetCodeLabel(asset: {
  id?: number | string;
  assetCode?: string;
  uniqueCode?: string;
}): string {
  const code = (asset.assetCode || "").trim();
  if (code) return code;
  const idStr = asset.id != null ? String(asset.id).trim() : "";
  if (idStr) return idStr.padStart(3, "0");
  const uc = (asset.uniqueCode || "").trim();
  if (uc && !looksLikeDate(uc) && !looksLikeUrl(uc)) return uc;
  return idStr.padStart(3, "0") || "—";
}

/** Sub-categories that group multiple selectable types (not a single type label). */
const GROUPED_SUB_CATEGORIES = new Set([
  "laptop / desktop",
  "printer / scanner",
  "input device",
  "output device",
  "network device",
  "storage device",
  "cctv / security device",
  "server / ups",
]);

const TYPE_ID_LABELS: Record<string, string> = {
  laptop: "Laptop",
  desktop: "Desktop",
  printer: "Printer",
  scanner: "Scanner",
  monitor: "Monitor",
  keyboard: "Keyboard",
  mouse: "Mouse",
  ups: "UPS",
  server: "Server",
};

export function isGroupedSubCategory(value: string): boolean {
  return GROUPED_SUB_CATEGORIES.has(value.trim().toLowerCase());
}

function hasDesktopPeripherals(asset: {
  monitorSerial?: string;
  monitorAssetCode?: string;
  monitorMake?: string;
  monitorModel?: string;
  keyboardSerial?: string;
  keyboardAssetCode?: string;
  keyboardMake?: string;
  keyboardModel?: string;
  keyboardConnectivity?: string;
  mouseSerial?: string;
  mouseAssetCode?: string;
  mouseMake?: string;
  mouseModel?: string;
  mouseConnectivity?: string;
  upsSerial?: string;
  upsAssetCode?: string;
  upsMake?: string;
  upsModel?: string;
}): boolean {
  return [
    asset.monitorSerial,
    asset.monitorAssetCode,
    asset.monitorMake,
    asset.monitorModel,
    asset.keyboardSerial,
    asset.keyboardAssetCode,
    asset.keyboardMake,
    asset.keyboardModel,
    asset.keyboardConnectivity,
    asset.mouseSerial,
    asset.mouseAssetCode,
    asset.mouseMake,
    asset.mouseModel,
    asset.mouseConnectivity,
    asset.upsSerial,
    asset.upsAssetCode,
    asset.upsMake,
    asset.upsModel,
  ].some((v) => String(v || "").trim() !== "");
}

function inferLaptopOrDesktop(asset: {
  assetType?: string;
  model?: string;
  monitorSerial?: string;
  monitorAssetCode?: string;
  monitorMake?: string;
  monitorModel?: string;
  keyboardSerial?: string;
  keyboardAssetCode?: string;
  keyboardMake?: string;
  keyboardModel?: string;
  keyboardConnectivity?: string;
  mouseSerial?: string;
  mouseAssetCode?: string;
  mouseMake?: string;
  mouseModel?: string;
  mouseConnectivity?: string;
  upsSerial?: string;
  upsAssetCode?: string;
  upsMake?: string;
  upsModel?: string;
}): "Laptop" | "Desktop" | "" {
  const typeLower = (asset.assetType || "").trim().toLowerCase();
  if (typeLower === "laptop") return "Laptop";
  if (typeLower === "desktop") return "Desktop";

  if (hasDesktopPeripherals(asset)) return "Desktop";

  const model = (asset.model || "").trim().toLowerCase();
  if (/\b(tc|tower|desktop|optiplex|thinkcentre|prodesk|elitedesk|rog strix gt)\b/.test(model)) {
    return "Desktop";
  }

  return "";
}

/** Infer Camera vs NVR when sheet has grouped CCTV sub-category but no Asset Type column. */
export function inferCctvDeviceType(asset: {
  assetType?: string;
  subCategory?: string;
  model?: string;
  make?: string;
}): "Camera" | "NVR" | "" {
  const type = (asset.assetType || "").trim();
  if (type === "Camera" || type === "NVR") return type;

  const sub = (asset.subCategory || "").trim().toLowerCase();
  const isCctvContext =
    sub === "cctv / security device" || type.toLowerCase() === "cctv / security device";

  const haystack = `${asset.make || ""} ${asset.model || ""}`.trim().toLowerCase();
  if (isCctvContext) {
    if (/(nvr|dvr|uvr|u-vr|uvm|network video|video recorder)/.test(haystack)) {
      return "NVR";
    }
    if (/(camera|ipc|bullet|dome|ptz|cctv cam)/.test(haystack)) {
      return "Camera";
    }
    return "Camera";
  }

  if (/(nvr|dvr|network video recorder)/.test(haystack)) {
    return "NVR";
  }

  return "";
}

/** Resolve the specific type selected at registration, never a grouped sub-category label. */
export function resolveSpecificAssetType(asset: {
  assetType?: string;
  subCategory?: string;
  assetTypeId?: string;
  mainCategory?: string;
  assetName?: string;
  model?: string;
  make?: string;
  monitorSerial?: string;
  monitorAssetCode?: string;
  monitorMake?: string;
  monitorModel?: string;
  keyboardSerial?: string;
  keyboardAssetCode?: string;
  keyboardMake?: string;
  keyboardModel?: string;
  keyboardConnectivity?: string;
  mouseSerial?: string;
  mouseAssetCode?: string;
  mouseMake?: string;
  mouseModel?: string;
  mouseConnectivity?: string;
  upsSerial?: string;
  upsAssetCode?: string;
  upsMake?: string;
  upsModel?: string;
}): string {
  const main = (asset.mainCategory || "").trim();
  const type = (asset.assetType || "").trim();
  const sub = (asset.subCategory || "").trim();
  const name = (asset.assetName || "").trim();

  if (main && main !== "IT Assets") {
    if (type && !isItOnlyAssetType(type) && !isGroupedSubCategory(type)) return type;
    const inferred = inferCategoryAssetType(main, name, sub, type);
    if (inferred) return inferred;
    if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) return sub;
    return defaultAssetTypeForCategory(main, sub);
  }

  if (type === "Camera" || type === "NVR") return type;

  // Model/sub-category beats a stale "Laptop" default saved without Asset Type column
  const cctvType = inferCctvDeviceType(asset);
  if (cctvType) return cctvType;

  if (type && !isGroupedSubCategory(type)) return type;

  const fromId = asset.assetTypeId ? TYPE_ID_LABELS[asset.assetTypeId.trim().toLowerCase()] : "";
  if (fromId) return fromId;

  const grouped =
    isGroupedSubCategory(sub) ||
    isGroupedSubCategory(type) ||
    (!type && !sub);

  if (sub === "Laptop / Desktop" || type === "Laptop / Desktop" || (grouped && sub.toLowerCase() === "laptop / desktop")) {
    const inferred = inferLaptopOrDesktop(asset);
    if (inferred) return inferred;
  }

  if (sub && !isGroupedSubCategory(sub)) return sub;

  return type && !isGroupedSubCategory(type) ? type : "";
}

/** Show the specific asset type chosen at registration, not grouped sub-category labels. */
export function formatSelectedTypeLabel(asset: {
  assetType?: string;
  subCategory?: string;
  assetTypeId?: string;
  mainCategory?: string;
  assetName?: string;
  model?: string;
  make?: string;
  monitorSerial?: string;
  monitorAssetCode?: string;
  monitorMake?: string;
  monitorModel?: string;
  keyboardSerial?: string;
  keyboardAssetCode?: string;
  keyboardMake?: string;
  keyboardModel?: string;
  keyboardConnectivity?: string;
  mouseSerial?: string;
  mouseAssetCode?: string;
  mouseMake?: string;
  mouseModel?: string;
  mouseConnectivity?: string;
  upsSerial?: string;
  upsAssetCode?: string;
  upsMake?: string;
  upsModel?: string;
}): string {
  return resolveSpecificAssetType(asset) || "—";
}
