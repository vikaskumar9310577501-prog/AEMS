import type { MappedAsset } from "./assetHelpers.js";

function norm(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function vehicleNumber(asset: MappedAsset): string {
  const d = asset.dynamicDetails || {};
  return String(d.vehicle_number || d.vehicleNumber || "").trim();
}

/** One row per asset on dashboard — prefer newest by updatedDate */
export function dedupeAssets(assets: MappedAsset[]): MappedAsset[] {
  const byId = new Map<string, MappedAsset>();
  const bySerial = new Map<string, string>();
  const byCode = new Map<string, string>();
  const byVehicle = new Map<string, string>();

  const score = (a: MappedAsset) => {
    const t = Date.parse(a.updatedDate || a.createdDate || "") || 0;
    return t;
  };

  const keep = (candidate: MappedAsset, existing: MappedAsset) =>
    score(candidate) >= score(existing) ? candidate : existing;

  for (const a of assets) {
    const id = String(a.id || "").replace(/^0+/, "").trim();
    if (!id) continue;

    let current = byId.get(id);
    if (!current) {
      byId.set(id, a);
      continue;
    }
    byId.set(id, keep(a, current));
  }

  const out: MappedAsset[] = [];
  for (const a of byId.values()) {
    const serial = norm(a.serialNumber || "");
    const code = norm(a.assetCode || "");
    const veh = norm(vehicleNumber(a));

    if (serial && bySerial.has(serial) && bySerial.get(serial) !== a.id) continue;
    if (code && byCode.has(code) && byCode.get(code) !== a.id) continue;
    if (veh && byVehicle.has(veh) && byVehicle.get(veh) !== a.id) continue;

    if (serial) bySerial.set(serial, a.id);
    if (code) byCode.set(code, a.id);
    if (veh) byVehicle.set(veh, a.id);
    out.push(a);
  }

  return out.sort((x, y) => String(x.id).localeCompare(String(y.id), undefined, { numeric: true }));
}
