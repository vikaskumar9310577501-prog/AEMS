import crypto from "crypto";

/** Normalize sheet row id for comparison (001 → 1). */
export function normalizeSheetId(id: string | number | undefined | null): string {
  return String(id ?? "")
    .replace(/^0+/, "")
    .trim();
}

/** Stable sync key — prefer Asset ID, fall back to Asset Code / Unique Code. */
export function assetSyncKey(asset: {
  id?: string | number;
  assetCode?: string;
  uniqueCode?: string;
}): string {
  const id = normalizeSheetId(asset.id);
  if (id) return `id:${id}`;

  const code = String(asset.assetCode || asset.uniqueCode || "")
    .trim()
    .toLowerCase();
  if (code) return `code:${code}`;

  return "";
}

export function buildAssetSyncKeySet(
  assets: Array<{ id?: string | number; assetCode?: string; uniqueCode?: string }>
): Set<string> {
  const keys = new Set<string>();
  for (const asset of assets) {
    const id = normalizeSheetId(asset.id);
    const code = String(asset.assetCode || asset.uniqueCode || "")
      .trim()
      .toLowerCase();
    if (id) keys.add(`id:${id}`);
    if (code) keys.add(`code:${code}`);
  }
  return keys;
}

export function isAssetOnSheet(
  asset: { id?: string | number; assetCode?: string; uniqueCode?: string },
  sheetKeys: Set<string>
): boolean {
  const id = normalizeSheetId(asset.id);
  const code = String(asset.assetCode || asset.uniqueCode || "")
    .trim()
    .toLowerCase();

  if (id && sheetKeys.has(`id:${id}`)) return true;
  if (code && sheetKeys.has(`code:${code}`)) return true;
  return false;
}

/** Compact fingerprint for change detection (count + hash of ids/codes). */
export function computeAssetsFingerprint(
  assets: Array<{ id?: string | number; assetCode?: string; uniqueCode?: string }>
): string {
  const lines: string[] = [];
  for (const a of assets) {
    const id = normalizeSheetId(a.id);
    const code = String(a.assetCode || a.uniqueCode || "")
      .trim()
      .toLowerCase();
    if (id) lines.push(`id:${id}`);
    if (code) lines.push(`code:${code}`);
  }
  lines.sort();
  return crypto.createHash("sha1").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/** Block accidental mass-delete when the sheet response looks wrong. */
export function shouldBlockSheetDeletion(params: {
  previousCount: number;
  sheetCount: number;
  removedCount: number;
  maxDeleteRatio?: number;
  minPreviousForEmptyGuard?: number;
}): { block: boolean; reason?: string } {
  const {
    previousCount,
    sheetCount,
    removedCount,
    maxDeleteRatio = 0.5,
    minPreviousForEmptyGuard = 3,
  } = params;

  if (sheetCount === 0 && previousCount >= minPreviousForEmptyGuard) {
    return {
      block: true,
      reason: `sheet returned 0 rows but cache has ${previousCount} assets`,
    };
  }

  if (previousCount > 0 && removedCount > 0 && removedCount / previousCount > maxDeleteRatio) {
    return {
      block: true,
      reason: `would remove ${removedCount}/${previousCount} assets (>${Math.round(maxDeleteRatio * 100)}% threshold)`,
    };
  }

  return { block: false };
}
