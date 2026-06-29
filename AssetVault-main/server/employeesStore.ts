import fs from "fs";
import path from "path";
import os from "os";
import type { Employee } from "../src/types/employee.js";
import { isInactiveEmployeeStatus } from "./employeeStatus.js";
import { touchCacheSpreadsheetId } from "./cacheStore.js";
import {
  addEmployeeToGoogleSheet,
  deleteEmployeeFromGoogleSheet,
  listEmployeesFromGoogleSheet,
  updateEmployeeInGoogleSheet,
} from "./employeesSheet.js";
import { getEnv } from "./env.js";
import { gasGet } from "./gasClient.js";

function normalizePhoneForStorage(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const EMPLOYEES_FILE = path.join(CACHE_DIR, "employees.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(EMPLOYEES_FILE)) {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function normalizeEmployeeId(id: string): string {
  return String(id || "").trim().toUpperCase();
}

export function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function readEmployees(): Employee[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Employee[]) : [];
  } catch {
    return [];
  }
}

export function writeEmployees(list: Employee[]) {
  ensureFile();
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(list, null, 2), "utf-8");
}

function mergeEmployeesById(local: Employee[], remote: Employee[]): Employee[] {
  const merged = [...local];
  for (const employee of remote) {
    const id = normalizeEmployeeId(employee.employeeId);
    if (!id) continue;
    const normalized = normalizeEmployeeRecord(employee);
    const idx = merged.findIndex((e) => normalizeEmployeeId(e.employeeId) === id);
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        ...normalized,
        createdAt: normalized.createdAt || merged[idx].createdAt,
      };
    } else {
      merged.push(normalized);
    }
  }
  return merged;
}

export function findEmployeeById(list: Employee[], employeeId: string): Employee | undefined {
  const id = normalizeEmployeeId(employeeId);
  if (!id) return undefined;
  return list.find((e) => normalizeEmployeeId(e.employeeId) === id);
}

export function findEmployeeByEmail(list: Employee[], email: string): Employee | undefined {
  const em = normalizeEmail(email);
  if (!em) return undefined;
  return list.find((e) => normalizeEmail(e.email) === em);
}

export function findEmployeeByName(
  list: Employee[],
  name: string,
  excludeEmployeeId?: string
): Employee | undefined {
  const key = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return undefined;
  const exclude = excludeEmployeeId ? normalizeEmployeeId(excludeEmployeeId) : "";
  return list.find((e) => {
    const eKey = String(e.name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (eKey !== key) return false;
    if (exclude && normalizeEmployeeId(e.employeeId) === exclude) return false;
    return true;
  });
}

function normalizeEmployeeRecord(employee: Employee, createdAt?: string): Employee {
  const id = normalizeEmployeeId(employee.employeeId);
  const now = new Date().toISOString();
  return {
    ...employee,
    employeeId: id,
    email: normalizeEmail(employee.email),
    phone: normalizePhoneForStorage(employee.phone),
    status: isInactiveEmployeeStatus(employee.status) ? "Inactive" : "Active",
    updatedAt: now,
    createdAt: createdAt || employee.createdAt || now,
  };
}

export function createEmployee(employee: Employee): Employee {
  const list = readEmployees();
  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) throw new Error("Employee ID is required");
  if (findEmployeeById(list, id)) {
    throw new Error("User already exists");
  }

  const normalized = normalizeEmployeeRecord(employee);
  list.push(normalized);
  writeEmployees(list);
  return normalized;
}

export function updateEmployee(employee: Employee): Employee {
  const list = readEmployees();
  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) throw new Error("Employee ID is required");

  const idx = list.findIndex((e) => normalizeEmployeeId(e.employeeId) === id);
  if (idx === -1) throw new Error("Employee not found");

  const normalized = normalizeEmployeeRecord(employee, list[idx].createdAt);
  list[idx] = normalized;
  writeEmployees(list);
  return normalized;
}

