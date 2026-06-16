import type { Request, Response, NextFunction } from "express";
import { getSessionFromRequest, type SessionUser } from "./sessionAuth.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionUser;
    }
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function buildAllowedOrigins(): string[] {
  const origins = [
    process.env.FRONTEND_URL?.trim(),
    process.env.NETLIFY_URL?.trim(),
    process.env.APP_BASE_URL?.trim(),
    process.env.APP_URL?.trim(),
  ].filter(Boolean) as string[];
  return [...new Set(origins)];
}

function originAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }
  return false;
}

export function isPublicApiRoute(req: Request): boolean {
  const path = req.path;
  if (req.method === "GET" && path === "/api/auth/session") return true;
  if (req.method === "POST" && path === "/api/auth/logout") return true;
  if (req.method === "POST" && path === "/api/auth/request-otp") return true;
  if (req.method === "POST" && path === "/api/auth/verify-otp") return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+$/.test(path)) return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+\/pdf$/.test(path)) return true;
  if (req.method === "GET" && path === "/api/file/view") return true;
  return false;
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function configureCors(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && originAllowed(origin, allowedOrigins)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

export function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
  // Only throttle OTP attempts — session checks run on every page load.
  const isOtpRoute =
    req.method === "POST" &&
    (req.path === "/api/auth/request-otp" || req.path === "/api/auth/verify-otp");
  if (!isOtpRoute) {
    next();
    return;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : "") ||
    req.socket.remoteAddress ||
    "unknown";
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max =
    process.env.NODE_ENV === "production"
      ? req.path.includes("request-otp")
        ? 10
        : 20
      : req.path.includes("request-otp")
        ? 30
        : 60;

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    res.status(429).json({ error: "Too many OTP attempts. Wait a few minutes and try again." });
    return;
  }
  next();
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  if (isPublicApiRoute(req)) {
    next();
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized. Please log in." });
    return;
  }
  req.authUser = session;
  next();
}
