import fs from "fs";
import { deleteAssignmentHistoryFromGoogleSheet } from "./assignmentHistorySheet.js";
import path from "path";
import os from "os";
import type { AssignmentHistoryEntry } from "../src/types/employee.js";
import { normalizeEmployeeId } from "./employeesStore.js";
import { normalizeAssetId } from "./assetDetailsStore.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const HISTORY_FILE = path.join(CACHE_DIR, "assignment-history.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readAssignmentHistory(): AssignmentHistoryEntry[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssignmentHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeAssignmentHistory(entries: AssignmentHistoryEntry[]) {
  ensureFile();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function clearAllAssignmentHistory(): void {
  writeAssignmentHistory([]);
}

function newHistoryId() {
  return `AH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendAssignmentEntry(entry: Omit<AssignmentHistoryEntry, "id">): AssignmentHistoryEntry {
  const list = readAssignmentHistory();
  const full: AssignmentHistoryEntry = { ...entry, id: newHistoryId() };
  list.push(full);
  writeAssignmentHistory(list);
  return full;
}

export function getHistoryByAssetId(assetId: string): AssignmentHistoryEntry[] {
  const aid = normalizeAssetId(assetId);
  return readAssignmentHistory()
    .filter((h) => normalizeAssetId(h.assetId) === aid)
    .sort((a, b) => String(b.returnedDate || b.assignedDate).localeCompare(String(a.returnedDate || a.assignedDate)));
}

export function getHistoryByEmployeeId(employeeId: string): AssignmentHistoryEntry[] {
  const eid = normalizeEmployeeId(employeeId);
  return readAssignmentHistory()
    .filter(
      (h) =>
        normalizeEmployeeId(h.employeeId) === eid ||
        normalizeEmployeeId(h.fromEmployeeId || "") === eid
    )
    .sort((a, b) => String(b.returnedDate || b.assignedDate).localeCompare(String(a.returnedDate || a.assignedDate)));
}

export interface AssigneeSnapshot {
  employeeId?: string;
  contactName?: string;
  contactEmail?: string;
  status?: string;
}

function hasAssignee(s: AssigneeSnapshot): boolean {
  return !!(s.employeeId?.trim() || s.contactName?.trim() || s.contactEmail?.trim());
}

function assigneeKey(s: AssigneeSnapshot): string {
  return [
    normalizeEmployeeId(s.employeeId || ""),
    String(s.contactEmail || "").trim().toLowerCase(),
    String(s.contactName || "").trim().toLowerCase(),
  ].join("|");
}

export function recordAssignmentChange(opts: {
  assetId: string;
  previous: AssigneeSnapshot;
  next: AssigneeSnapshot;
  assignedBy?: string;
  remarks?: string;
  assignedDate?: string;
}): AssignmentHistoryEntry[] {
  const { assetId, previous, next, assignedBy, remarks } = opts;
  const created: AssignmentHistoryEntry[] = [];
  const now = new Date().toISOString().slice(0, 10);
  const eventDate = opts.assignedDate?.trim() || now;
  const prevKey = assigneeKey(previous);
  const nextKey = assigneeKey(next);

  if (prevKey === nextKey) return created;

  if (hasAssignee(previous) && hasAssignee(next) && prevKey !== nextKey) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Transfer",
        employeeId: next.employeeId || "",
        employeeName: next.contactName || next.contactEmail || "Unknown",
        assignedDate: eventDate,
        assignedBy,
        remarks: remarks || `From ${previous.contactName || previous.employeeId || "previous assignee"}`,
        fromEmployeeId: previous.employeeId,
        fromEmployeeName: previous.contactName,
      })
    );
    return created;
  }

  if (hasAssignee(previous) && !hasAssignee(next)) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Return",
        employeeId: previous.employeeId || "",
        employeeName: previous.contactName || previous.contactEmail || "Unknown",
        assignedDate: eventDate,
        returnedDate: now,
        assignedBy,
        remarks: remarks || "Asset returned / unassigned",
      })
    );
    return created;
  }

  if (!hasAssignee(previous) && hasAssignee(next)) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Assign",
        employeeId: next.employeeId || "",
        employeeName: next.contactName || next.contactEmail || "Unknown",
        assignedDate: eventDate,
        assignedBy,
        remarks,
      })
    );
  }

  return created;
}

export function deleteAssignmentHistoryEntry(id: string): boolean {
  const list = readAssignmentHistory();
  const trimmed = String(id || "").trim();
  const next = list.filter((h) => String(h.id || "").trim() !== trimmed);
  if (next.length === list.length) return false;
  writeAssignmentHistory(next);
  return true;
}

export function deleteAssignmentHistoryForAsset(assetId: string): number {
  const aid = normalizeAssetId(assetId);
  const list = readAssignmentHistory();
  const next = list.filter((h) => normalizeAssetId(h.assetId) !== aid);
  writeAssignmentHistory(next);
  return list.length - next.length;
}

export async function deleteHistoryEntryFromGas(
  id: string,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string; notFound?: boolean }> {
  try {
    const result = (await proxyToGas({
      action: "delete_assignment_history",
      id: String(id || "").trim(),
    })) as {
      success?: boolean;
      error?: string;
    };
    if (result?.error) {
      const err = String(result.error);
      return {
        ok: false,
        error: err,
        notFound: err.toLowerCase().includes("not found"),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sheet delete failed" };
  }
}

export async function deleteHistoryEntryRemote(
  id: string,
  proxyToGas: ((payload: Record<string, unknown>) => Promise<unknown>) | null,
  spreadsheetId?: string,
  gasConfigured = false
): Promise<{ ok: boolean; error?: string; notFound?: boolean; via?: "gas" | "sheets-api" }> {
  const trimmed = String(id || "").trim();
  let lastError = "";
  let notFound = false;

  if (gasConfigured && proxyToGas) {
    const gas = await deleteHistoryEntryFromGas(trimmed, proxyToGas);
    if (gas.ok) return { ok: true, via: "gas" };
    lastError = gas.error || "GAS delete failed";
    if (gas.notFound) notFound = true;
  }

  if (spreadsheetId) {
    const api = await deleteAssignmentHistoryFromGoogleSheet(spreadsheetId, trimmed);
    if (api.ok) return { ok: true, via: "sheets-api" };
    if (api.notFound) notFound = true;
    lastError = api.error || lastError;
  }

  if (notFound) return { ok: false, error: lastError || "Record not found", notFound: true };
  return { ok: false, error: lastError || "Could not delete from Google Sheet" };
}

export async function fetchHistoryFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<AssignmentHistoryEntry[]> {
  try {
    const result = (await proxyToGas({ action: "get_assignment_history" })) as {
      history?: AssignmentHistoryEntry[];
      error?: string;
    };
    if (Array.isArray(result?.history)) {
      writeAssignmentHistory(result.history);
      return result.history;
    }
  } catch (e) {
    console.warn("fetchHistoryFromGas:", e);
  }
  return readAssignmentHistory();
}

/** Map sheet fields to UI shape (contactName, next/previous snapshots). */
export function normalizeHistoryForUi(entries: AssignmentHistoryEntry[]) {
  const byAsset = new Map<string, AssignmentHistoryEntry[]>();
  for (const entry of entries) {
    const key = normalizeAssetId(entry.assetId);
    const list = byAsset.get(key) || [];
    list.push(entry);
    byAsset.set(key, list);
  }
  for (const list of byAsset.values()) {
    list.sort((a, b) => String(a.assignedDate).localeCompare(String(b.assignedDate)));
  }

  const inferAssignmentStart = (h: AssignmentHistoryEntry): string => {
    if (h.action !== "Return") return h.assignedDate || "";
    const assetEntries = byAsset.get(normalizeAssetId(h.assetId)) || [];
    const idx = assetEntries.findIndex((entry) => String(entry.id || "") === String(h.id || ""));
    const before = (idx >= 0 ? assetEntries.slice(0, idx) : assetEntries).reverse();
    const employeeId = normalizeEmployeeId(h.employeeId || "");
    const match = before.find((entry) => {
      if (entry.action === "Return") return false;
      const sameEmployee = employeeId
        ? normalizeEmployeeId(entry.employeeId || "") === employeeId
        : String(entry.employeeName || "").trim().toLowerCase() === String(h.employeeName || "").trim().toLowerCase();
      return sameEmployee && !!String(entry.assignedDate || "").trim();
    });
    return match?.assignedDate || h.assignedDate || "";
  };

  return entries.map((h) => {
    const action = h.action || "Assign";
    const assignmentStart = inferAssignmentStart(h);
    const base = {
      ...h,
      date: h.returnedDate || h.assignedDate || "",
      assignmentStartDate: assignmentStart || h.assignedDate || "",
      contactName: h.employeeName || "",
    };
    if (action === "Transfer") {
      return {
        ...base,
        previous: {
          employeeId: h.fromEmployeeId || "",
          contactName: h.fromEmployeeName || "Previous assignee",
        },
        next: {
          employeeId: h.employeeId || "",
          contactName: h.employeeName || "New assignee",
        },
      };
    }
    if (action === "Return") {
      return {
        ...base,
        previous: {
          employeeId: h.employeeId || "",
          contactName: h.employeeName || "Custodian",
        },
      };
    }
    return {
      ...base,
      next: {
        employeeId: h.employeeId || "",
        contactName: h.employeeName || "Custodian",
      },
    };
  });
}

export async function persistHistoryEntryToGas(
  entry: AssignmentHistoryEntry,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
) {
  try {
    await proxyToGas({ action: "add_assignment_history", entry });
  } catch (e) {
    console.warn("persistHistoryEntryToGas:", e);
  }
}

export async function syncHistoryEntriesToGas(
  entries: AssignmentHistoryEntry[],
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
) {
  for (const entry of entries) {
    await persistHistoryEntryToGas(entry, proxyToGas);
  }
}
