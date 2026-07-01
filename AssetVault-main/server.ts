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
import { mergeCatalog } from "./server/assetCatalogDefaults.js";
import {
  fetchAllAssets,
  findAssetByScanId,
  getScanUrl,
  getCanonicalScanId,
  mapSheetRow,
  type MappedAsset,
} from "./server/assetHelpers.js";
import { upsertLocalUser, normalizeUser, canDeleteUserRecord, isItAdminRole, fetchUsersFromGas } from "./server/usersService.js";
import { generateAssetPdf } from "./server/pdfGenerator.js";
import { persistUserToSheet } from "./server/userSheetSync.js";
import { listUsersFromGoogleSheet } from "./server/sheetsUsers.js";
import { requestOtp, verifyOtp, findRegisteredUser } from "./server/otpService.js";
import {
  getAssetsWithCache,
  getCachedAssets,
  refreshAssetsNow,
  invalidateAssetCache,
  upsertAssetInCache,
  removeAssetFromCache,
  getAssetsSyncMeta,
  scheduleAssetsSyncIfStale,
} from "./server/assetCache.js";
import { generateAssetCode, isManualAssetCodeCategory, releaseIssuedCode, registerSavingCode, releaseSavingCode, isSavingCode, generateNextAssetId, releaseAssetId } from "./server/assetCodeGenerator.js";
import { healMisalignedAssetFields } from "./src/lib/healAssetFields.js";
import { mapMasterRowToSheetHeaders } from "./server/sheetRowMapper.js";
import { getUsersWithCache, syncUsersNow, getCachedUsers, getUsersSyncMeta, invalidateUsersCache } from "./server/usersSync.js";
import {
  clearAllCaches,
  isCacheForDifferentSpreadsheet,
  touchCacheSpreadsheetId,
  getCacheSpreadsheetId,
  readCache,
  writeCache,
  readCacheStale,
} from "./server/cacheStore.js";
import {
  readInventory,
  writeInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  fetchInventoryFromGas,
  persistInventoryToGas,
  replaceInventoryInGas,
} from "./server/inventoryStore.js";
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
import { validateNewPurchaseRequirements } from "./src/lib/assetCondition.js";
import { fetchRemoteFile, isAllowedRemoteUrl } from "./server/fileProxy.js";
import { driveDownloadUrl, driveViewUrl, drivePreviewUrl } from "./server/driveUrls.js";
import { PERIPHERAL_TYPES, SUB_TO_MAIN_MAP, subCategoryForItAssetType, healMisalignedCategoryFields } from "./src/lib/assetCatalogByType.js";
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
  writeEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  findEmployeeById,
  findEmployeeByEmail,
  fetchEmployeesFromGas,
  persistEmployeeToGas,
  normalizeEmployeeId,
  normalizeEmail,
} from "./server/employeesStore.js";
import {
  EMPLOYEE_ID_EXISTS_MESSAGE,
  validateEmployeePayload,
  isEmployeeIdExistsError,
} from "./src/lib/employeeValidation.js";
import { isInactiveEmployeeStatus } from "./server/employeeStatus.js";
import {
  getHistoryByAssetId,
  getHistoryByEmployeeId,
  recordAssignmentChange,
  syncHistoryEntriesToGas,
  fetchHistoryFromGas,
  normalizeHistoryForUi,
  deleteAssignmentHistoryEntry,
  deleteAssignmentHistoryForAsset,
  deleteHistoryEntryRemote,
  readAssignmentHistory,
  clearAllAssignmentHistory,
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
  deleteExtraItemsForAsset,
  fetchExtraItemsFromGas,
  persistExtraItemToGas,
} from "./server/extraItemsStore.js";
import {
  readDamagedItems,
  writeDamagedItems,
  upsertDamagedItem,
  deleteDamagedItem,
  deleteDamagedItemsForAsset,
  fetchDamagedItemsFromGas,
  persistDamagedItemToGas,
} from "./server/damagedStore.js";
import {
  readMissingItems,
  writeMissingItems,
  upsertMissingItem,
  deleteMissingItem,
  deleteMissingItemsForAsset,
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
import { logAssetMappingAudit } from "./server/sheetRowMapper.js";
import { getDb, insertAssetLocal, updateAssetLocal, deleteAssetLocal, isLocalSqliteEnabled } from "./server/sqlDb.js";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
} from "./server/sessionAuth.js";
import {
  applySecurityHeaders,
  buildAllowedOrigins,
  configureCors,
  rateLimitAuth,
  requireApiAuth,
} from "./server/securityMiddleware.js";
import { gasGetUrl, gasGet } from "./server/gasClient.js";
import { resolveRequestUser } from "./server/requestUser.js";
import { getEnv, maskValue, setCleanEnv, setCleanEnvAlias } from "./server/env.js";

dotenv.config();
const GAS_ENV = setCleanEnvAlias("GAS_WEBAPP_URL", [
  "GAS_URL",
  "GOOGLE_APPS_SCRIPT_URL",
  "GOOGLE_SCRIPT_URL",
  "APPS_SCRIPT_URL",
]);
[
  "GAS_URL",
  "GOOGLE_APPS_SCRIPT_URL",
  "GOOGLE_SCRIPT_URL",
  "APPS_SCRIPT_URL",
  "SPREADSHEET_ID",
  "USERS_SHEET_GID",
  "APP_URL",
  "SMTP_EMAIL",
  "SMTP_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
  "OTP_FROM_EMAIL",
  "OTP_USE_SMTP",
  "SESSION_SECRET",
  "GEMINI_API_KEY",
].forEach(setCleanEnv);

// Initialize local SQLite only for non-serverless development. Vercel uses Google Sheets/cache.
if (isLocalSqliteEnabled()) {
  getDb().then(() => console.log("SQLite: DB Initialized")).catch(err => console.error("SQLite Init Error:", err));
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(applySecurityHeaders);
app.use(configureCors(buildAllowedOrigins()));
app.use(rateLimitAuth);
app.use(express.json({ limit: "25mb" }));
app.use(requireApiAuth);

const GAS_WEBAPP_URL = GAS_ENV.value;
const SPREADSHEET_ID = getEnv("SPREADSHEET_ID");
const USERS_SHEET_GID = getEnv("USERS_SHEET_GID");
const USERS_SHEET_GID_VALID =
  USERS_SHEET_GID && USERS_SHEET_GID !== "0" ? USERS_SHEET_GID : "";
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.NETLIFY);

if (!GAS_WEBAPP_URL) {
  console.error(
    "[Config] GAS_WEBAPP_URL is not configured. Set GAS_WEBAPP_URL to the deployed Google Apps Script /exec URL in .env or in your hosting environment."
  );
} else if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GAS_WEBAPP_URL)) {
  console.error(
    `[Config] ${GAS_ENV.name} does not look like a deployed Apps Script /exec URL:`,
    GAS_WEBAPP_URL
  );
} else {
  console.log(
    `[Config] GAS_WEBAPP_URL configured from ${GAS_ENV.name}:`,
    maskValue(GAS_WEBAPP_URL, 18)
  );
}
if (!getEnv("SESSION_SECRET")) {
  console.warn("[Security] SESSION_SECRET is not set — using insecure dev default. Set a 32+ char secret before production.");
}

/** Drop stale disk cache when spreadsheet changes or cache has no spreadsheet binding. */
if (SPREADSHEET_ID) {
  const cachedSheet = getCacheSpreadsheetId();
  const hasLegacyCache =
    !cachedSheet &&
    (readEmployees().length > 0 ||
      (getCachedAssets()?.length ?? 0) > 0 ||
      readAppData().users.length > 0 ||
      readAssignmentHistory().length > 0);
  const shouldResetCache = isCacheForDifferentSpreadsheet(SPREADSHEET_ID) || hasLegacyCache;
  if (shouldResetCache) {
    console.log("[AMS] Clearing local cache — sheet source:", SPREADSHEET_ID);
    clearAllCaches();
    writeEmployees([]);
    invalidateAssetCache();
    invalidateUsersCache();
    clearAllAssignmentHistory();
    touchCacheSpreadsheetId(SPREADSHEET_ID);
  }
  if (!getCacheSpreadsheetId()) {
    touchCacheSpreadsheetId(SPREADSHEET_ID);
  }
}

function shouldRefreshSheetBackedData(force: boolean, localCount: number) {
  if (!GAS_WEBAPP_URL) return false;
  if (isCacheForDifferentSpreadsheet(SPREADSHEET_ID)) return true;
  if (force || IS_SERVERLESS || localCount === 0) return true;
  // Sheet-backed data must stay fresh across devices; local JSON is only fallback.
  return true;
}

async function loadEmployeesWithSheetSync(): Promise<Employee[]> {
  let list = readEmployees();
  if (!GAS_WEBAPP_URL && !SPREADSHEET_ID) return list;
  try {
    list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
  } catch (error) {
    console.warn("loadEmployeesWithSheetSync:", error);
  }
  return list;
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
  usersSheetGid: USERS_SHEET_GID_VALID,
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
  return !!GAS_WEBAPP_URL && getEnv("OTP_USE_SMTP") !== "true";
}

app.get("/api/health/config", async (_req, res) => {
  const result: Record<string, unknown> = {
    ok: true,
    serverless: IS_SERVERLESS,
    gasConfigured: Boolean(GAS_WEBAPP_URL),
    gasEnvName: GAS_WEBAPP_URL ? GAS_ENV.name : null,
    gasUrl: maskValue(GAS_WEBAPP_URL, 18),
    spreadsheetId: maskValue(SPREADSHEET_ID, 6),
    usersSheetGid: USERS_SHEET_GID_VALID || null,
  };

  if (GAS_WEBAPP_URL) {
    try {
      const gasResult = await proxyToGas({ action: "list_users" }, 15000);
      const gasErr = gasAuthError(gasResult);
      result.gasOk = !gasErr;
      result.gasError = gasErr || null;
      result.userCount = Array.isArray((gasResult as { users?: unknown[] }).users)
        ? (gasResult as { users: unknown[] }).users.length
        : null;
    } catch (error) {
      result.gasOk = false;
      result.gasError = error instanceof Error ? error.message : String(error);
    }
  }

  res.json(result);
});

