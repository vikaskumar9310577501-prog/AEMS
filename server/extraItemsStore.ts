import fs from "fs";
import path from "path";
import os from "os";
import type { AssetExtraItemRecord } from "../src/types/redesigned.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const EXTRA_ITEMS_FILE = path.join(CACHE_DIR, "extra_items.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(EXTRA_ITEMS_FILE)) {
    fs.writeFileSync(EXTRA_ITEMS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readExtraItems(): AssetExtraItemRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(EXTRA_ITEMS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssetExtraItemRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeExtraItems(list: AssetExtraItemRecord[]) {
  ensureFile();
  fs.writeFileSync(EXTRA_ITEMS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function upsertExtraItem(item: AssetExtraItemRecord): AssetExtraItemRecord {
  const list = readExtraItems();
  const recordId = String(item["Record ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const parentId = String(item["Parent Asset ID"] || "").trim();
  const name = String(item["Item Name"] || "").trim();
  if (!parentId || !name) throw new Error("Parent Asset ID and Item Name are required");

  const now = new Date().toISOString();
  const normalized: AssetExtraItemRecord = {
    "Record ID": recordId,
    "Parent Asset ID": parentId,
    "Item Name": name,
    "Quantity": Number(item["Quantity"]) || 1,
    "Serial Number": String(item["Serial Number"] || "").trim(),
    "Condition": String(item["Condition"] || "Good").trim(),
    "Status": String(item["Status"] || "Available").trim(),
    "Remarks": String(item["Remarks"] || "").trim(),
    "Updated Date": now,
  };

  const idx = list.findIndex((e) => e["Record ID"] === recordId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;

  writeExtraItems(list);
  return normalized;
}

export function deleteExtraItem(recordId: string): boolean {
  const id = String(recordId || "").trim();
  const list = readExtraItems();
  const next = list.filter((e) => e["Record ID"] !== id);
  if (next.length === list.length) return false;
  writeExtraItems(next);
  return true;
}

export function deleteExtraItemsForAsset(assetId: string): number {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readExtraItems();
  const next = list.filter((e) => {
    const parent = String(e["Parent Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return parent !== id;
  });
  writeExtraItems(next);
  return list.length - next.length;
}

export async function fetchExtraItemsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<AssetExtraItemRecord[]> {
  try {
    const result = (await proxyToGas({ action: "list_extra_items" })) as {
      items?: AssetExtraItemRecord[];
      error?: string;
    };
    if (result?.items && Array.isArray(result.items)) {
      const sanitized = result.items.map(item => ({
        ...item,
        Quantity: Number(item.Quantity) || 1
      }));
      writeExtraItems(sanitized);
      return sanitized;
    }
  } catch (e) {
    console.warn("fetchExtraItemsFromGas:", e);
  }
  return readExtraItems();
}

export async function persistExtraItemToGas(
  op: "add" | "update" | "delete",
  item: AssetExtraItemRecord,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_extra_item" : op === "update" ? "update_extra_item" : "delete_extra_item";
    const id = item["Record ID"];
    const result = (await proxyToGas({ action, id, row: item })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
