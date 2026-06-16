import {
  DEFAULT_BRANDS_BY_TYPE,
  catalogKeyForAssetType,
  PERIPHERAL_TYPES,
  type BrandsByType,
} from "./assetCatalogByType";

export interface AssetCatalog {
  brands: Record<string, string[]>;
  brandsByType?: BrandsByType;
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
  /** Custom banner/preview images per sub-category or IT asset type */
  subCategoryImages?: Record<string, string>;
  /** Custom banner/preview images per Software / License sub-category */
  softwareSubCategoryImages?: Record<string, string>;
  licenseTypes?: string[];
  deletedOptions?: Record<string, string[]>;
}

export const DEFAULT_BRANDS: Record<string, string[]> = {
  Dell: [
    "Latitude 5420",
    "Latitude 5430",
    "Latitude 5440",
    "OptiPlex 7090",
    "OptiPlex 7010",
    "Precision 3560",
    "PowerEdge R740",
  ],
  HP: [
    "EliteBook 840 G8",
    "EliteBook 850 G9",
    "ProBook 450 G9",
    "ProDesk 400 G9",
    "ZBook Firefly 14",
    "LaserJet Pro M404",
  ],
  Lenovo: [
    "ThinkPad T14",
    "ThinkPad E14",
    "ThinkPad L14",
    "ThinkCentre M70q",
    "IdeaPad Slim 5",
    "Legion 5",
  ],
  Apple: ["MacBook Air M2", "MacBook Pro 14", "Mac Mini M2", "iMac 24"],
  Asus: ["VivoBook 15", "ZenBook 14", "ExpertBook B1", "ROG Strix G15"],
  Acer: ["Aspire 5", "TravelMate P2", "Predator Helios", "Veriton X"],
  Microsoft: ["Surface Laptop 5", "Surface Pro 9"],
  Cisco: ["Catalyst 2960", "ISR 4331", "Meraki MR46", "ASA 5506"],
  Fortinet: ["FortiGate 60F", "FortiGate 100F", "FortiSwitch 108E"],
  Logitech: ["MX Master 3", "K380 Keyboard", "C920 Webcam", "M185 Mouse"],
  Samsung: ["Galaxy Tab S9", "27\" UR55 Monitor", "990 Pro SSD"],
  LG: ["24MP88 Monitor", "Gram 16 Laptop", "27UL850 Monitor"],
  Epson: ["L3250 Printer", "L6290 Printer", "DS-530 Scanner"],
  Canon: ["LBP6030 Printer", "imageCLASS MF301", "CanoScan LiDE"],
};

export const DEFAULT_VENDORS = [
  "Dell India",
  "HP Enterprise",
  "Lenovo India",
  "Ingram Micro",
  "Redington",
  "HCL Infosystems",
  "Softcell",
  "Rashi Peripherals",
  "Savex Technologies",
  "Intech Systems",
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
  "Maintenance",
  "Security",
];

const DEFAULT_MISSING_ITEM_ACCESSORIES = [
  "Charger",
  "Laptop Bag",
  "Headset",
  "Webcam",
  "USB Hub",
  "Docking Station",
  "Cable",
  "Adapter",
];

export const DEFAULT_MISSING_ITEM_TYPES = Array.from(
  new Set([...PERIPHERAL_TYPES, ...DEFAULT_MISSING_ITEM_ACCESSORIES])
);

export const DEFAULT_MISSING_ITEM_NAMES = [
  'Mouse',
  'Keyboard',
  'Charger',
  'Laptop Bag',
  'Headset',
  'Monitor',
  'Webcam',
  'USB Hub',
  'Docking Station',
  'Cable',
  'Adapter',
  'Power Adapter',
  'Laptop Stand',
  'Headphones',
  'Keyboard & Mouse Combo',
];

export const DEFAULT_LICENSE_TYPES = [
  'Standard',
  'Basic',
  'With Teams',
  'Without Teams',
  'Perpetual',
  'Subscription (Monthly)',
  'Subscription (Annual)',
  'Open Source',
  'OEM',
];

function cloneBrandsByType(): BrandsByType {
  try {
    return structuredClone(DEFAULT_BRANDS_BY_TYPE);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_BRANDS_BY_TYPE)) as BrandsByType;
  }
}