app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (otpUsesSheetMail()) {
      try {
        const gasResult = await proxyToGas({ action: "request_otp", email }, 45000);
        const gasErr = gasAuthError(gasResult);
        if (!gasErr) {
          const msg = (gasResult as { message?: string }).message || "OTP sent to your email";
          return res.json({ success: true, message: msg });
        }
        if (/not authorized|not registered|email not authorized/i.test(gasErr)) {
          let hint = "";
          try {
            const users = await fetchUsersFromGas(proxyToGas, GAS_WEBAPP_URL, SPREADSHEET_ID, USERS_SHEET_GID_VALID);
            if (users.length > 0) {
              const sample = users.slice(0, 3).map((u) => u.email).join(", ");
              hint = ` Registered in sheet: ${sample}${users.length > 3 ? ", …" : ""}.`;
            }
          } catch {
            /* ignore */
          }
          return res.status(403).json({
            error: "Invalid email ID. Contact your IT admin.",
          });
        }
        if (/no users configured|users sheet not found|email column missing/i.test(gasErr)) {
          return res.status(503).json({ error: gasErr });
        }
        return res.status(400).json({ error: gasErr });
      } catch (gasFail: unknown) {
        const detail = gasFail instanceof Error ? gasFail.message : String(gasFail);
        console.error("GAS OTP request failed:", detail);
        return res.status(503).json({
          error: `Could not send OTP via Database mail: ${detail}`,
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
          const token = setSessionCookie(res, { email: normalized.email, role: normalized.role });
          return res.json({ success: true, user: normalized, token });
        }
        return res.status(400).json({ error: gasErr || "Invalid or expired OTP" });
      } catch (gasFail: unknown) {
        const detail = gasFail instanceof Error ? gasFail.message : String(gasFail);
        console.error("GAS verify OTP failed:", detail);
        return res.status(503).json({
          error: `Could not verify OTP via Database: ${detail}`,
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
    const token = setSessionCookie(res, { email: normalized.email, role: normalized.role });
    res.json({ success: true, user: normalized, token });
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Not logged in" });

    let user = findRegisteredUser(session.email);
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || !user) {
      try {
        await syncUsersNow(userSyncDeps());
        user = findRegisteredUser(session.email);
      } catch {
        /* cache only */
      }
    }
    if (!user) return res.status(401).json({ error: "User account not found" });

    const normalized = normalizeUser(user as unknown as Record<string, unknown>);
    upsertLocalUser(normalized);
    const token = setSessionCookie(res, { email: normalized.email, role: normalized.role });
    res.json({ success: true, user: normalized, token });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Session check failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

function getBaseUrl(req: express.Request): string {
  const configuredBaseUrl = getEnv("APP_BASE_URL") || getEnv("APP_URL");
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");
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

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const allowedMime = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    if (!allowedMime.has(mimeType)) {
      return res.status(400).json({ error: "File type not allowed. Use JPEG, PNG, WebP, or PDF." });
    }

    const bytes = Buffer.from(base64Data, "base64");
    const maxBytes = 15 * 1024 * 1024;
    if (bytes.length > maxBytes) {
      return res.status(413).json({ error: "File too large (max 15 MB)." });
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    
    // Send to Google Apps Script to upload to Google Drive
    const result = await proxyToGas({ 
      action: "upload_file", 
      filename: safeName, 
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
    if (!id && !urlParam) return res.status(400).json({ error: "Missing id or url parameter" });
    if (urlParam && !isAllowedRemoteUrl(urlParam)) {
      return res.status(403).json({ error: "Only Google Drive file URLs are allowed." });
    }
    const source = id ? driveDownloadUrl(id) : urlParam;

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

app.get("/api/assets/sync-meta", async (req, res) => {
  try {
    if (GAS_WEBAPP_URL) scheduleAssetsSyncIfStale(GAS_WEBAPP_URL);
    const meta = getAssetsSyncMeta();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("X-AMS-Syncing", meta.syncing ? "1" : "0");
    res.json(meta);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Sync meta failed" });
  }
});

/** Rebuild — fresh sheet uses manual headers; no auto-migrate. */
app.post("/api/assets/rebuild-sheets", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole(user.role)) {
      return res.status(403).json({ error: "Only IT Admin can rebuild sheets." });
    }
    invalidateAssetCache();
    const assets = await refreshAssetsNow(GAS_WEBAPP_URL!);
    res.json({
      success: true,
      message: "Data refreshed from new sheet. Create tabs using gas/NEW_SHEET_ROW1_HEADERS.txt",
      count: assets.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Rebuild failed" });
  }
});

/** Force-refresh assets from Google Sheets (optional best-effort sheet rebuild for IT Admin). */
app.post("/api/assets/sync", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) {
      return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured" });
    }

    const user = resolveRequestUser(req);

    let assets = await refreshAssetsNow(GAS_WEBAPP_URL);

    if (user && isItAdminRole(user.role)) {
      try {
        await proxyToGas({ action: "sync_location_plant_sheets" }, 120000);
      } catch (syncErr: unknown) {
        console.warn(
          "[AMS] Location/plant sheet sync skipped:",
          syncErr instanceof Error ? syncErr.message : syncErr
        );
      }
    }

    if (user && isItAdminRole(user.role)) {
      let persisted = 0;
      for (const asset of assets) {
        const raw = JSON.stringify(asset);
        const healed = healMisalignedAssetFields(asset) as MappedAsset;
        if (JSON.stringify(healed) === raw) continue;
        try {
          const row = buildMasterAssetRow(healed);
          const result = await proxyToGas(
            { action: "update", id: String(healed.id), row },
            60000
          );
          if (result?.error) {
            console.warn("[AMS] Heal persist failed for", healed.id, result.error);
          } else {
            persisted++;
          }
        } catch (persistErr: unknown) {
          console.warn(
            "[AMS] Heal persist failed for",
            asset.id,
            persistErr instanceof Error ? persistErr.message : persistErr
          );
        }
      }
      if (persisted > 0) {
        assets = await refreshAssetsNow(GAS_WEBAPP_URL);
      }
    }

    res.json({ success: true, count: assets.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});

app.get("/api/assets", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured" });

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const force = req.query.refresh === "1";
    let assets: MappedAsset[];
    let fromCache = false;
    let syncing = false;

    try {
      const result = await getAssetsWithCache(GAS_WEBAPP_URL, force);
      assets = result.assets;
      fromCache = result.fromCache;
      syncing = result.syncing;
    } catch (syncErr: unknown) {
      const msg = syncErr instanceof Error ? syncErr.message : "Failed to load assets from sheet";
      console.error("[AMS] /api/assets sheet pull failed:", msg);
      return res.status(502).json({ error: msg });
    }

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
      "Account Asset Code": a.accountAssetCode,
      "Vendor Name": a.vendorName,
      "Warranty Start": a.warrantyStartDate,
      "Warranty End": a.warrantyEndDate,
      RAM: a.ram,
      SSD: a.ssd,
      CPU: a.cpu,
      "Windows Version": a.windowsVersion,
      "Asset Type": a.assetType,
      "MAC Address": a.macAddress,
      "IP Address": a.ipAddress,
      "Host Name": a.hostName,
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

    res.setHeader("X-AMS-Cache", fromCache ? "hit" : "miss");
    res.setHeader("X-AMS-Syncing", syncing ? "1" : "0");
    if (sheetRows.length > 0) {
      const last = sheetRows[sheetRows.length - 1];
      console.log("[AMS] GET /api/assets — returning", sheetRows.length, "rows; latest:", {
        id: last["S No"],
        CPU: last.CPU,
        RAM: last.RAM,
        "MAC Address": last["MAC Address"],
        "Contact Person Email": last["Contact Person Email"],
      });
    }
    res.json(sheetRows);
  } catch (error: any) {
    console.error("Fetch assets error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch assets" });
  }
});

app.get("/api/assets/next-code", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const category = String(req.query.category || "").trim() || "IT Assets";
    if (isManualAssetCodeCategory(category)) {
      return res.json({ manual: true, code: "", id: "" });
    }

    if (GAS_WEBAPP_URL) {
      try {
        const dbMode = readAppData().settings.dbMode;
        const result = (await proxyToGas({ action: "next_code_lock", category, dbMode })) as {
          success?: boolean;
          code?: string;
          id?: string;
          error?: string;
        };
        if (result && result.success && result.code && result.id) {
          return res.json({ manual: false, code: result.code, id: result.id });
        }
        if (result && result.error) {
          console.warn("[AMS] GAS next_code_lock error, using local fallback:", result.error);
        }
      } catch (err) {
        console.warn("[AMS] GAS next_code_lock request failed, using local fallback:", err);
      }
    }

    // Local Fallback if GAS is offline/unreachable
    const assets = await getAssetsForOps();
    const code = generateAssetCode(assets, category);
    const maxId = assets.reduce((max, a) => Math.max(max, parseInt(a.id, 10) || 0), 0);
    const id = String(maxId + 1).padStart(3, "0");
    res.json({ manual: false, code, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate code" });
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

    if (!GAS_WEBAPP_URL) return res.json({ duplicate: false });

    const assets = await getAssetsForOps();
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
    const response = await fetch(gasGetUrl(GAS_WEBAPP_URL));
    const text = await response.text();
    if (text.trim().startsWith("<")) {
      throw new Error("Database returned HTML instead of JSON - redeploy the backend script");
    }
    let headers = parseHeaders(JSON.parse(text));
    if (headers.length > 0) return headers;

    const hdrRes = await fetch(gasGetUrl(GAS_WEBAPP_URL, { action: "get_asset_headers" }));
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
  const response = await fetch(gasGetUrl(GAS_WEBAPP_URL));
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

async function getAssetsForOps(): Promise<MappedAsset[]> {
  if (!GAS_WEBAPP_URL) return [];
  try {
    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    return assets;
  } catch {
    const cached = getCachedAssets();
    return cached || [];
  }
}

async function getFreshAssetsForMutation(): Promise<MappedAsset[]> {
  if (GAS_WEBAPP_URL) {
    try {
      return await refreshAssetsNow(GAS_WEBAPP_URL);
    } catch (error) {
      console.warn("[AMS] Fresh asset pull failed before mutation; falling back to cache:", error);
    }
  }
  return getAssetsForOps();
}

async function assertSavedEmployeeProfile(
  assetData: Record<string, unknown>,
  existing?: { employeeId?: string; contactEmail?: string }
): Promise<Employee | null> {
  const employeeId = String(assetData.employeeId || "").trim();
  const email = normalizeEmail(String(assetData.contactEmail || ""));
  const contactName = String(assetData.contactName || "").trim();

  if (!employeeId && !email && !contactName) return null;

  if (!employeeId && !email) {
    throw new Error("Employee ID is required — select or create a saved employee profile.");
  }

  const employees = readEmployees();
  let employee =
    (employeeId ? findEmployeeById(employees, employeeId) : undefined) ||
    (email ? findEmployeeByEmail(employees, email) : undefined);

  if (!employee) {
    if (employeeId && contactName && email) {
      // Auto-create employee profile!
      const newEmp = {
        employeeId,
        name: contactName,
        email,
        phone: String(assetData.contactMobile || "").replace(/\D/g, "").slice(0, 10),
        department: String(assetData.department || "").trim(),
        location: String(assetData.location || "").trim(),
        designation: "",
        plant: String(assetData.plantCode || "").trim(),
        status: "Active" as const,
      };

      try {
        employee = createEmployee(newEmp);
        if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
          const gas = await persistEmployeeToGas("add", employee, proxyToGas, SPREADSHEET_ID);
          if (!gas.ok) {
            const errMsg = String(gas.error || "").toLowerCase();
            if (errMsg.includes("already exists") || errMsg.includes("alreadyexist") || errMsg.includes("exist")) {
              console.log(`[AMS] Employee ${employeeId} already exists in Sheet. Proceeding.`);
              const freshList = readEmployees();
              employee = findEmployeeById(freshList, employeeId) || employee;
            } else {
              deleteEmployee(employee.employeeId);
              throw new Error("Failed to auto-create employee profile: " + (gas.error || "Sync failed"));
            }
          }
        }
      } catch (err: any) {
        const errMsg = String(err.message || "").toLowerCase();
        if (errMsg.includes("already exists") || errMsg.includes("alreadyexist") || errMsg.includes("exist")) {
          console.log(`[AMS] Employee ${employeeId} already exists locally. Proceeding.`);
          const freshList = readEmployees();
          employee = findEmployeeById(freshList, employeeId);
          if (!employee) {
            employee = {
              ...newEmp,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
          }
        } else {
          throw err;
        }
      }
    } else {
      throw new Error(
        "A saved employee profile is required. Create the employee under Employees, then assign the asset."
      );
    }
  }
  if (isInactiveEmployeeStatus(employee.status)) {
    const prevId = normalizeEmployeeId(existing?.employeeId || "");
    const nextId = normalizeEmployeeId(employee.employeeId);
    const sameAssignee = Boolean(prevId && nextId && prevId === nextId);
    if (!sameAssignee) {
      throw new Error(
        "Cannot assign assets to an inactive employee. Clear assignee to return the asset, or choose an active employee."
      );
    }
  }

  return employee;
}

function isCctvSecurityAsset(assetData: Record<string, unknown>): boolean {
  const assetType = String(assetData.assetType || "").trim();
  const subCategory = String(assetData.subCategory || "").trim();
  const assetTypeId = String(assetData.assetTypeId || "").trim();
  return (
    assetTypeId === "cctv_security" ||
    assetType === "Camera" ||
    assetType === "NVR" ||
    subCategory === "CCTV / Security Device"
  );
}

function hasAssigneeFields(assetData: Record<string, unknown>): boolean {
  return (
    !!String(assetData.contactName || "").trim() ||
    !!String(assetData.contactEmail || "").trim() ||
    !!String(assetData.employeeId || "").trim()
  );
}

function ensureAssignedDate(
  assetData: Record<string, unknown>,
  existingAsset?: { assignedDate?: string; employeeId?: string; contactEmail?: string }
): void {
  if (!hasAssigneeFields(assetData)) {
    assetData.assignedDate = "";
    return;
  }
  const current = String(assetData.assignedDate || "").trim();
  if (current) return;
  const fromExisting = String(existingAsset?.assignedDate || "").trim();
  assetData.assignedDate = fromExisting || new Date().toISOString();
}

async function validateAssetPayload(
  assetData: Record<string, unknown>,
  existingAsset?: { employeeId?: string; contactEmail?: string; assignedDate?: string }
): Promise<void> {
  const mainCat = String(assetData.mainCategory || "IT Assets").trim();
  const isSoftware = mainCat === "Software / License Assets";
  const isCctv = isCctvSecurityAsset(assetData);

  const hasAssignee =
    !!String(assetData.contactName || "").trim() ||
    !!String(assetData.contactEmail || "").trim() ||
    !!String(assetData.employeeId || "").trim();

  if (!isSoftware && !String(assetData.serialNumber || "").trim()) {
    throw new Error("Serial number is required");
  }
  if (!String(assetData.location || "").trim()) {
    throw new Error("Location is required");
  }
  if (!String(assetData.plantCode || "").trim()) {
    throw new Error("Plant code is required");
  }
  if (!isCctv && hasAssignee && !String(assetData.department || "").trim()) {
    throw new Error("Department is required");
  }

  if (!isCctv) {
    if (hasAssignee) {
      if (!String(assetData.contactName || "").trim()) {
        throw new Error("Assignee name is required");
      }
      if (!String(assetData.contactEmail || "").trim()) {
        throw new Error("Assignee email is required");
      }
      await assertSavedEmployeeProfile(assetData, existingAsset);
    }
  }

  if (isSoftware && !String(assetData.assetCode || "").trim()) {
    throw new Error("Software code is required");
  }

  const purchaseErr = validateNewPurchaseRequirements({
    condition: String(assetData.condition || ""),
    invoiceNumber: String(assetData.invoiceNumber || ""),
    documentUrl: String(assetData.documentUrl || ""),
  });
  if (purchaseErr) throw new Error(purchaseErr);
}

async function prepareAssetPayload(
  assetData: Record<string, unknown>,
  existingAsset?: { employeeId?: string; contactEmail?: string; assignedDate?: string }
): Promise<Record<string, unknown>> {
  const fieldHealed = healMisalignedAssetFields(assetData) as Record<string, unknown>;
  const healed = healMisalignedCategoryFields({
    mainCategory: String(fieldHealed.mainCategory || ""),
    subCategory: String(fieldHealed.subCategory || ""),
    assetType: String(fieldHealed.assetType || ""),
    make: String(fieldHealed.make || ""),
    assetCode: String(fieldHealed.assetCode || ""),
  });
  assetData = { ...fieldHealed, ...healed };
  assetData.mainCategory = healed.mainCategory;
  if (healed.assetType) assetData.assetType = healed.assetType;
  if (healed.subCategory) {
    assetData.subCategory = healed.subCategory;
  } else if (healed.mainCategory === "IT Assets" && healed.assetType) {
    assetData.subCategory = subCategoryForItAssetType(healed.assetType);
  }

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
  ensureAssignedDate(mapped, existingAsset);
  await validateAssetPayload(mapped, existingAsset);
  return mapped;
}

const ALWAYS_PRESERVE_ASSET_EDIT_FIELDS = [
  "location",
  "plantCode",
  "department",
  "make",
  "model",
  "serialNumber",
  "assetCode",
  "accountAssetCode",
  "vendorName",
  "warrantyStartDate",
  "warrantyEndDate",
  "contactName",
  "contactEmail",
  "contactMobile",
  "documentUrl",
  "imageUrl",
  "assetName",
  "mainCategory",
  "subCategory",
  "quantity",
  "employeeId",
  "purchaseDate",
  "purchaseCost",
  "invoiceNumber",
  "condition",
  "status",
  "maintenanceRequired",
  "lastMaintenanceDate",
  "nextMaintenanceDate",
  "createdBy",
  "createdDate",
  "extraItems",
  "missingItems",
  "assignedDate",
  "returnDate",
  "amcVendor",
  "amcStartDate",
  "amcEndDate",
  "amcCost",
];

const TYPE_SPECIFIC_PRESERVE_ASSET_EDIT_FIELDS = [
  "ram",
  "ssd",
  "cpu",
  "windowsVersion",
  "macAddress",
  "ipAddress",
  "hostName",
  "monitorSerial",
  "monitorAssetCode",
  "keyboardSerial",
  "keyboardAssetCode",
  "mouseSerial",
  "mouseAssetCode",
  "upsSerial",
  "upsAssetCode",
  "additionalItems",
  "assetType",
  "assetTypeId",
];

function isBlankValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return String(value).trim() === "";
}

function sameAssetEditShape(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  return ["mainCategory", "subCategory", "assetType", "assetTypeId"].every((key) => {
    const next = String(incoming[key] || "").trim().toLowerCase();
    const prev = String(existing[key] || "").trim().toLowerCase();
    return !next || !prev || next === prev;
  });
}

function mergeAssetEditPayload(
  incoming: Record<string, unknown>,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  if (!existing) return incoming;
  const merged = { ...incoming };
  const hadAssignee =
    !isBlankValue(existing.employeeId) ||
    !isBlankValue(existing.contactName) ||
    !isBlankValue(existing.contactEmail) ||
    !isBlankValue(existing.contactMobile);
  const clearedAssignee =
    hadAssignee &&
    isBlankValue(merged.employeeId) &&
    isBlankValue(merged.contactName) &&
    isBlankValue(merged.contactEmail) &&
    isBlankValue(merged.contactMobile);
  const preserveKeys = sameAssetEditShape(merged, existing)
    ? [...ALWAYS_PRESERVE_ASSET_EDIT_FIELDS, ...TYPE_SPECIFIC_PRESERVE_ASSET_EDIT_FIELDS]
    : ALWAYS_PRESERVE_ASSET_EDIT_FIELDS;

  for (const key of preserveKeys) {
    if (
      clearedAssignee &&
      ["employeeId", "contactName", "contactEmail", "contactMobile", "assignedDate"].includes(key)
    ) {
      continue;
    }
    if (isBlankValue(merged[key]) && !isBlankValue(existing[key])) {
      merged[key] = existing[key];
    }
  }

  if (clearedAssignee) {
    merged.employeeId = "";
    merged.contactName = "";
    merged.contactEmail = "";
    merged.contactMobile = "";
    merged.assignedDate = "";
    merged.status = "Available";
  }

  if (
    sameAssetEditShape(merged, existing) &&
    isBlankValue(merged.dynamicDetails) &&
    !isBlankValue(existing.dynamicDetails)
  ) {
    merged.dynamicDetails = existing.dynamicDetails;
  }

  return merged;
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
    if (!isIT) {
    assetData.macAddress = "";
    assetData.ipAddress = "";
    assetData.hostName = "";
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

function buildMasterAssetRow(assetData: any, existingMasterRow?: string[]) {
  const masterHeaders = getDefaultAssetHeaders();
  return buildAssetRow(masterHeaders, assetData, existingMasterRow);
}

function sheetRowToMasterRow(sheetHeaders: string[], sheetRow: string[]): string[] {
  const masterHeaders = getDefaultAssetHeaders();
  return mapMasterRowToSheetHeaders(masterHeaders, sheetHeaders, sheetRow);
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
  setVal(["Account Asset Code"], assetData.accountAssetCode || "");
  setVal(["Asset Name"], assetData.assetName || assetData.model || "");
  setVal(["Main Category"], assetData.mainCategory || "IT Assets");
  const subCategory =
    assetData.subCategory ||
    (["Laptop", "Desktop"].includes(String(assetData.assetType || "").trim())
      ? "Laptop / Desktop"
      : ["Camera", "NVR"].includes(String(assetData.assetType || "").trim())
        ? "CCTV / Security Device"
        : "") ||
    "Other IT Asset";
  setVal(["Sub Category"], subCategory);
  setVal(["Asset Type", "Type"], assetData.assetType || "");
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
  setVal(["Assigned Date"], assetData.assignedDate || "");
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
  setVal(["IP Address"], assetData.ipAddress || "");
  setVal(["Host Name", "Hostname"], assetData.hostName || "");
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

  // Ensure row length matches headers array (canonical order)
  while (row.length < headers.length) row.push("");

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
    "Sub Category": assetData.subCategory ||
      (["Camera", "NVR"].includes(String(assetData.assetType || "").trim())
        ? "CCTV / Security Device"
        : assetData.assetType || ""),
    "Asset Type": assetData.assetType || "Laptop",
    "Asset Name": assetData.assetName || assetData.model || "",
    "Brand": assetData.make || "",
    "Model": assetData.model || "",
    "Serial Number": serial,
    "Vehicle Number": vehicleNo,
    "Asset Code": assetData.assetCode || assetId,
    "Account Asset Code": assetData.accountAssetCode || "",
    "MAC Address": assetData.macAddress || "",
    "IP Address": assetData.ipAddress || "",
    "Host Name": assetData.hostName || "",
    "RAM": assetData.ram || "",
    "SSD": assetData.ssd || "",
    "CPU": assetData.cpu || "",
    "Windows Version": assetData.windowsVersion || "",
    "Monitor Serial": assetData.monitorSerial || "",
    "Monitor Asset Code": assetData.monitorAssetCode || "",
    "Keyboard Serial": assetData.keyboardSerial || "",
    "Keyboard Asset Code": assetData.keyboardAssetCode || "",
    "Mouse Serial": assetData.mouseSerial || "",
    "Mouse Asset Code": assetData.mouseAssetCode || "",
    "UPS Serial": assetData.upsSerial || "",
    "UPS Asset Code": assetData.upsAssetCode || "",
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

    res.setHeader("X-AMS-Cache", fromCache ? "hit" : "miss");
    res.setHeader("X-AMS-Syncing", syncing || meta.syncing ? "1" : "0");
    res.setHeader("X-AMS-User-Count", String(users.length));
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
      usersSheetGid: USERS_SHEET_GID_VALID,
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }

    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : [user];
    res.json({ success: true, user, users: synced, savedTo: sheetSave.via });
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
      usersSheetGid: USERS_SHEET_GID_VALID,
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }

    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : data.users;
    res.json({ success: true, user, users: synced, savedTo: sheetSave.via });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

app.delete("/api/users/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const data = readAppData();
    const target = data.users.find((u) => u.email === email);
    if (target && !canDeleteUserRecord(target)) {
      return res.status(403).json({ error: "IT Admin users cannot be deleted" });
    }

    const sheetSave = await persistUserToSheet(
      "delete_user",
      { email, role: "User", locations: [], plants: [] },
      { proxyToGas, spreadsheetId: SPREADSHEET_ID, usersSheetGid: USERS_SHEET_GID_VALID },
      email
    );
    if (!sheetSave.ok && sheetSave.error !== "User not found" && sheetSave.error !== "User does not exist") {
      return res.status(500).json({ error: sheetSave.error });
    }

    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : [];
    res.json({ success: true, users: synced, savedTo: sheetSave.via });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const data = readAppData();
    const force = req.query.refresh === "1";
    const includeRemoteOptions = req.query.options === "1" || force;

    if (force && GAS_WEBAPP_URL) {
      try {
        await refreshAssetsNow(GAS_WEBAPP_URL);
      } catch (err) {
        console.warn("[AMS] Failed to force refresh assets on settings load:", err);
      }
    }

    const CACHE_KEY = "locations_plants";
    const cacheAge = 10 * 60 * 1000; // 10 minutes cache
    let cached = force ? null : readCache<{ locations: string[]; plants: any[] }>(CACHE_KEY, cacheAge);

    if (!cached && GAS_WEBAPP_URL) {
      const fromGas = await fetchLocationsPlantsFromGas(proxyToGas, GAS_WEBAPP_URL);
      if (fromGas && fromGas.locations.length > 0) {
        data.settings.locations = fromGas.locations;
        data.settings.plants = fromGas.plants;
        writeAppData(data);
        writeCache(CACHE_KEY, { locations: fromGas.locations, plants: fromGas.plants });
      } else {
        const stale = readCacheStale<{ locations: string[]; plants: any[] }>(CACHE_KEY);
        if (stale && stale.locations.length > 0) {
          data.settings.locations = stale.locations;
          data.settings.plants = stale.plants;
        }
      }
    } else if (cached) {
      data.settings.locations = cached.locations;
      data.settings.plants = cached.plants;
    }

    data.settings.catalog = mergeCatalog(data.settings.catalog);

    // Fetch custom options from Google Sheets to merge into local catalog (with 5-minute cache)
    const OPTIONS_CACHE_KEY = "gas_options";
    const optionsCacheAge = 5 * 60 * 1000; // 5 minutes cache
    let gasOpts = force ? null : readCache<Record<string, string[]>>(OPTIONS_CACHE_KEY, optionsCacheAge);

    if (!gasOpts && GAS_WEBAPP_URL && includeRemoteOptions) {
      try {
        const gasResult = await gasGet(GAS_WEBAPP_URL, { type: "options" }) as { success?: boolean; options?: Record<string, string[]> };
        if (gasResult && gasResult.success && gasResult.options) {
          gasOpts = gasResult.options;
          writeCache(OPTIONS_CACHE_KEY, gasOpts);
        }
      } catch (err) {
        console.warn("[AMS] Failed to fetch settings options from GAS:", err);
      }
    }

    if (gasOpts) {
      try {
        if (!data.settings.catalog) {
          data.settings.catalog = { brands: {}, vendors: [], departments: [] };
        }
        const cat = data.settings.catalog;
          
          // 1. Merge Departments
          if (Array.isArray(gasOpts.departments)) {
            cat.departments = Array.from(new Set([...(cat.departments || []), ...gasOpts.departments]));
          }
          // 2. Merge Vendors
          if (Array.isArray(gasOpts.vendors)) {
            cat.vendors = Array.from(new Set([...(cat.vendors || []), ...gasOpts.vendors]));
          }
          // 3. Merge Brands
          if (Array.isArray(gasOpts.brands)) {
            for (const b of gasOpts.brands) {
              if (!cat.brands[b]) cat.brands[b] = [];
            }
          }
          // 4. Merge Models (format: Brand:Model)
          if (Array.isArray(gasOpts.models)) {
            for (const item of gasOpts.models) {
              const parts = item.split(":");
              if (parts.length >= 2) {
                const b = parts[0];
                const m = parts.slice(1).join(":");
                if (!cat.brands[b]) cat.brands[b] = [];
                if (!cat.brands[b].includes(m)) {
                  cat.brands[b].push(m);
                }
              }
            }
          }
          // 5. Merge RAM, SSD, CPU, windowsVersion, licenseTypes
          const dynamicFields = ["ram", "ssd", "cpu", "windowsVersion", "licenseTypes"] as const;
          for (const field of dynamicFields) {
            if (Array.isArray(gasOpts[field])) {
              cat[field] = Array.from(new Set([...(cat[field] || []), ...gasOpts[field]]));
            }
          }
        } catch (err) {
          console.warn("[AMS] Failed to fetch settings options from GAS:", err);
        }
      }

    // Also inject departments from the live employees list so they never disappear
    try {
      const liveEmployees = readEmployees();
      const empDepts = liveEmployees
        .map((e: any) => String(e.department || "").trim())
        .filter(Boolean);
      if (empDepts.length > 0) {
        const existing: string[] = data.settings.catalog?.departments || [];
        data.settings.catalog.departments = Array.from(
          new Set([...existing, ...empDepts])
        ).sort();
      }
    } catch (_) { /* silent */ }

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

    // Only update locations/plants if they are explicitly sent in the payload (non-empty body keys)
    const hasIncomingLocations = Array.isArray(incoming.locations);
    const hasIncomingPlants = Array.isArray(incoming.plants);

    const locations = hasIncomingLocations ? incoming.locations! : data.settings.locations;
    const plants = hasIncomingPlants ? incoming.plants! : data.settings.plants;

    // Sync newly added catalog options back to Google Sheets
    if (GAS_WEBAPP_URL && incoming.catalog) {
      try {
        const current = data.settings.catalog || { brands: {}, vendors: [], departments: [] };
        const incomingCat = incoming.catalog;
        
        const syncOption = async (type: string, value: string) => {
          await proxyToGas({ action: "add_option", type, value }).catch(() => {});
        };

        // 1. Sync Departments
        if (Array.isArray(incomingCat.departments)) {
          for (const dept of incomingCat.departments) {
            if (!current.departments?.includes(dept)) {
              void syncOption("departments", dept);
            }
          }
        }
        // 2. Sync Vendors
        if (Array.isArray(incomingCat.vendors)) {
          for (const v of incomingCat.vendors) {
            if (!current.vendors?.includes(v)) {
              void syncOption("vendors", v);
            }
          }
        }
        // 3. Sync Brands & Models
        if (incomingCat.brands && typeof incomingCat.brands === "object") {
          for (const [brand, models] of Object.entries(incomingCat.brands)) {
            if (!current.brands[brand]) {
              void syncOption("brands", brand);
            }
            if (Array.isArray(models)) {
              const existingModels = current.brands[brand] || [];
              for (const m of models) {
                if (!existingModels.includes(m)) {
                  void syncOption("models", `${brand}:${m}`);
                }
              }
            }
          }
        }
        // 4. Sync Dynamic Attributes
        const fields = ["ram", "ssd", "cpu", "windowsVersion", "licenseTypes"] as const;
        for (const field of fields) {
          if (Array.isArray(incomingCat[field])) {
            for (const val of incomingCat[field]) {
              if (!current[field]?.includes(val)) {
                void syncOption(field, val);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[AMS] Failed to sync new catalog options to GAS:", err);
      }
    }

    data.settings = {
      locations,
      plants,
      assetFields: Array.isArray(incoming.assetFields)
        ? incoming.assetFields
        : data.settings.assetFields,
      catalog: mergeCatalog(
        incoming.catalog && typeof incoming.catalog === "object"
          ? incoming.catalog
          : data.settings.catalog
      ),
      typeDefinitions:
        incoming.typeDefinitions && typeof incoming.typeDefinitions === "object"
          ? incoming.typeDefinitions
          : data.settings.typeDefinitions,
      dbMode: data.settings.dbMode,
    };
    writeAppData(data);
    writeCache("locations_plants", { locations: data.settings.locations, plants: data.settings.plants });
    writeCache("gas_options", null); // Clear options cache to force fresh pull on next GET

    let sheetWarning: string | undefined;
    if (syncSheet && GAS_WEBAPP_URL && (hasIncomingLocations || hasIncomingPlants)) {
      const gas = await persistLocationsPlantsToGas(
        { locations, plants },
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
    const assetEid = normalizeEmployeeId(a.employeeId);
    if (assetEid) {
      return assetEid === eid;
    }
    if (email && normalizeEmail(a.contactEmail) === email) return true;
    if (name && String(a.contactName || "").trim().toLowerCase() === name) return true;
    return false;
  }).length;
}

app.get("/api/employees", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let list = readEmployees();
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || shouldRefreshSheetBackedData(force, list.length)) {
      list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
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
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || list.length === 0 || employeeId) {
      try {
        list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
      } catch {
        /* use local cache */
      }
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
    if (!employee && (GAS_WEBAPP_URL || SPREADSHEET_ID)) {
      list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
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
    res.json({ history: normalizeHistoryForUi(getHistoryByEmployeeId(eid)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load history" });
  }
});

app.get("/api/assets/:id/history", async (req, res) => {
  try {
    if (GAS_WEBAPP_URL) {
      await fetchHistoryFromGas(proxyToGas);
    }
    const raw = getHistoryByAssetId(req.params.id);
    res.json({ history: normalizeHistoryForUi(raw) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load history" });
  }
});

app.delete("/api/assignment-history/:id", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole(user.role)) {
      return res.status(403).json({ error: "Only IT Admin can delete assignment history." });
    }

    const historyId = decodeURIComponent(req.params.id).trim();
    const existsLocal = readAssignmentHistory().some((h) => String(h.id || "").trim() === historyId);

    let sheetWarning: string | undefined;
    const hasRemote = Boolean(GAS_WEBAPP_URL || SPREADSHEET_ID);
    if (hasRemote) {
      const remote = await deleteHistoryEntryRemote(
        historyId,
        GAS_WEBAPP_URL ? proxyToGas : null,
        SPREADSHEET_ID,
        Boolean(GAS_WEBAPP_URL)
      );
      if (!remote.ok) {
        if (remote.notFound && existsLocal) {
          sheetWarning = "Record was not on Google Sheet; removed from app only.";
        } else if (!existsLocal) {
          return res.status(remote.notFound ? 404 : 500).json({
            error: remote.error || "Failed to delete from Google Sheet",
          });
        } else {
          sheetWarning = remote.error || "Could not delete from Google Sheet";
        }
      }
    }

    const removed = deleteAssignmentHistoryEntry(historyId);
    if (!removed && !existsLocal) {
      return res.status(404).json({ error: "Assignment history record not found" });
    }

    res.json({ success: true, sheetWarning });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete assignment history" });
  }
});

app.post("/api/employees", async (req, res) => {
  try {
    const body = req.body as Employee & { syncSheet?: boolean };
    body.phone = String(body.phone || "").replace(/\D/g, "").slice(0, 10);
    const validationError = validateEmployeePayload(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const list = await loadEmployeesWithSheetSync();
    const existing = findEmployeeById(list, body.employeeId);
    if (existing) {
      return res.json({ success: true, employee: existing, alreadyExists: true });
    }

    const saved = createEmployee(body);
    let sheetWarning: string | undefined;
    if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
      const gas = await persistEmployeeToGas("add", saved, proxyToGas, SPREADSHEET_ID);
      if (!gas.ok) {
        deleteEmployee(saved.employeeId);
        if (isEmployeeIdExistsError(gas.error)) {
          const refreshed = await loadEmployeesWithSheetSync();
          const existingAfterSync = findEmployeeById(refreshed, saved.employeeId);
          if (existingAfterSync) {
            return res.json({ success: true, employee: existingAfterSync, alreadyExists: true });
          }
          return res.json({ success: true, employee: saved, alreadyExists: true });
        }
        return res.status(502).json({ error: gas.error || "Database sync failed; employee was not saved locally." });
      }
    }
    res.json({ success: true, employee: saved, sheetWarning });
  } catch (error: any) {
    const message = error.message || "Failed to save employee";
    const status =
      message === EMPLOYEE_ID_EXISTS_MESSAGE || isEmployeeIdExistsError(message) ? 409 : 400;
    res.status(status).json({ error: isEmployeeIdExistsError(message) ? EMPLOYEE_ID_EXISTS_MESSAGE : message });
  }
});

app.put("/api/employees/:employeeId", async (req, res) => {
  try {
    const body = { ...req.body, employeeId: decodeURIComponent(req.params.employeeId) } as Employee & {
      syncSheet?: boolean;
    };
    body.phone = String(body.phone || "").replace(/\D/g, "").slice(0, 10);
    const validationError = validateEmployeePayload(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    let list = readEmployees();
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
    }
    if (!findEmployeeById(list, body.employeeId)) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const beforeUpdate = readEmployees();
    const saved = updateEmployee(body);
    let sheetWarning: string | undefined;
    if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
      const gas = await persistEmployeeToGas("update", saved, proxyToGas, SPREADSHEET_ID);
      if (!gas.ok) {
        writeEmployees(beforeUpdate);
        return res.status(502).json({ error: gas.error || "Database sync failed; employee update was reverted locally." });
      }
    }
    res.json({ success: true, employee: saved, sheetWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update employee" });
  }
});

app.delete("/api/employees/:employeeId", async (req, res) => {
  try {
    const requestUser = resolveRequestUser(req);
    if (!requestUser || !isItAdminRole(requestUser.role)) {
      return res.status(403).json({ error: "Only IT Admin is authorized to delete employee profiles." });
    }
    const eid = decodeURIComponent(req.params.employeeId);
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || shouldRefreshSheetBackedData(false, readEmployees().length)) {
      await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
    }
    if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
      const gas = await persistEmployeeToGas(
        "delete",
        { employeeId: eid, name: "", email: "", phone: "", department: "", location: "", designation: "", plant: "", status: "Inactive" },
        proxyToGas,
        SPREADSHEET_ID
      );
      if (!gas.ok) {
        return res.status(502).json({ error: gas.error || "Database delete failed; employee was not deleted locally." });
      }
    }
    if (!deleteEmployee(eid)) return res.status(404).json({ error: "Employee not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete employee" });
  }
});

app.get("/api/inventory", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let list = readInventory();
    if (shouldRefreshSheetBackedData(force, list.length)) {
      list = await fetchInventoryFromGas(proxyToGas);
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load inventory" });
  }
});

app.post("/api/inventory", async (req, res) => {
  try {
    const previousInventory = readInventory();
    const body = req.body as any;
    if (!String(body.itemName || "").trim()) {
      return res.status(400).json({ error: "Item Name is required" });
    }
    const saved = upsertInventoryItem(body);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save inventory item" });
  }
});

app.put("/api/inventory/:itemId", async (req, res) => {
  try {
    const previousInventory = readInventory();
    const body = { ...req.body, itemId: decodeURIComponent(req.params.itemId) } as any;
    const saved = upsertInventoryItem(body);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update inventory item" });
  }
});

app.delete("/api/inventory/:itemId", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.itemId);
    if (shouldRefreshSheetBackedData(false, readInventory().length)) {
      await fetchInventoryFromGas(proxyToGas);
    }
    const previousInventory = readInventory();
    if (!deleteInventoryItem(id)) return res.status(404).json({ error: "Inventory item not found" });
    if (GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas(
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
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete inventory item" });
  }
});

app.post("/api/inventory/:itemId/assign", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const { employeeId, employeeName, employeeEmail, employeeMobile, department, location, updatedBy } = req.body;
    if (!employeeId) return res.status(400).json({ error: "Employee ID is required" });

    // Find inventory item
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find(i => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });

    if (item.status !== "Available") {
      return res.status(400).json({ error: "Only Available inventory items can be assigned" });
    }

    // Check if it's an individual asset (has assetCode or maps to a parent physical asset)
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);

    if (parentAsset) {
      // Update physical asset -> this will automatically sync to inventory!
      const assetData = {
        ...parentAsset,
        status: "Assigned",
        employeeId,
        contactName: employeeName,
        contactEmail: employeeEmail,
        contactMobile: employeeMobile || "",
        department: department || "",
        location: location || parentAsset.location || "Store",
        updatedBy: updatedBy || "System",
        updatedDate: new Date().toISOString(),
      };

      // Save parent asset
      const dbMode = readAppData().settings.dbMode;
      let result;
      if (dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, String(parentAsset.id), String(parentAsset.qrCodeText ?? ""));
        result = await proxyToGas({ action: "update_asset_redesigned", id: parentAsset.id, row });
        const masterHeaders = getDefaultAssetHeaders();
        const sqliteRow = buildMasterAssetRow(assetData);
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), sqliteRow, masterHeaders);
      } else {
        const sheet = await fetchSheetData();
        const sheetHeaders = sheet[0] as string[];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex((h: string) =>
          ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex((row: any[]) =>
          String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId
        );
        if (rowIndex === -1) throw new Error("Asset not found in Google Sheet");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
        const updatedRow = buildMasterAssetRow(assetData, existingMaster);
        const masterHeaders = getDefaultAssetHeaders();
        result = await proxyToGas({ action: "update", id: parentAsset.id, row: updatedRow, rowIndex: rowIndex + 2 });
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), updatedRow, masterHeaders);
      }

      if (result && result.error) throw new Error(result.error);

      const updatedAsset = mapSheetRow({
        ...assetData,
        id: String(parentAsset.id),
        "S No": parentAsset.id,
        "Asset ID": parentAsset.id,
        "QR Code / Barcode": parentAsset.qrCodeText,
      });
      upsertAssetInCache(updatedAsset);

      // Record assignment change history
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: parentAsset.employeeId || "",
          contactName: parentAsset.contactName || "",
          contactEmail: parentAsset.contactEmail || "",
          status: parentAsset.status || "",
        },
        next: {
          employeeId,
          contactName: employeeName,
          contactEmail: employeeEmail,
          status: "Assigned",
        },
        assignedBy: updatedBy || "System",
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }

      res.json({ success: true, message: "Asset assigned successfully" });
    } else {
      // Bulk Asset assignment
      const availableQuantity = item.quantity;
      if (availableQuantity <= 0) return res.status(400).json({ error: "Item is out of stock" });

      if (availableQuantity === 1) {
        const updatedItem = {
          ...item,
          status: "Assigned" as const,
          employeeId,
          assigneeName: employeeName,
          assigneeEmail: employeeEmail,
          assigneeMobile: employeeMobile || "",
          updatedAt: new Date().toISOString(),
        };
        upsertInventoryItem(updatedItem);
      } else {
        const updatedAvailable = {
          ...item,
          quantity: availableQuantity - 1,
          updatedAt: new Date().toISOString(),
        };
        upsertInventoryItem(updatedAvailable);

        const assignedItem = {
          itemId: "INV_" + Date.now() + "_" + Math.floor(Math.random() * 100),
          assetCode: "",
          itemName: item.itemName,
          brandName: item.brandName,
          model: item.model,
          serialNumber: item.serialNumber,
          category: item.category,
          status: "Assigned" as const,
          quantity: 1,
          minStock: 0,
          employeeId,
          assigneeName: employeeName,
          assigneeEmail: employeeEmail,
          assigneeMobile: employeeMobile || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        upsertInventoryItem(assignedItem);
      }

      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory assignment was not saved locally."
      );

      res.json({ success: true, message: "Inventory item assigned successfully" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to assign item" });
  }
});

app.post("/api/inventory/:itemId/return", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const remarks = req.body.remarks || "Asset returned / unassigned";
    const updatedBy = req.body.updatedBy || "System";

    // Find inventory item
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find(i => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });

    // Check if it maps to a parent physical asset
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);

    if (parentAsset) {
      // Return parent asset (status: Available, Location: Store, clear employee fields)
      const assetData = {
        ...parentAsset,
        status: "Available",
        location: "Store",
        employeeId: "",
        contactName: "",
        contactEmail: "",
        contactMobile: "",
        department: "",
        updatedBy,
        updatedDate: new Date().toISOString(),
      };

      // Save parent asset
      const dbMode = readAppData().settings.dbMode;
      let result;
      if (dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, String(parentAsset.id), String(parentAsset.qrCodeText ?? ""));
        result = await proxyToGas({ action: "update_asset_redesigned", id: parentAsset.id, row });
        const masterHeaders = getDefaultAssetHeaders();
        const sqliteRow = buildMasterAssetRow(assetData);
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), sqliteRow, masterHeaders);
      } else {
        const sheet = await fetchSheetData();
        const sheetHeaders = sheet[0] as string[];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex((h: string) =>
          ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex((row: any[]) =>
          String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId
        );
        if (rowIndex === -1) throw new Error("Asset not found in Google Sheet");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
        const updatedRow = buildMasterAssetRow(assetData, existingMaster);
        const masterHeaders = getDefaultAssetHeaders();
        result = await proxyToGas({ action: "update", id: parentAsset.id, row: updatedRow, rowIndex: rowIndex + 2 });
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), updatedRow, masterHeaders);
      }

      if (result && result.error) throw new Error(result.error);

      const updatedAsset = mapSheetRow({
        ...assetData,
        id: String(parentAsset.id),
        "S No": parentAsset.id,
        "Asset ID": parentAsset.id,
        "QR Code / Barcode": parentAsset.qrCodeText,
      });
      upsertAssetInCache(updatedAsset);

      // Record return history
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: parentAsset.employeeId || "",
          contactName: parentAsset.contactName || "",
          contactEmail: parentAsset.contactEmail || "",
          status: parentAsset.status || "",
        },
        next: {
          employeeId: "",
          contactName: "",
          contactEmail: "",
          status: "Available",
        },
        assignedBy: updatedBy,
        remarks,
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }

      res.json({ success: true, message: "Asset returned successfully" });
    } else {
      // Bulk Asset return
      const match = list.find(
        (i) =>
          i.itemName.toLowerCase() === item.itemName.toLowerCase() &&
          i.brandName.toLowerCase() === item.brandName.toLowerCase() &&
          i.model.toLowerCase() === item.model.toLowerCase() &&
          i.status === "Available"
      );

      if (match) {
        const updatedAvailable = {
          ...match,
          quantity: match.quantity + 1,
          updatedAt: new Date().toISOString(),
        };
        upsertInventoryItem(updatedAvailable);

        if (item.quantity <= 1) {
          deleteInventoryItem(item.itemId);
        } else {
          const updatedAssigned = {
            ...item,
            quantity: item.quantity - 1,
            updatedAt: new Date().toISOString(),
          };
          upsertInventoryItem(updatedAssigned);
        }
      } else {
        const updatedItem = {
          ...item,
          status: "Available" as const,
          employeeId: "",
          assigneeName: "",
          assigneeEmail: "",
          assigneeMobile: "",
          quantity: 1,
          updatedAt: new Date().toISOString(),
        };
        upsertInventoryItem(updatedItem);
      }

      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory return was not saved locally."
      );

      res.json({ success: true, message: "Inventory item returned successfully" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to return item" });
  }
});

