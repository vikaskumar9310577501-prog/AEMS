import { fetchAllAssets, type MappedAsset } from "./assetHelpers.js";
import { healMisalignedAssetFields } from "../src/lib/healAssetFields.js";
import {
  readCache,
  readCacheStale,
  writeCache,
  deleteCache,
  getCacheAge,
  touchCacheSpreadsheetId,
  isCacheForDifferentSpreadsheet,
} from "./cacheStore.js";
import { readAppData } from "./dataStore.js";
import { getEnv } from "./env.js";
import {
  buildAssetSyncKeySet,
  computeAssetsFingerprint,
  isAssetOnSheet,
  normalizeSheetId,
  shouldBlockSheetDeletion,
} from "./sheetSync.js";

const CACHE_KEY = "assets";
const DELETED_CACHE_KEY = "assets_deleted_tombstones";
const RECENT_UPSERT_CACHE_KEY = "assets_recent_upserts";
const FRESH_MS = 2 * 60 * 1000;
const DELETE_TOMBSTONE_MS = 10 * 60 * 1000;
const RECENT_UPSERT_MS = 3 * 60 * 1000;
/** Minimum gap between background sheet pulls triggered by sync-meta polling. */
const META_SYNC_MIN_INTERVAL_MS = 45 * 1000;

let refreshPromise: Promise<MappedAsset[]> | null = null;
let lastScheduledSyncAt = 0;

export interface AssetsSyncMeta {
  count: number;
  fingerprint: string;
  cacheAgeMs: number | null;
  syncing: boolean;
  lastRemovedCount: number;
}

let lastRemovedCount = 0;

function healAssetsList(assets: MappedAsset[]): MappedAsset[] {
  return filterDeletedAssets(assets.map((a) => healMisalignedAssetFields(a)));
}

type DeletedAssetTombstone = Record<string, number>;
type RecentUpsertMap = Record<string, number>;

function readDeletedTombstones(): DeletedAssetTombstone {
  const raw = readCacheStale<DeletedAssetTombstone>(DELETED_CACHE_KEY) || {};
  const now = Date.now();
  const active: DeletedAssetTombstone = {};
  for (const [id, expiresAt] of Object.entries(raw)) {
    if (Number(expiresAt) > now) active[id] = Number(expiresAt);
  }
  if (Object.keys(active).length !== Object.keys(raw).length) {
    writeCache(DELETED_CACHE_KEY, active);
  }
  return active;
}

function rememberDeletedAsset(assetId: string) {
  const id = normalizeSheetId(assetId);
  if (!id) return;
  const tombstones = readDeletedTombstones();
  tombstones[id] = Date.now() + DELETE_TOMBSTONE_MS;
  writeCache(DELETED_CACHE_KEY, tombstones);
}

function forgetDeletedAsset(assetId: string) {
  const id = normalizeSheetId(assetId);
  if (!id) return;
  const tombstones = readDeletedTombstones();
  if (!(id in tombstones)) return;
  delete tombstones[id];
  writeCache(DELETED_CACHE_KEY, tombstones);
}

function filterDeletedAssets(assets: MappedAsset[]): MappedAsset[] {
  const tombstones = readDeletedTombstones();
  const deletedIds = new Set(Object.keys(tombstones));
  if (deletedIds.size === 0) return assets;
  return assets.filter((asset) => !deletedIds.has(normalizeSheetId(asset.id)));
}

function readRecentUpserts(): RecentUpsertMap {
  const raw = readCacheStale<RecentUpsertMap>(RECENT_UPSERT_CACHE_KEY) || {};
  const now = Date.now();
  const active: RecentUpsertMap = {};
  for (const [id, expiresAt] of Object.entries(raw)) {
    if (Number(expiresAt) > now) active[id] = Number(expiresAt);
  }
  if (Object.keys(active).length !== Object.keys(raw).length) {
    writeCache(RECENT_UPSERT_CACHE_KEY, active);
  }
  return active;
}

function rememberRecentUpsert(asset: MappedAsset) {
  const id = normalizeSheetId(asset.id);
  if (!id) return;
  const recent = readRecentUpserts();
  recent[id] = Date.now() + RECENT_UPSERT_MS;
  writeCache(RECENT_UPSERT_CACHE_KEY, recent);
}

function forgetRecentUpsertsSeenOnSheet(sheetAssets: MappedAsset[]) {
  const recent = readRecentUpserts();
  if (Object.keys(recent).length === 0) return;
  let changed = false;
  for (const asset of sheetAssets) {
    const id = normalizeSheetId(asset.id);
    if (id && recent[id]) {
      delete recent[id];
      changed = true;
    }
  }
  if (changed) writeCache(RECENT_UPSERT_CACHE_KEY, recent);
}

function mergeAssetsBySyncKey(previous: MappedAsset[], incoming: MappedAsset[]): MappedAsset[] {
  const sheetKeys = buildAssetSyncKeySet(filterDeletedAssets(incoming));
  const recentUpserts = readRecentUpserts();
  const merged = filterDeletedAssets(previous).filter((asset) => {
    const id = normalizeSheetId(asset.id);
    return isAssetOnSheet(asset, sheetKeys) || !!recentUpserts[id];
  });
  for (const raw of filterDeletedAssets(incoming)) {
    const asset = healMisalignedAssetFields(raw);
    const keys = buildAssetSyncKeySet([asset]);
    const idx = merged.findIndex((existing) => isAssetOnSheet(existing, keys));
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...asset };
    } else {
      merged.push(asset);
    }
  }
  return merged;
}

