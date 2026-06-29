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
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const idx = headerMap[normalizeHeaderName(key)];
      if (idx !== undefined) return String(row[idx] ?? "").trim();
    }
    return "";
  };
  return {
    employeeId: normalizeEmployeeId(get("Employee ID", "Emp ID", "Employee Code")),
    name: get("Name", "Employee Name", "Full Name"),
    email: normalizeEmail(get("Email", "Mail ID", "Email ID")),
    phone: normalizePhone(get("Phone", "Mobile", "Contact Number")),
    department: get("Department", "Dept"),
    location: get("Location", "Location Name"),
    designation: get("Designation", "Role Title"),
    plant: get("Plant Code", "Plant / Location", "Plant"),
    status: isInactiveEmployeeStatus(get("Status")) ? "Inactive" : "Active",
    createdAt: get("Created Date", "Created At"),
    updatedAt: get("Updated Date", "Updated At"),
  };
}

function normalizeHeaderName(header: string): string {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function employeeValueForHeader(header: string, employee: Employee, createdAt?: string): string {
  const now = new Date().toISOString();
  const norm = normalizeHeaderName(header);
  const values: Record<string, string> = {
    employeeid: normalizeEmployeeId(employee.employeeId),
    empid: normalizeEmployeeId(employee.employeeId),
    employeecode: normalizeEmployeeId(employee.employeeId),
    name: String(employee.name || "").trim(),
    employeename: String(employee.name || "").trim(),
    fullname: String(employee.name || "").trim(),
    email: normalizeEmail(employee.email),
    emailid: normalizeEmail(employee.email),
    mailid: normalizeEmail(employee.email),
    phone: normalizePhone(employee.phone),
    mobile: normalizePhone(employee.phone),
    contactnumber: normalizePhone(employee.phone),
    department: String(employee.department || "").trim(),
    dept: String(employee.department || "").trim(),
    location: String(employee.location || "").trim(),
    locationname: String(employee.location || "").trim(),
    designation: String(employee.designation || "").trim(),
    plantcode: String(employee.plant || "").trim(),
    plantlocation: String(employee.plant || "").trim(),
    plant: String(employee.plant || "").trim(),
    status: isInactiveEmployeeStatus(employee.status) ? "Inactive" : "Active",
    createddate: createdAt || employee.createdAt || now,
    createdat: createdAt || employee.createdAt || now,
    updateddate: now,
    updatedat: now,
  };
  return values[norm] ?? "";
}

function employeeToRowForHeaders(employee: Employee, headers: string[], createdAt?: string): string[] {
  return headers.map((header) => employeeValueForHeader(header, employee, createdAt));
}

function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    map[normalizeHeaderName(h)] = i;
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
      range: `'${SHEET_NAME}'!A:Z`,
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
      range: `'${SHEET_NAME}'!A:Z`,
    });
    const rows = res.data.values || [];
    const headers = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers);
    const idCol = headerMap[normalizeHeaderName("Employee ID")] ?? 0;
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][idCol] || "")) === id) {
        return { ok: false, error: "User already exists" };
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:${String.fromCharCode(64 + Math.min(headers.length, 26))}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [employeeToRowForHeaders(employee, headers)] },
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
      range: `'${SHEET_NAME}'!A:Z`,
    });
    const rows = res.data.values || [];
    const headers = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers);
    const idCol = headerMap[normalizeHeaderName("Employee ID")] ?? 0;
    const createdCol = headerMap[normalizeHeaderName("Created Date")];
    let rowIndex = -1;
    let createdAt = "";
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][idCol] || "")) === id) {
        rowIndex = i + 1;
        createdAt = createdCol === undefined ? "" : String(rows[i][createdCol] || "");
        break;
      }
    }

    const row = employeeToRowForHeaders(employee, headers, createdAt);
    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A:${String.fromCharCode(64 + Math.min(headers.length, 26))}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A${rowIndex}:${String.fromCharCode(64 + Math.min(headers.length, 26))}${rowIndex}`,
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
      range: `'${SHEET_NAME}'!A:Z`,
    });
    const rows = res.data.values || [];
    const headers = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers);
    const idCol = headerMap[normalizeHeaderName("Employee ID")] ?? 0;

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][idCol] || "")) === id) {
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