app.post("/api/inventory/:itemId/transfer", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const { targetEmployeeId, remarks, updatedBy } = req.body;
    if (!targetEmployeeId) return res.status(400).json({ error: "Target Employee ID is required" });

    // Find target employee profile
    const employees = readEmployees();
    const targetEmp = employees.find(e => String(e.employeeId).trim() === String(targetEmployeeId).trim());
    if (!targetEmp) return res.status(404).json({ error: "Target employee not found" });

    // Find inventory item
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find(i => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });

    if (item.status !== "Assigned") {
      return res.status(400).json({ error: "Only Assigned items can be transferred" });
    }

    const sourceEmployeeId = item.employeeId;

    // Check if it maps to a parent physical asset
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);

    if (parentAsset) {
      // Transfer physical asset: update employee fields
      const assetData = {
        ...parentAsset,
        status: "Assigned",
        employeeId: targetEmp.employeeId,
        contactName: targetEmp.name,
        contactEmail: targetEmp.email,
        contactMobile: targetEmp.phone || "",
        department: targetEmp.department || "",
        updatedBy: updatedBy || "System",
        updatedDate: new Date().toISOString(),
      };

      // Save parent asset
      const dbMode = readAppData().settings.dbMode;
      let result;
      if (dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, String(parentAsset.id), String(parentAsset.qrCodeText ?? ""));
        result = await proxyToGas({ action: "update_asset_redesigned", id: parentAsset.id, row });
        const masterHeaders = getDefaultAssetHeaders();
        const sqliteRow = buildMasterAssetRow(assetData);
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), sqliteRow, masterHeaders);
      } else {
        const sheet = await fetchSheetData();
        const sheetHeaders = sheet[0] as string[];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex((h: string) =>
          ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex((row: any[]) =>
          String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId
        );
        if (rowIndex === -1) throw new Error("Asset not found in Google Sheet");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
        const updatedRow = buildMasterAssetRow(assetData, existingMaster);
        const masterHeaders = getDefaultAssetHeaders();
        result = await proxyToGas({ action: "update", id: parentAsset.id, row: updatedRow, rowIndex: rowIndex + 2 });
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), updatedRow, masterHeaders);
      }

      if (result && result.error) throw new Error(result.error);

      const updatedAsset = mapSheetRow({
        ...assetData,
        id: String(parentAsset.id),
        "S No": parentAsset.id,
        "Asset ID": parentAsset.id,
        "QR Code / Barcode": parentAsset.qrCodeText,
      });
      upsertAssetInCache(updatedAsset);

      // Record transfer history
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: sourceEmployeeId,
          contactName: item.assigneeName,
          contactEmail: item.assigneeEmail,
          status: "Assigned",
        },
        next: {
          employeeId: targetEmp.employeeId,
          contactName: targetEmp.name,
          contactEmail: targetEmp.email,
          status: "Assigned",
        },
        assignedBy: updatedBy || "System",
        remarks: remarks || `Transferred from employee ${sourceEmployeeId} to ${targetEmp.employeeId}`,
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }

      res.json({ success: true, message: "Asset transferred successfully" });
    } else {
      // Bulk Asset transfer
      const updatedItem = {
        ...item,
        employeeId: targetEmp.employeeId,
        assigneeName: targetEmp.name,
        assigneeEmail: targetEmp.email,
        assigneeMobile: targetEmp.phone || "",
        updatedAt: new Date().toISOString(),
      };
      upsertInventoryItem(updatedItem);
      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory transfer was not saved locally."
      );

      res.json({ success: true, message: "Inventory item transferred successfully" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to transfer item" });
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
  const assets = await getAssetsForOps();
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
    const result = await proxyToGas({ action: "setup" }, 120000);
    invalidateAssetCache();
    invalidateUsersCache();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/setup/redesigned", async (req, res) => {
  invalidateAssetCache();
  invalidateUsersCache();
  res.json({
    success: true,
    message: "Use a fresh spreadsheet with headers from gas/NEW_SHEET_ROW1_HEADERS.txt",
  });
});

