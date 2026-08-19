import fs from "fs";
import path from "path";
import os from "os";
import type { MissingItemRecord } from "../src/types/redesigned.js";
import { getEnv } from "./env.js";
import { gasGet } from "./gasClient.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const MISSING_FILE = path.join(CACHE_DIR, "missing_items.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(MISSING_FILE)) {
    fs.writeFileSync(MISSING_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readMissingItems(): MissingItemRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(MISSING_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MissingItemRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeMissingItems(list: MissingItemRecord[]) {
  ensureFile();
  fs.writeFileSync(MISSING_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function upsertMissingItem(item: MissingItemRecord): MissingItemRecord {
  const list = readMissingItems();
  const recordId = String(item["Record ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const parentId = String(item["Parent Asset ID"] || "").trim();
  const assetType = String(item["Asset Type"] || "").trim();
  const itemName = String(item["Missing Item Name"] || "").trim() || assetType;
  if (!itemName) {
    throw new Error("Missing item name or asset type is required");
  }

  const now = new Date().toISOString();
  const normalized: MissingItemRecord = {
    "Record ID": recordId,
    "Parent Asset ID": parentId,
    "Parent Asset Name": String(item["Parent Asset Name"] || "").trim() || [String(item["Brand"] || "").trim(), String(item["Model"] || "").trim()].filter(Boolean).join(" ") || assetType || itemName,
    "Missing Item Name": itemName,
    "Asset Type": assetType || itemName,
    "Brand": String(item["Brand"] || "").trim(),
    "Model": String(item["Model"] || "").trim(),
    "Employee ID": String(item["Employee ID"] || "").trim(),
    "Assigned Person": String(item["Assigned Person"] || "").trim(),
    "Missing Date": item["Missing Date"] || now,
    "Status": item["Status"] || "Missing",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Recovered Date": item["Recovered Date"] || "",
    "Recovered By": String(item["Recovered By"] || "").trim(),
  };

  const idx = list.findIndex((e) => e["Record ID"] === recordId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;

  writeMissingItems(list);
  return normalized;
}

export function deleteMissingItem(recordId: string): boolean {
  const id = String(recordId || "").trim();
  const list = readMissingItems();
  const next = list.filter((e) => e["Record ID"] !== id);
  if (next.length === list.length) return false;
  writeMissingItems(next);
  return true;
}

export function deleteMissingItemsForAsset(assetId: string): number {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readMissingItems();
  const next = list.filter((e) => {
    const parent = String(e["Parent Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return parent !== id;
  });
  writeMissingItems(next);
  return list.length - next.length;
}

function normalizeMissingItem(item: MissingItemRecord): MissingItemRecord {
  return {
    ...item,
    "Record ID": String(item["Record ID"] || "").trim(),
    "Parent Asset ID": String(item["Parent Asset ID"] || "").trim(),
    "Parent Asset Name": String(item["Parent Asset Name"] || "").trim(),
    "Missing Item Name": String(item["Missing Item Name"] || "").trim(),
    "Asset Type": String(item["Asset Type"] || "").trim(),
    "Brand": String(item["Brand"] || "").trim(),
    "Model": String(item["Model"] || "").trim(),
    "Employee ID": String(item["Employee ID"] || "").trim(),
    "Assigned Person": String(item["Assigned Person"] || "").trim(),
    "Missing Date": String(item["Missing Date"] || "").trim(),
    "Status": item["Status"] || "Missing",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Recovered Date": String(item["Recovered Date"] || "").trim(),
    "Recovered By": String(item["Recovered By"] || "").trim(),
  };
}

export async function fetchMissingItemsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<MissingItemRecord[]> {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = (await gasGet(gasUrl, { action: "list_missing_items" }, 20000)) as {
        items?: MissingItemRecord[];
        error?: string;
      };
      if (result?.items && Array.isArray(result.items)) {
        const sanitized = result.items.map(normalizeMissingItem);
        writeMissingItems(sanitized);
        return sanitized;
      }
    } catch (e) {
      console.warn("fetchMissingItemsFromGas GET:", e);
    }
  }

  try {
    const result = (await proxyToGas({ action: "list_missing_items" })) as {
      items?: MissingItemRecord[];
      error?: string;
    };
    if (result?.items && Array.isArray(result.items)) {
      const sanitized = result.items.map(normalizeMissingItem);
      writeMissingItems(sanitized);
      return sanitized;
    }
  } catch (e) {
    console.warn("fetchMissingItemsFromGas POST:", e);
  }
  return readMissingItems();
}

export async function persistMissingItemToGas(
  op: "add" | "update" | "delete",
  item: MissingItemRecord,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_missing_item" : op === "update" ? "update_missing_item" : "delete_missing_item";
    const id = item["Record ID"];
    const result = (await proxyToGas({ action, id, row: item })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
