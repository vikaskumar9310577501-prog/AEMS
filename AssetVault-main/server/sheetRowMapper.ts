import { getDefaultAssetHeaders } from "./sheetHeaders.js";

export function normalizeHeaderKey(header: string): string {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function indexOfHeader(headers: string[], target: string): number {
  const norm = normalizeHeaderKey(target);
  return headers.findIndex((h) => normalizeHeaderKey(h) === norm);
}

/**
 * Map a row built in canonical (master) header order into the physical sheet column order.
 * Never assumes positional alignment when column counts match — header names are the source of truth.
 */
export function mapMasterRowToSheetHeaders(
  sheetHeaders: string[],
  masterHeaders: string[],
  row: unknown[]
): string[] {
  const newRow = new Array(sheetHeaders.length).fill("");
  for (let h = 0; h < sheetHeaders.length; h++) {
    const hName = sheetHeaders[h];
    let srcIdx = indexOfHeader(masterHeaders, hName);
    if (srcIdx === -1) {
      const hNorm = normalizeHeaderKey(hName);
      if (hNorm === "email" || hNorm === "mailid") {
        srcIdx = indexOfHeader(masterHeaders, "Contact Email");
      } else if (hNorm === "mobile" || hNorm === "contactnumber") {
        srcIdx = indexOfHeader(masterHeaders, "Contact Number");
      }
    }
    if (srcIdx !== -1 && srcIdx < row.length && row[srcIdx] != null && row[srcIdx] !== "") {
      newRow[h] = String(row[srcIdx]);
    }
  }
  return newRow;
}

const AUDIT_FIELDS: { key: string; headers: string[] }[] = [
  { key: "id", headers: ["Asset ID", "S No", "ID"] },
  { key: "cpu", headers: ["CPU", "Processor"] },
  { key: "ram", headers: ["RAM"] },
  { key: "ssd", headers: ["SSD", "Storage"] },
  { key: "windowsVersion", headers: ["Windows Version", "OS"] },
  { key: "macAddress", headers: ["MAC Address", "MAC"] },
  { key: "ipAddress", headers: ["IP Address"] },
  { key: "hostName", headers: ["Host Name", "Hostname"] },
  { key: "contactEmail", headers: ["Contact Email", "Email"] },
  { key: "contactMobile", headers: ["Contact Number", "Mobile"] },
  { key: "contactName", headers: ["Assigned To", "Contact Person Name"] },
  { key: "uniqueCode", headers: ["Unique Code"] },
  { key: "imageUrl", headers: ["Photo URL / Photo Upload", "Asset Image"] },
  { key: "documentUrl", headers: ["Document URL / Attached Documents", "Document Link"] },
];

/** Console audit: compare form/API input vs generated row column values */
export function logAssetMappingAudit(
  stage: string,
  assetData: Record<string, unknown>,
  headers: string[],
  row: string[]
): void {
  const audit: Record<string, { input: unknown; column: string; columnIndex: number; rowValue: string; ok: boolean }> =
    {};

  for (const { key, headers: aliases } of AUDIT_FIELDS) {
    const input = assetData[key];
    let colIdx = -1;
    let colName = "";
    for (const alias of aliases) {
      colIdx = indexOfHeader(headers, alias);
      if (colIdx !== -1) {
        colName = headers[colIdx];
        break;
      }
    }
    const rowValue = colIdx >= 0 ? String(row[colIdx] ?? "") : "";
    audit[key] = {
      input,
      column: colName,
      columnIndex: colIdx,
      rowValue,
      ok: String(input ?? "") === rowValue,
    };
  }

  console.log(`[AMS Mapping] ${stage}`, JSON.stringify(audit, null, 2));
}

export { getDefaultAssetHeaders };
