import type { AppUser } from "./dataStore.js";
import { readAppData, writeAppData } from "./dataStore.js";
import { readCache, readCacheStale, writeCache, deleteCache, getCacheAge, isCacheForDifferentSpreadsheet, touchCacheSpreadsheetId } from "./cacheStore.js";
import { getAllUsers } from "./usersService.js";

const CACHE_KEY = "users";
const FRESH_MS = 3 * 60 * 1000;

let syncPromise: Promise<AppUser[]> | null = null;

type SyncDeps = {
  proxyToGas: (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>;
  gasWebappUrl?: string;
  spreadsheetId?: string;
  usersSheetGid?: string;
  listFromGoogleApi?: (id: string, gid: string) => Promise<AppUser[] | null>;
};

export function getCachedUsers(): AppUser[] {
  const cached = readCacheStale<AppUser[]>(CACHE_KEY);
  if (cached) return cached;
  return [];
}

export function invalidateUsersCache() {
  deleteCache(CACHE_KEY);
  const data = readAppData();
  data.users = [];
  writeAppData(data);
}

export function getUsersSyncMeta() {
  const age = getCacheAge(CACHE_KEY);
  return {
    cacheAgeMs: age,
    isFresh: age !== null && age < FRESH_MS,
    syncing: !!syncPromise,
  };
}

export async function getUsersWithCache(deps: SyncDeps, force = false): Promise<{
  users: AppUser[];
  fromCache: boolean;
  syncing: boolean;
}> {
  if (deps.spreadsheetId && isCacheForDifferentSpreadsheet(deps.spreadsheetId)) {
    deleteCache(CACHE_KEY);
    force = true;
  }

  if (deps.gasWebappUrl) {
    const users = await syncUsersNow(deps);
    return { users, fromCache: false, syncing: false };
  }

  return { users: readAppData().users, fromCache: true, syncing: false };
}

export function syncUsersInBackground(deps: SyncDeps): Promise<AppUser[]> {
  if (!syncPromise) {
    syncPromise = pullUsers(deps)
      .then((users) => {
        writeCache(CACHE_KEY, users);
        const data = readAppData();
        data.users = users;
        writeAppData(data);
        if (deps.spreadsheetId) touchCacheSpreadsheetId(deps.spreadsheetId);
        return users;
      })
      .catch((err) => {
        console.warn("Background users sync failed:", err);
        return getCachedUsers();
      })
      .finally(() => {
        syncPromise = null;
      });
  }
  return syncPromise;
}

async function pullUsers(deps: SyncDeps): Promise<AppUser[]> {
  return getAllUsers(
    deps.proxyToGas,
    deps.gasWebappUrl,
    deps.spreadsheetId,
    deps.usersSheetGid,
    deps.listFromGoogleApi
  );
}

export async function syncUsersNow(deps: SyncDeps): Promise<AppUser[]> {
  const users = await pullUsers(deps);
  writeCache(CACHE_KEY, users);
  const data = readAppData();
  data.users = users;
  writeAppData(data);
  if (deps.spreadsheetId) touchCacheSpreadsheetId(deps.spreadsheetId);
  return users;
}
