import fs from "fs";
import path from "path";
import os from "os";
import type { CategoryRecord } from "../src/types/redesigned.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const CATEGORIES_FILE = path.join(CACHE_DIR, "categories.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(CATEGORIES_FILE)) {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readCategories(): CategoryRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(CATEGORIES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CategoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeCategories(list: CategoryRecord[]) {
  ensureFile();
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function upsertCategory(category: CategoryRecord): CategoryRecord {
  const list = readCategories();
  const name = String(category["Category Name"] || "").trim();
  if (!name) throw new Error("Category Name is required");

  const now = new Date().toISOString();
  const normalized: CategoryRecord = {
    "Category Name": name,
    "Description": String(category["Description"] || "").trim(),
    "Created Date": category["Created Date"] || now,
  };

  const idx = list.findIndex((e) => e["Category Name"].toLowerCase() === name.toLowerCase());
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;

  writeCategories(list);
  return normalized;
}

export function deleteCategory(categoryName: string): boolean {
  const name = String(categoryName || "").trim().toLowerCase();
  const list = readCategories();
  const next = list.filter((e) => e["Category Name"].toLowerCase() !== name);
  if (next.length === list.length) return false;
  writeCategories(next);
  return true;
}

export async function fetchCategoriesFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<CategoryRecord[]> {
  try {
    const result = (await proxyToGas({ action: "list_categories" })) as {
      categories?: CategoryRecord[];
      error?: string;
    };
    if (result?.categories && Array.isArray(result.categories)) {
      writeCategories(result.categories);
      return result.categories;
    }
  } catch (e) {
    console.warn("fetchCategoriesFromGas:", e);
  }
  return readCategories();
}

export async function persistCategoryToGas(
  op: "add" | "update" | "delete",
  category: CategoryRecord,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_category" : op === "update" ? "update_category" : "delete_category";
    const id = category["Category Name"];
    const result = (await proxyToGas({ action, id, row: category })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
