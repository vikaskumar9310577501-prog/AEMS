import fs from "fs";
import path from "path";
import os from "os";
import type { AuditLogRecord } from "../src/types/redesigned.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const AUDIT_LOGS_FILE = path.join(CACHE_DIR, "audit_logs.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(AUDIT_LOGS_FILE)) {
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readAuditLogs(): AuditLogRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(AUDIT_LOGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLogRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeAuditLogs(list: AuditLogRecord[]) {
  ensureFile();
  fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function addAuditLog(
  userEmail: string,
  action: string,
  targetId: string,
  oldVal: string | Record<string, unknown>,
  newVal: string | Record<string, unknown>,
  remarks: string,
  proxyToGas?: (payload: Record<string, unknown>) => Promise<unknown>
): AuditLogRecord {
  const list = readAuditLogs();
  const logId = "L-" + Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date().toISOString();

  const oldString = typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal || "");
  const newString = typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal || "");

  const record: AuditLogRecord = {
    "Log ID": logId,
    "User Email": userEmail || "system@assetqr.local",
    "Action": action,
    "Target ID": targetId,
    "Date & Time": now,
    "Old Value": oldString,
    "New Value": newString,
    "Remarks": remarks || "",
  };

  list.unshift(record); // Prepend so most recent is first
  if (list.length > 500) list.pop(); // Keep cache size bounded
  writeAuditLogs(list);

  // Fire-and-forget sync to GAS
  if (proxyToGas) {
    proxyToGas({ action: "add_audit_log", row: record }).catch(err => {
      console.warn("Failed to sync audit log to GAS:", err);
    });
  }

  return record;
}

export async function fetchAuditLogsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<AuditLogRecord[]> {
  try {
    const result = (await proxyToGas({ action: "list_audit_logs" })) as {
      logs?: AuditLogRecord[];
      error?: string;
    };
    if (result?.logs && Array.isArray(result.logs)) {
      writeAuditLogs(result.logs);
      return result.logs;
    }
  } catch (e) {
    console.warn("fetchAuditLogsFromGas:", e);
  }
  return readAuditLogs();
}
