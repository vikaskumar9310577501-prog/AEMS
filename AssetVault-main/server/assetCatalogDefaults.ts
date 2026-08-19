import fs from "fs";
import path from "path";
import os from "os";

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

export const DEFAULT_BRANDS: Record<string, string[]> = {
  Dell: ["Latitude 5420", "Latitude 5430", "OptiPlex 7090", "Precision 3560"],
  HP: ["EliteBook 840 G8", "ProBook 450 G9", "ProDesk 400 G9"],
  Lenovo: ["ThinkPad T14", "ThinkPad E14", "ThinkCentre M70q"],
  Apple: ["MacBook Air M2", "MacBook Pro 14"],
  Asus: ["VivoBook 15", "ZenBook 14"],
  Acer: ["Aspire 5", "TravelMate P2"],
  Cisco: ["Catalyst 2960", "Meraki MR46"],
  Fortinet: ["FortiGate 60F", "FortiGate 100F"],
  Logitech: ["MX Master 3", "K380 Keyboard"],
  Samsung: ["27\" UR55 Monitor", "990 Pro SSD"],
  LG: ["24MP88 Monitor", "Gram 16"],
  Epson: ["L3250 Printer", "DS-530 Scanner"],
  Canon: ["LBP6030 Printer", "CanoScan LiDE"],
};

export const DEFAULT_VENDORS = [
  "Dell India",
  "HP Enterprise",
  "Lenovo India",
  "Ingram Micro",
  "Redington",
  "HCL Infosystems",
];

export const DEFAULT_DEPARTMENTS = [
  "IT",
  "HR",
  "Finance",
  "Engineering",
  "Production",
  "Quality",
  "Admin",
  "Sales",
  "Purchase",
  "Store",
];

export function defaultCatalog(): AssetCatalog {
  return {
    brands: { ...DEFAULT_BRANDS },
    vendors: [...DEFAULT_VENDORS],
    vendorsByCategory: { "IT Assets": [...DEFAULT_VENDORS] },
    departments: [...DEFAULT_DEPARTMENTS],
    ram: [],
    ssd: [],
    cpu: [],
    windowsVersion: [],
    subCategories: {},
  };
}

