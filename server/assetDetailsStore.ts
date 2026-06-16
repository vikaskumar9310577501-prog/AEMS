import fs from "fs";
import path from "path";
import os from "os";

export type AssetDetailsMap = Record<string, Record<string, string>>;

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const DETAILS_FILE = path.join(CACHE_DIR, "asset-details.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(DETAILS_FILE)) {
    fs.writeFileSync(DETAILS_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}

export function normalizeAssetId(id: string | number | undefined): string {
  const s = String(id ?? "").trim();
  if (!s) return "";
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return String(n);
  return s;
}

export function readAssetDetailsMap(): AssetDetailsMap {
  ensureFile();
  try {
    const raw = fs.readFileSync(DETAILS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AssetDetailsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeAssetDetailsMap(map: AssetDetailsMap) {
  ensureFile();
  fs.writeFileSync(DETAILS_FILE, JSON.stringify(map, null, 2), "utf-8");
}

export function getDetailsForAsset(assetId: string | number): Record<string, string> {
  const key = normalizeAssetId(assetId);
  const map = readAssetDetailsMap();
  return map[key] ? { ...map[key] } : {};
}

export function saveDetailsForAsset(assetId: string | number, details: Record<string, string>) {
  const key = normalizeAssetId(assetId);
  if (!key) return;
  const map = readAssetDetailsMap();
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(details)) {
    if (String(k).trim()) cleaned[k] = String(v ?? "").trim();
  }
  if (Object.keys(cleaned).length === 0) {
    delete map[key];
  } else {
    map[key] = cleaned;
  }
  writeAssetDetailsMap(map);
}

export function deleteDetailsForAsset(assetId: string | number) {
  const key = normalizeAssetId(assetId);
  const map = readAssetDetailsMap();
  delete map[key];
  writeAssetDetailsMap(map);
}

export async function fetchDetailsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<AssetDetailsMap> {
  try {
    const result = (await proxyToGas({ action: "get_asset_details" })) as {
      details?: AssetDetailsMap;
      error?: string;
    };
    if (result?.error) {
      console.warn("GAS get_asset_details:", result.error);
      return readAssetDetailsMap();
    }
    if (result?.details && typeof result.details === "object") {
      writeAssetDetailsMap(result.details);
      return result.details;
    }
  } catch (e) {
    console.warn("fetchDetailsFromGas failed:", e);
  }
  return readAssetDetailsMap();
}

export async function persistDetailsToGas(
  assetId: string | number,
  details: Record<string, string>,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await proxyToGas({
      action: "save_asset_details",
      assetId: normalizeAssetId(assetId),
      details,
    })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS save failed" };
  }
}

export async function deleteDetailsFromGas(
  assetId: string | number,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
) {
  try {
    await proxyToGas({ action: "delete_asset_details", assetId: normalizeAssetId(assetId) });
  } catch {
    /* local delete still applies */
  }
}

export function mergeDetailsIntoAssets<T extends { id: string; ipAddress?: string; hostName?: string }>(
  assets: T[],
  map?: AssetDetailsMap
): (T & { dynamicDetails: Record<string, string> })[] {
  const detailsMap = map ?? readAssetDetailsMap();
  return assets.map((a) => {
    const dynamicDetails = detailsMap[normalizeAssetId(a.id)] || {};
    const ip =
      String(a.ipAddress || "").trim() ||
      String(dynamicDetails.ip_address || dynamicDetails.ipAddress || "").trim();
    const host =
      String(a.hostName || "").trim() ||
      String(
        dynamicDetails.host_name || dynamicDetails.hostname || dynamicDetails.hostName || ""
      ).trim();
    return {
      ...a,
      ...(ip ? { ipAddress: ip } : {}),
      ...(host ? { hostName: host } : {}),
      dynamicDetails,
    };
  });
}