app.post("/api/setup/redesigned-fresh", async (req, res) => {
  invalidateAssetCache();
  invalidateUsersCache();
  res.json({
    success: true,
    message: "Fresh sheet: paste WebApp.gs, set GAS_WEBAPP_URL and SPREADSHEET_ID in .env",
  });
});

function getMissingItemMainCategory(assetType: string): string {
  if (!assetType) return 'IT Assets';
  const itTypes = ['Laptop', 'Desktop', ...PERIPHERAL_TYPES];
  if (itTypes.includes(assetType)) {
    return 'IT Assets';
  }
  if (SUB_TO_MAIN_MAP[assetType]) {
    return SUB_TO_MAIN_MAP[assetType];
  }
  const itSub = subCategoryForItAssetType(assetType);
  if (SUB_TO_MAIN_MAP[itSub]) {
    return SUB_TO_MAIN_MAP[itSub];
  }
  return 'IT Assets';
}

function assertSheetSyncOk(
  result: { ok: boolean; error?: string },
  rollback: () => void,
  fallbackMessage = "Database sync failed"
) {
  if (result.ok) return;
  rollback();
  throw new Error(result.error || fallbackMessage);
}

async function assertInventorySnapshotSynced(
  previousInventory: import("./src/types/inventory.js").InventoryItem[],
  fallbackMessage: string
) {
  if (!GAS_WEBAPP_URL) return;
  const gas = await replaceInventoryInGas(readInventory(), proxyToGas);
  assertSheetSyncOk(gas, () => writeInventory(previousInventory), fallbackMessage);
}