export function defaultCatalog(): AssetCatalog {
  return {
    brands: { ...DEFAULT_BRANDS },
    brandsByType: cloneBrandsByType(),
    vendors: [...DEFAULT_VENDORS],
    vendorsByCategory: { "IT Assets": [...DEFAULT_VENDORS] },
    departments: [...DEFAULT_DEPARTMENTS],
    ram: [],
    ssd: [],
    cpu: [],
    windowsVersion: [],
    subCategories: {},
    missingItemTypes: [],
    missingItemNames: [],
    subCategoryImages: {},
  };
}

/** Keep saved make/model visible in dropdowns when editing existing assets. */
export function catalogWithAssetValues(
  catalog: AssetCatalog,
  assetType: string,
  make?: string,
  model?: string
): AssetCatalog {
  const m = make?.trim();
  if (!m) return catalog;
  const key = catalogKeyForAssetType(assetType);
  const byType = { ...(catalog.brandsByType || {}) };
  const typeMap = { ...(byType[key] || {}) };
  const models = [...(typeMap[m] || [])];
  const mod = model?.trim();
  if (mod && !models.includes(mod)) models.push(mod);
  typeMap[m] = models;
  byType[key] = typeMap;
  return { ...catalog, brandsByType: byType };
}

export function mergeCatalog(saved?: Partial<AssetCatalog> | null): AssetCatalog {
  const base = defaultCatalog();
  if (!saved) return base;

  const deleted = saved.deletedOptions || {};

  const filterDeleted = (list: string[], key: string) => {
    const delList = deleted[key] || [];
    return list.filter((item) => !delList.includes(item));
  };

  const brands = { ...base.brands };
  if (saved.brands) {
    for (const [brand, models] of Object.entries(saved.brands)) {
      const existing = brands[brand] || [];
      brands[brand] = Array.from(new Set([...existing, ...(models || [])]));
    }
  }

  const brandsByType = { ...base.brandsByType } as BrandsByType;
  if (saved.brandsByType) {
    for (const [assetType, brandMap] of Object.entries(saved.brandsByType)) {
      const merged: Record<string, string[]> = { ...(brandsByType[assetType] || {}) };
      for (const [brand, models] of Object.entries(brandMap || {})) {
        merged[brand] = Array.from(
          new Set([...(merged[brand] || []), ...(models || [])])
        );
      }
      brandsByType[assetType] = merged;
    }
  }

  // Filter out deleted brands/models by type
  for (const assetType of Object.keys(brandsByType)) {
    const brandMap = brandsByType[assetType];
    if (brandMap) {
      for (const brand of Object.keys(brandMap)) {
        // If the brand is deleted for this assetType
        if ((deleted.brands || []).includes(`${assetType}:${brand}`)) {
          delete brandMap[brand];
          continue;
        }
        // Filter out deleted models for this brand and assetType
        const models = brandMap[brand] || [];
        brandMap[brand] = models.filter(
          (m) => !(deleted.models || []).includes(`${assetType}:${brand}:${m}`)
        );
      }
    }
  }

  // Filter out deleted subcategories
  const subCategories = { ...saved.subCategories };
  for (const mainCat of Object.keys(subCategories)) {
    const list = subCategories[mainCat] || [];
    subCategories[mainCat] = list.filter(
      (s) => !(deleted.subCategories || []).includes(`${mainCat}:${s}`)
    );
  }

  const mergedSubCategoryImages = { ...(saved.subCategoryImages || {}) };
  if (saved.softwareSubCategoryImages) {
    for (const [key, value] of Object.entries(saved.softwareSubCategoryImages)) {
      if (!mergedSubCategoryImages[key]) {
        mergedSubCategoryImages[key] = value;
      }
    }
  }

  const vendorsByCategory = { ...(saved.vendorsByCategory || {}) };
  if (!Object.keys(vendorsByCategory).length && (saved.vendors || []).length) {
    vendorsByCategory["IT Assets"] = [...(saved.vendors || [])];
  }

  return {
    brands,
    brandsByType,
    vendors: filterDeleted(
      Array.from(new Set([...base.vendors, ...(saved.vendors || [])])),
      "vendors"
    ).sort(),
    vendorsByCategory,
    departments: filterDeleted(
      Array.from(new Set([...base.departments, ...(saved.departments || [])])),
      "departments"
    ).sort(),
    ram: filterDeleted(
      Array.from(new Set([...(base.ram || []), ...(saved.ram || [])])),
      "ram"
    ),
    ssd: filterDeleted(
      Array.from(new Set([...(base.ssd || []), ...(saved.ssd || [])])),
      "ssd"
    ),
    cpu: filterDeleted(
      Array.from(new Set([...(base.cpu || []), ...(saved.cpu || [])])),
      "cpu"
    ),
    windowsVersion: filterDeleted(
      Array.from(new Set([...(base.windowsVersion || []), ...(saved.windowsVersion || [])])),
      "windowsVersion"
    ),
    subCategories,
    missingItemTypes: saved.missingItemTypes || [],
    missingItemNames: saved.missingItemNames || [],
    subCategoryImages: mergedSubCategoryImages,
    softwareSubCategoryImages: { ...(saved.softwareSubCategoryImages || {}) },
    licenseTypes: saved.licenseTypes || [],
    deletedOptions: saved.deletedOptions || {},
  };
}

