import type { MappedAsset } from "./assetHelpers.js";

export type UniqueField = "serialNumber" | "assetCode" | "macAddress" | "vehicleNumber" | "uniqueCode";

const FIELD_KEYS: Record<UniqueField, string[]> = {
  serialNumber: ["serialNumber", "Serial Number", "SN"],
  assetCode: ["assetCode", "Asset Code"],
  macAddress: ["macAddress", "MAC Address", "MAC"],
  vehicleNumber: ["vehicleNumber", "Vehicle Number"],
  uniqueCode: ["uniqueCode", "Unique Code"],
};

function norm(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getAssetFieldValue(asset: MappedAsset | Record<string, unknown>, field: UniqueField): string {
  if (field === "vehicleNumber") {
    const rec = asset as MappedAsset;
    const d = rec.dynamicDetails || (asset as Record<string, unknown>).dynamicDetails as Record<string, string>;
    if (d?.vehicle_number) return String(d.vehicle_number).trim();
    if (d?.vehicleNumber) return String(d.vehicleNumber).trim();
  }

  const keys = FIELD_KEYS[field];
  for (const key of keys) {
    const v = (asset as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}

export function findDuplicateAsset(
  assets: MappedAsset[],
  field: UniqueField,
  value: string,
  excludeId?: string
): MappedAsset | undefined {
  const needle = norm(value);
  if (!needle) return undefined;

  return assets.find((asset) => {
    if (excludeId) {
      const aId = String(asset.id).replace(/^0+/, "");
      const eId = String(excludeId).replace(/^0+/, "");
      if (aId && eId && aId === eId) return false;
    }
    const current = getAssetFieldValue(asset, field);
    if (!current) return false;
    return norm(current) === needle;
  });
}

/** Cross-check serial vs vehicle number stored in dynamic details */
export function findAnyIdentifierDuplicate(
  assets: MappedAsset[],
  assetData: Record<string, unknown>,
  excludeId?: string
): { field: UniqueField; duplicate: MappedAsset } | null {
  const checks: { field: UniqueField; value: string }[] = [
    { field: "serialNumber", value: String(assetData.serialNumber || "") },
    { field: "assetCode", value: String(assetData.assetCode || "") },
    { field: "macAddress", value: String(assetData.macAddress || "") },
    { field: "uniqueCode", value: String(assetData.uniqueCode || assetData.assetCode || "") },
  ];

  const details = (assetData.dynamicDetails as Record<string, string>) || {};
  const veh = String(details.vehicle_number || details.vehicleNumber || "").trim();
  if (veh) checks.push({ field: "vehicleNumber", value: veh });

  for (const { field, value } of checks) {
    if (!value.trim()) continue;
    const dup = findDuplicateAsset(assets, field, value, excludeId);
    if (dup) return { field, duplicate: dup };
  }

  // Serial must not match another asset's vehicle number and vice versa
  const serial = String(assetData.serialNumber || "").trim();
  if (serial) {
    const asNorm = norm(serial);
    const cross = assets.find((a) => {
      if (excludeId && String(a.id).replace(/^0+/, "") === String(excludeId).replace(/^0+/, "")) return false;
      const vehN = getAssetFieldValue(a, "vehicleNumber");
      return vehN && norm(vehN) === asNorm;
    });
    if (cross) return { field: "serialNumber", duplicate: cross };
  }

  if (veh) {
    const vn = norm(veh);
    const cross = assets.find((a) => {
      if (excludeId && String(a.id).replace(/^0+/, "") === String(excludeId).replace(/^0+/, "")) return false;
      return a.serialNumber && norm(a.serialNumber) === vn;
    });
    if (cross) return { field: "vehicleNumber", duplicate: cross };
  }

  return null;
}

export function uniqueFieldLabel(field: UniqueField): string {
  const labels: Record<UniqueField, string> = {
    serialNumber: "Serial number",
    assetCode: "Asset code",
    macAddress: "MAC address",
    vehicleNumber: "Vehicle number",
    uniqueCode: "Unique code",
  };
  return labels[field];
}