function normalizeAssetLookupId(value: unknown): string {
  return String(value ?? "").replace(/^0+/, "").trim().toLowerCase();
}

function findMappedAssetByAnyId(assets: MappedAsset[], lookupId: unknown): MappedAsset | undefined {
  const target = normalizeAssetLookupId(lookupId);
  if (!target) return undefined;
  return assets.find((asset) =>
    [
      asset.id,
      asset.assetCode,
      asset.uniqueCode,
      asset.serialNumber,
      getCanonicalScanId(asset),
    ].some((candidate) => normalizeAssetLookupId(candidate) === target)
  );
}

app.post("/api/missing-items/:recordId/deassign", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const previousInventory = readInventory();
    const recordId = decodeURIComponent(req.params.recordId);
    let list = readMissingItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchMissingItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    // Update missing item status to Deassigned
    const updatedMissing = {
      ...existing,
      Status: "Deassigned" as const,
      Remarks: String(existing.Remarks || "") + " (Deassigned to stock inventory)",
    };
    const savedMissing = upsertMissingItem(updatedMissing);

    // Sync to Inventory as Available
    const inventoryList = readInventory();
    const name = existing["Missing Item Name"];
    const brand = existing.Brand || "";
    const model = existing.Model || "";
    const category = getMissingItemMainCategory(existing["Asset Type"] || name);

    // Try to find matching available inventory item to increment quantity
    const match = inventoryList.find(
      (item) =>
        item.itemName.toLowerCase() === name.toLowerCase() &&
        item.brandName.toLowerCase() === brand.toLowerCase() &&
        item.model.toLowerCase() === model.toLowerCase() &&
        item.status === "Available"
    );

    let savedInventory;
    let inventoryOp: "add" | "update" = "add";
    if (match) {
      savedInventory = upsertInventoryItem({
        ...match,
        quantity: match.quantity + 1,
      });
      inventoryOp = "update";
    } else {
      savedInventory = upsertInventoryItem({
        itemId: "INV_" + Date.now(),
        assetCode: "",
        itemName: name,
        brandName: brand,
        model: model,
        serialNumber: "",
        category: category,
        status: "Available",
        quantity: 1,
        minStock: 0,
      });
      inventoryOp = "add";
    }

    if (GAS_WEBAPP_URL) {
      const gasMissing = await persistMissingItemToGas("update", savedMissing, proxyToGas);
      assertSheetSyncOk(gasMissing, () => {
        writeMissingItems(previousMissingItems);
        writeInventory(previousInventory);
      });

      const gasInv = await persistInventoryToGas(inventoryOp, savedInventory, proxyToGas);
      assertSheetSyncOk(gasInv, () => {
        writeMissingItems(previousMissingItems);
        writeInventory(previousInventory);
      });
    }

    res.json({ success: true, item: savedMissing, inventoryItem: savedInventory });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to deassign missing item" });
  }
});

