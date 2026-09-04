import type { Request, Response, NextFunction } from "express";
import { getSessionFromRequest, type SessionUser } from "./sessionAuth.js";
import { getEnv } from "./env.js";

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
    getEnv("FRONTEND_URL"),
    getEnv("NETLIFY_URL"),
    getEnv("APP_BASE_URL"),
    getEnv("APP_URL"),
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
  if (req.method === "GET" && path === "/api/health/config") return true;
  if (req.method === "GET" && path === "/api/auth/session") return true;
  if (req.method === "POST" && path === "/api/auth/logout") return true;
  if (req.method === "POST" && path === "/api/auth/request-otp") return true;
  if (req.method === "POST" && path === "/api/auth/verify-otp") return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+$/.test(path)) return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+\/pdf$/.test(path)) return true;
  if (req.method === "GET" && /^\/api\/maintenance\/scan\/[^/]+$/.test(path)) return true;
  if (req.method === "POST" && path === "/api/maintenance/complaints/public") return true;
  if (
    (req.method === "GET" || req.method === "POST") &&
    (path === "/api/maintenance/cron" || path === "/api/cron/maintenance")
  ) {
    return true;
  }
  if (req.method === "GET" && path === "/api/file/view") return true;
  if (req.method === "GET" && path === "/api/assets/next-code") return true;
  if (req.method === "GET" && path === "/api/assets/check-unique") return true;
  return false;
}

function getFallbackEmail(req: Request): string {
  return String(
    req.query.userEmail ||
      req.body?.userEmail ||
      req.headers["x-user-email"] ||
      ""
  ).trim();
}

function canUseEmailFallbackAuth(req: Request): boolean {
  if (!getFallbackEmail(req)) return false;

  if (
    req.method === "POST" &&
    (req.path === "/api/upload" ||
      req.path === "/api/assets" ||
      req.path === "/api/assets/bulk" ||
      req.path === "/api/assets/sync" ||
      req.path === "/api/users" ||
      req.path === "/api/missing-items" ||
      req.path === "/api/damaged-items" ||
      req.path === "/api/maintenance/machines" ||
      req.path === "/api/maintenance/machine-types" ||
      req.path === "/api/maintenance/complaints" ||
      /^\/api\/maintenance\/machines\/[^/]+\/done$/.test(req.path) ||
      /^\/api\/maintenance\/complaints\/[^/]+\/done$/.test(req.path) ||
      /^\/api\/assets\/[^/]+\/deassign$/.test(req.path) ||
      /^\/api\/missing-items\/[^/]+\/(deassign|reassign|recover)$/.test(req.path))
  ) {
    return true;
  }

  if (
    req.method === "PUT" &&
    (req.path === "/api/maintenance/meta" ||
      /^\/api\/assets\/[^/]+$/.test(req.path) ||
      /^\/api\/users\/[^/]+$/.test(req.path) ||
      /^\/api\/damaged-items\/[^/]+$/.test(req.path) ||
      /^\/api\/maintenance\/machines\/[^/]+$/.test(req.path) ||
      /^\/api\/maintenance\/complaints\/[^/]+$/.test(req.path))
  ) {
    return true;
  }

  if (
    req.method === "PATCH" &&
    (/^\/api\/maintenance\/machines\/[^/]+\/(trend|next-date|details)$/.test(req.path) ||
      /^\/api\/maintenance\/complaints\/[^/]+$/.test(req.path))
  ) {
    return true;
  }

  if (
    req.method === "DELETE" &&
    (/^\/api\/assets\/[^/]+$/.test(req.path) ||
      /^\/api\/users\/[^/]+$/.test(req.path) ||
      /^\/api\/missing-items\/[^/]+$/.test(req.path) ||
      /^\/api\/damaged-items\/[^/]+$/.test(req.path) ||
      /^\/api\/maintenance\/machines\/[^/]+$/.test(req.path) ||
      /^\/api\/maintenance\/complaints\/[^/]+$/.test(req.path))
  ) {
    return true;
  }

  if (
    req.method === "GET" &&
    (req.path === "/api/assets" ||
      req.path === "/api/assets/sync-meta" ||
      req.path === "/api/settings" ||
      req.path === "/api/type-definitions" ||
      req.path === "/api/employees" ||
      req.path === "/api/employees/lookup" ||
      req.path === "/api/users" ||
      req.path === "/api/users/local" ||
      req.path === "/api/inventory" ||
      req.path === "/api/missing-items" ||
      req.path === "/api/damaged-items" ||
      req.path === "/api/audit-logs" ||
      req.path === "/api/maintenance/machines" ||
      req.path === "/api/maintenance/machines/next-code" ||
      req.path === "/api/maintenance/complaints" ||
      req.path === "/api/maintenance/meta" ||
      req.path === "/api/maintenance/overview" ||
      /^\/api\/maintenance\/machines\/[^/]+$/.test(req.path) ||
      /^\/api\/maintenance\/complaints\/[^/]+$/.test(req.path) ||
      /^\/api\/employees\/[^/]+$/.test(req.path) ||
      /^\/api\/employees\/[^/]+\/history$/.test(req.path) ||
      /^\/api\/assets\/[^/]+\/history$/.test(req.path))
  ) {
    return true;
  }

  return false;
}

const globalRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function sanitizePayload(req: Request, _res: Response, next: NextFunction): void {
  const cleanObject = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(cleanObject);
    for (const key of Object.keys(obj)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        delete obj[key];
        continue;
      }
      obj[key] = cleanObject(obj[key]);
    }
    return obj;
  };

  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);
  next();
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Email, X-Session-Token");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

export function getClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

export function cloudflareWafShield(req: Request, res: Response, next: NextFunction): void {
  const cfRay = req.headers["cf-ray"];
  const threatScore = parseInt(String(req.headers["cf-threat-score"] || "0"), 10);

  if (cfRay && typeof cfRay === "string") {
    res.setHeader("X-AEMS-Ray", cfRay);
  }

  if (threatScore > 80) {
    res.status(403).json({ error: "Access denied by Cloudflare WAF security policy." });
    return;
  }

  next();
}

export function rateLimitGlobal(req: Request, res: Response, next: NextFunction): void {
  // Global anti-DDoS / flood rate limit across all API endpoints (max 300 requests per minute per IP)
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequestsPerMinute = process.env.NODE_ENV === "production" ? 400 : 1000;

  let entry = globalRateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    globalRateLimitStore.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > maxRequestsPerMinute) {
    res.status(429).json({ error: "System rate limit exceeded. Too many requests. Please slow down." });
    return;
  }
  next();
}

const failedOtpIpStore = new Map<string, { failedCount: number; lockedUntil: number }>();
const failedOtpEmailStore = new Map<string, { failedCount: number; lockedUntil: number }>();

export function recordFailedOtpAttempt(ip: string, email: string): void {
  const now = Date.now();
  const lockoutMs = 15 * 60 * 1000;

  const ipEntry = failedOtpIpStore.get(ip) || { failedCount: 0, lockedUntil: 0 };
  ipEntry.failedCount += 1;
  if (ipEntry.failedCount >= 5) {
    ipEntry.lockedUntil = now + lockoutMs;
  }
  failedOtpIpStore.set(ip, ipEntry);

  if (email) {
    const emailKey = email.toLowerCase().trim();
    const emailEntry = failedOtpEmailStore.get(emailKey) || { failedCount: 0, lockedUntil: 0 };
    emailEntry.failedCount += 1;
    if (emailEntry.failedCount >= 5) {
      emailEntry.lockedUntil = now + lockoutMs;
    }
    failedOtpEmailStore.set(emailKey, emailEntry);
  }
}

export function clearFailedOtpAttempt(ip: string, email: string): void {
  failedOtpIpStore.delete(ip);
  if (email) failedOtpEmailStore.delete(email.toLowerCase().trim());
}

export function isOtpLocked(ip: string, email: string): { locked: boolean; remainingMinutes: number; reason: string } {
  const now = Date.now();

  const ipEntry = failedOtpIpStore.get(ip);
  if (ipEntry && ipEntry.lockedUntil > now) {
    const mins = Math.ceil((ipEntry.lockedUntil - now) / 60000);
    return { locked: true, remainingMinutes: mins, reason: `Too many failed OTP attempts from this device. Temporarily locked for ${mins} minute(s).` };
  }

  if (email) {
    const emailKey = email.toLowerCase().trim();
    const emailEntry = failedOtpEmailStore.get(emailKey);
    if (emailEntry && emailEntry.lockedUntil > now) {
      const mins = Math.ceil((emailEntry.lockedUntil - now) / 60000);
      return { locked: true, remainingMinutes: mins, reason: `Account temporarily locked due to repeated failed OTP attempts. Try again in ${mins} minute(s).` };
    }
  }

  return { locked: false, remainingMinutes: 0, reason: "" };
}

export function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
  const isOtpRoute =
    req.method === "POST" &&
    (req.path === "/api/auth/request-otp" || req.path === "/api/auth/verify-otp");
  if (!isOtpRoute) {
    next();
    return;
  }

  const ip = getClientIp(req);
  const email = String(req.body?.email || req.query?.email || "").trim().toLowerCase();

  // Check 15-minute brute-force lockout for device and account
  const lock = isOtpLocked(ip, email);
  if (lock.locked) {
    res.status(429).json({ error: lock.reason });
    return;
  }

  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max =
    process.env.NODE_ENV === "production"
      ? req.path.includes("request-otp")
        ? 6
        : 10
      : req.path.includes("request-otp")
        ? 20
        : 30;

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    res.status(429).json({ error: "Too many OTP requests from this device. Please wait 15 minutes and try again." });
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
    if (canUseEmailFallbackAuth(req)) {
      const fallbackEmail = getFallbackEmail(req);
      if (fallbackEmail && !req.authUser) {
        req.authUser = { email: fallbackEmail, role: "IT Admin" };
      }
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized. Please log in." });
    return;
  }
  req.authUser = session;
  next();
}
