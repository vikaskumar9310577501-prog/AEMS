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
  const cached =
    getCachedUsers().find((u) => u.email.trim().toLowerCase() === email) ||
    readAppData().users.find((u) => u.email.trim().toLowerCase() === email) ||
    null;
  const session = req.authUser;
  const role = (session?.email === email && session.role) || cached?.role || "";
  if (!cached && !session) return null;
  return {
    email,
    role: role || "User",
    locations: cached?.locations || [],
    plants: cached?.plants || [],
    categories: cached?.categories || [],
    allowDelete: cached?.allowDelete,
  };
}

export function requireRequestUser(req: Request): AppUser | null {
  return resolveRequestUser(req);
}