app.post("/api/missing-items/:recordId/reassign", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const previousInventory = readInventory();
    const recordId = decodeURIComponent(req.params.recordId);
    const employeeId = String(req.body.employeeId || "").trim();
    if (!employeeId) return res.status(400).json({ error: "Employee ID is required" });

    let list = readMissingItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchMissingItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    // Find employee
    const employees = readEmployees();
    const emp = employees.find((e) => String(e.employeeId).trim() === employeeId);
    if (!emp) return res.status(404).json({ error: `Employee not found with ID: ${employeeId}` });

    // Update missing item status to Reassigned, and update employee fields
    const updatedMissing = {
      ...existing,
      Status: "Reassigned" as const,
      "Employee ID": emp.employeeId,
      "Assigned Person": emp.name,
      Remarks: String(existing.Remarks || "") + ` (Reassigned to ${emp.name} [${emp.employeeId}])`,
    };
    const savedMissing = upsertMissingItem(updatedMissing);

    // Sync to Inventory as Assigned
    const name = existing["Missing Item Name"];
    const brand = existing.Brand || "";
    const model = existing.Model || "";
    const category = getMissingItemMainCategory(existing["Asset Type"] || name);

    const savedInventory = upsertInventoryItem({
      itemId: "INV_" + Date.now(),
      assetCode: "",
      itemName: name,
      brandName: brand,
      model: model,
      serialNumber: "",
      category: category,
      status: "Assigned",
      quantity: 1,
      minStock: 0,
      employeeId: emp.employeeId,
      assigneeName: emp.name,
      assigneeEmail: emp.email,
      assigneeMobile: emp.phone || "",
    });

    if (GAS_WEBAPP_URL) {
      const gasMissing = await persistMissingItemToGas("update", savedMissing, proxyToGas);
      assertSheetSyncOk(gasMissing, () => {
        writeMissingItems(previousMissingItems);
        writeInventory(previousInventory);
      });

      const gasInv = await persistInventoryToGas("add", savedInventory, proxyToGas);
      assertSheetSyncOk(gasInv, () => {
        writeMissingItems(previousMissingItems);
        writeInventory(previousInventory);
      });
    }

    res.json({ success: true, item: savedMissing, inventoryItem: savedInventory });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reassign missing item" });
  }
});

app.get("/api/missing-items", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let items = readMissingItems();
    if (shouldRefreshSheetBackedData(force, items.length)) {
      items = await fetchMissingItemsFromGas(proxyToGas);
    }
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load missing items" });
  }
});

app.post("/api/missing-items", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const body = req.body as { item: import("./src/types/redesigned.js").MissingItemRecord; syncSheet?: boolean };
    const raw = body.item || ({} as import("./src/types/redesigned.js").MissingItemRecord);
    const assetType = String(raw["Asset Type"] || "").trim();
    const item: import("./src/types/redesigned.js").MissingItemRecord = {
      ...raw,
      "Missing Item Name": String(raw["Missing Item Name"] || "").trim() || assetType,
      "Asset Type": assetType || String(raw["Missing Item Name"] || "").trim(),
      "Parent Asset ID": String(raw["Parent Asset ID"] || "").trim(),
    };
    const saved = upsertMissingItem(item);

    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeMissingItems(previousMissingItems));
    }

    // Sync asset status: 'Missing' -> 'Lost', 'Recovered' -> 'Available'
    if (item["Parent Asset ID"]) {
      const assetStatus = item.Status === "Recovered" ? "Available" : "Lost";
      void syncAssetStatusUpdate(item["Parent Asset ID"], assetStatus, "System");
    }
    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save missing item" });
  }
});

