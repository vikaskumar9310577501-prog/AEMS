import express from "express";
import fs from "fs";
import path from "path";
import type { ViteDevServer } from "vite";
import dotenv from "dotenv";
import {
  readAppData,
  writeAppData,
  type AppSettings,
} from "./server/dataStore.js";
import {
  fetchAllAssets,
  findAssetByScanId,
  getScanUrl,
  getCanonicalScanId,
  mapSheetRow,
} from "./server/assetHelpers.js";
import { upsertLocalUser, normalizeUser } from "./server/usersService.js";
import { generateAssetPdf } from "./server/pdfGenerator.js";
import { persistUserToSheet } from "./server/userSheetSync.js";
import { listUsersFromGoogleSheet } from "./server/sheetsUsers.js";
import { requestOtp, verifyOtp, findRegisteredUser } from "./server/otpService.js";
import { getAssetsWithCache, refreshAssetsNow, invalidateAssetCache } from "./server/assetCache.js";
import { getUsersWithCache, syncUsersNow, getCachedUsers, getUsersSyncMeta, invalidateUsersCache } from "./server/usersSync.js";
import { clearAllCaches } from "./server/cacheStore.js";
import {
  fetchLocationsPlantsFromGas,
  persistLocationsPlantsToGas,
} from "./server/locationsPlantsSync.js";
import {
  findDuplicateAsset,
  findAnyIdentifierDuplicate,
  uniqueFieldLabel,
  type UniqueField,
} from "./server/uniqueValidation.js";
import { dedupeAssets } from "./server/dedupeAssets.js";
import { fetchRemoteFile } from "./server/fileProxy.js";
import { driveDownloadUrl, driveViewUrl, drivePreviewUrl } from "./server/driveUrls.js";
import { PERIPHERAL_TYPES } from "./src/lib/assetCatalogByType.js";
import {
  saveDetailsForAsset,
  deleteDetailsForAsset,
  fetchDetailsFromGas,
  persistDetailsToGas,
  deleteDetailsFromGas,
  mergeDetailsIntoAssets,
  readAssetDetailsMap,
} from "./server/assetDetailsStore.js";
import {
  getTypeDefinitions,
  saveTypeDefinitions,
  persistTypeDefinitionsToGas,
} from "./server/categoryDefinitionsService.js";
import { applyLegacyFieldMapping, resolveTypeDefinition } from "./src/lib/typeDefinitions.js";
import {
  readEmployees,
  upsertEmployee,
  deleteEmployee,
  findEmployeeById,
  findEmployeeByEmail,
  fetchEmployeesFromGas,
  persistEmployeeToGas,
  normalizeEmployeeId,
  normalizeEmail,
} from "./server/employeesStore.js";
import {
  readInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  fetchInventoryFromGas,
  persistInventoryToGas,
} from "./server/inventoryStore.js";
import {
  getHistoryByAssetId,
  getHistoryByEmployeeId,
  recordAssignmentChange,
  syncHistoryEntriesToGas,
  fetchHistoryFromGas,
} from "./server/assignmentHistoryStore.js";
import type { Employee } from "./src/types/employee.js";
import {
  readCategories,
  upsertCategory,
  deleteCategory,
  fetchCategoriesFromGas,
  persistCategoryToGas,
} from "./server/categoriesStore.js";
import {
  readExtraItems,
  upsertExtraItem,
  deleteExtraItem,
  fetchExtraItemsFromGas,
  persistExtraItemToGas,
} from "./server/extraItemsStore.js";
import {
  readDamagedItems,
  upsertDamagedItem,
  fetchDamagedItemsFromGas,
  persistDamagedItemToGas,
} from "./server/damagedStore.js";
import {
  readMissingItems,
  upsertMissingItem,
  fetchMissingItemsFromGas,
  persistMissingItemToGas,
} from "./server/missingStore.js";
import {
  readAssignments,
  upsertAssignment,
  deleteAssignment,
  fetchAssignmentsFromGas,
  persistAssignmentToGas,
} from "./server/assignmentsStore.js";
import {
  readAuditLogs,
  addAuditLog,
  fetchAuditLogsFromGas,
} from "./server/auditLogsStore.js";
import { getDefaultAssetHeaders } from "./server/sheetHeaders.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// CORS setup for Netlify frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    process.env.NETLIFY_URL // e.g. https://your-app.netlify.app
  ];
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const USERS_SHEET_GID = process.env.USERS_SHEET_GID || "1792788791";

if (!GAS_WEBAPP_URL) {
  console.error("CRITICAL ERROR: GAS_WEBAPP_URL is not defined in .env");
}

