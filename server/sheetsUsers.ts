import { google } from "googleapis";
import type { AppUser } from "./dataStore.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function formatList(value: string[] | string | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

export async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientEmail || !privateKey) return null;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

async function getUsersSheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  usersSheetGid: string
): Promise<string> {
  const gidStr = String(usersSheetGid || "").trim();
  if (!gidStr || gidStr === "0") return "Users";
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const gid = parseInt(gidStr, 10);
  if (Number.isNaN(gid)) return "Users";
  const found = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
  return found?.properties?.title || "Users";
}

function userToRow(user: AppUser): string[] {
  return [
    user.email,
    user.role,
    formatList(user.locations),
    formatList(user.plants),
    formatList(user.categories),
  ];
}

export async function listUsersFromGoogleSheet(
  spreadsheetId: string,
  usersSheetGid: string
): Promise<AppUser[] | null> {
  const sheets = await getSheetsClient();
  if (!sheets) return null;

  const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const roleIdx = headers.findIndex((h) => h.includes("role"));
  const locIdx = headers.findIndex((h) => h.includes("location"));
  const plantIdx = headers.findIndex((h) => h.includes("plant"));
  const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("access"));
  if (emailIdx === -1) return [];

  return rows.slice(1).map((row) => ({
    email: String(row[emailIdx] || "").trim().toLowerCase(),
    role: String(roleIdx !== -1 ? row[roleIdx] : "User"),
    locations: String(locIdx !== -1 ? row[locIdx] || "" : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    plants: String(plantIdx !== -1 ? row[plantIdx] || "" : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    categories: String(catIdx !== -1 ? row[catIdx] || "" : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  })).filter((u) => u.email);
}

export async function addUserToGoogleSheet(
  spreadsheetId: string,
  usersSheetGid: string,
  user: AppUser
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };

  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const range = `'${title}'!A:Z`;

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = existing.data.values || [];

    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${title}'!A1:E1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Email", "Role", "Locations", "Plants", "Categories"]] },
      });
    } else {
      const headers = rows[0].map((h) => String(h).toLowerCase());
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      if (emailIdx !== -1) {
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][emailIdx] || "").trim().toLowerCase() === user.email) {
            return { ok: false, error: "User already exists in sheet" };
          }
        }
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${title}'!A:E`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [userToRow(user)] },
    });

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet append failed" };
  }
}

export async function updateUserInGoogleSheet(
  spreadsheetId: string,
  usersSheetGid: string,
  user: AppUser
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };

  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:Z`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return { ok: false, error: "User not found in sheet" };

    const headers = rows[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
    const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
    const roleIdx = headers.findIndex((h) => h.includes("role"));
    const locIdx = headers.findIndex((h) => h.includes("location"));
    const plantIdx = headers.findIndex((h) => h.includes("plant"));
    const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("access"));
    if (emailIdx === -1) return { ok: false, error: "Email column missing" };

    let rowNumber = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][emailIdx] || "").trim().toLowerCase() === user.email) {
        rowNumber = i + 1;
        break;
      }
    }
    if (rowNumber === -1) return { ok: false, error: "User not found in sheet" };

    const row = new Array(Math.max(headers.length, 5)).fill("");
    if (emailIdx !== -1) row[emailIdx] = user.email;
    if (roleIdx !== -1) row[roleIdx] = user.role;
    if (locIdx !== -1) row[locIdx] = formatList(user.locations);
    if (plantIdx !== -1) row[plantIdx] = formatList(user.plants);
    if (catIdx !== -1) row[catIdx] = formatList(user.categories);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A${rowNumber}:Z${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet update failed" };
  }
}

export async function deleteUserFromGoogleSheet(
  spreadsheetId: string,
  usersSheetGid: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };

  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const gid = parseInt(usersSheetGid, 10);
    const sheet = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) return { ok: false, error: "Users sheet not found" };

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:Z`,
    });
    const rows = res.data.values || [];
    const headers = (rows[0] || []).map((h) => String(h).toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes("email"));

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][emailIdx] || "").trim().toLowerCase() === email.toLowerCase()) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "User not found in sheet" };

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