/** License type options for Software / License Assets form. */
export function getLicenseTypeList(catalog: AssetCatalog): string[] {
  const deleted = catalog.deletedOptions?.licenseTypes || [];
  const all = Array.from(
    new Set([...DEFAULT_LICENSE_TYPES, ...(catalog.licenseTypes || [])])
  );
  return all.filter((t) => !deleted.includes(t)).sort((a, b) => a.localeCompare(b));
}

export function addLicenseType(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const deletedOptions = { ...(catalog.deletedOptions || {}) };
  deletedOptions.licenseTypes = (deletedOptions.licenseTypes || []).filter((x) => x !== v);
  const list = catalog.licenseTypes || [];
  if (DEFAULT_LICENSE_TYPES.includes(v) || list.includes(v)) {
    return { ...catalog, deletedOptions };
  }
  return { ...catalog, licenseTypes: [...list, v].sort(), deletedOptions };
}

export function removeLicenseType(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const deletedOptions = { ...(catalog.deletedOptions || {}) };
  if (!deletedOptions.licenseTypes) deletedOptions.licenseTypes = [];
  if (!deletedOptions.licenseTypes.includes(v)) deletedOptions.licenseTypes.push(v);
  const licenseTypes = (catalog.licenseTypes || []).filter((x) => x !== v);
  return { ...catalog, licenseTypes, deletedOptions };
}

/** Asset types shown in the Missing item form dropdown. */
export function getMissingItemTypeList(catalog: AssetCatalog): string[] {
  const deleted = catalog.deletedOptions?.missingItemTypes || [];
  const all = Array.from(
    new Set([...DEFAULT_MISSING_ITEM_TYPES, ...(catalog.missingItemTypes || [])])
  );
  return all.filter((t) => !deleted.includes(t)).sort((a, b) => a.localeCompare(b));
}

/** Missing item name suggestions in the Missing item form dropdown. */
export function getMissingItemNameList(catalog: AssetCatalog): string[] {
  const deleted = catalog.deletedOptions?.missingItemNames || [];
  const all = Array.from(
    new Set([...DEFAULT_MISSING_ITEM_NAMES, ...(catalog.missingItemNames || [])])
  );
  return all.filter((n) => !deleted.includes(n)).sort((a, b) => a.localeCompare(b));
}

function typeBrandMap(catalog: AssetCatalog, assetType: string): Record<string, string[]> {
  const key = catalogKeyForAssetType(assetType);
  const defaults = DEFAULT_BRANDS_BY_TYPE[key] || {};
  const custom = catalog.brandsByType?.[key] || {};
  const merged: Record<string, string[]> = {};
  
  for (const [brand, models] of Object.entries(defaults)) {
    merged[brand] = [...models];
  }
  for (const [brand, models] of Object.entries(custom)) {
    merged[brand] = Array.from(new Set([...(merged[brand] || []), ...(models || [])]));
  }

  const deleted = catalog.deletedOptions || {};
  const deletedBrands = deleted.brands || [];
  const deletedModels = deleted.models || [];

  for (const brand of Object.keys(merged)) {
    if (deletedBrands.includes(`${assetType}:${brand}`)) {
      delete merged[brand];
      continue;
    }
    merged[brand] = merged[brand].filter(
      (m) => !deletedModels.includes(`${assetType}:${brand}:${m}`)
    );
  }

  return merged;
}

