import fs from "fs";
import path from "path";
import os from "os";
import type { MappedAsset } from "./assetHelpers.js";

const CATEGORY_PREFIX: Record<string, string> = {
  "IT Assets": "IT",
  "Office Assets": "OFF",
  "Electrical Assets": "ELE",
  "Production Assets": "PRD",
  "Safety Assets": "SAF",
  "Vehicle Assets": "VEH",
  "Furniture Assets": "FUR",
  "Software License Assets": "SW",
  "Software / License Assets": "SW",
  "Admin Facility Assets": "ADM",
  "Maintenance Assets": "MNT",
};

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const CACHE_DIR = isServerless 
  ? path.join(os.tmpdir(), "assetqr-cache") 
  : path.join(process.cwd(), "data", "cache");
const ISSUED_CODES_FILE = path.join(CACHE_DIR, "issued_codes.json");

interface IssuedCode {
  category: string;
  seq: number;
  expiresAt: number;
}

function readIssuedCodes(): IssuedCode[] {
  try {
    if (fs.existsSync(ISSUED_CODES_FILE)) {
      const raw = fs.readFileSync(ISSUED_CODES_FILE, "utf-8");
      return JSON.parse(raw) || [];
    }
  } catch (e) {
    console.warn("[AssetCodeGenerator] Failed to read issued_codes.json:", e);
  }
  return [];
}

function writeIssuedCodes(list: IssuedCode[]) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(ISSUED_CODES_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("[AssetCodeGenerator] Failed to write issued_codes.json:", e);
  }
}

function normCode(value: string): string {
  return value.trim().toLowerCase();
}

// In-memory registry of codes currently in the process of saving
const activeSavingCodes = new Set<string>();

export function registerSavingCode(code: string) {
  if (code && code.trim()) {
    activeSavingCodes.add(normCode(code));
  }
}

export function releaseSavingCode(code: string) {
  if (code && code.trim()) {
    activeSavingCodes.delete(normCode(code));
  }
}

export function isSavingCode(code: string): boolean {
  return activeSavingCodes.has(normCode(code));
}

/** IT Assets and Software / License use manual codes; other categories are auto-generated. */
export function isManualAssetCodeCategory(mainCategory: string): boolean {
  const cat = (mainCategory || "IT Assets").trim();
  return cat === "Software / License Assets";
}

/** @deprecated Use isManualAssetCodeCategory — department no longer drives asset code logic */
export function isManualAssetCodeDepartment(_department: string): boolean {
  return false;
}

export function generateAssetCode(assets: MappedAsset[], mainCategory: string): string {
  const prefix = CATEGORY_PREFIX[mainCategory] || "AST";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i");
  let maxSeq = 0;

  // 1. Scan actual database assets
  for (const asset of assets) {
    const code = String(asset.assetCode || "").trim();
    const match = code.match(pattern);
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10) || 0);
    }
  }

  // 2. Scan recently issued codes that haven't expired
  const now = Date.now();
  const issued = readIssuedCodes().filter(item => item.expiresAt > now);
  for (const item of issued) {
    if (item.category === mainCategory) {
      maxSeq = Math.max(maxSeq, item.seq);
    }
  }

  // 3. Find the candidate seq, checking BOTH assets list AND activeSavingCodes
  let candidate = "";
  let attempts = 0;
  let nextSeq = maxSeq;
  do {
    nextSeq += 1;
    candidate = `${prefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
    attempts += 1;
  } while (
    attempts < 10000 &&
    (assets.some((a) => normCode(String(a.assetCode || "")) === normCode(candidate)) ||
     isSavingCode(candidate))
  );

  // 4. Save this new sequence to issued codes (expires in 5 minutes)
  issued.push({
    category: mainCategory,
    seq: nextSeq,
    expiresAt: now + 5 * 60 * 1000
  });
  writeIssuedCodes(issued);

  return candidate;
}

export function releaseIssuedCode(mainCategory: string, assetCode: string) {
  const prefix = CATEGORY_PREFIX[mainCategory] || "AST";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i");
  const match = String(assetCode || "").trim().match(pattern);
  if (match) {
    const seq = parseInt(match[1], 10);
    if (seq) {
      const issued = readIssuedCodes();
      const next = issued.filter(item => !(item.category === mainCategory && item.seq === seq));
      if (next.length !== issued.length) {
        writeIssuedCodes(next);
      }
    }
  }
}
