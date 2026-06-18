import fs from "fs";
import path from "path";
import os from "os";

interface CacheEnvelope<T> {
  data: T;
  updatedAt: number;
}

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless 
  ? path.join(os.tmpdir(), "assetqr-cache") 
  : path.join(process.cwd(), "data", "cache");

function cachePath(key: string) {
  const safe = key.replace(/[^a-z0-9_-]/gi, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const file = cachePath(key);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as CacheEnvelope<T>;
    if (Date.now() - raw.updatedAt > maxAgeMs) return null;
    return raw.data;
  } catch {
    return null;
  }
}

export function readCacheStale<T>(key: string): T | null {
  try {
    const file = cachePath(key);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as CacheEnvelope<T>;
    return raw.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const envelope: CacheEnvelope<T> = { data, updatedAt: Date.now() };
  fs.writeFileSync(cachePath(key), JSON.stringify(envelope), "utf-8");
}

export function deleteCache(key: string) {
  try {
    const file = cachePath(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // ignore
  }
}

const KNOWN_CACHE_KEYS = [
  "assets",
  "assets_deleted_tombstones",
  "users",
  "audit_logs",
  "asset-details",
  "assignment-history",
  "employees",
  "inventory",
  "missing_items",
];

export function clearAllCaches() {
  for (const key of KNOWN_CACHE_KEYS) {
    deleteCache(key);
  }
}

const SPREADSHEET_META_KEY = "_spreadsheet_meta";

export function getCacheSpreadsheetId(): string | null {
  const meta = readCacheStale<{ spreadsheetId?: string }>(SPREADSHEET_META_KEY);
  return meta?.spreadsheetId?.trim() || null;
}

export function touchCacheSpreadsheetId(spreadsheetId: string) {
  writeCache(SPREADSHEET_META_KEY, { spreadsheetId: spreadsheetId.trim() });
}

/** True when local cache belongs to a different spreadsheet (e.g. after .env SPREADSHEET_ID change). */
export function isCacheForDifferentSpreadsheet(spreadsheetId: string | undefined): boolean {
  const id = spreadsheetId?.trim();
  if (!id) return false;
  const cached = getCacheSpreadsheetId();
  return cached !== null && cached !== id;
}

export function getCacheAge(key: string): number | null {
  try {
    const file = cachePath(key);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as CacheEnvelope<unknown>;
    return Date.now() - raw.updatedAt;
  } catch {
    return null;
  }
}