function reconcileSheetDeletions(sheetAssets: MappedAsset[]): number {
  const previous = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  if (previous.length === 0) return 0;

  const sheetKeys = buildAssetSyncKeySet(filterDeletedAssets(sheetAssets));
  const recentUpserts = readRecentUpserts();
  const removed = previous.filter((a) => {
    const id = normalizeSheetId(a.id);
    return !recentUpserts[id] && !isAssetOnSheet(a, sheetKeys);
  });

  const guard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: removed.length,
  });

  if (guard.block) {
    console.warn(`[AMS] Sheet sync: deletion reconcile blocked - ${guard.reason}`);
    return 0;
  }

  return removed.length;
}

async function pullFromSheet(gasUrl: string): Promise<MappedAsset[]> {
  const dbMode = readAppData().settings.dbMode;
  const previous = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  const sheetAssets = filterDeletedAssets(await fetchAllAssets(gasUrl, dbMode));

  const emptyGuard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: 0,
  });

  if (emptyGuard.block) {
    console.warn(`[AMS] Sheet sync: keeping previous cache - ${emptyGuard.reason}`);
    return previous;
  }

  if (sheetAssets.length === 0 && previous.length > 0) {
    console.warn(
      `[AMS] Sheet sync: keeping ${previous.length} cached assets because Database returned 0 rows.`
    );
    return previous;
  }

  lastRemovedCount = reconcileSheetDeletions(sheetAssets);
  forgetRecentUpsertsSeenOnSheet(sheetAssets);
  return mergeAssetsBySyncKey(previous, sheetAssets);
}

export function getAssetsSyncMeta(): AssetsSyncMeta {
  const cached = readCacheStale<MappedAsset[]>(CACHE_KEY);
  return {
    count: cached?.length ?? 0,
    fingerprint: cached ? computeAssetsFingerprint(cached) : "",
    cacheAgeMs: getCacheAge(CACHE_KEY),
    syncing: !!refreshPromise,
    lastRemovedCount,
  };
}

/** Schedule a background pull when cache is stale (used by lightweight polling). */
export function scheduleAssetsSyncIfStale(gasUrl: string): void {
  if (!gasUrl || refreshPromise) return;

  const age = getCacheAge(CACHE_KEY);
  const now = Date.now();
  if (now - lastScheduledSyncAt < META_SYNC_MIN_INTERVAL_MS) return;
  if (age !== null && age < META_SYNC_MIN_INTERVAL_MS) return;

  lastScheduledSyncAt = now;
  void refreshAssetsInBackground(gasUrl);
}

export function getCachedAssets(): MappedAsset[] | null {
  const cached = readCache<MappedAsset[]>(CACHE_KEY, FRESH_MS) ?? readCacheStale<MappedAsset[]>(CACHE_KEY);
  return cached ? healAssetsList(cached) : null;
}

export async function getAssetsWithCache(
  gasUrl: string,
  force = false
): Promise<{ assets: MappedAsset[]; fromCache: boolean; syncing: boolean }> {
  const spreadsheetId = getEnv("SPREADSHEET_ID");
  if (spreadsheetId && isCacheForDifferentSpreadsheet(spreadsheetId)) {
    deleteCache(CACHE_KEY);
    touchCacheSpreadsheetId(spreadsheetId);
    force = true;
  }

  const fresh = readCache<MappedAsset[]>(CACHE_KEY, FRESH_MS);
  if (fresh && !force) {
    void refreshAssetsInBackground(gasUrl);
    return { assets: healAssetsList(fresh), fromCache: true, syncing: !!refreshPromise };
  }

  const stale = readCacheStale<MappedAsset[]>(CACHE_KEY);
  if (stale && !force) {
    void refreshAssetsInBackground(gasUrl);
    return { assets: healAssetsList(stale), fromCache: true, syncing: true };
  }

  const assets = await refreshAssetsNow(gasUrl);
  return { assets: healAssetsList(assets), fromCache: false, syncing: false };
}

export function refreshAssetsInBackground(gasUrl: string): Promise<MappedAsset[]> {
  if (!refreshPromise) {
    refreshPromise = pullFromSheet(gasUrl)
      .then((assets) => {
        writeCache(CACHE_KEY, assets);
        return assets;
      })
      .catch((err) => {
        console.warn("Background asset sync failed:", err);
        return readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function refreshAssetsNow(gasUrl: string): Promise<MappedAsset[]> {
  try {
    const assets = await pullFromSheet(gasUrl);
    writeCache(CACHE_KEY, assets);
    return assets;
  } catch (err) {
    const stale = readCacheStale<MappedAsset[]>(CACHE_KEY);
    if (stale) {
      console.warn("Asset sync failed; keeping stale cache:", err);
      return healAssetsList(stale);
    }
    throw err;
  }
}

export function invalidateAssetCache() {
  deleteCache(CACHE_KEY);
}

export function upsertAssetInCache(asset: MappedAsset) {
  forgetDeletedAsset(String(asset.id || ""));
  const cached = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  const healed = healMisalignedAssetFields(asset);
  rememberRecentUpsert(healed);
  const targetId = normalizeSheetId(healed.id);
  const idx = cached.findIndex((a) => normalizeSheetId(a.id) === targetId);
  if (idx >= 0) {
    cached[idx] = { ...cached[idx], ...healed };
  } else {
    cached.push(healed);
  }
  writeCache(CACHE_KEY, cached);
}

export function removeAssetFromCache(assetId: string) {
  rememberDeletedAsset(assetId);
  const cached = readCacheStale<MappedAsset[]>(CACHE_KEY);
  if (!cached) return;
  const targetId = normalizeSheetId(assetId);
  writeCache(
    CACHE_KEY,
    cached.filter((a) => normalizeSheetId(a.id) !== targetId)
  );
}
