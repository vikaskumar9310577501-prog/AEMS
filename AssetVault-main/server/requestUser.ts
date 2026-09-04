import type { Request } from "express";
import { readAppData, type AppUser } from "./dataStore.js";
import { getCachedUsers } from "./usersSync.js";

export function getSessionEmail(req: Request): string {
  return (
    req.authUser?.email?.trim().toLowerCase() ||
    String(req.query.userEmail || req.body?.userEmail || req.headers["x-user-email"] || "")
      .trim()
      .toLowerCase()
  );
}

function cleanList(arr?: string[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .flatMap((x) => String(x || "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveRequestUser(req: Request): AppUser | null {
  const email = getSessionEmail(req);
  if (!email) return null;
  const session = req.authUser?.email?.trim().toLowerCase() === email ? req.authUser : null;
  const cached =
    getCachedUsers().find((u) => u.email.trim().toLowerCase() === email) ||
    readAppData().users.find((u) => u.email.trim().toLowerCase() === email) ||
    null;

  if (!cached && !session) return null;

  const role = session?.role || cached?.role || "User";

  const cachedLocs = cleanList(cached?.locations);
  const sessionLocs = cleanList(session?.locations);
  const locations = cachedLocs.length > 0 ? cachedLocs : sessionLocs;

  const cachedPlants = cleanList(cached?.plants);
  const sessionPlants = cleanList(session?.plants);
  const plants = cachedPlants.length > 0 ? cachedPlants : sessionPlants;

  const cachedCats = cleanList(cached?.categories);
  const sessionCats = cleanList(session?.categories);
  const categories = cachedCats.length > 0 ? cachedCats : sessionCats;

  return {
    email,
    role,
    locations,
    plants,
    categories,
    allowDelete: cached?.allowDelete ?? session?.allowDelete,
  };
}

export function requireRequestUser(req: Request): AppUser | null {
  return resolveRequestUser(req);
}
