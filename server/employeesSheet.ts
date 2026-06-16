import type { Employee } from "../src/types/employee.js";
import { getSheetsClient } from "./sheetsUsers.js";
import { isInactiveEmployeeStatus } from "./employeeStatus.js";

const SHEET_NAME = "Employees";
const HEADERS = [
  "Employee ID",
  "Name",
  "Email",
  "Phone",
  "Department",
  "Location",
  "Designation",
  "Plant Code",
  "Status",
  "Created Date",
  "Updated Date",
] as const;

function normalizeEmployeeId(id: string): string {
  return String(id || "").trim().toUpperCase();
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

function rowToEmployee(row: string[], headerMap: Record<string, number>): Employee {
  const get = (key: string) => String(row[headerMap[key]] ?? "").trim();
  return {
    employeeId: normalizeEmployeeId(get("Employee ID")),
    name: get("Name"),
    email: normalizeEmail(get("Email")),
    phone: normalizePhone(get("Phone")),
    department: get("Department"),
    location: get("Location"),
    designation: get("Designation"),
    plant: get("Plant Code") || get("Plant / Location") || get("Plant"),
    status: isInactiveEmployeeStatus(get("Status")) ? "Inactive" : "Active",
    createdAt: get("Created Date"),
    updatedAt: get("Updated Date"),
  };
}

function employeeToRow(employee: Employee, createdAt?: string): string[] {
  const now = new Date().toISOString();
  return [
    normalizeEmployeeId(employee.employeeId),
    String(employee.name || "").trim(),
    normalizeEmail(employee.email),
    normalizePhone(employee.phone),
    String(employee.department || "").trim(),
    String(employee.location || "").trim(),
    String(employee.designation || "").trim(),
    String(employee.plant || "").trim(),
    isInactiveEmployeeStatus(employee.status) ? "Inactive" : "Active",
    createdAt || employee.createdAt || now,
    now,
  ];
}

function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    map[String(h).trim()] = i;
  });
  return map;
}

async function ensureEmployeesSheet(
  sheets: NonNullable<Awaited<ReturnType<typeof getSheetsClient>>>,
  spreadsheetId: string
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title?.toLowerCase() === SHEET_NAME.toLowerCase()
  );
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: SHEET_NAME },
          },
        },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A1:K1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS.slice()] },
  });
}

export async function listEmployeesFromGoogleSheet(
  spreadsheetId: string
): Promise<Employee[] | null> {
  const sheets = await getSheetsClient();
  if (!sheets) return null;

  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:K`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    const headerMap = buildHeaderMap(rows[0].map(String));
    const list: Employee[] = [];
    for (let i = 1; i < rows.length; i++) {
      const emp = rowToEmployee(rows[i].map(String), headerMap);
      if (emp.employeeId) list.push(emp);
    }
    return list;
  } catch (err) {
    console.warn("listEmployeesFromGoogleSheet:", err);
    return null;
  }
}

export async function addEmployeeToGoogleSheet(
  spreadsheetId: string,
  employee: Employee
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google Sheets credentials not configured" };

  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };

  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:A`,
    });
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][0] || "")) === id) {
        return { ok: false, error: "User already exists" };
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [employeeToRow(employee)] },
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet append failed" };
  }
}

export async function updateEmployeeInGoogleSheet(
  spreadsheetId: string,
  employee: Employee
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google Sheets credentials not configured" };

  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };

  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:K`,
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    let createdAt = "";
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][0] || "")) === id) {
        rowIndex = i + 1;
        createdAt = String(rows[i][9] || "");
        break;
      }
    }

    const row = employeeToRow(employee, createdAt);
    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A${rowIndex}:K${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet update failed" };
  }
}

export async function deleteEmployeeFromGoogleSheet(
  spreadsheetId: string,
  employeeId: string
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google Sheets credentials not configured" };

  const id = normalizeEmployeeId(employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === SHEET_NAME.toLowerCase()
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) return { ok: false, error: "Employees sheet not found" };

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:A`,
    });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][0] || "")) === id) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Employee not found" };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet delete failed" };
  }
}