/** Brands valid for the selected asset type (Laptop → laptop brands, Monitor → monitor brands, etc.). */
export function getBrandListForAssetType(catalog: AssetCatalog, assetType: string): string[] {
  return Object.keys(typeBrandMap(catalog, assetType)).sort();
}

/** Models for a brand within the selected asset type. */
export function getModelsForBrandAndType(
  catalog: AssetCatalog,
  assetType: string,
  brand: string
): string[] {
  if (!brand) return [];
  const map = typeBrandMap(catalog, assetType);
  return [...(map[brand] || [])].sort();
}

export function getBrandList(catalog: AssetCatalog): string[] {
  return Array.from(
    new Set([...Object.keys(catalog.brands), ...Object.keys(DEFAULT_BRANDS)])
  ).sort();
}

export function getModelsForBrand(catalog: AssetCatalog, brand: string): string[] {
  if (!brand) return [];
  const models = catalog.brands[brand] || DEFAULT_BRANDS[brand] || [];
  return [...models].sort();
}

export function addBrand(catalog: AssetCatalog, brand: string): AssetCatalog {
  const b = brand.trim();
  if (!b) return catalog;
  if (!catalog.brands[b]) {
    return { ...catalog, brands: { ...catalog.brands, [b]: [] } };
  }
  return catalog;
}

export function addModel(
  catalog: AssetCatalog,
  brand: string,
  model: string
): AssetCatalog {
  const b = brand.trim();
  const m = model.trim();
  if (!b || !m) return catalog;
  const next = { ...catalog.brands };
  const list = next[b] || [];
  if (!list.includes(m)) next[b] = [...list, m];
  return { ...catalog, brands: next };
}

export function addBrandForType(
  catalog: AssetCatalog,
  assetType: string,
  brand: string
): AssetCatalog {
  const b = brand.trim();
  if (!b) return catalog;
  const key = catalogKeyForAssetType(assetType);
  const byType = { ...(catalog.brandsByType || {}) };
  const typeMap = { ...(byType[key] || {}) };
  if (!typeMap[b]) typeMap[b] = [];
  byType[key] = typeMap;
  return { ...catalog, brandsByType: byType };
}

export function addModelForType(
  catalog: AssetCatalog,
  assetType: string,
  brand: string,
  model: string
): AssetCatalog {
  const b = brand.trim();
  const m = model.trim();
  if (!b || !m) return catalog;
  const key = catalogKeyForAssetType(assetType);
  const byType = { ...(catalog.brandsByType || {}) };
  const typeMap = { ...(byType[key] || {}) };
  const list = typeMap[b] || [];
  if (!list.includes(m)) typeMap[b] = [...list, m];
  byType[key] = typeMap;
  return { ...catalog, brandsByType: byType };
}

export function addVendor(catalog: AssetCatalog, mainCategory: string, vendor: string): AssetCatalog {
  const v = vendor.trim();
  const key = mainCategory.trim() || "IT Assets";
  const vendorsByCategory = { ...(catalog.vendorsByCategory || {}) };
  const list = vendorsByCategory[key] || [];
  if (!v || list.includes(v)) return catalog;
  vendorsByCategory[key] = [...list, v].sort();
  return { ...catalog, vendorsByCategory };
}

export function addDepartment(catalog: AssetCatalog, dept: string): AssetCatalog {
  const d = dept.trim();
  if (!d || catalog.departments.includes(d)) return catalog;
  return { ...catalog, departments: [...catalog.departments, d].sort() };
}

export function addSubCategory(catalog: AssetCatalog, mainCat: string, subCat: string): AssetCatalog {
  const s = subCat.trim();
  if (!s) return catalog;
  const subCategories = { ...(catalog.subCategories || {}) };
  const list = subCategories[mainCat] || [];
  if (!list.includes(s)) {
    subCategories[mainCat] = [...list, s];
  }
  return { ...catalog, subCategories };
}