// Proxy Helper (with timeout so UI never hangs on "Loading users...")
async function proxyToGas(payload: Record<string, unknown>, timeoutMs = 30000) {
  if (!GAS_WEBAPP_URL) throw new Error("GAS_WEBAPP_URL is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("GAS returned non-JSON:", text.substring(0, 200));
      throw new Error("Invalid response from Google Apps Script");
    }
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// API ROUTES
// ==========================================

const userSyncDeps = () => ({
  proxyToGas,
  gasWebappUrl: GAS_WEBAPP_URL,
  spreadsheetId: SPREADSHEET_ID,
  usersSheetGid: USERS_SHEET_GID,
  listFromGoogleApi: listUsersFromGoogleSheet,
});

function gasAuthError(result: unknown): string | null {
  if (!result || typeof result !== "object") return "Invalid response from Google Apps Script";
  const r = result as Record<string, unknown>;
  if (r.error) return String(r.error);
  if (r.ok === false) return String(r.message || "Request failed");
  if (r.success === false) return String(r.message || r.error || "Request failed");
  return null;
}

/** OTP email is sent by Google Apps Script (GmailApp) from verify.software2040@pgel.in */
function otpUsesSheetMail(): boolean {
  return !!GAS_WEBAPP_URL && process.env.OTP_USE_SMTP !== "true";
}

app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (otpUsesSheetMail()) {
      try {
        const gasResult = await proxyToGas({ action: "request_otp", email }, 45000);
        const gasErr = gasAuthError(gasResult);
        if (!gasErr) {
          const msg = (gasResult as { message?: string }).message || "OTP sent to your email";
          return res.json({ success: true, message: msg });
        }
        if (/not authorized|not registered|unauthorized/i.test(gasErr)) {
          return res.status(403).json({ error: "Your mail is not authorized. Please contact IT Admin only." });
        }
        return res.status(400).json({ error: gasErr });
      } catch (gasFail: unknown) {
        const detail = gasFail instanceof Error ? gasFail.message : String(gasFail);
        console.error("GAS OTP request failed:", detail);
        return res.status(503).json({
          error:
            "Could not send OTP via Database mail. Deploy the latest WebApp.gs and confirm GAS_WEBAPP_URL in .env.",
        });
      }
    }

    if (!GAS_WEBAPP_URL) {
      return res.status(503).json({
        error:
          "OTP is sent from your Google Sheet (Apps Script). Set GAS_WEBAPP_URL in .env — same as before with verify.software2040@pgel.in.",
      });
    }

    let user = findRegisteredUser(email);
    if (!user) {
      try {
        await syncUsersNow(userSyncDeps());
        user = findRegisteredUser(email);
      } catch {
        /* cache only */
      }
    }
    if (!user) {
      return res.status(403).json({
        error: "Your mail is not authorized. Please contact IT Admin only.",
      });
    }

    const result = await requestOtp(email);
    if (!result.ok) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error: any) {
    console.error("Auth Request Error:", error);
    res.status(500).json({ error: error.message || "Failed to process request" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    if (otpUsesSheetMail()) {
      try {
        const gasResult = await proxyToGas({ action: "verify_otp", email, otp }, 30000);
        const gasErr = gasAuthError(gasResult);
        if (!gasErr && (gasResult as { user?: unknown }).user) {
          const normalized = normalizeUser(
            (gasResult as { user: Record<string, unknown> }).user
          );
          upsertLocalUser(normalized);
          return res.json({ success: true, user: normalized });
        }
        return res.status(400).json({ error: gasErr || "Invalid or expired OTP" });
      } catch (gasFail: unknown) {
        const detail = gasFail instanceof Error ? gasFail.message : String(gasFail);
        console.error("GAS verify OTP failed:", detail);
        return res.status(503).json({
          error: "Could not verify OTP via Database. Check GAS_WEBAPP_URL and WebApp deployment.",
        });
      }
    }

    if (!GAS_WEBAPP_URL) {
      return res.status(503).json({
        error: "Set GAS_WEBAPP_URL in .env to verify OTP via your Google Sheet.",
      });
    }

    const check = verifyOtp(email, otp);
    if (!check.ok) return res.status(400).json({ error: check.error });

    let user = findRegisteredUser(email);
    if (!user) {
      try {
        await syncUsersNow(userSyncDeps());
      } catch {
        /* ignore */
      }
      user = findRegisteredUser(email);
    }
    if (!user) {
      return res.status(403).json({ error: "User account not found after verification" });
    }

    const normalized = normalizeUser(user as unknown as Record<string, unknown>);
    upsertLocalUser(normalized);
    res.json({ success: true, user: normalized });
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});

function getBaseUrl(req: express.Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const host = req.get("host") || `localhost:${PORT}`;
  const proto = req.protocol || "http";
  return `${proto}://${host}`;
}

app.post("/api/upload", async (req, res) => {
  try {
    const { filename, fileData } = req.body;
    if (!filename || !fileData) return res.status(400).json({ error: "Missing file" });
    
    const matches = fileData.match(/^data:(.*?);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid base64 format" });
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    // Send to Google Apps Script to upload to Google Drive
    const result = await proxyToGas({ 
      action: "upload_file", 
      filename, 
      mimeType, 
      fileData: base64Data 
    }, 60000); // 60 seconds timeout for large uploads

    if (result.error) throw new Error(result.error);

    const fileId = result.fileId as string | undefined;
    const url = fileId
      ? drivePreviewUrl(fileId)
      : ((result.url as string) || "");
    const viewUrl = fileId
      ? `/api/file/view?id=${encodeURIComponent(fileId)}`
      : url
        ? `/api/file/view?url=${encodeURIComponent(url)}`
        : "";

    res.json({ url, viewUrl, fileId, fileName: result.fileName });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "File upload failed" });
  }
});

