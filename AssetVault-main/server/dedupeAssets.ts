import type { MappedAsset } from "./assetHelpers.js";

function norm(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function vehicleNumber(asset: MappedAsset): string {
  const d = asset.dynamicDetails || {};
  return String(d.vehicle_number || d.vehicleNumber || "").trim();
}

/** One row per asset on dashboard — deduplicate by asset ID (keeping newest) */
export function dedupeAssets(assets: MappedAsset[]): MappedAsset[] {
  const byId = new Map<string, MappedAsset>();

  const score = (a: MappedAsset) => {
    const t = Date.parse(a.updatedDate || a.createdDate || "") || 0;
    return t;
  };

  const keep = (candidate: MappedAsset, existing: MappedAsset) =>
    score(candidate) >= score(existing) ? candidate : existing;

  for (const a of assets) {
    const id = String(a.id || "").replace(/^0+/, "").trim();
    if (!id) continue;

    const current = byId.get(id);
    if (!current) {
      byId.set(id, a);
      continue;
    }
    byId.set(id, keep(a, current));
  }

  const out = Array.from(byId.values());
  return out.sort((x, y) => String(x.id).localeCompare(String(y.id), undefined, { numeric: true }));
}
