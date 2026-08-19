import { getEnv } from "./env.js";

export const SQL_BACKEND_URL = "sql://aems";

export function isSupabaseMode(): boolean {
  return Boolean(getEnv("SUPABASE_URL") && (getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY")));
}

export function isSqlMode(): boolean {
  if (isSupabaseMode()) return false;
  if (process.env.VERCEL || process.env.NETLIFY) return false;
  const value = getEnv("USE_SQL_SERVER").toLowerCase();
  if (value === "false" || value === "0" || value === "no") return false;
  if (value === "true" || value === "1" || value === "yes") return true;
  return Boolean(getEnv("SQL_SERVER") || getEnv("SQL_INSTANCE") || getEnv("SQL_DATABASE"));
}

export function isDbMode(): boolean {
  return isSupabaseMode() || isSqlMode();
}

export function getSupabaseUrl(): string {
  return getEnv("SUPABASE_URL").replace(/\/$/, "");
}

export function getSupabaseSecret(): string {
  return getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSqlBackendUrl(url?: string): boolean {
  return String(url || "").trim().toLowerCase().startsWith("sql://");
}

export function parseSqlServer(raw: string): { server: string; instanceName?: string } {
  const cleaned = String(raw || "localhost").trim().replace(/^\\\\/, "");
  if (cleaned.includes("\\")) {
    const [server, instanceName] = cleaned.split("\\");
    return { server: server || "localhost", instanceName: instanceName || undefined };
  }
  return { server: cleaned || "localhost" };
}

export function getSqlConnectionConfig() {
  const parsed = parseSqlServer(getEnv("SQL_SERVER") || "localhost");
  const instanceName = getEnv("SQL_INSTANCE") || parsed.instanceName || "AEMS";
  const portRaw = getEnv("SQL_PORT");
  const port = portRaw ? parseInt(portRaw, 10) : undefined;
  const server = parsed.server && parsed.server.toUpperCase() !== "AEMS" ? parsed.server : "localhost";
  return {
    user: getEnv("SQL_USER") || "aems_app",
    password: getEnv("SQL_PASSWORD") || "AemsLocal2026!Sql",
    server,
    database: getEnv("SQL_DATABASE") || "AEMS",
    port: Number.isFinite(port) ? port : undefined,
    options: {
      encrypt: getEnv("SQL_ENCRYPT") === "true",
      trustServerCertificate: getEnv("SQL_TRUST_CERT") !== "false",
      enableArithAbort: true,
      instanceName: Number.isFinite(port) ? undefined : instanceName,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}