export function setSoftwareSubCategoryImage(
  catalog: AssetCatalog,
  subCategory: string,
  imageUrl: string
): AssetCatalog {
  const sub = subCategory.trim();
  const url = imageUrl.trim();
  if (!sub || !url) return catalog;
  return {
    ...catalog,
    subCategoryImages: {
      ...(catalog.subCategoryImages || {}),
      [sub]: url,
    },
    softwareSubCategoryImages: {
      ...(catalog.softwareSubCategoryImages || {}),
      [sub]: url,
    },
  };
}

export function setSubCategoryImage(
  catalog: AssetCatalog,
  key: string,
  imageUrl: string
): AssetCatalog {
  const k = key.trim();
  const url = imageUrl.trim();
  if (!k || !url) return catalog;
  return {
    ...catalog,
    subCategoryImages: {
      ...(catalog.subCategoryImages || {}),
      [k]: url,
    },
  };
}

export function addRam(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const ram = catalog.ram || [];
  if (ram.includes(v)) return catalog;
  return { ...catalog, ram: [...ram, v] };
}

export function addSsd(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const ssd = catalog.ssd || [];
  if (ssd.includes(v)) return catalog;
  return { ...catalog, ssd: [...ssd, v] };
}

export function addCpu(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const cpu = catalog.cpu || [];
  if (cpu.includes(v)) return catalog;
  return { ...catalog, cpu: [...cpu, v] };
}

export function addWindowsVersion(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  if (!v) return catalog;
  const windowsVersion = catalog.windowsVersion || [];
  if (windowsVersion.includes(v)) return catalog;
  return { ...catalog, windowsVersion: [...windowsVersion, v] };
}

export function addMissingItemType(catalog: AssetCatalog, type: string): AssetCatalog {
  const t = type.trim();
  if (!t) return catalog;
  const deletedOptions = { ...(catalog.deletedOptions || {}) };
  deletedOptions.missingItemTypes = (deletedOptions.missingItemTypes || []).filter((x) => x !== t);
  const list = catalog.missingItemTypes || [];
  if (DEFAULT_MISSING_ITEM_TYPES.includes(t) || list.includes(t)) {
    return { ...catalog, deletedOptions };
  }
  return { ...catalog, missingItemTypes: [...list, t].sort(), deletedOptions };
}

export function removeMissingItemType(catalog: AssetCatalog, type: string): AssetCatalog {
  const t = type.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.missingItemTypes) deleted.missingItemTypes = [];
  if (!deleted.missingItemTypes.includes(t)) deleted.missingItemTypes.push(t);
  const missingItemTypes = (catalog.missingItemTypes || []).filter((x) => x !== t);
  return { ...catalog, missingItemTypes, deletedOptions: deleted };
}

export function addMissingItemName(catalog: AssetCatalog, name: string): AssetCatalog {
  const n = name.trim();
  if (!n) return catalog;
  const deletedOptions = { ...(catalog.deletedOptions || {}) };
  deletedOptions.missingItemNames = (deletedOptions.missingItemNames || []).filter((x) => x !== n);
  const list = catalog.missingItemNames || [];
  if (DEFAULT_MISSING_ITEM_NAMES.includes(n) || list.includes(n)) {
    return { ...catalog, deletedOptions };
  }
  return { ...catalog, missingItemNames: [...list, n].sort(), deletedOptions };
}

export function removeMissingItemName(catalog: AssetCatalog, name: string): AssetCatalog {
  const n = name.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.missingItemNames) deleted.missingItemNames = [];
  if (!deleted.missingItemNames.includes(n)) deleted.missingItemNames.push(n);
  const missingItemNames = (catalog.missingItemNames || []).filter((x) => x !== n);
  return { ...catalog, missingItemNames, deletedOptions: deleted };
}

export function removeVendor(catalog: AssetCatalog, mainCategory: string, vendor: string): AssetCatalog {
  const v = vendor.trim();
  const key = mainCategory.trim() || "IT Assets";
  const vendorsByCategory = { ...(catalog.vendorsByCategory || {}) };
  const list = (vendorsByCategory[key] || []).filter((x) => x !== v);
  vendorsByCategory[key] = list;
  return { ...catalog, vendorsByCategory };
}