/** Stream Drive / HTTP files inline so PDFs open in browser (document + scan attachments). */
app.get("/api/file/view", async (req, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const urlParam = typeof req.query.url === "string" ? req.query.url.trim() : "";
    const source = id ? driveDownloadUrl(id) : urlParam;
    if (!source) return res.status(400).json({ error: "Missing id or url parameter" });

    const data = await fetchRemoteFile(source);
    if (!data) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(404).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>File not found</h2><p>Check Google Drive sharing: <b>Anyone with the link</b> can view. Re-upload the PDF from the asset form if needed.</p></body></html>`
      );
    }

    const isPdf =
      data.contentType.toLowerCase().includes("pdf") ||
      (data.bytes.length > 4 &&
        data.bytes[0] === 0x25 &&
        data.bytes[1] === 0x50 &&
        data.bytes[2] === 0x44 &&
        data.bytes[3] === 0x46);

    res.setHeader("Content-Type", isPdf ? "application/pdf" : data.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(data.bytes.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(Buffer.from(data.bytes));
  } catch (error: any) {
    console.error("File view error:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(
      `<html><body style="font-family:system-ui;padding:24px"><h2>Could not open file</h2><p>${error.message || "Failed to load file"}</p></body></html>`
    );
  }
});

app.get("/api/assets", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured" });

    const force = req.query.refresh === "1";
    const { assets, fromCache, syncing } = await getAssetsWithCache(GAS_WEBAPP_URL, force);

    let detailsMap = readAssetDetailsMap();
    if (force && GAS_WEBAPP_URL) {
      detailsMap = await fetchDetailsFromGas(proxyToGas);
    }
    const assetsWithDetails = dedupeAssets(mergeDetailsIntoAssets(assets, detailsMap));

    const sheetRows = assetsWithDetails.map((a) => ({
      "S No": a.id,
      ID: a.id,
      Location: a.location,
      "Plant Code": a.plantCode,
      Department: a.department,
      Make: a.make,
      Model: a.model,
      "Serial Number": a.serialNumber,
      "Asset Code": a.assetCode,
      "Vendor Name": a.vendorName,
      "Warranty Start": a.warrantyStartDate,
      "Warranty End": a.warrantyEndDate,
      RAM: a.ram,
      SSD: a.ssd,
      CPU: a.cpu,
      "Windows Version": a.windowsVersion,
      "Asset Type": a.assetType,
      "MAC Address": a.macAddress,
      "Monitor SN": a.monitorSerial,
      "Monitor Code": a.monitorAssetCode,
      "Keyboard SN": a.keyboardSerial,
      "Keyboard Code": a.keyboardAssetCode,
      "Mouse SN": a.mouseSerial,
      "Mouse Code": a.mouseAssetCode,
      "UPS SN": a.upsSerial,
      "UPS Code": a.upsAssetCode,
      "Contact Person Name": a.contactName,
      "Contact Person Email": a.contactEmail,
      "Contact Person Mobile Number": a.contactMobile,
      "Document Link": a.documentUrl,
      "Asset Image": a.imageUrl,
      "Additional Items": a.additionalItems,
      "QR Code Text": a.qrCodeText,
      "Unique Code": a.uniqueCode,
      "Binary Code": a.binaryCode,

      // New company-level fields
      "Asset Name": a.assetName,
      "Main Category": a.mainCategory,
      "Sub Category": a.subCategory,
      Quantity: a.quantity,
      "Employee ID": a.employeeId,
      "Purchase Date": a.purchaseDate,
      "Purchase Cost": a.purchaseCost,
      "Invoice Number": a.invoiceNumber,
      Condition: a.condition,
      Status: a.status,
      "Maintenance Required": a.maintenanceRequired,
      "Last Maintenance Date": a.lastMaintenanceDate,
      "Next Maintenance Date": a.nextMaintenanceDate,
      "Created By": a.createdBy,
      "Created Date": a.createdDate,
      "Updated By": a.updatedBy,
      "Updated Date": a.updatedDate,
      dynamicDetails: a.dynamicDetails || {},
      assetTypeId: a.assetTypeId || "",
    }));

    res.setHeader("X-AssetVault-Cache", fromCache ? "hit" : "miss");
    res.setHeader("X-AssetVault-Syncing", syncing ? "1" : "0");
    res.json(sheetRows);
  } catch (error: any) {
    console.error("Fetch assets error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch assets" });
  }
});

app.get("/api/assets/check-unique", async (req, res) => {
  try {
    const field = req.query.field as UniqueField;
    const value = String(req.query.value || "").trim();
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : undefined;

    const allowed: UniqueField[] = ["serialNumber", "assetCode", "macAddress", "vehicleNumber", "uniqueCode"];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: "Invalid field" });
    }
    if (!value) return res.json({ duplicate: false });

    if (!GAS_WEBAPP_URL) return res.status(500).json({ error: "Server not configured" });

    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    const dup = findDuplicateAsset(assets, field, value, excludeId);

    const fieldLabel = uniqueFieldLabel(field);
    const who = dup
      ? [dup.assetCode, dup.serialNumber, dup.id].filter(Boolean).join(" / ")
      : "";
    res.json({
      duplicate: !!dup,
      message: dup
        ? `This ${fieldLabel} is already assigned to Asset: ${who}. Duplicates are not allowed.`
        : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Validation failed" });
  }
});

// For add, update, delete, we need standard row generation logic, 
// but we will simplify it by doing generation in the frontend or directly mapping it.
// To save time, we assume the frontend sends the EXACT row array matching the headers.
// Let's create an endpoint that asks GAS for headers, generates the row, and sends it.

async function fetchHeaders(): Promise<string[]> {
  const fallback = getDefaultAssetHeaders();
  if (!GAS_WEBAPP_URL) return fallback;

  const parseHeaders = (parsed: unknown): string[] => {
    if (!parsed) return [];
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (Array.isArray(parsed[0])) return parsed[0] as string[];
      if (typeof parsed[0] === "string") return parsed as string[];
    }
    if (typeof parsed === "object" && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      if (o.error) throw new Error(String(o.error));
      if (Array.isArray(o.headers)) return o.headers as string[];
    }
    return [];
  };

  try {
    const response = await fetch(GAS_WEBAPP_URL);
    const text = await response.text();
    if (text.trim().startsWith("<")) {
      throw new Error("Database returned HTML instead of JSON — redeploy the backend script");
    }
    let headers = parseHeaders(JSON.parse(text));
    if (headers.length > 0) return headers;

    const hdrRes = await fetch(
      `${GAS_WEBAPP_URL}${GAS_WEBAPP_URL.includes("?") ? "&" : "?"}action=get_asset_headers`
    );
    const hdrText = await hdrRes.text();
    headers = parseHeaders(JSON.parse(hdrText));
    if (headers.length > 0) return headers;
  } catch (e) {
    console.warn("fetchHeaders:", e);
  }

  return fallback;
}

async function fetchSheetData(): Promise<any[][]> {
  if (!GAS_WEBAPP_URL) return [getDefaultAssetHeaders()];
  const response = await fetch(GAS_WEBAPP_URL);
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error("Database returned HTML instead of JSON");
  }
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data as any[][];
  return [getDefaultAssetHeaders()];
}

/** Ensure category sheets exist and headers are available before add/update */
async function ensureSheetHeadersReady(): Promise<string[]> {
  let headers = await fetchHeaders();
  if (headers.length > 0) return headers;

  if (GAS_WEBAPP_URL) {
    try {
      await proxyToGas({ action: "setup" });
      headers = await fetchHeaders();
    } catch (e) {
      console.warn("ensureSheetHeadersReady setup:", e);
    }
  }

  return headers.length > 0 ? headers : getDefaultAssetHeaders();
}

function prepareAssetPayload(assetData: Record<string, unknown>) {
  const typeDefs = getTypeDefinitions();
  const typeDef = resolveTypeDefinition(typeDefs, {
    assetTypeId: String(assetData.assetTypeId || ""),
    assetType: String(assetData.assetType || ""),
    mainCategory: String(assetData.mainCategory || ""),
    subCategory: String(assetData.subCategory || ""),
  });
  const details = (assetData.dynamicDetails as Record<string, string>) || {};
  const mapped = applyLegacyFieldMapping(assetData, typeDef, details) as Record<string, unknown>;
  if (details.vehicle_number && !mapped.serialNumber) {
    mapped.serialNumber = details.vehicle_number;
  }
  return mapped;
}

async function persistAssetDynamicDetails(assetId: string, assetData: Record<string, unknown>) {
  const details = (assetData.dynamicDetails as Record<string, string>) || {};
  saveDetailsForAsset(assetId, details);
  if (GAS_WEBAPP_URL) {
    const gas = await persistDetailsToGas(assetId, details, proxyToGas);
    if (!gas.ok) console.warn("Asset details GAS sync:", gas.error);
  }
}

function sanitizeAssetFields(assetData: any) {
  const mainCat = String(assetData.mainCategory || "").trim() || "IT Assets";
  const assetType = String(assetData.assetType || "").trim();
  const typeId = String(assetData.assetTypeId || "").trim();
  const isIT = mainCat === "IT Assets";
  const isLaptopOrDesktop =
    typeId === "laptop" ||
    typeId === "desktop" ||
    (isIT && ["Laptop", "Desktop"].includes(assetType));
  const isDesktop = isIT && assetType === "Desktop";
  const isPeripheral = isIT && PERIPHERAL_TYPES.includes(assetType);

  if (!isLaptopOrDesktop) {
    assetData.ram = "";
    assetData.ssd = "";
    assetData.cpu = "";
    assetData.windowsVersion = "";
  }
  if (!isIT || isPeripheral) {
    assetData.macAddress = "";
  }
  if (!isDesktop) {
    assetData.monitorSerial = "";
    assetData.monitorAssetCode = "";
    assetData.keyboardSerial = "";
    assetData.keyboardAssetCode = "";
    assetData.mouseSerial = "";
    assetData.mouseAssetCode = "";
    assetData.upsSerial = "";
    assetData.upsAssetCode = "";
  }

  // Sanitize Remarks/Additional Items - only keep laptop/desktop accessory remarks for Laptop/Desktop/Input Device/Output Device
  if (assetData.additionalItems) {
    const tLower = String(assetType || "").toLowerCase();
    const allowedTypes = ["laptop", "desktop", "input device", "output device", "laptop / desktop"];
    const isAllowed = allowedTypes.some(t => tLower.includes(t));
    if (!isAllowed) {
      let clean = String(assetData.additionalItems);
      const wordsToRemove = ["case", "charger", "adapter", "adpater", "etc"];
      for (const word of wordsToRemove) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        clean = clean.replace(regex, "");
      }
      clean = clean
        .replace(/,\s*,/g, ",")
        .replace(/\s+/g, " ")
        .replace(/,\s*\./g, ".")
        .replace(/^\s*,\s*/g, "")
        .replace(/,\s*$/g, "")
        .trim();
      if (clean === "." || clean === "," || clean === ",.") {
        clean = "";
      }
      assetData.additionalItems = clean;
    }
  }
}

function buildAssetRow(headers: string[], assetData: any, existingRow?: any[]) {
  // Sanitize the assetData input to prevent IT configuration leakage
  sanitizeAssetFields(assetData);

  const row = existingRow ? [...existingRow] : new Array(headers.length).fill("");
  
  const getColIndex = (keys: string[]) => {
    for (const key of keys) {
      const target = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers.findIndex(
        (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === target
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const setVal = (keys: string[], val: any) => {
    if (val === undefined || val === null) return;
    for (const key of keys) {
      const target = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      headers.forEach((h: string, idx: number) => {
        if (h.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
          row[idx] = String(val);
        }
      });
    }
  };

  const uniqueCode =
    assetData.uniqueCode || assetData.assetCode || Math.floor(10000 + Math.random() * 90000).toString();
  const binaryCode = assetData.binaryCode !== undefined ? assetData.binaryCode : "0";

  // Basic columns
  setVal(["Asset ID", "S No", "ID"], assetData.id?.toString() || "");
  setVal(["Asset Code"], assetData.assetCode || "");
  setVal(["Asset Name"], assetData.assetName || assetData.model || "");
  setVal(["Main Category"], assetData.mainCategory || "IT Assets");
  setVal(["Sub Category", "Asset Type", "Type"], assetData.subCategory || assetData.assetType || "Other IT Asset");
  setVal(["Brand", "Make"], assetData.make || "");
  setVal(["Model"], assetData.model || "");
  setVal(["Serial Number", "SN"], assetData.serialNumber || "");
  setVal(["Quantity"], assetData.quantity || "1");
  setVal(["Plant Name", "Plant Code", "Plant"], assetData.plantCode || "");
  setVal(["Location", "Loc"], assetData.location || "");
  setVal(["Department", "Dept"], assetData.department || "");
  setVal(["Assigned To", "Contact Person Name", "Owner"], assetData.contactName || "");
  setVal(["Contact Email", "Email", "MAIL ID "], assetData.contactEmail || "");
  setVal(["Contact Number", "Mobile", "CONTACT NUMBER ", "Contact Person Mobile Number"], assetData.contactMobile || "");
  setVal(["Employee ID"], assetData.employeeId || "");
  setVal(["Purchase Date"], assetData.purchaseDate || "");
  setVal(["Purchase Cost"], assetData.purchaseCost || "");
  setVal(["Vendor Name", "Vendor"], assetData.vendorName || "");
  setVal(["Invoice Number"], assetData.invoiceNumber || "");
  setVal(["Warranty Start Date", "Warranty Start"], assetData.warrantyStartDate || "");
  setVal(["Warranty Expiry Date", "Warranty End"], assetData.warrantyEndDate || "");
  setVal(["Condition"], assetData.condition || "EXISTING ASSETS");
  setVal(["Status"], assetData.status || "Available");
  setVal(["Maintenance Required"], assetData.maintenanceRequired || "No");
  setVal(["Last Maintenance Date"], assetData.lastMaintenanceDate || "");
  setVal(["Next Maintenance Date"], assetData.nextMaintenanceDate || "");
  setVal(["AMC Vendor"], assetData.amcVendor || "");
  setVal(["AMC Start Date"], assetData.amcStartDate || "");
  setVal(["AMC End Date"], assetData.amcEndDate || "");
  setVal(["AMC Cost"], assetData.amcCost || "");
  setVal(["Photo URL / Photo Upload", "Asset Image", "Image"], assetData.imageUrl || "");
  setVal(["Document URL / Attached Documents", "Document Link", "Document"], assetData.documentUrl || "");
  setVal(["QR Code / Barcode", "QR Code Text"], assetData.qrCodeText || "");
  setVal(["Remarks", "Additional Items"], assetData.additionalItems || "");
  setVal(["Created By"], assetData.createdBy || "");
  setVal(["Created Date"], assetData.createdDate || "");
  setVal(["Updated By"], assetData.updatedBy || "");
  setVal(["Updated Date"], assetData.updatedDate || "");

  // IT Specific
  setVal(["RAM"], assetData.ram || "");
  setVal(["SSD", "Storage"], assetData.ssd || "");
  setVal(["CPU", "Processor"], assetData.cpu || "");
  setVal(["Windows Version", "OS"], assetData.windowsVersion || "");
  setVal(["MAC Address", "MAC"], assetData.macAddress || "");
  setVal(["Unique Code"], uniqueCode);
  setVal(["Binary Code"], binaryCode);
  setVal(["Monitor Serial", "Monitor SN"], assetData.monitorSerial || "");
  setVal(["Monitor Asset Code", "Monitor Code"], assetData.monitorAssetCode || "");
  setVal(["Keyboard Serial", "Keyboard SN"], assetData.keyboardSerial || "");
  setVal(["Keyboard Asset Code", "Keyboard Code"], assetData.keyboardAssetCode || "");
  setVal(["Mouse Serial", "Mouse SN"], assetData.mouseSerial || "");
  setVal(["Mouse Asset Code", "Mouse Code"], assetData.mouseAssetCode || "");
  setVal(["UPS Serial", "UPS SN"], assetData.upsSerial || "");
  setVal(["UPS Asset Code", "UPS Code"], assetData.upsAssetCode || "");

  return row;
}

function buildRedesignedAssetRow(assetData: any, assetId: string, qrCodeText: string) {
  const now = new Date().toISOString();
  const details = (assetData.dynamicDetails as Record<string, string>) || {};
  const vehicleNo =
    details.vehicle_number ||
    details.vehicleNumber ||
    (assetData.mainCategory === "Vehicle Assets" ? assetData.serialNumber : "") ||
    "";
  const serial =
    assetData.mainCategory === "Vehicle Assets" && vehicleNo
      ? vehicleNo
      : assetData.serialNumber || "";

  return {
    "Asset ID": assetId,
    "Category": assetData.mainCategory || "IT Assets",
    "Sub Category": assetData.subCategory || assetData.assetType || "",
    "Asset Type": assetData.assetType || "Laptop",
    "Asset Name": assetData.assetName || assetData.model || "",
    "Brand": assetData.make || "",
    "Model": assetData.model || "",
    "Serial Number": serial,
    "Vehicle Number": vehicleNo,
    "Asset Code": assetData.assetCode || assetId,
    "MAC Address": assetData.macAddress || "",
    "Location": assetData.location || "",
    "Plant Code": assetData.plantCode || "",
    "Plant Name": assetData.plantName || assetData.plantCode || "",
    "Department": assetData.department || "",
    "Assigned To": assetData.contactName || "",
    "Employee ID": assetData.employeeId || "",
    "Contact Email": assetData.contactEmail || "",
    "Contact Number": assetData.contactMobile || "",
    "Purchase Date": assetData.purchaseDate || "",
    "Warranty Date": assetData.warrantyEndDate || assetData.warrantyStartDate || "",
    "Condition": assetData.condition || "Good",
    "Status": assetData.status || "Available",
    "Photo URL": assetData.imageUrl || "",
    "Document URL": assetData.documentUrl || "",
    "Remarks": assetData.additionalItems || "",
    "Unique Code": assetData.uniqueCode || assetId,
    "Binary Code": assetData.binaryCode || "0",
    "Created By": assetData.createdBy || "",
    "Created Date": assetData.createdDate || now,
    "Updated By": assetData.updatedBy || "",
    "Updated Date": assetData.updatedDate || now,
    "Extra Items": assetData.extraItems || "",
    "Missing Items": assetData.missingItems || "",
    "Assigned Date": assetData.assignedDate || "",
    "Return Date": assetData.returnDate || "",
  };
}

// ==========================================
// USERS & SETTINGS (local persistence)
// ==========================================

app.get("/api/users/local", (_req, res) => {
  res.json(getCachedUsers());
});

app.get("/api/users", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    const deps = userSyncDeps();

    if (!GAS_WEBAPP_URL) {
      return res.json(getCachedUsers());
    }

    const { users, fromCache, syncing } = await getUsersWithCache(deps, force);
    const meta = getUsersSyncMeta();

    res.setHeader("X-AssetVault-Cache", fromCache ? "hit" : "miss");
    res.setHeader("X-AssetVault-Syncing", syncing || meta.syncing ? "1" : "0");
    res.json(users);
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    const localUsers = getCachedUsers();
    if (localUsers.length > 0) {
      return res.json(localUsers);
    }
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const user = normalizeUser(req.body);
    if (!user.email) return res.status(400).json({ error: "Email is required" });

    const data = readAppData();
    if (data.users.some((u) => u.email === user.email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    const sheetSave = await persistUserToSheet("add_user", user, {
      proxyToGas,
      spreadsheetId: SPREADSHEET_ID,
      usersSheetGid: USERS_SHEET_GID,
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }

    data.users.push(user);
    writeAppData(data);
    invalidateUsersCache();
    res.json({ success: true, user, savedTo: sheetSave.via });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to add user" });
  }
});

app.put("/api/users/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const user = normalizeUser({ ...req.body, email });

    const data = readAppData();
    const idx = data.users.findIndex((u) => u.email === email);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    const sheetSave = await persistUserToSheet("update_user", user, {
      proxyToGas,
      spreadsheetId: SPREADSHEET_ID,
      usersSheetGid: USERS_SHEET_GID,
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }

    data.users[idx] = user;
    writeAppData(data);
    invalidateUsersCache();
    res.json({ success: true, user, savedTo: sheetSave.via });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

app.delete("/api/users/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();

    const sheetSave = await persistUserToSheet(
      "delete_user",
      { email, role: "User", locations: [], plants: [] },
      { proxyToGas, spreadsheetId: SPREADSHEET_ID, usersSheetGid: USERS_SHEET_GID },
      email
    );
    if (!sheetSave.ok && sheetSave.error !== "User not found" && sheetSave.error !== "User does not exist") {
      return res.status(500).json({ error: sheetSave.error });
    }

    const data = readAppData();
    data.users = data.users.filter((u) => u.email !== email);
    writeAppData(data);
    invalidateUsersCache();
    res.json({ success: true, savedTo: sheetSave.via });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const data = readAppData();
    const force = req.query.refresh === "1";

    if (GAS_WEBAPP_URL && (force || process.env.VERCEL || process.env.NETLIFY || data.settings.locations.length === 0)) {
      const fromGas = await fetchLocationsPlantsFromGas(proxyToGas, GAS_WEBAPP_URL);
      if (fromGas) {
        data.settings.locations = fromGas.locations;
        data.settings.plants = fromGas.plants;
        writeAppData(data);
      }
    }

    res.json(data.settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const incoming = req.body as Partial<AppSettings>;
    const syncSheet = (req.body as { syncSheet?: boolean }).syncSheet !== false;
    const data = readAppData();
    data.settings = {
      locations: Array.isArray(incoming.locations) ? incoming.locations : data.settings.locations,
      plants: Array.isArray(incoming.plants) ? incoming.plants : data.settings.plants,
      assetFields: Array.isArray(incoming.assetFields)
        ? incoming.assetFields
        : data.settings.assetFields,
      catalog:
        incoming.catalog && typeof incoming.catalog === "object"
          ? incoming.catalog
          : data.settings.catalog,
      typeDefinitions:
        incoming.typeDefinitions && typeof incoming.typeDefinitions === "object"
          ? incoming.typeDefinitions
          : data.settings.typeDefinitions,
      dbMode: data.settings.dbMode,
    };
    writeAppData(data);

    let sheetWarning: string | undefined;
    if (syncSheet && GAS_WEBAPP_URL) {
      const gas = await persistLocationsPlantsToGas(
        { locations: data.settings.locations, plants: data.settings.plants },
        proxyToGas
      );
      if (!gas.ok) sheetWarning = gas.error || "Could not save to Locations / Plants sheets";
      if (gas.ok) {
        const fromGas = await fetchLocationsPlantsFromGas(proxyToGas, GAS_WEBAPP_URL);
        if (fromGas) {
          data.settings.locations = fromGas.locations;
          data.settings.plants = fromGas.plants;
          writeAppData(data);
        }
      }
    }

    res.json({ success: true, settings: data.settings, sheetWarning });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save settings" });
  }
});

app.post("/api/settings/rename-location", async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: "oldName and newName are required" });
    }

    const data = readAppData();
    data.settings.locations = (data.settings.locations || []).map((l) =>
      l === oldName ? newName : l
    );
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map((p) =>
        p.location === oldName ? { ...p, location: newName } : p
      );
    }
    writeAppData(data);

    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "rename_location", oldName, newName }) as any;
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }

    res.json({ success: true, settings: data.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to rename location" });
  }
});

app.post("/api/settings/delete-location", async (req, res) => {
  try {
    const { name, deleteOrArchive } = req.body;
    if (!name || !deleteOrArchive) {
      return res.status(400).json({ error: "name and deleteOrArchive are required" });
    }

    const data = readAppData();
    data.settings.locations = (data.settings.locations || []).filter((l) => l !== name);
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map((p) =>
        p.location === name ? { ...p, location: "" } : p
      );
    }
    writeAppData(data);

    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "delete_location", name, deleteOrArchive }) as any;
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }

    res.json({ success: true, settings: data.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete location" });
  }
});

app.post("/api/settings/rename-plant", async (req, res) => {
  try {
    const { oldCode, newCode, newName, location } = req.body;
    if (!oldCode || !newCode || !newName) {
      return res.status(400).json({ error: "oldCode, newCode, and newName are required" });
    }

    const data = readAppData();
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map((p) =>
        p.code === oldCode ? { code: newCode, name: newName, location: location || p.location } : p
      );
    }
    writeAppData(data);

    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "rename_plant", oldCode, newCode, newName, location }) as any;
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }

    res.json({ success: true, settings: data.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to rename plant" });
  }
});

app.post("/api/settings/delete-plant", async (req, res) => {
  try {
    const { code, deleteOrArchive } = req.body;
    if (!code || !deleteOrArchive) {
      return res.status(400).json({ error: "code and deleteOrArchive are required" });
    }

    const data = readAppData();
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.filter((p) => p.code !== code);
    }
    writeAppData(data);

    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "delete_plant", code, deleteOrArchive }) as any;
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }

    res.json({ success: true, settings: data.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete plant" });
  }
});

app.get("/api/type-definitions", (_req, res) => {
  try {
    res.json(getTypeDefinitions());
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load type definitions" });
  }
});

function countAssetsForEmployee(assets: { employeeId: string; contactEmail: string; contactName: string }[], emp: Employee) {
  const eid = normalizeEmployeeId(emp.employeeId);
  const email = normalizeEmail(emp.email);
  const name = String(emp.name || "").trim().toLowerCase();
  return assets.filter((a) => {
    if (eid && normalizeEmployeeId(a.employeeId) === eid) return true;
    if (email && normalizeEmail(a.contactEmail) === email) return true;
    if (name && String(a.contactName || "").trim().toLowerCase() === name) return true;
    return false;
  }).length;
}

app.get("/api/employees", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let list = readEmployees();
    if (force && GAS_WEBAPP_URL) {
      list = await fetchEmployeesFromGas(proxyToGas);
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load employees" });
  }
});

app.get("/api/employees/lookup", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "");
    const email = String(req.query.email || "");
    let list = readEmployees();
    if (list.length === 0 && GAS_WEBAPP_URL) {
      list = await fetchEmployeesFromGas(proxyToGas);
    }
    let employee = null;
    if (employeeId) {
      employee = findEmployeeById(list, employeeId);
    } else if (email) {
      employee = findEmployeeByEmail(list, email);
    }

    if (!employee) {
      return res.json({ employee: null, assetCount: 0 });
    }

    let assetCount = 0;
    if (GAS_WEBAPP_URL) {
      const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
      assetCount = countAssetsForEmployee(assets, employee);
    }

    res.json({ employee, assetCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Lookup failed" });
  }
});

app.get("/api/employees/:employeeId", async (req, res) => {
  try {
    const eid = decodeURIComponent(req.params.employeeId);
    let list = readEmployees();
    let employee = findEmployeeById(list, eid);
    if (!employee && GAS_WEBAPP_URL) {
      list = await fetchEmployeesFromGas(proxyToGas);
      employee = findEmployeeById(list, eid);
    }
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json({ employee });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load employee" });
  }
});

app.get("/api/employees/:employeeId/history", async (req, res) => {
  try {
    const eid = decodeURIComponent(req.params.employeeId);
    if (req.query.refresh === "1" && GAS_WEBAPP_URL) {
      await fetchHistoryFromGas(proxyToGas);
    }
    res.json({ history: getHistoryByEmployeeId(eid) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load history" });
  }
});

app.get("/api/assets/:id/history", async (req, res) => {
  try {
    res.json({ history: getHistoryByAssetId(req.params.id) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load history" });
  }
});

app.post("/api/employees", async (req, res) => {
  try {
    const body = req.body as Employee & { syncSheet?: boolean };
    if (!String(body.name || "").trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!String(body.email || "").trim()) {
      return res.status(400).json({ error: "Email is required" });
    }
    const existing = findEmployeeById(readEmployees(), body.employeeId);
    const saved = upsertEmployee(body);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistEmployeeToGas(existing ? "update" : "add", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, employee: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save employee" });
  }
});

app.put("/api/employees/:employeeId", async (req, res) => {
  try {
    const body = { ...req.body, employeeId: decodeURIComponent(req.params.employeeId) } as Employee & {
      syncSheet?: boolean;
    };
    const saved = upsertEmployee(body);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistEmployeeToGas("update", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, employee: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update employee" });
  }
});

app.delete("/api/employees/:employeeId", async (req, res) => {
  try {
    const eid = decodeURIComponent(req.params.employeeId);
    if (!deleteEmployee(eid)) return res.status(404).json({ error: "Employee not found" });
    if (GAS_WEBAPP_URL) {
      await persistEmployeeToGas(
        "delete",
        { employeeId: eid, name: "", email: "", phone: "", department: "", location: "", designation: "", plant: "", status: "Inactive" },
        proxyToGas
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete employee" });
  }
});

app.get("/api/inventory", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let list = readInventory();
    if (force && GAS_WEBAPP_URL) {
      list = await fetchInventoryFromGas(proxyToGas);
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load inventory" });
  }
});

app.post("/api/inventory", async (req, res) => {
  try {
    const body = req.body as any;
    if (!String(body.itemName || "").trim()) {
      return res.status(400).json({ error: "Item Name is required" });
    }
    const saved = upsertInventoryItem(body);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("add", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, item: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save inventory item" });
  }
});

app.put("/api/inventory/:itemId", async (req, res) => {
  try {
    const body = { ...req.body, itemId: decodeURIComponent(req.params.itemId) } as any;
    const saved = upsertInventoryItem(body);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("update", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, item: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/:itemId", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.itemId);
    if (!deleteInventoryItem(id)) return res.status(404).json({ error: "Inventory item not found" });
    if (GAS_WEBAPP_URL) {
      await persistInventoryToGas(
        "delete",
        {
          itemId: id,
          assetCode: "",
          itemName: "",
          brandName: "",
          model: "",
          serialNumber: "",
          category: "IT Assets",
          status: "Available",
          quantity: 0,
          minStock: 0,
        },
        proxyToGas
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete inventory item" });
  }
});

app.post("/api/type-definitions", async (req, res) => {
  try {
    const { types, syncSheet } = req.body;
    if (!Array.isArray(types)) {
      return res.status(400).json({ error: "types array is required" });
    }
    const saved = saveTypeDefinitions({ types });
    if (syncSheet && GAS_WEBAPP_URL) {
      const gas = await persistTypeDefinitionsToGas(saved, proxyToGas);
      if (!gas.ok) {
        return res.status(500).json({ error: gas.error || "Sheet sync failed" });
      }
    }
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save type definitions" });
  }
});

async function assertAssetUnique(assetData: Record<string, unknown>, excludeId?: string) {
  if (!GAS_WEBAPP_URL) return;
  const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
  const hit = findAnyIdentifierDuplicate(assets, assetData, excludeId);
  if (hit) {
    const label = uniqueFieldLabel(hit.field);
    throw new Error(
      `Duplicate ${label}: already registered (Asset #${hit.duplicate.id || hit.duplicate.assetCode})`
    );
  }
}

