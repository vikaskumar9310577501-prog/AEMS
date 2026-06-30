import fs from "fs";
import path from "path";
import os from "os";
import type { TypeDefinitionsConfig } from "../src/types/categoryTypes.js";
import { defaultCatalog, mergeCatalog } from "./assetCatalogDefaults.js";

export interface PlantRecord {
  code: string;
  name: string;
  location: string;
}

export interface AssetFieldRecord {
  key: string;
  label: string;
  enabled: boolean;
}

export interface AppUser {
  email: string;
  role: string;
  locations: string[];
  plants: string[];
  categories?: string[];
  allowDelete?: boolean;
}

export interface AssetCatalog {
  brands: Record<string, string[]>;
  brandsByType?: Record<string, Record<string, string[]>>;
  vendors: string[];
  vendorsByCategory?: Record<string, string[]>;
  departments: string[];
  subCategories?: Record<string, string[]>;
  ram?: string[];
  ssd?: string[];
  cpu?: string[];
  windowsVersion?: string[];
  missingItemTypes?: string[];
  missingItemNames?: string[];
  subCategoryImages?: Record<string, string>;
  softwareSubCategoryImages?: Record<string, string>;
  licenseTypes?: string[];
  deletedOptions?: Record<string, string[]>;
}

export interface AppSettings {
  locations: string[];
  plants: PlantRecord[];
  assetFields: AssetFieldRecord[];
  catalog?: AssetCatalog;
  typeDefinitions?: TypeDefinitionsConfig;
  /** legacy category sheets | redesigned normalized tables */
  dbMode?: "legacy" | "redesigned";
}

export interface AppData {
  users: AppUser[];
  settings: AppSettings;
}

const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
const DATA_DIR = isServerless 
  ? path.join(os.tmpdir(), "assetqr-data") 
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");

const DEFAULT_ASSET_FIELDS: AssetFieldRecord[] = [
  { key: "department", label: "Department", enabled: true },
  { key: "make", label: "Brand/Make", enabled: true },
  { key: "model", label: "Model", enabled: true },
  { key: "vendorName", label: "Vendor Name", enabled: true },
  { key: "ram", label: "RAM", enabled: true },
  { key: "ssd", label: "Storage", enabled: true },
  { key: "cpu", label: "CPU", enabled: true },
  { key: "windowsVersion", label: "Windows Version", enabled: true },
  { key: "macAddress", label: "MAC Address", enabled: true },
  { key: "contactName", label: "Contact Person", enabled: true },
  { key: "contactEmail", label: "Contact Email", enabled: true },
  { key: "contactMobile", label: "Contact Mobile", enabled: true },
];

const DEFAULT_DATA: AppData = {
  users: [],
  settings: {
    locations: [],
    plants: [],
    assetFields: DEFAULT_ASSET_FIELDS,
    catalog: defaultCatalog(),
  },
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
  }
}

export function readAppData(): AppData {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      settings: {
        locations: parsed.settings?.locations ?? [],
        plants: parsed.settings?.plants ?? [],
        assetFields:
          parsed.settings?.assetFields?.length
            ? parsed.settings.assetFields
            : DEFAULT_ASSET_FIELDS,
        catalog: mergeCatalog(parsed.settings?.catalog),
        typeDefinitions: parsed.settings?.typeDefinitions,
        dbMode: parsed.settings?.dbMode,
      },
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function writeAppData(data: AppData) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