/** Used when syncing from Google Sheets — never overwrites a different employee by email/name. */
export function upsertEmployee(employee: Employee): Employee {
  const list = readEmployees();
  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) throw new Error("Employee ID is required");

  const idx = list.findIndex((e) => normalizeEmployeeId(e.employeeId) === id);
  if (idx === -1) {
    const normalized = normalizeEmployeeRecord(employee);
    list.push(normalized);
    writeEmployees(list);
    return normalized;
  }

  const normalized = normalizeEmployeeRecord(employee, list[idx].createdAt);
  list[idx] = normalized;
  writeEmployees(list);
  return normalized;
}

export function deleteEmployee(employeeId: string): boolean {
  const id = normalizeEmployeeId(employeeId);
  const list = readEmployees();
  const next = list.filter((e) => normalizeEmployeeId(e.employeeId) !== id);
  if (next.length === list.length) return false;
  writeEmployees(next);
  return true;
}

export async function fetchEmployeesFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>,
  spreadsheetId?: string
): Promise<Employee[]> {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = (await gasGet(gasUrl, { action: "list_employees" }, 20000)) as {
        employees?: Employee[];
        error?: string;
      };
      if (result?.employees && Array.isArray(result.employees)) {
        const merged = mergeEmployeesById(readEmployees(), result.employees);
        writeEmployees(merged);
        if (spreadsheetId) touchCacheSpreadsheetId(spreadsheetId);
        return merged;
      }
    } catch (e) {
      console.warn("fetchEmployeesFromGas GET:", e);
    }

    try {
      const result = (await proxyToGas({ action: "list_employees" })) as {
        employees?: Employee[];
        error?: string;
      };
      if (result?.employees && Array.isArray(result.employees)) {
        const merged = mergeEmployeesById(readEmployees(), result.employees);
        writeEmployees(merged);
        if (spreadsheetId) touchCacheSpreadsheetId(spreadsheetId);
        return merged;
      }
    } catch (e) {
      console.warn("fetchEmployeesFromGas POST:", e);
    }
  }

  if (spreadsheetId) {
    const fromSheet = await listEmployeesFromGoogleSheet(spreadsheetId);
    if (fromSheet) {
      const merged = mergeEmployeesById(readEmployees(), fromSheet);
      writeEmployees(merged);
      touchCacheSpreadsheetId(spreadsheetId);
      return merged;
    }
  }

  return readEmployees();
}

async function persistEmployeeViaSheetsApi(
  op: "add" | "update" | "delete",
  employee: Employee,
  spreadsheetId: string
): Promise<{ ok: boolean; error?: string }> {
  if (op === "add") return addEmployeeToGoogleSheet(spreadsheetId, employee);
  if (op === "update") return updateEmployeeInGoogleSheet(spreadsheetId, employee);
  return deleteEmployeeFromGoogleSheet(spreadsheetId, employee.employeeId);
}

export async function persistEmployeeToGas(
  op: "add" | "update" | "delete",
  employee: Employee,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>,
  spreadsheetId?: string
): Promise<{ ok: boolean; error?: string }> {
  let gasError: string | undefined;
  const gasUrl = getEnv("GAS_WEBAPP_URL");

  if (gasUrl) {
    try {
      const action = op === "add" ? "add_employee" : op === "update" ? "update_employee" : "delete_employee";
      const result = (await proxyToGas({ action, employee })) as { success?: boolean; error?: string };
      if (!result?.error) return { ok: true };
      gasError = result.error;
    } catch (e: unknown) {
      gasError = e instanceof Error ? e.message : "GAS failed";
      console.warn(`Employee ${op} via GAS failed:`, gasError);
    }

    return {
      ok: false,
      error: gasError || "Database sync failed",
    };
  }

  if (spreadsheetId) {
    const sheet = await persistEmployeeViaSheetsApi(op, employee, spreadsheetId);
    if (sheet.ok) return { ok: true };
    return { ok: false, error: sheet.error || gasError || "Sheet sync failed" };
  }

  return { ok: false, error: gasError || "Sheet sync unavailable — check GAS_WEBAPP_URL or Google credentials" };
}
