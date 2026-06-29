import fs from "fs";
import path from "path";
import os from "os";
import type { AssignmentRecord } from "../src/types/redesigned.js";

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), "assetqr-data", "cache")
  : path.join(process.cwd(), "data", "cache");
const ASSIGNMENTS_FILE = path.join(CACHE_DIR, "assignments.json");

function ensureFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(ASSIGNMENTS_FILE)) {
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export function readAssignments(): AssignmentRecord[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(ASSIGNMENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssignmentRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeAssignments(list: AssignmentRecord[]) {
  ensureFile();
  fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function upsertAssignment(assignment: AssignmentRecord): AssignmentRecord {
  const list = readAssignments();
  const assignmentId = String(assignment["Assignment ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const itemId = String(assignment["Asset/Inventory ID"] || "").trim();
  if (!itemId) throw new Error("Asset/Inventory ID is required");

  const now = new Date().toISOString();
  const normalized: AssignmentRecord = {
    "Assignment ID": assignmentId,
    "Asset/Inventory ID": itemId,
    "Type": assignment["Type"] || "Asset",
    "Assignee Name": String(assignment["Assignee Name"] || "").trim(),
    "Assignee ID": String(assignment["Assignee ID"] || "").trim(),
    "Department": String(assignment["Department"] || "").trim(),
    "Contact Number": String(assignment["Contact Number"] || "").trim(),
    "Assigned Date": assignment["Assigned Date"] || now,
    "Assigned By": String(assignment["Assigned By"] || "").trim(),
    "Status": assignment["Status"] || "Active",
    "Remarks": String(assignment["Remarks"] || "").trim(),
  };

  const idx = list.findIndex((e) => e["Assignment ID"] === assignmentId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;

  writeAssignments(list);
  return normalized;
}

export function deleteAssignment(assignmentId: string): boolean {
  const id = String(assignmentId || "").trim();
  const list = readAssignments();
  const next = list.filter((e) => e["Assignment ID"] !== id);
  if (next.length === list.length) return false;
  writeAssignments(next);
  return true;
}

export async function fetchAssignmentsFromGas(
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<AssignmentRecord[]> {
  try {
    const result = (await proxyToGas({ action: "list_assignments" })) as {
      assignments?: AssignmentRecord[];
      error?: string;
    };
    if (result?.assignments && Array.isArray(result.assignments)) {
      writeAssignments(result.assignments);
      return result.assignments;
    }
  } catch (e) {
    console.warn("fetchAssignmentsFromGas:", e);
  }
  return readAssignments();
}

export async function persistAssignmentToGas(
  op: "add" | "update" | "delete",
  assignment: AssignmentRecord,
  proxyToGas: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const action = op === "add" ? "add_assignment" : op === "update" ? "update_assignment" : "delete_assignment";
    const id = assignment["Assignment ID"];
    const result = (await proxyToGas({ action, id, row: assignment })) as { success?: boolean; error?: string };
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
