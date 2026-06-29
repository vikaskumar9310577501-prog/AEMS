import { getSheetsClient } from "./sheetsUsers.js";

const SHEET_NAME = "Assignment_History";

/** Delete one assignment history row by Record ID (column A) via Google Sheets API. */
export async function deleteAssignmentHistoryFromGoogleSheet(
  spreadsheetId: string,
  recordId: string
): Promise<{ ok: boolean; error?: string; notFound?: boolean }> {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };

  const idStr = String(recordId || "").trim();
  if (!idStr) return { ok: false, error: "Record ID required" };

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === SHEET_NAME.toLowerCase()
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) return { ok: false, error: "Assignment_History sheet not found" };

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:K`,
    });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === idStr) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) return { ok: false, error: "Record not found", notFound: true };

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
