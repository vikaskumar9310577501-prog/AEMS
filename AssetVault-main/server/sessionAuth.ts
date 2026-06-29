import crypto from "crypto";
import type { Request, Response } from "express";
import { getEnv } from "./env.js";

export const SESSION_COOKIE = "aems_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  email: string;
  role: string;
}

function getSecret(): string {
  const secret = getEnv("SESSION_SECRET");
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (minimum 32 characters) in production");
  }
  console.warn("[Security] Using dev SESSION_SECRET — set SESSION_SECRET in .env before production.");
  return "dev-insecure-session-secret-change-me!!";
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function createSessionToken(user: SessionUser): string {
  const secret = getSecret();
  const payload = {
    email: user.email.toLowerCase(),
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const secret = getSecret();
    const data = `${header}.${body}`;
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body)) as { email?: string; role?: string; exp?: number };
    if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;
    return { email: payload.email.toLowerCase(), role: String(payload.role || "User") };
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie || "";
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export function getSessionFromRequest(req: Request): SessionUser | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = verifySessionToken(auth.slice(7).trim());
    if (token) return token;
  }
  const cookieToken = parseCookies(req)[SESSION_COOKIE];
  if (cookieToken) return verifySessionToken(cookieToken);
  return null;
}

export function setSessionCookie(res: Response, user: SessionUser): string {
  const token = createSessionToken(user);
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
  return token;
}

export function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
