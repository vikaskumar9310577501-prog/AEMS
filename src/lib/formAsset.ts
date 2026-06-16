import type { Asset, AssetFormData, AssetType, DesktopAccessories } from "../types";
import { normalizeWarrantyDate } from "./warrantyDate";
import { toDateInputValue } from "./formatDisplayDate";
import { healMisalignedAssetFields } from "./healAssetFields";
import { PERIPHERAL_TYPES } from "./assetCatalogByType";
import { legacyToDynamicDetails, resolveTypeDefinition, defaultTypeDefinitionsConfig } from "./typeDefinitions";
import { resolveSpecificAssetType, defaultAssetTypeForCategory } from "./assetDisplay";
import { normalizeAssetCondition } from './assetCondition';


const DEFAULT_ACCESSORIES: DesktopAccessories = {
  mouse: false,
  keyboard: false,
  monitor: false,
  ups: false,
};

/** Normalize sheet / API asset type strings to a known form value. */
export function normalizeAssetType(
  raw?: string,
  context?: Pick<Asset, "model" | "make" | "subCategory" | "assetTypeId" | "mainCategory" | "assetName">
): AssetType {
  const resolved = resolveSpecificAssetType({
    assetType: raw,
    make: context?.make,
    model: context?.model,
    subCategory: context?.subCategory,
    assetTypeId: context?.assetTypeId,
    mainCategory: context?.mainCategory,
    assetName: context?.assetName,
  });
  const t = (resolved || raw || "").trim();
  if (t === "Laptop" || t === "Desktop") return t;
  if ((PERIPHERAL_TYPES as readonly string[]).includes(t)) return t as AssetType;
  const lower = t.toLowerCase();
  const hit = PERIPHERAL_TYPES.find((p) => p.toLowerCase() === lower);
  if (hit) return hit as AssetType;
  const main = context?.mainCategory || "";
  if (main && main !== "IT Assets" && t) return t as AssetType;
  return defaultAssetTypeForCategory(main) as AssetType;
}