app.post("/api/missing-items/:recordId/recover", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const recordId = decodeURIComponent(req.params.recordId);
    let list = readMissingItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchMissingItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });
    const saved = upsertMissingItem({
      ...existing,
      Status: "Recovered",
      "Recovered Date": new Date().toISOString(),
      "Recovered By": String(req.body?.recoveredBy || "System"),
    });

    if (GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeMissingItems(previousMissingItems));
    }

    // Sync parent asset status back to 'Available' upon recovery
    if (existing["Parent Asset ID"]) {
      void syncAssetStatusUpdate(existing["Parent Asset ID"], "Available", String(req.body?.recoveredBy || "System"));
    }

    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update" });
  }
});

app.delete("/api/missing-items/:recordId", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }

    const recordId = decodeURIComponent(req.params.recordId);
    let list = readMissingItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchMissingItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const deleted = deleteMissingItem(recordId);
    if (!deleted) return res.status(404).json({ error: "Record not found" });

    if (GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("delete", existing, proxyToGas);
      assertSheetSyncOk(gas, () => writeMissingItems(previousMissingItems));
    }

    // Revert parent asset status back to 'Available' upon log deletion
    if (existing["Parent Asset ID"]) {
      void syncAssetStatusUpdate(existing["Parent Asset ID"], "Available", user.email);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete" });
  }
});

async function syncAssetStatusUpdate(assetId: string, status: string, updatedBy = "System") {
  try {
    const assets = await getAssetsForOps();
    const existing = findMappedAssetByAnyId(assets, assetId);
    if (!existing) {
      console.warn(`[AMS] syncAssetStatusUpdate: Asset ID ${assetId} not found`);
      return;
    }
    const canonicalAssetId = String(existing.id || assetId);

    const assetData = {
      ...existing,
      status: status,
      updatedBy: updatedBy,
      updatedDate: new Date().toISOString(),
    };

    const dbMode = readAppData().settings.dbMode;
    let result;
    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, canonicalAssetId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalAssetId, row });

      const masterHeaders = getDefaultAssetHeaders();
      const sqliteRow = buildMasterAssetRow(assetData);
      await updateAssetLocal(String(assetData.mainCategory || "IT Assets"), canonicalAssetId, sqliteRow, masterHeaders);
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) throw new Error("Sheet has no data");

      const sheetHeaders = sheet[0] as string[];
      const rows = sheet.slice(1);
      const idCol = sheetHeaders.findIndex((h: string) =>
        ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val: any) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(canonicalAssetId);
      const rowIndex = rows.findIndex((row: any[]) =>
        normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId
      );
      if (rowIndex === -1) throw new Error("Asset not found in Google Sheet");

      const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
      const updatedRow = buildMasterAssetRow(assetData, existingMaster);
      const masterHeaders = getDefaultAssetHeaders();
      result = await proxyToGas({ action: "update", id: canonicalAssetId, row: updatedRow, rowIndex: rowIndex + 2 });

      await updateAssetLocal(String(assetData.mainCategory || "IT Assets"), canonicalAssetId, updatedRow, masterHeaders);
    }

    if (result.error) throw new Error(result.error);

    // Update Cache
    const updatedAsset = mapSheetRow({
      ...assetData,
      id: canonicalAssetId,
      "S No": canonicalAssetId,
      "Asset ID": canonicalAssetId,
      "QR Code / Barcode": assetData.qrCodeText,
    });
    upsertAssetInCache(updatedAsset);
    console.log(`[AMS] Dynamic status update for asset ${canonicalAssetId} to ${status} completed successfully.`);
  } catch (err: any) {
    console.error(`[AMS] Failed to automatically update asset status for ID ${assetId}:`, err);
  }
}

app.get("/api/damaged-items", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    let items = readDamagedItems();
    if (shouldRefreshSheetBackedData(force, items.length)) {
      items = await fetchDamagedItemsFromGas(proxyToGas);
    }
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load damaged items" });
  }
});

app.post("/api/damaged-items", async (req, res) => {
  try {
    const previousDamagedItems = readDamagedItems();
    const body = req.body as { item: import("./src/types/redesigned.js").DamagedItemRecord; syncSheet?: boolean };
    const saved = upsertDamagedItem(body.item);
    
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeDamagedItems(previousDamagedItems));
    }

    // Sync asset status: 'Scrapped' -> 'Scrap', 'Repaired' -> 'Available', others -> 'Damaged'
    const assetStatus = body.item.Status === "Scrapped" ? "Scrap" : body.item.Status === "Repaired" ? "Available" : "Damaged";
    void syncAssetStatusUpdate(body.item["Asset ID"], assetStatus, body.item["Reported By"] || "System");

    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save damaged item" });
  }
});

app.put("/api/damaged-items/:recordId", async (req, res) => {
  try {
    const previousDamagedItems = readDamagedItems();
    const recordId = decodeURIComponent(req.params.recordId);
    let list = readDamagedItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchDamagedItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const updated = {
      ...existing,
      ...req.body.item,
      "Record ID": recordId,
    };
    const saved = upsertDamagedItem(updated);

    if (GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeDamagedItems(previousDamagedItems));
    }

    // Sync asset status: 'Scrapped' -> 'Scrap', 'Repaired' -> 'Available', others -> 'Damaged' (skip for Deassigned / Reassigned)
    if (updated.Status !== "Deassigned" && updated.Status !== "Reassigned") {
      const assetStatus = updated.Status === "Scrapped" ? "Scrap" : updated.Status === "Repaired" ? "Available" : "Damaged";
      void syncAssetStatusUpdate(updated["Asset ID"], assetStatus, updated["Reported By"] || "System");
    }

    res.json({ success: true, item: saved });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update damaged item" });
  }
});

app.delete("/api/damaged-items/:recordId", async (req, res) => {
  try {
    const previousDamagedItems = readDamagedItems();
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }

    const recordId = decodeURIComponent(req.params.recordId);
    let list = readDamagedItems();
    if (shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchDamagedItemsFromGas(proxyToGas);
    }
    const existing = list.find((e) => e["Record ID"] === recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const deleted = deleteDamagedItem(recordId);
    if (!deleted) return res.status(404).json({ error: "Record not found" });

    if (GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("delete", existing, proxyToGas);
      assertSheetSyncOk(gas, () => writeDamagedItems(previousDamagedItems));
    }

    // When damage record is deleted, set asset back to 'Available'
    void syncAssetStatusUpdate(existing["Asset ID"], "Available", user.email);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete" });
  }
});

app.post("/api/assets", async (req, res) => {
  try {
    const assetData = await prepareAssetPayload(req.body as Record<string, unknown>);
    console.log("[AMS] POST /api/assets — received payload:", JSON.stringify({
      cpu: assetData.cpu,
      ram: assetData.ram,
      ssd: assetData.ssd,
      windowsVersion: assetData.windowsVersion,
      macAddress: assetData.macAddress,
      ipAddress: assetData.ipAddress,
      hostName: assetData.hostName,
      contactEmail: assetData.contactEmail,
      contactMobile: assetData.contactMobile,
      contactName: assetData.contactName,
      imageUrl: assetData.imageUrl,
      documentUrl: assetData.documentUrl,
    }));
    const assets = await getAssetsForOps();
    const mainCat = String(assetData.mainCategory || "IT Assets").trim();
    if (!isManualAssetCodeCategory(mainCat)) {
      const isCodeTaken = String(assetData.assetCode || "").trim() && 
        (assets.some(a => String(a.assetCode || "").trim().toLowerCase() === String(assetData.assetCode).trim().toLowerCase()) ||
         isSavingCode(String(assetData.assetCode)));
      if (!String(assetData.assetCode || "").trim() || isCodeTaken) {
        assetData.assetCode = generateAssetCode(assets, mainCat);
        console.log(`[AMS] Concurrency detected. Auto-assigned new code: ${assetData.assetCode}`);
      }
    }

    const savingCode = String(assetData.assetCode || "");
    registerSavingCode(savingCode);
    let reservedIdNum = 0; // will be set inside try after assetId is computed

    try {
      await assertAssetUnique(assetData);

    // Use generateNextAssetId so concurrent requests get unique IDs atomically
    const assetId = assetData.id?.toString() || generateNextAssetId(assets);
    reservedIdNum = parseInt(assetId, 10) || 0;
    // Stamp the resolved id onto the payload so the sheet row carries it and the
    // GAS backend does not auto-generate a different id (which would drift the
    // local cache vs sheet and cause dedupe/reconcile to drop the entry).
    assetData.id = assetId;
    assetData.uniqueCode =
      assetData.uniqueCode || assetData.assetCode || assetId;

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
    const masterHeaders = getDefaultAssetHeaders();
    let localCategory = String(assetData.mainCategory || "IT Assets");
    let localRow: string[];
    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, assetId, String(assetData.qrCodeText ?? ""));
      result = (await proxyToGas({ action: "add_asset_redesigned", row })) as any;
      localRow = buildMasterAssetRow(assetData);
    } else {
      const row = buildMasterAssetRow(assetData);
      logAssetMappingAudit("sheet-write-add", assetData as Record<string, unknown>, masterHeaders, row);
      console.log("[AMS] Sheet row payload (add):", row.length, "columns");
      result = (await proxyToGas({ action: "add", row })) as any;
      localRow = row;
    }

    if (result.error) throw new Error(result.error);

    const finalAssetId = result.id ? String(result.id) : assetId;
    const finalAssetCode = result.assetCode ? String(result.assetCode) : String(assetData.assetCode || "");

    if (finalAssetId !== assetId || finalAssetCode !== String(assetData.assetCode || "")) {
      console.log(`[AMS] Concurrency resolution: S No reassigned to ${finalAssetId}, Code reassigned to ${finalAssetCode}`);
      assetData.id = finalAssetId;
      assetData.assetCode = finalAssetCode;
      assetData.uniqueCode = assetData.uniqueCode === assetId || assetData.uniqueCode === String(assetData.assetCode || "")
        ? finalAssetId
        : assetData.uniqueCode;

      const baseUrl = getBaseUrl(req);
      const tempAsset = mapSheetRow({
        ...assetData,
        id: finalAssetId,
        "S No": finalAssetId,
        "Unique Code": assetData.uniqueCode,
      });
      assetData.qrCodeText = getScanUrl(baseUrl, tempAsset);
      localRow = buildMasterAssetRow(assetData);
    }

    await insertAssetLocal(localCategory, localRow, masterHeaders);
    releaseIssuedCode(localCategory, String(assetData.assetCode || ""));

    console.log("[AMS] POST /api/assets — response:", { id: finalAssetId, success: true });

    persistAssetDynamicDetails(finalAssetId, assetData).catch(err => {
      console.warn("[AMS] Background dynamic details sync failed:", err);
    });

    const hist = recordAssignmentChange({
      assetId: finalAssetId,
      previous: {},
      next: {
        employeeId: String(assetData.employeeId || ""),
        contactName: String(assetData.contactName || ""),
        contactEmail: String(assetData.contactEmail || ""),
        status: String(assetData.status || ""),
      },
      assignedBy: String(assetData.createdBy || assetData.updatedBy || ""),
      assignedDate: String(assetData.assignedDate || ""),
    });
    if (GAS_WEBAPP_URL) {
      syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
        console.warn("[AMS] Background history sync failed:", err);
      });
    }

    addAuditLog(
      req.body.createdBy || "",
      "ADD_ASSET",
      finalAssetId,
      "",
      JSON.stringify(assetData),
      `Added asset ${finalAssetId} (${assetData.assetName})`,
      proxyToGas
    );

    const savedAsset = mapSheetRow({
      ...assetData,
      id: finalAssetId,
      "S No": finalAssetId,
      "Asset ID": finalAssetId,
      "Unique Code": assetData.uniqueCode,
      "QR Code / Barcode": assetData.qrCodeText,
    });
    upsertAssetInCache(savedAsset);
    if (GAS_WEBAPP_URL) {
      void refreshAssetsNow(GAS_WEBAPP_URL).catch((err) =>
        console.warn("[AMS] Post-save sheet refresh:", err)
      );
    }

    res.json({ success: true, asset: savedAsset });
    } finally {
      releaseSavingCode(savingCode);
      releaseAssetId(reservedIdNum);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to add asset" });
  }
});

