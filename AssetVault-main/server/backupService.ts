import fs from "fs";
import path from "path";
import os from "os";
import { listJsonRows, upsertJsonRow } from "./supabaseStore.js";
import type { MappedAsset } from "./assetHelpers.js";

const isServerless = Boolean(process.env.NETLIFY || process.env.VERCEL);
const BACKUP_DIR = isServerless
  ? path.join(os.tmpdir(), "aems-backups")
  : path.join(process.cwd(), "data", "backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export interface BackupSnapshotMeta {
  filename: string;
  timestamp: string;
  totalAssets: number;
  totalEmployees: number;
  totalUsers: number;
  fileSizeKb: number;
}

/**
 * Creates an immutable snapshot of all primary database entities.
 */
export async function createDatabaseSnapshot(reason = "Automated Periodic Backup"): Promise<BackupSnapshotMeta> {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `aems_snapshot_${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  let assets: any[] = [];
  let employees: any[] = [];
  let users: any[] = [];
  let auditLogs: any[] = [];

  try {
    assets = await listJsonRows("Assets").catch(() => []);
    employees = await listJsonRows("Employees").catch(() => []);
    users = await listJsonRows("Users").catch(() => []);
    auditLogs = await listJsonRows("AuditLogs").catch(() => []);
  } catch (err) {
    console.warn("[BackupService] Error pulling rows for backup:", err);
  }

  const payload = {
    version: "2.0",
    createdDate: new Date().toISOString(),
    reason,
    stats: {
      assetsCount: assets.length,
      employeesCount: employees.length,
      usersCount: users.length,
      auditLogsCount: auditLogs.length,
    },
    data: {
      assets,
      employees,
      users,
      auditLogs,
    },
  };

  const rawJson = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filePath, rawJson, "utf-8");

  // Keep last 30 snapshots on disk
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("aems_snapshot_"));
    if (files.length > 30) {
      files.sort().slice(0, files.length - 30).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
      });
    }
  } catch {}

  const stats = fs.statSync(filePath);
  return {
    filename,
    timestamp: payload.createdDate,
    totalAssets: assets.length,
    totalEmployees: employees.length,
    totalUsers: users.length,
    fileSizeKb: Math.round(stats.size / 1024),
  };
}

/**
 * Archive deleted assets before removal to prevent permanent accidental data loss.
 */
export async function archiveDeletedAsset(asset: Record<string, unknown>, deletedBy: string): Promise<void> {
  ensureBackupDir();
  const archivePath = path.join(BACKUP_DIR, "deleted_assets_archive.json");
  let archived: any[] = [];

  try {
    if (fs.existsSync(archivePath)) {
      archived = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
    }
  } catch {
    archived = [];
  }

  const record = {
    archiveId: "DEL-" + Date.now(),
    deletedAt: new Date().toISOString(),
    deletedBy: deletedBy || "system",
    assetCode: String(asset.assetCode || asset.id || ""),
    payload: asset,
  };

  archived.unshift(record);
  if (archived.length > 2000) archived.pop();
  fs.writeFileSync(archivePath, JSON.stringify(archived, null, 2), "utf-8");

  // Mirror to Supabase archive table if available
  try {
    await upsertJsonRow("DeletedAssetsArchive", record.archiveId, record);
  } catch {}
}

export function listLocalBackups(): BackupSnapshotMeta[] {
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("aems_snapshot_"));
    return files.map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        timestamp: stats.mtime.toISOString(),
        totalAssets: 0,
        totalEmployees: 0,
        totalUsers: 0,
        fileSizeKb: Math.round(stats.size / 1024),
      };
    }).sort((a, b) => b.filename.localeCompare(a.filename));
  } catch {
    return [];
  }
}
