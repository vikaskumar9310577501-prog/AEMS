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
  const locations =
    (cached?.locations && cached.locations.length > 0 ? cached.locations : session?.locations) || [];
  const plants =
    (cached?.plants && cached.plants.length > 0 ? cached.plants : session?.plants) || [];
  const categories =
    (cached?.categories && cached.categories.length > 0 ? cached.categories : session?.categories) || [];

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