export function assetToFormData(asset?: Asset | null): AssetFormData {
  if (!asset) {
    return {
      location: "",
      plantCode: "",
      department: "",
      make: "",
      model: "",
      serialNumber: "",
      assetCode: "",
      accountAssetCode: "",
      vendorName: "",
      warrantyStartDate: "",
      warrantyEndDate: "",
      ram: "8GB",
      ssd: "256GB",
      cpu: "",
      windowsVersion: "Windows 11 Pro",
      assetType: "Laptop",
      accessories: { ...DEFAULT_ACCESSORIES },
      monitorSerial: "",
      monitorAssetCode: "",
      keyboardSerial: "",
      keyboardAssetCode: "",
      mouseSerial: "",
      mouseAssetCode: "",
      upsSerial: "",
      upsAssetCode: "",
      macAddress: "",
      ipAddress: "",
      hostName: "",
      contactName: "",
      contactEmail: "",
      contactMobile: "",
      documentUrl: "",
      imageUrl: "",
      additionalItems: "",

      // New fields
      assetName: "",
      mainCategory: "IT Assets",
      subCategory: "Laptop / Desktop",
      quantity: "1",
      employeeId: "",
      purchaseDate: "",
      purchaseCost: "",
      invoiceNumber: "",
      condition: "EXISTING ASSETS",
      status: "Available",
      maintenanceRequired: "No",
      lastMaintenanceDate: "",
      nextMaintenanceDate: "",
      createdBy: "",
      createdDate: "",
      updatedBy: "",
      updatedDate: "",
      extraItems: "",
      missingItems: "",
      assignedDate: "",
      returnDate: "",
      amcVendor: "",
      amcStartDate: "",
      amcEndDate: "",
      amcCost: "",
      dynamicDetails: {},
      assetTypeId: "laptop",
    };
  }

  asset = healMisalignedAssetFields(asset);

  const mainCat = asset.mainCategory || "IT Assets";
  const resolvedType = resolveSpecificAssetType({
    assetType: asset.assetType,
    subCategory: asset.subCategory,
    assetTypeId: asset.assetTypeId,
    make: asset.make,
    model: asset.model,
    mainCategory: mainCat,
    assetName: asset.assetName,
  });
  let subCategory = asset.subCategory || "";
  if (mainCat !== "IT Assets" && resolvedType) {
    if (!subCategory || subCategory === "Laptop / Desktop" || subCategory === "Laptop" || subCategory === "Desktop") {
      subCategory = resolvedType;
    }
  }

  const typeDefResolved = resolveTypeDefinition(defaultTypeDefinitionsConfig(), {
    assetTypeId: asset.assetTypeId,
    assetType: resolvedType || asset.assetType,
    mainCategory: mainCat,
    subCategory,
  });

  return {
    location: asset.location || "",
    plantCode: asset.plantCode || "",
    department: asset.department || "",
    make: asset.make || "",
    model: asset.model || "",
    serialNumber: asset.serialNumber || "",
    assetCode: asset.assetCode || asset.uniqueCode || "",
    accountAssetCode: asset.accountAssetCode || "",
    vendorName: asset.vendorName || "",
    warrantyStartDate: normalizeWarrantyDate(asset.warrantyStartDate),
    warrantyEndDate: normalizeWarrantyDate(asset.warrantyEndDate),
    ram: asset.ram || "8GB",
    ssd: asset.ssd || "256GB",
    cpu: asset.cpu || "",
    windowsVersion: asset.windowsVersion || "Windows 11 Pro",
    assetType: normalizeAssetType(asset.assetType, {
      make: asset.make,
      model: asset.model,
      subCategory,
      assetTypeId: asset.assetTypeId,
      mainCategory: mainCat,
      assetName: asset.assetName,
    }),
    accessories: asset.accessories || { ...DEFAULT_ACCESSORIES },
    monitorSerial: asset.monitorSerial || "",
    monitorAssetCode: asset.monitorAssetCode || "",
    keyboardSerial: asset.keyboardSerial || "",
    keyboardAssetCode: asset.keyboardAssetCode || "",
    mouseSerial: asset.mouseSerial || "",
    mouseAssetCode: asset.mouseAssetCode || "",
    upsSerial: asset.upsSerial || "",
    upsAssetCode: asset.upsAssetCode || "",
    macAddress: asset.macAddress || "",
    ipAddress: asset.ipAddress || "",
    hostName: asset.hostName || "",
    contactName: asset.contactName || "",
    contactEmail: asset.contactEmail || "",
    contactMobile: asset.contactMobile || "",
    documentUrl: asset.documentUrl || "",
    imageUrl: asset.imageUrl || "",
    additionalItems: asset.additionalItems || "",

    // New fields
    assetName: asset.assetName || "",
    mainCategory: mainCat,
    subCategory,
    quantity: asset.quantity || "1",
    employeeId: asset.employeeId || "",
    purchaseDate: asset.purchaseDate || "",
    purchaseCost: asset.purchaseCost || "",
    invoiceNumber: asset.invoiceNumber || "",
    condition: normalizeAssetCondition(asset.condition),
    status: asset.status || "Available",
    maintenanceRequired: asset.maintenanceRequired || "No",
    lastMaintenanceDate: asset.lastMaintenanceDate || "",
    nextMaintenanceDate: asset.nextMaintenanceDate || "",
    createdBy: asset.createdBy || "",
    createdDate: asset.createdDate || "",
    updatedBy: asset.updatedBy || "",
    updatedDate: asset.updatedDate || "",
    extraItems: asset.extraItems || "",
    missingItems: asset.missingItems || "",
    assignedDate: toDateInputValue(asset.assignedDate) || "",
    returnDate: asset.returnDate || "",
    amcVendor: asset.amcVendor || "",
    amcStartDate: asset.amcStartDate || "",
    amcEndDate: asset.amcEndDate || "",
    amcCost: asset.amcCost || "",
    dynamicDetails: legacyToDynamicDetails(typeDefResolved, asset as unknown as Record<string, unknown>),
    assetTypeId: (() => {
      let id = asset.assetTypeId || typeDefResolved?.id || "";
      if (mainCat !== "IT Assets" && (id === "laptop" || id === "desktop")) {
        id = typeDefResolved?.id || "";
      }
      return id;
    })(),
  };
}

/** Ensure select lists include the current stored value (edit mode). */
export function optionsWithValue(options: string[], current?: string): string[] {
  const c = current?.trim();
  if (!c) return options;
  if (options.includes(c)) return options;
  return [c, ...options];
}
