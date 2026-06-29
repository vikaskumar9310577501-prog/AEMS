import type { MappedAsset } from "./assetHelpers.js";

const CATEGORY_PREFIX: Record<string, string> = {
  "IT Assets": "IT",
  "Office Assets": "OFF",
  "Electrical Assets": "ELE",
  "Production Assets": "PRD",
  "Safety Assets": "SAF",
  "Vehicle Assets": "VEH",
  "Furniture Assets": "FUR",
  "Software License Assets": "SW",
  "Software / License Assets": "SW",
  "Admin Facility Assets": "ADM",
  "Maintenance Assets": "MNT",
};

function normCode(value: string): string {
  return value.trim().toLowerCase();
}

/** IT Assets and Software / License use manual codes; other categories are auto-generated. */
export function isManualAssetCodeCategory(mainCategory: string): boolean {
  const cat = (mainCategory || "IT Assets").trim();
  return cat === "Software / License Assets";
}

/** @deprecated Use isManualAssetCodeCategory — department no longer drives asset code logic */
export function isManualAssetCodeDepartment(_department: string): boolean {
  return false;
}

export function generateAssetCode(assets: MappedAsset[], mainCategory: string): string {
  const prefix = CATEGORY_PREFIX[mainCategory] || "AST";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i");
  let maxSeq = 0;

  for (const asset of assets) {
    const code = String(asset.assetCode || "").trim();
    const match = code.match(pattern);
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10) || 0);
    }
  }

  let candidate = "";
  let attempts = 0;
  do {
    maxSeq += 1;
    candidate = `${prefix}-${year}-${String(maxSeq).padStart(5, "0")}`;
    attempts += 1;
  } while (
    attempts < 10000 &&
    assets.some((a) => normCode(String(a.assetCode || "")) === normCode(candidate))
  );

  return candidate;
}
