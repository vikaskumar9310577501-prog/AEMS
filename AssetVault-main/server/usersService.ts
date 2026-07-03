import { readAppData, writeAppData, normalizeStringList, type AppUser } from "./dataStore.js";

export function normalizeUser(raw: Record<string, unknown>): AppUser {
  return {
    email: String(raw.email || raw.Email || raw.MAIL || "").trim().toLowerCase(),
    role: String(raw.role || raw.Role || "User"),
    locations: normalizeStringList(raw.locations ?? raw.Locations ?? raw.location),
    plants: normalizeStringList(raw.plants ?? raw.Plants ?? raw.plant),
    categories: normalizeStringList(raw.categories ?? raw.Categories ?? raw.category ?? raw.access),
    allowDelete: !!raw.allowDelete || String(raw.allowDelete) === "true",
  };
}

const IT_ADMIN_ROLES = new Set(["it admin", "it_admin"]);

export function isItAdminRole(role: string | undefined | null): boolean {
  return IT_ADMIN_ROLES.has(String(role || "").trim().toLowerCase());
}

export function canDeleteUserRecord(user: AppUser | undefined | null): boolean {
  return !!user && !isItAdminRole(user.role);
}

function parseUsersFromGasResult(result: unknown): AppUser[] {
  if (!result) return [];

  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return parseUsersSheetRows(result as unknown[][]);
    }
    return result
      .map((u) => normalizeUser(u as Record<string, unknown>))
      .filter((u) => u.email);
  }

  if (typeof result !== "object") return [];

  const r = result as Record<string, unknown>;
  if (r.error) return [];

  const buckets = [r.users, r.data, r.rows, r.list, r.result];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      if (bucket.length > 0 && Array.isArray(bucket[0])) {
        return parseUsersSheetRows(bucket as unknown[][]);
      }
      return bucket
        .map((u) => normalizeUser(u as Record<string, unknown>))
        .filter((u) => u.email);
    }
  }

  return [];
}

function parseUsersSheetRows(data: unknown[][]): AppUser[] {
  if (data.length < 2) return [];
  const headers = data[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const roleIdx = headers.findIndex((h) => h.includes("role"));
  const locIdx = headers.findIndex((h) => h.includes("location"));
  const plantIdx = headers.findIndex((h) => h.includes("plant"));
  const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("access"));
  if (emailIdx === -1) return [];

  return data
    .slice(1)
    .map((row) =>
      normalizeUser({
        email: row[emailIdx],
        role: roleIdx !== -1 ? row[roleIdx] : "User",
        locations: locIdx !== -1 ? row[locIdx] : [],
        plants: plantIdx !== -1 ? row[plantIdx] : [],
        categories: catIdx !== -1 ? row[catIdx] : [],
      })
    )
    .filter((u) => u.email);
}

import { gasGetUrl } from "./gasClient.js";

/** Fetch users sheet — parallel GAS attempts (max ~20s), not sequential */
export async function fetchUsersFromGas(
  proxyToGas: (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>,
  gasWebappUrl?: string,
  spreadsheetId?: string,
  usersSheetGid?: string
): Promise<AppUser[]> {
  if (gasWebappUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(gasGetUrl(gasWebappUrl, { action: "list_users" }), { signal: controller.signal });
        const text = await res.text();
        const parsed = parseUsersFromGasResult(JSON.parse(text));
        if (parsed.length >= 0) return parsed;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.warn("fetchUsersFromGas GET:", e);
    }
  }

  try {
    const parsed = parseUsersFromGasResult(
      await proxyToGas({ action: "list_users" }, 15000)
    );
    return parsed;
  } catch (e) {
    console.warn("fetchUsersFromGas POST:", e);
    return [];
  }
}

export function mergeUsers(...lists: AppUser[][]): AppUser[] {
  const map = new Map<string, AppUser>();
  for (const list of lists) {
    for (const u of list) {
      if (!u.email) continue;
      map.set(u.email, u);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
}

function cleanScopeList(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values || []) {
    const clean = String(value || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}

function hasAllScope(values: string[] | undefined): boolean {
  return cleanScopeList(values).some((value) => value.toLowerCase() === "all");
}

function withoutAllScope(values: string[] | undefined): string[] {
  return cleanScopeList(values).filter((value) => value.toLowerCase() !== "all");
}

function mergeScopeList(primary: string[] | undefined, fallback: string[] | undefined, role: string): string[] {
  if (isItAdminRole(role)) return ["All"];

  const primarySpecific = withoutAllScope(primary);
  if (primarySpecific.length > 0) return primarySpecific;

  const fallbackSpecific = withoutAllScope(fallback);
  if (fallbackSpecific.length > 0) return fallbackSpecific;

  if (hasAllScope(primary) || hasAllScope(fallback)) return [];
  return [];
}

function mergeFetchedUserWithLocal(fetched: AppUser, local?: AppUser): AppUser {
  const role = fetched.role || local?.role || "User";
  return {
    ...(local || fetched),
    ...fetched,
    role,
    locations: mergeScopeList(fetched.locations, local?.locations, role),
    plants: mergeScopeList(fetched.plants, local?.plants, role),
    categories: mergeScopeList(fetched.categories, local?.categories, role),
    allowDelete: fetched.allowDelete || local?.allowDelete || false,
  };
}

function mergeFetchedUsersWithLocal(fetchedUsers: AppUser[], localUsers: AppUser[]): AppUser[] {
  if (fetchedUsers.length === 0) return localUsers;
  const localByEmail = new Map(localUsers.map((u) => [u.email.toLowerCase(), u]));
  return fetchedUsers
    .map((user) => mergeFetchedUserWithLocal(user, localByEmail.get(user.email.toLowerCase())))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function upsertLocalUser(user: AppUser) {
  const data = readAppData();
  const idx = data.users.findIndex((u) => u.email === user.email);
  if (idx === -1) data.users.push(user);
  else data.users[idx] = user;
  writeAppData(data);
}

export function deleteLocalUser(email: string) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return;
  const data = readAppData();
  data.users = data.users.filter((u) => u.email !== normalized);
  writeAppData(data);
}

export async function getAllUsers(
  proxyToGas: (payload: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>,
  gasWebappUrl?: string,
  spreadsheetId?: string,
  usersSheetGid?: string,
  listFromGoogleApi?: (id: string, gid: string) => Promise<AppUser[] | null>
): Promise<AppUser[]> {
  const localUsers = readAppData().users;

  let sheetUsers: AppUser[] = [];

  if (spreadsheetId && usersSheetGid && usersSheetGid !== "0" && listFromGoogleApi) {
    try {
      const apiUsers = await listFromGoogleApi(spreadsheetId, usersSheetGid);
      if (apiUsers && apiUsers.length > 0) sheetUsers = apiUsers;
    } catch (err) {
      console.warn("Google API users fetch failed:", err);
    }
  }

  if (gasWebappUrl) {
    try {
      sheetUsers = await fetchUsersFromGas(
        proxyToGas,
        gasWebappUrl,
        spreadsheetId,
        usersSheetGid
      );
    } catch (err) {
      console.warn("GAS users fetch failed:", err);
    }

    const mergedUsers = mergeFetchedUsersWithLocal(sheetUsers, localUsers);
    const data = readAppData();
    data.users = mergedUsers;
    writeAppData(data);
    return mergedUsers;
  }

  if (sheetUsers.length > 0) {
    const mergedUsers = mergeFetchedUsersWithLocal(sheetUsers, localUsers);
    const data = readAppData();
    data.users = mergedUsers;
    writeAppData(data);
    return mergedUsers;
  }

  return localUsers;
}
