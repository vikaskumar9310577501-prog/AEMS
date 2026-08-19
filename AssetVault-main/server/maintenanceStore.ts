import fs from "fs";
import path from "path";
import { isSupabaseMode } from "./sqlConfig.js";
import { DATA_BUCKET, downloadFromStorage, uploadToStorage } from "./supabaseClient.js";
import {
  DEFAULT_MACHINE_TYPES,
  type MaintenanceComplaint,
  type MaintenanceMachine,
  type MaintenanceMeta,
} from "../src/types/maintenance.js";

const MACHINES_FILE = "maintenance_machines";
const META_FILE = "maintenance_meta";
const COMPLAINTS_FILE = "maintenance_complaints";

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(name) || Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    name,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function localPath(name: string): string {
  return path.join(process.cwd(), "data", `${name}.json`);
}

async function loadJson<T>(name: string, fallback: T): Promise<T> {
  if (isSupabaseMode()) {
    const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
    if (!remote) return fallback;
    try {
      return JSON.parse(new TextDecoder().decode(remote.bytes)) as T;
    } catch {
      return fallback;
    }
  }
  try {
    const file = localPath(name);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(name: string, data: unknown): Promise<void> {
  if (isSupabaseMode()) {
    await uploadToStorage(
      `tables/${name}.json`,
      Buffer.from(JSON.stringify(data, null, 2)),
      "application/json",
      DATA_BUCKET
    );
    return;
  }
  const file = localPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function defaultMeta(): MaintenanceMeta {
  return {
    machineTypes: [...DEFAULT_MACHINE_TYPES],
    plantContacts: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function listMaintenanceMachines(): Promise<MaintenanceMachine[]> {
  const rows = await loadJson<MaintenanceMachine[]>(MACHINES_FILE, []);
  return Array.isArray(rows) ? rows : [];
}

export async function getMaintenanceMachine(id: string): Promise<MaintenanceMachine | null> {
  const rows = await listMaintenanceMachines();
  return rows.find((r) => r.id === id) || null;
}

export async function getMaintenanceMachineByAssetCode(assetCode: string): Promise<MaintenanceMachine | null> {
  const code = String(assetCode || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  const rows = await listMaintenanceMachines();
  return rows.find((r) => String(r.assetCode || "").trim().toUpperCase() === code) || null;
}

export async function upsertMaintenanceMachine(machine: MaintenanceMachine): Promise<MaintenanceMachine> {
  return withLock(MACHINES_FILE, async () => {
    const rows = await listMaintenanceMachines();
    const idx = rows.findIndex((r) => r.id === machine.id);
    if (idx >= 0) rows[idx] = machine;
    else rows.push(machine);
    await saveJson(MACHINES_FILE, rows);
    return machine;
  });
}

export async function deleteMaintenanceMachine(id: string): Promise<boolean> {
  return withLock(MACHINES_FILE, async () => {
    const rows = await listMaintenanceMachines();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await saveJson(MACHINES_FILE, next);
    return true;
  });
}

export async function listMaintenanceComplaints(): Promise<MaintenanceComplaint[]> {
  const rows = await loadJson<MaintenanceComplaint[]>(COMPLAINTS_FILE, []);
  return Array.isArray(rows) ? rows : [];
}

export async function getMaintenanceComplaint(id: string): Promise<MaintenanceComplaint | null> {
  const rows = await listMaintenanceComplaints();
  return rows.find((r) => r.id === id) || null;
}

export async function upsertMaintenanceComplaint(
  complaint: MaintenanceComplaint
): Promise<MaintenanceComplaint> {
  return withLock(COMPLAINTS_FILE, async () => {
    const rows = await listMaintenanceComplaints();
    const idx = rows.findIndex((r) => r.id === complaint.id);
    if (idx >= 0) rows[idx] = complaint;
    else rows.push(complaint);
    await saveJson(COMPLAINTS_FILE, rows);
    return complaint;
  });
}

export async function getMaintenanceMeta(): Promise<MaintenanceMeta> {
  const meta = await loadJson<MaintenanceMeta | null>(META_FILE, null);
  if (!meta || !Array.isArray(meta.machineTypes)) return defaultMeta();
  const merged = Array.from(
    new Set([...DEFAULT_MACHINE_TYPES, ...meta.machineTypes].map((t) => String(t).trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  return {
    ...meta,
    machineTypes: merged,
    plantContacts: meta.plantContacts || {},
  };
}

export async function saveMaintenanceMeta(meta: MaintenanceMeta): Promise<MaintenanceMeta> {
  return withLock(META_FILE, async () => {
    const next: MaintenanceMeta = {
      ...meta,
      machineTypes: Array.from(
        new Set((meta.machineTypes || []).map((t) => String(t).trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
      plantContacts: meta.plantContacts || {},
      updatedAt: new Date().toISOString(),
    };
    await saveJson(META_FILE, next);
    return next;
  });
}

export async function addMachineType(typeName: string): Promise<MaintenanceMeta> {
  const name = String(typeName || "").trim();
  if (!name) throw new Error("Machine type is required");
  const meta = await getMaintenanceMeta();
  if (!meta.machineTypes.some((t) => t.toLowerCase() === name.toLowerCase())) {
    meta.machineTypes.push(name);
  }
  return saveMaintenanceMeta(meta);
}