export function mergeCatalog(saved?: any): any {
  const base = defaultCatalog();
  const catalog = saved || {};
  const deleted = catalog.deletedOptions || {};

  const filterDeleted = (list: string[], key: string) => {
    const delList = deleted[key] || [];
    return list.filter((item: string) => !delList.includes(item));
  };

  // 1. Read cached assets to dynamically extract custom values
  let assets: any[] = [];
  try {
    const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
    const CACHE_DIR = isServerless 
      ? path.join(os.tmpdir(), "assetqr-cache") 
      : path.join(process.cwd(), "data", "cache");
    const assetsFile = path.join(CACHE_DIR, "assets.json");
    if (fs.existsSync(assetsFile)) {
      const raw = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
      assets = Array.isArray(raw?.data) ? raw.data : [];
    }
  } catch (e) {
    console.warn("[Catalog Sync] Failed to read cached assets for dropdown extraction:", e);
  }

  // 1b. Read cached employees to extract departments they already have
  let employeeDepartments: string[] = [];
  try {
    const isServerless2 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
    const EMP_CACHE_DIR = isServerless2
      ? path.join(os.tmpdir(), "assetqr-data", "cache")
      : path.join(process.cwd(), "data", "cache");
    const empFile = path.join(EMP_CACHE_DIR, "employees.json");
    if (fs.existsSync(empFile)) {
      const raw = JSON.parse(fs.readFileSync(empFile, "utf-8"));
      const emps: any[] = Array.isArray(raw) ? raw : [];
      for (const emp of emps) {
        const dept = String(emp.department || "").trim();
        if (dept) employeeDepartments.push(dept);
      }
    }
  } catch (e) {
    console.warn("[Catalog Sync] Failed to read cached employees for department extraction:", e);
  }

  // 2. Merge Brands & Models
  const brands = { ...base.brands };
  if (catalog.brands) {
    for (const [brand, models] of Object.entries(catalog.brands as Record<string, string[]>)) {
      const existing = brands[brand] || [];
      brands[brand] = Array.from(new Set([...existing, ...(models || [])]));
    }
  }
  for (const asset of assets) {
    const mk = String(asset.make || "").trim();
    const md = String(asset.model || "").trim();
    if (mk && md) {
      const existing = brands[mk] || [];
      if (!existing.includes(md)) {
        brands[mk] = [...existing, md];
      }
    }
  }

  // 3. Merge Brands & Models by Asset Type
  const brandsByType: Record<string, Record<string, string[]>> = catalog.brandsByType ? { ...catalog.brandsByType } : {};
  for (const asset of assets) {
    const type = String(asset.assetType || "").trim();
    const mk = String(asset.make || "").trim();
    const md = String(asset.model || "").trim();
    if (type && mk && md) {
      if (!brandsByType[type]) brandsByType[type] = {};
      if (!brandsByType[type][mk]) brandsByType[type][mk] = [];
      if (!brandsByType[type][mk].includes(md)) {
        brandsByType[type][mk].push(md);
      }
    }
  }

  // Filter out deleted brands/models by type
  for (const assetType of Object.keys(brandsByType)) {
    const brandMap = brandsByType[assetType];
    if (brandMap) {
      for (const brand of Object.keys(brandMap)) {
        if ((deleted.brands || []).includes(`${assetType}:${brand}`)) {
          delete brandMap[brand];
          continue;
        }
        const models = brandMap[brand] || [];
        brandMap[brand] = models.filter(
          (m) => !(deleted.models || []).includes(`${assetType}:${brand}:${m}`)
        );
      }
    }
  }

  // 4. Merge Sub Categories
  const subCategories: Record<string, string[]> = catalog.subCategories ? { ...catalog.subCategories } : {};
  for (const asset of assets) {
    const main = String(asset.mainCategory || "").trim();
    const sub = String(asset.subCategory || "").trim();
    if (main && sub) {
      if (!subCategories[main]) subCategories[main] = [];
      if (!subCategories[main].includes(sub)) {
        subCategories[main].push(sub);
      }
    }
  }
  for (const mainCat of Object.keys(subCategories)) {
    const list = subCategories[mainCat] || [];
    subCategories[mainCat] = list.filter(
      (s) => !(deleted.subCategories || []).includes(`${mainCat}:${s}`)
    );
  }

  // 5. Merge Vendors
  const vendorsSet = new Set([...base.vendors, ...(catalog.vendors || [])]);
  for (const asset of assets) {
    const v = String(asset.vendorName || "").trim();
    if (v) vendorsSet.add(v);
  }
  const vendors = filterDeleted(Array.from(vendorsSet), "vendors").sort();

  // 6. Merge Departments — also from employees cache so they never disappear
  const departments = filterDeleted(
    Array.from(new Set([
      ...base.departments,
      ...(catalog.departments || []),
      ...employeeDepartments,
    ])),
    "departments"
  ).sort();

  // 7. Dynamic attributes (RAM, SSD, CPU, Windows Versions)
  const ramSet = new Set([...(catalog.ram || [])]);
  const ssdSet = new Set([...(catalog.ssd || [])]);
  const cpuSet = new Set([...(catalog.cpu || [])]);
  const winSet = new Set([...(catalog.windowsVersion || [])]);
  for (const asset of assets) {
    const r = String(asset.ram || "").trim();
    const s = String(asset.ssd || "").trim();
    const c = String(asset.cpu || "").trim();
    const w = String(asset.windowsVersion || "").trim();
    if (r) ramSet.add(r);
    if (s) ssdSet.add(s);
    if (c) cpuSet.add(c);
    if (w) winSet.add(w);
  }

  const ram = filterDeleted(Array.from(ramSet), "ram");
  const ssd = filterDeleted(Array.from(ssdSet), "ssd");
  const cpu = filterDeleted(Array.from(cpuSet), "cpu");
  const windowsVersion = filterDeleted(Array.from(winSet), "windowsVersion");

  // 8. License types
  const licenseTypesSet = new Set([...(catalog.licenseTypes || [])]);
  for (const asset of assets) {
    const l = String(asset.licenseType || asset.dynamicDetails?.license_type || "").trim();
    if (l) licenseTypesSet.add(l);
  }
  const licenseTypes = filterDeleted(Array.from(licenseTypesSet), "licenseTypes");

  // 9. Merge Vendors By Category
  const vendorsByCategory: Record<string, string[]> = catalog.vendorsByCategory ? { ...catalog.vendorsByCategory } : { "IT Assets": [...base.vendors] };
  for (const asset of assets) {
    const main = String(asset.mainCategory || "IT Assets").trim();
    const v = String(asset.vendorName || "").trim();
    if (main && v) {
      if (!vendorsByCategory[main]) vendorsByCategory[main] = [];
      if (!vendorsByCategory[main].includes(v)) {
        vendorsByCategory[main].push(v);
      }
    }
  }
  for (const mainCat of Object.keys(vendorsByCategory)) {
    const list = vendorsByCategory[mainCat] || [];
    vendorsByCategory[mainCat] = list.filter(
      (v: string) => !(deleted.vendors || []).includes(v)
    ).sort();
  }

  return {
    ...catalog,
    brands,
    brandsByType,
    subCategories,
    vendors,
    vendorsByCategory,
    departments,
    ram,
    ssd,
    cpu,
    windowsVersion,
    licenseTypes,
  };
}
