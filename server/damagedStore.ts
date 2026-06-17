import fs from "fs";
import path from "path";
import os from "os";
import type { DamagedItemRecord } from "../src/types/redesigned.js";
import { getEnv } from "./env.js";
import { gasGet } from "./gasClient.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const DAMAGED_FILE = path.join(CACHE_DIR, "damaged_items.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(DAMAGED_FILE)) {
    fs.writeFileSync(DAMAGED_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readDamagedItems(): DamagedItemRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(DAMAGED_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DamagedItemRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeDamagedItems(list: DamagedItemRecord[]) {
  ensureFile();
  fs.writeFileSync(DAMAGED_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function upsertDamagedItem(item: DamagedItemRecord): DamagedItemRecord {
  const list = readDamagedItems();
  const recordId = String(item["Record ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const assetId = String(item["Asset ID"] || "").trim();
  if (!assetId) throw new Error("Asset ID is required");

  const now = new Date().toISOString();
  const normalized: DamagedItemRecord = {
    "Record ID": recordId,
    "Asset ID": assetId,
    "Asset Name": String(item["Asset Name"] || "").trim(),
    "Damage Date": item["Damage Date"] || now,
    "Damage Reason": String(item["Damage Reason"] || "").trim(),
    "Reported By": String(item["Reported By"] || "").trim(),
    "Repair Required": item["Repair Required"] || "No",
    "Estimated Cost": Number(item["Estimated Cost"]) || 0,
    "Status": item["Status"] || "Reported",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Photo URL": String(item["Photo URL"] || "").trim(),
  };

  const idx = list.findIndex((e) => e["Record ID"] === recordId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;

  writeDamagedItems(list);
  return normalized;
}

export function deleteDamagedItem(recordId: string): boolean {
  const id = String(recordId || "").trim();
  const list = readDamagedItems();
  const next = list.filter((e) => e["Record ID"] !== id);
  if (next.length === list.length) return false;
  writeDamagedItems(next);
  return true;
}

function normalizeDamagedItem(item: DamagedItemRecord): DamagedItemRecord {
  return {
    ...item,
    "Record ID": String(item["Record ID"] || "").trim(),
    "Asset ID": String(item["Asset ID"] || "").trim(),
    "Asset Name": String(item["Asset Name"] || "").trim(),
    "Damage Date": String(item["Damage Date"] || "").trim(),
    "Damage Reason": String(item["Damage Reason"] || "").trim(),
    "Reported By": String(item["Reported By"] || "").trim(),
    "Repair Required": item["Repair Required"] || "No",
    "Estimated Cost": Number(item["Estimated Cost"]) || 0,
    "Status": item["Status"] || "Reported",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Photo URL": String(item["Photo URL"] || "").trim(),
  };
}

export function deleteDamagedItemsForAsset(assetId: string): number {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readDamagedItems();
  const next = list.filter((e) => {
    const itemAssetId = String(e["Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return itemAssetId !== id;
  });
  writeDamagedItems(next);
  return list.length - next.length;
}

export async function fetchDamagedItemsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<DamagedItemRecord[]> {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = (await gasGet(gasUrl, { action: "list_damaged_items" }, 20000)) as {
        items?: DamagedItemRecord[];
        error?: string;
      };
      if (result?.items && Array.isArray(result.items)) {
        const sanitized = result.items.map(normalizeDamagedItem);
        writeDamagedItems(sanitized);
        return sanitized;
      }
    } catch (e) {
      console.warn("fetchDamagedItemsFromGas GET:", e);
    }
  }

  try {
    const result = (await proxyToGas({ action: "list_damaged_items" })) as {
      items?: DamagedItemRecord[];
      error?: string;
    };
    if (result?.items && Array.isArray(result.items)) {
      const sanitized = result.items.map(normalizeDamagedItem);
      writeDamagedItems(sanitized);
      return sanitized;
    }
  } catch (e) {
    console.warn("fetchDamagedItemsFromGas POST:", e);
  }
  return readDamagedItems();
}

export async function persistDamagedItemToGas(
  op: "add" | "update" | "delete",
  item: DamagedItemRecord,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_damaged_item" : op === "update" ? "update_damaged_item" : "delete_damaged_item";
    const id = item["Record ID"];
    const result = (await proxyToGas({ action, id, row: item })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
