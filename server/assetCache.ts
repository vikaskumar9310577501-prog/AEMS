import { fetchAllAssets, type MappedAsset } from "./assetHelpers.js";
import { healMisalignedAssetFields } from "../src/lib/healAssetFields.js";
import { readCache, readCacheStale, writeCache, deleteCache, getCacheAge, touchCacheSpreadsheetId, isCacheForDifferentSpreadsheet } from "./cacheStore.js";
import { readAppData } from "./dataStore.js";
import { deleteAssetLocal } from "./sqlDb.js";
import { deleteDetailsForAsset } from "./assetDetailsStore.js";
import { getEnv } from "./env.js";
import {
  assetSyncKey,
  buildAssetSyncKeySet,
  computeAssetsFingerprint,
  isAssetOnSheet,
  normalizeSheetId,
  shouldBlockSheetDeletion,
} from "./sheetSync.js";

const CACHE_KEY = "assets";
const FRESH_MS = 2 * 60 * 1000;
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
  return assets.map((a) => healMisalignedAssetFields(a));
}

async function reconcileSheetDeletions(sheetAssets: MappedAsset[]): Promise<number> {
  const previous = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  if (previous.length === 0) return 0;

  const sheetKeys = buildAssetSyncKeySet(sheetAssets);
  const removed = previous.filter((a) => !isAssetOnSheet(a, sheetKeys));

  const guard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: removed.length,
  });

  if (guard.block) {
    console.warn(`[AMS] Sheet sync: deletion reconcile blocked — ${guard.reason}`);
    return 0;
  }

  if (removed.length === 0) return 0;

  for (const asset of removed) {
    try {
      await deleteAssetLocal(asset.id);
      deleteDetailsForAsset(asset.id);
      console.log(
        `[AMS] Sheet sync: removed local asset ${assetSyncKey(asset)} (${asset.mainCategory}) — deleted from sheet`
      );
    } catch (err) {
      console.warn(`[AMS] Sheet sync: failed to remove local asset ${asset.id}:`, err);
    }
  }

  return removed.length;
}

async function pullFromSheet(gasUrl: string): Promise<MappedAsset[]> {
  const dbMode = readAppData().settings.dbMode;
  const previous = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  const sheetAssets = await fetchAllAssets(gasUrl, dbMode);

  const emptyGuard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: 0,
  });

  if (emptyGuard.block) {
    console.warn(`[AMS] Sheet sync: keeping previous cache — ${emptyGuard.reason}`);
    return previous;
  }

  lastRemovedCount = await reconcileSheetDeletions(sheetAssets);
  return healAssetsList(sheetAssets);
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
  const assets = await pullFromSheet(gasUrl);
  writeCache(CACHE_KEY, assets);
  return assets;
}

export function invalidateAssetCache() {
  deleteCache(CACHE_KEY);
}

export function upsertAssetInCache(asset: MappedAsset) {
  const cached = readCacheStale<MappedAsset[]>(CACHE_KEY) || [];
  const healed = healMisalignedAssetFields(asset);
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
  const cached = readCacheStale<MappedAsset[]>(CACHE_KEY);
  if (!cached) return;
  const targetId = normalizeSheetId(assetId);
  writeCache(
    CACHE_KEY,
    cached.filter((a) => normalizeSheetId(a.id) !== targetId)
  );
}
