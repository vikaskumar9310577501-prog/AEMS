import fs from "fs";
import path from "path";
import os from "os";
import type { InventoryItem } from "../src/types/inventory.js";
import { getEnv } from "./env.js";
import { gasGet } from "./gasClient.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const INVENTORY_FILE = path.join(CACHE_DIR, "inventory.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(INVENTORY_FILE)) {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function normalizeInventoryId(id: string): string {
  return String(id || "").trim().toUpperCase();
}

export function readInventory(): InventoryItem[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(INVENTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

export function writeInventory(list: InventoryItem[]) {
  ensureFile();
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function findInventoryItemById(list: InventoryItem[], itemId: string): InventoryItem | undefined {
  const id = normalizeInventoryId(itemId);
  if (!id) return undefined;
  return list.find((e) => normalizeInventoryId(e.itemId) === id);
}

export function upsertInventoryItem(item: InventoryItem): InventoryItem {
  const list = readInventory();
  const id = normalizeInventoryId(item.itemId);
  if (!id) throw new Error("Item ID is required");

  const now = new Date().toISOString();
  const isAssigned = (item.status || "Available") === "Assigned";
  const normalized: InventoryItem = {
    ...item,
    itemId: id,
    assetCode: String(item.assetCode || "").trim().toUpperCase(),
    itemName: String(item.itemName || "").trim(),
    brandName: String(item.brandName || "").trim(),
    model: String(item.model || "").trim(),
    serialNumber: String(item.serialNumber || "").trim().toUpperCase(),
    category: String(item.category || "IT Assets").trim(),
    status: item.status || "Available",
    quantity: Number(item.quantity) || 0,
    minStock: Number(item.minStock) || 0,
    employeeId: isAssigned ? String(item.employeeId || "").trim() : "",
    assigneeName: isAssigned ? String(item.assigneeName || "").trim() : "",
    assigneeEmail: isAssigned ? String(item.assigneeEmail || "").trim() : "",
    assigneeMobile: isAssigned ? String(item.assigneeMobile || "").trim() : "",
    updatedAt: now,
    createdAt: item.createdAt || now,
  };

  const idx = list.findIndex((e) => normalizeInventoryId(e.itemId) === id);
  if (idx === -1) list.push(normalized);
  else list[idx] = { ...list[idx], ...normalized, createdAt: list[idx].createdAt || now };

  writeInventory(list);
  return normalized;
}

export function deleteInventoryItem(itemId: string): boolean {
  const id = normalizeInventoryId(itemId);
  const list = readInventory();
  const next = list.filter((e) => normalizeInventoryId(e.itemId) !== id);
  if (next.length === list.length) return false;
  writeInventory(next);
  return true;
}

export async function fetchInventoryFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<InventoryItem[]> {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = (await gasGet(gasUrl, { action: "list_inventory" }, 20000)) as {
        inventory?: InventoryItem[];
        error?: string;
      };
      if (result?.inventory && Array.isArray(result.inventory)) {
        writeInventory(result.inventory);
        return result.inventory;
      }
    } catch (e) {
      console.warn("fetchInventoryFromGas GET:", e);
    }
  }

  try {
    const result = (await proxyToGas({ action: "list_inventory" })) as {
      inventory?: InventoryItem[];
      error?: string;
    };
    if (result?.inventory && Array.isArray(result.inventory)) {
      writeInventory(result.inventory);
      return result.inventory;
    }
  } catch (e) {
    console.warn("fetchInventoryFromGas POST:", e);
  }
  return readInventory();
}

export async function persistInventoryToGas(
  op: "add" | "update" | "delete",
  item: InventoryItem,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_inventory_item" : op === "update" ? "update_inventory_item" : "delete_inventory_item";
    const result = (await proxyToGas({ action, item })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}

export async function replaceInventoryInGas(
  inventory: InventoryItem[],
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await proxyToGas({ action: "replace_inventory", inventory })) as {
      success?: boolean;
      error?: string;
    };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