app.put("/api/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const assets = await getFreshAssetsForMutation();
    const existing = findMappedAssetByAnyId(assets, id);
    const canonicalId = String(existing?.id || id);
    const mergedInput = mergeAssetEditPayload({ ...req.body, id: canonicalId } as Record<string, unknown>, existing as unknown as Record<string, unknown> | undefined);
    const assetData = await prepareAssetPayload(mergedInput, existing);

    const savingCode = String(assetData.assetCode || "");
    registerSavingCode(savingCode);

    try {
      await assertAssetUnique(assetData, canonicalId);

    if (existing && existing.employeeId && assetData.employeeId && String(existing.employeeId).trim() !== "" && String(existing.employeeId).trim() !== String(assetData.employeeId).trim()) {
      return res.status(400).json({ error: "Asset already assigned" });
    }

    const baseUrl = getBaseUrl(req);
    assetData.qrCodeText = getScanUrl(baseUrl, { ...(existing || {}), ...assetData, id: canonicalId } as any);

    const dbMode = readAppData().settings.dbMode;
    let result;
    const masterHeaders = getDefaultAssetHeaders();
    let localCategory = String(assetData.mainCategory || "IT Assets");
    let localRow: string[];
    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, canonicalId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalId, row });
      localRow = buildMasterAssetRow(assetData);
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) return res.status(500).json({ error: "Sheet has no data" });

      const sheetHeaders = sheet[0] as string[];
      const rows = sheet.slice(1);
      const idCol = sheetHeaders.findIndex((h: string) =>
        ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val: any) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(canonicalId);
      const rowIndex = rows.findIndex((row: any[]) =>
        normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId
      );
      if (rowIndex === -1) return res.status(404).json({ error: "Asset not found" });

      const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
      const updatedRow = buildMasterAssetRow(assetData, existingMaster);
      logAssetMappingAudit("sheet-write-update", assetData as Record<string, unknown>, masterHeaders, updatedRow);
      console.log("[AMS] Sheet row payload (update):", updatedRow.length, "columns for id", canonicalId);
      result = await proxyToGas({ action: "update", id: canonicalId, row: updatedRow, rowIndex: rowIndex + 2 });
      localRow = updatedRow;
    }

    if (result.error) throw new Error(result.error);
    await updateAssetLocal(localCategory, canonicalId, localRow, masterHeaders);
    releaseIssuedCode(localCategory, String(assetData.assetCode || ""));

    persistAssetDynamicDetails(canonicalId, assetData).catch(err => {
      console.warn("[AMS] Background dynamic details sync failed:", err);
    });

    const hist = recordAssignmentChange({
      assetId: canonicalId,
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
      assignedDate: String(assetData.assignedDate || ""),
    });
    if (GAS_WEBAPP_URL) {
      syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
        console.warn("[AMS] Background history sync failed:", err);
      });
    }

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

    const updatedAsset = mapSheetRow({
      ...assetData,
      id: canonicalId,
      "S No": canonicalId,
      "Asset ID": canonicalId,
      "QR Code / Barcode": assetData.qrCodeText,
    });
    upsertAssetInCache(updatedAsset);
    if (GAS_WEBAPP_URL) {
      void refreshAssetsNow(GAS_WEBAPP_URL).catch((err) =>
        console.warn("[AMS] Post-update sheet refresh:", err)
      );
    }

    res.json({ success: true, asset: updatedAsset });
    } finally {
      releaseSavingCode(savingCode);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update asset" });
  }
});

app.post("/api/assets/:id/deassign", async (req, res) => {
  try {
    const id = req.params.id;
    const actor = String(req.body?.updatedBy || "").trim() || resolveRequestUser(req)?.email || "System";
    const remarks = String(req.body?.remarks || "").trim() || "Asset returned / deassigned";
    const assets = await getFreshAssetsForMutation();
    const existing = findMappedAssetByAnyId(assets, id);
    if (!existing) return res.status(404).json({ error: "Asset not found" });

    const canonicalId = String(existing.id || id);
    const hadAssignee = hasAssigneeFields(existing as unknown as Record<string, unknown>);
    if (!hadAssignee) {
      const currentAsset = mapSheetRow({
        ...existing,
        id: canonicalId,
        "S No": canonicalId,
        "Asset ID": canonicalId,
        "QR Code / Barcode": existing.qrCodeText,
      });
      return res.json({ success: true, asset: currentAsset, message: "Asset is already deassigned" });
    }

    const assetData = await prepareAssetPayload({
      ...existing,
      id: canonicalId,
      status: "Available",
      employeeId: "",
      contactName: "",
      contactEmail: "",
      contactMobile: "",
      assignedDate: "",
      returnDate: new Date().toISOString(),
      updatedBy: actor,
      updatedDate: new Date().toISOString(),
    } as Record<string, unknown>, existing);

    const baseUrl = getBaseUrl(req);
    assetData.qrCodeText = getScanUrl(baseUrl, { ...(existing || {}), ...assetData, id: canonicalId } as any);

    const dbMode = readAppData().settings.dbMode;
    const masterHeaders = getDefaultAssetHeaders();
    let result;
    let localRow: string[];
    const localCategory = String(assetData.mainCategory || "IT Assets");

    if (dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, canonicalId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalId, row });
      localRow = buildMasterAssetRow(assetData);
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) return res.status(500).json({ error: "Sheet has no data" });

      const sheetHeaders = sheet[0] as string[];
      const rows = sheet.slice(1);
      const idCol = sheetHeaders.findIndex((h: string) =>
        ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val: any) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(canonicalId);
      const rowIndex = rows.findIndex((row: any[]) =>
        normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId
      );
      if (rowIndex === -1) return res.status(404).json({ error: "Asset not found" });

      const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex] as string[]);
      const updatedRow = buildMasterAssetRow(assetData, existingMaster);
      result = await proxyToGas({ action: "update", id: canonicalId, row: updatedRow, rowIndex: rowIndex + 2 });
      localRow = updatedRow;
    }

    if (result?.error) throw new Error(result.error);
    await updateAssetLocal(localCategory, canonicalId, localRow, masterHeaders);
    persistAssetDynamicDetails(canonicalId, assetData).catch(err => {
      console.warn("[AMS] Background dynamic details sync failed:", err);
    });

    const hist = recordAssignmentChange({
      assetId: canonicalId,
      previous: {
        employeeId: existing.employeeId || "",
        contactName: existing.contactName || "",
        contactEmail: existing.contactEmail || "",
        status: existing.status || "",
      },
      next: {
        employeeId: "",
        contactName: "",
        contactEmail: "",
        status: "Available",
      },
      assignedBy: actor,
      remarks,
    });
    if (GAS_WEBAPP_URL) {
      syncHistoryEntriesToGas(hist, proxyToGas).catch(err => {
        console.warn("[AMS] Background history sync failed:", err);
      });
    }

    addAuditLog(
      actor,
      "DEASSIGN_ASSET",
      canonicalId,
      JSON.stringify(existing),
      JSON.stringify(assetData),
      `Deassigned asset ${canonicalId}`,
      proxyToGas
    );

    const updatedAsset = mapSheetRow({
      ...assetData,
      id: canonicalId,
      "S No": canonicalId,
      "Asset ID": canonicalId,
      "QR Code / Barcode": assetData.qrCodeText,
    });
    upsertAssetInCache(updatedAsset);
    if (GAS_WEBAPP_URL) {
      void refreshAssetsNow(GAS_WEBAPP_URL).catch((err) =>
        console.warn("[AMS] Post-deassign sheet refresh:", err)
      );
    }

    res.json({ success: true, asset: updatedAsset });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to deassign asset" });
  }
});

app.post("/api/assets/bulk", async (req, res) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: "No assets to import" });
    }
    const masterHeaders = getDefaultAssetHeaders();

    let imported = 0;
    for (const asset of assets) {
      const row = buildMasterAssetRow(asset);
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
    const user = resolveRequestUser(req);
    const sessionUser = req.authUser;
    const actorEmail = user?.email || sessionUser?.email || "";
    const actorRole = user?.role || sessionUser?.role || "";
    if (!actorEmail) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole(actorRole)) {
      return res.status(403).json({ error: "You do not have permission to delete assets." });
    }

    const id = req.params.id;
    const data = readAppData();
    const dbMode = data.settings.dbMode;
    const assets = await getAssetsForOps();
    const existing = findMappedAssetByAnyId(assets, id);
    const canonicalId = String(existing?.id || id);

    let sheetWarning: string | undefined;
    if (GAS_WEBAPP_URL) {
      try {
        let result;
        if (dbMode === "redesigned") {
          result = await proxyToGas({ action: "delete_asset_redesigned", id: canonicalId });
        } else {
          result = await proxyToGas({ action: "delete", id: canonicalId });
        }
        if (result?.error) sheetWarning = String(result.error);
      } catch (gasErr: any) {
        sheetWarning = gasErr.message || "Sheet delete failed";
        console.warn("[AMS] GAS delete warning:", sheetWarning);
      }
      if (sheetWarning) {
        return res.status(502).json({ error: `Database delete failed: ${sheetWarning}` });
      }
    }

    deleteDetailsForAsset(canonicalId);
    if (GAS_WEBAPP_URL) void deleteDetailsFromGas(canonicalId, proxyToGas);
    deleteAssignmentHistoryForAsset(canonicalId);
    deleteExtraItemsForAsset(canonicalId);
    deleteMissingItemsForAsset(canonicalId);
    deleteDamagedItemsForAsset(canonicalId);
    await deleteAssetLocal(canonicalId);

    addAuditLog(
      actorEmail,
      "DELETE_ASSET",
      canonicalId,
      existing ? JSON.stringify(existing) : "",
      "",
      `Deleted asset ${canonicalId}`,
      proxyToGas
    );

    removeAssetFromCache(canonicalId);
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

    const healedAsset = healMisalignedAssetFields(asset) as MappedAsset;
    const baseUrl = getBaseUrl(req);
    const pdfBytes = await generateAssetPdf(healedAsset, baseUrl, scanId);

    if (!pdfBytes || pdfBytes.length < 100) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>PDF could not be generated</h2><p>Try again or re-upload the document on this asset.</p></body></html>`
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdfBytes.length));
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="AEMS_${pdfSafeFilename(getCanonicalScanId(asset) || scanId)}.pdf"`
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
      server: {
        middlewareMode: true,
        hmr: {
          port: 0,
        },
      },
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

  const startListening = (port: number) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log(`Open app at http://localhost:${port} (not Vite port 5173)`);
    });

    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`[AMS] Port ${port} is already in use. Trying port ${port + 1}...`);
        startListening(port + 1);
      } else {
        console.error("[AMS] Server error:", error);
      }
    });
  };

  startListening(PORT);
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
