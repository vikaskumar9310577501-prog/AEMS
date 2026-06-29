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
  return (
    getCachedUsers().find((u) => u.email.trim().toLowerCase() === email) ||
    readAppData().users.find((u) => u.email.trim().toLowerCase() === email) ||
    null
  );
}

export function requireRequestUser(req: Request): AppUser | null {
  return resolveRequestUser(req);
}