export function getVendorsForCategory(catalog: AssetCatalog, mainCategory: string): string[] {
  const key = mainCategory.trim() || "IT Assets";
  const list = catalog.vendorsByCategory?.[key] || [];
  return list.slice().sort((a, b) => a.localeCompare(b));
}

export function removeDepartment(catalog: AssetCatalog, dept: string): AssetCatalog {
  const d = dept.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.departments) deleted.departments = [];
  if (!deleted.departments.includes(d)) deleted.departments.push(d);
  const departments = (catalog.departments || []).filter((x) => x !== d);
  return { ...catalog, departments, deletedOptions: deleted };
}

export function removeRam(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.ram) deleted.ram = [];
  if (!deleted.ram.includes(v)) deleted.ram.push(v);
  const ram = (catalog.ram || []).filter((x) => x !== v);
  return { ...catalog, ram, deletedOptions: deleted };
}

export function removeSsd(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.ssd) deleted.ssd = [];
  if (!deleted.ssd.includes(v)) deleted.ssd.push(v);
  const ssd = (catalog.ssd || []).filter((x) => x !== v);
  return { ...catalog, ssd, deletedOptions: deleted };
}

export function removeCpu(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.cpu) deleted.cpu = [];
  if (!deleted.cpu.includes(v)) deleted.cpu.push(v);
  const cpu = (catalog.cpu || []).filter((x) => x !== v);
  return { ...catalog, cpu, deletedOptions: deleted };
}

export function removeWindowsVersion(catalog: AssetCatalog, value: string): AssetCatalog {
  const v = value.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.windowsVersion) deleted.windowsVersion = [];
  if (!deleted.windowsVersion.includes(v)) deleted.windowsVersion.push(v);
  const windowsVersion = (catalog.windowsVersion || []).filter((x) => x !== v);
  return { ...catalog, windowsVersion, deletedOptions: deleted };
}

export function removeSubCategory(catalog: AssetCatalog, mainCat: string, subCat: string): AssetCatalog {
  const s = subCat.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.subCategories) deleted.subCategories = [];
  const key = `${mainCat}:${s}`;
  if (!deleted.subCategories.includes(key)) deleted.subCategories.push(key);
  
  const subCategories = { ...(catalog.subCategories || {}) };
  const list = subCategories[mainCat] || [];
  subCategories[mainCat] = list.filter((x) => x !== s);

  const subCategoryImages = { ...(catalog.subCategoryImages || {}) };
  delete subCategoryImages[s];

  if (mainCat === "Software / License Assets") {
    const softwareSubCategoryImages = { ...(catalog.softwareSubCategoryImages || {}) };
    delete softwareSubCategoryImages[s];
    return { ...catalog, subCategories, deletedOptions: deleted, softwareSubCategoryImages, subCategoryImages };
  }

  return { ...catalog, subCategories, deletedOptions: deleted, subCategoryImages };
}

export function removeBrandForType(catalog: AssetCatalog, assetType: string, brand: string): AssetCatalog {
  const b = brand.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.brands) deleted.brands = [];
  const key = `${assetType}:${b}`;
  if (!deleted.brands.includes(key)) deleted.brands.push(key);
  
  const byType = { ...(catalog.brandsByType || {}) };
  const typeKey = catalogKeyForAssetType(assetType);
  const typeMap = { ...(byType[typeKey] || {}) };
  delete typeMap[b];
  byType[typeKey] = typeMap;
  return { ...catalog, brandsByType: byType, deletedOptions: deleted };
}

export function removeModelForType(
  catalog: AssetCatalog,
  assetType: string,
  brand: string,
  model: string
): AssetCatalog {
  const b = brand.trim();
  const m = model.trim();
  const deleted = { ...(catalog.deletedOptions || {}) };
  if (!deleted.models) deleted.models = [];
  const key = `${assetType}:${b}:${m}`;
  if (!deleted.models.includes(key)) deleted.models.push(key);
  
  const byType = { ...(catalog.brandsByType || {}) };
  const typeKey = catalogKeyForAssetType(assetType);
  const typeMap = { ...(byType[typeKey] || {}) };
  const list = typeMap[b] || [];
  typeMap[b] = list.filter((x) => x !== m);
  byType[typeKey] = typeMap;
  return { ...catalog, brandsByType: byType, deletedOptions: deleted };
}