app.post("/api/setup", async (req, res) => {
  try {
    const result = await proxyToGas({ action: "setup" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/setup/redesigned", async (req, res) => {
  try {
    const result = await proxyToGas({ action: "setup_redesigned" });
    const data = readAppData();
    data.settings.dbMode = "redesigned";
    writeAppData(data);
    invalidateAssetCache();
    invalidateUsersCache();
    res.json({ ...result, dbMode: "redesigned" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/setup/redesigned-fresh", async (req, res) => {
  try {
    const result = await proxyToGas({ action: "setup_redesigned_fresh" });
    const data = readAppData();
    data.settings.dbMode = "redesigned";
    data.users = [];
    writeAppData(data);
    clearAllCaches();
    invalidateAssetCache();
    invalidateUsersCache();
    if (GAS_WEBAPP_URL) {
      await syncUsersNow(userSyncDeps());
      await refreshAssetsNow(GAS_WEBAPP_URL);
    }
    res.json({
      ...result,
      dbMode: "redesigned",
      message:
        "Database reset complete. Old data cleared. One master Assets table — filter by location, plant, and category on the dashboard. Default login: admin@example.com",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/missing-items", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let items = readMissingItems();
    if (force && GAS_WEBAPP_URL) {
      items = await fetchMissingItemsFromGas(proxyToGas);
    }
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load missing items" });
  }
});

app.post("/api/missing-items", async (req, res) => {
  try {
    const body = req.body as { item: import("./src/types/redesigned.js").MissingItemRecord; syncSheet?: boolean };
    const saved = upsertMissingItem(body.item);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("add", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, item: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save missing item" });
  }
});

app.post("/api/missing-items/:recordId/recover", async (req, res) => {
  try {
    const recordId = decodeURIComponent(req.params.recordId);
    const list = readMissingItems();
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });
    const saved = upsertMissingItem({
      ...existing,
      Status: "Recovered",
      "Recovered Date": new Date().toISOString(),
      "Recovered By": String(req.body?.recoveredBy || "System"),
    });
    let sheetWarning: string | undefined;
    if (GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("update", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error;
    }
    res.json({ success: true, item: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update" });
  }
});

app.get("/api/damaged-items", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let items = readDamagedItems();
    if (force && GAS_WEBAPP_URL) {
      items = await fetchDamagedItemsFromGas(proxyToGas);
    }
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load damaged items" });
  }
});

app.post("/api/damaged-items", async (req, res) => {
  try {
    const body = req.body as { item: import("./src/types/redesigned.js").DamagedItemRecord; syncSheet?: boolean };
    const saved = upsertDamagedItem(body.item);
    let sheetWarning: string | undefined;
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("add", saved, proxyToGas);
      if (!gas.ok) sheetWarning = gas.error || "Database sync failed";
    }
    res.json({ success: true, item: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save damaged item" });
  }
});

app.post("/api/assets", async (req, res) => {
  try {
    const assetData = prepareAssetPayload(req.body as Record<string, unknown>);
    console.log("RECEIVED ASSET DATA:", { imageUrl: assetData.imageUrl, documentUrl: assetData.documentUrl });
    await assertAssetUnique(assetData);

    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    const maxId = assets.reduce((max, a) => Math.max(max, parseInt(a.id, 10) || 0), 0);
    const assetId = assetData.id?.toString() || String(maxId + 1).padStart(3, "0");
    assetData.uniqueCode =
      assetData.uniqueCode || assetData.assetCode || assetId;

    if (assetData.status === "Damaged" || assetData.status === "Under Maintenance" || assetData.condition === "Damaged") {

      
      try {
        upsertInventoryItem({
          itemId: String(assetData.uniqueCode || assetId),
          assetCode: String(assetData.assetCode || ""),
          itemName: String(assetData.assetName || assetData.model || `${assetData.make || ""} ${assetData.model || ""}`.trim() || "Unknown Asset"),
          brandName: String(assetData.make || ""),
          model: String(assetData.model || ""),
          serialNumber: String(assetData.serialNumber || ""),
          category: String(assetData.mainCategory || "IT Assets"),
          status: "Damaged",
          quantity: 1,
          minStock: 0,
        });
      } catch (err) {
        console.error("Failed to add damaged asset to inventory:", err);
      }
    }

    const baseUrl = getBaseUrl(req);
    const tempAsset = mapSheetRow({
      ...assetData,
      id: assetId,
      "S No": assetId,
      "Unique Code": assetData.uniqueCode,
    });
    assetData.qrCodeText = getScanUrl(baseUrl, tempAsset);

    const dbMode = readAppData().settings.dbMode;
    let result;
    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, assetId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "add_asset_redesigned", row });
    } else {
      const headers = await ensureSheetHeadersReady();
      const row = buildAssetRow(headers, assetData);
      console.log("GENERATED ROW ARRAY:", row);
      result = await proxyToGas({ action: "add", row });
    }

    if (result.error) throw new Error(result.error);

    await persistAssetDynamicDetails(assetId, assetData);

    const hist = recordAssignmentChange({
      assetId,
      previous: {},
      next: {
        employeeId: String(assetData.employeeId || ""),
        contactName: String(assetData.contactName || ""),
        contactEmail: String(assetData.contactEmail || ""),
        status: String(assetData.status || ""),
      },
      assignedBy: String(assetData.createdBy || assetData.updatedBy || ""),
    });
    if (GAS_WEBAPP_URL) await syncHistoryEntriesToGas(hist, proxyToGas);

    // Audit log
    addAuditLog(
      req.body.createdBy || "",
      "ADD_ASSET",
      assetId,
      "",
      JSON.stringify(assetData),
      `Added asset ${assetId} (${assetData.assetName})`,
      proxyToGas
    );

    invalidateAssetCache();
    if (GAS_WEBAPP_URL) void refreshAssetsNow(GAS_WEBAPP_URL).catch(() => {});

    res.json({ success: true, asset: { ...assetData, id: assetId, qrCodeText: assetData.qrCodeText } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to add asset" });
  }
});

app.put("/api/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const assetData = prepareAssetPayload({ ...req.body, id } as Record<string, unknown>);
    await assertAssetUnique(assetData, String(id));

    if (assetData.status === "Damaged" || assetData.status === "Under Maintenance" || assetData.condition === "Damaged") {

      
      try {
        upsertInventoryItem({
          itemId: String(assetData.uniqueCode || id),
          assetCode: String(assetData.assetCode || ""),
          itemName: String(assetData.assetName || assetData.model || `${assetData.make || ""} ${assetData.model || ""}`.trim() || "Unknown Asset"),
          brandName: String(assetData.make || ""),
          model: String(assetData.model || ""),
          serialNumber: String(assetData.serialNumber || ""),
          category: String(assetData.mainCategory || "IT Assets"),
          status: "Damaged",
          quantity: 1,
          minStock: 0,
        });
      } catch (err) {
        console.error("Failed to add damaged asset to inventory:", err);
      }
    }

    const baseUrl = getBaseUrl(req);
    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    const existing = assets.find(a => String(a.id).replace(/^0+/, "") === String(id).replace(/^0+/, ""));
    assetData.qrCodeText = getScanUrl(baseUrl, { ...(existing || {}), ...assetData, id: String(id) } as any);

    const dbMode = readAppData().settings.dbMode;
    let result;
    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, String(id), String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id, row });
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) return res.status(500).json({ error: "Sheet has no data" });

      const headers = sheet[0];
      const rows = sheet.slice(1);
      const idCol = headers.findIndex((h: string) =>
        ["s no", "id", "sr.no"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val: any) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(id);
      const rowIndex = rows.findIndex((row: any[]) =>
        normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId
      );
      if (rowIndex === -1) return res.status(404).json({ error: "Asset not found" });

      const updatedRow = buildAssetRow(headers, assetData, rows[rowIndex]);
      result = await proxyToGas({ action: "update", id, row: updatedRow, rowIndex: rowIndex + 2 });
    }

    if (result.error) throw new Error(result.error);

    await persistAssetDynamicDetails(String(id), assetData);

    const hist = recordAssignmentChange({
      assetId: String(id),
      previous: {
        employeeId: existing?.employeeId || "",
        contactName: existing?.contactName || "",
        contactEmail: existing?.contactEmail || "",
        status: existing?.status || "",
      },
      next: {
        employeeId: String(assetData.employeeId || ""),
        contactName: String(assetData.contactName || ""),
        contactEmail: String(assetData.contactEmail || ""),
        status: String(assetData.status || ""),
      },
      assignedBy: String(assetData.updatedBy || ""),
    });
    if (GAS_WEBAPP_URL) await syncHistoryEntriesToGas(hist, proxyToGas);

    // Audit log
    addAuditLog(
      req.body.updatedBy || "",
      "UPDATE_ASSET",
      String(id),
      existing ? JSON.stringify(existing) : "",
      JSON.stringify(assetData),
      `Updated asset ${id} (${assetData.assetName})`,
      proxyToGas
    );

    invalidateAssetCache();
    if (GAS_WEBAPP_URL) void refreshAssetsNow(GAS_WEBAPP_URL).catch(() => {});

    res.json({ success: true, asset: assetData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update asset" });
  }
});

app.post("/api/assets/bulk", async (req, res) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: "No assets to import" });
    }
    const headers = await ensureSheetHeadersReady();

    let imported = 0;
    for (const asset of assets) {
      const row = buildAssetRow(headers, asset);
      const result = await proxyToGas({ action: "add", row });
      if (!result.error) imported++;
    }
    res.json({ success: true, imported, total: assets.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Bulk import failed" });
  }
});

app.delete("/api/assets/:id", async (req, res) => {
  try {
    const userEmail = (req.query.userEmail as string || "").trim().toLowerCase();
    if (!userEmail) {
      return res.status(403).json({ error: "User email required for deletion authorization." });
    }
    const data = readAppData();
    const user = data.users.find((u) => u.email === userEmail);
    if (!user) {
      return res.status(403).json({ error: "User not found for deletion authorization." });
    }
    if (user.role !== "IT Admin" && !(user.role === "Admin" && user.allowDelete)) {
      return res.status(403).json({ error: "You do not have permission to delete assets." });
    }

    const id = req.params.id;
    const dbMode = data.settings.dbMode;
    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    const existing = assets.find(a => String(a.id).replace(/^0+/, "") === String(id).replace(/^0+/, ""));

    let result;
    if (dbMode === "redesigned") {
      result = await proxyToGas({ action: "delete_asset_redesigned", id });
    } else {
      result = await proxyToGas({ action: "delete", id });
    }

    deleteDetailsForAsset(id);
    if (GAS_WEBAPP_URL) void deleteDetailsFromGas(id, proxyToGas);
    if (result.error) throw new Error(result.error);

    // Audit log
    addAuditLog(
      req.query.userEmail as string || "",
      "DELETE_ASSET",
      id,
      existing ? JSON.stringify(existing) : "",
      "",
      `Deleted asset ${id}`,
      proxyToGas
    );

    invalidateAssetCache();
    if (GAS_WEBAPP_URL) void refreshAssetsNow(GAS_WEBAPP_URL).catch(() => {});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete asset" });
  }
});

// QR opens /scan/:id → redirect straight to PDF
app.get("/scan/:id", (req, res) => {
  const id = encodeURIComponent(req.params.id);
  res.redirect(302, `/api/scan/${id}/pdf`);
});

// Public QR scan → merged PDF (details + image + document)
app.get("/api/scan/:id/pdf", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) {
      return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured in .env" });
    }

    const scanId = req.params.id;
    let assets: Awaited<ReturnType<typeof fetchAllAssets>>;
    try {
      const cached = await getAssetsWithCache(GAS_WEBAPP_URL, false);
      assets = cached.assets;
    } catch (fetchErr: any) {
      console.error("Fetch assets for PDF:", fetchErr);
      return res.status(500).json({ error: "Could not load assets from sheet" });
    }

    let asset = findAssetByScanId(assets, scanId);
    if (!asset) {
      try {
        assets = await refreshAssetsNow(GAS_WEBAPP_URL);
        asset = findAssetByScanId(assets, scanId);
      } catch {
        /* retry failed */
      }
    }
    if (!asset) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(404).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>Asset not found</h2><p>No asset for ID: <b>${scanId}</b>. Re-save the asset to refresh its QR code.</p></body></html>`
      );
    }

    const baseUrl = getBaseUrl(req);
    const pdfBytes = await generateAssetPdf(asset, baseUrl, scanId);

    if (!pdfBytes || pdfBytes.length < 100) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>PDF could not be generated</h2><p>Try again or re-upload the document on this asset.</p></body></html>`
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdfBytes.length));
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="AssetVault_${pdfSafeFilename(getCanonicalScanId(asset) || scanId)}.pdf"`
    );
    res.end(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(
      `<html><body style="font-family:system-ui;padding:24px"><h2>PDF error</h2><p>${error.message || "Failed to generate PDF"}</p></body></html>`
    );
  }
});

function pdfSafeFilename(id: string) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

app.get("/api/scan/:id", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) return res.status(500).json({ error: "Server not configured" });
    const assets = await fetchAllAssets(GAS_WEBAPP_URL);
    const asset = findAssetByScanId(assets, req.params.id);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json({
      ...asset,
      pdfUrl: `/api/scan/${encodeURIComponent(req.params.id)}/pdf`,
      scanUrl: getScanUrl(getBaseUrl(req), asset),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch asset" });
  }
});

function mountViteDev(app: express.Express, vite: ViteDevServer) {
  const indexHtml = path.resolve(process.cwd(), "index.html");

  // Never let Vite handle /api or /scan — API + PDF redirect must hit Express
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
      return next();
    }
    vite.middlewares(req, res, next);
  });

  // SPA fallback for frontend routes only (not /api, not /scan)
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
      return next();
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    try {
      let html = fs.readFileSync(indexHtml, "utf-8");
      html = await vite.transformIndexHtml(req.originalUrl, html);
      res.status(200).setHeader("Content-Type", "text/html").end(html);
    } catch (e) {
      next(e);
    }
  });
}

async function startServer() {
  try {
    await import("pdf-lib");
    await import("qrcode");
    console.log("PDF libraries loaded OK");
  } catch {
    console.error(
      "MISSING: Run 'npm install' — pdf-lib and qrcode are required for QR PDF generation"
    );
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    mountViteDev(app, vite);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open app at http://localhost:${PORT} (not Vite port 5173)`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
