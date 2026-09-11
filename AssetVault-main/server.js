var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/assetCatalogDefaults.ts
import fs from "fs";
import path from "path";
import os from "os";
function defaultCatalog() {
  return {
    brands: { ...DEFAULT_BRANDS },
    vendors: [...DEFAULT_VENDORS],
    vendorsByCategory: { "IT Assets": [...DEFAULT_VENDORS] },
    departments: [...DEFAULT_DEPARTMENTS],
    ram: [],
    ssd: [],
    cpu: [],
    windowsVersion: [],
    subCategories: {}
  };
}
function mergeCatalog(saved) {
  const base = defaultCatalog();
  const catalog = saved || {};
  const deleted = catalog.deletedOptions || {};
  const filterDeleted = (list, key) => {
    const delList = deleted[key] || [];
    return list.filter((item) => !delList.includes(item));
  };
  let assets = [];
  try {
    const isServerless13 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
    const CACHE_DIR12 = isServerless13 ? path.join(os.tmpdir(), "assetqr-cache") : path.join(process.cwd(), "data", "cache");
    const assetsFile = path.join(CACHE_DIR12, "assets.json");
    if (fs.existsSync(assetsFile)) {
      const raw = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
      assets = Array.isArray(raw?.data) ? raw.data : [];
    }
  } catch (e) {
    console.warn("[Catalog Sync] Failed to read cached assets for dropdown extraction:", e);
  }
  let employeeDepartments = [];
  try {
    const isServerless22 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
    const EMP_CACHE_DIR = isServerless22 ? path.join(os.tmpdir(), "assetqr-data", "cache") : path.join(process.cwd(), "data", "cache");
    const empFile = path.join(EMP_CACHE_DIR, "employees.json");
    if (fs.existsSync(empFile)) {
      const raw = JSON.parse(fs.readFileSync(empFile, "utf-8"));
      const emps = Array.isArray(raw) ? raw : [];
      for (const emp of emps) {
        const dept = String(emp.department || "").trim();
        if (dept) employeeDepartments.push(dept);
      }
    }
  } catch (e) {
    console.warn("[Catalog Sync] Failed to read cached employees for department extraction:", e);
  }
  const brands = { ...base.brands };
  if (catalog.brands) {
    for (const [brand, models] of Object.entries(catalog.brands)) {
      const existing = brands[brand] || [];
      brands[brand] = Array.from(/* @__PURE__ */ new Set([...existing, ...models || []]));
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
  const brandsByType = catalog.brandsByType ? { ...catalog.brandsByType } : {};
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
  const subCategories = catalog.subCategories ? { ...catalog.subCategories } : {};
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
  const vendorsSet = /* @__PURE__ */ new Set([...base.vendors, ...catalog.vendors || []]);
  for (const asset of assets) {
    const v = String(asset.vendorName || "").trim();
    if (v) vendorsSet.add(v);
  }
  const vendors = filterDeleted(Array.from(vendorsSet), "vendors").sort();
  const departments = filterDeleted(
    Array.from(/* @__PURE__ */ new Set([
      ...base.departments,
      ...catalog.departments || [],
      ...employeeDepartments
    ])),
    "departments"
  ).sort();
  const ramSet = /* @__PURE__ */ new Set([...catalog.ram || []]);
  const ssdSet = /* @__PURE__ */ new Set([...catalog.ssd || []]);
  const cpuSet = /* @__PURE__ */ new Set([...catalog.cpu || []]);
  const winSet = /* @__PURE__ */ new Set([...catalog.windowsVersion || []]);
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
  const licenseTypesSet = /* @__PURE__ */ new Set([...catalog.licenseTypes || []]);
  for (const asset of assets) {
    const l = String(asset.licenseType || asset.dynamicDetails?.license_type || "").trim();
    if (l) licenseTypesSet.add(l);
  }
  const licenseTypes = filterDeleted(Array.from(licenseTypesSet), "licenseTypes");
  const vendorsByCategory = catalog.vendorsByCategory ? { ...catalog.vendorsByCategory } : { "IT Assets": [...base.vendors] };
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
      (v) => !(deleted.vendors || []).includes(v)
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
    licenseTypes
  };
}
var DEFAULT_BRANDS, DEFAULT_VENDORS, DEFAULT_DEPARTMENTS;
var init_assetCatalogDefaults = __esm({
  "server/assetCatalogDefaults.ts"() {
    DEFAULT_BRANDS = {
      Dell: ["Latitude 5420", "Latitude 5430", "OptiPlex 7090", "Precision 3560"],
      HP: ["EliteBook 840 G8", "ProBook 450 G9", "ProDesk 400 G9"],
      Lenovo: ["ThinkPad T14", "ThinkPad E14", "ThinkCentre M70q"],
      Apple: ["MacBook Air M2", "MacBook Pro 14"],
      Asus: ["VivoBook 15", "ZenBook 14"],
      Acer: ["Aspire 5", "TravelMate P2"],
      Cisco: ["Catalyst 2960", "Meraki MR46"],
      Fortinet: ["FortiGate 60F", "FortiGate 100F"],
      Logitech: ["MX Master 3", "K380 Keyboard"],
      Samsung: ['27" UR55 Monitor', "990 Pro SSD"],
      LG: ["24MP88 Monitor", "Gram 16"],
      Epson: ["L3250 Printer", "DS-530 Scanner"],
      Canon: ["LBP6030 Printer", "CanoScan LiDE"]
    };
    DEFAULT_VENDORS = [
      "Dell India",
      "HP Enterprise",
      "Lenovo India",
      "Ingram Micro",
      "Redington",
      "HCL Infosystems"
    ];
    DEFAULT_DEPARTMENTS = [
      "IT",
      "HR",
      "Finance",
      "Engineering",
      "Production",
      "Quality",
      "IDU",
      "ODU",
      "IQC",
      "QA ELECTRONICS",
      "OPERATIONS",
      "OQC",
      "HE QUALITY",
      "SMT QA Press-Shop",
      "SMT QA Paint-Shop",
      "Admin",
      "Sales",
      "Purchase",
      "Store"
    ];
  }
});

// server/dataStore.ts
import fs2 from "fs";
import path2 from "path";
import os2 from "os";
function ensureDataFile() {
  if (!fs2.existsSync(DATA_DIR)) {
    fs2.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs2.existsSync(DATA_FILE)) {
    fs2.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
  }
}
function readAppData() {
  ensureDataFile();
  try {
    const raw = fs2.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      settings: {
        locations: parsed.settings?.locations ?? [],
        plants: parsed.settings?.plants ?? [],
        assetFields: parsed.settings?.assetFields?.length ? parsed.settings.assetFields : DEFAULT_ASSET_FIELDS,
        catalog: mergeCatalog(parsed.settings?.catalog),
        typeDefinitions: parsed.settings?.typeDefinitions,
        dbMode: parsed.settings?.dbMode
      }
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}
function writeAppData(data) {
  ensureDataFile();
  fs2.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
var isServerless, DATA_DIR, DATA_FILE, DEFAULT_ASSET_FIELDS, DEFAULT_DATA;
var init_dataStore = __esm({
  "server/dataStore.ts"() {
    init_assetCatalogDefaults();
    isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
    DATA_DIR = isServerless ? path2.join(os2.tmpdir(), "assetqr-data") : path2.join(process.cwd(), "data");
    DATA_FILE = path2.join(DATA_DIR, "app-data.json");
    DEFAULT_ASSET_FIELDS = [
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
      { key: "contactMobile", label: "Contact Mobile", enabled: true }
    ];
    DEFAULT_DATA = {
      users: [],
      settings: {
        locations: [],
        plants: [],
        assetFields: DEFAULT_ASSET_FIELDS,
        catalog: defaultCatalog()
      }
    };
  }
});

// src/lib/assetCatalogByType.ts
function matchMainCategoryLabel(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (MAIN_CATEGORY_ALIASES[lower]) return MAIN_CATEGORY_ALIASES[lower];
  const fromSheetName = Object.entries(CATEGORY_SHEET_MAP).find(
    ([, sheetName]) => sheetName.toLowerCase() === lower
  );
  if (fromSheetName) return fromSheetName[0];
  const exact = MAIN_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return exact || null;
}
function mainCategoryFromAssetCode(code) {
  const m = String(code || "").trim().toUpperCase().match(/^([A-Z]+)-/);
  if (!m) return null;
  return CODE_PREFIX_TO_MAIN[m[1]] || null;
}
function healMisalignedCategoryFields(input) {
  let main = (input.mainCategory || "").trim();
  let sub = (input.subCategory || "").trim();
  let type = (input.assetType || "").trim();
  const make = (input.make || "").trim();
  const mainFromSub = matchMainCategoryLabel(sub);
  const mainFromType = matchMainCategoryLabel(type);
  if (mainFromSub && !matchMainCategoryLabel(main)) {
    main = mainFromSub;
    if (mainFromType) {
      type = make;
      sub = "";
    } else if (matchMainCategoryLabel(type)) {
      type = make;
      sub = "";
    } else {
      sub = type;
      type = make;
    }
  } else if (mainFromType && !matchMainCategoryLabel(main)) {
    main = mainFromType;
    type = make || sub;
    if (matchMainCategoryLabel(sub)) sub = "";
  }
  if (!matchMainCategoryLabel(main)) {
    const fromCode = mainCategoryFromAssetCode(input.assetCode || "");
    if (fromCode) main = fromCode;
  }
  main = normalizeMainCategory(main, {
    subCategory: sub,
    assetType: type,
    assetCode: input.assetCode
  });
  if (matchMainCategoryLabel(sub)) sub = "";
  if (matchMainCategoryLabel(type)) type = make || sub;
  if (main === "IT Assets" && !type && (make === "Laptop" || make === "Desktop")) {
    type = make;
  }
  if (main === "IT Assets" && type && !sub) {
    sub = subCategoryForItAssetType(type);
  }
  return { mainCategory: main, subCategory: sub, assetType: type };
}
function normalizeMainCategory(main, hints) {
  const trimmed = (main || "").trim();
  const lower = trimmed.toLowerCase();
  if (MAIN_CATEGORY_ALIASES[lower]) return MAIN_CATEGORY_ALIASES[lower];
  const fromSheetName = Object.entries(CATEGORY_SHEET_MAP).find(
    ([, sheetName]) => sheetName.toLowerCase() === lower
  );
  if (fromSheetName) return fromSheetName[0];
  const exact = MAIN_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const sub = hints?.subCategory?.trim();
  if (sub) {
    const subAsMain = matchMainCategoryLabel(sub);
    if (subAsMain) return subAsMain;
    if (SUB_TO_MAIN_MAP[sub]) return SUB_TO_MAIN_MAP[sub];
  }
  const type = hints?.assetType?.trim();
  if (type) {
    const typeAsMain = matchMainCategoryLabel(type);
    if (typeAsMain) return typeAsMain;
  }
  if (type === "Laptop" || type === "Desktop") return "IT Assets";
  if (type && PERIPHERAL_TYPES.includes(type)) return "IT Assets";
  const fromCode = hints?.assetCode ? mainCategoryFromAssetCode(hints.assetCode) : null;
  if (fromCode) return fromCode;
  if (!trimmed) return "IT Assets";
  return trimmed;
}
function subCategoryForItAssetType(assetType) {
  if (assetType === "Laptop" || assetType === "Desktop") return "Laptop / Desktop";
  if (assetType === "Camera" || assetType === "NVR") return "CCTV / Security Device";
  if (["Keyboard", "Mouse", "QR Scanner"].includes(assetType)) return "Input Device";
  if (assetType === "Monitor") return "Output Device";
  if (["Network Switch", "Network Rack", "Access Point", "Firewall", "Network Controller"].includes(
    assetType
  )) {
    return "Network Device";
  }
  if (assetType === "External HDD") return "Storage Device";
  if (assetType === "Printer") return "Printer / Scanner";
  if (assetType === "UPS") return "Server / UPS";
  return "Other IT Asset";
}
var MAIN_CATEGORIES, CATEGORY_SHEET_MAP, CATEGORY_SUBCATEGORIES, SUB_TO_MAIN_MAP, PERIPHERAL_TYPES, MAIN_CATEGORY_ALIASES, CODE_PREFIX_TO_MAIN, PERIPHERAL_GRID_TYPES;
var init_assetCatalogByType = __esm({
  "src/lib/assetCatalogByType.ts"() {
    MAIN_CATEGORIES = [
      "IT Assets",
      "Quality Assets",
      "Electrical Assets",
      "Production Assets",
      "Production",
      "Safety Assets",
      "Vehicle Assets",
      "Furniture Assets",
      "Software / License Assets",
      "Maintenance Assets",
      "IDU",
      "ODU",
      "IQC",
      "QA ELECTRONICS",
      "OPERATIONS",
      "OQC",
      "HE QUALITY",
      "SMT QA Press-Shop",
      "SMT QA Paint-Shop"
    ];
    CATEGORY_SHEET_MAP = {
      "IT Assets": "IT Assets",
      "Quality Assets": "Quality Assets",
      "Electrical Assets": "Electrical Assets",
      "Production Assets": "Production Assets",
      "Production": "Production Assets",
      "Safety Assets": "Safety Assets",
      "Vehicle Assets": "Vehicle Assets",
      "Furniture Assets": "Furniture Assets",
      "Software / License Assets": "Software License Assets",
      "Maintenance Assets": "Maintenance Assets",
      "IDU": "IDU",
      "ODU": "ODU",
      "IQC": "IQC",
      "QA ELECTRONICS": "QA ELECTRONICS",
      "OPERATIONS": "OPERATIONS",
      "OQC": "OQC",
      "HE QUALITY": "HE QUALITY",
      "SMT QA Press-Shop": "SMT QA Press-Shop",
      "SMT QA Paint-Shop": "SMT QA Paint-Shop"
    };
    CATEGORY_SUBCATEGORIES = {
      "Quality Assets": [
        "Precision Measuring Instrument",
        "AC Leak & Gas Charging Equipment",
        "Electrical Safety & Performance Rig",
        "Metrology & Calibration Standard",
        "Environmental & Psychrometric Testing",
        "Other Quality Tool"
      ],
      "IT Assets": [
        "Laptop / Desktop",
        "Input Device",
        "Output Device",
        "Network Device",
        "Storage Device",
        "Printer / Scanner",
        "CCTV / Security Device",
        "Server / UPS",
        "Other IT Asset"
      ],
      "Electrical Assets": [
        "Inverter",
        "Battery",
        "Stabilizer",
        "Control Panel",
        "LED Lights",
        "Exhaust Fan",
        "Extension Board",
        "Generator",
        "Electrical Meter",
        "Other Electrical Asset"
      ],
      "Production Assets": [
        "Machine",
        "Conveyor Belt",
        "Welding Machine",
        "Drill Machine",
        "Compressor",
        "Mould",
        "Die",
        "Tool",
        "Jig & Fixture",
        "Testing Machine",
        "Packing Machine",
        "Other Production Asset"
      ],
      "Production": [
        "Machine",
        "Conveyor Belt",
        "Welding Machine",
        "Drill Machine",
        "Compressor",
        "Mould",
        "Die",
        "Tool",
        "Jig & Fixture",
        "Testing Machine",
        "Packing Machine",
        "Other Production Asset"
      ],
      "Safety Assets": [
        "Fire Extinguisher",
        "First Aid Box",
        "Safety Helmet",
        "Safety Shoes",
        "Gloves",
        "Safety Goggles",
        "Emergency Light",
        "Fire Alarm System",
        "Smoke Detector",
        "Other Safety Asset"
      ],
      "Vehicle Assets": [
        "Company Car",
        "Bike",
        "Truck",
        "Forklift",
        "E-Rickshaw",
        "Battery Vehicle",
        "Vehicle Tools",
        "Vehicle Documents",
        "Other Vehicle Asset"
      ],
      "Furniture Assets": [
        "Workstation",
        "Table",
        "Meeting Table",
        "Chair",
        "Visitor Chair",
        "Sofa",
        "Almirah",
        "File Cabinet",
        "Locker",
        "Rack",
        "Storage Box",
        "Bench",
        "Whiteboard",
        "Fan",
        "AC",
        "Water Dispenser",
        "Refrigerator",
        "Tea/Coffee Machine",
        "Other Furniture Asset"
      ],
      "Software / License Assets": [
        "Windows License",
        "MS Office License",
        "Antivirus License",
        "ERP License",
        "Tally License",
        "AutoCAD License",
        "Cloud Subscription",
        "Domain / Hosting",
        "Other Software License"
      ],
      "Maintenance Assets": [
        "Screwdriver Set",
        "Spanner Set",
        "Multimeter",
        "Clamp Meter",
        "Ladder",
        "Tool Box",
        "Cutting Machine",
        "Grease Gun",
        "Measuring Tape"
      ],
      "IDU": [
        "Assembly Line",
        "Testing Rig",
        "Vacuum Station",
        "Gas Charging Station",
        "Packaging Line",
        "Other IDU Asset"
      ],
      "ODU": [
        "Assembly Line",
        "Compressor Mounting",
        "Brazing Station",
        "Performance Test Chamber",
        "Packaging Line",
        "Other ODU Asset"
      ],
      "IQC": [
        "Incoming Inspection Instrument",
        "Testing Gauge",
        "Sampling Tool",
        "Vernier / Micrometer",
        "Material Verification Rig",
        "Other IQC Asset"
      ],
      "QA ELECTRONICS": [
        "PCB Functional Tester",
        "Oscilloscope / Analyzer",
        "Digital Multimeter",
        "Soldering & Rework Station",
        "Component Reliability Tester",
        "Other QA Electronics Asset"
      ],
      "OPERATIONS": [
        "Production Line Equipment",
        "Material Handling Equipment",
        "Utility Support",
        "Workstation / Tooling",
        "Other Operations Asset"
      ],
      "OQC": [
        "Final Run Test Rig",
        "Safety & High-Pot Testing",
        "Pre-Dispatch Inspection",
        "Barcode & Packaging Scanner",
        "Other OQC Asset"
      ],
      "HE QUALITY": [
        "HE Inspection Standard",
        "Leak Detection Rig",
        "Performance Test Chamber",
        "Calibrated Master Tool",
        "Other HE Quality Asset"
      ],
      "SMT QA Press-Shop": [
        "Press Tool Inspection Equipment",
        "Dimensional Measurement Tool",
        "Surface Defect Inspection Rig",
        "Thickness Gauge / Micrometer",
        "Hardness Tester",
        "Other Press-Shop QA Asset"
      ],
      "SMT QA Paint-Shop": [
        "Paint Thickness Gauge (DFT)",
        "Gloss Meter",
        "Color Matching Cabinet / Spectrophotometer",
        "Adhesion Cross-Hatch Tester",
        "Baking Oven Temperature Logger",
        "Other Paint-Shop QA Asset"
      ]
    };
    SUB_TO_MAIN_MAP = {};
    Object.entries(CATEGORY_SUBCATEGORIES).forEach(([main, subs]) => {
      subs.forEach((sub) => {
        SUB_TO_MAIN_MAP[sub] = main;
      });
    });
    PERIPHERAL_TYPES = [
      "Monitor",
      "Keyboard",
      "Mouse",
      "UPS",
      "Printer",
      "QR Scanner",
      "Network Switch",
      "Camera",
      "NVR",
      "Network Rack",
      "Laptop Kit",
      "Attendance Machine",
      "External HDD",
      "Access Point",
      "Firewall",
      "Network Controller"
    ];
    MAIN_CATEGORY_ALIASES = {
      it: "IT Assets",
      "it assets": "IT Assets",
      "office assets": "Furniture Assets",
      "office asset": "Furniture Assets",
      furniture: "Furniture Assets",
      "furniture assets": "Furniture Assets",
      "software license assets": "Software / License Assets",
      "admin facility assets": "Furniture Assets",
      "admin / facility assets": "Furniture Assets",
      "production manufacturing assets": "Production",
      "production assets": "Production",
      production: "Production",
      idu: "IDU",
      odu: "ODU",
      iqc: "IQC",
      "qa electronics": "QA ELECTRONICS",
      operations: "OPERATIONS",
      oqc: "OQC",
      "he quality": "HE QUALITY",
      "smt qa press-shop": "SMT QA Press-Shop",
      "smt qa press shop": "SMT QA Press-Shop",
      "smt qa paint-shop": "SMT QA Paint-Shop",
      "smt qa paint shop": "SMT QA Paint-Shop"
    };
    CODE_PREFIX_TO_MAIN = {
      IT: "IT Assets",
      OFF: "Furniture Assets",
      ELE: "Electrical Assets",
      PRD: "Production Assets",
      SAF: "Safety Assets",
      VEH: "Vehicle Assets",
      FUR: "Furniture Assets",
      SW: "Software / License Assets",
      ADM: "Furniture Assets",
      MNT: "Maintenance Assets",
      IDU: "IDU",
      ODU: "ODU",
      IQC: "IQC",
      QAE: "QA ELECTRONICS",
      OPS: "OPERATIONS",
      OQC: "OQC",
      HEQ: "HE QUALITY",
      SQPR: "SMT QA Press-Shop",
      SQPA: "SMT QA Paint-Shop"
    };
    PERIPHERAL_GRID_TYPES = PERIPHERAL_TYPES.filter(
      (t) => t !== "Camera" && t !== "NVR"
    );
  }
});

// src/lib/assetDisplay.ts
function normToken(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}
function isItOnlyAssetType(type) {
  const t = type.trim();
  if (!t) return false;
  return IT_PRIMARY_TYPES.has(t) || PERIPHERAL_TYPES.includes(t);
}
function inferCategoryAssetType(mainCategory, assetName, subCategory, assetType) {
  const main = (mainCategory || "").trim();
  if (!main || main === "IT Assets") return "";
  const subs = CATEGORY_SUBCATEGORIES[main] || [];
  const sub = (subCategory || "").trim();
  const type = (assetType || "").trim();
  const name = (assetName || "").trim();
  if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) {
    if (subs.some((s) => normToken(s) === normToken(sub))) return sub;
  }
  if (type && !isGroupedSubCategory(type) && !isItOnlyAssetType(type)) {
    if (subs.some((s) => normToken(s) === normToken(type))) return type;
  }
  if (name) {
    const nameNorm = normToken(name);
    const exact = subs.find((s) => normToken(s) === nameNorm);
    if (exact) return exact;
    const partial = subs.find(
      (s) => nameNorm.includes(normToken(s)) || normToken(s).includes(nameNorm)
    );
    if (partial) return partial;
  }
  return subs[subs.length - 1] || "";
}
function defaultAssetTypeForCategory(mainCategory, subCategory) {
  const main = (mainCategory || "").trim();
  if (!main || main === "IT Assets") return "Laptop";
  const sub = (subCategory || "").trim();
  if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) return sub;
  const subs = CATEGORY_SUBCATEGORIES[main] || [];
  return subs[subs.length - 1] || sub || main;
}
function isGroupedSubCategory(value) {
  return GROUPED_SUB_CATEGORIES.has(value.trim().toLowerCase());
}
function hasDesktopPeripherals(asset) {
  return [
    asset.monitorSerial,
    asset.monitorAssetCode,
    asset.monitorMake,
    asset.monitorModel,
    asset.keyboardSerial,
    asset.keyboardAssetCode,
    asset.keyboardMake,
    asset.keyboardModel,
    asset.keyboardConnectivity,
    asset.mouseSerial,
    asset.mouseAssetCode,
    asset.mouseMake,
    asset.mouseModel,
    asset.mouseConnectivity,
    asset.upsSerial,
    asset.upsAssetCode,
    asset.upsMake,
    asset.upsModel
  ].some((v) => String(v || "").trim() !== "");
}
function inferLaptopOrDesktop(asset) {
  const typeLower = (asset.assetType || "").trim().toLowerCase();
  if (typeLower === "laptop") return "Laptop";
  if (typeLower === "desktop") return "Desktop";
  if (hasDesktopPeripherals(asset)) return "Desktop";
  const model = (asset.model || "").trim().toLowerCase();
  if (/\b(tc|tower|desktop|optiplex|thinkcentre|prodesk|elitedesk|rog strix gt)\b/.test(model)) {
    return "Desktop";
  }
  return "";
}
function inferCctvDeviceType(asset) {
  const type = (asset.assetType || "").trim();
  if (type === "Camera" || type === "NVR") return type;
  const sub = (asset.subCategory || "").trim().toLowerCase();
  const isCctvContext = sub === "cctv / security device" || type.toLowerCase() === "cctv / security device";
  const haystack = `${asset.make || ""} ${asset.model || ""}`.trim().toLowerCase();
  if (isCctvContext) {
    if (/(nvr|dvr|uvr|u-vr|uvm|network video|video recorder)/.test(haystack)) {
      return "NVR";
    }
    if (/(camera|ipc|bullet|dome|ptz|cctv cam)/.test(haystack)) {
      return "Camera";
    }
    return "Camera";
  }
  if (/(nvr|dvr|network video recorder)/.test(haystack)) {
    return "NVR";
  }
  return "";
}
function resolveSpecificAssetType(asset) {
  const main = (asset.mainCategory || "").trim();
  const type = (asset.assetType || "").trim();
  const sub = (asset.subCategory || "").trim();
  const name = (asset.assetName || "").trim();
  if (main && main !== "IT Assets") {
    if (type && !isItOnlyAssetType(type) && !isGroupedSubCategory(type)) return type;
    const inferred = inferCategoryAssetType(main, name, sub, type);
    if (inferred) return inferred;
    if (sub && !isGroupedSubCategory(sub) && !isItOnlyAssetType(sub)) return sub;
    return defaultAssetTypeForCategory(main, sub);
  }
  if (type === "Camera" || type === "NVR") return type;
  const cctvType = inferCctvDeviceType(asset);
  if (cctvType) return cctvType;
  if (type && !isGroupedSubCategory(type)) return type;
  const fromId = asset.assetTypeId ? TYPE_ID_LABELS[asset.assetTypeId.trim().toLowerCase()] : "";
  if (fromId) return fromId;
  const grouped = isGroupedSubCategory(sub) || isGroupedSubCategory(type) || !type && !sub;
  if (sub === "Laptop / Desktop" || type === "Laptop / Desktop" || grouped && sub.toLowerCase() === "laptop / desktop") {
    const inferred = inferLaptopOrDesktop(asset);
    if (inferred) return inferred;
  }
  if (sub && !isGroupedSubCategory(sub)) return sub;
  return type && !isGroupedSubCategory(type) ? type : "";
}
var IT_PRIMARY_TYPES, GROUPED_SUB_CATEGORIES, TYPE_ID_LABELS;
var init_assetDisplay = __esm({
  "src/lib/assetDisplay.ts"() {
    init_assetCatalogByType();
    IT_PRIMARY_TYPES = /* @__PURE__ */ new Set(["Laptop", "Desktop"]);
    GROUPED_SUB_CATEGORIES = /* @__PURE__ */ new Set([
      "laptop / desktop",
      "printer / scanner",
      "input device",
      "output device",
      "network device",
      "storage device",
      "cctv / security device",
      "server / ups"
    ]);
    TYPE_ID_LABELS = {
      laptop: "Laptop",
      desktop: "Desktop",
      printer: "Printer",
      scanner: "Scanner",
      monitor: "Monitor",
      keyboard: "Keyboard",
      mouse: "Mouse",
      ups: "UPS",
      server: "Server"
    };
  }
});

// src/lib/healAssetFields.ts
function trim(v) {
  return String(v ?? "").trim();
}
function isLikelyEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value);
}
function isLikelyDate(value) {
  const v = trim(value);
  if (!v) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(v)) return true;
  const n = Date.parse(v);
  return !Number.isNaN(n);
}
function isLikelyPhone(value) {
  const digits = trim(value).replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}
function isPoNumber(value) {
  return /^PO[-\s]?\d+/i.test(trim(value));
}
function isScanUrl(value) {
  return /\/scan\/[^/?#\s]+/i.test(trim(value));
}
function isDriveUrl(value) {
  return /drive\.google\.com/i.test(trim(value));
}
function looksLikePlantCode(value) {
  const v = trim(value);
  return /^\d{3,5}$/.test(v);
}
function looksLikeLocationName(value) {
  const u = trim(value).toUpperCase();
  if (!u || u.length < 3) return false;
  if (LOCATION_NAMES.has(u)) return true;
  return /^[A-Z][A-Z\s]{2,}$/.test(u) && !looksLikeDepartment(value) && !isLikelyEmail(value);
}
function looksLikeDepartment(value) {
  const u = trim(value).toUpperCase();
  if (!u) return false;
  if (DEPARTMENTS.has(u)) return true;
  return ["SECURITY", "ADMIN", "STORE", "PRODUCTION", "QUALITY"].some((d) => u.includes(d));
}
function looksLikeEmployeeId(value) {
  const v = trim(value).toUpperCase();
  if (!v) return false;
  if (/^(NGM|PGTL|PGEL|EMP|PG)\d+/i.test(v)) return true;
  if (/^[A-Z]{2,5}\d{3,}$/.test(v)) return true;
  return false;
}
function looksLikePersonName(value) {
  const v = trim(value);
  if (!v || isLikelyEmail(v) || isLikelyDate(v) || looksLikeEmployeeId(v)) return false;
  return /\s/.test(v) && /^[A-Za-z\s.'-]+$/.test(v);
}
function looksLikeVendorName(value) {
  const v = trim(value);
  if (!v || isPoNumber(v) || isLikelyDate(v)) return false;
  return /\b(LTD|PVT|PRIVATE|LIMITED|INC|CORP|CO\.)\b/i.test(v) || v.split(/\s+/).length >= 2;
}
function looksLikeAccountAssetCode(value) {
  return /^(AST|ACC)-[\w-]+$/i.test(trim(value));
}
function isLikelyRam(value) {
  return /^\d+\s*GB$/i.test(trim(value)) || /^[\d.]+\s*GB\s*RAM$/i.test(trim(value));
}
function isLikelyStorage(value) {
  const v = trim(value);
  return /^\d+\s*(GB|TB)$/i.test(v) || /NVMe|SSD|HDD/i.test(v);
}
function isLikelyCpu(value) {
  return /core\s*i[3579]|ryzen|celeron|pentium|xeon|apple\s*m/i.test(trim(value));
}
function isLikelyWindows(value) {
  return /windows\s*\d+/i.test(trim(value));
}
function isLikelyMac(value) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(trim(value));
}
function isLikelyIp(value) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(trim(value));
}
function normalizeDateOnly(value) {
  const v = trim(value);
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}
function healMakeModelBlock(a) {
  const make = trim(a.make);
  const model = trim(a.model);
  const serial = trim(a.serialNumber);
  const assetType = trim(a.assetType);
  const subCategory = trim(a.subCategory);
  if (make && (make === assetType || make === subCategory) && model && make !== model) {
    a.make = model;
    a.model = serial || model;
  }
}
function healAccountAssetCode(a) {
  const assetName = trim(a.assetName);
  if (looksLikeAccountAssetCode(assetName) && !trim(a.accountAssetCode)) {
    a.accountAssetCode = assetName;
    const type = trim(a.assetType);
    const make = trim(a.make);
    const model = trim(a.model);
    a.assetName = [type, make, model].filter(Boolean).join(" ").trim();
  }
}
function healQuantity(a) {
  const q = trim(a.quantity);
  if (!q) {
    a.quantity = "1";
    return;
  }
  if (isLikelyPhone(q)) {
    if (!trim(a.contactMobile)) a.contactMobile = q;
    a.quantity = "1";
    return;
  }
  if (!/^\d+$/.test(q)) a.quantity = "1";
}
function healSerialNumber(a) {
  const serial = trim(a.serialNumber);
  const model = trim(a.model);
  if (!serial || !model || serial !== model) return;
  const q = trim(a.quantity);
  if (q && !isLikelyPhone(q) && q !== serial && q.length >= 4 && !/^\d+$/.test(q)) {
    a.serialNumber = q;
    a.quantity = "1";
  } else {
    a.serialNumber = "";
  }
}
function itFieldsLookShifted(a) {
  const ssd = trim(a.ssd);
  const cpu = trim(a.cpu);
  const mac = trim(a.macAddress);
  const ip = trim(a.ipAddress);
  const ram = trim(a.ram);
  return isLikelyRam(ssd) || isLikelyStorage(cpu) && !isLikelyCpu(cpu) || isLikelyCpu(trim(a.windowsVersion)) || isLikelyMac(ip) || isLikelyWindows(mac) || isLikelyIp(trim(a.hostName)) && !isLikelyIp(ip) || isLikelyRam(ram) && !trim(a.ssd);
}
function healItSpecBlock(a) {
  const ram = trim(a.ram);
  if (isLikelyPhone(ram) && !isLikelyRam(ram)) {
    if (!trim(a.contactMobile)) a.contactMobile = ram;
    a.ram = "";
  }
  if (!itFieldsLookShifted(a)) return;
  const ssd = trim(a.ssd);
  const cpu = trim(a.cpu);
  const win = trim(a.windowsVersion);
  const mac = trim(a.macAddress);
  const ip = trim(a.ipAddress);
  const host = trim(a.hostName);
  if (isLikelyRam(ssd) && !trim(a.ram)) a.ram = ssd;
  if (isLikelyRam(ram) && !trim(a.ssd) && isLikelyStorage(cpu)) {
    a.ssd = cpu;
    a.cpu = isLikelyCpu(win) ? win : "";
    a.windowsVersion = isLikelyWindows(mac) ? mac : "";
  } else {
    if (isLikelyStorage(cpu)) a.ssd = cpu;
    if (isLikelyCpu(win)) a.cpu = win;
    if (isLikelyWindows(mac)) a.windowsVersion = mac;
  }
  if (isLikelyMac(ip)) {
    a.macAddress = ip;
    a.ipAddress = isLikelyIp(host) ? host : "";
    a.hostName = "";
  } else if (isLikelyMac(host)) {
    a.macAddress = host;
    a.ipAddress = isLikelyIp(ip) ? ip : "";
    a.hostName = "";
  } else if (isLikelyIp(host) && !isLikelyIp(ip)) {
    a.ipAddress = host;
    a.hostName = "";
  }
}
function healLocationEmployeeShift(a) {
  const location = trim(a.location);
  const department = trim(a.department);
  const plantCode = trim(a.plantCode);
  const contactName = trim(a.contactName);
  if (looksLikeEmployeeId(location) && looksLikeLocationName(department)) {
    a.location = department;
    a.employeeId = location;
    if (looksLikeDepartment(contactName)) {
      a.department = contactName;
      a.contactName = "";
    }
    if (/^\d{1,2}$/.test(plantCode)) {
      a.plantCode = "";
    }
  }
}
function healLocationAssigneeBlock(a) {
  const location = trim(a.location);
  const department = trim(a.department);
  if (!looksLikePlantCode(location) || !looksLikeLocationName(department)) return;
  const plant = location;
  const locName = department;
  a.plantCode = plant;
  a.location = locName;
  const contactName = trim(a.contactName);
  if (looksLikeDepartment(contactName)) {
    a.department = contactName;
    const employeeField = trim(a.employeeId);
    if (looksLikePersonName(employeeField)) {
      a.contactName = employeeField;
      const purchaseDateField2 = trim(a.purchaseDate);
      if (looksLikeEmployeeId(purchaseDateField2)) {
        a.employeeId = purchaseDateField2;
      } else if (looksLikeEmployeeId(employeeField)) {
        a.employeeId = employeeField;
        a.contactName = "";
      }
    }
  }
  const purchaseDateField = trim(a.purchaseDate);
  const purchaseCost = trim(a.purchaseCost);
  if (looksLikeEmployeeId(purchaseDateField)) {
    a.employeeId = purchaseDateField;
    if (isLikelyDate(purchaseCost)) {
      a.purchaseDate = normalizeDateOnly(purchaseCost);
      a.purchaseCost = "";
    } else {
      a.purchaseDate = "";
    }
  } else if (isLikelyDate(purchaseCost) && !trim(a.purchaseDate)) {
    a.purchaseDate = normalizeDateOnly(purchaseCost);
    a.purchaseCost = "";
  }
}
function healLocationPlantSwap(a) {
  const location = trim(a.location);
  const plantCode = trim(a.plantCode);
  if (looksLikePlantCode(location) && looksLikeLocationName(plantCode)) {
    a.location = plantCode;
    a.plantCode = location;
    return;
  }
  if (!location && looksLikeLocationName(plantCode)) {
    a.location = plantCode;
    a.plantCode = "";
  }
}
function healVendorInvoiceBlock(a) {
  const invoice = trim(a.invoiceNumber);
  const warrantyStart = trim(a.warrantyStartDate);
  const vendor = trim(a.vendorName);
  if (invoice && !isPoNumber(invoice) && !vendor && !isLikelyDate(invoice) && !isLikelyEmail(invoice)) {
    a.vendorName = invoice;
    a.invoiceNumber = "";
  }
  if (isPoNumber(warrantyStart)) {
    if (!trim(a.invoiceNumber)) a.invoiceNumber = warrantyStart;
    a.warrantyStartDate = "";
  }
  const invoiceAfter = trim(a.invoiceNumber);
  const vendorAfter = trim(a.vendorName);
  if (invoiceAfter && !isPoNumber(invoiceAfter) && looksLikeVendorName(invoiceAfter) && !vendorAfter) {
    a.vendorName = invoiceAfter;
    a.invoiceNumber = isPoNumber(warrantyStart) ? warrantyStart : "";
  }
}
function healContactMobile(a) {
  const mobile = trim(a.contactMobile);
  const ram = trim(a.ram);
  if (isLikelyDate(mobile)) {
    if (!trim(a.purchaseDate)) a.purchaseDate = normalizeDateOnly(mobile);
    if (isLikelyPhone(ram)) {
      a.contactMobile = ram;
      if (!isLikelyRam(ram)) a.ram = "";
    } else {
      a.contactMobile = "";
    }
    return;
  }
  if (!isLikelyPhone(mobile) && isLikelyPhone(ram) && !isLikelyRam(ram)) {
    a.contactMobile = ram;
    a.ram = "";
  }
}
function healUrlBlock(a) {
  const additional = trim(a.additionalItems);
  const qr = trim(a.qrCodeText);
  const doc = trim(a.documentUrl);
  let img = trim(a.imageUrl);
  const scanUrl = isScanUrl(additional) ? additional : isScanUrl(qr) ? qr : "";
  const drives = [doc, qr, img].filter((u) => isDriveUrl(u) && !isScanUrl(u));
  const uniqueDrives = [...new Set(drives)];
  if (isScanUrl(additional)) a.additionalItems = "";
  if (scanUrl) a.qrCodeText = scanUrl;
  if (img) {
    a.imageUrl = img;
  }
  const docDrive = uniqueDrives.find((u) => u !== trim(a.imageUrl));
  if (docDrive) {
    a.documentUrl = docDrive;
  } else if (isDriveUrl(doc) && doc !== trim(a.imageUrl)) {
    a.documentUrl = doc;
  }
}
function healStatusCondition(a) {
  const status = trim(a.status).toUpperCase();
  const maintenance = trim(a.maintenanceRequired);
  const existingCondition = trim(a.condition).toUpperCase();
  if (CONDITION_VALUES.has(status)) {
    if (!existingCondition || existingCondition === status) {
      a.condition = status.replace("EXISTING ASSET", "EXISTING ASSETS");
    }
    a.status = trim(a.employeeId) || trim(a.contactName) ? "Assigned" : "Available";
  }
  if (STATUS_VALUES.has(maintenance.toUpperCase())) {
    a.maintenanceRequired = "No";
    if (!trim(a.employeeId) && !trim(a.contactName)) {
      a.status = maintenance;
    }
  } else if (maintenance.toLowerCase() === "no" && trim(a.lastMaintenanceDate).toLowerCase() === "available") {
    a.status = "Available";
    a.lastMaintenanceDate = "";
  }
  if (trim(a.lastMaintenanceDate).toLowerCase() === "no") {
    a.lastMaintenanceDate = "";
  }
  if (trim(a.employeeId) || trim(a.contactName)) {
    a.status = "Assigned";
  }
}
function healAssignedDateBlock(a) {
  const assigned = trim(a.assignedDate);
  const empId = trim(a.employeeId);
  const contact = trim(a.contactName);
  const hasAssignee2 = !!(empId || contact);
  if (looksLikeEmployeeId(assigned)) {
    if (!empId) a.employeeId = assigned;
    a.assignedDate = "";
  }
  if (hasAssignee2 && !trim(a.assignedDate)) {
    const purchase = trim(a.purchaseDate);
    if (isLikelyDate(purchase) && !looksLikeEmployeeId(purchase) && !trim(a.purchaseCost)) {
      a.assignedDate = normalizeDateOnly(purchase);
    } else if (isLikelyDate(trim(a.updatedDate))) {
      a.assignedDate = normalizeDateOnly(String(a.updatedDate));
    } else if (isLikelyDate(trim(a.createdDate))) {
      a.assignedDate = normalizeDateOnly(String(a.createdDate));
    }
  }
}
function healWrongItTypeOnNonItAsset(a) {
  const main = trim(a.mainCategory);
  if (!main || main === "IT Assets") return;
  const type = trim(a.assetType);
  const itTypes = /* @__PURE__ */ new Set(["Laptop", "Desktop", ...PERIPHERAL_TYPES]);
  if (!itTypes.has(type)) return;
  const inferred = inferCategoryAssetType(
    main,
    trim(a.assetName),
    trim(a.subCategory),
    type
  );
  if (inferred) {
    a.assetType = inferred;
    const sub = trim(a.subCategory);
    if (!sub || itTypes.has(sub) || sub === "Laptop / Desktop") {
      a.subCategory = inferred;
    }
    if (a.assetTypeId === "laptop" || a.assetTypeId === "desktop") {
      a.assetTypeId = "";
    }
  }
}
function healAuditFields(a) {
  const createdBy = trim(a.createdBy);
  const createdDate = trim(a.createdDate);
  const updatedBy = trim(a.updatedBy);
  const updatedDate = trim(a.updatedDate);
  if (!createdBy && isLikelyEmail(createdDate)) {
    a.createdBy = createdDate;
    a.createdDate = isLikelyDate(updatedBy) ? normalizeDateOnly(updatedBy) : "";
  }
  if (isLikelyDate(updatedBy) && isLikelyEmail(updatedDate)) {
    a.updatedDate = normalizeDateOnly(updatedBy);
    a.updatedBy = updatedDate;
  } else if (isLikelyDate(updatedBy) && !updatedDate) {
    a.updatedDate = normalizeDateOnly(updatedBy);
    a.updatedBy = "";
  } else if (!updatedBy && isLikelyEmail(updatedDate)) {
    a.updatedBy = updatedDate;
  }
}
function healMisalignedAssetFields(asset) {
  if (!asset || typeof asset !== "object") return asset;
  const a = { ...asset };
  healMakeModelBlock(a);
  healAccountAssetCode(a);
  healQuantity(a);
  healSerialNumber(a);
  healLocationEmployeeShift(a);
  healLocationAssigneeBlock(a);
  healLocationPlantSwap(a);
  healVendorInvoiceBlock(a);
  healContactMobile(a);
  healItSpecBlock(a);
  healUrlBlock(a);
  healStatusCondition(a);
  healWrongItTypeOnNonItAsset(a);
  healAssignedDateBlock(a);
  healAuditFields(a);
  return a;
}
var LOCATION_NAMES, DEPARTMENTS, STATUS_VALUES, CONDITION_VALUES;
var init_healAssetFields = __esm({
  "src/lib/healAssetFields.ts"() {
    init_assetCatalogByType();
    init_assetDisplay();
    LOCATION_NAMES = /* @__PURE__ */ new Set([
      "BHIWADI",
      "NOIDA",
      "HEAD OFFICE",
      "HEAD OFFICE NOIDA",
      "GURGAON",
      "MANESAR",
      "PUNE",
      "CHENNAI",
      "HYDERABAD"
    ]);
    DEPARTMENTS = /* @__PURE__ */ new Set([
      "IT",
      "ADMIN",
      "SECURITY",
      "STORE",
      "PRODUCTION",
      "QUALITY",
      "HR",
      "FINANCE",
      "ACCOUNTS",
      "MAINTENANCE",
      "ENGINEERING",
      "PURCHASE",
      "LOGISTICS"
    ]);
    STATUS_VALUES = /* @__PURE__ */ new Set(["AVAILABLE", "ASSIGNED", "IN REPAIR", "RETIRED", "DISPOSED"]);
    CONDITION_VALUES = /* @__PURE__ */ new Set(["NEW PURCHASE", "EXISTING ASSETS", "EXISTING ASSET"]);
  }
});

// server/dedupeAssets.ts
function dedupeAssets(assets) {
  const byId = /* @__PURE__ */ new Map();
  const score = (a) => {
    const t = Date.parse(a.updatedDate || a.createdDate || "") || 0;
    return t;
  };
  const keep = (candidate, existing) => score(candidate) >= score(existing) ? candidate : existing;
  for (const a of assets) {
    const id = String(a.id || "").replace(/^0+/, "").trim();
    if (!id) continue;
    const current = byId.get(id);
    if (!current) {
      byId.set(id, a);
      continue;
    }
    byId.set(id, keep(a, current));
  }
  const out = Array.from(byId.values());
  return out.sort((x, y) => String(x.id).localeCompare(String(y.id), void 0, { numeric: true }));
}
var init_dedupeAssets = __esm({
  "server/dedupeAssets.ts"() {
  }
});

// server/env.ts
function cleanEnvValue(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function getEnv(name) {
  return cleanEnvValue(process.env[name]);
}
function setCleanEnv(name) {
  const clean = getEnv(name);
  if (clean) process.env[name] = clean;
  return clean;
}
function resolveEnv(names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return { name, value };
  }
  return { name: names[0] || "", value: "" };
}
function setCleanEnvAlias(canonicalName, aliases = []) {
  const resolved = resolveEnv([canonicalName, ...aliases]);
  if (resolved.value) process.env[canonicalName] = resolved.value;
  return resolved;
}
function maskValue(value, visible = 8) {
  if (!value) return "";
  if (value.length <= visible * 2) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
var init_env = __esm({
  "server/env.ts"() {
  }
});

// server/sqlConfig.ts
function isSupabaseMode() {
  return Boolean(getEnv("SUPABASE_URL") && (getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY")));
}
function isSqlMode() {
  if (isSupabaseMode()) return false;
  if (process.env.VERCEL || process.env.NETLIFY) return false;
  const value = getEnv("USE_SQL_SERVER").toLowerCase();
  if (value === "false" || value === "0" || value === "no") return false;
  if (value === "true" || value === "1" || value === "yes") return true;
  return Boolean(getEnv("SQL_SERVER") || getEnv("SQL_INSTANCE") || getEnv("SQL_DATABASE"));
}
function isDbMode() {
  return isSupabaseMode() || isSqlMode();
}
function getSupabaseUrl() {
  return getEnv("SUPABASE_URL").replace(/\/$/, "");
}
function getSupabaseSecret() {
  return getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
}
function isSqlBackendUrl(url) {
  return String(url || "").trim().toLowerCase().startsWith("sql://");
}
function parseSqlServer(raw) {
  const cleaned = String(raw || "localhost").trim().replace(/^\\\\/, "");
  if (cleaned.includes("\\")) {
    const [server, instanceName] = cleaned.split("\\");
    return { server: server || "localhost", instanceName: instanceName || void 0 };
  }
  return { server: cleaned || "localhost" };
}
function getSqlConnectionConfig() {
  const parsed = parseSqlServer(getEnv("SQL_SERVER") || "localhost");
  const instanceName = getEnv("SQL_INSTANCE") || parsed.instanceName || "AEMS";
  const portRaw = getEnv("SQL_PORT");
  const port = portRaw ? parseInt(portRaw, 10) : void 0;
  const server = parsed.server && parsed.server.toUpperCase() !== "AEMS" ? parsed.server : "localhost";
  return {
    user: getEnv("SQL_USER") || "aems_app",
    password: getEnv("SQL_PASSWORD") || "AemsLocal2026!Sql",
    server,
    database: getEnv("SQL_DATABASE") || "AEMS",
    port: Number.isFinite(port) ? port : void 0,
    options: {
      encrypt: getEnv("SQL_ENCRYPT") === "true",
      trustServerCertificate: getEnv("SQL_TRUST_CERT") !== "false",
      enableArithAbort: true,
      instanceName: Number.isFinite(port) ? void 0 : instanceName
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 3e4
    },
    connectionTimeout: 15e3,
    requestTimeout: 3e4
  };
}
var SQL_BACKEND_URL;
var init_sqlConfig = __esm({
  "server/sqlConfig.ts"() {
    init_env();
    SQL_BACKEND_URL = "sql://aems";
  }
});

// server/sheetHeaders.ts
function getDefaultAssetHeaders() {
  return [...CATEGORY_HEADERS, ...IT_EXTRA_HEADERS];
}
var CATEGORY_HEADERS, IT_EXTRA_HEADERS;
var init_sheetHeaders = __esm({
  "server/sheetHeaders.ts"() {
    CATEGORY_HEADERS = [
      "Asset ID",
      "Asset Code",
      "Account Asset Code",
      "Asset Name",
      "Main Category",
      "Sub Category",
      "Asset Type",
      "Brand",
      "Model",
      "Serial Number",
      "Quantity",
      "Plant Name",
      "Location",
      "Department",
      "Assigned To",
      "Employee ID",
      "Assigned Date",
      "Purchase Date",
      "Purchase Cost",
      "Vendor Name",
      "Invoice Number",
      "Warranty Start Date",
      "Warranty Expiry Date",
      "Condition",
      "Status",
      "Maintenance Required",
      "Last Maintenance Date",
      "Next Maintenance Date",
      "AMC Vendor",
      "AMC Start Date",
      "AMC End Date",
      "AMC Cost",
      "Photo URL / Photo Upload",
      "Document URL / Attached Documents",
      "QR Code / Barcode",
      "Remarks",
      "Created By",
      "Created Date",
      "Updated By",
      "Updated Date",
      "Contact Email",
      "Contact Number"
    ];
    IT_EXTRA_HEADERS = [
      "RAM",
      "SSD",
      "CPU",
      "Windows Version",
      "MAC Address",
      "IP Address",
      "Host Name",
      "Unique Code",
      "Binary Code",
      "Monitor Serial",
      "Monitor Asset Code",
      "Monitor Brand",
      "Monitor Model Number",
      "Keyboard Serial",
      "Keyboard Asset Code",
      "Keyboard Brand",
      "Keyboard Model Number",
      "Keyboard Connectivity",
      "Mouse Serial",
      "Mouse Asset Code",
      "Mouse Brand",
      "Mouse Model Number",
      "Mouse Connectivity",
      "UPS Serial",
      "UPS Asset Code",
      "UPS Brand",
      "UPS Model Number"
    ];
  }
});

// src/lib/constants.ts
var APP_NAME, APP_SHORT_NAME, DAY_MS, BUILD_TIMESTAMP;
var init_constants = __esm({
  "src/lib/constants.ts"() {
    APP_NAME = "Asset Entry Management System";
    APP_SHORT_NAME = "AEMS";
    DAY_MS = 24 * 60 * 60 * 1e3;
    BUILD_TIMESTAMP = Date.now();
  }
});

// server/emailTemplates.ts
function buildOtpEmailHtml(otp, minutesValid) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_SHORT_NAME} Login Code</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${APP_NAME}</h1>
              <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;font-weight:600;">Secure Login</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">Your one-time verification code is:</p>
              <div style="margin:20px 0;padding:20px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;text-align:center;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;font-family:Consolas,monospace;">${otp}</span>
              </div>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                This code expires in <strong>${minutesValid} minutes</strong>. Do not share it with anyone.
              </p>
              <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
                If you did not request this code, you can safely ignore this email. For help, contact your IT administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
                \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${APP_NAME} \u2022 Enterprise Asset Tracking
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
var init_emailTemplates = __esm({
  "server/emailTemplates.ts"() {
    init_constants();
  }
});

// server/sqlPool.ts
var sqlPool_exports = {};
__export(sqlPool_exports, {
  closeSqlPool: () => closeSqlPool,
  getSqlPool: () => getSqlPool,
  initSqlServer: () => initSqlServer
});
import sql from "mssql";
function connectionAttempts() {
  const base = getSqlConnectionConfig();
  const attempts = [base];
  if (base.options?.instanceName) {
    attempts.push({
      ...base,
      server: `${base.server}\\${base.options.instanceName}`,
      options: { ...base.options, instanceName: void 0 }
    });
    attempts.push({
      ...base,
      port: 57334,
      options: { ...base.options, instanceName: void 0 }
    });
    attempts.push({
      ...base,
      server: "127.0.0.1",
      port: 57334,
      options: { ...base.options, instanceName: void 0 }
    });
  }
  return attempts;
}
async function getSqlPool() {
  if (pool?.connected) return pool;
  const errors = [];
  for (const config of connectionAttempts()) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      return pool;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`SQL Server connection failed: ${errors.join(" | ")}`);
}
async function initSqlServer() {
  const config = getSqlConnectionConfig();
  console.log(
    `[SQL] Connecting to ${config.server}${config.options.instanceName ? "\\" + config.options.instanceName : ""} / ${config.database}`
  );
  const connected = await getSqlPool();
  if (!schemaReady) {
    await connected.request().batch(SCHEMA_SQL);
    schemaReady = true;
    console.log("[SQL] Schema ready");
  }
}
async function closeSqlPool() {
  if (pool) {
    await pool.close();
    pool = null;
    schemaReady = false;
  }
}
var pool, schemaReady, SCHEMA_SQL;
var init_sqlPool = __esm({
  "server/sqlPool.ts"() {
    init_sqlConfig();
    pool = null;
    schemaReady = false;
    SCHEMA_SQL = `
IF OBJECT_ID(N'dbo.Assets', N'U') IS NULL
CREATE TABLE dbo.Assets (
  Id NVARCHAR(64) NOT NULL PRIMARY KEY,
  AssetCode NVARCHAR(128) NULL,
  SerialNumber NVARCHAR(128) NULL,
  MainCategory NVARCHAR(128) NULL,
  Location NVARCHAR(128) NULL,
  PlantCode NVARCHAR(64) NULL,
  EmployeeId NVARCHAR(64) NULL,
  Status NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assets_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
CREATE TABLE dbo.Employees (
  EmployeeId NVARCHAR(64) NOT NULL PRIMARY KEY,
  Email NVARCHAR(256) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Employees_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
  Email NVARCHAR(256) NOT NULL PRIMARY KEY,
  Role NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Inventory', N'U') IS NULL
CREATE TABLE dbo.Inventory (
  ItemId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Inventory_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssignmentHistory', N'U') IS NULL
CREATE TABLE dbo.AssignmentHistory (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  AssetId NVARCHAR(64) NULL,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssignmentHistory_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.DamagedItems', N'U') IS NULL
CREATE TABLE dbo.DamagedItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DamagedItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.MissingItems', N'U') IS NULL
CREATE TABLE dbo.MissingItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MissingItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.ExtraItems', N'U') IS NULL
CREATE TABLE dbo.ExtraItems (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ExtraItems_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Assignments', N'U') IS NULL
CREATE TABLE dbo.Assignments (
  RecordId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assignments_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
CREATE TABLE dbo.AuditLogs (
  LogId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssetDetails', N'U') IS NULL
CREATE TABLE dbo.AssetDetails (
  AssetId NVARCHAR(64) NOT NULL,
  FieldKey NVARCHAR(128) NOT NULL,
  FieldValue NVARCHAR(MAX) NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetDetails_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_AssetDetails PRIMARY KEY (AssetId, FieldKey)
);

IF OBJECT_ID(N'dbo.Locations', N'U') IS NULL
CREATE TABLE dbo.Locations (
  LocationName NVARCHAR(128) NOT NULL PRIMARY KEY,
  Department NVARCHAR(128) NULL,
  CreatedDate NVARCHAR(64) NULL
);

IF OBJECT_ID(N'dbo.Plants', N'U') IS NULL
CREATE TABLE dbo.Plants (
  PlantCode NVARCHAR(64) NOT NULL PRIMARY KEY,
  PlantName NVARCHAR(256) NULL,
  LocationName NVARCHAR(128) NULL,
  CreatedDate NVARCHAR(64) NULL
);

IF OBJECT_ID(N'dbo.CatalogOptions', N'U') IS NULL
CREATE TABLE dbo.CatalogOptions (
  OptionType NVARCHAR(64) NOT NULL,
  OptionValue NVARCHAR(256) NOT NULL,
  CONSTRAINT PK_CatalogOptions PRIMARY KEY (OptionType, OptionValue)
);

IF OBJECT_ID(N'dbo.TypeDefinitions', N'U') IS NULL
CREATE TABLE dbo.TypeDefinitions (
  Id INT NOT NULL PRIMARY KEY CONSTRAINT DF_TypeDefinitions_Id DEFAULT 1,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_TypeDefinitions_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AppSettings', N'U') IS NULL
CREATE TABLE dbo.AppSettings (
  Id INT NOT NULL PRIMARY KEY CONSTRAINT DF_AppSettings_Id DEFAULT 1,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AppSettings_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.OtpLog', N'U') IS NULL
CREATE TABLE dbo.OtpLog (
  Email NVARCHAR(256) NOT NULL PRIMARY KEY,
  Otp NVARCHAR(16) NOT NULL,
  Expiry DATETIME2 NOT NULL,
  Attempts INT NOT NULL CONSTRAINT DF_OtpLog_Attempts DEFAULT 0,
  RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_OtpLog_RequestedAt DEFAULT SYSUTCDATETIME(),
  Status NVARCHAR(32) NULL
);

IF OBJECT_ID(N'dbo.UploadedFiles', N'U') IS NULL
CREATE TABLE dbo.UploadedFiles (
  FileId NVARCHAR(128) NOT NULL PRIMARY KEY,
  FileName NVARCHAR(256) NULL,
  MimeType NVARCHAR(128) NULL,
  DiskPath NVARCHAR(512) NULL,
  Url NVARCHAR(MAX) NULL,
  UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_UploadedFiles_UploadedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
CREATE TABLE dbo.Categories (
  CategoryName NVARCHAR(128) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Categories_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.AssetTypesLookup', N'U') IS NULL
CREATE TABLE dbo.AssetTypesLookup (
  TypeId NVARCHAR(64) NOT NULL PRIMARY KEY,
  JsonData NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetTypesLookup_UpdatedAt DEFAULT SYSUTCDATETIME()
);
`;
  }
});

// server/sqlStoreMssql.ts
var sqlStoreMssql_exports = {};
__export(sqlStoreMssql_exports, {
  addCatalogOption: () => addCatalogOption,
  bumpOtpAttempts: () => bumpOtpAttempts,
  countJsonRows: () => countJsonRows,
  deleteAssetDetails: () => deleteAssetDetails,
  deleteCatalogOption: () => deleteCatalogOption,
  deleteJsonRow: () => deleteJsonRow,
  deleteOtp: () => deleteOtp,
  getAppSettingsJson: () => getAppSettingsJson,
  getAssetDetailsMap: () => getAssetDetailsMap,
  getJsonRow: () => getJsonRow,
  getTypeDefinitionsJson: () => getTypeDefinitionsJson,
  getUploadedFile: () => getUploadedFile,
  listCatalogOptions: () => listCatalogOptions,
  listJsonRows: () => listJsonRows,
  listLocations: () => listLocations,
  listPlants: () => listPlants,
  readOtp: () => readOtp,
  replaceAllJsonRows: () => replaceAllJsonRows,
  replaceLocationsPlants: () => replaceLocationsPlants,
  saveAppSettingsJson: () => saveAppSettingsJson,
  saveAssetDetails: () => saveAssetDetails,
  saveOtp: () => saveOtp,
  saveTypeDefinitionsJson: () => saveTypeDefinitionsJson,
  saveUploadedFile: () => saveUploadedFile,
  upsertJsonRow: () => upsertJsonRow
});
import sql2 from "mssql";
function parseJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}
async function listJsonRows(table) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT JsonData FROM ${meta.table}`);
  return result.recordset.map((row) => parseJson(row.JsonData)).filter((row) => row != null);
}
async function countJsonRows(table) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT COUNT(*) AS Cnt FROM ${meta.table}`);
  return Number(result.recordset[0]?.Cnt || 0);
}
async function getJsonRow(table, id) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  const result = await pool2.request().input("id", sql2.NVarChar(256), id).query(`SELECT JsonData FROM ${meta.table} WHERE ${meta.id} = @id`);
  if (!result.recordset[0]) return null;
  return parseJson(result.recordset[0].JsonData) || null;
}
async function upsertJsonRow(table, id, data, extra) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  const json = JSON.stringify(data ?? {});
  const request = pool2.request().input("id", sql2.NVarChar(256), id).input("json", sql2.NVarChar(sql2.MAX), json);
  if (table === "Assets") {
    request.input("assetCode", sql2.NVarChar(128), extra?.AssetCode ?? null).input("serialNumber", sql2.NVarChar(128), extra?.SerialNumber ?? null).input("mainCategory", sql2.NVarChar(128), extra?.MainCategory ?? null).input("location", sql2.NVarChar(128), extra?.Location ?? null).input("plantCode", sql2.NVarChar(64), extra?.PlantCode ?? null).input("employeeId", sql2.NVarChar(64), extra?.EmployeeId ?? null).input("status", sql2.NVarChar(64), extra?.Status ?? null);
    await request.query(`
      MERGE dbo.Assets AS t
      USING (SELECT @id AS Id) AS s ON t.Id = s.Id
      WHEN MATCHED THEN UPDATE SET
        AssetCode = @assetCode, SerialNumber = @serialNumber, MainCategory = @mainCategory,
        Location = @location, PlantCode = @plantCode, EmployeeId = @employeeId, Status = @status,
        JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (Id, AssetCode, SerialNumber, MainCategory, Location, PlantCode, EmployeeId, Status, JsonData)
        VALUES (@id, @assetCode, @serialNumber, @mainCategory, @location, @plantCode, @employeeId, @status, @json);
    `);
    return;
  }
  if (table === "Employees") {
    request.input("email", sql2.NVarChar(256), extra?.Email ?? null);
    await request.query(`
      MERGE dbo.Employees AS t
      USING (SELECT @id AS EmployeeId) AS s ON t.EmployeeId = s.EmployeeId
      WHEN MATCHED THEN UPDATE SET Email = @email, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (EmployeeId, Email, JsonData) VALUES (@id, @email, @json);
    `);
    return;
  }
  if (table === "Users") {
    request.input("role", sql2.NVarChar(64), extra?.Role ?? null);
    await request.query(`
      MERGE dbo.Users AS t
      USING (SELECT @id AS Email) AS s ON t.Email = s.Email
      WHEN MATCHED THEN UPDATE SET Role = @role, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (Email, Role, JsonData) VALUES (@id, @role, @json);
    `);
    return;
  }
  if (table === "AssignmentHistory") {
    request.input("assetId", sql2.NVarChar(64), extra?.AssetId ?? null);
    await request.query(`
      MERGE dbo.AssignmentHistory AS t
      USING (SELECT @id AS RecordId) AS s ON t.RecordId = s.RecordId
      WHEN MATCHED THEN UPDATE SET AssetId = @assetId, JsonData = @json, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (RecordId, AssetId, JsonData) VALUES (@id, @assetId, @json);
    `);
    return;
  }
  if (table === "AuditLogs") {
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.AuditLogs WHERE LogId = @id)
        UPDATE dbo.AuditLogs SET JsonData = @json WHERE LogId = @id
      ELSE
        INSERT INTO dbo.AuditLogs (LogId, JsonData) VALUES (@id, @json);
    `);
    return;
  }
  await request.query(`
    MERGE ${meta.table} AS t
    USING (SELECT @id AS Id) AS s ON t.${meta.id} = s.Id
    WHEN MATCHED THEN UPDATE SET JsonData = @json, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (${meta.id}, JsonData) VALUES (@id, @json);
  `);
}
async function deleteJsonRow(table, id) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  const result = await pool2.request().input("id", sql2.NVarChar(256), id).query(`DELETE FROM ${meta.table} WHERE ${meta.id} = @id`);
  return (result.rowsAffected[0] || 0) > 0;
}
async function replaceAllJsonRows(table, rows) {
  const meta = TABLES[table];
  const pool2 = await getSqlPool();
  await pool2.request().query(`DELETE FROM ${meta.table}`);
  for (const row of rows) {
    await upsertJsonRow(table, row.id, row.data, row.extra);
  }
}
async function getAssetDetailsMap() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT AssetId, FieldKey, FieldValue FROM dbo.AssetDetails`);
  const map = {};
  for (const row of result.recordset) {
    const assetId = String(row.AssetId || "");
    if (!assetId) continue;
    if (!map[assetId]) map[assetId] = {};
    map[assetId][String(row.FieldKey)] = String(row.FieldValue ?? "");
  }
  return map;
}
async function saveAssetDetails(assetId, details) {
  const pool2 = await getSqlPool();
  await pool2.request().input("assetId", sql2.NVarChar(64), assetId).query(`DELETE FROM dbo.AssetDetails WHERE AssetId = @assetId`);
  for (const [key, value] of Object.entries(details || {})) {
    if (!String(key).trim()) continue;
    await pool2.request().input("assetId", sql2.NVarChar(64), assetId).input("fieldKey", sql2.NVarChar(128), key).input("fieldValue", sql2.NVarChar(sql2.MAX), String(value ?? "")).query(
      `INSERT INTO dbo.AssetDetails (AssetId, FieldKey, FieldValue) VALUES (@assetId, @fieldKey, @fieldValue)`
    );
  }
}
async function deleteAssetDetails(assetId) {
  const pool2 = await getSqlPool();
  await pool2.request().input("assetId", sql2.NVarChar(64), assetId).query(`DELETE FROM dbo.AssetDetails WHERE AssetId = @assetId`);
}
async function listLocations() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT LocationName, Department FROM dbo.Locations`);
  return result.recordset.map((row) => ({
    name: String(row.LocationName || ""),
    department: String(row.Department || "")
  }));
}
async function listPlants() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT PlantCode, PlantName, LocationName FROM dbo.Plants`);
  return result.recordset.map((row) => ({
    code: String(row.PlantCode || ""),
    name: String(row.PlantName || ""),
    location: String(row.LocationName || "")
  }));
}
async function replaceLocationsPlants(locations, plants) {
  const pool2 = await getSqlPool();
  await pool2.request().query(`DELETE FROM dbo.Locations; DELETE FROM dbo.Plants;`);
  for (const name of locations) {
    const clean = String(name || "").trim();
    if (!clean) continue;
    await pool2.request().input("name", sql2.NVarChar(128), clean).input("created", sql2.NVarChar(64), (/* @__PURE__ */ new Date()).toISOString()).query(`INSERT INTO dbo.Locations (LocationName, CreatedDate) VALUES (@name, @created)`);
  }
  for (const plant of plants) {
    const code = String(plant.code || "").trim();
    if (!code) continue;
    await pool2.request().input("code", sql2.NVarChar(64), code).input("name", sql2.NVarChar(256), plant.name || "").input("location", sql2.NVarChar(128), plant.location || "").input("created", sql2.NVarChar(64), (/* @__PURE__ */ new Date()).toISOString()).query(
      `INSERT INTO dbo.Plants (PlantCode, PlantName, LocationName, CreatedDate) VALUES (@code, @name, @location, @created)`
    );
  }
}
async function listCatalogOptions() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT OptionType, OptionValue FROM dbo.CatalogOptions`);
  const options = {};
  for (const row of result.recordset) {
    const type = String(row.OptionType || "");
    const value = String(row.OptionValue || "");
    if (!type || !value) continue;
    if (!options[type]) options[type] = [];
    options[type].push(value);
  }
  return options;
}
async function addCatalogOption(type, value) {
  const pool2 = await getSqlPool();
  await pool2.request().input("type", sql2.NVarChar(64), type).input("value", sql2.NVarChar(256), value).query(
    `IF NOT EXISTS (SELECT 1 FROM dbo.CatalogOptions WHERE OptionType = @type AND OptionValue = @value)
       INSERT INTO dbo.CatalogOptions (OptionType, OptionValue) VALUES (@type, @value)`
  );
}
async function deleteCatalogOption(type, value) {
  const pool2 = await getSqlPool();
  await pool2.request().input("type", sql2.NVarChar(64), type).input("value", sql2.NVarChar(256), value).query(`DELETE FROM dbo.CatalogOptions WHERE OptionType = @type AND OptionValue = @value`);
}
async function getAppSettingsJson() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT JsonData FROM dbo.AppSettings WHERE Id = 1`);
  return parseJson(result.recordset[0]?.JsonData) || null;
}
async function saveAppSettingsJson(data) {
  const pool2 = await getSqlPool();
  await pool2.request().input("json", sql2.NVarChar(sql2.MAX), JSON.stringify(data ?? {})).query(`
      IF EXISTS (SELECT 1 FROM dbo.AppSettings WHERE Id = 1)
        UPDATE dbo.AppSettings SET JsonData = @json, UpdatedAt = SYSUTCDATETIME() WHERE Id = 1
      ELSE
        INSERT INTO dbo.AppSettings (Id, JsonData) VALUES (1, @json);
    `);
}
async function getTypeDefinitionsJson() {
  const pool2 = await getSqlPool();
  const result = await pool2.request().query(`SELECT JsonData FROM dbo.TypeDefinitions WHERE Id = 1`);
  return parseJson(result.recordset[0]?.JsonData);
}
async function saveTypeDefinitionsJson(data) {
  const pool2 = await getSqlPool();
  await pool2.request().input("json", sql2.NVarChar(sql2.MAX), JSON.stringify(data ?? {})).query(`
      IF EXISTS (SELECT 1 FROM dbo.TypeDefinitions WHERE Id = 1)
        UPDATE dbo.TypeDefinitions SET JsonData = @json, UpdatedAt = SYSUTCDATETIME() WHERE Id = 1
      ELSE
        INSERT INTO dbo.TypeDefinitions (Id, JsonData) VALUES (1, @json);
    `);
}
async function saveOtp(email, otp, expiry) {
  const pool2 = await getSqlPool();
  await pool2.request().input("email", sql2.NVarChar(256), email).input("otp", sql2.NVarChar(16), otp).input("expiry", sql2.DateTime2, expiry).query(`
      MERGE dbo.OtpLog AS t
      USING (SELECT @email AS Email) AS s ON t.Email = s.Email
      WHEN MATCHED THEN UPDATE SET Otp = @otp, Expiry = @expiry, Attempts = 0, RequestedAt = SYSUTCDATETIME(), Status = N'sent'
      WHEN NOT MATCHED THEN INSERT (Email, Otp, Expiry, Attempts, Status) VALUES (@email, @otp, @expiry, 0, N'sent');
    `);
}
async function readOtp(email) {
  const pool2 = await getSqlPool();
  const result = await pool2.request().input("email", sql2.NVarChar(256), email).query(`SELECT Otp, Expiry, Attempts FROM dbo.OtpLog WHERE Email = @email`);
  const row = result.recordset[0];
  if (!row) return null;
  return { otp: String(row.Otp), expiry: new Date(row.Expiry), attempts: Number(row.Attempts || 0) };
}
async function bumpOtpAttempts(email, attempts) {
  const pool2 = await getSqlPool();
  await pool2.request().input("email", sql2.NVarChar(256), email).input("attempts", sql2.Int, attempts).query(`UPDATE dbo.OtpLog SET Attempts = @attempts WHERE Email = @email`);
}
async function deleteOtp(email) {
  const pool2 = await getSqlPool();
  await pool2.request().input("email", sql2.NVarChar(256), email).query(`DELETE FROM dbo.OtpLog WHERE Email = @email`);
}
async function saveUploadedFile(record) {
  const pool2 = await getSqlPool();
  await pool2.request().input("fileId", sql2.NVarChar(128), record.fileId).input("fileName", sql2.NVarChar(256), record.fileName).input("mimeType", sql2.NVarChar(128), record.mimeType).input("diskPath", sql2.NVarChar(512), record.diskPath).input("url", sql2.NVarChar(sql2.MAX), record.url).query(
    `INSERT INTO dbo.UploadedFiles (FileId, FileName, MimeType, DiskPath, Url)
       VALUES (@fileId, @fileName, @mimeType, @diskPath, @url)`
  );
}
async function getUploadedFile(fileId) {
  const pool2 = await getSqlPool();
  const result = await pool2.request().input("fileId", sql2.NVarChar(128), fileId).query(`SELECT FileId, FileName, MimeType, DiskPath, Url FROM dbo.UploadedFiles WHERE FileId = @fileId`);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    fileId: String(row.FileId),
    fileName: String(row.FileName || ""),
    mimeType: String(row.MimeType || ""),
    diskPath: String(row.DiskPath || ""),
    url: String(row.Url || "")
  };
}
var TABLES;
var init_sqlStoreMssql = __esm({
  "server/sqlStoreMssql.ts"() {
    init_sqlPool();
    TABLES = {
      Assets: { table: "dbo.Assets", id: "Id" },
      Employees: { table: "dbo.Employees", id: "EmployeeId" },
      Users: { table: "dbo.Users", id: "Email" },
      Inventory: { table: "dbo.Inventory", id: "ItemId" },
      AssignmentHistory: { table: "dbo.AssignmentHistory", id: "RecordId" },
      DamagedItems: { table: "dbo.DamagedItems", id: "RecordId" },
      MissingItems: { table: "dbo.MissingItems", id: "RecordId" },
      ExtraItems: { table: "dbo.ExtraItems", id: "RecordId" },
      Assignments: { table: "dbo.Assignments", id: "RecordId" },
      AuditLogs: { table: "dbo.AuditLogs", id: "LogId" },
      Categories: { table: "dbo.Categories", id: "CategoryName" },
      AssetTypesLookup: { table: "dbo.AssetTypesLookup", id: "TypeId" }
    };
  }
});

// server/supabaseClient.ts
function headers(extra = {}) {
  const key = getSupabaseSecret();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}
async function sbFetch(path20, init = {}) {
  const url = `${getSupabaseUrl()}${path20}`;
  return fetch(url, {
    ...init,
    headers: { ...headers(init.headers), ...init.headers || {} }
  });
}
async function sbJson(path20, init = {}) {
  const response = await sbFetch(path20, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase ${response.status} ${path20}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}
async function createBucket(id, isPublic, fileSizeLimit) {
  const existing = await sbFetch("/storage/v1/bucket");
  const buckets = existing.ok ? await existing.json() : [];
  if (buckets.some((b) => b.id === id)) return;
  const created = await sbFetch("/storage/v1/bucket", {
    method: "POST",
    body: JSON.stringify({ id, name: id, public: isPublic, fileSizeLimit })
  });
  if (!created.ok) {
    const text = await created.text();
    if (!/already exists|duplicate/i.test(text)) {
      throw new Error(`Storage bucket ${id} failed: ${text}`);
    }
  }
}
async function ensureStorageBucket() {
  await createBucket(FILES_BUCKET, true, 15728640);
  await createBucket(DATA_BUCKET, false, 52428800);
}
function publicFileUrl(objectPath) {
  return `${getSupabaseUrl()}/storage/v1/object/public/${FILES_BUCKET}/${objectPath}`;
}
async function uploadToStorage(objectPath, bytes, mimeType, bucket = FILES_BUCKET) {
  await ensureStorageBucket();
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: getSupabaseSecret(),
      Authorization: `Bearer ${getSupabaseSecret()}`,
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true"
    },
    body: new Uint8Array(bytes)
  });
  if (!response.ok) {
    throw new Error(`File upload failed: ${await response.text()}`);
  }
  if (bucket === FILES_BUCKET) return publicFileUrl(objectPath);
  return `${bucket}/${objectPath}`;
}
async function downloadFromStorage(objectPath, bucket = FILES_BUCKET) {
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: {
      apikey: getSupabaseSecret(),
      Authorization: `Bearer ${getSupabaseSecret()}`
    }
  });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType: response.headers.get("content-type") || "application/octet-stream" };
}
var FILES_BUCKET, DATA_BUCKET;
var init_supabaseClient = __esm({
  "server/supabaseClient.ts"() {
    init_sqlConfig();
    FILES_BUCKET = "aems-files";
    DATA_BUCKET = "aems-data";
  }
});

// server/postgresMirror.ts
function txt(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => txt(item)).filter(Boolean).join(", ");
  return String(value);
}
function assetToPostgresRow(id, data, extra) {
  return {
    id,
    asset_code: txt(extra?.AssetCode || data.assetCode),
    account_asset_code: txt(data.accountAssetCode),
    asset_name: txt(data.assetName),
    main_category: txt(extra?.MainCategory || data.mainCategory),
    sub_category: txt(data.subCategory),
    asset_type: txt(data.assetType),
    brand: txt(data.make),
    model: txt(data.model),
    serial_number: txt(extra?.SerialNumber || data.serialNumber),
    quantity: txt(data.quantity),
    plant_code: txt(extra?.PlantCode || data.plantCode),
    location: txt(extra?.Location || data.location),
    department: txt(data.department),
    assigned_to: txt(data.contactName),
    employee_id: txt(extra?.EmployeeId || data.employeeId),
    assigned_date: txt(data.assignedDate),
    purchase_date: txt(data.purchaseDate),
    purchase_cost: txt(data.purchaseCost),
    vendor_name: txt(data.vendorName),
    invoice_number: txt(data.invoiceNumber),
    warranty_start: txt(data.warrantyStartDate),
    warranty_end: txt(data.warrantyEndDate),
    condition: txt(data.condition),
    status: txt(extra?.Status || data.status),
    ram: txt(data.ram),
    ssd: txt(data.ssd),
    cpu: txt(data.cpu),
    windows_version: txt(data.windowsVersion),
    mac_address: txt(data.macAddress),
    ip_address: txt(data.ipAddress),
    host_name: txt(data.hostName),
    contact_email: txt(data.contactEmail),
    contact_mobile: txt(data.contactMobile),
    photo_url: txt(data.imageUrl),
    document_url: txt(data.documentUrl),
    json_data: data
  };
}
async function mirrorAssetToPostgres(id, data, extra) {
  const probe = await sbFetch("/rest/v1/assets?select=id&limit=1");
  if (!probe.ok) return;
  await sbJson("/rest/v1/assets?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(assetToPostgresRow(id, data || {}, extra))
  });
}
async function mirrorUserToPostgres(email, data) {
  const probe = await sbFetch("/rest/v1/users?select=email&limit=1");
  if (!probe.ok) return;
  const d = data || {};
  const row = {
    email: String(d.email || email).trim().toLowerCase(),
    role: String(d.role || "User"),
    locations: txt(d.locations),
    plants: txt(d.plants),
    categories: txt(d.categories),
    json_data: data
  };
  await sbJson("/rest/v1/users?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
}
async function deleteMirroredUser(email) {
  await sbJson(`/rest/v1/users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => void 0);
}
async function mirrorEmployeeToPostgres(employeeId, data) {
  const probe = await sbFetch("/rest/v1/employees?select=employee_id&limit=1");
  if (!probe.ok) return;
  const d = data || {};
  const row = {
    employee_id: String(d.employeeId || employeeId).trim().toUpperCase(),
    name: txt(d.name),
    email: txt(d.email),
    phone: txt(d.phone),
    department: txt(d.department),
    designation: txt(d.designation),
    location: txt(d.location),
    plant: txt(d.plant),
    status: txt(d.status || "Active"),
    json_data: data
  };
  await sbJson("/rest/v1/employees?on_conflict=employee_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
}
async function deleteMirroredEmployee(employeeId) {
  await sbJson(`/rest/v1/employees?employee_id=eq.${encodeURIComponent(employeeId)}`, { method: "DELETE" }).catch(() => void 0);
}
async function mirrorOtpToPostgres(email, otp, expiry, status = "sent") {
  const probe = await sbFetch("/rest/v1/otp_log?select=email&limit=1");
  if (!probe.ok) return;
  const row = {
    email: email.trim().toLowerCase(),
    otp,
    expiry: expiry.toISOString(),
    status,
    attempts: 0,
    requested_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await sbJson("/rest/v1/otp_log?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  });
}
async function deleteMirroredOtp(email) {
  await sbJson(`/rest/v1/otp_log?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => void 0);
}
async function mirrorAuditLogToPostgres(record) {
  const probe = await sbFetch("/rest/v1/audit_logs?select=log_id&limit=1");
  if (!probe.ok) return;
  const row = {
    log_id: txt(record["Log ID"] || record.log_id || record.id),
    user_email: txt(record["User Email"] || record.user_email || record.userEmail),
    action: txt(record["Action"] || record.action),
    target_id: txt(record["Target ID"] || record.target_id || record.targetId),
    date_time: txt(record["Date & Time"] || record.date_time || record.dateTime || (/* @__PURE__ */ new Date()).toISOString()),
    old_value: txt(record["Old Value"] || record.old_value || record.oldValue),
    new_value: txt(record["New Value"] || record.new_value || record.newValue),
    remarks: txt(record["Remarks"] || record.remarks)
  };
  await sbJson("/rest/v1/audit_logs?on_conflict=log_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  }).catch(() => void 0);
}
async function deleteMirroredAsset(id) {
  await sbJson(`/rest/v1/assets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => void 0);
}
async function mirrorMachineToPostgres(machine) {
  const probe = await sbFetch("/rest/v1/maintenance_machines?select=id&limit=1");
  if (!probe.ok) return;
  const row = {
    id: txt(machine.id),
    asset_code: txt(machine.assetCode),
    machine_type: txt(machine.machineType),
    machine_number: txt(machine.machineNumber),
    equipment_name: txt(machine.equipmentName),
    department: txt(machine.department),
    responsibility: txt(machine.responsibility),
    location: txt(machine.location),
    plant_code: txt(machine.plantCode),
    warranty_status: txt(machine.warrantyStatus),
    model_number: txt(machine.modelNumber),
    serial_number: txt(machine.serialNumber),
    trend_months: typeof machine.trendMonths === "number" ? machine.trendMonths : null,
    next_maintenance_date: txt(machine.nextMaintenanceDate),
    last_maintenance_date: txt(machine.lastMaintenanceDate),
    status: txt(machine.status),
    remarks: txt(machine.remarks),
    json_data: machine
  };
  await sbJson("/rest/v1/maintenance_machines?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  }).catch(() => void 0);
}
async function deleteMirroredMachine(id) {
  await sbJson(`/rest/v1/maintenance_machines?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => void 0);
}
var init_postgresMirror = __esm({
  "server/postgresMirror.ts"() {
    init_supabaseClient();
  }
});

// server/supabaseStore.ts
var supabaseStore_exports = {};
__export(supabaseStore_exports, {
  addCatalogOption: () => addCatalogOption2,
  bumpOtpAttempts: () => bumpOtpAttempts2,
  countJsonRows: () => countJsonRows2,
  deleteAssetDetails: () => deleteAssetDetails2,
  deleteCatalogOption: () => deleteCatalogOption2,
  deleteJsonRow: () => deleteJsonRow2,
  deleteOtp: () => deleteOtp2,
  getAppSettingsJson: () => getAppSettingsJson2,
  getAssetDetailsMap: () => getAssetDetailsMap2,
  getJsonRow: () => getJsonRow2,
  getTypeDefinitionsJson: () => getTypeDefinitionsJson2,
  getUploadedFile: () => getUploadedFile2,
  listCatalogOptions: () => listCatalogOptions2,
  listJsonRows: () => listJsonRows2,
  listLocations: () => listLocations2,
  listPlants: () => listPlants2,
  readOtp: () => readOtp2,
  replaceAllJsonRows: () => replaceAllJsonRows2,
  replaceAssetDetailsMap: () => replaceAssetDetailsMap,
  replaceLocationsPlants: () => replaceLocationsPlants2,
  saveAppSettingsJson: () => saveAppSettingsJson2,
  saveAssetDetails: () => saveAssetDetails2,
  saveOtp: () => saveOtp2,
  saveTypeDefinitionsJson: () => saveTypeDefinitionsJson2,
  saveUploadedFile: () => saveUploadedFile2,
  upsertJsonRow: () => upsertJsonRow2
});
function rowJson(row) {
  if (!row) return null;
  return row.json_data ?? row;
}
async function withLock(name, fn) {
  const previous = locks.get(name) || Promise.resolve();
  let release = () => void 0;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(
    name,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
async function loadFile(name, fallback) {
  const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
  if (!remote) return fallback;
  try {
    return JSON.parse(new TextDecoder().decode(remote.bytes));
  } catch {
    return fallback;
  }
}
async function saveFile(name, data) {
  await uploadToStorage(`tables/${name}.json`, Buffer.from(JSON.stringify(data)), "application/json", DATA_BUCKET);
}
async function loadRows(table) {
  return loadFile(TABLES2[table].table, []);
}
async function saveRows(table, rows) {
  await saveFile(TABLES2[table].table, rows);
}
async function listJsonRows2(table) {
  const rows = await loadRows(table);
  return rows.map((row) => rowJson(row)).filter(Boolean);
}
async function countJsonRows2(table) {
  return (await loadRows(table)).length;
}
async function getJsonRow2(table, id) {
  const meta = TABLES2[table];
  const rows = await loadRows(table);
  return rowJson(rows.find((row) => String(row[meta.id] || "") === id));
}
async function upsertJsonRow2(table, id, data, extra) {
  await withLock(table, async () => {
    const meta = TABLES2[table];
    const rows = await loadRows(table);
    const body = { [meta.id]: id, json_data: data ?? {} };
    if (table === "Assets") {
      body.asset_code = extra?.AssetCode ?? null;
      body.serial_number = extra?.SerialNumber ?? null;
      body.main_category = extra?.MainCategory ?? null;
      body.location = extra?.Location ?? null;
      body.plant_code = extra?.PlantCode ?? null;
      body.employee_id = extra?.EmployeeId ?? null;
      body.status = extra?.Status ?? null;
    }
    if (table === "Employees") body.email = extra?.Email ?? null;
    if (table === "Users") body.role = extra?.Role ?? null;
    if (table === "AssignmentHistory") body.asset_id = extra?.AssetId ?? null;
    const index = rows.findIndex((row) => String(row[meta.id] || "") === id);
    if (index >= 0) rows[index] = body;
    else rows.push(body);
    await saveRows(table, rows);
    if (table === "Assets") {
      await mirrorAssetToPostgres(id, data, extra).catch((error) => {
        console.warn("[Supabase] Postgres mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
    if (table === "Users") {
      await mirrorUserToPostgres(id, data).catch((error) => {
        console.warn("[Supabase] Users mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
    if (table === "Employees") {
      await mirrorEmployeeToPostgres(id, data).catch((error) => {
        console.warn("[Supabase] Employees mirror skipped:", error instanceof Error ? error.message : error);
      });
    }
  });
}
async function deleteJsonRow2(table, id) {
  return withLock(table, async () => {
    const meta = TABLES2[table];
    const rows = await loadRows(table);
    const next = rows.filter((row) => String(row[meta.id] || "") !== id);
    await saveRows(table, next);
    if (table === "Assets") {
      await deleteMirroredAsset(id).catch(() => void 0);
    }
    if (table === "Users") {
      await deleteMirroredUser(id).catch(() => void 0);
    }
    if (table === "Employees") {
      await deleteMirroredEmployee(id).catch(() => void 0);
    }
    return next.length !== rows.length;
  });
}
async function replaceAllJsonRows2(table, rows) {
  await withLock(table, async () => {
    const meta = TABLES2[table];
    const built = rows.map((row) => {
      const body = { [meta.id]: row.id, json_data: row.data ?? {} };
      if (table === "Assets") {
        body.asset_code = row.extra?.AssetCode ?? null;
        body.serial_number = row.extra?.SerialNumber ?? null;
        body.main_category = row.extra?.MainCategory ?? null;
        body.location = row.extra?.Location ?? null;
        body.plant_code = row.extra?.PlantCode ?? null;
        body.employee_id = row.extra?.EmployeeId ?? null;
        body.status = row.extra?.Status ?? null;
      }
      if (table === "Employees") body.email = row.extra?.Email ?? null;
      if (table === "Users") body.role = row.extra?.Role ?? null;
      if (table === "AssignmentHistory") body.asset_id = row.extra?.AssetId ?? null;
      return body;
    });
    await saveRows(table, built);
  });
}
async function getAssetDetailsMap2() {
  const rows = await loadFile("asset_details", []);
  const map = {};
  for (const row of rows) {
    if (!map[row.asset_id]) map[row.asset_id] = {};
    map[row.asset_id][row.field_key] = String(row.field_value ?? "");
  }
  return map;
}
async function replaceAssetDetailsMap(map) {
  const rows = [];
  for (const [assetId, fields] of Object.entries(map || {})) {
    for (const [field_key, field_value] of Object.entries(fields || {})) {
      if (!field_key.trim()) continue;
      rows.push({ asset_id: assetId, field_key, field_value: String(field_value ?? "") });
    }
  }
  await saveFile("asset_details", rows);
}
async function saveAssetDetails2(assetId, details) {
  await withLock("asset_details", async () => {
    const rows = await loadFile("asset_details", []);
    const kept = rows.filter((row) => row.asset_id !== assetId);
    for (const [field_key, field_value] of Object.entries(details || {})) {
      if (!field_key.trim()) continue;
      kept.push({ asset_id: assetId, field_key, field_value: String(field_value ?? "") });
    }
    await saveFile("asset_details", kept);
  });
}
async function deleteAssetDetails2(assetId) {
  await withLock("asset_details", async () => {
    const rows = await loadFile("asset_details", []);
    await saveFile(
      "asset_details",
      rows.filter((row) => row.asset_id !== assetId)
    );
  });
}
async function listLocations2() {
  const rows = await loadFile("locations", []);
  return rows.map((row) => ({ name: row.location_name, department: row.department || "" }));
}
async function listPlants2() {
  const rows = await loadFile("plants", []);
  return rows.map((row) => ({
    code: row.plant_code,
    name: row.plant_name || "",
    location: row.location_name || ""
  }));
}
async function replaceLocationsPlants2(locations, plants) {
  await withLock("locations_plants", async () => {
    await saveFile(
      "locations",
      locations.filter(Boolean).map((name) => ({
        location_name: name,
        created_date: (/* @__PURE__ */ new Date()).toISOString()
      }))
    );
    await saveFile(
      "plants",
      plants.filter((plant) => plant.code).map((plant) => ({
        plant_code: plant.code,
        plant_name: plant.name || "",
        location_name: plant.location || "",
        created_date: (/* @__PURE__ */ new Date()).toISOString()
      }))
    );
  });
}
async function listCatalogOptions2() {
  const rows = await loadFile("catalog_options", []);
  const options = {};
  for (const row of rows) {
    if (!options[row.option_type]) options[row.option_type] = [];
    options[row.option_type].push(row.option_value);
  }
  return options;
}
async function addCatalogOption2(type, value) {
  await withLock("catalog_options", async () => {
    const rows = await loadFile("catalog_options", []);
    if (rows.some((row) => row.option_type === type && row.option_value === value)) return;
    rows.push({ option_type: type, option_value: value });
    await saveFile("catalog_options", rows);
  });
}
async function deleteCatalogOption2(type, value) {
  await withLock("catalog_options", async () => {
    const rows = await loadFile("catalog_options", []);
    await saveFile(
      "catalog_options",
      rows.filter((row) => !(row.option_type === type && row.option_value === value))
    );
  });
}
async function getAppSettingsJson2() {
  return loadFile("app_settings", null);
}
async function saveAppSettingsJson2(data) {
  await saveFile("app_settings", data ?? {});
}
async function getTypeDefinitionsJson2() {
  return loadFile("type_definitions", null);
}
async function saveTypeDefinitionsJson2(data) {
  await saveFile("type_definitions", data ?? {});
}
async function saveOtp2(email, otp, expiry) {
  await withLock("otp_log", async () => {
    const rows = await loadFile("otp_log", []);
    const next = rows.filter((row) => String(row.email || "") !== email);
    next.push({
      email,
      otp,
      expiry: expiry.toISOString(),
      attempts: 0,
      requested_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: "sent"
    });
    await saveFile("otp_log", next);
    await mirrorOtpToPostgres(email, otp, expiry).catch((error) => {
      console.warn("[Supabase] OTP mirror skipped:", error instanceof Error ? error.message : error);
    });
  });
}
async function readOtp2(email) {
  const rows = await loadFile("otp_log", []);
  const row = rows.find((item) => String(item.email || "") === email);
  if (!row) return null;
  return { otp: String(row.otp || ""), expiry: new Date(String(row.expiry || "")), attempts: Number(row.attempts || 0) };
}
async function bumpOtpAttempts2(email, attempts) {
  await withLock("otp_log", async () => {
    const rows = await loadFile("otp_log", []);
    await saveFile(
      "otp_log",
      rows.map((row) => String(row.email || "") === email ? { ...row, attempts } : row)
    );
  });
}
async function deleteOtp2(email) {
  await withLock("otp_log", async () => {
    const rows = await loadFile("otp_log", []);
    await saveFile(
      "otp_log",
      rows.filter((row) => String(row.email || "") !== email)
    );
    await deleteMirroredOtp(email).catch(() => void 0);
  });
}
async function saveUploadedFile2(record) {
  await withLock("uploaded_files", async () => {
    const rows = await loadFile("uploaded_files", []);
    const body = {
      file_id: record.fileId,
      file_name: record.fileName,
      mime_type: record.mimeType,
      disk_path: record.diskPath,
      url: record.url
    };
    const index = rows.findIndex((row) => String(row.file_id || "") === record.fileId);
    if (index >= 0) rows[index] = body;
    else rows.push(body);
    await saveFile("uploaded_files", rows);
  });
}
async function getUploadedFile2(fileId) {
  const rows = await loadFile("uploaded_files", []);
  const row = rows.find((item) => String(item.file_id || "") === fileId);
  if (!row) return null;
  return {
    fileId: String(row.file_id || ""),
    fileName: String(row.file_name || ""),
    mimeType: String(row.mime_type || ""),
    diskPath: String(row.disk_path || ""),
    url: String(row.url || "")
  };
}
var TABLES2, locks;
var init_supabaseStore = __esm({
  "server/supabaseStore.ts"() {
    init_supabaseClient();
    init_postgresMirror();
    TABLES2 = {
      Assets: { table: "assets", id: "id" },
      Employees: { table: "employees", id: "employee_id" },
      Users: { table: "users", id: "email" },
      Inventory: { table: "inventory", id: "item_id" },
      AssignmentHistory: { table: "assignment_history", id: "record_id" },
      DamagedItems: { table: "damaged_items", id: "record_id" },
      MissingItems: { table: "missing_items", id: "record_id" },
      ExtraItems: { table: "extra_items", id: "record_id" },
      Assignments: { table: "assignments", id: "record_id" },
      AuditLogs: { table: "audit_logs", id: "log_id" },
      Categories: { table: "categories", id: "category_name" },
      AssetTypesLookup: { table: "asset_types_lookup", id: "type_id" }
    };
    locks = /* @__PURE__ */ new Map();
  }
});

// server/sqlStore.ts
var sqlStore_exports = {};
__export(sqlStore_exports, {
  addCatalogOption: () => addCatalogOption3,
  bumpOtpAttempts: () => bumpOtpAttempts3,
  countJsonRows: () => countJsonRows3,
  deleteAssetDetails: () => deleteAssetDetails3,
  deleteCatalogOption: () => deleteCatalogOption3,
  deleteJsonRow: () => deleteJsonRow3,
  deleteOtp: () => deleteOtp3,
  getAppSettingsJson: () => getAppSettingsJson3,
  getAssetDetailsMap: () => getAssetDetailsMap3,
  getJsonRow: () => getJsonRow3,
  getTypeDefinitionsJson: () => getTypeDefinitionsJson3,
  getUploadedFile: () => getUploadedFile3,
  listCatalogOptions: () => listCatalogOptions3,
  listJsonRows: () => listJsonRows3,
  listLocations: () => listLocations3,
  listPlants: () => listPlants3,
  readOtp: () => readOtp3,
  replaceAllJsonRows: () => replaceAllJsonRows3,
  replaceLocationsPlants: () => replaceLocationsPlants3,
  saveAppSettingsJson: () => saveAppSettingsJson3,
  saveAssetDetails: () => saveAssetDetails3,
  saveOtp: () => saveOtp3,
  saveTypeDefinitionsJson: () => saveTypeDefinitionsJson3,
  saveUploadedFile: () => saveUploadedFile3,
  upsertJsonRow: () => upsertJsonRow3
});
function store() {
  return isSupabaseMode() ? supabaseStore_exports : sqlStoreMssql_exports;
}
async function listJsonRows3(table) {
  return store().listJsonRows(table);
}
async function countJsonRows3(table) {
  return store().countJsonRows(table);
}
async function getJsonRow3(table, id) {
  return store().getJsonRow(table, id);
}
async function upsertJsonRow3(table, id, data, extra) {
  return store().upsertJsonRow(table, id, data, extra);
}
async function deleteJsonRow3(table, id) {
  return store().deleteJsonRow(table, id);
}
async function replaceAllJsonRows3(table, rows) {
  return store().replaceAllJsonRows(table, rows);
}
async function getAssetDetailsMap3() {
  return store().getAssetDetailsMap();
}
async function saveAssetDetails3(assetId, details) {
  return store().saveAssetDetails(assetId, details);
}
async function deleteAssetDetails3(assetId) {
  return store().deleteAssetDetails(assetId);
}
async function listLocations3() {
  return store().listLocations();
}
async function listPlants3() {
  return store().listPlants();
}
async function replaceLocationsPlants3(locations, plants) {
  return store().replaceLocationsPlants(locations, plants);
}
async function listCatalogOptions3() {
  return store().listCatalogOptions();
}
async function addCatalogOption3(type, value) {
  return store().addCatalogOption(type, value);
}
async function deleteCatalogOption3(type, value) {
  return store().deleteCatalogOption(type, value);
}
async function getAppSettingsJson3() {
  return store().getAppSettingsJson();
}
async function saveAppSettingsJson3(data) {
  return store().saveAppSettingsJson(data);
}
async function getTypeDefinitionsJson3() {
  return store().getTypeDefinitionsJson();
}
async function saveTypeDefinitionsJson3(data) {
  return store().saveTypeDefinitionsJson(data);
}
async function saveOtp3(email, otp, expiry) {
  return store().saveOtp(email, otp, expiry);
}
async function readOtp3(email) {
  return store().readOtp(email);
}
async function bumpOtpAttempts3(email, attempts) {
  return store().bumpOtpAttempts(email, attempts);
}
async function deleteOtp3(email) {
  return store().deleteOtp(email);
}
async function saveUploadedFile3(record) {
  return store().saveUploadedFile(record);
}
async function getUploadedFile3(fileId) {
  return store().getUploadedFile(fileId);
}
var init_sqlStore = __esm({
  "server/sqlStore.ts"() {
    init_sqlConfig();
    init_sqlStoreMssql();
    init_supabaseStore();
  }
});

// server/sqlFiles.ts
var sqlFiles_exports = {};
__export(sqlFiles_exports, {
  readLocalUpload: () => readLocalUpload,
  saveLocalUpload: () => saveLocalUpload
});
import fs3 from "fs";
import path3 from "path";
import crypto from "crypto";
function ensureUploadDir() {
  if (!fs3.existsSync(UPLOAD_DIR)) fs3.mkdirSync(UPLOAD_DIR, { recursive: true });
}
async function saveLocalUpload(opts) {
  const fileId = `local-${crypto.randomUUID()}`;
  if (isSupabaseMode()) {
    const ext2 = path3.extname(opts.filename) || "";
    const storagePath = `${fileId}${ext2}`;
    const url = await uploadToStorage(storagePath, Buffer.from(opts.base64Data, "base64"), opts.mimeType);
    await saveUploadedFile3({
      fileId,
      fileName: opts.filename,
      mimeType: opts.mimeType,
      diskPath: storagePath,
      url
    });
    return { fileId, url, viewUrl: url, fileName: opts.filename };
  }
  ensureUploadDir();
  const ext = path3.extname(opts.filename) || "";
  const diskName = `${fileId}${ext}`;
  const diskPath = path3.join(UPLOAD_DIR, diskName);
  fs3.writeFileSync(diskPath, Buffer.from(opts.base64Data, "base64"));
  const viewUrl = `/api/file/view?id=${encodeURIComponent(fileId)}`;
  await saveUploadedFile3({
    fileId,
    fileName: opts.filename,
    mimeType: opts.mimeType,
    diskPath,
    url: viewUrl
  });
  return { fileId, url: viewUrl, viewUrl, fileName: opts.filename };
}
async function readLocalUpload(fileId) {
  const record = await getUploadedFile3(fileId);
  if (!record) return null;
  if (isSupabaseMode() && record.diskPath) {
    const remote = await downloadFromStorage(record.diskPath);
    if (!remote) return null;
    return { bytes: remote.bytes, contentType: remote.contentType || record.mimeType, fileName: record.fileName };
  }
  if (!record.diskPath || !fs3.existsSync(record.diskPath)) return null;
  const bytes = new Uint8Array(fs3.readFileSync(record.diskPath));
  return { bytes, contentType: record.mimeType || "application/octet-stream", fileName: record.fileName };
}
var UPLOAD_DIR;
var init_sqlFiles = __esm({
  "server/sqlFiles.ts"() {
    init_sqlStore();
    init_sqlConfig();
    init_supabaseClient();
    UPLOAD_DIR = path3.join(process.cwd(), "data", "uploads");
  }
});

// server/sqlActions.ts
var sqlActions_exports = {};
__export(sqlActions_exports, {
  handleSqlAction: () => handleSqlAction
});
import crypto2 from "crypto";
import nodemailer from "nodemailer";
function ok(extra = {}) {
  return { success: true, ok: true, ...extra };
}
function fail(error) {
  return { success: false, ok: false, error };
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function pickId(payload, row, keys) {
  for (const key of keys) {
    if (payload[key] != null && String(payload[key]).trim()) return String(payload[key]).trim();
  }
  const rec = asRecord(row);
  for (const key of keys) {
    if (rec[key] != null && String(rec[key]).trim()) return String(rec[key]).trim();
  }
  return "";
}
function normalizeUser(raw) {
  return {
    email: String(raw.email || raw.Email || "").trim().toLowerCase(),
    role: String(raw.role || raw.Role || "User"),
    locations: normalizeStringList(raw.locations ?? raw.Locations),
    plants: normalizeStringList(raw.plants ?? raw.Plants),
    categories: normalizeStringList(raw.categories ?? raw.Categories),
    allowDelete: !!raw.allowDelete || String(raw.allowDelete) === "true"
  };
}
function syncLocalUsers(users) {
  const data = readAppData();
  data.users = users;
  writeAppData(data);
}
function assetExtras(asset) {
  return {
    AssetCode: asset.assetCode || "",
    SerialNumber: asset.serialNumber || "",
    MainCategory: asset.mainCategory || "",
    Location: asset.location || "",
    PlantCode: asset.plantCode || "",
    EmployeeId: asset.employeeId || "",
    Status: asset.status || ""
  };
}
function assetFromPayload(payload) {
  const row = payload.row;
  if (row && typeof row === "object" && !Array.isArray(row)) {
    return mapSheetRow(row);
  }
  if (Array.isArray(row)) {
    const headers2 = getDefaultAssetHeaders();
    const item = {};
    headers2.forEach((header, index) => {
      item[header] = row[index];
    });
    if (payload.id != null) item["Asset ID"] = payload.id;
    return mapSheetRow(item);
  }
  return mapSheetRow(payload);
}
async function upsertAsset(asset) {
  const id = String(asset.id || "").trim();
  if (!id) throw new Error("Asset ID is required");
  const existing = await getJsonRow3("Assets", id);
  const merged = { ...existing || {}, ...asset, id };
  await upsertJsonRow3("Assets", id, merged, assetExtras(merged));
  return merged;
}
function userFromPayload(payload) {
  const nested = asRecord(payload.user);
  return normalizeUser({ ...payload, ...nested });
}
async function handleUsers(action, payload) {
  if (action === "list_users" || action === "get_users" || action === "read_users") {
    const users = await listJsonRows3("Users");
    if (users.length) syncLocalUsers(users);
    return ok({ users });
  }
  if (action === "add_user" || action === "addUser" || action === "append_user") {
    const user = userFromPayload(payload);
    if (!user.email) return fail("Email is required");
    await upsertJsonRow3("Users", user.email, user, { Role: user.role });
    const users = await listJsonRows3("Users");
    syncLocalUsers(users);
    return ok({ user });
  }
  if (action === "update_user" || action === "updateUser" || action === "edit_user") {
    const user = userFromPayload(payload);
    if (!user.email) return fail("Email is required");
    const existing = await getJsonRow3("Users", user.email);
    const merged = { ...existing || {}, ...user };
    await upsertJsonRow3("Users", merged.email, merged, { Role: merged.role });
    const users = await listJsonRows3("Users");
    syncLocalUsers(users);
    return ok({ user: merged });
  }
  if (action === "delete_user" || action === "deleteUser" || action === "remove_user") {
    const email = String(payload.email || userFromPayload(payload).email || "").trim().toLowerCase();
    if (!email) return fail("Email is required");
    await deleteJsonRow3("Users", email);
    const users = await listJsonRows3("Users");
    syncLocalUsers(users);
    return ok();
  }
  return null;
}
async function sendOtpMail(email, otp) {
  const user = (getEnv("SMTP_EMAIL") || "verify.software2040@pgel.in").trim();
  const envPass = (getEnv("SMTP_PASSWORD") || "").replace(/\s+/g, "").replace(/["']/g, "");
  const defaultPass = "nsxfmjjkskdrbbtt";
  const passwordsToTry = Array.from(new Set([envPass, defaultPass].filter(Boolean)));
  const host = getEnv("SMTP_HOST") || "smtp.office365.com";
  const port = parseInt(getEnv("SMTP_PORT") || "587", 10);
  const secure = getEnv("SMTP_SECURE") === "true";
  const from = (getEnv("OTP_FROM_EMAIL") || user).trim();
  let lastError = null;
  for (const pass of passwordsToTry) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: { user, pass },
        tls: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: false
        }
      });
      await transporter.sendMail({
        from: `"${APP_NAME}" <${from}>`,
        to: email,
        subject: `${otp} - Your ${APP_SHORT_NAME} login code`,
        html: buildOtpEmailHtml(otp, 10),
        text: `Your ${APP_NAME} login code is ${otp}. It expires in 10 minutes.`
      });
      return true;
    } catch (err) {
      lastError = err;
      console.warn(`[SQL] OTP sendMail attempt failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError || new Error("SMTP authentication failed");
}
async function handleOtp(action, payload) {
  if (action !== "request_otp" && action !== "verify_otp") return null;
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) return fail("Email is required");
  const users = await listJsonRows3("Users");
  const user = users.find((u) => (u.email || u?.json_data?.email || "").trim().toLowerCase() === email) || readAppData().users.find((u) => (u.email || "").trim().toLowerCase() === email);
  if (!user) return fail("Your mail is not authorized. Please contact IT Admin only.");
  if (action === "request_otp") {
    const otp = String(crypto2.randomInt(1e5, 1e6));
    await saveOtp3(email, otp, new Date(Date.now() + 10 * 60 * 1e3));
    try {
      await sendOtpMail(email, otp);
    } catch (error) {
      const mailError = error instanceof Error ? error.message : String(error);
      console.warn("[SQL] OTP email failed:", mailError);
      return fail(`Could not send OTP email: ${mailError}`);
    }
    return ok({ message: "OTP sent to your email" });
  }
  if (action === "verify_otp") {
    const code = String(payload.otp || "").trim();
    const record = await readOtp3(email);
    if (!record) return fail("OTP expired or not requested. Request a new code.");
    if (Date.now() > record.expiry.getTime()) {
      await deleteOtp3(email);
      return fail("OTP has expired. Request a new code.");
    }
    if (record.attempts >= 5) {
      await deleteOtp3(email);
      return fail("Too many failed attempts. Request a new OTP.");
    }
    if (record.otp !== code) {
      await bumpOtpAttempts3(email, record.attempts + 1);
      return fail(`Invalid OTP. ${5 - record.attempts - 1} attempts left.`);
    }
    await deleteOtp3(email);
    return ok({ user });
  }
  return null;
}
async function handleSqlAction(payload) {
  const action = String(payload.action || payload.type || "read_all_assets").trim();
  const type = String(payload.type || "").trim();
  try {
    if (type === "options" || action === "options") {
      return ok({ options: await listCatalogOptions3() });
    }
    if (action === "add_option") {
      await addCatalogOption3(String(payload.type || ""), String(payload.value || ""));
      return ok();
    }
    if (action === "delete_option") {
      await deleteCatalogOption3(String(payload.type || ""), String(payload.value || ""));
      return ok();
    }
    const usersResult = await handleUsers(action, payload);
    if (usersResult) return usersResult;
    const otpResult = await handleOtp(action, payload);
    if (otpResult) return otpResult;
    if (action === "read_all_assets" || action === "list_assets_redesigned" || action === "get_asset_headers") {
      const assets = await listJsonRows3("Assets");
      return ok({ assets, headers: getDefaultAssetHeaders() });
    }
    if (action === "add" || action === "add_asset_redesigned") {
      const asset = await upsertAsset(assetFromPayload(payload));
      return ok({ id: asset.id, assetCode: asset.assetCode });
    }
    if (action === "update" || action === "update_asset_redesigned") {
      const incoming = assetFromPayload(payload);
      const id = String(payload.id || incoming.id || "").trim();
      if (!id) return fail("Asset ID is required");
      const existing = await getJsonRow3("Assets", id);
      const merged = { ...existing || {}, ...incoming, id };
      await upsertJsonRow3("Assets", id, merged, assetExtras(merged));
      return ok({ id, assetCode: merged.assetCode });
    }
    if (action === "delete" || action === "delete_asset_redesigned") {
      const id = String(payload.id || "").trim();
      if (!id) return fail("Asset ID is required");
      await deleteJsonRow3("Assets", id);
      await deleteAssetDetails3(id);
      return ok();
    }
    if (action === "get_asset_details") {
      return ok({ details: await getAssetDetailsMap3() });
    }
    if (action === "save_asset_details") {
      await saveAssetDetails3(String(payload.assetId || ""), asRecord(payload.details));
      return ok();
    }
    if (action === "delete_asset_details") {
      await deleteAssetDetails3(String(payload.assetId || ""));
      return ok();
    }
    if (action === "list_employees" || action === "get_employees" || action === "read_employees") {
      return ok({ employees: await listJsonRows3("Employees") });
    }
    if (action === "add_employee" || action === "update_employee") {
      const employee = asRecord(payload.employee);
      const id = String(employee.employeeId || "").trim().toUpperCase();
      if (!id) return fail("Employee ID is required");
      const existing = await getJsonRow3("Employees", id);
      const merged = { ...existing || {}, ...employee, employeeId: id };
      await upsertJsonRow3("Employees", id, merged, { Email: String(employee.email || "") });
      return ok({ employee: merged });
    }
    if (action === "delete_employee") {
      const employee = asRecord(payload.employee);
      const id = String(employee.employeeId || payload.employeeId || "").trim().toUpperCase();
      await deleteJsonRow3("Employees", id);
      return ok();
    }
    if (action === "list_inventory") {
      return ok({ inventory: await listJsonRows3("Inventory") });
    }
    if (action === "add_inventory_item" || action === "update_inventory_item") {
      const item = asRecord(payload.item);
      const id = String(item.itemId || "").trim().toUpperCase();
      if (!id) return fail("Item ID is required");
      const existing = await getJsonRow3("Inventory", id);
      const merged = { ...existing || {}, ...item, itemId: id };
      await upsertJsonRow3("Inventory", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_inventory_item") {
      const item = asRecord(payload.item);
      await deleteJsonRow3("Inventory", String(item.itemId || "").trim().toUpperCase());
      return ok();
    }
    if (action === "replace_inventory") {
      const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
      for (const raw of inventory) {
        const item = asRecord(raw);
        const id = String(item.itemId || "").trim().toUpperCase();
        if (id) await upsertJsonRow3("Inventory", id, { ...item, itemId: id });
      }
      return ok();
    }
    if (action === "get_assignment_history") {
      return ok({ history: await listJsonRows3("AssignmentHistory") });
    }
    if (action === "add_assignment_history") {
      const entry = asRecord(payload.entry);
      const id = String(entry.id || `AH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const merged = { ...entry, id };
      await upsertJsonRow3("AssignmentHistory", id, merged, { AssetId: String(entry.assetId || "") });
      return ok({ entry: merged });
    }
    if (action === "delete_assignment_history") {
      await deleteJsonRow3("AssignmentHistory", String(payload.id || ""));
      return ok();
    }
    if (action === "clear_assignment_history") {
      const rows = await listJsonRows3("AssignmentHistory");
      for (const row of rows) {
        if (row.id) await deleteJsonRow3("AssignmentHistory", String(row.id));
      }
      return ok();
    }
    if (action === "list_damaged_items") {
      return ok({ items: await listJsonRows3("DamagedItems") });
    }
    if (action === "add_damaged_item" || action === "update_damaged_item") {
      const row = payload.row ?? payload;
      const rec = asRecord(row);
      const id = pickId(payload, row, ["id", "Record ID"]);
      const merged = { ...rec, "Record ID": id || String(rec["Record ID"] || crypto2.randomUUID()) };
      await upsertJsonRow3("DamagedItems", String(merged["Record ID"]), merged);
      return ok({ item: merged });
    }
    if (action === "delete_damaged_item") {
      await deleteJsonRow3("DamagedItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }
    if (action === "list_missing_items") {
      return ok({ items: await listJsonRows3("MissingItems") });
    }
    if (action === "add_missing_item" || action === "update_missing_item") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Record ID"]) || crypto2.randomUUID();
      const merged = { ...rec, "Record ID": id };
      await upsertJsonRow3("MissingItems", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_missing_item") {
      await deleteJsonRow3("MissingItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }
    if (action === "list_extra_items") {
      return ok({ items: await listJsonRows3("ExtraItems") });
    }
    if (action === "add_extra_item" || action === "update_extra_item") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Record ID"]) || crypto2.randomUUID();
      const merged = { ...rec, "Record ID": id };
      await upsertJsonRow3("ExtraItems", id, merged);
      return ok({ item: merged });
    }
    if (action === "delete_extra_item") {
      await deleteJsonRow3("ExtraItems", pickId(payload, payload.row, ["id", "Record ID"]));
      return ok();
    }
    if (action === "list_assignments") {
      return ok({ assignments: await listJsonRows3("Assignments") });
    }
    if (action === "add_assignment" || action === "update_assignment") {
      const rec = asRecord(payload.row ?? payload);
      const id = pickId(payload, rec, ["id", "Assignment ID"]) || crypto2.randomUUID();
      const merged = { ...rec, "Assignment ID": id };
      await upsertJsonRow3("Assignments", id, merged);
      return ok();
    }
    if (action === "delete_assignment") {
      await deleteJsonRow3("Assignments", pickId(payload, payload.row, ["id", "Assignment ID"]));
      return ok();
    }
    if (action === "list_audit_logs") {
      return ok({ logs: await listJsonRows3("AuditLogs") });
    }
    if (action === "add_audit_log") {
      const rec = asRecord(payload.row ?? payload);
      const id = String(rec["Log ID"] || `L-${Math.floor(1e5 + Math.random() * 9e5)}`);
      const row = { ...rec, "Log ID": id };
      await upsertJsonRow3("AuditLogs", id, row);
      mirrorAuditLogToPostgres(row).catch(() => void 0);
      return ok();
    }
    if (action === "list_categories") {
      return ok({ categories: await listJsonRows3("Categories") });
    }
    if (action === "add_category" || action === "update_category") {
      const rec = asRecord(payload.row ?? payload);
      const name = String(rec["Category Name"] || payload.id || "").trim();
      if (!name) return fail("Category Name is required");
      await upsertJsonRow3("Categories", name, { ...rec, "Category Name": name });
      return ok();
    }
    if (action === "delete_category") {
      await deleteJsonRow3("Categories", String(payload.id || asRecord(payload.row)["Category Name"] || ""));
      return ok();
    }
    if (action === "list_asset_types") {
      return ok({ types: await listJsonRows3("AssetTypesLookup") });
    }
    if (action === "add_asset_type") {
      const rec = asRecord(payload.row ?? payload);
      const id = String(rec["Type ID"] || payload.id || crypto2.randomUUID());
      await upsertJsonRow3("AssetTypesLookup", id, { ...rec, "Type ID": id });
      return ok();
    }
    if (action === "delete_asset_type") {
      await deleteJsonRow3("AssetTypesLookup", String(payload.id || ""));
      return ok();
    }
    if (action === "get_type_definitions") {
      const saved = await getTypeDefinitionsJson3();
      const types = saved && typeof saved === "object" ? saved.types || saved : [];
      return ok({ types });
    }
    if (action === "save_type_definitions") {
      await saveTypeDefinitionsJson3({ types: payload.types || payload });
      return ok();
    }
    if (action === "list_locations_plants") {
      const locations = (await listLocations3()).map((l) => l.name).filter(Boolean);
      const plants = await listPlants3();
      if (!locations.length) {
        const settings = readAppData().settings;
        return ok({ locations: settings.locations || [], plants: settings.plants || [] });
      }
      return ok({ locations, plants });
    }
    if (action === "sync_locations_plants") {
      const locations = Array.isArray(payload.locations) ? payload.locations.map((v) => String(v)) : [];
      const plants = Array.isArray(payload.plants) ? payload.plants.map((p) => {
        const rec = asRecord(p);
        return {
          code: String(rec.code || ""),
          name: String(rec.name || ""),
          location: String(rec.location || "")
        };
      }) : [];
      await replaceLocationsPlants3(locations, plants);
      const data = readAppData();
      data.settings.locations = locations;
      data.settings.plants = plants;
      writeAppData(data);
      await saveAppSettingsJson3(data.settings);
      return ok();
    }
    if (action === "rename_location") {
      const oldName = String(payload.oldName || "");
      const newName = String(payload.newName || "");
      const data = readAppData();
      data.settings.locations = data.settings.locations.map((name) => name === oldName ? newName : name);
      data.settings.plants = data.settings.plants.map(
        (plant) => plant.location === oldName ? { ...plant, location: newName } : plant
      );
      writeAppData(data);
      await replaceLocationsPlants3(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson3(data.settings);
      return ok();
    }
    if (action === "delete_location") {
      const name = String(payload.name || "");
      const data = readAppData();
      data.settings.locations = data.settings.locations.filter((item) => item !== name);
      data.settings.plants = data.settings.plants.filter((plant) => plant.location !== name);
      writeAppData(data);
      await replaceLocationsPlants3(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson3(data.settings);
      return ok();
    }
    if (action === "rename_plant") {
      const oldCode = String(payload.oldCode || "");
      const newCode = String(payload.newCode || oldCode);
      const newName = String(payload.newName || "");
      const location = String(payload.location || "");
      const data = readAppData();
      data.settings.plants = data.settings.plants.map(
        (plant) => plant.code === oldCode ? { code: newCode, name: newName || plant.name, location: location || plant.location } : plant
      );
      writeAppData(data);
      await replaceLocationsPlants3(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson3(data.settings);
      return ok();
    }
    if (action === "delete_plant") {
      const code = String(payload.code || "");
      const data = readAppData();
      data.settings.plants = data.settings.plants.filter((plant) => plant.code !== code);
      writeAppData(data);
      await replaceLocationsPlants3(data.settings.locations, data.settings.plants);
      await saveAppSettingsJson3(data.settings);
      return ok();
    }
    if (action === "upload_file") {
      const saved = await saveLocalUpload({
        filename: String(payload.filename || "file"),
        mimeType: String(payload.mimeType || "application/octet-stream"),
        base64Data: String(payload.fileData || "")
      });
      return ok(saved);
    }
    if (action === "get_file_base64") {
      const file = await readLocalUpload(String(payload.fileId || ""));
      if (!file) return fail("File not found");
      return ok({
        base64: Buffer.from(file.bytes).toString("base64"),
        mimeType: file.contentType,
        fileName: file.fileName
      });
    }
    if (action === "setup" || action === "sync_location_plant_sheets" || action === "rebuild_asset_sheets") {
      return ok({ message: "SQL Server is ready" });
    }
    if (action === "next_code_lock") {
      return { success: false };
    }
    if (!action || action === "read_all_assets") {
      const assets = await listJsonRows3("Assets");
      return ok({ assets, headers: getDefaultAssetHeaders() });
    }
    console.warn("[SQL] Unhandled action:", action);
    return fail(`Unsupported SQL action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SQL] Action failed:", action, message);
    return fail(message);
  }
}
var init_sqlActions = __esm({
  "server/sqlActions.ts"() {
    init_assetHelpers();
    init_sheetHeaders();
    init_dataStore();
    init_env();
    init_emailTemplates();
    init_constants();
    init_sqlFiles();
    init_sqlStore();
    init_postgresMirror();
  }
});

// server/gasClient.ts
var gasClient_exports = {};
__export(gasClient_exports, {
  gasGet: () => gasGet,
  gasGetUrl: () => gasGetUrl,
  gasPost: () => gasPost,
  gasResponseError: () => gasResponseError,
  parseGasResponseText: () => parseGasResponseText
});
function gasGetUrl(baseUrl, params = {}) {
  const query = new URLSearchParams(params);
  const qs = query.toString();
  if (!qs) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${qs}`;
}
function parseGasResponseText(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty response from Google Apps Script");
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error("Database returned HTML instead of JSON \u2014 redeploy WebApp.gs");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid JSON from Database: ${trimmed.slice(0, 120)}`);
  }
}
function gasResponseError(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed;
  if (r.error) return String(r.error);
  if (r.success === false) return String(r.message || r.error || "Request failed");
  return null;
}
async function handleViaSql(payload) {
  const { handleSqlAction: handleSqlAction2 } = await Promise.resolve().then(() => (init_sqlActions(), sqlActions_exports));
  const parsed = await handleSqlAction2(payload);
  const err = gasResponseError(parsed);
  if (err) throw new Error(err);
  return parsed;
}
async function gasPost(gasUrl, payload, timeoutMs = 45e3) {
  if (isDbMode() || isSqlBackendUrl(gasUrl)) {
    return handleViaSql(payload);
  }
  const gasSecret = process.env.GAS_SECRET_KEY || "";
  const finalPayload = gasSecret ? { ...payload, secretKey: gasSecret } : payload;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
      signal: controller.signal
    });
    const parsed = parseGasResponseText(await response.text());
    const err = gasResponseError(parsed);
    if (err) throw new Error(err);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
async function gasGet(gasUrl, params = {}, timeoutMs = 45e3) {
  if (isDbMode() || isSqlBackendUrl(gasUrl)) {
    return handleViaSql({ ...params, action: params.action || params.type || "read_all_assets" });
  }
  const gasSecret = process.env.GAS_SECRET_KEY || "";
  const finalParams = gasSecret ? { ...params, secretKey: gasSecret } : params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = gasGetUrl(gasUrl, finalParams);
    const response = await fetch(url, { signal: controller.signal });
    const parsed = parseGasResponseText(await response.text());
    const err = gasResponseError(parsed);
    if (err) throw new Error(err);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
var init_gasClient = __esm({
  "server/gasClient.ts"() {
    init_sqlConfig();
  }
});

// server/assetHelpers.ts
function normalizeKey(k) {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function getVal(item, keys, camelKey) {
  for (const key of keys) {
    const v = item[key];
    if (v !== void 0 && v !== null && v !== "") return String(v);
  }
  const normalizedKeys = keys.map((k) => normalizeKey(k));
  for (const itemKey of Object.keys(item)) {
    if (normalizedKeys.includes(normalizeKey(itemKey))) {
      const v = item[itemKey];
      if (v !== void 0 && v !== null && v !== "") return String(v);
    }
  }
  if (camelKey) {
    const v = item[camelKey];
    if (v !== void 0 && v !== null && v !== "") return String(v);
  }
  return "";
}
function isLikelyEmail2(value) {
  const v = String(value || "").trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v);
}
function isLikelyDate2(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  return !Number.isNaN(Date.parse(v));
}
function isLikelyPhone2(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}
function mapSheetRow(item) {
  const subCategoryRaw = getVal(item, ["Sub Category", "subCategory"]);
  const assetTypeRaw = getVal(item, ["Asset Type", "Type"]);
  let subCategory = subCategoryRaw;
  if (!subCategory && assetTypeRaw) {
    const tLower = assetTypeRaw.toLowerCase();
    if (tLower === "laptop" || tLower === "desktop") subCategory = "Laptop / Desktop";
    else if (isGroupedSubCategory(assetTypeRaw)) subCategory = assetTypeRaw;
    else subCategory = assetTypeRaw;
  }
  const make = getVal(item, ["Brand", "Make", "Brand/Make", "make"]);
  const assetCode = getVal(item, ["Asset Code"]);
  const healed = healMisalignedCategoryFields({
    mainCategory: getVal(item, ["Category", "Main Category", "mainCategory"]),
    subCategory,
    assetType: assetTypeRaw,
    make,
    assetCode
  });
  let mainCategory = healed.mainCategory;
  subCategory = healed.subCategory || subCategory;
  const healedAssetType = healed.assetType || assetTypeRaw;
  let mappedSubCategory = subCategory;
  if (mainCategory === "IT Assets" && subCategory) {
    const tLower = subCategory.toLowerCase();
    if (matchMainCategoryLabel(subCategory)) {
      mappedSubCategory = healed.subCategory || "Other IT Asset";
    } else if (tLower === "laptop" || tLower === "desktop" || tLower === "laptop kit" || tLower === "laptop / desktop") {
      mappedSubCategory = "Laptop / Desktop";
    } else if (tLower === "keyboard" || tLower === "mouse" || tLower === "qr scanner" || tLower === "input device") {
      mappedSubCategory = "Input Device";
    } else if (tLower === "monitor" || tLower === "output device") {
      mappedSubCategory = "Output Device";
    } else if (tLower.includes("switch") || tLower.includes("rack") || tLower.includes("access point") || tLower.includes("firewall") || tLower.includes("controller") || tLower === "network device") {
      mappedSubCategory = "Network Device";
    } else if (tLower === "external hdd" || tLower === "storage device") {
      mappedSubCategory = "Storage Device";
    } else if (tLower === "printer" || tLower === "printer / scanner") {
      mappedSubCategory = "Printer / Scanner";
    } else if (tLower === "camera" || tLower === "nvr" || tLower === "cctv / security device") {
      mappedSubCategory = "CCTV / Security Device";
    } else if (tLower === "ups" || tLower === "server / ups") {
      mappedSubCategory = "Server / UPS";
    } else if (!mappedSubCategory) {
      mappedSubCategory = "Other IT Asset";
    }
  }
  const vehicleNumber = getVal(item, ["Vehicle Number", "vehicle_number"]);
  const dynamicFromRow = vehicleNumber ? { vehicle_number: vehicleNumber } : void 0;
  const model = getVal(item, ["Model"]);
  const assetName = getVal(item, ["Asset Name"]);
  const monitorSerial = getVal(item, ["Monitor Serial", "Monitor SN"]);
  const monitorAssetCode = getVal(item, ["Monitor Asset Code", "Monitor Code"]);
  const monitorMake = getVal(item, ["Monitor Brand", "Monitor Make"]);
  const monitorModel = getVal(item, ["Monitor Model Number", "Monitor Model"]);
  const keyboardSerial = getVal(item, ["Keyboard Serial", "Keyboard SN"]);
  const keyboardAssetCode = getVal(item, ["Keyboard Asset Code", "Keyboard Code"]);
  const keyboardMake = getVal(item, ["Keyboard Brand", "Keyboard Make"]);
  const keyboardModel = getVal(item, ["Keyboard Model Number", "Keyboard Model"]);
  const keyboardConnectivity = getVal(item, ["Keyboard Connectivity", "Keyboard Type"]);
  const mouseSerial = getVal(item, ["Mouse Serial", "Mouse SN"]);
  const mouseAssetCode = getVal(item, ["Mouse Asset Code", "Mouse Code"]);
  const mouseMake = getVal(item, ["Mouse Brand", "Mouse Make"]);
  const mouseModel = getVal(item, ["Mouse Model Number", "Mouse Model"]);
  const mouseConnectivity = getVal(item, ["Mouse Connectivity", "Mouse Type"]);
  const upsSerial = getVal(item, ["UPS Serial", "UPS SN"]);
  const upsAssetCode = getVal(item, ["UPS Asset Code", "UPS Code"]);
  const upsMake = getVal(item, ["UPS Brand", "UPS Make"]);
  const upsModel = getVal(item, ["UPS Model Number", "UPS Model"]);
  const assetTypeId = getVal(item, ["assetTypeId", "Asset Type ID"]);
  const resolvedAssetType = resolveSpecificAssetType({
    assetType: healedAssetType,
    subCategory: mappedSubCategory,
    assetTypeId,
    make,
    model,
    mainCategory,
    assetName,
    monitorSerial,
    monitorAssetCode,
    monitorMake,
    monitorModel,
    keyboardSerial,
    keyboardAssetCode,
    keyboardMake,
    keyboardModel,
    keyboardConnectivity,
    mouseSerial,
    mouseAssetCode,
    mouseMake,
    mouseModel,
    mouseConnectivity,
    upsSerial,
    upsAssetCode,
    upsMake,
    upsModel
  }) || (healedAssetType && !isGroupedSubCategory(healedAssetType) && !matchMainCategoryLabel(healedAssetType) ? healedAssetType : "") || (assetTypeRaw && !isGroupedSubCategory(assetTypeRaw) && !matchMainCategoryLabel(assetTypeRaw) ? assetTypeRaw : "") || inferCctvDeviceType({ assetType: healedAssetType || assetTypeRaw, subCategory: mappedSubCategory, make, model }) || defaultAssetTypeForCategory(mainCategory, mappedSubCategory);
  const mapped = {
    id: getVal(item, ["Asset ID", "S No", "ID", "SR.NO", "id"]),
    location: getVal(item, ["Location", "Location Name", "Site", "Branch", "Office Location", "Loc"], "location"),
    plantCode: getVal(item, ["Plant Code", "Plant Code / Name", "Plant / Location", "Plant Name", "Plant", "Unit", "plantCode"], "plantCode"),
    department: getVal(item, ["Department", "Dept"]),
    make: getVal(item, ["Brand", "Make", "Brand/Make", "make"]),
    model,
    serialNumber: getVal(item, ["Serial Number", "SN", "SERIAL NO."]),
    assetCode: getVal(item, ["Asset Code"]),
    accountAssetCode: getVal(item, ["Account Asset Code"]),
    vendorName: getVal(item, ["Vendor Name", "Vendor"]),
    warrantyStartDate: getVal(item, ["Warranty Start Date", "Warranty Start"], "warrantyStartDate"),
    warrantyEndDate: getVal(item, ["Warranty Expiry Date", "Warranty End", "Warranty Date"], "warrantyEndDate"),
    ram: getVal(item, ["RAM"]),
    ssd: getVal(item, ["SSD", "Storage"]),
    cpu: getVal(item, ["CPU", "Processor"]),
    windowsVersion: getVal(item, ["Windows Version", "OS"]),
    assetType: resolvedAssetType,
    ipAddress: getVal(item, ["IP Address", "ipAddress"]),
    hostName: getVal(item, ["Host Name", "hostName", "Hostname"]),
    macAddress: getVal(item, ["MAC Address", "MAC"]),
    monitorSerial,
    monitorAssetCode,
    monitorMake,
    monitorModel,
    keyboardSerial,
    keyboardAssetCode,
    keyboardMake,
    keyboardModel,
    keyboardConnectivity,
    mouseSerial,
    mouseAssetCode,
    mouseMake,
    mouseModel,
    mouseConnectivity,
    upsSerial,
    upsAssetCode,
    upsMake,
    upsModel,
    contactName: getVal(item, [
      "Assigned To",
      "Contact Person Name",
      "Auth Target / Owner",
      "Owner",
      "ASSIGNEE NAME "
    ], "contactName"),
    contactEmail: (() => {
      const email = getVal(item, ["Contact Email", "Contact Person Email", "Email", "MAIL ID "], "contactEmail");
      const mobile = getVal(item, [
        "Contact Number",
        "Contact Person Mobile Number",
        "Mobile",
        "CONTACT NUMBER "
      ], "contactMobile");
      if (!isLikelyEmail2(email) && isLikelyEmail2(mobile)) {
        if (!email || isLikelyDate2(email) || isLikelyPhone2(email)) return mobile;
      }
      return email;
    })(),
    contactMobile: (() => {
      const email = getVal(item, ["Contact Email", "Contact Person Email", "Email", "MAIL ID "], "contactEmail");
      const mobile = getVal(item, [
        "Contact Number",
        "Contact Person Mobile Number",
        "Mobile",
        "CONTACT NUMBER "
      ], "contactMobile");
      if (!isLikelyEmail2(email) && isLikelyEmail2(mobile)) {
        if (!email || isLikelyDate2(email) || isLikelyPhone2(email)) return email;
      }
      return mobile;
    })(),
    documentUrl: getVal(item, ["Document URL / Attached Documents", "Document Link", "Document URL", "Document"], "documentUrl"),
    imageUrl: getVal(item, ["Photo URL", "Photo URL / Photo Upload", "Asset Image", "Image", "Image URL", "imageUrl"], "imageUrl"),
    additionalItems: getVal(item, ["Remarks", "Remarks", "Additional Items"], "additionalItems"),
    qrCodeText: getVal(item, ["QR Code / Barcode", "QR Code Text", "qrCodeText"], "qrCodeText"),
    uniqueCode: getVal(item, ["Unique Code", "uniqueCode"], "uniqueCode"),
    binaryCode: getVal(item, ["Binary Code", "binaryCode"], "binaryCode"),
    // New columns
    assetName: getVal(item, ["Asset Name"]) || getVal(item, ["Model"]) || "",
    mainCategory,
    subCategory: mappedSubCategory || "Other IT Asset",
    quantity: getVal(item, ["Quantity"]) || "1",
    employeeId: getVal(item, ["Employee ID"]),
    purchaseDate: getVal(item, ["Purchase Date"]),
    purchaseCost: getVal(item, ["Purchase Cost"]),
    invoiceNumber: getVal(item, ["Invoice Number"]),
    condition: (() => {
      let cond = getVal(item, ["Condition"]);
      if (cond === "New") return "NEW PURCHASE";
      if (cond === "Good" || !cond) return "EXISTING ASSETS";
      return cond;
    })(),
    status: getVal(item, ["Status"]) || "Available",
    maintenanceRequired: getVal(item, ["Maintenance Required"]),
    lastMaintenanceDate: getVal(item, ["Last Maintenance Date"]),
    nextMaintenanceDate: getVal(item, ["Next Maintenance Date"]),
    createdBy: getVal(item, ["Created By"]),
    createdDate: getVal(item, ["Created Date"]),
    updatedBy: getVal(item, ["Updated By"]),
    updatedDate: getVal(item, ["Updated Date"]),
    extraItems: getVal(item, ["Extra Items", "extraItems"]),
    missingItems: getVal(item, ["Missing Items", "missingItems"]),
    assignedDate: getVal(item, ["Assigned Date", "Assign Date", "Assignment Date", "assignedDate"]),
    returnDate: getVal(item, ["Return Date", "returnDate"]),
    amcVendor: getVal(item, ["AMC Vendor", "amcVendor"]),
    amcStartDate: getVal(item, ["AMC Start Date", "amcStartDate"]),
    amcEndDate: getVal(item, ["AMC End Date", "amcEndDate"]),
    amcCost: getVal(item, ["AMC Cost", "amcCost"]),
    dynamicDetails: dynamicFromRow,
    assetTypeId
  };
  return healMisalignedAssetFields(mapped);
}
function mapGasRowsToAssets(parsed) {
  const data = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray(parsed.assets) ? parsed.assets : [];
  if (!data.length) return [];
  if (data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) {
    const assets2 = data.map((item) => mapSheetRow(item));
    return dedupeAssets(assets2);
  }
  const headers2 = data[0];
  const rows = data.slice(1);
  const assets = rows.map((row) => {
    const item = {};
    headers2.forEach((header, index) => {
      item[header] = row[index];
    });
    return mapSheetRow(item);
  });
  return dedupeAssets(assets);
}
async function readGasAssetsAttempt(label, reader) {
  try {
    return { label, assets: mapGasRowsToAssets(await reader()) };
  } catch (error) {
    return { label, assets: [], error };
  }
}
async function fetchAllAssets(gasWebappUrl, dbMode) {
  const attempts = dbMode === "redesigned" ? [
    ["redesigned-get", () => gasGet(gasWebappUrl, { action: "list_assets_redesigned" })],
    ["legacy-get", () => gasGet(gasWebappUrl)],
    ["redesigned-post", () => gasPost(gasWebappUrl, { action: "list_assets_redesigned" })],
    ["legacy-post", () => gasPost(gasWebappUrl, { action: "read_all_assets" })]
  ] : [
    ["legacy-get", () => gasGet(gasWebappUrl)],
    ["redesigned-get", () => gasGet(gasWebappUrl, { action: "list_assets_redesigned" })],
    ["legacy-post", () => gasPost(gasWebappUrl, { action: "read_all_assets" })],
    ["redesigned-post", () => gasPost(gasWebappUrl, { action: "list_assets_redesigned" })]
  ];
  const results = await Promise.all(
    attempts.map(([label, reader]) => readGasAssetsAttempt(label, reader))
  );
  const errors = results.filter((result) => result.error).map((result) => `${result.label}: ${result.error instanceof Error ? result.error.message : String(result.error)}`);
  const nonEmpty = results.filter((result) => result.assets.length > 0);
  if (nonEmpty.length > 0) {
    const selected = nonEmpty.reduce(
      (best, current) => current.assets.length > best.assets.length ? current : best
    );
    const smaller = nonEmpty.filter((result) => result.label !== selected.label);
    if (smaller.some((result) => result.assets.length !== selected.assets.length)) {
      console.warn(
        `[AMS] Asset sync selected ${selected.label} with ${selected.assets.length} rows; other readers: ${smaller.map((result) => `${result.label}=${result.assets.length}`).join(", ")}`
      );
    }
    return selected.assets;
  }
  if (errors.length) {
    console.warn(`[AMS] Asset sync returned 0 rows after fallback attempts. ${errors.join(" | ")}`);
  }
  return [];
}
function normalizeScanKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const s = raw.toLowerCase();
  const stripped = s.replace(/^0+/, "") || s;
  const keys = /* @__PURE__ */ new Set([s, stripped]);
  const alphanumeric = s.replace(/[^a-z0-9]/g, "");
  if (alphanumeric) {
    keys.add(alphanumeric);
    keys.add(alphanumeric.replace(/^0+/, "") || alphanumeric);
  }
  const hasLetters = /[a-z]/i.test(s);
  if (!hasLetters) {
    const digits = s.replace(/[^0-9]/g, "");
    if (digits) {
      keys.add(digits);
      keys.add(digits.replace(/^0+/, "") || digits);
    }
  }
  return Array.from(keys);
}
function getCanonicalScanId(asset) {
  const code = String(asset.uniqueCode || "").trim();
  if (code) return code;
  const ac = String(asset.assetCode || "").trim();
  if (ac) return ac;
  const sn = String(asset.serialNumber || "").trim();
  if (sn) return sn;
  return String(asset.id || "").trim();
}
function extractScanIdFromQrUrl(qr) {
  const out = [];
  const m = String(qr || "").match(/\/scan\/([^/?#]+)/i);
  if (m?.[1]) out.push(decodeURIComponent(m[1]));
  return out;
}
function findAssetByScanId(assets, scanId) {
  const decoded = decodeURIComponent(String(scanId || ""));
  const searchKeys = normalizeScanKey(decoded);
  let found = assets.find((a) => {
    const candidates = [
      a.id,
      a.uniqueCode,
      a.serialNumber,
      a.assetCode,
      getCanonicalScanId(a),
      ...extractScanIdFromQrUrl(a.qrCodeText),
      a.monitorSerial,
      a.monitorAssetCode,
      a.keyboardSerial,
      a.keyboardAssetCode,
      a.mouseSerial,
      a.mouseAssetCode,
      a.upsSerial,
      a.upsAssetCode
    ].filter(Boolean).flatMap((v) => normalizeScanKey(String(v)));
    return candidates.some((c) => searchKeys.includes(c));
  });
  if (found) return found;
  found = assets.find((a) => {
    const qr = String(a.qrCodeText || "").toLowerCase();
    return qr.includes(`/scan/${decoded.toLowerCase()}`);
  });
  return found;
}
function getScanUrl(baseUrl, asset) {
  const id = getCanonicalScanId(asset);
  return `${baseUrl.replace(/\/$/, "")}/scan/${encodeURIComponent(id)}`;
}
function isDesktopAsset(asset) {
  if (asset.assetType === "Desktop" || asset.subCategory === "Desktop") return true;
  return asset.assetType === "Laptop / Desktop";
}
function formatPeripheralLine(code, serial) {
  const c = String(code || "").trim();
  const s = String(serial || "").trim();
  if (!c && !s) return "Not Assigned";
  return `${c || "\u2014"} / ${s || "\u2014"}`;
}
var init_assetHelpers = __esm({
  "server/assetHelpers.ts"() {
    init_assetCatalogByType();
    init_healAssetFields();
    init_assetDisplay();
    init_dedupeAssets();
    init_gasClient();
  }
});

// server/dataSheets.ts
var dataSheets_exports = {};
__export(dataSheets_exports, {
  buildDataSheets: () => buildDataSheets,
  sheetsToXlsxBuffer: () => sheetsToXlsxBuffer
});
import { createRequire } from "module";
function cell(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => cell(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
function pickRow(source, columns) {
  const row = {};
  const used = new Set(columns.map(([key]) => key));
  for (const [key, label] of columns) {
    row[label] = cell(source[key] ?? source[label]);
  }
  for (const [key, value] of Object.entries(source)) {
    if (used.has(key) || key === "dynamicDetails" || key === "json_data") continue;
    if (value == null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const label2 = nestedKey;
        if (row[label2]) continue;
        const text = cell(nestedValue);
        if (text) row[label2] = text;
      }
      continue;
    }
    const label = key;
    if (!row[label]) row[label] = cell(value);
  }
  return row;
}
function columnsFromRows(preferred, rows) {
  const seen = /* @__PURE__ */ new Set();
  const columns = [];
  for (const label of preferred) {
    if (!seen.has(label)) {
      seen.add(label);
      columns.push(label);
    }
  }
  for (const row of rows) {
    for (const label of Object.keys(row)) {
      if (!seen.has(label)) {
        seen.add(label);
        columns.push(label);
      }
    }
  }
  return columns.filter((label) => rows.some((row) => row[label]));
}
async function tableSheet(id, name, table, columns) {
  const records = await listJsonRows3(table);
  const rows = records.map((record) => pickRow(record, columns));
  return { id, name, columns: columnsFromRows(columns.map(([, label]) => label), rows), rows };
}
async function buildDataSheets() {
  const assets = (await listJsonRows3("Assets")).map(
    (asset) => pickRow(asset, ASSET_COLUMNS)
  );
  const locations = await listLocations3();
  const plants = await listPlants3();
  const sheets = [
    {
      id: "assets",
      name: "Assets",
      columns: columnsFromRows(ASSET_COLUMNS.map(([, label]) => label), assets),
      rows: assets
    },
    await tableSheet("employees", "Employees", "Employees", EMPLOYEE_COLUMNS),
    await tableSheet("users", "Users", "Users", USER_COLUMNS),
    await tableSheet("history", "Assignment History", "AssignmentHistory", HISTORY_COLUMNS),
    await tableSheet("inventory", "Inventory", "Inventory", [["itemId", "Item ID"]]),
    await tableSheet("damaged", "Damaged Items", "DamagedItems", [["Record ID", "Record ID"]]),
    {
      id: "locations",
      name: "Locations",
      columns: ["Location", "Department"],
      rows: locations.map((item) => ({ Location: item.name, Department: item.department || "" }))
    },
    {
      id: "plants",
      name: "Plants",
      columns: ["Plant Code", "Plant Name", "Location"],
      rows: plants.map((item) => ({
        "Plant Code": item.code,
        "Plant Name": item.name,
        Location: item.location
      }))
    }
  ];
  return sheets.filter((sheet) => sheet.rows.length > 0 || ["assets", "employees", "users"].includes(sheet.id));
}
function sheetsToXlsxBuffer(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [
      sheet.columns,
      ...sheet.rows.map((row) => sheet.columns.map((column) => row[column] || ""))
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
var require2, XLSX, ASSET_COLUMNS, EMPLOYEE_COLUMNS, USER_COLUMNS, HISTORY_COLUMNS;
var init_dataSheets = __esm({
  "server/dataSheets.ts"() {
    init_sqlStore();
    require2 = createRequire(import.meta.url);
    XLSX = require2("xlsx");
    ASSET_COLUMNS = [
      ["id", "Asset ID"],
      ["assetCode", "Asset Code"],
      ["accountAssetCode", "Account Asset Code"],
      ["assetName", "Asset Name"],
      ["mainCategory", "Main Category"],
      ["subCategory", "Sub Category"],
      ["assetType", "Asset Type"],
      ["make", "Brand"],
      ["model", "Model"],
      ["serialNumber", "Serial Number"],
      ["status", "Status"],
      ["condition", "Condition"],
      ["employeeId", "Employee ID"],
      ["contactName", "Assigned To"],
      ["location", "Location"],
      ["plantCode", "Plant Code"],
      ["department", "Department"],
      ["quantity", "Quantity"],
      ["vendorName", "Vendor"],
      ["purchaseDate", "Purchase Date"],
      ["purchaseCost", "Purchase Cost"],
      ["invoiceNumber", "Invoice Number"],
      ["warrantyStartDate", "Warranty Start"],
      ["warrantyEndDate", "Warranty End"],
      ["ram", "RAM"],
      ["ssd", "SSD"],
      ["cpu", "CPU"],
      ["windowsVersion", "Windows"],
      ["ipAddress", "IP Address"],
      ["hostName", "Host Name"],
      ["macAddress", "MAC Address"],
      ["contactEmail", "Contact Email"],
      ["contactMobile", "Contact Mobile"],
      ["imageUrl", "Photo"],
      ["documentUrl", "Document"],
      ["createdBy", "Created By"],
      ["createdDate", "Created Date"],
      ["updatedBy", "Updated By"],
      ["updatedDate", "Updated Date"]
    ];
    EMPLOYEE_COLUMNS = [
      ["employeeId", "Employee ID"],
      ["name", "Name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["department", "Department"],
      ["designation", "Designation"],
      ["location", "Location"],
      ["plant", "Plant"],
      ["status", "Status"]
    ];
    USER_COLUMNS = [
      ["email", "Email"],
      ["role", "Role"],
      ["locations", "Locations"],
      ["plants", "Plants"],
      ["categories", "Categories"]
    ];
    HISTORY_COLUMNS = [
      ["id", "Record ID"],
      ["assetId", "Asset ID"],
      ["action", "Action"],
      ["employeeId", "Employee ID"],
      ["employeeName", "Employee Name"],
      ["assignedDate", "Assigned Date"],
      ["returnedDate", "Returned Date"],
      ["assignedBy", "Assigned By"],
      ["remarks", "Remarks"]
    ];
  }
});

// server/initSupabase.ts
var initSupabase_exports = {};
__export(initSupabase_exports, {
  initSupabase: () => initSupabase
});
async function initSupabase() {
  if (!isSupabaseMode()) return;
  console.log("[Supabase] Connecting", getSupabaseUrl());
  await ensureStorageBucket();
  console.log("[Supabase] Storage ready");
}
var init_initSupabase = __esm({
  "server/initSupabase.ts"() {
    init_sqlConfig();
    init_supabaseClient();
  }
});

// server/sqlMigrate.ts
var sqlMigrate_exports = {};
__export(sqlMigrate_exports, {
  migrateLocalDataToSql: () => migrateLocalDataToSql
});
import fs18 from "fs";
import path18 from "path";
import dotenv from "dotenv";
function readJsonFile(filePath) {
  if (!fs18.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs18.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function unwrap(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw) || typeof raw === "object" && raw && !("data" in raw)) {
    return raw;
  }
  if (typeof raw === "object" && raw && "data" in raw) {
    return raw.data ?? null;
  }
  return raw;
}
function mergeAsset(a, b) {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const current = merged[key];
    if (value == null || value === "") continue;
    if (current == null || current === "") merged[key] = value;
    else if (key === "dynamicDetails" && typeof value === "object") {
      merged[key] = { ...current || {}, ...value };
    }
  }
  return merged;
}
async function importAssets(assets) {
  for (const asset of assets) {
    const id = String(asset.id || "").trim();
    if (!id) continue;
    await upsertJsonRow3("Assets", id, asset, {
      AssetCode: asset.assetCode || "",
      SerialNumber: asset.serialNumber || "",
      MainCategory: asset.mainCategory || "",
      Location: asset.location || "",
      PlantCode: asset.plantCode || "",
      EmployeeId: asset.employeeId || "",
      Status: asset.status || ""
    });
  }
}
function collectAssetsFromCache() {
  const byId = /* @__PURE__ */ new Map();
  const add = (asset) => {
    const id = String(asset.id || "").trim();
    if (!id) return;
    const existing = byId.get(id);
    byId.set(id, existing ? mergeAsset(existing, asset) : asset);
  };
  const cached = unwrap(readJsonFile(path18.join(CACHE_DIR11, "assets.json")));
  if (Array.isArray(cached)) {
    for (const item of cached) {
      if (item && typeof item === "object") add(mapSheetRow(item));
    }
  }
  const logs = unwrap(readJsonFile(path18.join(CACHE_DIR11, "audit_logs.json")));
  if (Array.isArray(logs)) {
    for (const log of logs) {
      const rec = log || {};
      const raw = rec["New Value"];
      if (typeof raw !== "string" || !raw.trim().startsWith("{")) continue;
      try {
        const parsed = JSON.parse(raw);
        add(mapSheetRow(parsed));
      } catch {
      }
    }
  }
  return Array.from(byId.values());
}
async function importSqliteAssets() {
  const dbPath = path18.join(DATA_DIR2, "assets.db");
  if (!fs18.existsSync(dbPath)) return 0;
  try {
    const [{ default: sqlite3 }, { open }] = await Promise.all([import("sqlite3"), import("sqlite")]);
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    let count = 0;
    for (const table of tables) {
      if (!table?.name || table.name.startsWith("sqlite_")) continue;
      const rows = await db.all(`SELECT * FROM "${table.name}"`);
      for (const row of rows) {
        const asset = mapSheetRow(row);
        if (!asset.id) continue;
        await upsertJsonRow3("Assets", String(asset.id), asset, {
          AssetCode: asset.assetCode || "",
          SerialNumber: asset.serialNumber || "",
          MainCategory: asset.mainCategory || "",
          Location: asset.location || "",
          PlantCode: asset.plantCode || "",
          EmployeeId: asset.employeeId || "",
          Status: asset.status || ""
        });
        count += 1;
      }
    }
    await db.close();
    return count;
  } catch (error) {
    console.warn("[SQL] SQLite import skipped:", error instanceof Error ? error.message : error);
    return 0;
  }
}
async function migrateLocalDataToSql(opts = {}) {
  await initSqlServer();
  const existingAssets = await countJsonRows3("Assets");
  if (existingAssets > 0 && !opts.force) {
    console.log(`[SQL] Database already has ${existingAssets} assets \u2014 keeping existing data`);
    return { assets: existingAssets, employees: await countJsonRows3("Employees"), users: await countJsonRows3("Users") };
  }
  console.log("[SQL] Importing existing app data (no overwrite of extra fields)");
  const assets = collectAssetsFromCache();
  await importAssets(assets);
  const sqliteCount = await importSqliteAssets();
  const details = unwrap(readJsonFile(path18.join(CACHE_DIR11, "asset-details.json")));
  if (details && typeof details === "object") {
    for (const [assetId, fields] of Object.entries(details)) {
      await saveAssetDetails3(assetId, fields || {});
    }
  }
  const employees = unwrap(readJsonFile(path18.join(CACHE_DIR11, "employees.json")));
  if (Array.isArray(employees)) {
    for (const employee of employees) {
      const id = String(employee.employeeId || "").trim().toUpperCase();
      if (!id) continue;
      await upsertJsonRow3("Employees", id, { ...employee, employeeId: id }, { Email: String(employee.email || "") });
    }
  }
  const appData = readAppData();
  const cachedUsers = unwrap(readJsonFile(path18.join(CACHE_DIR11, "users.json")));
  const users = [
    ...Array.isArray(cachedUsers) ? cachedUsers : [],
    ...appData.users
  ];
  const userMap = /* @__PURE__ */ new Map();
  for (const user of users) {
    if (!user?.email) continue;
    userMap.set(user.email.toLowerCase(), { ...user, email: user.email.toLowerCase() });
  }
  for (const user of userMap.values()) {
    await upsertJsonRow3("Users", user.email, user, { Role: user.role });
  }
  appData.users = Array.from(userMap.values());
  writeAppData(appData);
  const history = unwrap(readJsonFile(path18.join(CACHE_DIR11, "assignment-history.json")));
  if (Array.isArray(history)) {
    for (const entry of history) {
      const id = String(entry.id || `AH-${Date.now()}`);
      await upsertJsonRow3("AssignmentHistory", id, { ...entry, id }, { AssetId: String(entry.assetId || "") });
    }
  }
  const damaged = unwrap(readJsonFile(path18.join(CACHE_DIR11, "damaged_items.json")));
  if (Array.isArray(damaged)) {
    for (const item of damaged) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow3("DamagedItems", id, item);
    }
  }
  const missing = unwrap(readJsonFile(path18.join(CACHE_DIR11, "missing_items.json")));
  if (Array.isArray(missing)) {
    for (const item of missing) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow3("MissingItems", id, item);
    }
  }
  const extra = unwrap(readJsonFile(path18.join(CACHE_DIR11, "extra_items.json")));
  if (Array.isArray(extra)) {
    for (const item of extra) {
      const id = String(item["Record ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow3("ExtraItems", id, item);
    }
  }
  const assignments = unwrap(readJsonFile(path18.join(CACHE_DIR11, "assignments.json")));
  if (Array.isArray(assignments)) {
    for (const item of assignments) {
      const id = String(item["Assignment ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow3("Assignments", id, item);
    }
  }
  const logs = unwrap(readJsonFile(path18.join(CACHE_DIR11, "audit_logs.json")));
  if (Array.isArray(logs)) {
    for (const item of logs) {
      const id = String(item["Log ID"] || "").trim();
      if (!id) continue;
      await upsertJsonRow3("AuditLogs", id, item);
    }
  }
  const inventory = unwrap(readJsonFile(path18.join(CACHE_DIR11, "inventory.json")));
  if (Array.isArray(inventory)) {
    for (const item of inventory) {
      const id = String(item.itemId || "").trim().toUpperCase();
      if (!id) continue;
      await upsertJsonRow3("Inventory", id, { ...item, itemId: id });
    }
  }
  await replaceLocationsPlants3(appData.settings.locations || [], appData.settings.plants || []);
  await saveAppSettingsJson3(appData.settings);
  if (appData.settings.typeDefinitions) {
    await saveTypeDefinitionsJson3(appData.settings.typeDefinitions);
  }
  const catalog = appData.settings.catalog;
  if (catalog) {
    const { addCatalogOption: addCatalogOption4 } = await Promise.resolve().then(() => (init_sqlStore(), sqlStore_exports));
    for (const dept of catalog.departments || []) await addCatalogOption4("departments", dept);
    for (const vendor of catalog.vendors || []) await addCatalogOption4("vendors", vendor);
    for (const [brand, models] of Object.entries(catalog.brands || {})) {
      await addCatalogOption4("brands", brand);
      for (const model of models) await addCatalogOption4("models", `${brand}:${model}`);
    }
    for (const value of catalog.ram || []) await addCatalogOption4("ram", value);
    for (const value of catalog.ssd || []) await addCatalogOption4("ssd", value);
    for (const value of catalog.cpu || []) await addCatalogOption4("cpu", value);
    for (const value of catalog.windowsVersion || []) await addCatalogOption4("windowsVersion", value);
    for (const value of catalog.licenseTypes || []) await addCatalogOption4("licenseTypes", value);
  }
  const finalAssets = await countJsonRows3("Assets");
  const finalEmployees = await countJsonRows3("Employees");
  const finalUsers = await countJsonRows3("Users");
  const detailsCount = Object.keys(await getAssetDetailsMap3()).length;
  console.log(
    `[SQL] Import complete \u2014 assets: ${finalAssets} (sqlite rows touched: ${sqliteCount}), employees: ${finalEmployees}, users: ${finalUsers}, asset-details: ${detailsCount}`
  );
  return { assets: finalAssets, employees: finalEmployees, users: finalUsers };
}
var DATA_DIR2, CACHE_DIR11, isDirectRun;
var init_sqlMigrate = __esm({
  "server/sqlMigrate.ts"() {
    init_assetHelpers();
    init_dataStore();
    init_sqlStore();
    init_sqlPool();
    dotenv.config();
    DATA_DIR2 = path18.join(process.cwd(), "data");
    CACHE_DIR11 = path18.join(DATA_DIR2, "cache");
    isDirectRun = process.argv[1] && path18.resolve(process.argv[1]).includes("sqlMigrate");
    if (isDirectRun) {
      migrateLocalDataToSql({ force: process.argv.includes("--force") }).then((result) => {
        console.log("[SQL] Migration finished", result);
        process.exit(0);
      }).catch((error) => {
        console.error("[SQL] Migration failed", error);
        process.exit(1);
      });
    }
  }
});

// server.ts
init_dataStore();
init_assetCatalogDefaults();
init_assetHelpers();
import express from "express";
import fs19 from "fs";
import path19 from "path";
import dotenv2 from "dotenv";

// server/usersService.ts
init_dataStore();
init_gasClient();
function normalizeUser2(raw) {
  return {
    email: String(raw.email || raw.Email || raw.MAIL || "").trim().toLowerCase(),
    role: String(raw.role || raw.Role || "User"),
    locations: normalizeStringList(raw.locations ?? raw.Locations ?? raw.location),
    plants: normalizeStringList(raw.plants ?? raw.Plants ?? raw.plant),
    categories: normalizeStringList(raw.categories ?? raw.Categories ?? raw.category ?? raw.access),
    allowDelete: !!raw.allowDelete || String(raw.allowDelete) === "true"
  };
}
var IT_ADMIN_ROLES = /* @__PURE__ */ new Set(["it admin", "it_admin"]);
function isItAdminRole(role) {
  return IT_ADMIN_ROLES.has(String(role || "").trim().toLowerCase());
}
function canDeleteUserRecord(user) {
  return !!user && !isItAdminRole(user.role);
}
function parseUsersFromGasResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return parseUsersSheetRows(result);
    }
    return result.map((u) => normalizeUser2(u)).filter((u) => u.email);
  }
  if (typeof result !== "object") return [];
  const r = result;
  if (r.error) return [];
  const buckets = [r.users, r.data, r.rows, r.list, r.result];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      if (bucket.length > 0 && Array.isArray(bucket[0])) {
        return parseUsersSheetRows(bucket);
      }
      return bucket.map((u) => normalizeUser2(u)).filter((u) => u.email);
    }
  }
  return [];
}
function parseUsersSheetRows(data) {
  if (data.length < 2) return [];
  const headers2 = data[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const emailIdx = headers2.findIndex((h) => h.includes("email") || h.includes("mail"));
  const roleIdx = headers2.findIndex((h) => h.includes("role"));
  const locIdx = headers2.findIndex((h) => h.includes("location"));
  const plantIdx = headers2.findIndex((h) => h.includes("plant"));
  const catIdx = headers2.findIndex((h) => h.includes("category") || h.includes("access"));
  if (emailIdx === -1) return [];
  return data.slice(1).map(
    (row) => normalizeUser2({
      email: row[emailIdx],
      role: roleIdx !== -1 ? row[roleIdx] : "User",
      locations: locIdx !== -1 ? row[locIdx] : [],
      plants: plantIdx !== -1 ? row[plantIdx] : [],
      categories: catIdx !== -1 ? row[catIdx] : []
    })
  ).filter((u) => u.email);
}
async function fetchUsersFromGas(proxyToGas2, gasWebappUrl, spreadsheetId, usersSheetGid) {
  if (gasWebappUrl) {
    try {
      const parsed = parseUsersFromGasResult(await gasGet(gasWebappUrl, { action: "list_users" }, 15e3));
      if (parsed.length >= 0) return parsed;
    } catch (e) {
      console.warn("fetchUsersFromGas GET:", e);
    }
  }
  try {
    const parsed = parseUsersFromGasResult(
      await proxyToGas2({ action: "list_users" }, 15e3)
    );
    return parsed;
  } catch (e) {
    console.warn("fetchUsersFromGas POST:", e);
    return [];
  }
}
function cleanScopeList(values) {
  const seen = /* @__PURE__ */ new Set();
  const next = [];
  for (const value of values || []) {
    const clean = String(value || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next;
}
function hasAllScope(values) {
  return cleanScopeList(values).some((value) => value.toLowerCase() === "all");
}
function withoutAllScope(values) {
  return cleanScopeList(values).filter((value) => value.toLowerCase() !== "all");
}
function mergeScopeList(primary, fallback, role) {
  if (isItAdminRole(role)) return ["All"];
  const primarySpecific = withoutAllScope(primary);
  if (primarySpecific.length > 0) return primarySpecific;
  const fallbackSpecific = withoutAllScope(fallback);
  if (fallbackSpecific.length > 0) return fallbackSpecific;
  if (hasAllScope(primary) || hasAllScope(fallback)) return [];
  return [];
}
function mergeFetchedUserWithLocal(fetched, local) {
  const role = fetched.role || local?.role || "User";
  return {
    ...local || fetched,
    ...fetched,
    role,
    locations: mergeScopeList(fetched.locations, local?.locations, role),
    plants: mergeScopeList(fetched.plants, local?.plants, role),
    categories: mergeScopeList(fetched.categories, local?.categories, role),
    allowDelete: fetched.allowDelete || local?.allowDelete || false
  };
}
function mergeFetchedUsersWithLocal(fetchedUsers, localUsers) {
  if (fetchedUsers.length === 0) return localUsers;
  const localByEmail = new Map(localUsers.map((u) => [u.email.toLowerCase(), u]));
  return fetchedUsers.map((user) => mergeFetchedUserWithLocal(user, localByEmail.get(user.email.toLowerCase()))).sort((a, b) => a.email.localeCompare(b.email));
}
function upsertLocalUser(user) {
  const data = readAppData();
  const idx = data.users.findIndex((u) => u.email === user.email);
  if (idx === -1) data.users.push(user);
  else data.users[idx] = user;
  writeAppData(data);
}
function deleteLocalUser(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return;
  const data = readAppData();
  data.users = data.users.filter((u) => u.email !== normalized);
  writeAppData(data);
}
async function getAllUsers(proxyToGas2, gasWebappUrl, spreadsheetId, usersSheetGid, listFromGoogleApi) {
  const localUsers = readAppData().users;
  let sheetUsers = [];
  if (spreadsheetId && usersSheetGid && usersSheetGid !== "0" && listFromGoogleApi) {
    try {
      const apiUsers = await listFromGoogleApi(spreadsheetId, usersSheetGid);
      if (apiUsers && apiUsers.length > 0) sheetUsers = apiUsers;
    } catch (err) {
      console.warn("Google API users fetch failed:", err);
    }
  }
  if (gasWebappUrl) {
    try {
      sheetUsers = await fetchUsersFromGas(
        proxyToGas2,
        gasWebappUrl,
        spreadsheetId,
        usersSheetGid
      );
    } catch (err) {
      console.warn("GAS users fetch failed:", err);
    }
    const mergedUsers = mergeFetchedUsersWithLocal(sheetUsers, localUsers);
    const data = readAppData();
    data.users = mergedUsers;
    writeAppData(data);
    return mergedUsers;
  }
  if (sheetUsers.length > 0) {
    const mergedUsers = mergeFetchedUsersWithLocal(sheetUsers, localUsers);
    const data = readAppData();
    data.users = mergedUsers;
    writeAppData(data);
    return mergedUsers;
  }
  return localUsers;
}

// server/pdfGenerator.ts
init_assetHelpers();
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// src/lib/warrantyDate.ts
function excelSerialToParts(serial) {
  if (serial < 1 || serial > 1e5) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 864e5;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0")
  };
}
function parseStoredDate(stored) {
  if (!stored?.trim()) return { day: "", month: "", year: "" };
  const s = stored.trim();
  if (/^\d{1,4}$/.test(s)) {
    return { day: "", month: "", year: s };
  }
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) {
    return { day: "", month: ym[2].padStart(2, "0"), year: ym[1] };
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return {
      year: ymd[1],
      month: ymd[2].padStart(2, "0"),
      day: ymd[3].padStart(2, "0")
    };
  }
  const iso = s.includes("T") ? s.split("T")[0] : s;
  const isoM = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoM) {
    return { year: isoM[1], month: isoM[2], day: isoM[3] };
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return {
      day: dmy[1].padStart(2, "0"),
      month: dmy[2].padStart(2, "0"),
      year: dmy[3]
    };
  }
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const parts = excelSerialToParts(parseFloat(s));
    if (parts) return parts;
  }
  const parsedMs = Date.parse(s);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, "0"),
      day: String(d.getDate()).padStart(2, "0")
    };
  }
  return { day: "", month: "", year: "" };
}
function partsToStored(parts) {
  const y = parts.year.trim();
  const mo = parts.month.trim();
  const d = parts.day.trim();
  if (!y) return "";
  if (!mo) return y;
  if (!d) return `${y}-${mo.padStart(2, "0")}`;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function normalizeWarrantyDate(raw) {
  if (!raw?.trim()) return "";
  const parts = parseStoredDate(raw.trim());
  const stored = partsToStored(parts);
  return stored || raw.trim();
}

// server/pdfGenerator.ts
init_constants();

// src/lib/formatDisplayDate.ts
function formatDisplayDate(date = /* @__PURE__ */ new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function formatDisplayTime(date = /* @__PURE__ */ new Date()) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}
function formatDisplayDateTime(date = /* @__PURE__ */ new Date()) {
  return `${formatDisplayDate(date)} ${formatDisplayTime(date)}`;
}
function parseStoredDateTime(value) {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d2] = v.split("-").map(Number);
    return new Date(y, m - 1, d2);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(v) || /^\d{4}-\d{2}-\d{2} /.test(v)) {
    const d2 = new Date(v);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  const dmY = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (dmY) {
    return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatStoredDateTime(value, fallback = "\u2014") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = parseStoredDateTime(raw);
  if (!parsed) return raw;
  return formatDisplayDateTime(parsed);
}

// server/driveUrls.ts
function extractDriveFileId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) return trimmed;
  const patterns = [
    /\/file\/d\/([^/?#]+)/i,
    /\/d\/([^/?#]+)/i,
    /[?&]id=([^&]+)/i,
    /\/uc\?[^#]*\bid=([^&]+)/i,
    /\/open\?[^#]*\bid=([^&]+)/i
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
function drivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
function driveDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
function driveViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
function toDriveDirectUrl(url) {
  if (!url) return url;
  const id = extractDriveFileId(url);
  if (id) return driveDownloadUrl(id);
  return url;
}
function toAppFileViewUrl(storedUrl, baseUrl = "") {
  const trimmed = (storedUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/file/view")) {
    return `${baseUrl.replace(/\/$/, "")}${trimmed}`;
  }
  const id = extractDriveFileId(trimmed);
  const q = id ? `id=${encodeURIComponent(id)}` : `url=${encodeURIComponent(trimmed)}`;
  return `${baseUrl.replace(/\/$/, "")}/api/file/view?${q}`;
}

// server/pdfGenerator.ts
function assetDisplayName(asset) {
  const name = String(asset.assetName || "").trim();
  if (name) return name;
  const makeModel = `${asset.make || ""} ${asset.model || ""}`.trim();
  if (makeModel) return makeModel;
  return String(asset.assetType || "Asset").trim();
}
function pdfSafeText(value, maxLen = 200) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.replace(/\u2014|\u2013/g, "-").replace(/\u2192/g, "->").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?").slice(0, maxLen);
}
function formatPdfDate(value) {
  return formatStoredDateTime(String(value ?? ""));
}
function drawPdfHeader(page, font, fontBold, asset) {
  const headerTop = 842;
  const redHeight = 38;
  const whiteHeight = 34;
  const redY = headerTop - redHeight;
  const whiteY = redY - whiteHeight;
  page.drawRectangle({ x: 0, y: redY, width: 595, height: redHeight, color: rgb(0.72, 0.11, 0.11) });
  page.drawText(pdfSafeText(APP_NAME), {
    x: 40,
    y: redY + 14,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  page.drawRectangle({ x: 0, y: whiteY, width: 595, height: whiteHeight, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: 0, y: whiteY + whiteHeight }, end: { x: 595, y: whiteY + whiteHeight }, thickness: 1, color: rgb(0.72, 0.11, 0.11) });
  page.drawLine({ start: { x: 0, y: whiteY }, end: { x: 595, y: whiteY }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  page.drawText(pdfSafeText(assetDisplayName(asset)), {
    x: 40,
    y: whiteY + 16,
    size: 14,
    font: fontBold,
    color: rgb(0.35, 0.02, 0.02)
  });
  const metaLine = [asset.assetType, asset.assetCode].filter(Boolean).join(" \xB7 ");
  if (metaLine) {
    page.drawText(pdfSafeText(metaLine), {
      x: 40,
      y: whiteY + 4,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45)
    });
  }
}
function formatPeripheralPdfLine(code, serial, make, model, connectivity) {
  return [
    formatPeripheralLine(code, serial),
    make ? `Brand: ${make}` : "",
    model ? `Model: ${model}` : "",
    connectivity ? `Connectivity: ${connectivity}` : ""
  ].filter(Boolean).join(" | ");
}
async function drawPeripheralDetailsPage(pdfDoc, asset, baseUrl, type, serial, code, make = "", model = "", connectivity = "") {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const scanUrl = `${baseUrl.replace(/\/$/, "")}/scan/${encodeURIComponent(code || serial)}`;
  const page = pdfDoc.addPage([595, 842]);
  const headerTop = 842;
  const bandHeight = 38;
  const whiteHeight = 30;
  const blueY = headerTop - bandHeight;
  const whiteY = blueY - whiteHeight;
  page.drawRectangle({ x: 0, y: blueY, width: 595, height: bandHeight, color: rgb(0.05, 0.35, 0.65) });
  page.drawText(pdfSafeText(APP_NAME), { x: 40, y: blueY + 14, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: whiteY, width: 595, height: whiteHeight, color: rgb(1, 1, 1) });
  page.drawText(pdfSafeText(`${type} Asset`), { x: 40, y: whiteY + 10, size: 13, font: fontBold, color: rgb(0.05, 0.25, 0.55) });
  let y = whiteY - 18;
  const lines = [
    ["Peripheral Type", type],
    ["Asset Code", code || "\u2014"],
    ["Serial Number", serial || "\u2014"],
    ["Parent Desktop Code", asset.assetCode || asset.uniqueCode || "\u2014"],
    ["Parent Desktop Serial", asset.serialNumber || "\u2014"],
    ["Assigned To", asset.contactName || "\u2014"],
    ["Assigned Date", formatPdfDate(asset.assignedDate) || "\u2014"],
    ["Location", asset.location || "\u2014"],
    ["Plant", asset.plantCode || "\u2014"],
    ["Employee Department", asset.department || "\u2014"]
  ];
  lines.splice(3, 0, ["Brand", make || "-"], ["Model Number", model || "-"], ["Connectivity", connectivity || "-"]);
  for (const [label, value] of lines) {
    const safe = pdfSafeText(value);
    page.drawText(`${pdfSafeText(label)}`, { x: 40, y, size: 9, font: fontBold, color: rgb(0.35, 0.35, 0.4) });
    page.drawText(safe || "\u2014", { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.15) });
    y -= 22;
    if (y < 140) break;
  }
  page.drawText(pdfSafeText(scanUrl, 180), {
    x: 40,
    y: 70,
    size: 8,
    font,
    color: rgb(0.1, 0.3, 0.7)
  });
}
async function drawDetailsPage(pdfDoc, asset, baseUrl, scanUrl) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  drawPdfHeader(page, font, fontBold, asset);
  const drawSection = (title, startY) => {
    page.drawRectangle({ x: 36, y: startY - 14, width: 523, height: 22, color: rgb(0.94, 0.96, 0.98) });
    page.drawText(pdfSafeText(title), { x: 44, y: startY - 8, size: 9, font: fontBold, color: rgb(0.2, 0.35, 0.55) });
    return startY - 28;
  };
  const drawRow = (label, value, yPos) => {
    if (/^asset\s*id$/i.test(String(label || "").trim())) return yPos;
    const safe = pdfSafeText(value);
    if (!safe || safe === "\u2014") return yPos;
    page.drawText(`${pdfSafeText(label)}`, { x: 44, y: yPos, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.45) });
    page.drawText(safe, { x: 190, y: yPos, size: 10, font, color: rgb(0.08, 0.08, 0.12) });
    return yPos - 17;
  };
  let y = drawSection("Asset Identity", 730);
  y = drawRow("Asset Code", asset.assetCode, y);
  y = drawRow("Unique Code", asset.uniqueCode, y);
  y = drawRow("Serial Number", asset.serialNumber, y);
  y = drawRow("Type / Category", `${asset.assetType} (${asset.mainCategory || "IT Assets"})`, y);
  y = drawRow("Make / Model", `${asset.make} ${asset.model}`.trim(), y);
  y = drawRow("Vendor", asset.vendorName, y);
  y = drawSection("Location & Assignment", y - 6);
  y = drawRow("Location", asset.location, y);
  y = drawRow("Plant", asset.plantCode, y);
  y = drawRow("Employee Department", asset.department, y);
  y = drawRow("Assigned To", asset.contactName || asset.employeeId, y);
  y = drawRow("Employee ID", asset.employeeId, y);
  y = drawRow("Assigned Date", formatPdfDate(asset.assignedDate), y);
  y = drawRow("Email", asset.contactEmail, y);
  y = drawRow("Mobile", asset.contactMobile, y);
  const isItDevice = (asset.mainCategory || "IT Assets") === "IT Assets";
  const isComputer = isItDevice && ["Laptop", "Desktop"].includes(asset.assetType);
  if (isItDevice) {
    y = drawSection("IT Specifications", y - 6);
    if (isComputer) {
      const ramStorage = `${asset.ram || ""} / ${asset.ssd || ""}`.trim();
      if (ramStorage && ramStorage !== "/") y = drawRow("RAM / Storage", ramStorage, y);
      const cpuOs = `${asset.cpu || ""} / ${asset.windowsVersion || ""}`.trim();
      if (cpuOs && cpuOs !== "/") y = drawRow("CPU / OS", cpuOs, y);
    }
    y = drawRow("IP Address", asset.ipAddress, y);
    y = drawRow("Host Name", asset.hostName, y);
    y = drawRow("MAC Address", asset.macAddress, y);
  } else if (asset.dynamicDetails && Object.keys(asset.dynamicDetails).length > 0) {
    let hasDynamicContent = false;
    for (const [key, value] of Object.entries(asset.dynamicDetails)) {
      if (String(value || "").trim()) {
        hasDynamicContent = true;
        break;
      }
    }
    if (hasDynamicContent) {
      y = drawSection("Specifications", y - 6);
      for (const [key, value] of Object.entries(asset.dynamicDetails)) {
        const valStr = String(value || "").trim();
        if (valStr && valStr !== "\u2014") {
          const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s+/g, " ").trim();
          y = drawRow(label, valStr, y);
        }
      }
    }
  }
  if (isDesktopAsset(asset)) {
    y = drawSection("Peripherals", y - 6);
    y = drawRow(
      "Monitor",
      formatPeripheralPdfLine(asset.monitorAssetCode, asset.monitorSerial, asset.monitorMake, asset.monitorModel),
      y
    );
    y = drawRow(
      "Keyboard",
      formatPeripheralPdfLine(
        asset.keyboardAssetCode,
        asset.keyboardSerial,
        asset.keyboardMake,
        asset.keyboardModel,
        asset.keyboardConnectivity
      ),
      y
    );
    y = drawRow(
      "Mouse",
      formatPeripheralPdfLine(
        asset.mouseAssetCode,
        asset.mouseSerial,
        asset.mouseMake,
        asset.mouseModel,
        asset.mouseConnectivity
      ),
      y
    );
    y = drawRow(
      "UPS",
      formatPeripheralPdfLine(asset.upsAssetCode, asset.upsSerial, asset.upsMake, asset.upsModel),
      y
    );
  }
  const warrantyStart = formatPdfDate(normalizeWarrantyDate(asset.warrantyStartDate));
  const warrantyEnd = formatPdfDate(normalizeWarrantyDate(asset.warrantyEndDate));
  const warrantyText = [warrantyStart, warrantyEnd].filter((v) => v && v !== "\u2014").join(" to ") || "";
  if (warrantyText) {
    y = drawSection("Warranty", y - 6);
    y = drawRow("Period", warrantyText, y);
  }
  if (asset.additionalItems?.trim()) {
    y = drawRow("Remarks", asset.additionalItems, y - 6);
  }
  y = drawSection("Attachment Links", Math.max(y - 6, 150));
  const docLink = toAppFileViewUrl(asset.documentUrl || "", baseUrl);
  const rawPhotoLink = toAppFileViewUrl(asset.imageUrl || "", baseUrl);
  const photoLink = rawPhotoLink && rawPhotoLink !== docLink ? rawPhotoLink : "";
  y = drawRow("Asset Photo Link", photoLink || "\u2014", y);
  y = drawRow("Asset Document Link", docLink || "\u2014", y);
  page.drawRectangle({ x: 36, y: 36, width: 523, height: 110, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 1 });
  page.drawText("Live asset record", { x: 48, y: 118, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.35) });
  page.drawText(pdfSafeText(scanUrl, 180), { x: 48, y: 100, size: 8, font, color: rgb(0.1, 0.3, 0.65) });
}
async function generateAssetPdf(asset, baseUrl, scanId) {
  const matchKey = scanId ? decodeURIComponent(scanId).toLowerCase().trim() : "";
  let peripheralType = null;
  let peripheralSerial = "";
  let peripheralCode = "";
  let peripheralMake = "";
  let peripheralModel = "";
  let peripheralConnectivity = "";
  if (matchKey && isDesktopAsset(asset)) {
    if (asset.monitorSerial && asset.monitorSerial.toLowerCase().trim() === matchKey || asset.monitorAssetCode && asset.monitorAssetCode.toLowerCase().trim() === matchKey) {
      peripheralType = "Monitor";
      peripheralSerial = asset.monitorSerial;
      peripheralCode = asset.monitorAssetCode;
      peripheralMake = asset.monitorMake;
      peripheralModel = asset.monitorModel;
    } else if (asset.keyboardSerial && asset.keyboardSerial.toLowerCase().trim() === matchKey || asset.keyboardAssetCode && asset.keyboardAssetCode.toLowerCase().trim() === matchKey) {
      peripheralType = "Keyboard";
      peripheralSerial = asset.keyboardSerial;
      peripheralCode = asset.keyboardAssetCode;
      peripheralMake = asset.keyboardMake;
      peripheralModel = asset.keyboardModel;
      peripheralConnectivity = asset.keyboardConnectivity;
    } else if (asset.mouseSerial && asset.mouseSerial.toLowerCase().trim() === matchKey || asset.mouseAssetCode && asset.mouseAssetCode.toLowerCase().trim() === matchKey) {
      peripheralType = "Mouse";
      peripheralSerial = asset.mouseSerial;
      peripheralCode = asset.mouseAssetCode;
      peripheralMake = asset.mouseMake;
      peripheralModel = asset.mouseModel;
      peripheralConnectivity = asset.mouseConnectivity;
    } else if (asset.upsSerial && asset.upsSerial.toLowerCase().trim() === matchKey || asset.upsAssetCode && asset.upsAssetCode.toLowerCase().trim() === matchKey) {
      peripheralType = "UPS";
      peripheralSerial = asset.upsSerial;
      peripheralCode = asset.upsAssetCode;
      peripheralMake = asset.upsMake;
      peripheralModel = asset.upsModel;
    }
  }
  const pdfDoc = await PDFDocument.create();
  if (peripheralType) {
    await drawPeripheralDetailsPage(
      pdfDoc,
      asset,
      baseUrl,
      peripheralType,
      peripheralSerial,
      peripheralCode,
      peripheralMake,
      peripheralModel,
      peripheralConnectivity
    );
  } else {
    const scanUrl = getScanUrl(baseUrl, asset);
    await drawDetailsPage(pdfDoc, asset, baseUrl, scanUrl);
  }
  const bytes = await pdfDoc.save();
  if (bytes.length < 5 || bytes[0] !== 37) {
    throw new Error("Generated PDF is invalid");
  }
  return bytes;
}

// server/sheetsUsers.ts
import { google } from "googleapis";
var SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
function formatList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}
async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientEmail || !privateKey) return null;
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES
  });
  return google.sheets({ version: "v4", auth });
}
async function getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid) {
  const gidStr = String(usersSheetGid || "").trim();
  if (!gidStr || gidStr === "0") return "Users";
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const gid = parseInt(gidStr, 10);
  if (Number.isNaN(gid)) return "Users";
  const found = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
  return found?.properties?.title || "Users";
}
function userToRow(user) {
  return [
    user.email,
    user.role,
    formatList(user.locations),
    formatList(user.plants),
    formatList(user.categories)
  ];
}
async function listUsersFromGoogleSheet(spreadsheetId, usersSheetGid) {
  const sheets = await getSheetsClient();
  if (!sheets) return null;
  const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A:Z`
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers2 = rows[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const emailIdx = headers2.findIndex((h) => h.includes("email") || h.includes("mail"));
  const roleIdx = headers2.findIndex((h) => h.includes("role"));
  const locIdx = headers2.findIndex((h) => h.includes("location"));
  const plantIdx = headers2.findIndex((h) => h.includes("plant"));
  const catIdx = headers2.findIndex((h) => h.includes("category") || h.includes("access"));
  if (emailIdx === -1) return [];
  return rows.slice(1).map((row) => ({
    email: String(row[emailIdx] || "").trim().toLowerCase(),
    role: String(roleIdx !== -1 ? row[roleIdx] : "User"),
    locations: String(locIdx !== -1 ? row[locIdx] || "" : "").split(",").map((s) => s.trim()).filter(Boolean),
    plants: String(plantIdx !== -1 ? row[plantIdx] || "" : "").split(",").map((s) => s.trim()).filter(Boolean),
    categories: String(catIdx !== -1 ? row[catIdx] || "" : "").split(",").map((s) => s.trim()).filter(Boolean)
  })).filter((u) => u.email);
}
async function addUserToGoogleSheet(spreadsheetId, usersSheetGid, user) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };
  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const range = `'${title}'!A:Z`;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    const rows = existing.data.values || [];
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${title}'!A1:E1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Email", "Role", "Locations", "Plants", "Categories"]] }
      });
    } else {
      const headers2 = rows[0].map((h) => String(h).toLowerCase());
      const emailIdx = headers2.findIndex((h) => h.includes("email"));
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
      requestBody: { values: [userToRow(user)] }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet append failed" };
  }
}
async function updateUserInGoogleSheet(spreadsheetId, usersSheetGid, user) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };
  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:Z`
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return { ok: false, error: "User not found in sheet" };
    const headers2 = rows[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
    const emailIdx = headers2.findIndex((h) => h.includes("email") || h.includes("mail"));
    const roleIdx = headers2.findIndex((h) => h.includes("role"));
    const locIdx = headers2.findIndex((h) => h.includes("location"));
    const plantIdx = headers2.findIndex((h) => h.includes("plant"));
    const catIdx = headers2.findIndex((h) => h.includes("category") || h.includes("access"));
    if (emailIdx === -1) return { ok: false, error: "Email column missing" };
    let rowNumber = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][emailIdx] || "").trim().toLowerCase() === user.email) {
        rowNumber = i + 1;
        break;
      }
    }
    if (rowNumber === -1) return { ok: false, error: "User not found in sheet" };
    const row = new Array(Math.max(headers2.length, 5)).fill("");
    if (emailIdx !== -1) row[emailIdx] = user.email;
    if (roleIdx !== -1) row[roleIdx] = user.role;
    if (locIdx !== -1) row[locIdx] = formatList(user.locations);
    if (plantIdx !== -1) row[plantIdx] = formatList(user.plants);
    if (catIdx !== -1) row[catIdx] = formatList(user.categories);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A${rowNumber}:Z${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet update failed" };
  }
}
async function deleteUserFromGoogleSheet(spreadsheetId, usersSheetGid, email) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };
  try {
    const title = await getUsersSheetTitle(sheets, spreadsheetId, usersSheetGid);
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const gid = parseInt(usersSheetGid, 10);
    const sheet = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === void 0) return { ok: false, error: "Users sheet not found" };
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A:Z`
    });
    const rows = res.data.values || [];
    const headers2 = (rows[0] || []).map((h) => String(h).toLowerCase());
    const emailIdx = headers2.findIndex((h) => h.includes("email"));
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
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet delete failed" };
  }
}

// server/gasUsers.ts
function formatList2(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}
function buildGasUserPayloads(action, user, email) {
  const flat = {
    email: user.email,
    role: user.role,
    locations: formatList2(user.locations),
    plants: formatList2(user.plants),
    categories: formatList2(user.categories)
  };
  if (action === "delete_user") {
    const target = email || user.email;
    return [
      { action: "delete_user", email: target },
      { action: "deleteUser", email: target },
      { action: "remove_user", email: target }
    ];
  }
  if (action === "update_user") {
    return [
      { action: "update_user", user },
      { action: "update_user", ...flat },
      { action: "updateUser", user: flat },
      { action: "edit_user", user: flat }
    ];
  }
  return [
    { action: "add_user", user },
    { action: "add_user", ...flat },
    { action: "addUser", user: flat }
  ];
}
function isGasSuccess(result) {
  if (!result || typeof result !== "object") return false;
  const r = result;
  if (r.error) return false;
  return r.success === true || r.ok === true || !!r.user || !!r.users;
}
async function saveUserViaGas(proxyToGas2, action, user, email) {
  const payloads = buildGasUserPayloads(action, user, email);
  const errors = [];
  for (const payload of payloads) {
    try {
      const result = await proxyToGas2(payload, 25e3);
      if (isGasSuccess(result)) {
        return { ok: true };
      }
      const err = result?.error;
      if (err) errors.push(String(err));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "GAS request failed");
    }
  }
  return {
    ok: false,
    error: errors[0] || `Google Apps Script does not support ${action}. Update GAS or add service account.`
  };
}

// server/userSheetSync.ts
async function persistUserToSheet(op, user, deps, emailForDelete) {
  const { proxyToGas: proxyToGas2, spreadsheetId, usersSheetGid } = deps;
  if (spreadsheetId) {
    let direct = { ok: false, error: "Not tried" };
    if (op === "add_user") {
      direct = await addUserToGoogleSheet(spreadsheetId, usersSheetGid, user);
    } else if (op === "update_user") {
      direct = await updateUserInGoogleSheet(spreadsheetId, usersSheetGid, user);
    } else {
      direct = await deleteUserFromGoogleSheet(
        spreadsheetId,
        usersSheetGid,
        emailForDelete || user.email
      );
    }
    if (direct.ok) return { ok: true, via: "google_api" };
  }
  const gas = await saveUserViaGas(proxyToGas2, op, user, emailForDelete);
  if (gas.ok) return { ok: true, via: "gas" };
  return {
    ok: false,
    error: gas.error || "Could not save to database. Deploy the latest backend script or set GOOGLE_SERVICE_ACCOUNT in .env"
  };
}

// server/otpService.ts
init_dataStore();
import crypto3 from "crypto";
import nodemailer2 from "nodemailer";

// server/usersSync.ts
init_dataStore();

// server/cacheStore.ts
import fs4 from "fs";
import path4 from "path";
import os3 from "os";
var isServerless2 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR = isServerless2 ? path4.join(os3.tmpdir(), "assetqr-cache") : path4.join(process.cwd(), "data", "cache");
function cachePath(key) {
  const safe = key.replace(/[^a-z0-9_-]/gi, "_");
  return path4.join(CACHE_DIR, `${safe}.json`);
}
function readCache(key, maxAgeMs) {
  try {
    const file = cachePath(key);
    if (!fs4.existsSync(file)) return null;
    const raw = JSON.parse(fs4.readFileSync(file, "utf-8"));
    if (Date.now() - raw.updatedAt > maxAgeMs) return null;
    return raw.data;
  } catch {
    return null;
  }
}
function readCacheStale(key) {
  try {
    const file = cachePath(key);
    if (!fs4.existsSync(file)) return null;
    const raw = JSON.parse(fs4.readFileSync(file, "utf-8"));
    return raw.data;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  if (!fs4.existsSync(CACHE_DIR)) {
    fs4.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const envelope = { data, updatedAt: Date.now() };
  fs4.writeFileSync(cachePath(key), JSON.stringify(envelope), "utf-8");
}
function deleteCache(key) {
  try {
    const file = cachePath(key);
    if (fs4.existsSync(file)) fs4.unlinkSync(file);
  } catch {
  }
}
var KNOWN_CACHE_KEYS = [
  "assets",
  "assets_deleted_tombstones",
  "users",
  "audit_logs",
  "asset-details",
  "assignment-history",
  "employees",
  "inventory",
  "missing_items"
];
function clearAllCaches() {
  for (const key of KNOWN_CACHE_KEYS) {
    deleteCache(key);
  }
}
var SPREADSHEET_META_KEY = "_spreadsheet_meta";
function getCacheSpreadsheetId() {
  const meta = readCacheStale(SPREADSHEET_META_KEY);
  return meta?.spreadsheetId?.trim() || null;
}
function touchCacheSpreadsheetId(spreadsheetId) {
  writeCache(SPREADSHEET_META_KEY, { spreadsheetId: spreadsheetId.trim() });
}
function isCacheForDifferentSpreadsheet(spreadsheetId) {
  const id = spreadsheetId?.trim();
  if (!id) return false;
  const cached = getCacheSpreadsheetId();
  return cached !== null && cached !== id;
}
function getCacheAge(key) {
  try {
    const file = cachePath(key);
    if (!fs4.existsSync(file)) return null;
    const raw = JSON.parse(fs4.readFileSync(file, "utf-8"));
    return Date.now() - raw.updatedAt;
  } catch {
    return null;
  }
}

// server/usersSync.ts
var CACHE_KEY = "users";
var FRESH_MS = 3 * 60 * 1e3;
var syncPromise = null;
function getCachedUsers() {
  const cached = readCacheStale(CACHE_KEY);
  if (cached) return cached;
  return [];
}
function invalidateUsersCache() {
  deleteCache(CACHE_KEY);
}
function getUsersSyncMeta() {
  const age = getCacheAge(CACHE_KEY);
  return {
    cacheAgeMs: age,
    isFresh: age !== null && age < FRESH_MS,
    syncing: !!syncPromise
  };
}
async function getUsersWithCache(deps, force = false) {
  if (deps.spreadsheetId && isCacheForDifferentSpreadsheet(deps.spreadsheetId)) {
    deleteCache(CACHE_KEY);
    force = true;
  }
  if (deps.gasWebappUrl) {
    const users = await syncUsersNow(deps);
    return { users, fromCache: false, syncing: false };
  }
  return { users: readAppData().users, fromCache: true, syncing: false };
}
async function pullUsers(deps) {
  return getAllUsers(
    deps.proxyToGas,
    deps.gasWebappUrl,
    deps.spreadsheetId,
    deps.usersSheetGid,
    deps.listFromGoogleApi
  );
}
async function syncUsersNow(deps) {
  const users = await pullUsers(deps);
  writeCache(CACHE_KEY, users);
  const data = readAppData();
  data.users = users;
  writeAppData(data);
  if (deps.spreadsheetId) touchCacheSpreadsheetId(deps.spreadsheetId);
  return users;
}

// server/otpService.ts
init_constants();
init_emailTemplates();
init_env();
var OTP_EXPIRY_MS = 10 * 60 * 1e3;
var OTP_RESEND_COOLDOWN_MS = 60 * 1e3;
var MAX_VERIFY_ATTEMPTS = 5;
var OTP_LENGTH = 6;
var otpStore = /* @__PURE__ */ new Map();
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function generateOtp() {
  return String(crypto3.randomInt(1e5, 1e6));
}
function getMailer(overridePass) {
  const user = (getEnv("SMTP_EMAIL") || "verify.software2040@pgel.in").trim();
  const envPass = (getEnv("SMTP_PASSWORD") || "").replace(/\s+/g, "").replace(/["']/g, "");
  const pass = overridePass || envPass || "nsxfmjjkskdrbbtt";
  if (!user || !pass) return null;
  return nodemailer2.createTransport({
    host: getEnv("SMTP_HOST") || "smtp.office365.com",
    port: parseInt(getEnv("SMTP_PORT") || "587", 10),
    secure: false,
    auth: { user, pass },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false
    }
  });
}
function getFromAddress() {
  const from = getEnv("OTP_FROM_EMAIL") || "verify.software2040@pgel.in";
  return `"${APP_NAME}" <${from}>`;
}
function findRegisteredUser(email) {
  const normalized = normalizeEmail(email);
  const cached = getCachedUsers().find((u) => u.email.trim().toLowerCase() === normalized);
  if (cached) return cached;
  const data = readAppData();
  const local = data.users.find((u) => u.email.trim().toLowerCase() === normalized);
  if (local) return local;
  return null;
}
async function requestOtp(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "Valid email is required" };
  }
  const user = findRegisteredUser(normalized);
  if (!user) {
    return { ok: false, error: "This email is not registered. Contact your IT administrator." };
  }
  const now = Date.now();
  const existing = otpStore.get(normalized);
  if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1e3);
    return { ok: false, error: `Please wait ${waitSec}s before requesting another code.` };
  }
  if (existing && existing.sendCount >= 5 && now - existing.lastSentAt < 15 * 60 * 1e3) {
    return { ok: false, error: "Too many OTP requests. Try again in 15 minutes." };
  }
  const otp = generateOtp();
  const transporter = getMailer();
  if (!transporter) {
    return {
      ok: false,
      error: "SMTP is not configured. Set SMTP_EMAIL and SMTP_PASSWORD for OTP mail (nodemailer)."
    };
  }
  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: normalized,
      subject: `${otp} - Your ${APP_SHORT_NAME} login code`,
      html: buildOtpEmailHtml(otp, Math.floor(OTP_EXPIRY_MS / 6e4)),
      text: `Your ${APP_NAME} login code is ${otp}. It expires in ${Math.floor(OTP_EXPIRY_MS / 6e4)} minutes.`
    });
  } catch (err) {
    console.warn("Primary OTP mail send failed, retrying with fallback credentials:", err instanceof Error ? err.message : err);
    const fallbackTransporter = getMailer("nsxfmjjkskdrbbtt");
    if (fallbackTransporter) {
      try {
        await fallbackTransporter.sendMail({
          from: getFromAddress(),
          to: normalized,
          subject: `${otp} - Your ${APP_SHORT_NAME} login code`,
          html: buildOtpEmailHtml(otp, Math.floor(OTP_EXPIRY_MS / 6e4)),
          text: `Your ${APP_NAME} login code is ${otp}. It expires in ${Math.floor(OTP_EXPIRY_MS / 6e4)} minutes.`
        });
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : "Failed to send email";
        console.error("OTP email retry error:", msg);
        return { ok: false, error: "Could not send OTP email. Please try again." };
      }
    } else {
      return { ok: false, error: "Could not send OTP email. Please try again." };
    }
  }
  otpStore.set(normalized, {
    otp,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: (existing?.sendCount || 0) + 1
  });
  return { ok: true };
}
function verifyOtp(email, otp) {
  const normalized = normalizeEmail(email);
  const code = String(otp || "").trim();
  if (!code || code.length !== OTP_LENGTH) {
    return { ok: false, error: "Enter the 6-digit OTP" };
  }
  const record = otpStore.get(normalized);
  if (!record) {
    return { ok: false, error: "OTP expired or not requested. Request a new code." };
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return { ok: false, error: "OTP has expired. Request a new code." };
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(normalized);
    return { ok: false, error: "Too many failed attempts. Request a new OTP." };
  }
  if (record.otp !== code) {
    record.attempts += 1;
    return { ok: false, error: `Invalid OTP. ${MAX_VERIFY_ATTEMPTS - record.attempts} attempts left.` };
  }
  otpStore.delete(normalized);
  return { ok: true };
}

// server/assetCache.ts
init_assetHelpers();
init_healAssetFields();
init_dataStore();
init_env();

// server/sheetSync.ts
import crypto4 from "crypto";
function normalizeSheetId(id) {
  return String(id ?? "").replace(/^0+/, "").trim();
}
function buildAssetSyncKeySet(assets) {
  const keys = /* @__PURE__ */ new Set();
  for (const asset of assets) {
    const id = normalizeSheetId(asset.id);
    const code = String(asset.assetCode || asset.uniqueCode || "").trim().toLowerCase();
    if (id) keys.add(`id:${id}`);
    if (code) keys.add(`code:${code}`);
  }
  return keys;
}
function isAssetOnSheet(asset, sheetKeys) {
  const id = normalizeSheetId(asset.id);
  const code = String(asset.assetCode || asset.uniqueCode || "").trim().toLowerCase();
  if (id && sheetKeys.has(`id:${id}`)) return true;
  if (code && sheetKeys.has(`code:${code}`)) return true;
  return false;
}
function computeAssetsFingerprint(assets) {
  const lines = [];
  for (const a of assets) {
    const id = normalizeSheetId(a.id);
    const code = String(a.assetCode || a.uniqueCode || "").trim().toLowerCase();
    if (id) lines.push(`id:${id}`);
    if (code) lines.push(`code:${code}`);
  }
  lines.sort();
  return crypto4.createHash("sha1").update(lines.join("\n")).digest("hex").slice(0, 16);
}
function shouldBlockSheetDeletion(params) {
  const {
    previousCount,
    sheetCount,
    removedCount,
    maxDeleteRatio = 0.5,
    minPreviousForEmptyGuard = 3
  } = params;
  if (sheetCount === 0 && previousCount >= minPreviousForEmptyGuard) {
    return {
      block: true,
      reason: `sheet returned 0 rows but cache has ${previousCount} assets`
    };
  }
  if (previousCount > 0 && removedCount > 0 && removedCount / previousCount > maxDeleteRatio) {
    return {
      block: true,
      reason: `would remove ${removedCount}/${previousCount} assets (>${Math.round(maxDeleteRatio * 100)}% threshold)`
    };
  }
  return { block: false };
}

// server/assetCache.ts
var CACHE_KEY2 = "assets";
var DELETED_CACHE_KEY = "assets_deleted_tombstones";
var RECENT_UPSERT_CACHE_KEY = "assets_recent_upserts";
var FRESH_MS2 = 2 * 60 * 1e3;
var DELETE_TOMBSTONE_MS = 10 * 60 * 1e3;
var RECENT_UPSERT_MS = 3 * 60 * 1e3;
var META_SYNC_MIN_INTERVAL_MS = 45 * 1e3;
var refreshPromise = null;
var lastScheduledSyncAt = 0;
var lastRemovedCount = 0;
function healAssetsList(assets) {
  return filterDeletedAssets(assets.map((a) => healMisalignedAssetFields(a)));
}
function readDeletedTombstones() {
  const raw = readCacheStale(DELETED_CACHE_KEY) || {};
  const now = Date.now();
  const active = {};
  for (const [id, expiresAt] of Object.entries(raw)) {
    if (Number(expiresAt) > now) active[id] = Number(expiresAt);
  }
  if (Object.keys(active).length !== Object.keys(raw).length) {
    writeCache(DELETED_CACHE_KEY, active);
  }
  return active;
}
function rememberDeletedAsset(assetId) {
  const id = normalizeSheetId(assetId);
  if (!id) return;
  const tombstones = readDeletedTombstones();
  tombstones[id] = Date.now() + DELETE_TOMBSTONE_MS;
  writeCache(DELETED_CACHE_KEY, tombstones);
}
function forgetDeletedAsset(assetId) {
  const id = normalizeSheetId(assetId);
  if (!id) return;
  const tombstones = readDeletedTombstones();
  if (!(id in tombstones)) return;
  delete tombstones[id];
  writeCache(DELETED_CACHE_KEY, tombstones);
}
function filterDeletedAssets(assets) {
  const tombstones = readDeletedTombstones();
  const deletedIds = new Set(Object.keys(tombstones));
  if (deletedIds.size === 0) return assets;
  return assets.filter((asset) => !deletedIds.has(normalizeSheetId(asset.id)));
}
function readRecentUpserts() {
  const raw = readCacheStale(RECENT_UPSERT_CACHE_KEY) || {};
  const now = Date.now();
  const active = {};
  for (const [id, expiresAt] of Object.entries(raw)) {
    if (Number(expiresAt) > now) active[id] = Number(expiresAt);
  }
  if (Object.keys(active).length !== Object.keys(raw).length) {
    writeCache(RECENT_UPSERT_CACHE_KEY, active);
  }
  return active;
}
function rememberRecentUpsert(asset) {
  const id = normalizeSheetId(asset.id);
  if (!id) return;
  const recent = readRecentUpserts();
  recent[id] = Date.now() + RECENT_UPSERT_MS;
  writeCache(RECENT_UPSERT_CACHE_KEY, recent);
}
function forgetRecentUpsertsSeenOnSheet(sheetAssets) {
  const recent = readRecentUpserts();
  if (Object.keys(recent).length === 0) return;
  let changed = false;
  for (const asset of sheetAssets) {
    const id = normalizeSheetId(asset.id);
    if (id && recent[id]) {
      delete recent[id];
      changed = true;
    }
  }
  if (changed) writeCache(RECENT_UPSERT_CACHE_KEY, recent);
}
function mergeAssetsBySyncKey(previous, incoming) {
  const sheetKeys = buildAssetSyncKeySet(filterDeletedAssets(incoming));
  const recentUpserts = readRecentUpserts();
  const merged = filterDeletedAssets(previous).filter((asset) => {
    const id = normalizeSheetId(asset.id);
    return isAssetOnSheet(asset, sheetKeys) || !!recentUpserts[id];
  });
  for (const raw of filterDeletedAssets(incoming)) {
    const asset = healMisalignedAssetFields(raw);
    const keys = buildAssetSyncKeySet([asset]);
    const idx = merged.findIndex((existing) => isAssetOnSheet(existing, keys));
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...asset };
    } else {
      merged.push(asset);
    }
  }
  return merged;
}
function reconcileSheetDeletions(sheetAssets) {
  const previous = readCacheStale(CACHE_KEY2) || [];
  if (previous.length === 0) return 0;
  const sheetKeys = buildAssetSyncKeySet(filterDeletedAssets(sheetAssets));
  const recentUpserts = readRecentUpserts();
  const removed = previous.filter((a) => {
    const id = normalizeSheetId(a.id);
    return !recentUpserts[id] && !isAssetOnSheet(a, sheetKeys);
  });
  const guard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: removed.length
  });
  if (guard.block) {
    console.warn(`[AMS] Sheet sync: deletion reconcile blocked - ${guard.reason}`);
    return 0;
  }
  return removed.length;
}
async function pullFromSheet(gasUrl) {
  const dbMode = readAppData().settings.dbMode;
  const previous = readCacheStale(CACHE_KEY2) || [];
  const sheetAssets = filterDeletedAssets(await fetchAllAssets(gasUrl, dbMode));
  const emptyGuard = shouldBlockSheetDeletion({
    previousCount: previous.length,
    sheetCount: sheetAssets.length,
    removedCount: 0
  });
  if (emptyGuard.block) {
    console.warn(`[AMS] Sheet sync: keeping previous cache - ${emptyGuard.reason}`);
    return previous;
  }
  if (sheetAssets.length === 0 && previous.length > 0) {
    console.warn(
      `[AMS] Sheet sync: keeping ${previous.length} cached assets because Database returned 0 rows.`
    );
    return previous;
  }
  lastRemovedCount = reconcileSheetDeletions(sheetAssets);
  forgetRecentUpsertsSeenOnSheet(sheetAssets);
  return mergeAssetsBySyncKey(previous, sheetAssets);
}
function getAssetsSyncMeta() {
  const cached = readCacheStale(CACHE_KEY2);
  return {
    count: cached?.length ?? 0,
    fingerprint: cached ? computeAssetsFingerprint(cached) : "",
    cacheAgeMs: getCacheAge(CACHE_KEY2),
    syncing: !!refreshPromise,
    lastRemovedCount
  };
}
function scheduleAssetsSyncIfStale(gasUrl) {
  if (!gasUrl || refreshPromise) return;
  const age = getCacheAge(CACHE_KEY2);
  const now = Date.now();
  if (now - lastScheduledSyncAt < META_SYNC_MIN_INTERVAL_MS) return;
  if (age !== null && age < META_SYNC_MIN_INTERVAL_MS) return;
  lastScheduledSyncAt = now;
  void refreshAssetsInBackground(gasUrl);
}
function getCachedAssets() {
  const cached = readCache(CACHE_KEY2, FRESH_MS2) ?? readCacheStale(CACHE_KEY2);
  return cached ? healAssetsList(cached) : null;
}
async function getAssetsWithCache(gasUrl, force = false) {
  const spreadsheetId = getEnv("SPREADSHEET_ID");
  if (spreadsheetId && isCacheForDifferentSpreadsheet(spreadsheetId)) {
    deleteCache(CACHE_KEY2);
    touchCacheSpreadsheetId(spreadsheetId);
    force = true;
  }
  if (!force && refreshPromise) {
    const cached = readCacheStale(CACHE_KEY2);
    if (cached) {
      return { assets: healAssetsList(cached), fromCache: true, syncing: true };
    }
  }
  if (!force) {
    const cached = getCachedAssets();
    if (cached) {
      scheduleAssetsSyncIfStale(gasUrl);
      return { assets: cached, fromCache: true, syncing: !!refreshPromise };
    }
  }
  const assets = await refreshAssetsNow(gasUrl);
  return { assets: healAssetsList(assets), fromCache: false, syncing: false };
}
function refreshAssetsInBackground(gasUrl) {
  if (!refreshPromise) {
    refreshPromise = pullFromSheet(gasUrl).then((assets) => {
      writeCache(CACHE_KEY2, assets);
      return assets;
    }).catch((err) => {
      console.warn("Background asset sync failed:", err);
      return readCacheStale(CACHE_KEY2) || [];
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
async function refreshAssetsNow(gasUrl) {
  try {
    const assets = await pullFromSheet(gasUrl);
    writeCache(CACHE_KEY2, assets);
    return assets;
  } catch (err) {
    const stale = readCacheStale(CACHE_KEY2);
    if (stale) {
      console.warn("Asset sync failed; keeping stale cache:", err);
      return healAssetsList(stale);
    }
    throw err;
  }
}
function invalidateAssetCache() {
  deleteCache(CACHE_KEY2);
}
function upsertAssetInCache(asset) {
  forgetDeletedAsset(String(asset.id || ""));
  const cached = readCacheStale(CACHE_KEY2) || [];
  const healed = healMisalignedAssetFields(asset);
  rememberRecentUpsert(healed);
  const targetId = normalizeSheetId(healed.id);
  const idx = cached.findIndex((a) => normalizeSheetId(a.id) === targetId);
  if (idx >= 0) {
    cached[idx] = { ...cached[idx], ...healed };
  } else {
    cached.push(healed);
  }
  writeCache(CACHE_KEY2, cached);
}
function removeAssetFromCache(assetId) {
  rememberDeletedAsset(assetId);
  const cached = readCacheStale(CACHE_KEY2);
  if (!cached) return;
  const targetId = normalizeSheetId(assetId);
  writeCache(
    CACHE_KEY2,
    cached.filter((a) => normalizeSheetId(a.id) !== targetId)
  );
}

// server/assetCodeGenerator.ts
import fs5 from "fs";
import path5 from "path";
import os4 from "os";
var CATEGORY_PREFIX = {
  "IT Assets": "IT",
  "Office Assets": "OFF",
  "Electrical Assets": "ELE",
  "Production Assets": "PRD",
  "Production": "PRD",
  "Safety Assets": "SAF",
  "Vehicle Assets": "VEH",
  "Furniture Assets": "FUR",
  "Software License Assets": "SW",
  "Software / License Assets": "SW",
  "Admin Facility Assets": "ADM",
  "Admin / Facility Assets": "ADM",
  "Maintenance Assets": "MNT",
  "IDU": "IDU",
  "ODU": "ODU",
  "IQC": "IQC",
  "QA ELECTRONICS": "QAE",
  "OPERATIONS": "OPS",
  "OQC": "OQC",
  "HE QUALITY": "HEQ",
  "SMT QA Press-Shop": "SQPR",
  "SMT QA Paint-Shop": "SQPA"
};
var isServerless3 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR2 = isServerless3 ? path5.join(os4.tmpdir(), "assetqr-cache") : path5.join(process.cwd(), "data", "cache");
var ISSUED_CODES_FILE = path5.join(CACHE_DIR2, "issued_codes.json");
function readIssuedCodes() {
  try {
    if (fs5.existsSync(ISSUED_CODES_FILE)) {
      const raw = fs5.readFileSync(ISSUED_CODES_FILE, "utf-8");
      return JSON.parse(raw) || [];
    }
  } catch (e) {
    console.warn("[AssetCodeGenerator] Failed to read issued_codes.json:", e);
  }
  return [];
}
function writeIssuedCodes(list) {
  try {
    if (!fs5.existsSync(CACHE_DIR2)) {
      fs5.mkdirSync(CACHE_DIR2, { recursive: true });
    }
    fs5.writeFileSync(ISSUED_CODES_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("[AssetCodeGenerator] Failed to write issued_codes.json:", e);
  }
}
function normAssetCode(value) {
  return value.trim().toLowerCase();
}
function getAssetCodePrefix(mainCategory) {
  return CATEGORY_PREFIX[(mainCategory || "").trim()] || "AST";
}
var activeSavingCodes = /* @__PURE__ */ new Set();
function registerSavingCode(code) {
  if (code && code.trim()) {
    activeSavingCodes.add(normAssetCode(code));
  }
}
function releaseSavingCode(code) {
  if (code && code.trim()) {
    activeSavingCodes.delete(normAssetCode(code));
  }
}
function isSavingCode(code) {
  return activeSavingCodes.has(normAssetCode(code));
}
var activeReservingIds = /* @__PURE__ */ new Set();
function reserveAssetId(id) {
  activeReservingIds.add(id);
}
function releaseAssetId(id) {
  activeReservingIds.delete(id);
}
function generateNextAssetId(assets) {
  let maxId = 0;
  for (const a of assets) {
    const n = parseInt(String(a.id || ""), 10);
    if (!isNaN(n) && n > maxId) maxId = n;
  }
  let candidate = maxId + 1;
  while (activeReservingIds.has(candidate) || assets.some((a) => parseInt(String(a.id || ""), 10) === candidate)) {
    candidate += 1;
  }
  reserveAssetId(candidate);
  console.log(`[AssetCodeGenerator] Reserved S No ${candidate} (active locks: ${activeReservingIds.size})`);
  return String(candidate).padStart(3, "0");
}
function isManualAssetCodeCategory(mainCategory) {
  const cat = (mainCategory || "IT Assets").trim();
  return cat === "Software / License Assets";
}
function generateAssetCode(assets, mainCategory) {
  const prefix = getAssetCodePrefix(mainCategory);
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i");
  let maxSeq = 0;
  const usedCodes = /* @__PURE__ */ new Set();
  const rememberCode = (value) => {
    const code = String(value || "").trim();
    if (!code) return;
    usedCodes.add(normAssetCode(code));
    const match = code.match(pattern);
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10) || 0);
    }
  };
  for (const asset of assets) {
    rememberCode(String(asset.assetCode || ""));
    rememberCode(String(asset.uniqueCode || ""));
  }
  const now = Date.now();
  const issued = readIssuedCodes().filter((item) => item.expiresAt > now);
  for (const item of issued) {
    if (getAssetCodePrefix(item.category) === prefix) {
      maxSeq = Math.max(maxSeq, item.seq);
    }
  }
  let candidate = "";
  let attempts = 0;
  let nextSeq = maxSeq;
  do {
    nextSeq += 1;
    candidate = `${prefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
    attempts += 1;
  } while (attempts < 1e4 && (usedCodes.has(normAssetCode(candidate)) || isSavingCode(candidate)));
  issued.push({
    category: mainCategory,
    seq: nextSeq,
    expiresAt: now + 5 * 60 * 1e3
  });
  writeIssuedCodes(issued);
  return candidate;
}
function releaseIssuedCode(mainCategory, assetCode) {
  const prefix = getAssetCodePrefix(mainCategory);
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i");
  const match = String(assetCode || "").trim().match(pattern);
  if (match) {
    const seq = parseInt(match[1], 10);
    if (seq) {
      const issued = readIssuedCodes();
      const next = issued.filter((item) => !(getAssetCodePrefix(item.category) === prefix && item.seq === seq));
      if (next.length !== issued.length) {
        writeIssuedCodes(next);
      }
    }
  }
}

// server.ts
init_healAssetFields();

// server/sheetRowMapper.ts
init_sheetHeaders();
function normalizeHeaderKey(header) {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function indexOfHeader(headers2, target) {
  const norm3 = normalizeHeaderKey(target);
  return headers2.findIndex((h) => normalizeHeaderKey(h) === norm3);
}
function mapMasterRowToSheetHeaders(sheetHeaders, masterHeaders, row) {
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
var AUDIT_FIELDS = [
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
  { key: "documentUrl", headers: ["Document URL / Attached Documents", "Document Link"] }
];
function logAssetMappingAudit(stage, assetData, headers2, row) {
  const audit = {};
  for (const { key, headers: aliases } of AUDIT_FIELDS) {
    const input = assetData[key];
    let colIdx = -1;
    let colName = "";
    for (const alias of aliases) {
      colIdx = indexOfHeader(headers2, alias);
      if (colIdx !== -1) {
        colName = headers2[colIdx];
        break;
      }
    }
    const rowValue = colIdx >= 0 ? String(row[colIdx] ?? "") : "";
    audit[key] = {
      input,
      column: colName,
      columnIndex: colIdx,
      rowValue,
      ok: String(input ?? "") === rowValue
    };
  }
  console.log(`[AMS Mapping] ${stage}`, JSON.stringify(audit, null, 2));
}

// server/maintenanceStore.ts
init_sqlConfig();
init_supabaseClient();
import fs6 from "fs";
import path6 from "path";

// src/types/maintenance.ts
var CUSTOM_TREND_MONTHS = 0;
var TREND_MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 12];
var DEFAULT_TREND_MONTHS = 2;
var TREND_SELECT_OPTIONS = [CUSTOM_TREND_MONTHS, ...TREND_MONTH_OPTIONS];
function isCustomTrend(months) {
  return Number(months) === CUSTOM_TREND_MONTHS;
}
function trendMonthsLabel(months) {
  switch (months) {
    case CUSTOM_TREND_MONTHS:
      return "Custom (manual dates)";
    case 1:
      return "Monthly (1 month)";
    case 2:
      return "Every 2 months";
    case 3:
      return "Quarterly (3 months)";
    case 4:
      return "Every 4 months";
    case 5:
      return "Every 5 months";
    case 6:
      return "Half-yearly (6 months)";
    case 12:
      return "Yearly (12 months)";
    default:
      return `Every ${months} months`;
  }
}
var DEFAULT_MACHINE_TYPES = [
  "Injection Molding Machine",
  "CNC Machine",
  "Press Machine",
  "Compressor",
  "Generator",
  "Conveyor",
  "Packaging Machine",
  "Extruder",
  "Chiller",
  "Boiler"
];

// server/maintenanceStore.ts
init_postgresMirror();
var MACHINES_FILE = "maintenance_machines";
var META_FILE = "maintenance_meta";
var COMPLAINTS_FILE = "maintenance_complaints";
var locks2 = /* @__PURE__ */ new Map();
async function withLock2(name, fn) {
  const previous = locks2.get(name) || Promise.resolve();
  let release = () => void 0;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks2.set(
    name,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
function localPath(name) {
  return path6.join(process.cwd(), "data", `${name}.json`);
}
async function loadJson(name, fallback) {
  if (isSupabaseMode()) {
    const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
    if (!remote) return fallback;
    try {
      return JSON.parse(new TextDecoder().decode(remote.bytes));
    } catch {
      return fallback;
    }
  }
  try {
    const file = localPath(name);
    if (!fs6.existsSync(file)) return fallback;
    return JSON.parse(fs6.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}
async function saveJson(name, data) {
  if (isSupabaseMode()) {
    await uploadToStorage(
      `tables/${name}.json`,
      Buffer.from(JSON.stringify(data, null, 2)),
      "application/json",
      DATA_BUCKET
    );
    return;
  }
  const file = localPath(name);
  fs6.mkdirSync(path6.dirname(file), { recursive: true });
  fs6.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}
function defaultMeta() {
  return {
    machineTypes: [...DEFAULT_MACHINE_TYPES],
    plantContacts: {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function listMaintenanceMachines() {
  const rows = await loadJson(MACHINES_FILE, []);
  return Array.isArray(rows) ? rows : [];
}
async function getMaintenanceMachine(id) {
  const rows = await listMaintenanceMachines();
  return rows.find((r) => r.id === id) || null;
}
async function getMaintenanceMachineByAssetCode(assetCode) {
  const code = String(assetCode || "").trim().toUpperCase();
  if (!code) return null;
  const rows = await listMaintenanceMachines();
  return rows.find((r) => String(r.assetCode || "").trim().toUpperCase() === code) || null;
}
async function upsertMaintenanceMachine(machine) {
  return withLock2(MACHINES_FILE, async () => {
    const rows = await listMaintenanceMachines();
    const idx = rows.findIndex((r) => r.id === machine.id);
    if (idx >= 0) rows[idx] = machine;
    else rows.push(machine);
    await saveJson(MACHINES_FILE, rows);
    if (isSupabaseMode()) {
      mirrorMachineToPostgres(machine).catch(() => void 0);
    }
    return machine;
  });
}
async function deleteMaintenanceMachine(id) {
  return withLock2(MACHINES_FILE, async () => {
    const rows = await listMaintenanceMachines();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await saveJson(MACHINES_FILE, next);
    if (isSupabaseMode()) {
      deleteMirroredMachine(id).catch(() => void 0);
    }
    return true;
  });
}
async function listMaintenanceComplaints() {
  const rows = await loadJson(COMPLAINTS_FILE, []);
  return Array.isArray(rows) ? rows : [];
}
async function getMaintenanceComplaint(id) {
  const rows = await listMaintenanceComplaints();
  return rows.find((r) => r.id === id) || null;
}
async function upsertMaintenanceComplaint(complaint) {
  return withLock2(COMPLAINTS_FILE, async () => {
    const rows = await listMaintenanceComplaints();
    const idx = rows.findIndex((r) => r.id === complaint.id);
    if (idx >= 0) rows[idx] = complaint;
    else rows.push(complaint);
    await saveJson(COMPLAINTS_FILE, rows);
    return complaint;
  });
}
async function getMaintenanceMeta() {
  const meta = await loadJson(META_FILE, null);
  if (!meta || !Array.isArray(meta.machineTypes)) return defaultMeta();
  const merged = Array.from(
    new Set([...DEFAULT_MACHINE_TYPES, ...meta.machineTypes].map((t) => String(t).trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  return {
    ...meta,
    machineTypes: merged,
    plantContacts: meta.plantContacts || {}
  };
}
async function saveMaintenanceMeta(meta) {
  return withLock2(META_FILE, async () => {
    const next = {
      ...meta,
      machineTypes: Array.from(
        new Set((meta.machineTypes || []).map((t) => String(t).trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
      plantContacts: meta.plantContacts || {},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveJson(META_FILE, next);
    return next;
  });
}
async function addMachineType(typeName) {
  const name = String(typeName || "").trim();
  if (!name) throw new Error("Machine type is required");
  const meta = await getMaintenanceMeta();
  if (!meta.machineTypes.some((t) => t.toLowerCase() === name.toLowerCase())) {
    meta.machineTypes.push(name);
  }
  return saveMaintenanceMeta(meta);
}
async function removeMachineType(typeName) {
  const name = String(typeName || "").trim().toLowerCase();
  if (!name) throw new Error("Machine type is required");
  const meta = await getMaintenanceMeta();
  meta.machineTypes = (meta.machineTypes || []).filter((t) => t.trim().toLowerCase() !== name);
  return saveMaintenanceMeta(meta);
}

// src/lib/maintenanceCodes.ts
var COMPLAINT_RESOLVE_SLA_DAYS = 7;
function nextMaintenanceAssetCode(machines) {
  let max = 0;
  for (const m of machines) {
    const match = String(m.assetCode || "").trim().toUpperCase().match(/^PM-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return `PM-${String(max + 1).padStart(5, "0")}`;
}
function normalizeMachineNumber(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}
function istTodayKey(d = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}
function istHour(d = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false
  }).formatToParts(d);
  return parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
}
function istMailSlot(d = /* @__PURE__ */ new Date()) {
  const h = istHour(d);
  if (h >= 16) return "pm";
  if (h >= 8) return "am";
  return null;
}
function istMailSlotKey(d = /* @__PURE__ */ new Date()) {
  const slot = istMailSlot(d);
  if (!slot) return null;
  return `${istTodayKey(d)}-${slot}`;
}
function daysUntilDate(dateStr, now = /* @__PURE__ */ new Date()) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1e3));
}
function daysUntilDateIst(dateStr, now = /* @__PURE__ */ new Date()) {
  const raw = String(dateStr || "").trim().slice(0, 10);
  if (!raw) return null;
  const today = istTodayKey(now);
  const t = Date.parse(`${today}T00:00:00`);
  const d = Date.parse(`${raw}T00:00:00`);
  if (Number.isNaN(t) || Number.isNaN(d)) return null;
  return Math.round((d - t) / (24 * 60 * 60 * 1e3));
}
function istCalendarDaysSince(iso, now = /* @__PURE__ */ new Date()) {
  const reported = new Date(iso);
  if (Number.isNaN(reported.getTime())) return 0;
  const a = Date.parse(`${istTodayKey(reported)}T00:00:00`);
  const b = Date.parse(`${istTodayKey(now)}T00:00:00`);
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1e3)));
}
function dateKey(value) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : formatDateOnly(value);
  const d = parseDateOnly(value);
  return d ? formatDateOnly(d) : "";
}
function completedPlanDateKeys(machine) {
  const keys = /* @__PURE__ */ new Set();
  for (const log of machine.pmLogs || []) {
    const planned = dateKey(log.plannedDate);
    const done = dateKey(log.doneOn);
    if (planned) keys.add(planned);
    if (done) keys.add(done);
  }
  const last = dateKey(machine.lastMaintenanceDate);
  if (last) keys.add(last);
  return keys;
}
function manualPlanDates(machine) {
  const sorted = uniqueDates([machine.nextMaintenanceDate, ...machine.customPlanDates || []]);
  return sorted.sort((a, b) => a.getTime() - b.getTime());
}
function isPlanDateCompleted(machine, planned) {
  const k = formatDateOnly(planned);
  if (completedPlanDateKeys(machine).has(k)) return true;
  const last = parseDateOnly(machine.lastMaintenanceDate);
  if (last && planned.getTime() <= last.getTime()) return true;
  return false;
}
function pendingPlanDates(machine) {
  if (isCustomTrend(machineTrendMonths(machine))) {
    return manualPlanDates(machine).filter((d) => !isPlanDateCompleted(machine, d)).sort((a, b) => a.getTime() - b.getTime());
  }
  const next = parseDateOnly(machine.nextMaintenanceDate);
  if (!next) return [];
  return isPlanDateCompleted(machine, next) ? [] : [next];
}
function effectiveNextMaintenanceDate(machine) {
  const pending = pendingPlanDates(machine);
  if (pending[0]) return formatDateOnly(pending[0]);
  return String(machine.nextMaintenanceDate || "").trim();
}
function mergeCustomPlan(next, extras) {
  const all = normalizeCustomPlanDates([next, ...extras || []]);
  if (!all.length) return { nextMaintenanceDate: String(next || "").trim(), customPlanDates: [] };
  return {
    nextMaintenanceDate: all[0],
    customPlanDates: all.slice(1)
  };
}
function maintenancePendingDays(machine, now = /* @__PURE__ */ new Date()) {
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine), now);
  if (days == null) return 0;
  if (days >= 0) return 0;
  return Math.abs(days);
}
function normalizeTrendMonths(raw, fallback = DEFAULT_TREND_MONTHS) {
  const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
  if (n === CUSTOM_TREND_MONTHS) return CUSTOM_TREND_MONTHS;
  if (Number.isFinite(n) && n >= 1 && n <= 24) return Math.round(n);
  return fallback;
}
function machineTrendMonths(machine) {
  const n = typeof machine.trendMonths === "number" ? machine.trendMonths : parseInt(String(machine.trendMonths || ""), 10);
  if (n === CUSTOM_TREND_MONTHS) return CUSTOM_TREND_MONTHS;
  return normalizeTrendMonths(machine.trendMonths);
}
function normalizeCustomPlanDates(raw) {
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;\s]+/) : [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of arr) {
    const d = parseDateOnly(String(v || "").trim());
    if (!d) continue;
    const k = formatDateOnly(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.sort();
}
function addMonthsToDate(from, months) {
  const base = typeof from === "string" ? new Date(from.includes("T") ? from : `${from}T00:00:00`) : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function suggestNextMaintenanceDate(from = /* @__PURE__ */ new Date(), trendMonths = DEFAULT_TREND_MONTHS) {
  const trend = normalizeTrendMonths(trendMonths);
  if (isCustomTrend(trend)) return "";
  return addMonthsToDate(from, trend);
}
function nextDateForTrend(machine, trendMonths, now = /* @__PURE__ */ new Date()) {
  const trend = normalizeTrendMonths(trendMonths);
  if (isCustomTrend(trend)) {
    return String(machine.nextMaintenanceDate || "").trim() || todayIso(now);
  }
  const base = machine.lastMaintenanceDate?.trim() || todayIso(now);
  return addMonthsToDate(base, trend);
}
function todayIso(now = /* @__PURE__ */ new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDowntimeLabel(minutes) {
  const n = Math.round(Number(minutes) || 0);
  if (n <= 0) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function parseDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function uniqueDates(values) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of values) {
    const d = parseDateOnly(v);
    if (!d) continue;
    const k = formatDateOnly(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

// src/lib/plantDisplay.ts
var PLANT_SHORT_NAMES = {
  "4020": "NGM",
  "2040": "PGTL"
};
function samePlant(a, b) {
  const l = String(a || "").trim().toLowerCase();
  const r = String(b || "").trim().toLowerCase();
  if (!l || !r) return false;
  if (l === r) return true;
  if (l.includes(r) || r.includes(l)) return true;
  return false;
}
function plantShortName(code, plants) {
  const c = String(code || "").trim();
  if (!c) return "\u2014";
  const mapped = PLANT_SHORT_NAMES[c] || PLANT_SHORT_NAMES[c.toUpperCase()];
  const found = plants?.find((p) => samePlant(p.code, c) || samePlant(p.name, c));
  const name = String(found?.name || "").trim();
  if (name && !/^\d+$/.test(name)) return name;
  if (mapped) return mapped;
  if (found?.code && !/^\d+$/.test(String(found.code))) return String(found.code).trim();
  return c;
}

// server/maintenanceMail.ts
init_env();
init_constants();
import nodemailer3 from "nodemailer";

// server/maintenanceTechnicians.ts
var MAX_MAINTENANCE_TECHNICIANS = 20;
function normalizeTechnicianNames(names) {
  if (!Array.isArray(names)) return [];
  return names.map((n) => String(n || "").trim()).filter(Boolean);
}
function parseTechnicianPayload(body) {
  const technicianCount = Math.floor(Number(body.technicianCount));
  const technicianNames = normalizeTechnicianNames(body.technicianNames);
  if (!Number.isFinite(technicianCount) || technicianCount < 1) {
    return { error: "Select how many people worked on this job (minimum 1)" };
  }
  if (technicianCount > MAX_MAINTENANCE_TECHNICIANS) {
    return { error: `Maximum ${MAX_MAINTENANCE_TECHNICIANS} people allowed` };
  }
  if (technicianNames.length !== technicianCount) {
    return {
      error: `Enter all ${technicianCount} name${technicianCount === 1 ? "" : "s"}`
    };
  }
  const seen = /* @__PURE__ */ new Set();
  for (const name of technicianNames) {
    if (name.length < 2) {
      return { error: "Each name must be at least 2 characters" };
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { error: "Duplicate names are not allowed" };
    }
    seen.add(key);
  }
  return { technicianCount, technicianNames };
}
function formatTechnicianNames(names) {
  const list = normalizeTechnicianNames(names);
  return list.length ? list.join(", ") : "-";
}

// server/maintenanceMail.ts
function pickMailIdentity(m) {
  return {
    assetCode: m.assetCode,
    machineType: m.machineType,
    machineNumber: m.machineNumber,
    equipmentName: m.equipmentName,
    department: m.department,
    responsibility: m.responsibility,
    location: m.location,
    plantCode: m.plantCode
  };
}
function getPlantMaintenanceEmails(plantContacts, plantCode) {
  const c = plantContacts?.[plantCode] || plantContacts?.[plantCode.toUpperCase()] || plantContacts?.[plantCode.toLowerCase()] || {};
  return Array.from(
    new Set(
      [c.hodEmail, c.fhEmail, c.phEmail].map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
    )
  );
}
function professionalShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:#113355;padding:20px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;font-weight:600;">Maintenance Notification</p>
        </td></tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">This is an automated notification from ${APP_NAME}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function kvRow(label, value, valueStyle = "") {
  return `<tr><td style="padding:6px 0;color:#64748b;width:42%;">${label}</td><td style="padding:6px 0;font-weight:700;${valueStyle}">${escapeHtml(value)}</td></tr>`;
}
function identityHtml(m) {
  return [
    kvRow("Machine / Equipment", String(m.equipmentName || "").trim() || m.machineType),
    kvRow("Asset Code", m.assetCode),
    kvRow("Machine Type", m.machineType),
    kvRow("Machine Number", m.machineNumber),
    kvRow("Department", String(m.department || "").trim() || "\u2014"),
    kvRow("Responsibility", String(m.responsibility || "").trim() || "Not assigned"),
    kvRow("Location", m.location),
    kvRow("Plant", plantShortName(m.plantCode))
  ].join("");
}
function identityText(m) {
  return [
    `Machine / Equipment: ${String(m.equipmentName || "").trim() || m.machineType}`,
    `Asset Code: ${m.assetCode}`,
    `Machine Type: ${m.machineType}`,
    `Machine Number: ${m.machineNumber}`,
    `Department: ${String(m.department || "").trim() || "\u2014"}`,
    `Responsibility: ${String(m.responsibility || "").trim() || "Not assigned"}`,
    `Location: ${m.location}`,
    `Plant: ${plantShortName(m.plantCode)}`
  ].join("\n");
}
function reminderHtml(count) {
  if (!count || count < 1) return "";
  return kvRow("Reminder Count", String(count), "color:#b91c1c;");
}
function reminderText(count) {
  if (!count || count < 1) return "";
  return `Reminder Count: ${count}`;
}
function daysRemainingLabel(days) {
  if (days === 0) return "Due today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}
function buildPreventiveReminderEmail(m) {
  const remaining = m.daysRemaining ?? 0;
  const countBit = m.reminderCount ? ` | Reminder ${m.reminderCount}` : "";
  const subject = `Preventive Maintenance Reminder${countBit} \u2014 ${m.assetCode} (${daysRemainingLabel(remaining)})`;
  const intro = remaining === 0 ? "This is a reminder that preventive maintenance for the machine below is due today." : `This is a reminder that preventive maintenance for the machine below is due in ${remaining} day${remaining === 1 ? "" : "s"}. Daily reminders will continue until the work is marked as Done.`;
  const extra = [
    identityText(m),
    `Scheduled Maintenance Date: ${m.nextMaintenanceDate}`,
    `Days Remaining: ${remaining === 0 ? "Due today" : String(remaining)}`,
    reminderText(m.reminderCount)
  ].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

${intro}

${extra}

Please complete the maintenance on or before the scheduled date and mark it as Done in the AEMS Maintenance module.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Scheduled Date", m.nextMaintenanceDate)}
      ${kvRow("Days Remaining", remaining === 0 ? "Due today" : String(remaining))}
      ${reminderHtml(m.reminderCount)}
    </table>
    <p>Please complete the maintenance on or before the scheduled date and mark it as <strong>Done</strong> in the AEMS Maintenance module.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildPreventiveOverdueEmail(m) {
  const countBit = m.reminderCount ? ` | Reminder ${m.reminderCount}` : "";
  const overdueLabel = m.pendingDays === 1 ? "1 day overdue" : `${m.pendingDays} days overdue`;
  const subject = `Overdue Maintenance Reminder${countBit} \u2014 ${m.assetCode} (${overdueLabel})`;
  const extra = [
    identityText(m),
    `Scheduled Maintenance Date: ${m.nextMaintenanceDate}`,
    `Days Overdue: ${m.pendingDays}`,
    reminderText(m.reminderCount)
  ].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

This is an overdue reminder. Preventive maintenance for the machine below was not completed on the scheduled date and has not been marked as Done.

${extra}

Please complete the maintenance without further delay and update the status as Done in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the work is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is an <strong>overdue reminder</strong>. Preventive maintenance for the machine below was not completed on the scheduled date and has not been marked as Done.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Scheduled Date", m.nextMaintenanceDate)}
      ${kvRow("Days Overdue", String(m.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(m.reminderCount)}
    </table>
    <p>Please complete the maintenance without further delay and update the status as <strong>Done</strong> in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the work is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildPreventiveSolvedEmail(m) {
  const peopleWorked = formatTechnicianNames(m.technicianNames);
  const subject = `Maintenance Completed \u2014 ${m.assetCode} (${m.machineNumber})`;
  const extra = [
    identityText(m),
    `Planned Date: ${m.plannedDate}`,
    `Completed On: ${m.completedOn}`,
    `Closed By: ${m.resolvedBy}`,
    m.technicianCount ? `People Worked: ${m.technicianCount}` : "",
    peopleWorked !== "-" ? `Names: ${peopleWorked}` : "",
    reminderText(m.reminderCount)
  ].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

Preventive maintenance for the machine below has been completed and marked as Done.

${extra}

${m.remarks ? `Close-out remark:
${m.remarks}
` : ""}
No further reminders will be issued for this maintenance cycle.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>Preventive maintenance for the machine below has been completed and marked as <strong>Done</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Planned Date", m.plannedDate)}
      ${kvRow("Completed On", m.completedOn)}
      ${kvRow("Closed By", m.resolvedBy)}
      ${m.technicianCount ? kvRow("People Worked", String(m.technicianCount)) : ""}
      ${peopleWorked !== "-" ? kvRow("Names", peopleWorked) : ""}
      ${reminderHtml(m.reminderCount)}
    </table>
    ${m.remarks ? `<p style="margin:0 0 8px;font-weight:700;">Close-out remark</p><div style="padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(m.remarks)}</div>` : ""}
    <p style="margin-top:16px;">No further reminders will be issued for this maintenance cycle.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildComplaintNotifyEmail(c) {
  const extraText = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    c.reporterName ? `Reported By: ${c.reporterName}` : "",
    c.reporterEmployeeCode ? `Employee Code: ${c.reporterEmployeeCode}` : "",
    c.reporterPhone ? `Reporter Phone: ${c.reporterPhone}` : "",
    c.downtimeLabel ? `Downtime: ${c.downtimeLabel}` : "",
    c.remark ? `Remark:
${c.remark}` : "",
    c.photoUrl ? `Photo: ${c.photoUrl}` : ""
  ].filter(Boolean).join("\n");
  const subject = `Breakdown Complaint Registered \u2014 ${c.assetCode} (${c.machineNumber})`;
  const text = `Dear Sir / Madam,

A breakdown complaint has been registered for the machine below. Please review the details and arrange for resolution.

${extraText}

Breakdown Details:
${c.complaintText}

Please mark the complaint as Done in the AEMS Maintenance module once the issue has been resolved. Daily reminders will continue until then.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>A <strong>breakdown complaint</strong> has been registered for the machine below. Please review the details and arrange for resolution.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${c.reporterName ? kvRow("Reported By", c.reporterName) : ""}
      ${c.reporterEmployeeCode ? kvRow("Employee Code", c.reporterEmployeeCode) : ""}
      ${c.reporterPhone ? kvRow("Reporter Phone", c.reporterPhone) : ""}
      ${c.downtimeLabel ? kvRow("Downtime", c.downtimeLabel) : ""}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Breakdown Details</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    ${c.remark ? `<p style="margin:16px 0 8px;font-weight:700;">Remark</p><div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.remark)}</div>` : ""}
    ${c.photoUrl ? `<p style="margin:16px 0 8px;font-weight:700;">Photo</p><p><a href="${escapeHtml(c.photoUrl)}">View photo</a></p><p><img src="${escapeHtml(c.photoUrl)}" alt="Breakdown photo" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0;" /></p>` : ""}
    <p style="margin-top:16px;">Please mark the complaint as <strong>Done</strong> in the AEMS Maintenance module once the issue has been resolved. Daily reminders will continue until then.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildComplaintPendingEmail(c) {
  const countBit = c.reminderCount ? ` | Reminder ${c.reminderCount}` : "";
  const subject = `Downtime Complaint Reminder${countBit} \u2014 ${c.assetCode} (${c.pendingDays} day${c.pendingDays === 1 ? "" : "s"} pending)`;
  const extra = [identityText(c), `Days Pending: ${c.pendingDays}`, reminderText(c.reminderCount)].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

This is a reminder that the downtime complaint below remains unresolved.

${extra}

Complaint:
${c.complaintText}

Please complete the resolution and mark the complaint as Done in the AEMS Maintenance module. Reminders will continue until the complaint is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is a reminder that the downtime complaint below remains <strong>unresolved</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Days Pending", String(c.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    <p style="margin-top:16px;">Please complete the resolution and mark the complaint as <strong>Done</strong> in the AEMS Maintenance module. Reminders will continue until the complaint is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildComplaintOverOneWeekEmail(c) {
  const countBit = c.reminderCount ? ` | Reminder ${c.reminderCount}` : "";
  const subject = `Overdue Downtime Complaint${countBit} \u2014 ${c.assetCode} (${c.pendingDays} days pending)`;
  const extra = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    `Days Pending: ${c.pendingDays}`,
    reminderText(c.reminderCount)
  ].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

This is an overdue reminder. The downtime complaint below has remained unresolved for more than seven days and requires immediate attention.

${extra}

Complaint:
${c.complaintText}

Please resolve the issue and mark the complaint as Done in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the complaint is closed.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>This is an <strong>overdue reminder</strong>. The downtime complaint below has remained unresolved for more than seven days and requires immediate attention.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${kvRow("Days Pending", String(c.pendingDays), "color:#b91c1c;")}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    <p style="margin-top:16px;">Please resolve the issue and mark the complaint as <strong>Done</strong> in the AEMS Maintenance module. Overdue reminders will continue twice daily at 9:00 AM and 4:00 PM IST until the complaint is closed.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildComplaintSolvedEmail(c) {
  const peopleWorked = formatTechnicianNames(c.technicianNames);
  const subject = `Complaint Resolved \u2014 ${c.assetCode} (${c.machineNumber})`;
  const extra = [
    identityText(c),
    `Reported At: ${c.reportedAt}`,
    `Resolved At: ${c.resolvedAt}`,
    `Resolved By: ${c.resolvedBy}`,
    c.technicianCount ? `People Worked: ${c.technicianCount}` : "",
    peopleWorked !== "-" ? `Names: ${peopleWorked}` : "",
    reminderText(c.reminderCount)
  ].filter(Boolean).join("\n");
  const text = `Dear Sir / Madam,

The downtime complaint below has been resolved and marked as Done.

${extra}

Complaint:
${c.complaintText}

Resolution remarks:
${c.remarks || "-"}

${c.resolutionPhotoUrl ? `Evidence photo: ${c.resolutionPhotoUrl}` : ""}

No further reminders will be issued for this complaint.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>The downtime complaint below has been resolved and marked as <strong>Done</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(c)}
      ${kvRow("Reported At", c.reportedAt)}
      ${kvRow("Resolved At", c.resolvedAt)}
      ${kvRow("Resolved By", c.resolvedBy)}
      ${c.technicianCount ? kvRow("People Worked", String(c.technicianCount)) : ""}
      ${peopleWorked !== "-" ? kvRow("Names", peopleWorked) : ""}
      ${reminderHtml(c.reminderCount)}
    </table>
    <p style="margin:0 0 8px;font-weight:700;">Complaint</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.complaintText)}</div>
    ${c.remarks ? `<p style="margin:16px 0 8px;font-weight:700;">Resolution remarks</p><div style="padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;white-space:pre-wrap;">${escapeHtml(c.remarks)}</div>` : ""}
    ${c.resolutionPhotoUrl ? `<p style="margin:16px 0 8px;font-weight:700;">Close-out evidence</p><p><a href="${escapeHtml(c.resolutionPhotoUrl)}">View evidence photo</a></p><p><img src="${escapeHtml(c.resolutionPhotoUrl)}" alt="Resolution evidence" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0;" /></p>` : ""}
    <p style="margin-top:16px;">No further reminders will be issued for this complaint.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function buildTrendChangeEmail(m) {
  const subject = `Maintenance Trend Updated \u2014 ${m.assetCode} (${m.machineNumber})`;
  const extra = [
    identityText(m),
    `Previous Trend: ${trendMonthsLabel(m.previousTrendMonths)}`,
    `New Trend: ${trendMonthsLabel(m.newTrendMonths)}`,
    `Updated Next Maintenance Date: ${m.nextMaintenanceDate}`,
    `Changed By: ${m.changedBy}`
  ].join("\n");
  const text = `Dear Sir / Madam,

The preventive maintenance interval for the machine below has been updated.

${extra}

Future reminders will follow the revised schedule. Please review and ensure the new cycle is followed in the AEMS Maintenance module.

Yours sincerely,
${APP_NAME}`;
  const html = professionalShell(
    subject,
    `<p>Dear Sir / Madam,</p>
    <p>The preventive maintenance interval for the machine below has been updated.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      ${identityHtml(m)}
      ${kvRow("Previous Trend", trendMonthsLabel(m.previousTrendMonths))}
      ${kvRow("New Trend", trendMonthsLabel(m.newTrendMonths), "color:#1d4ed8;")}
      ${kvRow("Next Maintenance Date", m.nextMaintenanceDate)}
      ${kvRow("Changed By", m.changedBy)}
    </table>
    <p>Future reminders will follow the revised schedule. Please review and ensure the new cycle is followed in the AEMS Maintenance module.</p>
    <p>Yours sincerely,<br/>${APP_NAME}</p>`
  );
  return { subject, html, text };
}
function todayKey(d = /* @__PURE__ */ new Date()) {
  return istTodayKey(d);
}
async function sendViaSmtp(to, subject, html, text, cc, bcc, attachments) {
  const user = (getEnv("SMTP_EMAIL") || "verify.software2040@pgel.in").trim();
  const envPass = (getEnv("SMTP_PASSWORD") || "").replace(/\s+/g, "").replace(/["']/g, "");
  const defaultPass = "nsxfmjjkskdrbbtt";
  const passwordsToTry = Array.from(new Set([envPass, defaultPass].filter(Boolean)));
  if (to.length === 0) throw new Error("No recipients");
  const host = getEnv("SMTP_HOST") || "smtp.office365.com";
  const port = parseInt(getEnv("SMTP_PORT") || "587", 10);
  const secure = getEnv("SMTP_SECURE") === "true";
  const from = (getEnv("OTP_FROM_EMAIL") || user).trim();
  const mailOptions = {
    from: `"${APP_NAME}" <${from}>`,
    to: to.join(", "),
    subject,
    html,
    text
  };
  if (cc && cc.length > 0) {
    mailOptions.cc = cc.join(", ");
  }
  if (bcc && bcc.length > 0) {
    mailOptions.bcc = bcc.join(", ");
  }
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }
  let lastError = null;
  for (const pass of passwordsToTry) {
    try {
      const transporter = nodemailer3.createTransport({
        host,
        port,
        secure: false,
        auth: { user, pass },
        tls: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: false
        }
      });
      await transporter.sendMail(mailOptions);
      return;
    } catch (err) {
      lastError = err;
      console.warn("[MaintenanceMail] Send failed with candidate pass:", err instanceof Error ? err.message : err);
    }
  }
  throw lastError || new Error("Failed to send maintenance email via SMTP");
}
async function sendMaintenanceMail(opts) {
  const recipients = Array.from(
    new Set(opts.to.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))
  );
  if (recipients.length === 0) return { ok: false, error: "No recipients" };
  const cc = opts.cc ? Array.from(new Set(opts.cc.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))) : void 0;
  const bcc = opts.bcc ? Array.from(new Set(opts.bcc.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))) : void 0;
  try {
    await sendViaSmtp(recipients, opts.subject, opts.html, opts.text, cc, bcc, opts.attachments);
    return { ok: true, via: "smtp" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn("[MaintenanceMail] SMTP failed:", error);
    return { ok: false, error };
  }
}

// server/maintenanceCron.ts
function alreadySentSlot(lastMailSlot, slotKey, date, lastDaily) {
  if (slotKey) return lastMailSlot === slotKey;
  return lastDaily === date;
}
function alreadySentToday(lastDaily, date) {
  return lastDaily === date;
}
async function runMaintenanceCron() {
  const date = todayKey();
  const slotKey = istMailSlotKey();
  const result = {
    ok: true,
    date,
    slot: slotKey,
    monthRemindersSent: 0,
    remindersSent: 0,
    overdueSent: 0,
    complaintDailySent: 0,
    complaintOverdueSent: 0,
    errors: []
  };
  const meta = await getMaintenanceMeta();
  const plantContacts = meta.plantContacts || {};
  const machines = await listMaintenanceMachines();
  for (const machine of machines) {
    const dueDate = effectiveNextMaintenanceDate(machine);
    const days = daysUntilDateIst(dueDate);
    if (days == null) continue;
    if (days > 7) continue;
    const recipients = getPlantMaintenanceEmails(plantContacts, machine.plantCode);
    if (recipients.length === 0) continue;
    const identity = pickMailIdentity(machine);
    const nextCount = (machine.reminderCount || 0) + 1;
    const recordSent = async (patch) => {
      await upsertMaintenanceMachine({
        ...machine,
        ...patch,
        reminderCount: nextCount,
        lastMailSlot: slotKey || `${date}-am`,
        lastReminderEmailOn: date,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    };
    if (days >= 0 && days <= 7) {
      if (alreadySentToday(machine.lastReminderEmailOn, date)) continue;
      const mail = buildPreventiveReminderEmail({
        ...identity,
        nextMaintenanceDate: dueDate,
        reminderCount: nextCount,
        daysRemaining: days
      });
      const sent = await sendMaintenanceMail({ to: recipients, ...mail });
      if (sent.ok) {
        result.remindersSent += 1;
        await recordSent({
          status: days === 0 ? "Maintenance Due" : machine.status === "Active" ? "Maintenance Due" : machine.status
        });
      } else if (sent.error) {
        result.errors.push(`${machine.assetCode} reminder: ${sent.error}`);
      }
      continue;
    }
    if (days < 0) {
      if (alreadySentSlot(machine.lastMailSlot, slotKey, date, machine.lastDailyEmailOn)) continue;
      const mail = buildPreventiveOverdueEmail({
        ...identity,
        nextMaintenanceDate: dueDate,
        pendingDays: Math.abs(days),
        reminderCount: nextCount
      });
      const sent = await sendMaintenanceMail({ to: recipients, ...mail });
      if (sent.ok) {
        result.overdueSent += 1;
        await recordSent({
          lastDailyEmailOn: date,
          lastEscalationEmailOn: date,
          status: "Overdue"
        });
      } else if (sent.error) {
        result.errors.push(`${machine.assetCode} overdue: ${sent.error}`);
      }
    }
  }
  const complaints = await listMaintenanceComplaints();
  for (const complaint of complaints) {
    if (complaint.status !== "Open") continue;
    const recipients = getPlantMaintenanceEmails(plantContacts, complaint.plantCode);
    if (recipients.length === 0) continue;
    const pendingDays = istCalendarDaysSince(complaint.reportedAt);
    if (pendingDays < 1) continue;
    const identity = pickMailIdentity(complaint);
    const nextCount = (complaint.reminderCount || 0) + 1;
    const overdue = pendingDays > COMPLAINT_RESOLVE_SLA_DAYS;
    if (overdue) {
      if (alreadySentSlot(complaint.lastMailSlot, slotKey, date, complaint.lastDailyEmailOn)) continue;
    } else if (alreadySentToday(complaint.lastDailyEmailOn, date)) {
      continue;
    }
    const useOverdueTemplate = overdue && !complaint.notifiedOverdueOn;
    const mail = useOverdueTemplate ? buildComplaintOverOneWeekEmail({
      ...identity,
      complaintText: complaint.complaintText,
      reportedAt: complaint.reportedAt,
      pendingDays,
      reminderCount: nextCount
    }) : buildComplaintPendingEmail({
      ...identity,
      complaintText: complaint.complaintText,
      pendingDays,
      reminderCount: nextCount
    });
    const sent = await sendMaintenanceMail({ to: recipients, ...mail });
    if (sent.ok) {
      if (overdue) result.complaintOverdueSent += 1;
      else result.complaintDailySent += 1;
      const patch = {
        ...complaint,
        reminderCount: nextCount,
        lastDailyEmailOn: date,
        lastMailSlot: slotKey || `${date}-am`,
        notifiedOverdueOn: useOverdueTemplate ? date : complaint.notifiedOverdueOn
      };
      await upsertMaintenanceComplaint(patch);
    } else if (sent.error) {
      result.errors.push(`complaint ${complaint.id}: ${sent.error}`);
    }
  }
  result.ok = result.errors.length === 0;
  return result;
}

// server/emailStore.ts
init_sqlConfig();
init_supabaseClient();
import fs7 from "fs";
import path7 from "path";
var TEMPLATES_FILE = "email_templates";
var AUTOMATIONS_FILE = "email_automations";
var DRAFTS_FILE = "email_drafts";
var LOGS_FILE = "email_execution_logs";
function localPath2(name) {
  return path7.join(process.cwd(), "data", `${name}.json`);
}
async function loadJson2(name, fallback) {
  if (isSupabaseMode()) {
    const remote = await downloadFromStorage(`tables/${name}.json`, DATA_BUCKET);
    if (!remote) return fallback;
    try {
      return JSON.parse(new TextDecoder().decode(remote.bytes));
    } catch {
      return fallback;
    }
  }
  try {
    const file = localPath2(name);
    if (!fs7.existsSync(file)) return fallback;
    return JSON.parse(fs7.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}
async function saveJson2(name, data) {
  if (isSupabaseMode()) {
    await uploadToStorage(
      `tables/${name}.json`,
      Buffer.from(JSON.stringify(data, null, 2)),
      "application/json",
      DATA_BUCKET
    );
    return;
  }
  const file = localPath2(name);
  fs7.mkdirSync(path7.dirname(file), { recursive: true });
  fs7.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}
function defaultTemplates() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return [
    {
      id: "tpl_overdue_pm",
      name: "Overdue Preventive Maintenance Alert",
      category: "overdue_pm",
      subject: "URGENT: Preventive Maintenance Overdue Machines - {{PlantName}}",
      bodyHtml: `<p>Dear Maintenance & Plant Leadership,</p>
<p>The following machine(s) in <strong>{{PlantName}}</strong> have exceeded their scheduled preventive maintenance date and are currently <strong>OVERDUE</strong>.</p>
<p>Immediate action is required to avoid unplanned machine breakdown and ensure equipment reliability.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">Please assign maintenance technicians immediately and complete the maintenance in the AEMS portal.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentDate}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_upcoming_pm",
      name: "Upcoming Preventive Maintenance Notice",
      category: "upcoming_pm",
      subject: "Upcoming Preventive Maintenance Schedule (Next {{ReminderDays}} Days) - {{PlantName}}",
      bodyHtml: `<p>Dear Sir / Madam,</p>
<p>This is an automated advance notification of machines due for preventive maintenance within the next <strong>{{ReminderDays}} days</strong> in <strong>{{PlantName}}</strong>.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">Please plan necessary spare parts, tooling, and line clearance accordingly.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{ReminderDays}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_complaint_created",
      name: "Breakdown Complaint Registered",
      category: "complaint_created",
      subject: "BREAKDOWN ALERT: Machine {{MachineNumber}} ({{MachineType}}) - {{PlantName}}",
      bodyHtml: `<p>A machine breakdown complaint has been registered in AEMS.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine Name</td><td style="padding:6px 0;font-weight:700;">{{MachineName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Asset Code</td><td style="padding:6px 0;font-weight:700;">{{MachineCode}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Serial Number</td><td style="padding:6px 0;font-weight:700;">{{SerialNumber}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Model Number</td><td style="padding:6px 0;font-weight:700;">{{ModelNumber}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Plant / Location</td><td style="padding:6px 0;font-weight:700;">{{PlantName}} ({{LocationName}})</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Issue Description</td><td style="padding:6px 0;font-weight:700;color:#b91c1c;">{{IssueDescription}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Reported By</td><td style="padding:6px 0;font-weight:700;">{{ReportedBy}}</td></tr>
</table>
<p>Technicians have been notified. Please address promptly to minimize line stoppage.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{MachineType}}",
        "{{SerialNumber}}",
        "{{ModelNumber}}",
        "{{PlantName}}",
        "{{LocationName}}",
        "{{IssueDescription}}",
        "{{ReportedBy}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_complaint_resolved",
      name: "Machine Breakdown Resolved",
      category: "complaint_resolved",
      subject: "RESOLVED: Breakdown Complaint on Machine {{MachineNumber}} - {{PlantName}}",
      bodyHtml: `<p>The breakdown complaint on machine <strong>{{MachineNumber}}</strong> has been marked <strong>RESOLVED</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine Name</td><td style="padding:6px 0;font-weight:700;">{{MachineName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Asset Code</td><td style="padding:6px 0;font-weight:700;">{{MachineCode}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Action Taken</td><td style="padding:6px 0;font-weight:700;color:#15803d;">{{ActionTaken}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Root Cause</td><td style="padding:6px 0;font-weight:700;">{{RootCause}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Downtime</td><td style="padding:6px 0;font-weight:700;">{{Downtime}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Resolved By</td><td style="padding:6px 0;font-weight:700;">{{ResolvedBy}}</td></tr>
</table>
<p>Machine is now back in production.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{PlantName}}",
        "{{ActionTaken}}",
        "{{RootCause}}",
        "{{Downtime}}",
        "{{ResolvedBy}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_sla_breach",
      name: "Complaint SLA Breach Alert",
      category: "sla_breached",
      subject: "ESCALATION: Complaint SLA Breached for Machine {{MachineNumber}} ({{DaysOpen}} Days Open)",
      bodyHtml: `<p><strong>ATTENTION:</strong> A maintenance complaint has remained open beyond the resolution SLA window.</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
  <tr><td style="padding:6px 0;color:#64748b;width:35%;">Machine</td><td style="padding:6px 0;font-weight:700;">{{MachineName}} ({{MachineCode}})</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Plant</td><td style="padding:6px 0;font-weight:700;">{{PlantName}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Days Open</td><td style="padding:6px 0;font-weight:700;color:#b91c1c;">{{DaysOpen}} days</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Complaint Date</td><td style="padding:6px 0;font-weight:700;">{{ComplaintDate}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Issue</td><td style="padding:6px 0;font-weight:700;">{{IssueDescription}}</td></tr>
</table>
<p>Please escalate to the department and plant head for urgent closure.</p>`,
      variables: [
        "{{MachineName}}",
        "{{MachineCode}}",
        "{{MachineNumber}}",
        "{{PlantName}}",
        "{{DaysOpen}}",
        "{{ComplaintDate}}",
        "{{IssueDescription}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_monthly_pm",
      name: "Monthly PM Summary Report",
      category: "monthly_pm",
      subject: "Monthly Preventive Maintenance Summary - {{CurrentMonth}} - {{PlantName}}",
      bodyHtml: `<p>Dear Management,</p>
<p>Here is the monthly preventive maintenance status report for <strong>{{CurrentMonth}}</strong> for <strong>{{PlantName}}</strong>.</p>
{{ConsolidatedTable}}
<p style="margin-top:16px;">This summary is automatically generated by AEMS.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentMonth}}",
        "{{TotalCount}}",
        "{{ConsolidatedTable}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_zero_machine_entry",
      name: "Daily Machine Entry Missing Alert",
      category: "zero_machine_entry",
      subject: "ACTION REQUIRED: No Machine Entry Logged Today ({{CurrentDate}}) - {{PlantName}}",
      bodyHtml: `<p>Dear Maintenance & Plant Leadership,</p>
<p>This is an automated alert from AEMS to inform you that <strong>NO machine entries, maintenance logs, or status updates</strong> have been recorded today (<strong>{{CurrentDate}}</strong>) for <strong>{{PlantName}}</strong>.</p>
<div style="background-color:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 16px;margin:16px 0;">
  <p style="margin:0;color:#9f1239;font-weight:bold;font-size:14px;">\u26A0\uFE0F Compliance Warning: Daily Machine Log Pending</p>
  <p style="margin:6px 0 0 0;color:#881337;font-size:12px;">Total Registered Machines in Plant: <strong>{{TotalCount}}</strong></p>
</div>
<p>Daily recording of machine health, PM activities, and status is critical to maintain equipment uptime and prevent untracked breakdowns.</p>
<p style="margin-top:16px;">Please instruct the plant maintenance team / supervisor to log in to AEMS portal and update today's machine records immediately.</p>`,
      variables: [
        "{{PlantName}}",
        "{{LocationName}}",
        "{{CurrentDate}}",
        "{{TotalCount}}"
      ],
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ];
}
function defaultAutomations() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return [
    {
      id: "auto_overdue_pm",
      name: "Overdue PM Automated Alert",
      triggerType: "overdue_pm",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["09:00", "16:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "Maintenance Head", target: "cc" }
      ],
      templateId: "tpl_overdue_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_upcoming_pm",
      name: "Upcoming PM 7-Day Alert",
      triggerType: "upcoming_pm",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["08:30"],
      reminderDays: 7,
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" }
      ],
      templateId: "tpl_upcoming_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_complaint_created",
      name: "Breakdown Complaint Notification",
      triggerType: "complaint_created",
      status: "active",
      frequency: "instant",
      scheduleTimes: [],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,PH", target: "to" }
      ],
      templateId: "tpl_complaint_created",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 10,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_complaint_resolved",
      name: "Complaint Resolved Notification",
      triggerType: "complaint_resolved",
      status: "active",
      frequency: "instant",
      scheduleTimes: [],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,PH", target: "to" }
      ],
      templateId: "tpl_complaint_resolved",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 10,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_sla_breach",
      name: "Complaint SLA Breach Alert",
      triggerType: "sla_breached",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["10:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "IT Admin", target: "cc" }
      ],
      templateId: "tpl_sla_breach",
      consolidationMode: "individual",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_monthly_pm",
      name: "Monthly PM Summary Report",
      triggerType: "monthly_pm",
      status: "active",
      frequency: "monthly",
      scheduleTimes: ["10:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" }
      ],
      templateId: "tpl_monthly_pm",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 30,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "auto_zero_machine_entry",
      name: "Daily Machine Entry Missing Alert",
      triggerType: "zero_machine_entry",
      status: "active",
      frequency: "daily",
      scheduleTimes: ["18:00"],
      recipientRules: [
        { type: "plant_contacts", value: "HOD,FH,PH", target: "to" },
        { type: "role", value: "Maintenance Head", target: "cc" }
      ],
      templateId: "tpl_zero_machine_entry",
      consolidationMode: "consolidated",
      retryCount: 3,
      retryIntervalMinutes: 15,
      createdAt: now,
      updatedAt: now
    }
  ];
}
async function listEmailTemplates() {
  const rows = await loadJson2(TEMPLATES_FILE, []);
  if (!Array.isArray(rows) || rows.length === 0) {
    const defaults2 = defaultTemplates();
    await saveJson2(TEMPLATES_FILE, defaults2);
    return defaults2;
  }
  const defaults = defaultTemplates();
  let changed = false;
  for (const def of defaults) {
    if (!rows.some((r) => r.id === def.id)) {
      rows.push(def);
      changed = true;
    }
  }
  if (changed) {
    await saveJson2(TEMPLATES_FILE, rows);
  }
  return rows;
}
async function getEmailTemplate(id) {
  const list = await listEmailTemplates();
  return list.find((t) => t.id === id) || null;
}
async function upsertEmailTemplate(template) {
  const list = await listEmailTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    ...template,
    updatedAt: now,
    createdAt: template.createdAt || now
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson2(TEMPLATES_FILE, list);
  return item;
}
async function deleteEmailTemplate(id) {
  const list = await listEmailTemplates();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  await saveJson2(TEMPLATES_FILE, next);
  return true;
}
async function listEmailAutomations() {
  const rows = await loadJson2(AUTOMATIONS_FILE, []);
  if (!Array.isArray(rows) || rows.length === 0) {
    const defaults2 = defaultAutomations();
    await saveJson2(AUTOMATIONS_FILE, defaults2);
    return defaults2;
  }
  const defaults = defaultAutomations();
  let changed = false;
  for (const def of defaults) {
    if (!rows.some((r) => r.id === def.id)) {
      rows.push(def);
      changed = true;
    }
  }
  if (changed) {
    await saveJson2(AUTOMATIONS_FILE, rows);
  }
  return rows;
}
async function upsertEmailAutomation(automation) {
  const list = await listEmailAutomations();
  const idx = list.findIndex((a) => a.id === automation.id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    ...automation,
    updatedAt: now,
    createdAt: automation.createdAt || now
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson2(AUTOMATIONS_FILE, list);
  return item;
}
async function deleteEmailAutomation(id) {
  const list = await listEmailAutomations();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  await saveJson2(AUTOMATIONS_FILE, next);
  return true;
}
async function listEmailDrafts(userEmail) {
  const rows = await loadJson2(DRAFTS_FILE, []);
  if (!Array.isArray(rows)) return [];
  if (userEmail) {
    return rows.filter((d) => d.createdBy.toLowerCase() === userEmail.toLowerCase());
  }
  return rows;
}
async function upsertEmailDraft(draft) {
  const list = await listEmailDrafts();
  const idx = list.findIndex((d) => d.id === draft.id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    ...draft,
    updatedAt: now,
    createdAt: draft.createdAt || now
  };
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveJson2(DRAFTS_FILE, list);
  return item;
}
async function deleteEmailDraft(id) {
  const list = await listEmailDrafts();
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  await saveJson2(DRAFTS_FILE, next);
  return true;
}
async function listEmailLogs(limit = 200) {
  const rows = await loadJson2(LOGS_FILE, []);
  if (!Array.isArray(rows)) return [];
  return rows.slice(-limit).reverse();
}
async function appendEmailLog(log) {
  const rows = await loadJson2(LOGS_FILE, []);
  const item = {
    ...log,
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  };
  rows.push(item);
  if (rows.length > 2e3) rows.splice(0, rows.length - 2e3);
  await saveJson2(LOGS_FILE, rows);
  return item;
}
async function isIdempotentAlreadySent(idempotencyKey) {
  if (!idempotencyKey) return false;
  const rows = await loadJson2(LOGS_FILE, []);
  return rows.some((r) => r.idempotencyKey === idempotencyKey && r.status === "sent");
}
async function getEmailAnalytics() {
  const logs = await loadJson2(LOGS_FILE, []);
  const automations = await listEmailAutomations();
  const drafts = await listEmailDrafts();
  let sent = 0;
  let failed = 0;
  let retrying = 0;
  const byCategory = {};
  const trendMap = {};
  for (const log of logs) {
    if (log.status === "sent") sent++;
    else if (log.status === "failed") failed++;
    else if (log.status === "retrying") retrying++;
    const cat = log.triggerType || "other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const d = log.date || "Unknown";
    if (!trendMap[d]) trendMap[d] = { sent: 0, failed: 0 };
    if (log.status === "sent") trendMap[d].sent++;
    if (log.status === "failed") trendMap[d].failed++;
  }
  const sortedDates = Object.keys(trendMap).sort().slice(-14);
  const trend = sortedDates.map((date) => ({
    date,
    sent: trendMap[date].sent,
    failed: trendMap[date].failed
  }));
  return {
    totalEmails: logs.length,
    sent,
    failed,
    retrying,
    scheduledAutomations: automations.filter((a) => a.status === "active").length,
    drafts: drafts.length,
    byCategory,
    trend
  };
}

// server/emailScheduler.ts
init_constants();
function currentIstTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(/* @__PURE__ */ new Date());
  return parts;
}
function currentIstDate() {
  return istTodayKey();
}
function escapeHtml2(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function professionalShell2(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${escapeHtml2(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:700px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr><td style="background:#113355;padding:20px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:12px;font-weight:600;">Preventive Maintenance & Equipment Notification</p>
        </td></tr>
        <tr><td style="padding:28px;color:#334155;font-size:14px;line-height:1.65;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">This is an automated consolidated notification from ${APP_NAME}. Please do not reply directly to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
function renderMachineConsolidatedTable(machines, type) {
  if (machines.length === 0) {
    return `<p style="font-style:italic;color:#64748b;">No machines found in this category.</p>`;
  }
  const isOverdue = type === "overdue";
  const headerCol = isOverdue ? "Days Overdue" : type === "upcoming" ? "Days Left" : "Status";
  const rowsHtml = machines.map((m, idx) => {
    const dueDate = effectiveNextMaintenanceDate(m);
    const days = daysUntilDateIst(dueDate);
    const daysLabel = isOverdue ? `<span style="color:#b91c1c;font-weight:700;">${Math.abs(days || 0)}d late</span>` : type === "upcoming" ? `<span style="color:#2563eb;font-weight:700;">${days ?? 0}d left</span>` : `<span style="color:#15803d;font-weight:700;">${m.status || "Active"}</span>`;
    const machineName = m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim();
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 8px;font-weight:700;color:#0f172a;">${escapeHtml2(machineName)}</td>
        <td style="padding:10px 8px;font-family:monospace;font-size:12px;font-weight:700;color:#1d4ed8;">${escapeHtml2(m.assetCode || "")}</td>
        <td style="padding:10px 8px;font-family:monospace;font-size:11px;font-weight:600;color:#475569;">${escapeHtml2(m.serialNumber || "\u2014")}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569;">${escapeHtml2(m.modelNumber || "\u2014")}</td>
        <td style="padding:10px 8px;font-size:12px;font-weight:600;color:#334155;">${escapeHtml2(plantShortName(m.plantCode))}</td>
        <td style="padding:10px 8px;font-size:12px;color:#64748b;">${escapeHtml2(m.department || "\u2014")}</td>
        <td style="padding:10px 8px;font-size:12px;font-weight:600;color:#0f172a;">${escapeHtml2(dueDate || "\u2014")}</td>
        <td style="padding:10px 8px;font-size:12px;text-align:center;">${daysLabel}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569;">${escapeHtml2(m.responsibility || "Unassigned")}</td>
      </tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#0f172a;color:#ffffff;text-align:left;">
        <th style="padding:10px 8px;font-weight:700;">Machine</th>
        <th style="padding:10px 8px;font-weight:700;">Code</th>
        <th style="padding:10px 8px;font-weight:700;">Serial No.</th>
        <th style="padding:10px 8px;font-weight:700;">Model No.</th>
        <th style="padding:10px 8px;font-weight:700;">Plant</th>
        <th style="padding:10px 8px;font-weight:700;">Department</th>
        <th style="padding:10px 8px;font-weight:700;">Due Date</th>
        <th style="padding:10px 8px;font-weight:700;text-align:center;">${headerCol}</th>
        <th style="padding:10px 8px;font-weight:700;">Responsible</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>`;
}
function renderPlainTextTable(machines, type) {
  const isOverdue = type === "overdue";
  return machines.map((m, i) => {
    const dueDate = effectiveNextMaintenanceDate(m);
    const days = daysUntilDateIst(dueDate);
    const statusStr = isOverdue ? `${Math.abs(days || 0)}d overdue` : `${days ?? 0}d remaining`;
    return `${i + 1}. ${m.equipmentName || m.machineType} (${m.assetCode}) | SN: ${m.serialNumber || "\u2014"} | Model: ${m.modelNumber || "\u2014"} | Plant: ${m.plantCode} | Due: ${dueDate} | ${statusStr} | Resp: ${m.responsibility || "Unassigned"}`;
  }).join("\n");
}
function resolveRecipients(automation, plantContacts, plants) {
  const toSet = /* @__PURE__ */ new Set();
  const ccSet = /* @__PURE__ */ new Set();
  const bccSet = /* @__PURE__ */ new Set();
  for (const rule of automation.recipientRules || []) {
    const target = rule.target || "to";
    const targetSet = target === "cc" ? ccSet : target === "bcc" ? bccSet : toSet;
    if (rule.type === "plant_contacts") {
      const roles = (rule.value || "HOD,FH,PH").toUpperCase().split(",").map((s) => s.trim());
      for (const p of plants) {
        let contact = plantContacts[p] || plantContacts[p.toUpperCase()] || plantContacts[p.toLowerCase()];
        if (!contact) {
          const normP = p.trim().toLowerCase();
          for (const [k, v] of Object.entries(plantContacts)) {
            const normK = k.trim().toLowerCase();
            if (normK === normP || normP.includes(normK) || normK.includes(normP)) {
              contact = v;
              break;
            }
          }
        }
        if (contact) {
          if (roles.includes("HOD") && contact.hodEmail) targetSet.add(contact.hodEmail.trim().toLowerCase());
          if (roles.includes("FH") && contact.fhEmail) targetSet.add(contact.fhEmail.trim().toLowerCase());
          if (roles.includes("PH") && contact.phEmail) targetSet.add(contact.phEmail.trim().toLowerCase());
        }
      }
    } else if (rule.type === "manual_email" || rule.value.includes("@")) {
      const emails = rule.value.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
      for (const e of emails) targetSet.add(e);
    }
  }
  return {
    to: Array.from(toSet).filter(Boolean),
    cc: Array.from(ccSet).filter(Boolean),
    bcc: Array.from(bccSet).filter(Boolean)
  };
}
function isTimeMatch(scheduledTimes, currentIst) {
  if (!scheduledTimes || scheduledTimes.length === 0) return true;
  const [currH, currM] = currentIst.split(":").map((n) => parseInt(n, 10));
  return scheduledTimes.some((timeStr) => {
    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
    const diff = Math.abs(currH * 60 + currM - (h * 60 + m));
    return diff <= 5;
  });
}
async function runEmailAutomationScheduler(force = false) {
  const date = currentIstDate();
  const time = currentIstTime();
  const automations = await listEmailAutomations();
  const activeAutomations = automations.filter((a) => a.status === "active");
  const meta = await getMaintenanceMeta();
  const plantContacts = meta.plantContacts || {};
  const allMachines = await listMaintenanceMachines();
  const activeMachines = allMachines.filter((m) => m.status !== "Decommissioned");
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors = [];
  for (const auto of activeAutomations) {
    if (!force && !isTimeMatch(auto.scheduleTimes, time)) {
      continue;
    }
    processed++;
    try {
      const template = await getEmailTemplate(auto.templateId) || {
        id: auto.templateId,
        name: auto.name,
        category: auto.triggerType,
        subject: `${auto.name} - {{PlantName}}`,
        bodyHtml: `<p>Notification for {{PlantName}}</p>{{ConsolidatedTable}}`,
        variables: [],
        status: "active",
        createdAt: "",
        updatedAt: ""
      };
      if (auto.triggerType === "overdue_pm") {
        const overdueMachines = activeMachines.filter((m) => {
          const due = effectiveNextMaintenanceDate(m);
          const days = daysUntilDateIst(due);
          return days != null && days < 0;
        });
        if (overdueMachines.length === 0) {
          skipped++;
          continue;
        }
        const plantGroups = {};
        for (const m of overdueMachines) {
          const p = m.plantCode || "General";
          if (!plantGroups[p]) plantGroups[p] = [];
          plantGroups[p].push(m);
        }
        for (const [plantCode, machines] of Object.entries(plantGroups)) {
          const idempotencyKey = `${auto.id}_${date}_${time.slice(0, 2)}_${plantCode}`;
          if (!force && await isIdempotentAlreadySent(idempotencyKey)) {
            skipped++;
            continue;
          }
          const recipients = resolveRecipients(auto, plantContacts, [plantCode]);
          if (recipients.to.length === 0) {
            skipped++;
            continue;
          }
          const tableHtml = renderMachineConsolidatedTable(machines, "overdue");
          const tableText = renderPlainTextTable(machines, "overdue");
          const plantName = plantShortName(plantCode);
          let subject = template.subject.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{TotalCount\}\}/g, String(machines.length)).replace(/\{\{CurrentDate\}\}/g, date);
          let bodyHtml = template.bodyHtml.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{TotalCount\}\}/g, String(machines.length)).replace(/\{\{CurrentDate\}\}/g, date).replace(/\{\{ConsolidatedTable\}\}/g, tableHtml);
          const fullHtml = professionalShell2(subject, bodyHtml);
          const fullText = `Preventive Maintenance Overdue Machines - ${plantName}

Total Overdue: ${machines.length}

${tableText}

${APP_NAME}`;
          const sendResult = await sendMaintenanceMail({
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            html: fullHtml,
            text: fullText
          });
          await appendEmailLog({
            automationId: auto.id,
            automationName: auto.name,
            triggerType: auto.triggerType,
            idempotencyKey,
            date,
            time,
            sender: APP_NAME,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            plantCode,
            status: sendResult.ok ? "sent" : "failed",
            sentAt: sendResult.ok ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
            failureReason: sendResult.error,
            retryCount: sendResult.ok ? 0 : 1,
            machineCount: machines.length
          });
          if (sendResult.ok) sent++;
          else errors.push(`[${plantCode}] ${sendResult.error}`);
        }
      } else if (auto.triggerType === "upcoming_pm") {
        const reminderDays = auto.reminderDays || 7;
        const upcomingMachines = activeMachines.filter((m) => {
          const due = effectiveNextMaintenanceDate(m);
          const days = daysUntilDateIst(due);
          return days != null && days >= 0 && days <= reminderDays;
        });
        if (upcomingMachines.length === 0) {
          skipped++;
          continue;
        }
        const plantGroups = {};
        for (const m of upcomingMachines) {
          const p = m.plantCode || "General";
          if (!plantGroups[p]) plantGroups[p] = [];
          plantGroups[p].push(m);
        }
        for (const [plantCode, machines] of Object.entries(plantGroups)) {
          const idempotencyKey = `${auto.id}_${date}_upcoming_${plantCode}`;
          if (!force && await isIdempotentAlreadySent(idempotencyKey)) {
            skipped++;
            continue;
          }
          const recipients = resolveRecipients(auto, plantContacts, [plantCode]);
          if (recipients.to.length === 0) {
            skipped++;
            continue;
          }
          const tableHtml = renderMachineConsolidatedTable(machines, "upcoming");
          const tableText = renderPlainTextTable(machines, "upcoming");
          const plantName = plantShortName(plantCode);
          let subject = template.subject.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{ReminderDays\}\}/g, String(reminderDays)).replace(/\{\{TotalCount\}\}/g, String(machines.length));
          let bodyHtml = template.bodyHtml.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{ReminderDays\}\}/g, String(reminderDays)).replace(/\{\{TotalCount\}\}/g, String(machines.length)).replace(/\{\{ConsolidatedTable\}\}/g, tableHtml);
          const fullHtml = professionalShell2(subject, bodyHtml);
          const fullText = `Upcoming PM Schedule (${reminderDays} Days) - ${plantName}

Total Due: ${machines.length}

${tableText}

${APP_NAME}`;
          const sendResult = await sendMaintenanceMail({
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            html: fullHtml,
            text: fullText
          });
          await appendEmailLog({
            automationId: auto.id,
            automationName: auto.name,
            triggerType: auto.triggerType,
            idempotencyKey,
            date,
            time,
            sender: APP_NAME,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            subject,
            plantCode,
            status: sendResult.ok ? "sent" : "failed",
            sentAt: sendResult.ok ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
            failureReason: sendResult.error,
            retryCount: sendResult.ok ? 0 : 1,
            machineCount: machines.length
          });
          if (sendResult.ok) sent++;
          else errors.push(`[${plantCode}] ${sendResult.error}`);
        }
      } else if (auto.triggerType === "zero_machine_entry") {
        const plantGroups = {};
        for (const m of activeMachines) {
          const p = m.plantCode || "General";
          if (!plantGroups[p]) plantGroups[p] = [];
          plantGroups[p].push(m);
        }
        for (const [plantCode, machines] of Object.entries(plantGroups)) {
          const hasEntryToday = machines.some((m) => {
            const createdToday = m.createdAt && m.createdAt.startsWith(date);
            const updatedToday = m.updatedAt && m.updatedAt.startsWith(date);
            const pmLoggedToday = Array.isArray(m.pmLogs) && m.pmLogs.some((l) => l.doneOn && l.doneOn.startsWith(date));
            return createdToday || updatedToday || pmLoggedToday;
          });
          if (!hasEntryToday && machines.length > 0) {
            const idempotencyKey = `${auto.id}_${date}_zero_entry_${plantCode}`;
            if (!force && await isIdempotentAlreadySent(idempotencyKey)) {
              skipped++;
              continue;
            }
            const recipients = resolveRecipients(auto, plantContacts, [plantCode]);
            if (recipients.to.length === 0) {
              skipped++;
              continue;
            }
            const plantName = plantShortName(plantCode);
            const locationName = machines[0]?.location || "";
            let subject = template.subject.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{LocationName\}\}/g, locationName).replace(/\{\{CurrentDate\}\}/g, date).replace(/\{\{TotalCount\}\}/g, String(machines.length));
            let bodyHtml = template.bodyHtml.replace(/\{\{PlantName\}\}/g, plantName).replace(/\{\{LocationName\}\}/g, locationName).replace(/\{\{CurrentDate\}\}/g, date).replace(/\{\{TotalCount\}\}/g, String(machines.length));
            const fullHtml = professionalShell2(subject, bodyHtml);
            const fullText = `ACTION REQUIRED: No Machine Entry Logged Today (${date}) - ${plantName}

Total Registered Machines: ${machines.length}
Location: ${locationName}
Please log machine records in AEMS portal immediately.

${APP_NAME}`;
            const sendResult = await sendMaintenanceMail({
              to: recipients.to,
              cc: recipients.cc,
              bcc: recipients.bcc,
              subject,
              html: fullHtml,
              text: fullText
            });
            await appendEmailLog({
              automationId: auto.id,
              automationName: auto.name,
              triggerType: auto.triggerType,
              idempotencyKey,
              date,
              time,
              sender: APP_NAME,
              to: recipients.to,
              cc: recipients.cc,
              bcc: recipients.bcc,
              subject,
              plantCode,
              status: sendResult.ok ? "sent" : "failed",
              sentAt: sendResult.ok ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
              failureReason: sendResult.error,
              retryCount: sendResult.ok ? 0 : 1,
              machineCount: machines.length
            });
            if (sendResult.ok) sent++;
            else errors.push(`[${plantCode}] ${sendResult.error}`);
          } else {
            skipped++;
          }
        }
      }
    } catch (err) {
      errors.push(`[${auto.name}] ${err.message || String(err)}`);
    }
  }
  return { processed, sent, skipped, errors };
}
var timerRef = null;
function startEmailSchedulerTimer() {
  if (timerRef) return;
  console.log("[EmailScheduler] Background scheduler initialized (runs every 60s in IST)");
  timerRef = setInterval(() => {
    runEmailAutomationScheduler(false).catch((err) => {
      console.warn("[EmailScheduler] Scheduler cycle error:", err);
    });
  }, 6e4);
}

// server/inventoryStore.ts
init_env();
init_gasClient();
import fs8 from "fs";
import path8 from "path";
import os5 from "os";
var isServerless4 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR3 = isServerless4 ? path8.join(os5.tmpdir(), "assetqr-data", "cache") : path8.join(process.cwd(), "data", "cache");
var INVENTORY_FILE = path8.join(CACHE_DIR3, "inventory.json");
function ensureFile() {
  if (!fs8.existsSync(CACHE_DIR3)) fs8.mkdirSync(CACHE_DIR3, { recursive: true });
  if (!fs8.existsSync(INVENTORY_FILE)) {
    fs8.writeFileSync(INVENTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function normalizeInventoryId(id) {
  return String(id || "").trim().toUpperCase();
}
function readInventory() {
  ensureFile();
  try {
    const raw = fs8.readFileSync(INVENTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeInventory(list) {
  ensureFile();
  fs8.writeFileSync(INVENTORY_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function upsertInventoryItem(item) {
  const list = readInventory();
  const id = normalizeInventoryId(item.itemId);
  if (!id) throw new Error("Item ID is required");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const isAssigned = (item.status || "Available") === "Assigned";
  const normalized = {
    ...item,
    itemId: id,
    assetCode: String(item.assetCode || "").trim().toUpperCase(),
    itemName: String(item.itemName || "").trim(),
    brandName: String(item.brandName || "").trim(),
    model: String(item.model || "").trim(),
    serialNumber: String(item.serialNumber || "").trim().toUpperCase(),
    category: String(item.category || "IT Assets").trim(),
    status: item.status || "Available",
    quantity: Number(item.quantity) || 0,
    minStock: Number(item.minStock) || 0,
    employeeId: isAssigned ? String(item.employeeId || "").trim() : "",
    assigneeName: isAssigned ? String(item.assigneeName || "").trim() : "",
    assigneeEmail: isAssigned ? String(item.assigneeEmail || "").trim() : "",
    assigneeMobile: isAssigned ? String(item.assigneeMobile || "").trim() : "",
    updatedAt: now,
    createdAt: item.createdAt || now
  };
  const idx = list.findIndex((e) => normalizeInventoryId(e.itemId) === id);
  if (idx === -1) list.push(normalized);
  else list[idx] = { ...list[idx], ...normalized, createdAt: list[idx].createdAt || now };
  writeInventory(list);
  return normalized;
}
function deleteInventoryItem(itemId) {
  const id = normalizeInventoryId(itemId);
  const list = readInventory();
  const next = list.filter((e) => normalizeInventoryId(e.itemId) !== id);
  if (next.length === list.length) return false;
  writeInventory(next);
  return true;
}
async function fetchInventoryFromGas(proxyToGas2) {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = await gasGet(gasUrl, { action: "list_inventory" }, 2e4);
      if (result?.inventory && Array.isArray(result.inventory)) {
        writeInventory(result.inventory);
        return result.inventory;
      }
    } catch (e) {
      console.warn("fetchInventoryFromGas GET:", e);
    }
  }
  try {
    const result = await proxyToGas2({ action: "list_inventory" });
    if (result?.inventory && Array.isArray(result.inventory)) {
      writeInventory(result.inventory);
      return result.inventory;
    }
  } catch (e) {
    console.warn("fetchInventoryFromGas POST:", e);
  }
  return readInventory();
}
async function persistInventoryToGas(op, item, proxyToGas2) {
  try {
    const action = op === "add" ? "add_inventory_item" : op === "update" ? "update_inventory_item" : "delete_inventory_item";
    const result = await proxyToGas2({ action, item });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}
async function replaceInventoryInGas(inventory, proxyToGas2) {
  try {
    const result = await proxyToGas2({ action: "replace_inventory", inventory });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}

// server/locationsPlantsSync.ts
function gasError(result) {
  if (!result || typeof result !== "object") return "Invalid response from Database";
  const r = result;
  if (r.error) return String(r.error);
  if (r.success === false) return String(r.message || r.error || "Sync failed");
  return null;
}
async function fetchLocationsPlantsFromGas(proxyToGas2, gasWebappUrl) {
  try {
    let result = await proxyToGas2({ action: "list_locations_plants" }, 3e4);
    const err = gasError(result);
    if (err) {
      if (!gasWebappUrl) {
        console.warn("list_locations_plants:", err);
        return null;
      }
      const { gasGet: gasGet2 } = await Promise.resolve().then(() => (init_gasClient(), gasClient_exports));
      result = await gasGet2(gasWebappUrl, { action: "list_locations_plants" });
      const getErr = gasError(result);
      if (getErr) {
        console.warn("list_locations_plants:", getErr);
        return null;
      }
    }
    const r = result;
    const locations = Array.isArray(r.locations) ? r.locations.map((l) => String(l).trim()).filter(Boolean) : [];
    const plants = Array.isArray(r.plants) ? r.plants.map((p) => ({
      code: String(p.code || "").trim(),
      name: String(p.name || "").trim(),
      location: String(p.location || "").trim()
    })).filter((p) => p.code) : [];
    return { locations, plants };
  } catch (e) {
    console.warn("fetchLocationsPlantsFromGas failed:", e);
    return null;
  }
}
async function persistLocationsPlantsToGas(settings, proxyToGas2) {
  try {
    const result = await proxyToGas2(
      {
        action: "sync_locations_plants",
        locations: settings.locations || [],
        plants: settings.plants || []
      },
      45e3
    );
    const err = gasError(result);
    if (err) return { ok: false, error: err };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database sync failed";
    return { ok: false, error: msg };
  }
}

// server/uniqueValidation.ts
var FIELD_KEYS = {
  serialNumber: ["serialNumber", "Serial Number", "SN"],
  assetCode: ["assetCode", "Asset Code"],
  macAddress: ["macAddress", "MAC Address", "MAC"],
  vehicleNumber: ["vehicleNumber", "Vehicle Number"],
  uniqueCode: ["uniqueCode", "Unique Code"]
};
function norm(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function getAssetFieldValue(asset, field) {
  if (field === "vehicleNumber") {
    const rec = asset;
    const d = rec.dynamicDetails || asset.dynamicDetails;
    if (d?.vehicle_number) return String(d.vehicle_number).trim();
    if (d?.vehicleNumber) return String(d.vehicleNumber).trim();
  }
  const keys = FIELD_KEYS[field];
  for (const key of keys) {
    const v = asset[key];
    if (v !== void 0 && v !== null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}
function findDuplicateAsset(assets, field, value, excludeId) {
  const needle = norm(value);
  if (!needle) return void 0;
  return assets.find((asset) => {
    if (excludeId) {
      const aId = String(asset.id).replace(/^0+/, "");
      const eId = String(excludeId).replace(/^0+/, "");
      if (aId && eId && aId === eId) return false;
    }
    const current = getAssetFieldValue(asset, field);
    if (!current) return false;
    return norm(current) === needle;
  });
}
function findAnyIdentifierDuplicate(assets, assetData, excludeId) {
  const checks = [
    { field: "serialNumber", value: String(assetData.serialNumber || "") },
    { field: "assetCode", value: String(assetData.assetCode || "") },
    { field: "macAddress", value: String(assetData.macAddress || "") },
    { field: "uniqueCode", value: String(assetData.uniqueCode || assetData.assetCode || "") }
  ];
  const details = assetData.dynamicDetails || {};
  const veh = String(details.vehicle_number || details.vehicleNumber || "").trim();
  if (veh) checks.push({ field: "vehicleNumber", value: veh });
  for (const { field, value } of checks) {
    if (!value.trim()) continue;
    const dup = findDuplicateAsset(assets, field, value, excludeId);
    if (dup) return { field, duplicate: dup };
  }
  const serial = String(assetData.serialNumber || "").trim();
  if (serial) {
    const asNorm = norm(serial);
    const cross = assets.find((a) => {
      if (excludeId && String(a.id).replace(/^0+/, "") === String(excludeId).replace(/^0+/, "")) return false;
      const vehN = getAssetFieldValue(a, "vehicleNumber");
      return vehN && norm(vehN) === asNorm;
    });
    if (cross) return { field: "serialNumber", duplicate: cross };
  }
  if (veh) {
    const vn = norm(veh);
    const cross = assets.find((a) => {
      if (excludeId && String(a.id).replace(/^0+/, "") === String(excludeId).replace(/^0+/, "")) return false;
      return a.serialNumber && norm(a.serialNumber) === vn;
    });
    if (cross) return { field: "vehicleNumber", duplicate: cross };
  }
  return null;
}
function uniqueFieldLabel(field) {
  const labels = {
    serialNumber: "Serial number",
    assetCode: "Asset code",
    macAddress: "MAC address",
    vehicleNumber: "Vehicle number",
    uniqueCode: "Unique code"
  };
  return labels[field];
}

// server.ts
init_dedupeAssets();

// src/lib/assetCondition.ts
function isNewPurchaseCondition(condition) {
  const c = String(condition || "").trim().toUpperCase();
  return c === "NEW PURCHASE" || c === "NEW";
}
function validateNewPurchaseRequirements(payload) {
  if (!isNewPurchaseCondition(payload.condition)) return null;
  if (!String(payload.invoiceNumber || "").trim()) {
    return "PO Number is required for new purchases";
  }
  if (!String(payload.documentUrl || "").trim()) {
    return "Attach Asset Document is required for new purchases";
  }
  return null;
}

// server/fileProxy.ts
init_env();
var ALLOWED_REMOTE_HOSTS = /* @__PURE__ */ new Set([
  "drive.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com"
]);
function isAllowedRemoteUrl(url) {
  try {
    const trimmed = (url || "").trim();
    if (!trimmed) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".supabase.co")) return true;
    const hostOk = [...ALLOWED_REMOTE_HOSTS].some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
    if (!hostOk) return false;
    return extractDriveFileId(trimmed) !== null || host.includes("googleusercontent.com");
  } catch {
    return false;
  }
}
function isPdfBytes(bytes) {
  return bytes.length > 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70;
}
function isPngBytes(bytes) {
  return bytes.length > 3 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
}
function isJpegBytes(bytes) {
  return bytes.length > 2 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}
function isWebpBytes(bytes) {
  return bytes.length > 11 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
}
function isGifBytes(bytes) {
  return bytes.length > 5 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56;
}
function extractDriveConfirmToken(html) {
  const patterns = [
    /confirm=([0-9A-Za-z_\-]+)/,
    /confirm=([0-9A-Za-z_\-]{4,})/,
    /id="download-form"[^>]*action="[^"]*confirm=([0-9A-Za-z_\-]+)/
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  if (html.includes("virus scan") || html.includes("download_warning")) return "t";
  return null;
}
async function fetchWithRedirects(url, maxRedirects = 8) {
  let current = url;
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const next = loc.startsWith("http") ? loc : new URL(loc, current).toString();
      if (!isAllowedRemoteUrl(next)) return res;
      current = next;
      continue;
    }
    return res;
  }
  return fetch(current, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
  });
}
async function fetchUrlOnce(url) {
  if (!isAllowedRemoteUrl(url)) return null;
  let res = await fetchWithRedirects(url);
  if (!res.ok) return null;
  let contentType = res.headers.get("content-type") || "";
  let bytes = new Uint8Array(await res.arrayBuffer());
  if (contentType.includes("text/html") && bytes.length > 0 && !isPdfBytes(bytes)) {
    const html = new TextDecoder().decode(bytes.slice(0, 2e5));
    const confirm = extractDriveConfirmToken(html);
    const fileId = extractDriveFileId(url);
    if (confirm && fileId) {
      const retryUrl = `${driveDownloadUrl(fileId)}&confirm=${confirm}`;
      res = await fetchWithRedirects(retryUrl);
      if (!res.ok) return null;
      contentType = res.headers.get("content-type") || "";
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  }
  if (bytes.length === 0) return null;
  if (isPdfBytes(bytes)) contentType = "application/pdf";
  else if (isPngBytes(bytes)) contentType = "image/png";
  else if (isJpegBytes(bytes)) contentType = "image/jpeg";
  else if (isWebpBytes(bytes)) contentType = "image/webp";
  else if (isGifBytes(bytes)) contentType = "image/gif";
  if (contentType.includes("text/html")) return null;
  return { bytes, contentType };
}
async function fetchRemoteFile(url) {
  try {
    const trimmed = (url || "").trim();
    if (!trimmed) return null;
    const fileId = extractDriveFileId(trimmed);
    if (!fileId && !isAllowedRemoteUrl(trimmed)) return null;
    if (fileId?.startsWith("local-")) {
      const { readLocalUpload: readLocalUpload2 } = await Promise.resolve().then(() => (init_sqlFiles(), sqlFiles_exports));
      const local = await readLocalUpload2(fileId);
      if (local) return { bytes: local.bytes, contentType: local.contentType };
    }
    const gasUrl = getEnv("GAS_WEBAPP_URL");
    if (fileId && gasUrl && !gasUrl.startsWith("sql://")) {
      try {
        const response = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_file_base64", fileId })
        });
        const data = await response.json();
        if (data?.success && data.base64) {
          const bytes = Buffer.from(data.base64, "base64");
          return {
            bytes: new Uint8Array(bytes),
            contentType: data.mimeType || "application/octet-stream"
          };
        }
      } catch (err) {
        console.warn(`GAS fetch error for file ${fileId}:`, err);
      }
    }
    const attempts = [];
    if (fileId) {
      attempts.push(
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
        driveDownloadUrl(fileId),
        driveViewUrl(fileId)
      );
    }
    if (isAllowedRemoteUrl(trimmed)) {
      attempts.push(toDriveDirectUrl(trimmed));
    }
    for (const attempt of attempts) {
      const data = await fetchUrlOnce(attempt);
      if (data) return data;
    }
    return null;
  } catch (err) {
    console.warn("fetchRemoteFile failed:", err);
    return null;
  }
}

// server.ts
init_assetCatalogByType();

// server/assetDetailsStore.ts
import fs9 from "fs";
import path9 from "path";
import os6 from "os";
var isServerless5 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR4 = isServerless5 ? path9.join(os6.tmpdir(), "assetqr-data", "cache") : path9.join(process.cwd(), "data", "cache");
var DETAILS_FILE = path9.join(CACHE_DIR4, "asset-details.json");
function ensureFile2() {
  if (!fs9.existsSync(CACHE_DIR4)) fs9.mkdirSync(CACHE_DIR4, { recursive: true });
  if (!fs9.existsSync(DETAILS_FILE)) {
    fs9.writeFileSync(DETAILS_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}
function normalizeAssetId(id) {
  const s = String(id ?? "").trim();
  if (!s) return "";
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return String(n);
  return s;
}
function readAssetDetailsMap() {
  ensureFile2();
  try {
    const raw = fs9.readFileSync(DETAILS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeAssetDetailsMap(map) {
  ensureFile2();
  fs9.writeFileSync(DETAILS_FILE, JSON.stringify(map, null, 2), "utf-8");
}
function saveDetailsForAsset(assetId, details) {
  const key = normalizeAssetId(assetId);
  if (!key) return;
  const map = readAssetDetailsMap();
  const cleaned = {};
  for (const [k, v] of Object.entries(details)) {
    if (String(k).trim()) cleaned[k] = String(v ?? "").trim();
  }
  if (Object.keys(cleaned).length === 0) {
    delete map[key];
  } else {
    map[key] = cleaned;
  }
  writeAssetDetailsMap(map);
}
function deleteDetailsForAsset(assetId) {
  const key = normalizeAssetId(assetId);
  const map = readAssetDetailsMap();
  delete map[key];
  writeAssetDetailsMap(map);
}
async function fetchDetailsFromGas(proxyToGas2) {
  try {
    const result = await proxyToGas2({ action: "get_asset_details" });
    if (result?.error) {
      console.warn("GAS get_asset_details:", result.error);
      return readAssetDetailsMap();
    }
    if (result?.details && typeof result.details === "object") {
      writeAssetDetailsMap(result.details);
      return result.details;
    }
  } catch (e) {
    console.warn("fetchDetailsFromGas failed:", e);
  }
  return readAssetDetailsMap();
}
async function persistDetailsToGas(assetId, details, proxyToGas2) {
  try {
    const result = await proxyToGas2({
      action: "save_asset_details",
      assetId: normalizeAssetId(assetId),
      details
    });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS save failed" };
  }
}
async function deleteDetailsFromGas(assetId, proxyToGas2) {
  try {
    await proxyToGas2({ action: "delete_asset_details", assetId: normalizeAssetId(assetId) });
  } catch {
  }
}
function mergeDetailsIntoAssets(assets, map) {
  const detailsMap = map ?? readAssetDetailsMap();
  return assets.map((a) => {
    const dynamicDetails = detailsMap[normalizeAssetId(a.id)] || {};
    const ip = String(a.ipAddress || "").trim() || String(dynamicDetails.ip_address || dynamicDetails.ipAddress || "").trim();
    const host = String(a.hostName || "").trim() || String(
      dynamicDetails.host_name || dynamicDetails.hostname || dynamicDetails.hostName || ""
    ).trim();
    return {
      ...a,
      ...ip ? { ipAddress: ip } : {},
      ...host ? { hostName: host } : {},
      dynamicDetails
    };
  });
}

// server/categoryDefinitionsService.ts
init_dataStore();

// src/lib/typeDefinitions.ts
var DEFAULT_TYPE_DEFINITIONS = [
  {
    id: "laptop",
    name: "Laptop",
    mainCategory: "IT Assets",
    subCategory: "Laptop / Desktop",
    useLegacyItForm: true,
    fields: [
      { key: "processor", label: "Processor", type: "text", required: true, legacyKey: "cpu" },
      { key: "ram", label: "RAM", type: "select", required: true, options: ["4GB", "8GB", "16GB", "32GB", "64GB"], legacyKey: "ram" },
      { key: "rom", label: "ROM / Storage", type: "select", required: true, options: ["128GB", "256GB", "512GB", "1TB", "2TB"], legacyKey: "ssd" },
      { key: "windows_version", label: "Windows Version", type: "select", options: ["Windows 10 Pro", "Windows 11 Pro", "Windows 11 Home", "macOS", "Linux"], legacyKey: "windowsVersion" },
      { key: "charger_available", label: "Charger Available", type: "select", options: ["Yes", "No"] }
    ]
  },
  {
    id: "desktop",
    name: "Desktop",
    mainCategory: "IT Assets",
    subCategory: "Laptop / Desktop",
    useLegacyItForm: true,
    fields: [
      { key: "processor", label: "Processor", type: "text", required: true, legacyKey: "cpu" },
      { key: "ram", label: "RAM", type: "select", required: true, options: ["4GB", "8GB", "16GB", "32GB"], legacyKey: "ram" },
      { key: "rom", label: "Storage", type: "select", required: true, options: ["256GB", "512GB", "1TB", "2TB"], legacyKey: "ssd" },
      { key: "windows_version", label: "Windows Version", type: "select", legacyKey: "windowsVersion", options: ["Windows 10 Pro", "Windows 11 Pro"] }
    ]
  },
  {
    id: "vehicle",
    name: "Car / Vehicle",
    mainCategory: "Vehicle Assets",
    fields: [
      { key: "vehicle_number", label: "Vehicle Number", type: "text", required: true },
      { key: "vehicle_type", label: "Vehicle Type", type: "select", options: ["Car", "Bike", "Truck", "Forklift", "E-Rickshaw"] },
      { key: "rc_number", label: "RC Number", type: "text" },
      { key: "insurance_expiry", label: "Insurance Expiry", type: "date", required: true },
      { key: "pollution_expiry", label: "Pollution Expiry", type: "date" },
      { key: "driver_assigned", label: "Driver Assigned", type: "text" },
      { key: "fuel_type", label: "Fuel Type", type: "select", options: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] },
      { key: "kilometers", label: "Kilometers", type: "number" }
    ]
  },
  {
    id: "fan",
    name: "Fan",
    mainCategory: "Furniture Assets",
    subCategory: "Fan",
    fields: [
      { key: "fan_type", label: "Fan Type", type: "select", options: ["Ceiling", "Table", "Wall", "Exhaust", "Industrial"] },
      { key: "fan_size", label: "Size", type: "text" },
      { key: "installation_date", label: "Installation Date", type: "date" },
      { key: "maintenance_status", label: "Maintenance Status", type: "select", options: ["OK", "Due", "Overdue"] }
    ]
  },
  {
    id: "ac",
    name: "Air Conditioner (AC)",
    mainCategory: "Furniture Assets",
    subCategory: "AC",
    fields: [
      { key: "tonnage", label: "Tonnage / Capacity", type: "select", options: ["1.0 Ton", "1.5 Ton", "2.0 Ton", "3.0 Ton", "Other"] },
      { key: "star_rating", label: "Energy Star Rating", type: "select", options: ["1 Star", "2 Star", "3 Star", "4 Star", "5 Star"] },
      { key: "compressor_type", label: "Compressor Type", type: "select", options: ["Inverter", "Non-Inverter"] }
    ]
  },
  {
    id: "office_asset_gen",
    name: "Office Asset (General)",
    mainCategory: "Furniture Assets",
    fields: [
      { key: "material", label: "Material", type: "select", options: ["Wood", "Metal", "Plastic", "Glass", "Other"] },
      { key: "dimensions", label: "Dimensions", type: "text" }
    ]
  },
  {
    id: "printer",
    name: "Printer",
    mainCategory: "IT Assets",
    subCategory: "Printer / Scanner",
    fields: [
      { key: "printer_type", label: "Printer Type", type: "select", options: ["Laser", "Inkjet", "Dot Matrix", "Thermal"] },
      { key: "ip_address", label: "IP Address", type: "text", legacyKey: "ipAddress" },
      { key: "toner_model", label: "Toner Model", type: "text" },
      { key: "network_location", label: "Location", type: "text" }
    ]
  },
  {
    id: "monitor",
    name: "Monitor",
    mainCategory: "IT Assets",
    subCategory: "Output Device",
    fields: [
      { key: "screen_size", label: "Screen Size", type: "text", placeholder: "e.g. 24 inch" },
      { key: "resolution", label: "Resolution", type: "text", placeholder: "e.g. 1920x1080" },
      { key: "panel_type", label: "Panel Type", type: "select", options: ["IPS", "VA", "TN", "OLED"] }
    ]
  },
  {
    id: "network_device",
    name: "Network Device",
    mainCategory: "IT Assets",
    subCategory: "Network Device",
    fields: [
      { key: "ip_address", label: "IP Address", type: "text", legacyKey: "ipAddress" },
      { key: "ports_count", label: "Number of Ports", type: "number" },
      { key: "firmware_version", label: "Firmware Version", type: "text" }
    ]
  },
  {
    id: "cctv_security",
    name: "CCTV / Security Device",
    mainCategory: "IT Assets",
    subCategory: "CCTV / Security Device",
    fields: [
      { key: "camera_resolution", label: "Camera Resolution", type: "select", options: ["2MP", "4MP", "5MP", "8MP (4K)", "N/A"] },
      { key: "channel_count", label: "Channels (for NVR)", type: "select", options: ["4 Channel", "8 Channel", "16 Channel", "32 Channel", "N/A"] },
      { key: "location_name", label: "Location Name", type: "text", placeholder: "e.g. Main Gate, Warehouse A", legacyKey: "hostName" }
    ]
  },
  {
    id: "server_ups",
    name: "Server / UPS",
    mainCategory: "IT Assets",
    subCategory: "Server / UPS",
    fields: [
      { key: "capacity_rating", label: "Capacity / Rating", type: "text", placeholder: "e.g. 1000VA, 2U Server" },
      { key: "ip_address", label: "Management IP (if any)", type: "text", legacyKey: "ipAddress" },
      { key: "battery_replacement_due", label: "Battery Replacement Due", type: "date" }
    ]
  },
  {
    id: "software_license",
    name: "Software License",
    mainCategory: "Software / License Assets",
    fields: [
      { key: "email_id", label: "Email ID", type: "email", required: true },
      { key: "purchase_date", label: "Purchase Date", type: "date", legacyKey: "purchaseDate" },
      { key: "license_type", label: "License Type", type: "select", options: ["Standard", "Basic", "With Teams", "Without Teams", "Perpetual", "Subscription (Monthly)", "Subscription (Annual)", "Open Source", "OEM"] },
      { key: "renewal_date", label: "Renewal Date", type: "date", legacyKey: "warrantyEndDate" },
      { key: "seats", label: "Seats / License Count", type: "number" }
    ]
  },
  {
    id: "generator",
    name: "Generator",
    mainCategory: "Electrical Assets",
    subCategory: "Generator",
    fields: [
      { key: "capacity_kva", label: "Capacity (kVA)", type: "number", required: true },
      { key: "fuel_type", label: "Fuel Type", type: "select", options: ["Diesel", "Gas", "Petrol", "Other"] },
      { key: "phase", label: "Phase Type", type: "select", options: ["Three Phase", "Single Phase"] }
    ]
  },
  {
    id: "inverter",
    name: "Inverter",
    mainCategory: "Electrical Assets",
    subCategory: "Inverter",
    fields: [
      { key: "capacity_kva", label: "Capacity (kVA)", type: "text" },
      { key: "inverter_type", label: "Inverter Type", type: "select", options: ["Sine Wave", "Square Wave", "Hybrid", "Other"] }
    ]
  },
  {
    id: "battery",
    name: "Battery",
    mainCategory: "Electrical Assets",
    subCategory: "Battery",
    fields: [
      { key: "battery_capacity_ah", label: "Capacity (AH)", type: "number", required: true },
      { key: "voltage_rating", label: "Voltage Rating", type: "select", options: ["12V", "24V", "48V", "Other"] },
      { key: "battery_type", label: "Battery Type", type: "select", options: ["Tubular", "Flat Plate", "SMF / VRLA", "Lithium-Ion"] }
    ]
  },
  {
    id: "electrical_asset",
    name: "Electrical Asset (General)",
    mainCategory: "Electrical Assets",
    fields: [
      { key: "power_rating", label: "Power Rating (Watts/kW)", type: "text" },
      { key: "voltage", label: "Operating Voltage", type: "select", options: ["220V (Single Phase)", "415V (Three Phase)", "12V / 24V DC", "Other"] },
      { key: "capacity", label: "Capacity (AH/KVA)", type: "text", placeholder: "e.g. 150AH, 10KVA" }
    ]
  },
  {
    id: "production_asset",
    name: "Production Asset",
    mainCategory: "Production Assets",
    fields: [
      { key: "power_source", label: "Power Source", type: "select", options: ["Electricity", "Pneumatic (Air)", "Hydraulic", "Manual", "Other"] }
    ]
  },
  {
    id: "safety_asset",
    name: "Safety Asset",
    mainCategory: "Safety Assets",
    fields: [
      { key: "safety_standard", label: "Safety Standard / Cert", type: "text", placeholder: "e.g. ISI, CE" }
    ]
  },
  {
    id: "furniture_asset",
    name: "Furniture Asset",
    mainCategory: "Furniture Assets",
    fields: [
      { key: "material", label: "Material Type", type: "select", options: ["Wood", "Metal", "Plastic", "Glass", "Leather", "Fabric", "Other"] },
      { key: "dimensions", label: "Dimensions (L x W x H)", type: "text" },
      { key: "color", label: "Color", type: "text" }
    ]
  },
  {
    id: "admin_facility_asset",
    name: "Admin / Facility Asset",
    mainCategory: "Furniture Assets",
    fields: [
      { key: "facility_use", label: "Facility Use / Location", type: "text" },
      { key: "consumable", label: "Consumable Type", type: "select", options: ["Asset", "Semi-Consumable", "Consumable"] }
    ]
  },
  {
    id: "quality_testing_instrument",
    name: "Quality Testing & Measuring Instrument",
    mainCategory: "Quality Assets",
    subCategory: "Precision Measuring Instrument",
    fields: [
      { key: "instrument_type", label: "Instrument Type", type: "select", options: ["Vernier Caliper", "Digital Micrometer", "Height Gauge", "Dial Indicator / Bore Gauge", "Digital Torque Wrench", "Coating Thickness (DFT Meter)", "Surface Roughness Tester", "Digital Weighing Scale", "Pin Gauge / Thread Gauge Set", "Hardness Tester", "Other Measuring Tool"], required: true },
      { key: "least_count", label: "Least Count / Resolution", type: "text", placeholder: "e.g. 0.01 mm, 0.001 mm, 0.1 N\xB7m" },
      { key: "range_capacity", label: "Measurement Range", type: "text", placeholder: "e.g. 0-150 mm, 0-25 mm, 0-100 N\xB7m" },
      { key: "calibration_cert_no", label: "Calibration Certificate No.", type: "text", placeholder: "e.g. CAL-QC-2026-089" },
      { key: "calibration_agency", label: "Calibration Agency / Lab", type: "select", options: ["NABL Accredited External Lab", "In-House Quality Metrology Lab", "OEM / Manufacturer Certified Lab"] },
      { key: "calibration_date", label: "Last Calibration Date", type: "date" },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date", required: true },
      { key: "calibration_frequency", label: "Calibration Frequency", type: "select", options: ["3 Months", "6 Months", "12 Months (Annual)", "24 Months"] },
      { key: "quality_stage", label: "QC Inspection Stage", type: "select", options: ["Incoming QC (IQC - Raw Material)", "In-Process QC (IPQC - Assembly/Press)", "Final Line QC (PQC - Finished Goods)", "Reliability & Metrology Lab"] },
      { key: "certificate_document", label: "Calibration Certificate (Doc/URL)", type: "file" }
    ]
  },
  {
    id: "ac_performance_leak_tester",
    name: "AC Leak & Gas Charging Instrument",
    mainCategory: "Quality Assets",
    subCategory: "AC Leak & Gas Charging Equipment",
    fields: [
      { key: "tester_type", label: "Leak / Charging Instrument Type", type: "select", options: ["Helium Leak Detection Sniffer", "Electronic Halogen Leak Detector", "Digital Vacuum Gauge / Micron Meter", "Refrigerant Auto-Charging Station", "High Pressure Nitrogen Test Rig", "Ultrasonic Leak Detector", "Submerged Water Dip Leak Tank Rig"], required: true },
      { key: "refrigerant_compatibility", label: "Refrigerant Gas Compatibility", type: "select", options: ["R32 (Eco AC)", "R410A", "R22", "R134a", "R290", "Multi-Refrigerant Universal"] },
      { key: "operating_pressure", label: "Working / Test Pressure Range", type: "text", placeholder: "e.g. 0-50 Bar / 0-725 PSI" },
      { key: "leak_sensitivity", label: "Sensitivity / Detection Limit", type: "text", placeholder: "e.g. 1x10^-5 mbar\xB7l/s or 3g/year" },
      { key: "calibration_due_date", label: "Sensor Calibration Due Date", type: "date", required: true },
      { key: "ac_production_line", label: "AC Production Line / Station", type: "select", options: ["Indoor Unit (IDU) Assembly Line", "Outdoor Unit (ODU) Assembly Line", "Heat Exchanger / Copper Brazing Station", "Vacuum & Charging Station", "Final Testing Chamber"] },
      { key: "sop_number", label: "Quality SOP / Test Ref", type: "text", placeholder: "e.g. SOP-QC-AC-LEAK-01" },
      { key: "calibration_doc", label: "Sensor Test Certificate", type: "file" }
    ]
  },
  {
    id: "ac_electrical_safety_tester",
    name: "Electrical Safety & Performance Rig",
    mainCategory: "Quality Assets",
    subCategory: "Electrical Safety & Performance Rig",
    fields: [
      { key: "equipment_type", label: "Testing Equipment Type", type: "select", options: ["Hi-Pot Tester (Dielectric Withstand)", "Earth Continuity / Ground Bond Tester", "Insulation Resistance Tester (Megger)", "Digital Power Analyzer (V, A, W, PF)", "Multi-Channel Temperature Data Logger", "Sound Level (dB) Meter", "Air Velocity / CFM Anemometer", "Psychrometric Chamber Data Logger", "Burst Pressure Testing Rig"], required: true },
      { key: "test_voltage_kv", label: "Test Voltage / Parameter Range", type: "text", placeholder: "e.g. 0-5 kV AC, 0-1000V DC, 0-50A" },
      { key: "compliance_standard", label: "Quality Compliance Standard", type: "select", options: ["IS 1391 (Indian Standard for Room AC)", "IEC 60335-2-40 (Appliance Safety)", "BEE Star Rating Energy Efficiency Test", "ISO 9001 / IATF 16949 Standard", "CE / UL International Standard"] },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date", required: true },
      { key: "accuracy_class", label: "Accuracy Class / Tolerance", type: "text", placeholder: "e.g. Class 0.5 / \xB10.5%" },
      { key: "sensor_channels", label: "Channels / Probes (if logger)", type: "select", options: ["1-4 Channels", "8 Channels", "16 Channels", "32 Channels (Psychrometric)", "N/A"] },
      { key: "testing_room_location", label: "Testing Lab / Line Station", type: "text", placeholder: "e.g. AC Performance Test Lab, Line 2 Safety Rig" },
      { key: "compliance_cert", label: "Compliance / Calibration Report", type: "file" }
    ]
  },
  {
    id: "maintenance_asset",
    name: "Maintenance Tool / Asset",
    mainCategory: "Maintenance Assets",
    fields: [
      { key: "tool_type", label: "Tool Category", type: "select", options: ["Hand Tool", "Power Tool", "Measuring Instrument", "Safety Gear", "Other"] },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date" }
    ]
  },
  {
    id: "production_asset",
    name: "Production Asset",
    mainCategory: "Production",
    fields: [
      { key: "machine_name", label: "Machine / Equipment Name", type: "text" },
      { key: "machine_number", label: "Machine Number", type: "text" },
      { key: "line_station", label: "Line / Station", type: "text" },
      { key: "capacity", label: "Capacity / Rating", type: "text" },
      { key: "power_rating", label: "Power Rating (kW/HP)", type: "text" },
      { key: "manufacturer", label: "Manufacturer / Make", type: "text" }
    ]
  },
  {
    id: "idu_asset",
    name: "IDU Asset",
    mainCategory: "IDU",
    fields: [
      { key: "line_number", label: "Line / Station Number", type: "text", placeholder: "e.g. IDU Line 1" },
      { key: "equipment_type", label: "Equipment Type", type: "select", options: ["Assembly Conveyor", "Testing Rig", "Vacuum Station", "Gas Charging Station", "Packaging Line", "Other"] },
      { key: "model_number", label: "Model Number", type: "text" },
      { key: "serial_number", label: "Serial Number", type: "text" }
    ]
  },
  {
    id: "odu_asset",
    name: "ODU Asset",
    mainCategory: "ODU",
    fields: [
      { key: "line_number", label: "Line / Station Number", type: "text", placeholder: "e.g. ODU Line 1" },
      { key: "equipment_type", label: "Equipment Type", type: "select", options: ["Assembly Conveyor", "Compressor Mount Station", "Brazing Rig", "Testing Chamber", "Packaging Line", "Other"] },
      { key: "model_number", label: "Model Number", type: "text" },
      { key: "serial_number", label: "Serial Number", type: "text" }
    ]
  },
  {
    id: "iqc_asset",
    name: "IQC Asset",
    mainCategory: "IQC",
    fields: [
      { key: "instrument_type", label: "Inspection Instrument Type", type: "select", options: ["Vernier Caliper", "Micrometer", "Height Gauge", "Hardness Tester", "Profile Projector", "Material Tester", "Other"] },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date" },
      { key: "accuracy_spec", label: "Accuracy / Tolerance", type: "text" }
    ]
  },
  {
    id: "qa_electronics_asset",
    name: "QA Electronics Asset",
    mainCategory: "QA ELECTRONICS",
    fields: [
      { key: "equipment_type", label: "Testing / QA Equipment", type: "select", options: ["PCB Functional Tester", "Oscilloscope", "Multimeter", "Soldering & Rework Station", "LCR Meter", "Other"] },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date" },
      { key: "test_bench", label: "Test Bench / Station", type: "text" }
    ]
  },
  {
    id: "operations_asset",
    name: "Operations Asset",
    mainCategory: "OPERATIONS",
    fields: [
      { key: "operation_area", label: "Operations Area / Section", type: "text" },
      { key: "equipment_type", label: "Equipment Type", type: "select", options: ["Material Handling", "Hydraulic Lift", "Pallet Truck", "Tooling Station", "Line Equipment", "Other"] }
    ]
  },
  {
    id: "oqc_asset",
    name: "OQC Asset",
    mainCategory: "OQC",
    fields: [
      { key: "inspection_stage", label: "Inspection Stage", type: "select", options: ["Final Run Test", "Packaging Inspection", "Safety Check", "Pre-Dispatch Audit", "Other"] },
      { key: "test_rig_number", label: "Test Rig / Station ID", type: "text" },
      { key: "calibration_due_date", label: "Calibration Due Date", type: "date" }
    ]
  }
];
var DEFAULT_DEPARTMENTS2 = [];
function defaultTypeDefinitionsConfig() {
  return {
    types: structuredClone ? structuredClone(DEFAULT_TYPE_DEFINITIONS) : JSON.parse(JSON.stringify(DEFAULT_TYPE_DEFINITIONS)),
    departments: structuredClone ? structuredClone(DEFAULT_DEPARTMENTS2) : JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS2)),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var SOFTWARE_LICENSE_CATEGORY = "Software / License Assets";
function patchSoftwareLicenseType(type, softwareDefaults) {
  if (type.mainCategory !== SOFTWARE_LICENSE_CATEGORY) return type;
  return { ...softwareDefaults, ...type, fields: softwareDefaults.fields };
}
function patchCctvSecurityType(type, cctvDefaults) {
  if (type.id !== "cctv_security") return type;
  return { ...cctvDefaults, ...type, fields: cctvDefaults.fields };
}
function mergeTypeDefinitions(saved) {
  const base = defaultTypeDefinitionsConfig();
  if (!saved) return base;
  const departments = Array.isArray(saved.departments) ? saved.departments : [];
  const softwareDefaults = base.types.find((t) => t.id === "software_license");
  const cctvDefaults = base.types.find((t) => t.id === "cctv_security");
  const byId = /* @__PURE__ */ new Map();
  for (const t of base.types) byId.set(t.id, t);
  for (const t of saved.types || []) {
    let patched = softwareDefaults ? patchSoftwareLicenseType(t, softwareDefaults) : t;
    if (cctvDefaults) patched = patchCctvSecurityType(patched, cctvDefaults);
    byId.set(t.id, patched);
  }
  return {
    types: Array.from(byId.values()),
    departments: departments.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99)),
    updatedAt: saved.updatedAt || base.updatedAt
  };
}
function norm2(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function resolveTypeDefinition(config, opts) {
  const { assetTypeId, assetType, mainCategory, subCategory } = opts;
  const main = mainCategory || "";
  const sub = subCategory || "";
  const typeNorm = norm2(assetType || "");
  const inMain = (t) => !main || !t.mainCategory || t.mainCategory === main;
  if (main === SOFTWARE_LICENSE_CATEGORY) {
    return config.types.find((t) => t.id === "software_license") || config.types.find((t) => t.mainCategory === main && !t.subCategory) || null;
  }
  if (typeNorm) {
    const byName = config.types.find(
      (t) => (norm2(t.name) === typeNorm || norm2(t.id) === typeNorm) && inMain(t)
    );
    if (byName) return byName;
  }
  if (assetTypeId) {
    const byId = config.types.find((t) => t.id === assetTypeId && inMain(t));
    if (byId) return byId;
  }
  if (main && sub) {
    const matches = config.types.filter((t) => t.mainCategory === main && t.subCategory === sub);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const named = matches.find(
        (t) => norm2(t.name) === typeNorm || norm2(t.id) === typeNorm || t.id === assetTypeId
      );
      if (named) return named;
      return matches[0];
    }
  }
  if (main) {
    const mainWide = config.types.find(
      (t) => t.mainCategory === main && (!t.subCategory || t.subCategory === "")
    );
    if (mainWide) return mainWide;
  }
  if (main && sub) {
    const loose = config.types.find(
      (t) => t.mainCategory === main && !!t.subCategory && (sub.toLowerCase().includes(t.subCategory.toLowerCase()) || t.subCategory.toLowerCase().includes(sub.toLowerCase()))
    );
    if (loose) return loose;
  }
  return null;
}
function applyLegacyFieldMapping(asset, typeDef, dynamicDetails) {
  const out = { ...asset, dynamicDetails: { ...dynamicDetails } };
  if (!typeDef) return out;
  for (const field of typeDef.fields) {
    const val = dynamicDetails[field.key];
    if (val === void 0 || val === "") continue;
    if (field.legacyKey) {
      out[field.legacyKey] = val;
      out.dynamicDetails[field.key] = val;
    }
  }
  if (typeDef.mainCategory === SOFTWARE_LICENSE_CATEGORY) {
    delete out.dynamicDetails.outlook_status;
    delete out.dynamicDetails.version;
  }
  const ip = String(out.ipAddress || "").trim() || String(dynamicDetails.ip_address || dynamicDetails.ipAddress || "").trim();
  const host = String(out.hostName || "").trim() || String(
    dynamicDetails.host_name || dynamicDetails.hostname || dynamicDetails.hostName || dynamicDetails.location_name || ""
  ).trim();
  if (ip) out.ipAddress = ip;
  if (host) out.hostName = host;
  return out;
}

// server/categoryDefinitionsService.ts
function softwareFieldsSignature(config) {
  const sw = config.types.find((t) => t.id === "software_license");
  return JSON.stringify(sw?.fields || []);
}
function getTypeDefinitions() {
  const data = readAppData();
  const saved = data.settings.typeDefinitions;
  const merged = mergeTypeDefinitions(saved ?? null);
  const persistedSwFields = JSON.stringify(
    saved?.types?.find((t) => t.id === "software_license")?.fields || []
  );
  const mergedSwFields = softwareFieldsSignature(merged);
  if (!saved || persistedSwFields !== mergedSwFields) {
    merged.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    data.settings.typeDefinitions = merged;
    writeAppData(data);
  }
  return merged;
}
function saveTypeDefinitions(config) {
  const merged = mergeTypeDefinitions(config);
  merged.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const data = readAppData();
  data.settings.typeDefinitions = merged;
  writeAppData(data);
  return merged;
}
async function persistTypeDefinitionsToGas(config, proxyToGas2) {
  try {
    const result = await proxyToGas2({
      action: "save_type_definitions",
      types: config.types,
      departments: config.departments
    });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

// server/employeesStore.ts
import fs10 from "fs";
import path10 from "path";
import os7 from "os";

// server/employeeStatus.ts
function isInactiveEmployeeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "inactive" || normalized === "deactive" || normalized === "deactivated";
}

// server/employeesSheet.ts
var SHEET_NAME = "Employees";
var HEADERS = [
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
  "Updated Date"
];
function normalizeEmployeeId(id) {
  return String(id || "").trim().toUpperCase();
}
function normalizeEmail2(email) {
  return String(email || "").trim().toLowerCase();
}
function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}
function rowToEmployee(row, headerMap) {
  const get = (...keys) => {
    for (const key of keys) {
      const idx = headerMap[normalizeHeaderName(key)];
      if (idx !== void 0) return String(row[idx] ?? "").trim();
    }
    return "";
  };
  return {
    employeeId: normalizeEmployeeId(get("Employee ID", "Emp ID", "Employee Code")),
    name: get("Name", "Employee Name", "Full Name"),
    email: normalizeEmail2(get("Email", "Mail ID", "Email ID")),
    phone: normalizePhone(get("Phone", "Mobile", "Contact Number")),
    department: get("Department", "Dept"),
    location: get("Location", "Location Name"),
    designation: get("Designation", "Role Title"),
    plant: get("Plant Code", "Plant / Location", "Plant"),
    status: isInactiveEmployeeStatus(get("Status")) ? "Inactive" : "Active",
    createdAt: get("Created Date", "Created At"),
    updatedAt: get("Updated Date", "Updated At")
  };
}
function normalizeHeaderName(header) {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function employeeValueForHeader(header, employee, createdAt) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const norm3 = normalizeHeaderName(header);
  const values = {
    employeeid: normalizeEmployeeId(employee.employeeId),
    empid: normalizeEmployeeId(employee.employeeId),
    employeecode: normalizeEmployeeId(employee.employeeId),
    name: String(employee.name || "").trim(),
    employeename: String(employee.name || "").trim(),
    fullname: String(employee.name || "").trim(),
    email: normalizeEmail2(employee.email),
    emailid: normalizeEmail2(employee.email),
    mailid: normalizeEmail2(employee.email),
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
    updatedat: now
  };
  return values[norm3] ?? "";
}
function employeeToRowForHeaders(employee, headers2, createdAt) {
  return headers2.map((header) => employeeValueForHeader(header, employee, createdAt));
}
function buildHeaderMap(headers2) {
  const map = {};
  headers2.forEach((h, i) => {
    map[normalizeHeaderName(h)] = i;
  });
  return map;
}
async function ensureEmployeesSheet(sheets, spreadsheetId) {
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
            properties: { title: SHEET_NAME }
          }
        }
      ]
    }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A1:K1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS.slice()] }
  });
}
async function listEmployeesFromGoogleSheet(spreadsheetId) {
  const sheets = await getSheetsClient();
  if (!sheets) return null;
  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:Z`
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];
    const headerMap = buildHeaderMap(rows[0].map(String));
    const list = [];
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
async function addEmployeeToGoogleSheet(spreadsheetId, employee) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Database credentials not configured" };
  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };
  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:Z`
    });
    const rows = res.data.values || [];
    const headers2 = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers2);
    const idCol = headerMap[normalizeHeaderName("Employee ID")] ?? 0;
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][idCol] || "")) === id) {
        return { ok: false, error: "User already exists" };
      }
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:${String.fromCharCode(64 + Math.min(headers2.length, 26))}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [employeeToRowForHeaders(employee, headers2)] }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet append failed" };
  }
}
async function updateEmployeeInGoogleSheet(spreadsheetId, employee) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Database credentials not configured" };
  const id = normalizeEmployeeId(employee.employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };
  try {
    await ensureEmployeesSheet(sheets, spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:Z`
    });
    const rows = res.data.values || [];
    const headers2 = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers2);
    const idCol = headerMap[normalizeHeaderName("Employee ID")] ?? 0;
    const createdCol = headerMap[normalizeHeaderName("Created Date")];
    let rowIndex = -1;
    let createdAt = "";
    for (let i = 1; i < rows.length; i++) {
      if (normalizeEmployeeId(String(rows[i][idCol] || "")) === id) {
        rowIndex = i + 1;
        createdAt = createdCol === void 0 ? "" : String(rows[i][createdCol] || "");
        break;
      }
    }
    const row = employeeToRowForHeaders(employee, headers2, createdAt);
    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A:${String.fromCharCode(64 + Math.min(headers2.length, 26))}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A${rowIndex}:${String.fromCharCode(64 + Math.min(headers2.length, 26))}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] }
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet update failed" };
  }
}
async function deleteEmployeeFromGoogleSheet(spreadsheetId, employeeId) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Database credentials not configured" };
  const id = normalizeEmployeeId(employeeId);
  if (!id) return { ok: false, error: "Employee ID required" };
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === SHEET_NAME.toLowerCase()
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === void 0) return { ok: false, error: "Employees sheet not found" };
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:Z`
    });
    const rows = res.data.values || [];
    const headers2 = rows[0]?.map(String) || HEADERS.slice();
    const headerMap = buildHeaderMap(headers2);
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
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet delete failed" };
  }
}

// server/employeesStore.ts
init_env();
init_gasClient();
function normalizePhoneForStorage(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}
var isServerless6 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR5 = isServerless6 ? path10.join(os7.tmpdir(), "assetqr-data", "cache") : path10.join(process.cwd(), "data", "cache");
var EMPLOYEES_FILE = path10.join(CACHE_DIR5, "employees.json");
function ensureFile3() {
  if (!fs10.existsSync(CACHE_DIR5)) fs10.mkdirSync(CACHE_DIR5, { recursive: true });
  if (!fs10.existsSync(EMPLOYEES_FILE)) {
    fs10.writeFileSync(EMPLOYEES_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function normalizeEmployeeId2(id) {
  return String(id || "").trim().toUpperCase();
}
function normalizeEmail3(email) {
  return String(email || "").trim().toLowerCase();
}
function readEmployees() {
  ensureFile3();
  try {
    const raw = fs10.readFileSync(EMPLOYEES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeEmployees(list) {
  ensureFile3();
  fs10.writeFileSync(EMPLOYEES_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function mergeEmployeesById(local, remote) {
  const merged = [...local];
  for (const employee of remote) {
    const id = normalizeEmployeeId2(employee.employeeId);
    if (!id) continue;
    const normalized = normalizeEmployeeRecord(employee);
    const idx = merged.findIndex((e) => normalizeEmployeeId2(e.employeeId) === id);
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        ...normalized,
        createdAt: normalized.createdAt || merged[idx].createdAt
      };
    } else {
      merged.push(normalized);
    }
  }
  return merged;
}
function findEmployeeById(list, employeeId) {
  const id = normalizeEmployeeId2(employeeId);
  if (!id) return void 0;
  return list.find((e) => normalizeEmployeeId2(e.employeeId) === id);
}
function findEmployeeByEmail(list, email) {
  const em = normalizeEmail3(email);
  if (!em) return void 0;
  return list.find((e) => normalizeEmail3(e.email) === em);
}
function normalizeEmployeeRecord(employee, createdAt) {
  const id = normalizeEmployeeId2(employee.employeeId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...employee,
    employeeId: id,
    email: normalizeEmail3(employee.email),
    phone: normalizePhoneForStorage(employee.phone),
    status: isInactiveEmployeeStatus(employee.status) ? "Inactive" : "Active",
    updatedAt: now,
    createdAt: createdAt || employee.createdAt || now
  };
}
function createEmployee(employee) {
  const list = readEmployees();
  const id = normalizeEmployeeId2(employee.employeeId);
  if (!id) throw new Error("Employee ID is required");
  if (findEmployeeById(list, id)) {
    throw new Error("User already exists");
  }
  const normalized = normalizeEmployeeRecord(employee);
  list.push(normalized);
  writeEmployees(list);
  return normalized;
}
function updateEmployee(employee) {
  const list = readEmployees();
  const id = normalizeEmployeeId2(employee.employeeId);
  if (!id) throw new Error("Employee ID is required");
  const idx = list.findIndex((e) => normalizeEmployeeId2(e.employeeId) === id);
  if (idx === -1) throw new Error("Employee not found");
  const normalized = normalizeEmployeeRecord(employee, list[idx].createdAt);
  list[idx] = normalized;
  writeEmployees(list);
  return normalized;
}
function deleteEmployee(employeeId) {
  const id = normalizeEmployeeId2(employeeId);
  const list = readEmployees();
  const next = list.filter((e) => normalizeEmployeeId2(e.employeeId) !== id);
  if (next.length === list.length) return false;
  writeEmployees(next);
  return true;
}
async function fetchEmployeesFromGas(proxyToGas2, spreadsheetId) {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = await gasGet(gasUrl, { action: "list_employees" }, 2e4);
      if (result?.employees && Array.isArray(result.employees)) {
        const merged = mergeEmployeesById(readEmployees(), result.employees);
        writeEmployees(merged);
        if (spreadsheetId) touchCacheSpreadsheetId(spreadsheetId);
        return merged;
      }
    } catch (e) {
      console.warn("fetchEmployeesFromGas GET:", e);
    }
    try {
      const result = await proxyToGas2({ action: "list_employees" });
      if (result?.employees && Array.isArray(result.employees)) {
        const merged = mergeEmployeesById(readEmployees(), result.employees);
        writeEmployees(merged);
        if (spreadsheetId) touchCacheSpreadsheetId(spreadsheetId);
        return merged;
      }
    } catch (e) {
      console.warn("fetchEmployeesFromGas POST:", e);
    }
  }
  if (spreadsheetId) {
    const fromSheet = await listEmployeesFromGoogleSheet(spreadsheetId);
    if (fromSheet) {
      const merged = mergeEmployeesById(readEmployees(), fromSheet);
      writeEmployees(merged);
      touchCacheSpreadsheetId(spreadsheetId);
      return merged;
    }
  }
  return readEmployees();
}
async function persistEmployeeViaSheetsApi(op, employee, spreadsheetId) {
  if (op === "add") return addEmployeeToGoogleSheet(spreadsheetId, employee);
  if (op === "update") return updateEmployeeInGoogleSheet(spreadsheetId, employee);
  return deleteEmployeeFromGoogleSheet(spreadsheetId, employee.employeeId);
}
async function persistEmployeeToGas(op, employee, proxyToGas2, spreadsheetId) {
  let gasError2;
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const action = op === "add" ? "add_employee" : op === "update" ? "update_employee" : "delete_employee";
      const result = await proxyToGas2({ action, employee });
      if (!result?.error) return { ok: true };
      gasError2 = result.error;
    } catch (e) {
      gasError2 = e instanceof Error ? e.message : "GAS failed";
      console.warn(`Employee ${op} via GAS failed:`, gasError2);
    }
    return {
      ok: false,
      error: gasError2 || "Database sync failed"
    };
  }
  if (spreadsheetId) {
    const sheet = await persistEmployeeViaSheetsApi(op, employee, spreadsheetId);
    if (sheet.ok) return { ok: true };
    return { ok: false, error: sheet.error || gasError2 || "Sheet sync failed" };
  }
  return { ok: false, error: gasError2 || "Sheet sync unavailable \u2014 check GAS_WEBAPP_URL or Google credentials" };
}

// src/lib/emailValidation.ts
var EMAIL_FORMAT = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
function isGmailAddress(email) {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return domain === "gmail.com" || domain === "googlemail.com";
}
function validateEmailFormat(email) {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_FORMAT.test(trimmed)) return "Enter a valid email address";
  return null;
}

// src/lib/employeeValidation.ts
var EMPLOYEE_ID_EXISTS_MESSAGE = "User already exists";
function isEmployeeIdExistsError(message) {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === EMPLOYEE_ID_EXISTS_MESSAGE.toLowerCase() || normalized.includes("employee with this id already exists") || normalized.includes("employee id already exists") || normalized.includes("user already exists");
}
function validateEmployeeEmail(email) {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required";
  const formatErr = validateEmailFormat(trimmed);
  if (formatErr) return formatErr === "Email is required" ? formatErr : "Enter a valid email address";
  if (isGmailAddress(trimmed)) {
    return "Invalid email \u2014 Gmail is not allowed. Use company email (e.g. name@pgel.in)";
  }
  return null;
}
function validateEmployeePhone(phone, required = false) {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return required ? "Phone number is required" : null;
  if (!/^\d{10}$/.test(trimmed)) {
    return "Phone number must be exactly 10 digits";
  }
  return null;
}
function validateEmployeePayload(payload, options) {
  if (!String(payload.employeeId || "").trim()) return "Employee ID is required";
  if (!String(payload.name || "").trim()) return "Name is required";
  const emailErr = validateEmployeeEmail(String(payload.email || ""));
  if (emailErr) return emailErr;
  if (!String(payload.department || "").trim()) return "Department is required";
  const phoneErr = validateEmployeePhone(String(payload.phone || ""), options?.requirePhone);
  if (phoneErr) return phoneErr;
  return null;
}

// server/assignmentHistoryStore.ts
import fs11 from "fs";

// server/assignmentHistorySheet.ts
var SHEET_NAME2 = "Assignment_History";
async function deleteAssignmentHistoryFromGoogleSheet(spreadsheetId, recordId) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, error: "Google credentials not configured" };
  const idStr = String(recordId || "").trim();
  if (!idStr) return { ok: false, error: "Record ID required" };
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === SHEET_NAME2.toLowerCase()
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === void 0) return { ok: false, error: "Assignment_History sheet not found" };
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME2}'!A:K`
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
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sheet delete failed" };
  }
}

// server/assignmentHistoryStore.ts
import path11 from "path";
import os8 from "os";
var isServerless7 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR6 = isServerless7 ? path11.join(os8.tmpdir(), "assetqr-data", "cache") : path11.join(process.cwd(), "data", "cache");
var HISTORY_FILE = path11.join(CACHE_DIR6, "assignment-history.json");
function ensureFile4() {
  if (!fs11.existsSync(CACHE_DIR6)) fs11.mkdirSync(CACHE_DIR6, { recursive: true });
  if (!fs11.existsSync(HISTORY_FILE)) {
    fs11.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function readAssignmentHistory() {
  ensureFile4();
  try {
    const raw = fs11.readFileSync(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeAssignmentHistory(entries) {
  ensureFile4();
  fs11.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}
function clearAllAssignmentHistory() {
  writeAssignmentHistory([]);
}
function newHistoryId() {
  return `AH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function appendAssignmentEntry(entry) {
  const list = readAssignmentHistory();
  const full = { ...entry, id: newHistoryId() };
  list.push(full);
  writeAssignmentHistory(list);
  return full;
}
function getHistoryByAssetId(assetId) {
  const aid = normalizeAssetId(assetId);
  return readAssignmentHistory().filter((h) => normalizeAssetId(h.assetId) === aid).sort((a, b) => String(b.returnedDate || b.assignedDate).localeCompare(String(a.returnedDate || a.assignedDate)));
}
function getHistoryByEmployeeId(employeeId) {
  const eid = normalizeEmployeeId2(employeeId);
  return readAssignmentHistory().filter(
    (h) => normalizeEmployeeId2(h.employeeId) === eid || normalizeEmployeeId2(h.fromEmployeeId || "") === eid
  ).sort((a, b) => String(b.returnedDate || b.assignedDate).localeCompare(String(a.returnedDate || a.assignedDate)));
}
function hasAssignee(s) {
  return !!(s.employeeId?.trim() || s.contactName?.trim() || s.contactEmail?.trim());
}
function assigneeKey(s) {
  return [
    normalizeEmployeeId2(s.employeeId || ""),
    String(s.contactEmail || "").trim().toLowerCase(),
    String(s.contactName || "").trim().toLowerCase()
  ].join("|");
}
function recordAssignmentChange(opts) {
  const { assetId, previous, next, assignedBy, remarks } = opts;
  const created = [];
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const eventDate = opts.assignedDate?.trim() || now;
  const prevKey = assigneeKey(previous);
  const nextKey = assigneeKey(next);
  if (prevKey === nextKey) return created;
  if (hasAssignee(previous) && hasAssignee(next) && prevKey !== nextKey) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Transfer",
        employeeId: next.employeeId || "",
        employeeName: next.contactName || next.contactEmail || "Unknown",
        assignedDate: eventDate,
        assignedBy,
        remarks: remarks || `From ${previous.contactName || previous.employeeId || "previous assignee"}`,
        fromEmployeeId: previous.employeeId,
        fromEmployeeName: previous.contactName
      })
    );
    return created;
  }
  if (hasAssignee(previous) && !hasAssignee(next)) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Return",
        employeeId: previous.employeeId || "",
        employeeName: previous.contactName || previous.contactEmail || "Unknown",
        assignedDate: eventDate,
        returnedDate: now,
        assignedBy,
        remarks: remarks || "Asset returned / unassigned"
      })
    );
    return created;
  }
  if (!hasAssignee(previous) && hasAssignee(next)) {
    created.push(
      appendAssignmentEntry({
        assetId,
        action: "Assign",
        employeeId: next.employeeId || "",
        employeeName: next.contactName || next.contactEmail || "Unknown",
        assignedDate: eventDate,
        assignedBy,
        remarks
      })
    );
  }
  return created;
}
function deleteAssignmentHistoryEntry(id) {
  const list = readAssignmentHistory();
  const trimmed = String(id || "").trim();
  const next = list.filter((h) => String(h.id || "").trim() !== trimmed);
  if (next.length === list.length) return false;
  writeAssignmentHistory(next);
  return true;
}
function deleteAssignmentHistoryForAsset(assetId) {
  const aid = normalizeAssetId(assetId);
  const list = readAssignmentHistory();
  const next = list.filter((h) => normalizeAssetId(h.assetId) !== aid);
  writeAssignmentHistory(next);
  return list.length - next.length;
}
async function deleteHistoryEntryFromGas(id, proxyToGas2) {
  try {
    const result = await proxyToGas2({
      action: "delete_assignment_history",
      id: String(id || "").trim()
    });
    if (result?.error) {
      const err = String(result.error);
      return {
        ok: false,
        error: err,
        notFound: err.toLowerCase().includes("not found")
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sheet delete failed" };
  }
}
async function deleteHistoryEntryRemote(id, proxyToGas2, spreadsheetId, gasConfigured = false) {
  const trimmed = String(id || "").trim();
  let lastError = "";
  let notFound = false;
  if (gasConfigured && proxyToGas2) {
    const gas = await deleteHistoryEntryFromGas(trimmed, proxyToGas2);
    if (gas.ok) return { ok: true, via: "gas" };
    lastError = gas.error || "GAS delete failed";
    if (gas.notFound) notFound = true;
  }
  if (spreadsheetId) {
    const api = await deleteAssignmentHistoryFromGoogleSheet(spreadsheetId, trimmed);
    if (api.ok) return { ok: true, via: "sheets-api" };
    if (api.notFound) notFound = true;
    lastError = api.error || lastError;
  }
  if (notFound) return { ok: false, error: lastError || "Record not found", notFound: true };
  return { ok: false, error: lastError || "Could not delete from Database" };
}
async function fetchHistoryFromGas(proxyToGas2) {
  try {
    const result = await proxyToGas2({ action: "get_assignment_history" });
    if (Array.isArray(result?.history)) {
      writeAssignmentHistory(result.history);
      return result.history;
    }
  } catch (e) {
    console.warn("fetchHistoryFromGas:", e);
  }
  return readAssignmentHistory();
}
function normalizeHistoryForUi(entries) {
  const byAsset = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = normalizeAssetId(entry.assetId);
    const list = byAsset.get(key) || [];
    list.push(entry);
    byAsset.set(key, list);
  }
  for (const list of byAsset.values()) {
    list.sort((a, b) => String(a.assignedDate).localeCompare(String(b.assignedDate)));
  }
  const inferAssignmentStart = (h) => {
    if (h.action !== "Return") return h.assignedDate || "";
    const assetEntries = byAsset.get(normalizeAssetId(h.assetId)) || [];
    const idx = assetEntries.findIndex((entry) => String(entry.id || "") === String(h.id || ""));
    const before = (idx >= 0 ? assetEntries.slice(0, idx) : assetEntries).reverse();
    const employeeId = normalizeEmployeeId2(h.employeeId || "");
    const match = before.find((entry) => {
      if (entry.action === "Return") return false;
      const sameEmployee = employeeId ? normalizeEmployeeId2(entry.employeeId || "") === employeeId : String(entry.employeeName || "").trim().toLowerCase() === String(h.employeeName || "").trim().toLowerCase();
      return sameEmployee && !!String(entry.assignedDate || "").trim();
    });
    return match?.assignedDate || h.assignedDate || "";
  };
  return entries.map((h) => {
    const action = h.action || "Assign";
    const assignmentStart = inferAssignmentStart(h);
    const base = {
      ...h,
      date: h.returnedDate || h.assignedDate || "",
      assignmentStartDate: assignmentStart || h.assignedDate || "",
      contactName: h.employeeName || ""
    };
    if (action === "Transfer") {
      return {
        ...base,
        previous: {
          employeeId: h.fromEmployeeId || "",
          contactName: h.fromEmployeeName || "Previous assignee"
        },
        next: {
          employeeId: h.employeeId || "",
          contactName: h.employeeName || "New assignee"
        }
      };
    }
    if (action === "Return") {
      return {
        ...base,
        previous: {
          employeeId: h.employeeId || "",
          contactName: h.employeeName || "Custodian"
        }
      };
    }
    return {
      ...base,
      next: {
        employeeId: h.employeeId || "",
        contactName: h.employeeName || "Custodian"
      }
    };
  });
}
async function persistHistoryEntryToGas(entry, proxyToGas2) {
  try {
    await proxyToGas2({ action: "add_assignment_history", entry });
  } catch (e) {
    console.warn("persistHistoryEntryToGas:", e);
  }
}
async function syncHistoryEntriesToGas(entries, proxyToGas2) {
  for (const entry of entries) {
    await persistHistoryEntryToGas(entry, proxyToGas2);
  }
}

// server/extraItemsStore.ts
import fs12 from "fs";
import path12 from "path";
import os9 from "os";
var isServerless8 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR7 = isServerless8 ? path12.join(os9.tmpdir(), "assetqr-data", "cache") : path12.join(process.cwd(), "data", "cache");
var EXTRA_ITEMS_FILE = path12.join(CACHE_DIR7, "extra_items.json");
function ensureFile5() {
  if (!fs12.existsSync(CACHE_DIR7)) fs12.mkdirSync(CACHE_DIR7, { recursive: true });
  if (!fs12.existsSync(EXTRA_ITEMS_FILE)) {
    fs12.writeFileSync(EXTRA_ITEMS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function readExtraItems() {
  ensureFile5();
  try {
    const raw = fs12.readFileSync(EXTRA_ITEMS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeExtraItems(list) {
  ensureFile5();
  fs12.writeFileSync(EXTRA_ITEMS_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function deleteExtraItemsForAsset(assetId) {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readExtraItems();
  const next = list.filter((e) => {
    const parent = String(e["Parent Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return parent !== id;
  });
  writeExtraItems(next);
  return list.length - next.length;
}

// server/damagedStore.ts
init_env();
init_gasClient();
import fs13 from "fs";
import path13 from "path";
import os10 from "os";
var isServerless9 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR8 = isServerless9 ? path13.join(os10.tmpdir(), "assetqr-data", "cache") : path13.join(process.cwd(), "data", "cache");
var DAMAGED_FILE = path13.join(CACHE_DIR8, "damaged_items.json");
function ensureFile6() {
  if (!fs13.existsSync(CACHE_DIR8)) fs13.mkdirSync(CACHE_DIR8, { recursive: true });
  if (!fs13.existsSync(DAMAGED_FILE)) {
    fs13.writeFileSync(DAMAGED_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function readDamagedItems() {
  ensureFile6();
  try {
    const raw = fs13.readFileSync(DAMAGED_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeDamagedItems(list) {
  ensureFile6();
  fs13.writeFileSync(DAMAGED_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function upsertDamagedItem(item) {
  const list = readDamagedItems();
  const recordId = String(item["Record ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const assetId = String(item["Asset ID"] || "").trim();
  if (!assetId) throw new Error("Asset ID is required");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const normalized = {
    "Record ID": recordId,
    "Asset ID": assetId,
    "Asset Name": String(item["Asset Name"] || "").trim(),
    "Damage Date": item["Damage Date"] || now,
    "Damage Reason": String(item["Damage Reason"] || "").trim(),
    "Reported By": String(item["Reported By"] || "").trim(),
    "Repair Required": item["Repair Required"] || "No",
    "Estimated Cost": Number(item["Estimated Cost"]) || 0,
    "Status": item["Status"] || "Reported",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Photo URL": String(item["Photo URL"] || "").trim()
  };
  const idx = list.findIndex((e) => e["Record ID"] === recordId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;
  writeDamagedItems(list);
  return normalized;
}
function deleteDamagedItem(recordId) {
  const id = String(recordId || "").trim();
  const list = readDamagedItems();
  const next = list.filter((e) => e["Record ID"] !== id);
  if (next.length === list.length) return false;
  writeDamagedItems(next);
  return true;
}
function normalizeDamagedItem(item) {
  return {
    ...item,
    "Record ID": String(item["Record ID"] || "").trim(),
    "Asset ID": String(item["Asset ID"] || "").trim(),
    "Asset Name": String(item["Asset Name"] || "").trim(),
    "Damage Date": String(item["Damage Date"] || "").trim(),
    "Damage Reason": String(item["Damage Reason"] || "").trim(),
    "Reported By": String(item["Reported By"] || "").trim(),
    "Repair Required": item["Repair Required"] || "No",
    "Estimated Cost": Number(item["Estimated Cost"]) || 0,
    "Status": item["Status"] || "Reported",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Photo URL": String(item["Photo URL"] || "").trim()
  };
}
function deleteDamagedItemsForAsset(assetId) {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readDamagedItems();
  const next = list.filter((e) => {
    const itemAssetId = String(e["Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return itemAssetId !== id;
  });
  writeDamagedItems(next);
  return list.length - next.length;
}
async function fetchDamagedItemsFromGas(proxyToGas2) {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = await gasGet(gasUrl, { action: "list_damaged_items" }, 2e4);
      if (result?.items && Array.isArray(result.items)) {
        const sanitized = result.items.map(normalizeDamagedItem);
        writeDamagedItems(sanitized);
        return sanitized;
      }
    } catch (e) {
      console.warn("fetchDamagedItemsFromGas GET:", e);
    }
  }
  try {
    const result = await proxyToGas2({ action: "list_damaged_items" });
    if (result?.items && Array.isArray(result.items)) {
      const sanitized = result.items.map(normalizeDamagedItem);
      writeDamagedItems(sanitized);
      return sanitized;
    }
  } catch (e) {
    console.warn("fetchDamagedItemsFromGas POST:", e);
  }
  return readDamagedItems();
}
async function persistDamagedItemToGas(op, item, proxyToGas2) {
  try {
    const action = op === "add" ? "add_damaged_item" : op === "update" ? "update_damaged_item" : "delete_damaged_item";
    const id = item["Record ID"];
    const result = await proxyToGas2({ action, id, row: item });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}

// server/missingStore.ts
init_env();
init_gasClient();
import fs14 from "fs";
import path14 from "path";
import os11 from "os";
var isServerless10 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR9 = isServerless10 ? path14.join(os11.tmpdir(), "assetqr-data", "cache") : path14.join(process.cwd(), "data", "cache");
var MISSING_FILE = path14.join(CACHE_DIR9, "missing_items.json");
function ensureFile7() {
  if (!fs14.existsSync(CACHE_DIR9)) fs14.mkdirSync(CACHE_DIR9, { recursive: true });
  if (!fs14.existsSync(MISSING_FILE)) {
    fs14.writeFileSync(MISSING_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function readMissingItems() {
  ensureFile7();
  try {
    const raw = fs14.readFileSync(MISSING_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeMissingItems(list) {
  ensureFile7();
  fs14.writeFileSync(MISSING_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function upsertMissingItem(item) {
  const list = readMissingItems();
  const recordId = String(item["Record ID"] || "").trim() || Math.random().toString(36).substring(2, 9);
  const parentId = String(item["Parent Asset ID"] || "").trim();
  const assetType = String(item["Asset Type"] || "").trim();
  const itemName = String(item["Missing Item Name"] || "").trim() || assetType;
  if (!itemName) {
    throw new Error("Missing item name or asset type is required");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const normalized = {
    "Record ID": recordId,
    "Parent Asset ID": parentId,
    "Parent Asset Name": String(item["Parent Asset Name"] || "").trim() || [String(item["Brand"] || "").trim(), String(item["Model"] || "").trim()].filter(Boolean).join(" ") || assetType || itemName,
    "Missing Item Name": itemName,
    "Asset Type": assetType || itemName,
    "Brand": String(item["Brand"] || "").trim(),
    "Model": String(item["Model"] || "").trim(),
    "Employee ID": String(item["Employee ID"] || "").trim(),
    "Assigned Person": String(item["Assigned Person"] || "").trim(),
    "Missing Date": item["Missing Date"] || now,
    "Status": item["Status"] || "Missing",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Recovered Date": item["Recovered Date"] || "",
    "Recovered By": String(item["Recovered By"] || "").trim()
  };
  const idx = list.findIndex((e) => e["Record ID"] === recordId);
  if (idx === -1) list.push(normalized);
  else list[idx] = normalized;
  writeMissingItems(list);
  return normalized;
}
function deleteMissingItem(recordId) {
  const id = String(recordId || "").trim();
  const list = readMissingItems();
  const next = list.filter((e) => e["Record ID"] !== id);
  if (next.length === list.length) return false;
  writeMissingItems(next);
  return true;
}
function deleteMissingItemsForAsset(assetId) {
  const id = String(assetId || "").replace(/^0+/, "").trim().toLowerCase();
  const list = readMissingItems();
  const next = list.filter((e) => {
    const parent = String(e["Parent Asset ID"] || "").replace(/^0+/, "").trim().toLowerCase();
    return parent !== id;
  });
  writeMissingItems(next);
  return list.length - next.length;
}
function normalizeMissingItem(item) {
  return {
    ...item,
    "Record ID": String(item["Record ID"] || "").trim(),
    "Parent Asset ID": String(item["Parent Asset ID"] || "").trim(),
    "Parent Asset Name": String(item["Parent Asset Name"] || "").trim(),
    "Missing Item Name": String(item["Missing Item Name"] || "").trim(),
    "Asset Type": String(item["Asset Type"] || "").trim(),
    "Brand": String(item["Brand"] || "").trim(),
    "Model": String(item["Model"] || "").trim(),
    "Employee ID": String(item["Employee ID"] || "").trim(),
    "Assigned Person": String(item["Assigned Person"] || "").trim(),
    "Missing Date": String(item["Missing Date"] || "").trim(),
    "Status": item["Status"] || "Missing",
    "Remarks": String(item["Remarks"] || "").trim(),
    "Recovered Date": String(item["Recovered Date"] || "").trim(),
    "Recovered By": String(item["Recovered By"] || "").trim()
  };
}
async function fetchMissingItemsFromGas(proxyToGas2) {
  const gasUrl = getEnv("GAS_WEBAPP_URL");
  if (gasUrl) {
    try {
      const result = await gasGet(gasUrl, { action: "list_missing_items" }, 2e4);
      if (result?.items && Array.isArray(result.items)) {
        const sanitized = result.items.map(normalizeMissingItem);
        writeMissingItems(sanitized);
        return sanitized;
      }
    } catch (e) {
      console.warn("fetchMissingItemsFromGas GET:", e);
    }
  }
  try {
    const result = await proxyToGas2({ action: "list_missing_items" });
    if (result?.items && Array.isArray(result.items)) {
      const sanitized = result.items.map(normalizeMissingItem);
      writeMissingItems(sanitized);
      return sanitized;
    }
  } catch (e) {
    console.warn("fetchMissingItemsFromGas POST:", e);
  }
  return readMissingItems();
}
async function persistMissingItemToGas(op, item, proxyToGas2) {
  try {
    const action = op === "add" ? "add_missing_item" : op === "update" ? "update_missing_item" : "delete_missing_item";
    const id = item["Record ID"];
    const result = await proxyToGas2({ action, id, row: item });
    if (result?.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GAS failed" };
  }
}

// server/auditLogsStore.ts
import fs15 from "fs";
import path15 from "path";
import os12 from "os";
var isServerless11 = process.env.NETLIFY || process.env.VERCEL || process.env.NODE_ENV === "production";
var CACHE_DIR10 = isServerless11 ? path15.join(os12.tmpdir(), "assetqr-data", "cache") : path15.join(process.cwd(), "data", "cache");
var AUDIT_LOGS_FILE = path15.join(CACHE_DIR10, "audit_logs.json");
function ensureFile8() {
  if (!fs15.existsSync(CACHE_DIR10)) fs15.mkdirSync(CACHE_DIR10, { recursive: true });
  if (!fs15.existsSync(AUDIT_LOGS_FILE)) {
    fs15.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function readAuditLogs() {
  ensureFile8();
  try {
    const raw = fs15.readFileSync(AUDIT_LOGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeAuditLogs(list) {
  ensureFile8();
  fs15.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function addAuditLog(userEmail, action, targetId, oldVal, newVal, remarks, proxyToGas2) {
  const list = readAuditLogs();
  const logId = "L-" + Math.floor(1e5 + Math.random() * 9e5).toString();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const oldString = typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal || "");
  const newString = typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal || "");
  const record = {
    "Log ID": logId,
    "User Email": userEmail || "system@assetqr.local",
    "Action": action,
    "Target ID": targetId,
    "Date & Time": now,
    "Old Value": oldString,
    "New Value": newString,
    "Remarks": remarks || ""
  };
  list.unshift(record);
  if (list.length > 500) list.pop();
  writeAuditLogs(list);
  if (proxyToGas2) {
    proxyToGas2({ action: "add_audit_log", row: record }).catch((err) => {
      console.warn("Failed to sync audit log to GAS:", err);
    });
  }
  return record;
}

// server.ts
init_postgresMirror();
init_supabaseStore();
init_sheetHeaders();

// server/sqlDb.ts
init_sheetHeaders();
import path16 from "path";
import fs16 from "fs";
var CATEGORIES = [
  "IT Assets",
  "Office Assets",
  "Electrical Assets",
  "Production Assets",
  "Safety Assets",
  "Vehicle Assets",
  "Furniture Assets",
  "Software License Assets",
  "Admin Facility Assets",
  "Maintenance Assets",
  "IDU",
  "ODU",
  "IQC",
  "QA ELECTRONICS",
  "OPERATIONS",
  "OQC",
  "HE QUALITY",
  "SMT QA Press-Shop",
  "SMT QA Paint-Shop"
];
function sanitizeSqlName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}
var dbInstance = null;
function isLocalSqliteEnabled() {
  return !process.env.VERCEL && !process.env.NETLIFY && process.env.DISABLE_SQLITE !== "true";
}
async function getDb() {
  if (dbInstance) return dbInstance;
  if (!isLocalSqliteEnabled()) {
    throw new Error("Local SQLite is disabled in this serverless environment.");
  }
  const dataDir = path16.join(process.cwd(), "data");
  if (!fs16.existsSync(dataDir)) {
    fs16.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path16.join(dataDir, "assets.db");
  const [{ default: sqlite3 }, { open }] = await Promise.all([
    import("sqlite3"),
    import("sqlite")
  ]);
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  for (const category of CATEGORIES) {
    const tableName = sanitizeSqlName(category);
    const isItAssets = category === "IT Assets";
    const headers2 = isItAssets ? [...CATEGORY_HEADERS, ...IT_EXTRA_HEADERS] : CATEGORY_HEADERS;
    const columnDefs = headers2.map((h) => `${sanitizeSqlName(h)} TEXT`).join(",\n  ");
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnDefs},
        PRIMARY KEY (${sanitizeSqlName("Asset ID")})
      )
    `;
    await db.exec(createTableQuery);
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Maintenance_Machines (
      id TEXT PRIMARY KEY,
      assetCode TEXT,
      machineType TEXT,
      machineNumber TEXT,
      equipmentName TEXT,
      department TEXT,
      responsibility TEXT,
      location TEXT,
      plantCode TEXT,
      warrantyStatus TEXT,
      modelNumber TEXT,
      serialNumber TEXT,
      trendMonths INTEGER,
      nextMaintenanceDate TEXT,
      lastMaintenanceDate TEXT,
      status TEXT,
      remarks TEXT,
      customPlanDates TEXT,
      pmLogs TEXT,
      createdBy TEXT,
      createdAt TEXT,
      updatedBy TEXT,
      updatedAt TEXT
    )
  `);
  try {
    const mmCols = (await db.all(`PRAGMA table_info(Maintenance_Machines)`)).map((c) => c.name);
    if (!mmCols.includes("modelNumber")) await db.exec(`ALTER TABLE Maintenance_Machines ADD COLUMN modelNumber TEXT`);
    if (!mmCols.includes("serialNumber")) await db.exec(`ALTER TABLE Maintenance_Machines ADD COLUMN serialNumber TEXT`);
    if (!mmCols.includes("warrantyStatus")) await db.exec(`ALTER TABLE Maintenance_Machines ADD COLUMN warrantyStatus TEXT`);
    if (!mmCols.includes("warrantyExpiryDate")) await db.exec(`ALTER TABLE Maintenance_Machines ADD COLUMN warrantyExpiryDate TEXT`);
  } catch {
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Maintenance_Complaints (
      id TEXT PRIMARY KEY,
      machineId TEXT,
      assetCode TEXT,
      machineType TEXT,
      machineNumber TEXT,
      equipmentName TEXT,
      department TEXT,
      responsibility TEXT,
      location TEXT,
      plantCode TEXT,
      complaintText TEXT,
      remark TEXT,
      reporterName TEXT,
      reporterEmployeeCode TEXT,
      reporterPhone TEXT,
      downtimeMinutes INTEGER,
      photoUrl TEXT,
      photoName TEXT,
      status TEXT,
      remarks TEXT,
      resolutionPhotoUrl TEXT,
      resolutionPhotoName TEXT,
      reportedAt TEXT,
      resolvedAt TEXT,
      resolvedBy TEXT,
      resolvedTechnicianCount INTEGER,
      resolvedTechnicianNames TEXT
    )
  `);
  dbInstance = db;
  return db;
}
async function ensureColumnsExist(tableName, headersList) {
  const db = await getDb();
  const existingColsInfo = await db.all(`PRAGMA table_info(${tableName})`);
  const existingCols = existingColsInfo.map((c) => c.name);
  for (const header of headersList) {
    const sanitized = sanitizeSqlName(header);
    if (!existingCols.includes(sanitized)) {
      await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${sanitized} TEXT`);
    }
  }
}
async function insertAssetLocal(category, mappedRow, headersList) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const tableName = sanitizeSqlName(category);
    await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${sanitizeSqlName("Asset ID")} TEXT PRIMARY KEY)`);
    await ensureColumnsExist(tableName, headersList);
    const columns = headersList.map(sanitizeSqlName);
    const placeholders = columns.map(() => "?").join(", ");
    const sql3 = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    await db.run(sql3, mappedRow);
    console.log(`Local SQLite: Inserted asset into ${tableName}`);
  } catch (error) {
    console.error(`Error inserting local SQLite asset in ${category}:`, error);
  }
}
async function updateAssetLocal(category, assetId, mappedRow, headersList) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const tableName = sanitizeSqlName(category);
    await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${sanitizeSqlName("Asset ID")} TEXT PRIMARY KEY)`);
    await ensureColumnsExist(tableName, headersList);
    const columns = headersList.map(sanitizeSqlName);
    const setClause = columns.map((c) => `${c} = ?`).join(", ");
    const idColumn = sanitizeSqlName("Asset ID");
    const sql3 = `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`;
    const result = await db.run(sql3, [...mappedRow, assetId]);
    if (result.changes === 0) {
      await insertAssetLocal(category, mappedRow, headersList);
    } else {
      console.log(`Local SQLite: Updated asset ${assetId} in ${tableName}`);
    }
  } catch (error) {
    console.error(`Error updating local SQLite asset in ${category}:`, error);
  }
}
async function deleteAssetLocal(assetId) {
  try {
    if (!isLocalSqliteEnabled()) return;
    const db = await getDb();
    const idColumn = sanitizeSqlName("Asset ID");
    for (const category of CATEGORIES) {
      const tableName = sanitizeSqlName(category);
      const sql3 = `DELETE FROM ${tableName} WHERE ${idColumn} = ?`;
      await db.run(sql3, [assetId]);
    }
    console.log(`Local SQLite: Deleted asset ${assetId}`);
  } catch (error) {
    console.error(`Error deleting local SQLite asset ${assetId}:`, error);
  }
}

// server/sessionAuth.ts
init_env();
import crypto5 from "crypto";
var SESSION_COOKIE = "aems_session";
var SESSION_TTL_MS = 24 * 60 * 60 * 1e3;
function getSecret() {
  const secret = getEnv("SESSION_SECRET");
  if (secret && secret.length >= 32) return secret;
  const configured = getEnv("SESSION_SECRET") || getEnv("APP_SECRET") || getEnv("DATABASE_URL") || getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SPREADSHEET_ID") || getEnv("SMTP_PASSWORD") || getEnv("USERS_SHEET_GID") || getEnv("VERCEL_PROJECT_ID") || "aems_pg_enterprise_secure_token_secret_salt_2026_x89!";
  return crypto5.createHash("sha256").update(configured).digest("hex");
}
function b64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}
function fromB64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function invalidateUserSession(_email) {
}
function createSessionToken(user) {
  const secret = getSecret();
  const sessionId = crypto5.randomUUID();
  const emailKey = user.email.toLowerCase();
  const payload = {
    email: emailKey,
    role: user.role,
    locations: Array.isArray(user.locations) ? user.locations : [],
    plants: Array.isArray(user.plants) ? user.plants : [],
    categories: Array.isArray(user.categories) ? user.categories : [],
    allowDelete: !!user.allowDelete,
    sid: sessionId,
    exp: Date.now() + SESSION_TTL_MS
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto5.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}
function verifySessionToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const secret = getSecret();
    const data = `${header}.${body}`;
    const expected = crypto5.createHmac("sha256", secret).update(data).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto5.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body));
    if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;
    const emailKey = payload.email.toLowerCase();
    return {
      email: emailKey,
      role: String(payload.role || "User"),
      locations: Array.isArray(payload.locations) ? payload.locations : [],
      plants: Array.isArray(payload.plants) ? payload.plants : [],
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      allowDelete: !!payload.allowDelete
    };
  } catch {
    return null;
  }
}
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(val);
  }
  return out;
}
function getSessionFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = verifySessionToken(auth.slice(7).trim());
    if (token) return token;
  }
  const xToken = req.headers["x-session-token"];
  if (typeof xToken === "string" && xToken.trim()) {
    const token = verifySessionToken(xToken.trim());
    if (token) return token;
  }
  const cookieToken = parseCookies(req)[SESSION_COOKIE];
  if (cookieToken) return verifySessionToken(cookieToken);
  return null;
}
function setSessionCookie(res, user) {
  const token = createSessionToken(user);
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`,
    "SameSite=Lax"
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
  return token;
}
function clearSessionCookie(res, email) {
  if (email) invalidateUserSession(email);
  const secure = process.env.NODE_ENV === "production";
  const parts = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// server/securityMiddleware.ts
init_env();
var rateLimitStore = /* @__PURE__ */ new Map();
function buildAllowedOrigins() {
  const origins = [
    getEnv("FRONTEND_URL"),
    getEnv("NETLIFY_URL"),
    getEnv("APP_BASE_URL"),
    getEnv("APP_URL")
  ].filter(Boolean);
  return [...new Set(origins)];
}
function originAllowed(origin, allowedOrigins) {
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }
  return false;
}
function isPublicApiRoute(req) {
  const path20 = req.path;
  if (req.method === "GET" && path20 === "/api/health/config") return true;
  if (req.method === "GET" && path20 === "/api/auth/session") return true;
  if (req.method === "POST" && path20 === "/api/auth/logout") return true;
  if (req.method === "POST" && path20 === "/api/auth/request-otp") return true;
  if (req.method === "POST" && path20 === "/api/auth/verify-otp") return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+$/.test(path20)) return true;
  if (req.method === "GET" && /^\/api\/scan\/[^/]+\/pdf$/.test(path20)) return true;
  if (req.method === "GET" && /^\/api\/maintenance\/scan\/[^/]+$/.test(path20)) return true;
  if (req.method === "POST" && path20 === "/api/maintenance/complaints/public") return true;
  if ((req.method === "GET" || req.method === "POST") && (path20 === "/api/maintenance/cron" || path20 === "/api/cron/maintenance")) {
    return true;
  }
  if (req.method === "GET" && path20 === "/api/file/view") return true;
  if (req.method === "GET" && path20 === "/api/assets/next-code") return true;
  if (req.method === "GET" && path20 === "/api/assets/check-unique") return true;
  if (req.method === "GET" && path20 === "/api/type-definitions") return true;
  return false;
}
function getFallbackEmail(req) {
  return String(
    req.query.userEmail || req.body?.userEmail || req.headers["x-user-email"] || ""
  ).trim();
}
function isItAdminRole2(role) {
  const norm3 = String(role || "").trim().toLowerCase();
  return norm3 === "it admin" || norm3 === "it_admin" || norm3 === "itadmin" || norm3 === "super admin" || norm3 === "super_admin";
}
function userCanAccessPlantLocation(user, itemLocation, itemPlantCode, settingsPlants = []) {
  if (!user) return false;
  if (isItAdminRole2(user.role)) return true;
  const uLocs = (user.locations || []).flatMap(
    (l) => String(l || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const uPlants = (user.plants || []).flatMap(
    (p) => String(p || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const hasAllLocs = uLocs.some((l) => l === "all");
  const hasAllPlants = uPlants.some((p) => p === "all");
  const cleanULocs = uLocs.filter((l) => l !== "all");
  const cleanUPlants = uPlants.filter((p) => p !== "all");
  if (!hasAllLocs && cleanULocs.length === 0 && !hasAllPlants && cleanUPlants.length === 0) {
    return false;
  }
  const rawLoc = String(itemLocation || "").trim().toLowerCase();
  const rawPlant = String(itemPlantCode || "").trim().toLowerCase();
  const matchingSettingsPlants = settingsPlants.filter((p) => {
    const c = String(p.code || "").trim().toLowerCase();
    const n = String(p.name || "").trim().toLowerCase();
    return rawPlant && (c === rawPlant || n === rawPlant || c.includes(rawPlant) || rawPlant.includes(c) || n.includes(rawPlant) || rawPlant.includes(n)) || rawLoc && String(p.location || "").trim().toLowerCase() === rawLoc && (!rawPlant || c === rawPlant || n === rawPlant);
  });
  const plantCandidateIdentifiers = /* @__PURE__ */ new Set();
  if (rawPlant) plantCandidateIdentifiers.add(rawPlant);
  for (const sp of matchingSettingsPlants) {
    if (sp.code) plantCandidateIdentifiers.add(sp.code.trim().toLowerCase());
    if (sp.name) plantCandidateIdentifiers.add(sp.name.trim().toLowerCase());
  }
  let resolvedLoc = rawLoc;
  if (!resolvedLoc) {
    for (const sp of matchingSettingsPlants) {
      if (sp.location) {
        resolvedLoc = sp.location.trim().toLowerCase();
        break;
      }
    }
  }
  const matchLoc = hasAllLocs || cleanULocs.length === 0 || !resolvedLoc || cleanULocs.some((l) => resolvedLoc === l || resolvedLoc.includes(l) || l.includes(resolvedLoc)) || matchingSettingsPlants.some((sp) => {
    const spLoc = String(sp.location || "").trim().toLowerCase();
    return spLoc && cleanULocs.some((l) => spLoc === l || spLoc.includes(l) || l.includes(spLoc));
  });
  const matchPlant = hasAllPlants || cleanUPlants.length === 0 || plantCandidateIdentifiers.size === 0 || cleanUPlants.some((up) => {
    for (const cand of plantCandidateIdentifiers) {
      if (cand === up || cand.includes(up) || up.includes(cand)) {
        return true;
      }
    }
    return false;
  });
  if (cleanULocs.length > 0 && cleanUPlants.length > 0 && !hasAllLocs && !hasAllPlants) {
    return matchLoc && matchPlant;
  }
  if (cleanULocs.length > 0 && !hasAllLocs) {
    return matchLoc;
  }
  if (cleanUPlants.length > 0 && !hasAllPlants) {
    return matchPlant;
  }
  return matchLoc && matchPlant;
}
function userCanAccessEmployee(user, employee, settingsPlants = []) {
  if (!user) return false;
  if (isItAdminRole2(user.role)) return true;
  if (!employee) return false;
  return userCanAccessPlantLocation(user, employee.location, employee.plant, settingsPlants);
}
function requireItAdminRole(req, res, next) {
  if (!req.authUser || !isItAdminRole2(req.authUser.role)) {
    res.status(403).json({ error: "Access denied. IT Admin role required." });
    return;
  }
  next();
}
var globalRateLimitStore = /* @__PURE__ */ new Map();
function sanitizePayload(req, _res, next) {
  const cleanObject = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(cleanObject);
    for (const key of Object.keys(obj)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        delete obj[key];
        continue;
      }
      obj[key] = cleanObject(obj[key]);
    }
    return obj;
  };
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);
  next();
}
function applySecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
}
function configureCors(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && originAllowed(origin, allowedOrigins)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Email, X-Session-Token");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
function getClientIp(req) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}
function cloudflareWafShield(req, res, next) {
  const cfRay = req.headers["cf-ray"];
  const threatScore = parseInt(String(req.headers["cf-threat-score"] || "0"), 10);
  if (cfRay && typeof cfRay === "string") {
    res.setHeader("X-AEMS-Ray", cfRay);
  }
  if (threatScore > 80) {
    res.status(403).json({ error: "Access denied by Cloudflare WAF security policy." });
    return;
  }
  next();
}
function rateLimitGlobal(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1e3;
  const maxRequestsPerMinute = process.env.NODE_ENV === "production" ? 400 : 1e3;
  let entry = globalRateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    globalRateLimitStore.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > maxRequestsPerMinute) {
    res.status(429).json({ error: "System rate limit exceeded. Too many requests. Please slow down." });
    return;
  }
  next();
}
var failedOtpIpStore = /* @__PURE__ */ new Map();
var failedOtpEmailStore = /* @__PURE__ */ new Map();
function recordFailedOtpAttempt(ip, email) {
  const now = Date.now();
  const lockoutMs = 15 * 60 * 1e3;
  const ipEntry = failedOtpIpStore.get(ip) || { failedCount: 0, lockedUntil: 0 };
  ipEntry.failedCount += 1;
  if (ipEntry.failedCount >= 5) {
    ipEntry.lockedUntil = now + lockoutMs;
  }
  failedOtpIpStore.set(ip, ipEntry);
  if (email) {
    const emailKey = email.toLowerCase().trim();
    const emailEntry = failedOtpEmailStore.get(emailKey) || { failedCount: 0, lockedUntil: 0 };
    emailEntry.failedCount += 1;
    if (emailEntry.failedCount >= 5) {
      emailEntry.lockedUntil = now + lockoutMs;
    }
    failedOtpEmailStore.set(emailKey, emailEntry);
  }
}
function clearFailedOtpAttempt(ip, email) {
  failedOtpIpStore.delete(ip);
  if (email) failedOtpEmailStore.delete(email.toLowerCase().trim());
}
function isOtpLocked(ip, email) {
  const now = Date.now();
  const ipEntry = failedOtpIpStore.get(ip);
  if (ipEntry && ipEntry.lockedUntil > now) {
    const mins = Math.ceil((ipEntry.lockedUntil - now) / 6e4);
    return { locked: true, remainingMinutes: mins, reason: `Too many failed OTP attempts from this device. Temporarily locked for ${mins} minute(s).` };
  }
  if (email) {
    const emailKey = email.toLowerCase().trim();
    const emailEntry = failedOtpEmailStore.get(emailKey);
    if (emailEntry && emailEntry.lockedUntil > now) {
      const mins = Math.ceil((emailEntry.lockedUntil - now) / 6e4);
      return { locked: true, remainingMinutes: mins, reason: `Account temporarily locked due to repeated failed OTP attempts. Try again in ${mins} minute(s).` };
    }
  }
  return { locked: false, remainingMinutes: 0, reason: "" };
}
function rateLimitAuth(req, res, next) {
  const isOtpRoute = req.method === "POST" && (req.path === "/api/auth/request-otp" || req.path === "/api/auth/verify-otp");
  if (!isOtpRoute) {
    next();
    return;
  }
  const ip = getClientIp(req);
  const email = String(req.body?.email || req.query?.email || "").trim().toLowerCase();
  const lock = isOtpLocked(ip, email);
  if (lock.locked) {
    res.status(429).json({ error: lock.reason });
    return;
  }
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1e3;
  const max = process.env.NODE_ENV === "production" ? req.path.includes("request-otp") ? 6 : 10 : req.path.includes("request-otp") ? 20 : 30;
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    res.status(429).json({ error: "Too many OTP requests from this device. Please wait 15 minutes and try again." });
    return;
  }
  next();
}
function requireApiAuth(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  if (isPublicApiRoute(req)) {
    next();
    return;
  }
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized. Valid login session required." });
    return;
  }
  req.authUser = session;
  next();
}

// server/backupService.ts
init_supabaseStore();
import fs17 from "fs";
import path17 from "path";
import os13 from "os";
var isServerless12 = Boolean(process.env.NETLIFY || process.env.VERCEL);
var BACKUP_DIR = isServerless12 ? path17.join(os13.tmpdir(), "aems-backups") : path17.join(process.cwd(), "data", "backups");
function ensureBackupDir() {
  if (!fs17.existsSync(BACKUP_DIR)) {
    fs17.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}
async function createDatabaseSnapshot(reason = "Automated Periodic Backup") {
  ensureBackupDir();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const filename = `aems_snapshot_${timestamp}.json`;
  const filePath = path17.join(BACKUP_DIR, filename);
  let assets = [];
  let employees = [];
  let users = [];
  let auditLogs = [];
  try {
    assets = await listJsonRows2("Assets").catch(() => []);
    employees = await listJsonRows2("Employees").catch(() => []);
    users = await listJsonRows2("Users").catch(() => []);
    auditLogs = await listJsonRows2("AuditLogs").catch(() => []);
  } catch (err) {
    console.warn("[BackupService] Error pulling rows for backup:", err);
  }
  const payload = {
    version: "2.0",
    createdDate: (/* @__PURE__ */ new Date()).toISOString(),
    reason,
    stats: {
      assetsCount: assets.length,
      employeesCount: employees.length,
      usersCount: users.length,
      auditLogsCount: auditLogs.length
    },
    data: {
      assets,
      employees,
      users,
      auditLogs
    }
  };
  const rawJson = JSON.stringify(payload, null, 2);
  fs17.writeFileSync(filePath, rawJson, "utf-8");
  try {
    const files = fs17.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("aems_snapshot_"));
    if (files.length > 30) {
      files.sort().slice(0, files.length - 30).forEach((f) => {
        try {
          fs17.unlinkSync(path17.join(BACKUP_DIR, f));
        } catch {
        }
      });
    }
  } catch {
  }
  const stats = fs17.statSync(filePath);
  return {
    filename,
    timestamp: payload.createdDate,
    totalAssets: assets.length,
    totalEmployees: employees.length,
    totalUsers: users.length,
    fileSizeKb: Math.round(stats.size / 1024)
  };
}
async function archiveDeletedAsset(asset, deletedBy) {
  ensureBackupDir();
  const archivePath = path17.join(BACKUP_DIR, "deleted_assets_archive.json");
  let archived = [];
  try {
    if (fs17.existsSync(archivePath)) {
      archived = JSON.parse(fs17.readFileSync(archivePath, "utf-8"));
    }
  } catch {
    archived = [];
  }
  const record = {
    archiveId: "DEL-" + Date.now(),
    deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
    deletedBy: deletedBy || "system",
    assetCode: String(asset.assetCode || asset.id || ""),
    payload: asset
  };
  archived.unshift(record);
  if (archived.length > 2e3) archived.pop();
  fs17.writeFileSync(archivePath, JSON.stringify(archived, null, 2), "utf-8");
  try {
    await upsertJsonRow2("DeletedAssetsArchive", record.archiveId, record);
  } catch {
  }
}
function listLocalBackups() {
  ensureBackupDir();
  try {
    const files = fs17.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("aems_snapshot_"));
    return files.map((f) => {
      const stats = fs17.statSync(path17.join(BACKUP_DIR, f));
      return {
        filename: f,
        timestamp: stats.mtime.toISOString(),
        totalAssets: 0,
        totalEmployees: 0,
        totalUsers: 0,
        fileSizeKb: Math.round(stats.size / 1024)
      };
    }).sort((a, b) => b.filename.localeCompare(a.filename));
  } catch {
    return [];
  }
}

// server.ts
init_gasClient();

// server/requestUser.ts
init_dataStore();
function getSessionEmail(req) {
  return req.authUser?.email?.trim().toLowerCase() || String(req.query.userEmail || req.body?.userEmail || req.headers["x-user-email"] || "").trim().toLowerCase();
}
function cleanList(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.flatMap((x) => String(x || "").split(",")).map((s) => s.trim()).filter(Boolean);
}
function resolveRequestUser(req) {
  const email = getSessionEmail(req);
  if (!email) return null;
  const session = req.authUser?.email?.trim().toLowerCase() === email ? req.authUser : null;
  const cached = getCachedUsers().find((u) => u.email.trim().toLowerCase() === email) || readAppData().users.find((u) => u.email.trim().toLowerCase() === email) || null;
  if (!cached && !session) return null;
  const role = session?.role || cached?.role || "User";
  const cachedLocs = cleanList(cached?.locations);
  const sessionLocs = cleanList(session?.locations);
  const locations = cachedLocs.length > 0 ? cachedLocs : sessionLocs;
  const cachedPlants = cleanList(cached?.plants);
  const sessionPlants = cleanList(session?.plants);
  const plants = cachedPlants.length > 0 ? cachedPlants : sessionPlants;
  const cachedCats = cleanList(cached?.categories);
  const sessionCats = cleanList(session?.categories);
  const categories = cachedCats.length > 0 ? cachedCats : sessionCats;
  return {
    email,
    role,
    locations,
    plants,
    categories,
    allowDelete: cached?.allowDelete ?? session?.allowDelete
  };
}

// server.ts
init_env();
init_sqlConfig();
dotenv2.config();
if (isDbMode()) {
  process.env.DISABLE_SQLITE = process.env.DISABLE_SQLITE || "true";
  const currentGas = String(process.env.GAS_WEBAPP_URL || "").trim();
  if (currentGas.startsWith("https://script.google.com")) {
    process.env.GAS_IMPORT_URL = process.env.GAS_IMPORT_URL || currentGas;
    process.env.GAS_OTP_URL = process.env.GAS_OTP_URL || currentGas;
  }
  process.env.GAS_WEBAPP_URL = SQL_BACKEND_URL;
}
var GAS_ENV = setCleanEnvAlias("GAS_WEBAPP_URL", [
  "GAS_URL",
  "GOOGLE_APPS_SCRIPT_URL",
  "GOOGLE_SCRIPT_URL",
  "APPS_SCRIPT_URL"
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
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GAS_OTP_URL",
  "GAS_IMPORT_URL"
].forEach(setCleanEnv);
if (isLocalSqliteEnabled()) {
  getDb().then(() => console.log("SQLite: DB Initialized")).catch((err) => console.error("SQLite Init Error:", err));
}
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(applySecurityHeaders);
app.use(cloudflareWafShield);
app.use(configureCors(buildAllowedOrigins()));
app.use(rateLimitGlobal);
app.use(rateLimitAuth);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(sanitizePayload);
app.use(requireApiAuth);
var GAS_WEBAPP_URL = GAS_ENV.value;
var SPREADSHEET_ID = getEnv("SPREADSHEET_ID");
var USERS_SHEET_GID = getEnv("USERS_SHEET_GID");
var USERS_SHEET_GID_VALID = USERS_SHEET_GID && USERS_SHEET_GID !== "0" ? USERS_SHEET_GID : "";
var IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.NETLIFY);
if (isSupabaseMode()) {
  console.log("[Config] Database mode: Supabase");
} else if (isSqlMode() || isSqlBackendUrl(GAS_WEBAPP_URL)) {
  console.log("[Config] Database mode: SQL Server");
} else if (!GAS_WEBAPP_URL) {
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
  console.warn("[Security] SESSION_SECRET is not set \u2014 using insecure dev default. Set a 32+ char secret before production.");
}
setTimeout(() => {
  createDatabaseSnapshot("Server Startup Automated Backup").catch(() => {
  });
}, 1e4);
if (SPREADSHEET_ID && !isDbMode()) {
  const cachedSheet = getCacheSpreadsheetId();
  const hasLegacyCache = !cachedSheet && (readEmployees().length > 0 || (getCachedAssets()?.length ?? 0) > 0 || readAppData().users.length > 0 || readAssignmentHistory().length > 0);
  const shouldResetCache = isCacheForDifferentSpreadsheet(SPREADSHEET_ID) || hasLegacyCache;
  if (shouldResetCache) {
    console.log("[AMS] Clearing local cache \u2014 sheet source:", SPREADSHEET_ID);
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
function shouldRefreshSheetBackedData(force, localCount) {
  if (!GAS_WEBAPP_URL) return false;
  if (isCacheForDifferentSpreadsheet(SPREADSHEET_ID)) return true;
  if (force || IS_SERVERLESS || localCount === 0) return true;
  return true;
}
async function loadEmployeesWithSheetSync() {
  let list = readEmployees();
  if (!GAS_WEBAPP_URL && !SPREADSHEET_ID) return list;
  try {
    list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
  } catch (error) {
    console.warn("loadEmployeesWithSheetSync:", error);
  }
  return list;
}
function parseGasJsonResponse(text, label) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error(`Empty response from Google Apps Script ${label}`);
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
      }
    }
    console.error(`GAS ${label} returned non-JSON:`, raw.substring(0, 300));
    throw new Error(`Invalid response from Google Apps Script${label ? ` ${label}` : ""}`.trim());
  }
}
async function fetchAppsScriptJson(url, payload, timeoutMs, label = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*"
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal
    });
    const text = await response.text();
    try {
      return parseGasJsonResponse(text, label.trim());
    } catch {
      console.error(`GAS ${label} HTTP ${response.status}:`, text.substring(0, 400));
      const hint = text.replace(/\s+/g, " ").trim().slice(0, 140);
      if (response.status === 404 || /not found|page not found/i.test(hint)) {
        throw new Error(
          "Google Apps Script OTP link is invalid (404). Redeploy WebApp.gs and update GAS_WEBAPP_URL in Vercel."
        );
      }
      throw new Error(
        `Invalid response from Google Apps Script${label ? ` ${label}` : ""} (HTTP ${response.status}${hint ? `: ${hint}` : ""})`.trim()
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OTP request timed out after ${Math.round(timeoutMs / 1e3)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function proxyToGas(payload, timeoutMs = 3e4) {
  if (isDbMode() || isSqlBackendUrl(GAS_WEBAPP_URL)) {
    const { handleSqlAction: handleSqlAction2 } = await Promise.resolve().then(() => (init_sqlActions(), sqlActions_exports));
    return handleSqlAction2(payload);
  }
  if (!GAS_WEBAPP_URL) throw new Error("GAS_WEBAPP_URL is not configured.");
  return fetchAppsScriptJson(GAS_WEBAPP_URL, payload, timeoutMs);
}
var userSyncDeps = () => ({
  proxyToGas,
  gasWebappUrl: GAS_WEBAPP_URL,
  spreadsheetId: SPREADSHEET_ID,
  usersSheetGid: USERS_SHEET_GID_VALID,
  listFromGoogleApi: listUsersFromGoogleSheet
});
function gasAuthError(result) {
  if (!result || typeof result !== "object") return "Invalid response from Google Apps Script";
  const r = result;
  if (r.error) return String(r.error);
  if (r.ok === false) return String(r.message || "Request failed");
  if (r.success === false) return String(r.message || r.error || "Request failed");
  return null;
}
function hasSmtpConfigured() {
  return !!getEnv("SMTP_EMAIL") && !!getEnv("SMTP_PASSWORD");
}
async function ensureLocalOtpUser(email) {
  let user = findRegisteredUser(email);
  if (!user && (GAS_WEBAPP_URL || SPREADSHEET_ID || isDbMode())) {
    try {
      await syncUsersNow(userSyncDeps());
      user = findRegisteredUser(email);
    } catch (error) {
      console.warn("OTP user sync fallback failed:", error instanceof Error ? error.message : String(error));
    }
  }
  return user;
}
app.get("/api/health/config", async (_req, res) => {
  const result = {
    ok: true,
    serverless: IS_SERVERLESS,
    gasConfigured: Boolean(GAS_WEBAPP_URL),
    otpMailConfigured: hasSmtpConfigured(),
    otpVia: "smtp",
    smtpConfigured: hasSmtpConfigured(),
    sqlMode: isSqlMode(),
    supabaseMode: isSupabaseMode(),
    dbMode: isDbMode(),
    gasEnvName: GAS_WEBAPP_URL ? GAS_ENV.name : null,
    gasUrl: maskValue(GAS_WEBAPP_URL, 18),
    spreadsheetId: maskValue(SPREADSHEET_ID, 6),
    usersSheetGid: USERS_SHEET_GID_VALID || null
  };
  if (GAS_WEBAPP_URL) {
    try {
      const gasResult = await proxyToGas({ action: "list_users" }, 15e3);
      const gasErr = gasAuthError(gasResult);
      result.gasOk = !gasErr;
      result.gasError = gasErr || null;
      result.userCount = Array.isArray(gasResult.users) ? gasResult.users.length : null;
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
    if (!hasSmtpConfigured()) {
      return res.status(503).json({
        error: "OTP mail uses nodemailer only. Set SMTP_EMAIL and SMTP_PASSWORD on the server (optional: SMTP_HOST, SMTP_PORT, OTP_FROM_EMAIL)."
      });
    }
    if (isDbMode()) {
      const dbResult = await proxyToGas({ action: "request_otp", email });
      const dbErr = gasAuthError(dbResult);
      if (dbErr) {
        const status = /not authorized/i.test(dbErr) ? 403 : 400;
        return res.status(status).json({ error: dbErr });
      }
      const r = dbResult;
      return res.json({
        success: true,
        message: String(r.message || "OTP sent to your email")
      });
    }
    const user = await ensureLocalOtpUser(email);
    if (!user) {
      return res.status(403).json({
        error: "Your mail is not authorized. Please contact IT Admin only."
      });
    }
    const result = await requestOtp(email);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Auth Request Error:", error);
    res.status(500).json({ error: error.message || "Failed to process request" });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });
    const ip = getClientIp(req);
    if (isDbMode()) {
      const dbResult = await proxyToGas({ action: "verify_otp", email, otp });
      const dbErr = gasAuthError(dbResult);
      if (dbErr) {
        recordFailedOtpAttempt(ip, email);
        return res.status(400).json({ error: dbErr });
      }
      const rawUser = dbResult.user;
      if (!rawUser) {
        recordFailedOtpAttempt(ip, email);
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }
      clearFailedOtpAttempt(ip, email);
      const normalized2 = normalizeUser2(rawUser);
      upsertLocalUser(normalized2);
      const token2 = setSessionCookie(res, normalized2);
      return res.json({ success: true, user: normalized2, token: token2 });
    }
    if (!hasSmtpConfigured()) {
      return res.status(503).json({
        error: "Set SMTP_EMAIL and SMTP_PASSWORD to verify OTP via nodemailer."
      });
    }
    const check = verifyOtp(email, otp);
    if (!check.ok) {
      recordFailedOtpAttempt(ip, email);
      return res.status(400).json({ error: check.error });
    }
    let user = findRegisteredUser(email);
    if (!user) {
      try {
        await syncUsersNow(userSyncDeps());
      } catch {
      }
      user = findRegisteredUser(email);
    }
    if (!user) {
      recordFailedOtpAttempt(ip, email);
      return res.status(403).json({ error: "User account not found after verification" });
    }
    clearFailedOtpAttempt(ip, email);
    const normalized = normalizeUser2(user);
    upsertLocalUser(normalized);
    const token = setSessionCookie(res, normalized);
    res.json({ success: true, user: normalized, token });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});
app.get("/api/auth/session", async (req, res) => {
  try {
    let session = getSessionFromRequest(req);
    const fallbackEmail = String(
      req.headers["x-user-email"] || req.query.userEmail || ""
    ).trim().toLowerCase();
    if (!session && fallbackEmail) {
      session = { email: fallbackEmail, role: "IT Admin" };
    }
    if (!session) return res.json({ success: true, authenticated: false, user: null });
    let user = findRegisteredUser(session.email);
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || !user) {
      try {
        await syncUsersNow(userSyncDeps());
        user = findRegisteredUser(session.email);
      } catch {
      }
    }
    if (!user) {
      const fallbackUser = {
        email: session.email,
        role: session.role || "User",
        name: session.email.split("@")[0],
        status: "Active",
        locations: session.locations || [],
        plants: session.plants || [],
        categories: session.categories || []
      };
      const norm3 = normalizeUser2(fallbackUser);
      upsertLocalUser(norm3);
      const token2 = setSessionCookie(res, norm3);
      return res.json({ success: true, user: fallbackUser, token: token2 });
    }
    const normalized = normalizeUser2(user);
    upsertLocalUser(normalized);
    const token = setSessionCookie(res, normalized);
    res.json({ success: true, user: normalized, token });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Session check failed";
    res.status(500).json({ error: msg });
  }
});
app.post("/api/auth/logout", (req, res) => {
  const session = getSessionFromRequest(req);
  clearSessionCookie(res, session?.email);
  res.json({ success: true });
});
function getBaseUrl(req) {
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
    const allowedMime = /* @__PURE__ */ new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
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
    const result = await proxyToGas({
      action: "upload_file",
      filename: safeName,
      mimeType,
      fileData: base64Data
    }, 6e4);
    if (result.error) throw new Error(result.error);
    const fileId = String(result.fileId || "");
    const savedUrl = String(result.url || result.viewUrl || "");
    const useStoredUrl = isSupabaseMode() || fileId.startsWith("local-") || savedUrl.includes("supabase.co");
    const url = useStoredUrl ? savedUrl : fileId ? drivePreviewUrl(fileId) : savedUrl;
    const viewUrl = useStoredUrl ? savedUrl || `/api/file/view?id=${encodeURIComponent(fileId)}` : fileId ? `/api/file/view?id=${encodeURIComponent(fileId)}` : url ? `/api/file/view?url=${encodeURIComponent(url)}` : "";
    res.json({ url, viewUrl, fileId, fileName: result.fileName });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "File upload failed" });
  }
});
app.get("/api/file/view", async (req, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const urlParam = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!id && !urlParam) return res.status(400).json({ error: "Missing id or url parameter" });
    if (id.startsWith("local-")) {
      const { readLocalUpload: readLocalUpload2 } = await Promise.resolve().then(() => (init_sqlFiles(), sqlFiles_exports));
      const local = await readLocalUpload2(id);
      if (!local) return res.status(404).send("File not found");
      res.setHeader("Content-Type", local.contentType);
      res.setHeader("Content-Disposition", "inline");
      return res.send(Buffer.from(local.bytes));
    }
    if (urlParam && !isAllowedRemoteUrl(urlParam)) {
      return res.status(403).json({ error: "Only Google Drive file URLs are allowed." });
    }
    const source = id ? driveDownloadUrl(id) : urlParam;
    const data = await fetchRemoteFile(source);
    if (!data) {
      const accept = String(req.headers.accept || "");
      const isImgReq = accept.includes("image") || /\.(png|jpe?g|webp|gif|svg)/i.test(source) || !accept.includes("text/html") && !accept.includes("application/pdf");
      if (isImgReq) {
        return res.redirect(302, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80");
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(404).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>File not found</h2><p>Check Google Drive sharing: <b>Anyone with the link</b> can view. Re-upload the PDF from the asset form if needed.</p></body></html>`
      );
    }
    const isPdf = data.contentType.toLowerCase().includes("pdf") || data.bytes.length > 4 && data.bytes[0] === 37 && data.bytes[1] === 80 && data.bytes[2] === 68 && data.bytes[3] === 70;
    res.setHeader("Content-Type", isPdf ? "application/pdf" : data.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(data.bytes.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(Buffer.from(data.bytes));
  } catch (error) {
    console.error("File view error:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(
      `<html><body style="font-family:system-ui;padding:24px"><h2>Could not open file</h2><p>${error.message || "Failed to load file"}</p></body></html>`
    );
  }
});
app.get("/api/assignment-history", async (req, res) => {
  try {
    if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
      await fetchHistoryFromGas(proxyToGas, SPREADSHEET_ID);
    }
    const history = readAssignmentHistory();
    res.json(normalizeHistoryForUi(history));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load assignment history" });
  }
});
async function recordAudit(userEmail, action, targetId, remarks, oldVal, newVal) {
  try {
    const logId = "L-" + Math.floor(1e5 + Math.random() * 9e5).toString();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const email = String(userEmail || "system@aems.local").trim().toLowerCase();
    const row = {
      "Log ID": logId,
      "User Email": email,
      "Action": action,
      "Target ID": String(targetId || "-"),
      "Date & Time": now,
      "Old Value": typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal || ""),
      "New Value": typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal || ""),
      "Remarks": remarks || ""
    };
    addAuditLog(row["User Email"], row.Action, row["Target ID"], row["Old Value"], row["New Value"], row.Remarks);
    await upsertJsonRow2("AuditLogs", logId, row).catch(() => {
    });
    await mirrorAuditLogToPostgres(row).catch(() => {
    });
  } catch (err) {
    console.warn("[Audit] Failed to record audit log:", err);
  }
}
app.get("/api/audit-logs", async (req, res) => {
  try {
    let logs = [];
    try {
      logs = await listJsonRows2("AuditLogs");
    } catch {
      logs = readAuditLogs();
    }
    if (!logs || logs.length === 0) {
      logs = readAuditLogs();
    }
    logs.sort((a, b) => {
      const ta = Date.parse(a["Date & Time"] || a.dateTime || a.date || "0");
      const tb = Date.parse(b["Date & Time"] || b.dateTime || b.date || "0");
      return tb - ta;
    });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
  }
});
app.get("/api/admin/backups", async (_req, res) => {
  try {
    const backups = listLocalBackups();
    res.json({ success: true, backups });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list backups" });
  }
});
app.post("/api/admin/backups/create", async (req, res) => {
  try {
    const reason = String(req.body?.reason || "Manual IT Admin Backup").trim();
    const meta = await createDatabaseSnapshot(reason);
    res.json({ success: true, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create database snapshot" });
  }
});
app.get("/api/assets/sync-meta", async (req, res) => {
  try {
    if (GAS_WEBAPP_URL) scheduleAssetsSyncIfStale(GAS_WEBAPP_URL);
    const meta = getAssetsSyncMeta();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("X-AMS-Syncing", meta.syncing ? "1" : "0");
    res.json(meta);
  } catch (err) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count: 0, fingerprint: "", cacheAgeMs: null, syncing: false, lastRemovedCount: 0 });
  }
});
app.post("/api/assets/rebuild-sheets", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole2(user.role)) {
      return res.status(403).json({ error: "Only IT Admin can rebuild sheets." });
    }
    invalidateAssetCache();
    const assets = await refreshAssetsNow(GAS_WEBAPP_URL);
    res.json({
      success: true,
      message: "Data refreshed from new sheet. Create tabs using gas/NEW_SHEET_ROW1_HEADERS.txt",
      count: assets.length
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Rebuild failed" });
  }
});
app.post("/api/assets/sync", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) {
      return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured" });
    }
    const user = resolveRequestUser(req);
    let assets = await refreshAssetsNow(GAS_WEBAPP_URL);
    if (user && isItAdminRole2(user.role)) {
      try {
        await proxyToGas({ action: "sync_location_plant_sheets" }, 12e4);
      } catch (syncErr) {
        console.warn(
          "[AMS] Location/plant sheet sync skipped:",
          syncErr instanceof Error ? syncErr.message : syncErr
        );
      }
    }
    if (user && isItAdminRole2(user.role)) {
      let persisted = 0;
      for (const asset of assets) {
        const raw = JSON.stringify(asset);
        const healed = healMisalignedAssetFields(asset);
        if (JSON.stringify(healed) === raw) continue;
        try {
          const row = buildMasterAssetRow(healed);
          const result = await proxyToGas(
            { action: "update", id: String(healed.id), row },
            6e4
          );
          if (result?.error) {
            console.warn("[AMS] Heal persist failed for", healed.id, result.error);
          } else {
            persisted++;
          }
        } catch (persistErr) {
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
  } catch (err) {
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
    let assets;
    let fromCache = false;
    let syncing = false;
    try {
      const result = await getAssetsWithCache(GAS_WEBAPP_URL, force);
      assets = result.assets;
      fromCache = result.fromCache;
      syncing = result.syncing;
    } catch (syncErr) {
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
      "Monitor Brand": a.monitorMake,
      "Monitor Model Number": a.monitorModel,
      "Keyboard SN": a.keyboardSerial,
      "Keyboard Code": a.keyboardAssetCode,
      "Keyboard Brand": a.keyboardMake,
      "Keyboard Model Number": a.keyboardModel,
      "Keyboard Connectivity": a.keyboardConnectivity,
      "Mouse SN": a.mouseSerial,
      "Mouse Code": a.mouseAssetCode,
      "Mouse Brand": a.mouseMake,
      "Mouse Model Number": a.mouseModel,
      "Mouse Connectivity": a.mouseConnectivity,
      "UPS SN": a.upsSerial,
      "UPS Code": a.upsAssetCode,
      "UPS Brand": a.upsMake,
      "UPS Model Number": a.upsModel,
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
      assetTypeId: a.assetTypeId || ""
    }));
    res.setHeader("X-AMS-Cache", fromCache ? "hit" : "miss");
    res.setHeader("X-AMS-Syncing", syncing ? "1" : "0");
    const user = resolveRequestUser(req);
    let scopedRows = sheetRows;
    if (user && !isItAdminRole2(user.role)) {
      const uLocs = (user.locations || []).flatMap((l) => l.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s && s !== "all"));
      const uPlants = (user.plants || []).flatMap((p) => p.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s && s !== "all"));
      const uCats = (user.categories || []).flatMap((c) => c.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s && s !== "all"));
      const hasAllLocs = (user.locations || []).some((l) => l.trim().toLowerCase() === "all");
      const hasAllPlants = (user.plants || []).some((p) => p.trim().toLowerCase() === "all");
      const hasAllCats = (user.categories || []).some((c) => c.trim().toLowerCase() === "all");
      if (!hasAllLocs && uLocs.length === 0 && !hasAllPlants && uPlants.length === 0) {
        scopedRows = [];
      } else if (!hasAllCats && uCats.length === 0) {
        scopedRows = [];
      } else {
        scopedRows = scopedRows.filter((row) => {
          const rawLoc = String(row.Location || "").trim().toLowerCase().replace(/\s*,\s*/g, ",");
          const rowLocTokens = rawLoc ? [rawLoc, ...rawLoc.split(",").map((s) => s.trim()).filter(Boolean)] : [];
          const rowPlant = String(row["Plant Code"] || "").trim().toLowerCase();
          const rawCat = String(row["Main Category"] || row["Asset Type"] || "").trim().toLowerCase();
          const rowCat = rawCat || "it assets";
          const matchLoc = hasAllLocs || uLocs.length === 0 || rowLocTokens.length === 0 || uLocs.some((l) => rowLocTokens.some((t) => t === l || t.includes(l) || l.includes(t)));
          const matchPlant = hasAllPlants || uPlants.length === 0 || !rowPlant || uPlants.some((p) => rowPlant === p || rowPlant.includes(p) || p.includes(rowPlant));
          const matchCat = hasAllCats || uCats.length === 0 || uCats.some((c) => rowCat === c || rowCat.includes(c) || c.includes(rowCat));
          if (uLocs.length > 0 && uPlants.length > 0 && !hasAllLocs && !hasAllPlants) {
            return matchLoc && matchPlant && matchCat;
          }
          return matchLoc && matchPlant && matchCat;
        });
      }
    }
    if (scopedRows.length > 0) {
      const last = scopedRows[scopedRows.length - 1];
      console.log("[AMS] GET /api/assets \u2014 returning", scopedRows.length, "rows; latest:", {
        id: last["S No"],
        CPU: last.CPU,
        RAM: last.RAM,
        "MAC Address": last["MAC Address"],
        "Contact Person Email": last["Contact Person Email"]
      });
    }
    res.json(scopedRows);
  } catch (error) {
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
        const result = await proxyToGas({ action: "next_code_lock", category, dbMode });
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
    const assets = await getAssetsForOps();
    const code = generateAssetCode(assets, category);
    const maxId = assets.reduce((max, a) => Math.max(max, parseInt(a.id, 10) || 0), 0);
    const id = String(maxId + 1).padStart(3, "0");
    res.json({ manual: false, code, id });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to generate code" });
  }
});
app.get("/api/assets/check-unique", async (req, res) => {
  try {
    const field = req.query.field;
    const value = String(req.query.value || "").trim();
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : void 0;
    const allowed = ["serialNumber", "assetCode", "macAddress", "vehicleNumber", "uniqueCode"];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: "Invalid field" });
    }
    if (!value) return res.json({ duplicate: false });
    if (!GAS_WEBAPP_URL) return res.json({ duplicate: false });
    const assets = await getAssetsForOps();
    const dup = findDuplicateAsset(assets, field, value, excludeId);
    const fieldLabel = uniqueFieldLabel(field);
    const who = dup ? [dup.assetCode, dup.serialNumber, dup.id].filter(Boolean).join(" / ") : "";
    res.json({
      duplicate: !!dup,
      message: dup ? `This ${fieldLabel} is already assigned to Asset: ${who}. Duplicates are not allowed.` : void 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Validation failed" });
  }
});
async function fetchSheetData() {
  if (!GAS_WEBAPP_URL) return [getDefaultAssetHeaders()];
  const data = await gasGet(GAS_WEBAPP_URL);
  if (Array.isArray(data)) return data;
  return [getDefaultAssetHeaders()];
}
async function getAssetsForOps() {
  if (!GAS_WEBAPP_URL) return [];
  try {
    const { assets } = await getAssetsWithCache(GAS_WEBAPP_URL);
    return assets;
  } catch {
    const cached = getCachedAssets();
    return cached || [];
  }
}
async function getFreshAssetsForMutation() {
  if (GAS_WEBAPP_URL) {
    try {
      return await refreshAssetsNow(GAS_WEBAPP_URL);
    } catch (error) {
      console.warn("[AMS] Fresh asset pull failed before mutation; falling back to cache:", error);
    }
  }
  return getAssetsForOps();
}
async function assertSavedEmployeeProfile(assetData, existing) {
  const employeeId = String(assetData.employeeId || "").trim();
  const email = normalizeEmail3(String(assetData.contactEmail || ""));
  const contactName = String(assetData.contactName || "").trim();
  if (!employeeId && !email && !contactName) return null;
  if (!employeeId && !email) {
    throw new Error("Employee ID is required \u2014 select or create a saved employee profile.");
  }
  const employees = readEmployees();
  let employee = (employeeId ? findEmployeeById(employees, employeeId) : void 0) || (email ? findEmployeeByEmail(employees, email) : void 0);
  if (!employee) {
    if (employeeId && contactName && email) {
      const newEmp = {
        employeeId,
        name: contactName,
        email,
        phone: String(assetData.contactMobile || "").replace(/\D/g, "").slice(0, 10),
        department: String(assetData.department || "").trim(),
        location: String(assetData.location || "").trim(),
        designation: "",
        plant: String(assetData.plantCode || "").trim(),
        status: "Active"
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
      } catch (err) {
        const errMsg = String(err.message || "").toLowerCase();
        if (errMsg.includes("already exists") || errMsg.includes("alreadyexist") || errMsg.includes("exist")) {
          console.log(`[AMS] Employee ${employeeId} already exists locally. Proceeding.`);
          const freshList = readEmployees();
          employee = findEmployeeById(freshList, employeeId);
          if (!employee) {
            employee = {
              ...newEmp,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
    const prevId = normalizeEmployeeId2(existing?.employeeId || "");
    const nextId = normalizeEmployeeId2(employee.employeeId);
    const sameAssignee = Boolean(prevId && nextId && prevId === nextId);
    if (!sameAssignee) {
      throw new Error(
        "Cannot assign assets to an inactive employee. Clear assignee to return the asset, or choose an active employee."
      );
    }
  }
  return employee;
}
function isCctvSecurityAsset(assetData) {
  const assetType = String(assetData.assetType || "").trim();
  const subCategory = String(assetData.subCategory || "").trim();
  const assetTypeId = String(assetData.assetTypeId || "").trim();
  return assetTypeId === "cctv_security" || assetType === "Camera" || assetType === "NVR" || subCategory === "CCTV / Security Device";
}
function hasAssigneeFields(assetData) {
  return !!String(assetData.contactName || "").trim() || !!String(assetData.contactEmail || "").trim() || !!String(assetData.employeeId || "").trim();
}
function ensureAssignedDate(assetData, existingAsset) {
  if (!hasAssigneeFields(assetData)) {
    assetData.assignedDate = "";
    return;
  }
  const current = String(assetData.assignedDate || "").trim();
  if (current) return;
  const fromExisting = String(existingAsset?.assignedDate || "").trim();
  assetData.assignedDate = fromExisting || (/* @__PURE__ */ new Date()).toISOString();
}
async function validateAssetPayload(assetData, existingAsset) {
  const mainCat = String(assetData.mainCategory || "IT Assets").trim();
  const isSoftware = mainCat === "Software / License Assets";
  const isCctv = isCctvSecurityAsset(assetData);
  const isInHouse = String(assetData.contactName || "").trim().toLowerCase() === "in house" && !String(assetData.employeeId || "").trim();
  const hasAssignee2 = !isInHouse && (!!String(assetData.contactName || "").trim() || !!String(assetData.contactEmail || "").trim() || !!String(assetData.employeeId || "").trim());
  if (!isSoftware && !String(assetData.serialNumber || "").trim()) {
    throw new Error("Serial number is required");
  }
  if (!String(assetData.location || "").trim()) {
    throw new Error("Location is required");
  }
  if (!String(assetData.plantCode || "").trim()) {
    throw new Error("Plant code is required");
  }
  if (!isCctv && (hasAssignee2 || isInHouse) && !String(assetData.department || "").trim()) {
    throw new Error("Department is required");
  }
  if (!isCctv && !isInHouse) {
    if (hasAssignee2) {
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
    documentUrl: String(assetData.documentUrl || "")
  });
  if (purchaseErr) throw new Error(purchaseErr);
}
async function prepareAssetPayload(assetData, existingAsset) {
  const fieldHealed = healMisalignedAssetFields(assetData);
  const healed = healMisalignedCategoryFields({
    mainCategory: String(fieldHealed.mainCategory || ""),
    subCategory: String(fieldHealed.subCategory || ""),
    assetType: String(fieldHealed.assetType || ""),
    make: String(fieldHealed.make || ""),
    assetCode: String(fieldHealed.assetCode || "")
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
    subCategory: String(assetData.subCategory || "")
  });
  const details = assetData.dynamicDetails || {};
  const mapped = applyLegacyFieldMapping(assetData, typeDef, details);
  if (details.vehicle_number && !mapped.serialNumber) {
    mapped.serialNumber = details.vehicle_number;
  }
  ensureAssignedDate(mapped, existingAsset);
  await validateAssetPayload(mapped, existingAsset);
  return mapped;
}
var ALWAYS_PRESERVE_ASSET_EDIT_FIELDS = [
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
  "amcCost"
];
var TYPE_SPECIFIC_PRESERVE_ASSET_EDIT_FIELDS = [
  "ram",
  "ssd",
  "cpu",
  "windowsVersion",
  "macAddress",
  "ipAddress",
  "hostName",
  "monitorSerial",
  "monitorAssetCode",
  "monitorMake",
  "monitorModel",
  "keyboardSerial",
  "keyboardAssetCode",
  "keyboardMake",
  "keyboardModel",
  "keyboardConnectivity",
  "mouseSerial",
  "mouseAssetCode",
  "mouseMake",
  "mouseModel",
  "mouseConnectivity",
  "upsSerial",
  "upsAssetCode",
  "upsMake",
  "upsModel",
  "additionalItems",
  "assetType",
  "assetTypeId"
];
function isBlankValue(value) {
  if (value === void 0 || value === null) return true;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return String(value).trim() === "";
}
function sameAssetEditShape(incoming, existing) {
  return ["mainCategory", "subCategory", "assetType", "assetTypeId"].every((key) => {
    const next = String(incoming[key] || "").trim().toLowerCase();
    const prev = String(existing[key] || "").trim().toLowerCase();
    return !next || !prev || next === prev;
  });
}
function mergeAssetEditPayload(incoming, existing) {
  if (!existing) return incoming;
  const merged = { ...incoming };
  const hadAssignee = !isBlankValue(existing.employeeId) || !isBlankValue(existing.contactName) || !isBlankValue(existing.contactEmail) || !isBlankValue(existing.contactMobile);
  const clearedAssignee = hadAssignee && isBlankValue(merged.employeeId) && isBlankValue(merged.contactName) && isBlankValue(merged.contactEmail) && isBlankValue(merged.contactMobile);
  const preserveKeys = sameAssetEditShape(merged, existing) ? [...ALWAYS_PRESERVE_ASSET_EDIT_FIELDS, ...TYPE_SPECIFIC_PRESERVE_ASSET_EDIT_FIELDS] : ALWAYS_PRESERVE_ASSET_EDIT_FIELDS;
  for (const key of preserveKeys) {
    if (clearedAssignee && ["employeeId", "contactName", "contactEmail", "contactMobile", "assignedDate"].includes(key)) {
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
  if (sameAssetEditShape(merged, existing) && isBlankValue(merged.dynamicDetails) && !isBlankValue(existing.dynamicDetails)) {
    merged.dynamicDetails = existing.dynamicDetails;
  }
  return merged;
}
async function persistAssetDynamicDetails(assetId, assetData) {
  const details = assetData.dynamicDetails || {};
  saveDetailsForAsset(assetId, details);
  if (GAS_WEBAPP_URL) {
    const gas = await persistDetailsToGas(assetId, details, proxyToGas);
    if (!gas.ok) console.warn("Asset details GAS sync:", gas.error);
  }
}
function sanitizeAssetFields(assetData) {
  const mainCat = String(assetData.mainCategory || "").trim() || "IT Assets";
  const assetType = String(assetData.assetType || "").trim();
  const typeId = String(assetData.assetTypeId || "").trim();
  const isIT = mainCat === "IT Assets";
  const isDesktop = typeId === "desktop" || isIT && assetType === "Desktop";
  const isLaptopOrDesktop = typeId === "laptop" || isDesktop || isIT && ["Laptop", "Desktop"].includes(assetType);
  const hasAttachedPeripheralDetails = [
    assetData.monitorSerial,
    assetData.monitorAssetCode,
    assetData.monitorMake,
    assetData.monitorModel,
    assetData.keyboardSerial,
    assetData.keyboardAssetCode,
    assetData.keyboardMake,
    assetData.keyboardModel,
    assetData.keyboardConnectivity,
    assetData.mouseSerial,
    assetData.mouseAssetCode,
    assetData.mouseMake,
    assetData.mouseModel,
    assetData.mouseConnectivity,
    assetData.upsSerial,
    assetData.upsAssetCode,
    assetData.upsMake,
    assetData.upsModel
  ].some((value) => String(value || "").trim() !== "");
  const keepAttachedPeripheralDetails = isIT && (isDesktop || hasAttachedPeripheralDetails);
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
  if (!keepAttachedPeripheralDetails) {
    assetData.monitorSerial = "";
    assetData.monitorAssetCode = "";
    assetData.monitorMake = "";
    assetData.monitorModel = "";
    assetData.keyboardSerial = "";
    assetData.keyboardAssetCode = "";
    assetData.keyboardMake = "";
    assetData.keyboardModel = "";
    assetData.keyboardConnectivity = "";
    assetData.mouseSerial = "";
    assetData.mouseAssetCode = "";
    assetData.mouseMake = "";
    assetData.mouseModel = "";
    assetData.mouseConnectivity = "";
    assetData.upsSerial = "";
    assetData.upsAssetCode = "";
    assetData.upsMake = "";
    assetData.upsModel = "";
  }
  if (assetData.additionalItems) {
    const tLower = String(assetType || "").toLowerCase();
    const allowedTypes = ["laptop", "desktop", "input device", "output device", "laptop / desktop"];
    const isAllowed = allowedTypes.some((t) => tLower.includes(t));
    if (!isAllowed) {
      let clean = String(assetData.additionalItems);
      const wordsToRemove = ["case", "charger", "adapter", "adpater", "etc"];
      for (const word of wordsToRemove) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        clean = clean.replace(regex, "");
      }
      clean = clean.replace(/,\s*,/g, ",").replace(/\s+/g, " ").replace(/,\s*\./g, ".").replace(/^\s*,\s*/g, "").replace(/,\s*$/g, "").trim();
      if (clean === "." || clean === "," || clean === ",.") {
        clean = "";
      }
      assetData.additionalItems = clean;
    }
  }
}
function buildMasterAssetRow(assetData, existingMasterRow) {
  const masterHeaders = getDefaultAssetHeaders();
  return buildAssetRow(masterHeaders, assetData, existingMasterRow);
}
function sheetRowToMasterRow(sheetHeaders, sheetRow) {
  const masterHeaders = getDefaultAssetHeaders();
  return mapMasterRowToSheetHeaders(masterHeaders, sheetHeaders, sheetRow);
}
function buildAssetRow(headers2, assetData, existingRow) {
  sanitizeAssetFields(assetData);
  const row = existingRow ? [...existingRow] : new Array(headers2.length).fill("");
  const getColIndex = (keys) => {
    for (const key of keys) {
      const target = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers2.findIndex(
        (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === target
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const setVal = (keys, val) => {
    if (val === void 0 || val === null) return;
    for (const key of keys) {
      const target = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      headers2.forEach((h, idx) => {
        if (h.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
          row[idx] = String(val);
        }
      });
    }
  };
  const uniqueCode = assetData.uniqueCode || assetData.assetCode || Math.floor(1e4 + Math.random() * 9e4).toString();
  const binaryCode = assetData.binaryCode !== void 0 ? assetData.binaryCode : "0";
  setVal(["Asset ID", "S No", "ID"], assetData.id?.toString() || "");
  setVal(["Asset Code"], assetData.assetCode || "");
  setVal(["Account Asset Code"], assetData.accountAssetCode || "");
  setVal(["Asset Name"], assetData.assetName || assetData.model || "");
  setVal(["Main Category"], assetData.mainCategory || "IT Assets");
  const subCategory = assetData.subCategory || (["Laptop", "Desktop"].includes(String(assetData.assetType || "").trim()) ? "Laptop / Desktop" : ["Camera", "NVR"].includes(String(assetData.assetType || "").trim()) ? "CCTV / Security Device" : "") || "Other IT Asset";
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
  setVal(["Monitor Brand", "Monitor Make"], assetData.monitorMake || "");
  setVal(["Monitor Model Number", "Monitor Model"], assetData.monitorModel || "");
  setVal(["Keyboard Serial", "Keyboard SN"], assetData.keyboardSerial || "");
  setVal(["Keyboard Asset Code", "Keyboard Code"], assetData.keyboardAssetCode || "");
  setVal(["Keyboard Brand", "Keyboard Make"], assetData.keyboardMake || "");
  setVal(["Keyboard Model Number", "Keyboard Model"], assetData.keyboardModel || "");
  setVal(["Keyboard Connectivity", "Keyboard Type"], assetData.keyboardConnectivity || "");
  setVal(["Mouse Serial", "Mouse SN"], assetData.mouseSerial || "");
  setVal(["Mouse Asset Code", "Mouse Code"], assetData.mouseAssetCode || "");
  setVal(["Mouse Brand", "Mouse Make"], assetData.mouseMake || "");
  setVal(["Mouse Model Number", "Mouse Model"], assetData.mouseModel || "");
  setVal(["Mouse Connectivity", "Mouse Type"], assetData.mouseConnectivity || "");
  setVal(["UPS Serial", "UPS SN"], assetData.upsSerial || "");
  setVal(["UPS Asset Code", "UPS Code"], assetData.upsAssetCode || "");
  setVal(["UPS Brand", "UPS Make"], assetData.upsMake || "");
  setVal(["UPS Model Number", "UPS Model"], assetData.upsModel || "");
  while (row.length < headers2.length) row.push("");
  return row;
}
function buildRedesignedAssetRow(assetData, assetId, qrCodeText) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const details = assetData.dynamicDetails || {};
  const vehicleNo = details.vehicle_number || details.vehicleNumber || (assetData.mainCategory === "Vehicle Assets" ? assetData.serialNumber : "") || "";
  const serial = assetData.mainCategory === "Vehicle Assets" && vehicleNo ? vehicleNo : assetData.serialNumber || "";
  return {
    "Asset ID": assetId,
    "Category": assetData.mainCategory || "IT Assets",
    "Sub Category": assetData.subCategory || (["Camera", "NVR"].includes(String(assetData.assetType || "").trim()) ? "CCTV / Security Device" : assetData.assetType || ""),
    "Asset Type": assetData.assetType || "Laptop",
    "Asset Name": assetData.assetName || assetData.model || "",
    "Brand": assetData.make || "",
    "Model": assetData.model || "",
    "Serial Number": serial,
    "Vehicle Number": vehicleNo,
    "Asset Code": assetData.assetCode || "",
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
    "Monitor Brand": assetData.monitorMake || "",
    "Monitor Model Number": assetData.monitorModel || "",
    "Keyboard Serial": assetData.keyboardSerial || "",
    "Keyboard Asset Code": assetData.keyboardAssetCode || "",
    "Keyboard Brand": assetData.keyboardMake || "",
    "Keyboard Model Number": assetData.keyboardModel || "",
    "Keyboard Connectivity": assetData.keyboardConnectivity || "",
    "Mouse Serial": assetData.mouseSerial || "",
    "Mouse Asset Code": assetData.mouseAssetCode || "",
    "Mouse Brand": assetData.mouseMake || "",
    "Mouse Model Number": assetData.mouseModel || "",
    "Mouse Connectivity": assetData.mouseConnectivity || "",
    "UPS Serial": assetData.upsSerial || "",
    "UPS Asset Code": assetData.upsAssetCode || "",
    "UPS Brand": assetData.upsMake || "",
    "UPS Model Number": assetData.upsModel || "",
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
    "Return Date": assetData.returnDate || ""
  };
}
app.get("/api/data-sheets", async (req, res) => {
  try {
    const requestUser = resolveRequestUser(req);
    const role = requestUser?.role || req.authUser?.role || "";
    if (!isItAdminRole2(role)) {
      return res.status(403).json({ error: "Only IT Admin can view data sheets." });
    }
    const { buildDataSheets: buildDataSheets2 } = await Promise.resolve().then(() => (init_dataSheets(), dataSheets_exports));
    const sheets = await buildDataSheets2();
    res.json({ success: true, sheets });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load data sheets" });
  }
});
app.get("/api/data-sheets.xlsx", async (req, res) => {
  try {
    const requestUser = resolveRequestUser(req);
    const role = requestUser?.role || req.authUser?.role || "";
    if (!isItAdminRole2(role)) {
      return res.status(403).json({ error: "Only IT Admin can download data sheets." });
    }
    const { buildDataSheets: buildDataSheets2, sheetsToXlsxBuffer: sheetsToXlsxBuffer2 } = await Promise.resolve().then(() => (init_dataSheets(), dataSheets_exports));
    const sheets = await buildDataSheets2();
    const buffer = sheetsToXlsxBuffer2(sheets);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="AEMS-Data-Sheets.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to export Excel" });
  }
});
app.get("/api/users/local", requireItAdminRole, (_req, res) => {
  res.json(getCachedUsers());
});
app.get("/api/users", requireItAdminRole, async (req, res) => {
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
  } catch (error) {
    console.error("GET /api/users error:", error);
    const localUsers = getCachedUsers();
    if (localUsers.length > 0) {
      return res.json(localUsers);
    }
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});
app.post("/api/users", requireItAdminRole, async (req, res) => {
  try {
    const user = normalizeUser2(req.body);
    if (!user.email) return res.status(400).json({ error: "Email is required" });
    const data = readAppData();
    if (data.users.some((u) => u.email === user.email)) {
      return res.status(400).json({ error: "User already exists" });
    }
    const sheetSave = await persistUserToSheet("add_user", user, {
      proxyToGas,
      spreadsheetId: SPREADSHEET_ID,
      usersSheetGid: USERS_SHEET_GID_VALID
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }
    upsertLocalUser(user);
    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : [user];
    recordAudit(
      req.authUser?.email || getFallbackEmail(req),
      "User Created",
      user.email,
      `Created user account ${user.email} (Role: ${user.role}, Plants: ${(user.plants || []).join(", ") || "All"})`,
      null,
      user
    );
    res.json({ success: true, user, users: synced, savedTo: sheetSave.via });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to add user" });
  }
});
app.put("/api/users/:email", requireItAdminRole, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const user = normalizeUser2({ ...req.body, email });
    const data = readAppData();
    const idx = data.users.findIndex((u) => u.email === email);
    const action = idx === -1 ? "add_user" : "update_user";
    const sheetSave = await persistUserToSheet(action, user, {
      proxyToGas,
      spreadsheetId: SPREADSHEET_ID,
      usersSheetGid: USERS_SHEET_GID_VALID
    });
    if (!sheetSave.ok) {
      return res.status(500).json({ error: sheetSave.error });
    }
    upsertLocalUser(user);
    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : data.users;
    recordAudit(
      req.authUser?.email || getFallbackEmail(req),
      "User Updated",
      email,
      `Updated user permissions for ${email} (Role: ${user.role}, Plants: ${(user.plants || []).join(", ") || "All"})`,
      null,
      user
    );
    res.json({ success: true, user, users: synced, savedTo: sheetSave.via });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});
app.delete("/api/users/:email", requireItAdminRole, async (req, res) => {
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
    deleteLocalUser(email);
    invalidateUsersCache();
    const synced = GAS_WEBAPP_URL ? await syncUsersNow(userSyncDeps()) : [];
    recordAudit(
      req.authUser?.email || getFallbackEmail(req),
      "User Deleted",
      email,
      `Deleted user account ${email}`,
      target,
      null
    );
    res.json({ success: true, users: synced, savedTo: sheetSave.via });
  } catch (error) {
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
    const CACHE_KEY3 = "locations_plants";
    const cacheAge = 10 * 60 * 1e3;
    let cached = force ? null : readCache(CACHE_KEY3, cacheAge);
    if (!cached && GAS_WEBAPP_URL) {
      const fromGas = await fetchLocationsPlantsFromGas(proxyToGas, GAS_WEBAPP_URL);
      if (fromGas && fromGas.locations.length > 0) {
        data.settings.locations = fromGas.locations;
        data.settings.plants = fromGas.plants;
        writeAppData(data);
        writeCache(CACHE_KEY3, { locations: fromGas.locations, plants: fromGas.plants });
      } else {
        const stale = readCacheStale(CACHE_KEY3);
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
    const OPTIONS_CACHE_KEY = "gas_options";
    const optionsCacheAge = 5 * 60 * 1e3;
    let gasOpts = force ? null : readCache(OPTIONS_CACHE_KEY, optionsCacheAge);
    if (!gasOpts && GAS_WEBAPP_URL && includeRemoteOptions) {
      try {
        const gasResult = await gasGet(GAS_WEBAPP_URL, { type: "options" });
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
        if (Array.isArray(gasOpts.departments)) {
          cat.departments = Array.from(/* @__PURE__ */ new Set([...cat.departments || [], ...gasOpts.departments]));
        }
        if (Array.isArray(gasOpts.vendors)) {
          cat.vendors = Array.from(/* @__PURE__ */ new Set([...cat.vendors || [], ...gasOpts.vendors]));
        }
        if (Array.isArray(gasOpts.brands)) {
          for (const b of gasOpts.brands) {
            if (!cat.brands[b]) cat.brands[b] = [];
          }
        }
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
        const dynamicFields = ["ram", "ssd", "cpu", "windowsVersion", "licenseTypes"];
        for (const field of dynamicFields) {
          if (Array.isArray(gasOpts[field])) {
            cat[field] = Array.from(/* @__PURE__ */ new Set([...cat[field] || [], ...gasOpts[field]]));
          }
        }
      } catch (err) {
        console.warn("[AMS] Failed to fetch settings options from GAS:", err);
      }
    }
    try {
      const liveEmployees = readEmployees();
      const empDepts = liveEmployees.map((e) => String(e.department || "").trim()).filter(Boolean);
      if (empDepts.length > 0) {
        const existing = data.settings.catalog?.departments || [];
        data.settings.catalog.departments = Array.from(
          /* @__PURE__ */ new Set([...existing, ...empDepts])
        ).sort();
      }
    } catch (_) {
    }
    res.json(data.settings);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch settings" });
  }
});
app.post("/api/settings", requireItAdminRole, async (req, res) => {
  try {
    const incoming = req.body;
    const syncSheet = req.body.syncSheet !== false;
    const data = readAppData();
    const hasIncomingLocations = Array.isArray(incoming.locations);
    const hasIncomingPlants = Array.isArray(incoming.plants);
    const locations = hasIncomingLocations ? incoming.locations : data.settings.locations;
    const plants = hasIncomingPlants ? incoming.plants : data.settings.plants;
    if (GAS_WEBAPP_URL && incoming.catalog) {
      try {
        const current = data.settings.catalog || { brands: {}, vendors: [], departments: [] };
        const incomingCat = incoming.catalog;
        const syncOption = async (type, value) => {
          await proxyToGas({ action: "add_option", type, value }).catch(() => {
          });
        };
        if (Array.isArray(incomingCat.departments)) {
          for (const dept of incomingCat.departments) {
            if (!current.departments?.includes(dept)) {
              void syncOption("departments", dept);
            }
          }
        }
        if (Array.isArray(incomingCat.vendors)) {
          for (const v of incomingCat.vendors) {
            if (!current.vendors?.includes(v)) {
              void syncOption("vendors", v);
            }
          }
        }
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
        const fields = ["ram", "ssd", "cpu", "windowsVersion", "licenseTypes"];
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
      assetFields: Array.isArray(incoming.assetFields) ? incoming.assetFields : data.settings.assetFields,
      catalog: mergeCatalog(
        incoming.catalog && typeof incoming.catalog === "object" ? incoming.catalog : data.settings.catalog
      ),
      typeDefinitions: incoming.typeDefinitions && typeof incoming.typeDefinitions === "object" ? incoming.typeDefinitions : data.settings.typeDefinitions,
      dbMode: data.settings.dbMode
    };
    writeAppData(data);
    writeCache("locations_plants", { locations: data.settings.locations, plants: data.settings.plants });
    writeCache("gas_options", null);
    let sheetWarning;
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save settings" });
  }
});
app.post("/api/settings/rename-location", requireItAdminRole, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: "oldName and newName are required" });
    }
    const data = readAppData();
    data.settings.locations = (data.settings.locations || []).map(
      (l) => l === oldName ? newName : l
    );
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map(
        (p) => p.location === oldName ? { ...p, location: newName } : p
      );
    }
    writeAppData(data);
    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "rename_location", oldName, newName });
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }
    res.json({ success: true, settings: data.settings });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to rename location" });
  }
});
app.post("/api/settings/delete-location", requireItAdminRole, async (req, res) => {
  try {
    const { name, deleteOrArchive } = req.body;
    if (!name || !deleteOrArchive) {
      return res.status(400).json({ error: "name and deleteOrArchive are required" });
    }
    const data = readAppData();
    data.settings.locations = (data.settings.locations || []).filter((l) => l !== name);
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map(
        (p) => p.location === name ? { ...p, location: "" } : p
      );
    }
    writeAppData(data);
    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "delete_location", name, deleteOrArchive });
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }
    res.json({ success: true, settings: data.settings });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete location" });
  }
});
app.post("/api/settings/rename-plant", requireItAdminRole, async (req, res) => {
  try {
    const { oldCode, newCode, newName, location } = req.body;
    if (!oldCode || !newCode || !newName) {
      return res.status(400).json({ error: "oldCode, newCode, and newName are required" });
    }
    const data = readAppData();
    if (data.settings.plants) {
      data.settings.plants = data.settings.plants.map(
        (p) => p.code === oldCode ? { code: newCode, name: newName, location: location || p.location } : p
      );
    }
    writeAppData(data);
    if (GAS_WEBAPP_URL) {
      const gasRes = await proxyToGas({ action: "rename_plant", oldCode, newCode, newName, location });
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }
    res.json({ success: true, settings: data.settings });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to rename plant" });
  }
});
app.post("/api/settings/delete-plant", requireItAdminRole, async (req, res) => {
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
      const gasRes = await proxyToGas({ action: "delete_plant", code, deleteOrArchive });
      if (gasRes?.error) {
        return res.status(500).json({ error: gasRes.error });
      }
    }
    res.json({ success: true, settings: data.settings });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete plant" });
  }
});
app.get("/api/type-definitions", (_req, res) => {
  try {
    res.json(getTypeDefinitions());
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load type definitions" });
  }
});
app.post("/api/type-definitions", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    if (!user || !isItAdminRole2(user.role)) {
      return res.status(403).json({
        error: "Access Denied: Only IT Admin is authorized to configure departments, categories, and entry forms."
      });
    }
    const incoming = req.body;
    const saved = saveTypeDefinitions(incoming);
    if (incoming && incoming.syncSheet !== false && GAS_WEBAPP_URL) {
      void persistTypeDefinitionsToGas(saved, proxyToGas);
    }
    res.json({ success: true, ...saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save type definitions" });
  }
});
function countAssetsForEmployee(assets, emp) {
  const eid = normalizeEmployeeId2(emp.employeeId);
  const email = normalizeEmail3(emp.email);
  const name = String(emp.name || "").trim().toLowerCase();
  return assets.filter((a) => {
    const assetEid = normalizeEmployeeId2(a.employeeId);
    if (assetEid) {
      return assetEid === eid;
    }
    if (email && normalizeEmail3(a.contactEmail) === email) return true;
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
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (user && !isItAdminRole2(user.role)) {
      list = list.filter((emp) => userCanAccessEmployee(user, emp, settingsPlants));
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load employees" });
  }
});
app.get("/api/employees/lookup", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId || "").trim();
    const email = String(req.query.email || "").trim();
    let list = readEmployees();
    let employee = employeeId ? findEmployeeById(list, employeeId) : email ? findEmployeeByEmail(list, email) : null;
    if (!employee && (GAS_WEBAPP_URL || SPREADSHEET_ID) && list.length === 0) {
      try {
        list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
        employee = employeeId ? findEmployeeById(list, employeeId) : email ? findEmployeeByEmail(list, email) : null;
      } catch {
      }
    }
    if (!employee) {
      return res.json({ employee: null, assetCount: 0 });
    }
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessEmployee(user, employee, settingsPlants)) {
      return res.status(403).json({ error: "Access Denied: You do not have access to this employee." });
    }
    let assetCount = 0;
    try {
      const cached = getCachedAssets();
      if (cached) {
        assetCount = countAssetsForEmployee(cached, employee);
      }
    } catch {
    }
    res.json({ employee, assetCount });
  } catch (error) {
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
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessEmployee(user, employee, settingsPlants)) {
      return res.status(403).json({ error: "Access Denied: You do not have access to this employee." });
    }
    res.json({ employee });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load employee" });
  }
});
app.get("/api/employees/:employeeId/history", async (req, res) => {
  try {
    const eid = decodeURIComponent(req.params.employeeId);
    let list = readEmployees();
    let employee = findEmployeeById(list, eid);
    if (!employee && (GAS_WEBAPP_URL || SPREADSHEET_ID)) {
      list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
      employee = findEmployeeById(list, eid);
    }
    if (employee) {
      const user = resolveRequestUser(req);
      const settingsPlants = maintenanceSettingsPlants();
      if (!userCanAccessEmployee(user, employee, settingsPlants)) {
        return res.status(403).json({ error: "Access Denied: You do not have access to this employee history." });
      }
    }
    if (req.query.refresh === "1" && GAS_WEBAPP_URL) {
      await fetchHistoryFromGas(proxyToGas);
    }
    res.json({ history: normalizeHistoryForUi(getHistoryByEmployeeId(eid)) });
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load history" });
  }
});
app.delete("/api/assignment-history/:id", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole2(user.role)) {
      return res.status(403).json({ error: "Only IT Admin can delete assignment history." });
    }
    const historyId = decodeURIComponent(req.params.id).trim();
    const existsLocal = readAssignmentHistory().some((h) => String(h.id || "").trim() === historyId);
    let sheetWarning;
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
          sheetWarning = "Record was not in the database; removed from app only.";
        } else if (!existsLocal) {
          return res.status(remote.notFound ? 404 : 500).json({
            error: remote.error || "Failed to delete from Database"
          });
        } else {
          sheetWarning = remote.error || "Could not delete from Database";
        }
      }
    }
    const removed = deleteAssignmentHistoryEntry(historyId);
    if (!removed && !existsLocal) {
      return res.status(404).json({ error: "Assignment history record not found" });
    }
    res.json({ success: true, sheetWarning });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete assignment history" });
  }
});
app.post("/api/employees", async (req, res) => {
  try {
    const body = req.body;
    body.phone = String(body.phone || "").replace(/\D/g, "").slice(0, 10);
    const validationError = validateEmployeePayload(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessEmployee(user, body, settingsPlants)) {
      return res.status(403).json({
        error: `Access Denied: You are not authorized to create employees for location "${body.location}" / plant "${body.plant}".`
      });
    }
    const list = await loadEmployeesWithSheetSync();
    const existing = findEmployeeById(list, body.employeeId);
    if (existing) {
      return res.json({ success: true, employee: existing, alreadyExists: true });
    }
    const saved = createEmployee(body);
    let sheetWarning;
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
  } catch (error) {
    const message = error.message || "Failed to save employee";
    const status = message === EMPLOYEE_ID_EXISTS_MESSAGE || isEmployeeIdExistsError(message) ? 409 : 400;
    res.status(status).json({ error: isEmployeeIdExistsError(message) ? EMPLOYEE_ID_EXISTS_MESSAGE : message });
  }
});
app.put("/api/employees/:employeeId", async (req, res) => {
  try {
    const body = { ...req.body, employeeId: decodeURIComponent(req.params.employeeId) };
    body.phone = String(body.phone || "").replace(/\D/g, "").slice(0, 10);
    const validationError = validateEmployeePayload(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    let list = readEmployees();
    if (GAS_WEBAPP_URL || SPREADSHEET_ID || shouldRefreshSheetBackedData(false, list.length)) {
      list = await fetchEmployeesFromGas(proxyToGas, SPREADSHEET_ID);
    }
    const current = findEmployeeById(list, body.employeeId);
    if (!current) {
      return res.status(404).json({ error: "Employee not found" });
    }
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessEmployee(user, current, settingsPlants) || !userCanAccessEmployee(user, body, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to update employees for this location / plant."
      });
    }
    const beforeUpdate = readEmployees();
    const saved = updateEmployee(body);
    let sheetWarning;
    if (GAS_WEBAPP_URL || SPREADSHEET_ID) {
      const gas = await persistEmployeeToGas("update", saved, proxyToGas, SPREADSHEET_ID);
      if (!gas.ok) {
        writeEmployees(beforeUpdate);
        return res.status(502).json({ error: gas.error || "Database sync failed; employee update was reverted locally." });
      }
    }
    res.json({ success: true, employee: saved, sheetWarning });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to update employee" });
  }
});
app.delete("/api/employees/:employeeId", async (req, res) => {
  try {
    const requestUser = resolveRequestUser(req);
    const actorRole = requestUser?.role || req.authUser?.role || "";
    if (!requestUser && !req.authUser) {
      return res.status(403).json({ error: "Authentication required." });
    }
    if (!isItAdminRole2(actorRole)) {
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
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load inventory" });
  }
});
app.post("/api/inventory", async (req, res) => {
  try {
    const previousInventory = readInventory();
    const body = req.body;
    if (!String(body.itemName || "").trim()) {
      return res.status(400).json({ error: "Item Name is required" });
    }
    const saved = upsertInventoryItem(body);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true, item: saved });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to save inventory item" });
  }
});
app.put("/api/inventory/:itemId", async (req, res) => {
  try {
    const previousInventory = readInventory();
    const body = { ...req.body, itemId: decodeURIComponent(req.params.itemId) };
    const saved = upsertInventoryItem(body);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistInventoryToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true, item: saved });
  } catch (error) {
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
          minStock: 0
        },
        proxyToGas
      );
      assertSheetSyncOk(gas, () => writeInventory(previousInventory));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete inventory item" });
  }
});
app.post("/api/inventory/:itemId/assign", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const { employeeId, employeeName, employeeEmail, employeeMobile, department, location, updatedBy } = req.body;
    if (!employeeId) return res.status(400).json({ error: "Employee ID is required" });
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find((i) => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });
    if (item.status !== "Available") {
      return res.status(400).json({ error: "Only Available inventory items can be assigned" });
    }
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);
    if (parentAsset) {
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
        updatedDate: (/* @__PURE__ */ new Date()).toISOString()
      };
      const dbMode = readAppData().settings.dbMode;
      let result;
      if (isDbMode() || dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, String(parentAsset.id), String(parentAsset.qrCodeText ?? ""));
        result = await proxyToGas({ action: "update_asset_redesigned", id: parentAsset.id, row });
        const masterHeaders = getDefaultAssetHeaders();
        const sqliteRow = buildMasterAssetRow(assetData);
        await updateAssetLocal(String(parentAsset.mainCategory || "IT Assets"), String(parentAsset.id), sqliteRow, masterHeaders);
      } else {
        const sheet = await fetchSheetData();
        const sheetHeaders = sheet[0];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex(
          (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex(
          (row) => String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId || parentAsset.assetCode && String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === String(parentAsset.assetCode).replace(/^0+/, "").trim()
        );
        if (rowIndex === -1) throw new Error("Asset not found in Database");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
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
        "QR Code / Barcode": parentAsset.qrCodeText
      });
      upsertAssetInCache(updatedAsset);
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: parentAsset.employeeId || "",
          contactName: parentAsset.contactName || "",
          contactEmail: parentAsset.contactEmail || "",
          status: parentAsset.status || ""
        },
        next: {
          employeeId,
          contactName: employeeName,
          contactEmail: employeeEmail,
          status: "Assigned"
        },
        assignedBy: updatedBy || "System"
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }
      res.json({ success: true, message: "Asset assigned successfully" });
    } else {
      const availableQuantity = item.quantity;
      if (availableQuantity <= 0) return res.status(400).json({ error: "Item is out of stock" });
      if (availableQuantity === 1) {
        const updatedItem = {
          ...item,
          status: "Assigned",
          employeeId,
          assigneeName: employeeName,
          assigneeEmail: employeeEmail,
          assigneeMobile: employeeMobile || "",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        upsertInventoryItem(updatedItem);
      } else {
        const updatedAvailable = {
          ...item,
          quantity: availableQuantity - 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
          status: "Assigned",
          quantity: 1,
          minStock: 0,
          employeeId,
          assigneeName: employeeName,
          assigneeEmail: employeeEmail,
          assigneeMobile: employeeMobile || "",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        upsertInventoryItem(assignedItem);
      }
      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory assignment was not saved locally."
      );
      res.json({ success: true, message: "Inventory item assigned successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to assign item" });
  }
});
app.post("/api/inventory/:itemId/return", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const remarks = req.body.remarks || "Asset returned / unassigned";
    const updatedBy = req.body.updatedBy || "System";
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find((i) => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);
    if (parentAsset) {
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
        updatedDate: (/* @__PURE__ */ new Date()).toISOString()
      };
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
        const sheetHeaders = sheet[0];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex(
          (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex(
          (row) => String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId
        );
        if (rowIndex === -1) throw new Error("Asset not found in Database");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
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
        "QR Code / Barcode": parentAsset.qrCodeText
      });
      upsertAssetInCache(updatedAsset);
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: parentAsset.employeeId || "",
          contactName: parentAsset.contactName || "",
          contactEmail: parentAsset.contactEmail || "",
          status: parentAsset.status || ""
        },
        next: {
          employeeId: "",
          contactName: "",
          contactEmail: "",
          status: "Available"
        },
        assignedBy: updatedBy,
        remarks
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }
      res.json({ success: true, message: "Asset returned successfully" });
    } else {
      const match = list.find(
        (i) => i.itemName.toLowerCase() === item.itemName.toLowerCase() && i.brandName.toLowerCase() === item.brandName.toLowerCase() && i.model.toLowerCase() === item.model.toLowerCase() && i.status === "Available"
      );
      if (match) {
        const updatedAvailable = {
          ...match,
          quantity: match.quantity + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        upsertInventoryItem(updatedAvailable);
        if (item.quantity <= 1) {
          deleteInventoryItem(item.itemId);
        } else {
          const updatedAssigned = {
            ...item,
            quantity: item.quantity - 1,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          upsertInventoryItem(updatedAssigned);
        }
      } else {
        const updatedItem = {
          ...item,
          status: "Available",
          employeeId: "",
          assigneeName: "",
          assigneeEmail: "",
          assigneeMobile: "",
          quantity: 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        upsertInventoryItem(updatedItem);
      }
      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory return was not saved locally."
      );
      res.json({ success: true, message: "Inventory item returned successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to return item" });
  }
});
app.post("/api/inventory/:itemId/transfer", async (req, res) => {
  try {
    const itemId = decodeURIComponent(req.params.itemId);
    const { targetEmployeeId, remarks, updatedBy } = req.body;
    if (!targetEmployeeId) return res.status(400).json({ error: "Target Employee ID is required" });
    const employees = readEmployees();
    const targetEmp = employees.find((e) => String(e.employeeId).trim() === String(targetEmployeeId).trim());
    if (!targetEmp) return res.status(404).json({ error: "Target employee not found" });
    const previousInventory = readInventory();
    const list = previousInventory;
    const item = list.find((i) => i.itemId === itemId);
    if (!item) return res.status(404).json({ error: "Inventory item not found" });
    if (item.status !== "Assigned") {
      return res.status(400).json({ error: "Only Assigned items can be transferred" });
    }
    const sourceEmployeeId = item.employeeId;
    const assets = await getAssetsForOps();
    const parentAsset = findMappedAssetByAnyId(assets, itemId) || findMappedAssetByAnyId(assets, item.assetCode);
    if (parentAsset) {
      const assetData = {
        ...parentAsset,
        status: "Assigned",
        employeeId: targetEmp.employeeId,
        contactName: targetEmp.name,
        contactEmail: targetEmp.email,
        contactMobile: targetEmp.phone || "",
        department: targetEmp.department || "",
        updatedBy: updatedBy || "System",
        updatedDate: (/* @__PURE__ */ new Date()).toISOString()
      };
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
        const sheetHeaders = sheet[0];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex(
          (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const targetId = String(parentAsset.id).replace(/^0+/, "").trim();
        const rowIndex = rows.findIndex(
          (row) => String(row[idCol !== -1 ? idCol : 0]).replace(/^0+/, "").trim() === targetId
        );
        if (rowIndex === -1) throw new Error("Asset not found in Database");
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
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
        "QR Code / Barcode": parentAsset.qrCodeText
      });
      upsertAssetInCache(updatedAsset);
      const hist = recordAssignmentChange({
        assetId: String(parentAsset.id),
        previous: {
          employeeId: sourceEmployeeId,
          contactName: item.assigneeName,
          contactEmail: item.assigneeEmail,
          status: "Assigned"
        },
        next: {
          employeeId: targetEmp.employeeId,
          contactName: targetEmp.name,
          contactEmail: targetEmp.email,
          status: "Assigned"
        },
        assignedBy: updatedBy || "System",
        remarks: remarks || `Transferred from employee ${sourceEmployeeId} to ${targetEmp.employeeId}`
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }
      res.json({ success: true, message: "Asset transferred successfully" });
    } else {
      const updatedItem = {
        ...item,
        employeeId: targetEmp.employeeId,
        assigneeName: targetEmp.name,
        assigneeEmail: targetEmp.email,
        assigneeMobile: targetEmp.phone || "",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      upsertInventoryItem(updatedItem);
      await assertInventorySnapshotSynced(
        previousInventory,
        "Database sync failed; inventory transfer was not saved locally."
      );
      res.json({ success: true, message: "Inventory item transferred successfully" });
    }
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save type definitions" });
  }
});
async function assertAssetUnique(assetData, excludeId) {
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
    const result = await proxyToGas({ action: "setup" }, 12e4);
    invalidateAssetCache();
    invalidateUsersCache();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/setup/redesigned", async (req, res) => {
  invalidateAssetCache();
  invalidateUsersCache();
  res.json({
    success: true,
    message: "Use a fresh spreadsheet with headers from gas/NEW_SHEET_ROW1_HEADERS.txt"
  });
});
app.post("/api/setup/redesigned-fresh", async (req, res) => {
  invalidateAssetCache();
  invalidateUsersCache();
  res.json({
    success: true,
    message: "Fresh sheet: paste WebApp.gs, set GAS_WEBAPP_URL and SPREADSHEET_ID in .env"
  });
});
function getMissingItemMainCategory(assetType) {
  if (!assetType) return "IT Assets";
  const itTypes = ["Laptop", "Desktop", ...PERIPHERAL_TYPES];
  if (itTypes.includes(assetType)) {
    return "IT Assets";
  }
  if (SUB_TO_MAIN_MAP[assetType]) {
    return SUB_TO_MAIN_MAP[assetType];
  }
  const itSub = subCategoryForItAssetType(assetType);
  if (SUB_TO_MAIN_MAP[itSub]) {
    return SUB_TO_MAIN_MAP[itSub];
  }
  return "IT Assets";
}
function assertSheetSyncOk(result, rollback, fallbackMessage = "Database sync failed") {
  if (result.ok) return;
  rollback();
  throw new Error(result.error || fallbackMessage);
}
async function assertInventorySnapshotSynced(previousInventory, fallbackMessage) {
  if (!GAS_WEBAPP_URL) return;
  const gas = await replaceInventoryInGas(readInventory(), proxyToGas);
  assertSheetSyncOk(gas, () => writeInventory(previousInventory), fallbackMessage);
}
function normalizeAssetLookupId(value) {
  const s = String(value ?? "").trim();
  const n = parseInt(s, 10);
  const withoutLeadingZeroes = s.replace(/^0+/, "") || "0";
  if (!Number.isNaN(n) && (String(n) === withoutLeadingZeroes || String(n) === s)) {
    return String(n);
  }
  return s.toLowerCase();
}
function findMappedAssetByAnyId(assets, lookupId) {
  if (lookupId == null) return void 0;
  const rawTarget = String(lookupId).trim();
  const target = normalizeAssetLookupId(lookupId);
  if (!rawTarget && !target) return void 0;
  return assets.find((asset) => {
    if (String(asset.id ?? "").trim() === rawTarget) return true;
    if (String(asset.assetCode ?? "").trim() === rawTarget) return true;
    if (String(asset.serialNumber ?? "").trim() === rawTarget) return true;
    return [
      asset.id,
      asset.assetCode,
      asset.uniqueCode,
      asset.serialNumber,
      getCanonicalScanId(asset)
    ].some((candidate) => normalizeAssetLookupId(candidate) === target);
  });
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
    const updatedMissing = {
      ...existing,
      Status: "Deassigned",
      Remarks: String(existing.Remarks || "") + " (Deassigned to stock inventory)"
    };
    const savedMissing = upsertMissingItem(updatedMissing);
    const inventoryList = readInventory();
    const name = existing["Missing Item Name"];
    const brand = existing.Brand || "";
    const model = existing.Model || "";
    const category = getMissingItemMainCategory(existing["Asset Type"] || name);
    const match = inventoryList.find(
      (item) => item.itemName.toLowerCase() === name.toLowerCase() && item.brandName.toLowerCase() === brand.toLowerCase() && item.model.toLowerCase() === model.toLowerCase() && item.status === "Available"
    );
    let savedInventory;
    let inventoryOp = "add";
    if (match) {
      savedInventory = upsertInventoryItem({
        ...match,
        quantity: match.quantity + 1
      });
      inventoryOp = "update";
    } else {
      savedInventory = upsertInventoryItem({
        itemId: "INV_" + Date.now(),
        assetCode: "",
        itemName: name,
        brandName: brand,
        model,
        serialNumber: "",
        category,
        status: "Available",
        quantity: 1,
        minStock: 0
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
  } catch (error) {
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
    const employees = readEmployees();
    const emp = employees.find((e) => String(e.employeeId).trim() === employeeId);
    if (!emp) return res.status(404).json({ error: `Employee not found with ID: ${employeeId}` });
    const updatedMissing = {
      ...existing,
      Status: "Reassigned",
      "Employee ID": emp.employeeId,
      "Assigned Person": emp.name,
      Remarks: String(existing.Remarks || "") + ` (Reassigned to ${emp.name} [${emp.employeeId}])`
    };
    const savedMissing = upsertMissingItem(updatedMissing);
    const name = existing["Missing Item Name"];
    const brand = existing.Brand || "";
    const model = existing.Model || "";
    const category = getMissingItemMainCategory(existing["Asset Type"] || name);
    const savedInventory = upsertInventoryItem({
      itemId: "INV_" + Date.now(),
      assetCode: "",
      itemName: name,
      brandName: brand,
      model,
      serialNumber: "",
      category,
      status: "Assigned",
      quantity: 1,
      minStock: 0,
      employeeId: emp.employeeId,
      assigneeName: emp.name,
      assigneeEmail: emp.email,
      assigneeMobile: emp.phone || ""
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
  } catch (error) {
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
    const user = resolveRequestUser(req);
    if (user && !isItAdminRole2(user.role)) {
      const uLocs = (user.locations || []).map((l) => l.trim().toLowerCase()).filter((l) => l && l !== "all");
      const uPlants = (user.plants || []).map((p) => p.trim().toLowerCase()).filter((p) => p && p !== "all");
      const hasAllLocs = (user.locations || []).some((l) => l.trim().toLowerCase() === "all");
      const hasAllPlants = (user.plants || []).some((p) => p.trim().toLowerCase() === "all");
      if (!hasAllLocs && uLocs.length === 0 && !hasAllPlants && uPlants.length === 0) {
        return res.json({ items: [] });
      }
      items = items.filter((item) => {
        const itemLoc = String(item.Location || "").trim().toLowerCase();
        const itemPlant = String(item["Plant Code"] || item.Plant || "").trim().toLowerCase();
        const matchLoc = hasAllLocs || uLocs.length === 0 || uLocs.some((l) => itemLoc === l || itemLoc.includes(l) || l.includes(itemLoc));
        const matchPlant = hasAllPlants || uPlants.length === 0 || uPlants.some((p) => itemPlant === p || itemPlant.includes(p) || p.includes(itemPlant));
        if (uLocs.length > 0 && uPlants.length > 0 && !hasAllLocs && !hasAllPlants) {
          return matchLoc && matchPlant;
        }
        return matchLoc || matchPlant;
      });
    }
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load missing items" });
  }
});
app.post("/api/missing-items", async (req, res) => {
  try {
    const previousMissingItems = readMissingItems();
    const body = req.body;
    const raw = body.item || {};
    const assetType = String(raw["Asset Type"] || "").trim();
    const item = {
      ...raw,
      "Missing Item Name": String(raw["Missing Item Name"] || "").trim() || assetType,
      "Asset Type": assetType || String(raw["Missing Item Name"] || "").trim(),
      "Parent Asset ID": String(raw["Parent Asset ID"] || "").trim()
    };
    const saved = upsertMissingItem(item);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeMissingItems(previousMissingItems));
    }
    if (item["Parent Asset ID"]) {
      const assetStatus = item.Status === "Recovered" ? "Available" : "Lost";
      void syncAssetStatusUpdate(item["Parent Asset ID"], assetStatus, "System");
    }
    res.json({ success: true, item: saved });
  } catch (error) {
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
      "Recovered Date": (/* @__PURE__ */ new Date()).toISOString(),
      "Recovered By": String(req.body?.recoveredBy || "System")
    });
    if (GAS_WEBAPP_URL) {
      const gas = await persistMissingItemToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeMissingItems(previousMissingItems));
    }
    if (existing["Parent Asset ID"]) {
      void syncAssetStatusUpdate(existing["Parent Asset ID"], "Available", String(req.body?.recoveredBy || "System"));
    }
    res.json({ success: true, item: saved });
  } catch (error) {
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
    if (existing["Parent Asset ID"]) {
      void syncAssetStatusUpdate(existing["Parent Asset ID"], "Available", user.email);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to delete" });
  }
});
async function syncAssetStatusUpdate(assetId, status, updatedBy = "System") {
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
      status,
      updatedBy,
      updatedDate: (/* @__PURE__ */ new Date()).toISOString()
    };
    const dbMode = readAppData().settings.dbMode;
    let result;
    if (isDbMode() || dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, canonicalAssetId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalAssetId, row });
      const masterHeaders = getDefaultAssetHeaders();
      const sqliteRow = buildMasterAssetRow(assetData);
      await updateAssetLocal(String(assetData.mainCategory || "IT Assets"), canonicalAssetId, sqliteRow, masterHeaders);
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) throw new Error("Sheet has no data");
      const sheetHeaders = sheet[0];
      const rows = sheet.slice(1);
      const idCol = sheetHeaders.findIndex(
        (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(canonicalAssetId);
      const rowIndex = rows.findIndex(
        (row) => normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId || existing.assetCode && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.assetCode) || existing.serialNumber && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.serialNumber)
      );
      if (rowIndex === -1) throw new Error("Asset not found in Database");
      const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
      const updatedRow = buildMasterAssetRow(assetData, existingMaster);
      const masterHeaders = getDefaultAssetHeaders();
      result = await proxyToGas({ action: "update", id: canonicalAssetId, row: updatedRow, rowIndex: rowIndex + 2 });
      await updateAssetLocal(String(assetData.mainCategory || "IT Assets"), canonicalAssetId, updatedRow, masterHeaders);
    }
    if (result.error) throw new Error(result.error);
    const updatedAsset = mapSheetRow({
      ...assetData,
      id: canonicalAssetId,
      "S No": canonicalAssetId,
      "Asset ID": canonicalAssetId,
      "QR Code / Barcode": assetData.qrCodeText
    });
    upsertAssetInCache(updatedAsset);
    console.log(`[AMS] Dynamic status update for asset ${canonicalAssetId} to ${status} completed successfully.`);
  } catch (err) {
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
    const user = resolveRequestUser(req);
    if (user && !isItAdminRole2(user.role)) {
      const uLocs = (user.locations || []).map((l) => l.trim().toLowerCase()).filter((l) => l && l !== "all");
      const uPlants = (user.plants || []).map((p) => p.trim().toLowerCase()).filter((p) => p && p !== "all");
      const hasAllLocs = (user.locations || []).some((l) => l.trim().toLowerCase() === "all");
      const hasAllPlants = (user.plants || []).some((p) => p.trim().toLowerCase() === "all");
      if (!hasAllLocs && uLocs.length === 0 && !hasAllPlants && uPlants.length === 0) {
        return res.json({ items: [] });
      }
      items = items.filter((item) => {
        const itemLoc = String(item.Location || "").trim().toLowerCase();
        const itemPlant = String(item["Plant Code"] || item.Plant || "").trim().toLowerCase();
        const matchLoc = hasAllLocs || uLocs.length === 0 || uLocs.some((l) => itemLoc === l || itemLoc.includes(l) || l.includes(itemLoc));
        const matchPlant = hasAllPlants || uPlants.length === 0 || uPlants.some((p) => itemPlant === p || itemPlant.includes(p) || p.includes(itemPlant));
        if (uLocs.length > 0 && uPlants.length > 0 && !hasAllLocs && !hasAllPlants) {
          return matchLoc && matchPlant;
        }
        return matchLoc || matchPlant;
      });
    }
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load damaged items" });
  }
});
function maintenanceSettingsPlants() {
  const cached = readCacheStale("locations_plants");
  if (cached?.plants && Array.isArray(cached.plants) && cached.plants.length > 0) {
    return cached.plants;
  }
  return readAppData().settings?.plants || [];
}
function maintenancePlantName(plantCode) {
  return plantShortName(plantCode, maintenanceSettingsPlants());
}
app.get("/api/maintenance/machines", async (req, res) => {
  try {
    const rawMachines = await listMaintenanceMachines();
    const meta = await getMaintenanceMeta();
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    const machines = user && !isItAdminRole2(user.role) ? rawMachines.filter((m) => userCanAccessPlantLocation(user, m.location, m.plantCode, settingsPlants)) : rawMachines;
    res.json({ machines, machineTypes: meta.machineTypes, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load machines" });
  }
});
app.get("/api/maintenance/machines/next-code", async (_req, res) => {
  try {
    const machines = await listMaintenanceMachines();
    res.json({ code: nextMaintenanceAssetCode(machines) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to generate code" });
  }
});
app.get("/api/maintenance/scan/:assetCode", async (req, res) => {
  try {
    const code = String(req.params.assetCode || "").trim();
    const machine = await getMaintenanceMachineByAssetCode(code);
    if (!machine) return res.status(404).json({ error: "Machine not found for this QR / asset code" });
    res.json({
      machine: {
        id: machine.id,
        assetCode: machine.assetCode,
        machineType: machine.machineType,
        machineNumber: machine.machineNumber,
        equipmentName: machine.equipmentName,
        department: machine.department,
        responsibility: machine.responsibility,
        location: machine.location,
        plantCode: machine.plantCode,
        plantName: maintenancePlantName(machine.plantCode),
        nextMaintenanceDate: machine.nextMaintenanceDate,
        status: machine.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load machine" });
  }
});
app.post("/api/maintenance/machines", async (req, res) => {
  try {
    const body = req.body || {};
    const machineType = String(body.machineType || "").trim();
    const machineNumber = normalizeMachineNumber(String(body.machineNumber || ""));
    const location = String(body.location || "").trim();
    const plantCode = String(body.plantCode || "").trim();
    const nextMaintenanceDate = String(body.nextMaintenanceDate || "").trim();
    if (!machineType) return res.status(400).json({ error: "Machine type is required" });
    if (!machineNumber) return res.status(400).json({ error: "Machine number is required" });
    if (!location) return res.status(400).json({ error: "Location is required" });
    if (!plantCode) return res.status(400).json({ error: "Plant is required" });
    if (!nextMaintenanceDate) return res.status(400).json({ error: "Maintenance date is required" });
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, location, plantCode, settingsPlants)) {
      return res.status(403).json({
        error: `Access Denied: You are not authorized to create machines for location "${location}" / plant "${plantCode}".`
      });
    }
    const existing = await listMaintenanceMachines();
    const duplicate = existing.find(
      (m) => m.machineType.toLowerCase() === machineType.toLowerCase() && normalizeMachineNumber(m.machineNumber) === machineNumber && String(m.plantCode || "").toLowerCase() === plantCode.toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({
        error: `Machine ${machineNumber} (${machineType}) already exists for plant ${plantCode}`
      });
    }
    await addMachineType(machineType);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const actor = String(req.authUser?.email || body.createdBy || "System");
    const trendMonths = normalizeTrendMonths(body.trendMonths);
    const merged = isCustomTrend(trendMonths) ? mergeCustomPlan(nextMaintenanceDate, body.customPlanDates) : { nextMaintenanceDate, customPlanDates: [] };
    const equipmentName = String(body.equipmentName || "").trim() || void 0;
    const modelNumber = String(body.modelNumber || "").trim();
    const serialNumber = String(body.serialNumber || "").trim();
    if (!serialNumber) {
      return res.status(400).json({ error: "Serial Number is required." });
    }
    if (!modelNumber) {
      return res.status(400).json({ error: "Model Number is required." });
    }
    const duplicateSerial = existing.find(
      (m) => String(m.serialNumber || "").trim().toLowerCase() === serialNumber.toLowerCase() && String(m.plantCode || "").trim().toLowerCase() === plantCode.toLowerCase()
    );
    if (duplicateSerial) {
      return res.status(400).json({
        error: `Serial Number "${serialNumber}" is already registered to machine ${duplicateSerial.assetCode} in plant ${plantCode}.`
      });
    }
    const department = String(body.department || "").trim() || void 0;
    const responsibility = String(body.responsibility || "").trim() || void 0;
    const warrantyRaw = String(body.warrantyStatus || "").trim().toLowerCase().replace(/\s+/g, "_");
    const warrantyStatus = warrantyRaw === "in_warranty" || warrantyRaw === "out_of_warranty" ? warrantyRaw : void 0;
    if (!warrantyStatus) {
      return res.status(400).json({ error: "Select In Warranty or Out of Warranty" });
    }
    const warrantyExpiryDate = warrantyStatus === "in_warranty" ? String(body.warrantyExpiryDate || "").trim() || void 0 : void 0;
    const machine = {
      id: `mach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      machineType,
      machineNumber,
      assetCode: nextMaintenanceAssetCode(existing),
      equipmentName,
      modelNumber,
      serialNumber,
      department,
      responsibility,
      location,
      plantCode,
      warrantyStatus,
      warrantyExpiryDate,
      trendMonths,
      customPlanDates: merged.customPlanDates.length ? merged.customPlanDates : void 0,
      nextMaintenanceDate: merged.nextMaintenanceDate,
      lastMaintenanceDate: String(body.lastMaintenanceDate || "").trim() || void 0,
      status: "Active",
      remarks: String(body.remarks || "").trim() || void 0,
      createdBy: actor,
      createdAt: now,
      updatedBy: actor,
      updatedAt: now
    };
    const saved = await upsertMaintenanceMachine(machine);
    res.json({ success: true, machine: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save machine" });
  }
});
app.put("/api/maintenance/machines/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceMachine(id);
    if (!current) return res.status(404).json({ error: "Machine not found" });
    const body = req.body || {};
    const machineType = String(body.machineType || current.machineType).trim();
    const machineNumber = normalizeMachineNumber(String(body.machineNumber || current.machineNumber));
    const location = String(body.location || current.location).trim();
    const plantCode = String(body.plantCode || current.plantCode).trim();
    const nextMaintenanceDate = String(body.nextMaintenanceDate || current.nextMaintenanceDate).trim();
    if (!machineType || !machineNumber || !location || !plantCode || !nextMaintenanceDate) {
      return res.status(400).json({ error: "Type, number, location, plant and maintenance date are required" });
    }
    const modelNumber = body.modelNumber !== void 0 ? String(body.modelNumber || "").trim() : String(current.modelNumber || "").trim();
    const serialNumber = body.serialNumber !== void 0 ? String(body.serialNumber || "").trim() : String(current.serialNumber || "").trim();
    if (!serialNumber) {
      return res.status(400).json({ error: "Serial Number is required." });
    }
    if (!modelNumber) {
      return res.status(400).json({ error: "Model Number is required." });
    }
    const allMachines = await listMaintenanceMachines();
    const duplicateSerial = allMachines.find(
      (m) => m.id !== id && String(m.serialNumber || "").trim().toLowerCase() === serialNumber.toLowerCase() && String(m.plantCode || "").trim().toLowerCase() === plantCode.toLowerCase()
    );
    if (duplicateSerial) {
      return res.status(400).json({
        error: `Serial Number "${serialNumber}" is already registered to machine ${duplicateSerial.assetCode} in plant ${plantCode}.`
      });
    }
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants) || !userCanAccessPlantLocation(user, location, plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to update machines in this location / plant."
      });
    }
    if (machineType) await addMachineType(machineType);
    const actor = String(req.authUser?.email || body.updatedBy || "System");
    const trendMonths = body.trendMonths !== void 0 ? normalizeTrendMonths(body.trendMonths) : machineTrendMonths(current);
    const merged = isCustomTrend(trendMonths) ? mergeCustomPlan(
      nextMaintenanceDate,
      body.customPlanDates !== void 0 ? body.customPlanDates : current.customPlanDates
    ) : { nextMaintenanceDate, customPlanDates: [] };
    const updated = {
      ...current,
      assetCode: current.assetCode,
      machineType,
      machineNumber,
      equipmentName: body.equipmentName !== void 0 ? String(body.equipmentName || "").trim() || void 0 : current.equipmentName,
      modelNumber,
      serialNumber,
      department: body.department !== void 0 ? String(body.department || "").trim() || void 0 : current.department,
      responsibility: body.responsibility !== void 0 ? String(body.responsibility || "").trim() || void 0 : current.responsibility,
      location,
      plantCode,
      warrantyStatus: body.warrantyStatus !== void 0 ? (() => {
        const raw = String(body.warrantyStatus || "").trim().toLowerCase().replace(/\s+/g, "_");
        return raw === "in_warranty" || raw === "out_of_warranty" ? raw : current.warrantyStatus;
      })() : current.warrantyStatus,
      warrantyExpiryDate: (() => {
        const effStatus = body.warrantyStatus !== void 0 ? (() => {
          const raw = String(body.warrantyStatus || "").trim().toLowerCase().replace(/\s+/g, "_");
          return raw === "in_warranty" || raw === "out_of_warranty" ? raw : current.warrantyStatus;
        })() : current.warrantyStatus;
        if (effStatus === "out_of_warranty") return void 0;
        if (body.warrantyExpiryDate !== void 0) {
          return String(body.warrantyExpiryDate || "").trim() || void 0;
        }
        return current.warrantyExpiryDate;
      })(),
      trendMonths,
      customPlanDates: merged.customPlanDates.length ? merged.customPlanDates : void 0,
      nextMaintenanceDate: merged.nextMaintenanceDate,
      lastMaintenanceDate: body.lastMaintenanceDate !== void 0 ? String(body.lastMaintenanceDate || "").trim() || void 0 : current.lastMaintenanceDate,
      status: body.status || current.status,
      remarks: body.remarks !== void 0 ? String(body.remarks || "").trim() || void 0 : current.remarks,
      updatedBy: actor,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await upsertMaintenanceMachine(updated);
    res.json({ success: true, machine: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update machine" });
  }
});
app.patch("/api/maintenance/machines/:id/trend", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceMachine(id);
    if (!current) return res.status(404).json({ error: "Machine not found" });
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to modify machine trend for this plant."
      });
    }
    const newTrend = normalizeTrendMonths(req.body?.trendMonths, -1);
    if (newTrend < 0) {
      return res.status(400).json({ error: "Trend must be Custom or 1\u201324 months" });
    }
    const previousTrend = machineTrendMonths(current);
    if (newTrend === previousTrend) {
      return res.json({ success: true, machine: current, mail: { ok: false, skipped: true } });
    }
    const actor = String(req.authUser?.email || req.body?.updatedBy || "System");
    const nextMaintenanceDate = isCustomTrend(newTrend) ? String(current.nextMaintenanceDate || "").trim() : nextDateForTrend(current, newTrend);
    const mergedCustom = isCustomTrend(newTrend) ? mergeCustomPlan(current.nextMaintenanceDate, current.customPlanDates) : null;
    const updated = {
      ...current,
      trendMonths: newTrend,
      customPlanDates: mergedCustom?.customPlanDates.length ? mergedCustom.customPlanDates : void 0,
      nextMaintenanceDate: mergedCustom?.nextMaintenanceDate ?? nextMaintenanceDate,
      lastReminderEmailOn: void 0,
      lastEscalationEmailOn: void 0,
      lastDailyEmailOn: void 0,
      lastMailSlot: void 0,
      reminderCount: 0,
      updatedBy: actor,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await upsertMaintenanceMachine(updated);
    const meta = await getMaintenanceMeta();
    const to = getPlantMaintenanceEmails(meta.plantContacts, saved.plantCode);
    let mail = {
      ok: false,
      skipped: to.length === 0
    };
    if (to.length) {
      const payload = buildTrendChangeEmail({
        ...pickMailIdentity(saved),
        previousTrendMonths: previousTrend,
        newTrendMonths: newTrend,
        nextMaintenanceDate: saved.nextMaintenanceDate,
        changedBy: actor
      });
      mail = await sendMaintenanceMail({ to, ...payload });
    }
    res.json({ success: true, machine: saved, mail });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update trend" });
  }
});
app.patch("/api/maintenance/machines/:id/next-date", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceMachine(id);
    if (!current) return res.status(404).json({ error: "Machine not found" });
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to update next maintenance date for this plant."
      });
    }
    const nextMaintenanceDate = String(req.body?.nextMaintenanceDate || "").trim();
    if (!nextMaintenanceDate) {
      return res.status(400).json({ error: "Next maintenance date is required" });
    }
    const parsed = new Date(nextMaintenanceDate.includes("T") ? nextMaintenanceDate : `${nextMaintenanceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "Enter a valid date (YYYY-MM-DD)" });
    }
    if (nextMaintenanceDate === String(current.nextMaintenanceDate || "").trim().slice(0, 10)) {
      return res.json({ success: true, machine: current });
    }
    const actor = String(req.authUser?.email || req.body?.updatedBy || "System");
    const oldNext = String(current.nextMaintenanceDate || "").trim().slice(0, 10);
    const custom = isCustomTrend(machineTrendMonths(current));
    const mergedCustom = custom ? mergeCustomPlan(nextMaintenanceDate, [oldNext, ...current.customPlanDates || []]) : null;
    const updated = {
      ...current,
      nextMaintenanceDate: mergedCustom?.nextMaintenanceDate ?? nextMaintenanceDate,
      customPlanDates: mergedCustom ? mergedCustom.customPlanDates.length ? mergedCustom.customPlanDates : void 0 : current.customPlanDates,
      lastReminderEmailOn: void 0,
      lastEscalationEmailOn: void 0,
      lastDailyEmailOn: void 0,
      lastMailSlot: void 0,
      reminderCount: 0,
      status: current.status === "Down" ? current.status : "Active",
      updatedBy: actor,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await upsertMaintenanceMachine(updated);
    res.json({ success: true, machine: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update next maintenance date" });
  }
});
app.patch("/api/maintenance/machines/:id/details", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceMachine(id);
    if (!current) return res.status(404).json({ error: "Machine not found" });
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to update machine details for this plant."
      });
    }
    const body = req.body || {};
    const patch = {};
    if (body.equipmentName !== void 0) {
      patch.equipmentName = String(body.equipmentName || "").trim() || void 0;
    }
    if (body.department !== void 0) {
      patch.department = String(body.department || "").trim() || void 0;
    }
    if (body.responsibility !== void 0) {
      patch.responsibility = String(body.responsibility || "").trim() || void 0;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No detail fields to update" });
    }
    const actor = String(req.authUser?.email || body.updatedBy || "System");
    const saved = await upsertMaintenanceMachine({
      ...current,
      ...patch,
      updatedBy: actor,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, machine: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update machine details" });
  }
});
app.delete("/api/maintenance/machines/:id", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    const role = String(user?.role || req.authUser?.role || "").trim().toLowerCase();
    if (!isItAdminRole2(role)) {
      return res.status(403).json({ error: "Only IT Admin can delete machines" });
    }
    const ok2 = await deleteMaintenanceMachine(String(req.params.id || "").trim());
    if (!ok2) return res.status(404).json({ error: "Machine not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete machine" });
  }
});
app.get("/api/maintenance/meta", async (_req, res) => {
  try {
    const meta = await getMaintenanceMeta();
    res.json({ meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load maintenance settings" });
  }
});
app.post("/api/maintenance/machine-types", async (req, res) => {
  try {
    const name = String(req.body?.name || req.body?.machineType || "").trim();
    if (!name) return res.status(400).json({ error: "Machine type name is required" });
    const meta = await addMachineType(name);
    res.json({ success: true, machineTypes: meta.machineTypes, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to add machine type" });
  }
});
app.delete("/api/maintenance/machine-types/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(String(req.params.name || "").trim());
    if (!name) return res.status(400).json({ error: "Machine type name is required" });
    const meta = await removeMachineType(name);
    res.json({ success: true, machineTypes: meta.machineTypes, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete machine type" });
  }
});
app.get("/api/maintenance/meta", async (_req, res) => {
  try {
    const meta = await getMaintenanceMeta();
    res.json({ success: true, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get maintenance meta" });
  }
});
app.put("/api/maintenance/meta", async (req, res) => {
  try {
    const role = String(req.authUser?.role || req.headers["x-user-role"] || "").trim().toLowerCase();
    const allowed = !req.authUser || role === "it admin" || role === "it_admin" || role === "admin" || role === "superadmin" || role.includes("head") || role.includes("manager");
    if (!allowed) {
      return res.status(403).json({ error: "Only authorized users can update plant contacts" });
    }
    const current = await getMaintenanceMeta();
    const body = req.body || {};
    const meta = await saveMaintenanceMeta({
      ...current,
      ...body,
      machineTypes: Array.isArray(body.machineTypes) ? body.machineTypes : current.machineTypes,
      plantContacts: body.plantContacts || current.plantContacts || {}
    });
    res.json({ success: true, meta });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save maintenance settings" });
  }
});
app.get("/api/maintenance/machines/missing-info", async (_req, res) => {
  try {
    const machines = await listMaintenanceMachines();
    const missing = machines.filter(
      (m) => !String(m.serialNumber || "").trim() || !String(m.modelNumber || "").trim()
    );
    res.json({ success: true, count: missing.length, machines: missing });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to find machines with missing info" });
  }
});
app.post("/api/maintenance/machines/bulk-update-info", async (req, res) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }
    const all = await listMaintenanceMachines();
    const results = [];
    for (const u of updates) {
      const target = all.find((m) => m.id === u.id);
      if (!target) continue;
      const sn = String(u.serialNumber || "").trim();
      const mn = String(u.modelNumber || "").trim();
      if (!sn || !mn) continue;
      const updated = {
        ...target,
        serialNumber: sn,
        modelNumber: mn,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedBy: String(req.authUser?.email || "Admin")
      };
      await upsertMaintenanceMachine(updated);
      results.push(updated);
    }
    res.json({ success: true, updatedCount: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to bulk update machine info" });
  }
});
app.post("/api/maintenance/machines/import", async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No machine rows to import" });
    }
    const existing = await listMaintenanceMachines();
    const errors = [];
    const validMachines = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const actor = String(req.authUser?.email || "Import");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const machineType = String(r["Machine Type"] || r.machineType || "").trim();
      const machineNumber = normalizeMachineNumber(String(r["Machine Number"] || r.machineNumber || ""));
      const serialNumber = String(r["Serial Number"] || r.serialNumber || "").trim();
      const modelNumber = String(r["Model Number"] || r.modelNumber || "").trim();
      const location = String(r["Location"] || r.location || "").trim();
      const plantCode = String(r["Plant"] || r["Plant Code"] || r.plantCode || "").trim();
      const nextDate = String(r["Next PM Date"] || r["Next PM"] || r.nextMaintenanceDate || "").trim();
      if (!machineType) {
        errors.push({ row: rowNum, error: "Machine Type is required." });
        continue;
      }
      if (!machineNumber) {
        errors.push({ row: rowNum, error: "Machine Number is required." });
        continue;
      }
      if (!serialNumber) {
        errors.push({ row: rowNum, error: "Serial Number is required." });
        continue;
      }
      if (!modelNumber) {
        errors.push({ row: rowNum, error: "Model Number is required." });
        continue;
      }
      if (!location || !plantCode) {
        errors.push({ row: rowNum, error: "Location and Plant are required." });
        continue;
      }
      const dup = existing.find(
        (m) => String(m.serialNumber || "").trim().toLowerCase() === serialNumber.toLowerCase() && String(m.plantCode || "").trim().toLowerCase() === plantCode.toLowerCase()
      );
      if (dup) {
        errors.push({
          row: rowNum,
          error: `Serial Number "${serialNumber}" already registered to ${dup.assetCode} in plant ${plantCode}.`
        });
        continue;
      }
      const machine = {
        id: `mach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${i}`,
        machineType,
        machineNumber,
        assetCode: nextMaintenanceAssetCode([...existing, ...validMachines]),
        equipmentName: String(r["Equipment Name"] || r.equipmentName || "").trim() || void 0,
        modelNumber,
        serialNumber,
        department: String(r["Department"] || r.department || "").trim() || void 0,
        responsibility: String(r["Responsibility"] || r.responsibility || "").trim() || void 0,
        location,
        plantCode,
        warrantyStatus: String(r["Warranty Status"] || r.warrantyStatus || "").toLowerCase().includes("in") ? "in_warranty" : "out_of_warranty",
        trendMonths: Number(r["Frequency"] || r.trendMonths) || 2,
        nextMaintenanceDate: nextDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        status: "Active",
        remarks: String(r["Remarks"] || r.remarks || "").trim() || void 0,
        createdBy: actor,
        createdAt: now,
        updatedBy: actor,
        updatedAt: now
      };
      validMachines.push(machine);
    }
    if (errors.length > 0 && validMachines.length === 0) {
      return res.status(400).json({
        error: `Import failed with ${errors.length} validation errors.`,
        errors
      });
    }
    for (const m of validMachines) {
      await upsertMaintenanceMachine(m);
    }
    res.json({
      success: true,
      importedCount: validMachines.length,
      errorCount: errors.length,
      errors: errors.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to import machines" });
  }
});
app.get("/api/maintenance/email/templates", async (_req, res) => {
  try {
    const templates = await listEmailTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list email templates" });
  }
});
app.post("/api/maintenance/email/templates", async (req, res) => {
  try {
    const template = req.body;
    if (!template.name || !template.subject) {
      return res.status(400).json({ error: "Template name and subject are required" });
    }
    const saved = await upsertEmailTemplate({
      ...template,
      id: template.id || `tpl_${Date.now().toString(36)}`
    });
    res.json({ success: true, template: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save email template" });
  }
});
app.delete("/api/maintenance/email/templates/:id", async (req, res) => {
  try {
    const ok2 = await deleteEmailTemplate(String(req.params.id));
    res.json({ success: ok2 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete email template" });
  }
});
app.get("/api/maintenance/email/automations", async (_req, res) => {
  try {
    const automations = await listEmailAutomations();
    res.json({ success: true, automations });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list email automations" });
  }
});
app.post("/api/maintenance/email/automations", async (req, res) => {
  try {
    const automation = req.body;
    if (!automation.name || !automation.triggerType) {
      return res.status(400).json({ error: "Automation name and trigger type are required" });
    }
    const saved = await upsertEmailAutomation({
      ...automation,
      id: automation.id || `auto_${Date.now().toString(36)}`,
      status: automation.status || "active",
      retryCount: automation.retryCount || 3,
      retryIntervalMinutes: automation.retryIntervalMinutes || 15,
      consolidationMode: automation.consolidationMode || "consolidated",
      scheduleTimes: Array.isArray(automation.scheduleTimes) ? automation.scheduleTimes : ["09:00"]
    });
    res.json({ success: true, automation: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save email automation" });
  }
});
app.delete("/api/maintenance/email/automations/:id", async (req, res) => {
  try {
    const ok2 = await deleteEmailAutomation(String(req.params.id));
    res.json({ success: ok2 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete email automation" });
  }
});
app.get("/api/maintenance/email/drafts", async (req, res) => {
  try {
    const drafts = await listEmailDrafts(req.authUser?.email);
    res.json({ success: true, drafts });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list drafts" });
  }
});
app.post("/api/maintenance/email/drafts", async (req, res) => {
  try {
    const draft = req.body;
    const actor = String(req.authUser?.email || "User");
    const saved = await upsertEmailDraft({
      ...draft,
      id: draft.id || `draft_${Date.now().toString(36)}`,
      createdBy: draft.createdBy || actor
    });
    res.json({ success: true, draft: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save draft" });
  }
});
app.delete("/api/maintenance/email/drafts/:id", async (req, res) => {
  try {
    const ok2 = await deleteEmailDraft(String(req.params.id));
    res.json({ success: ok2 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete draft" });
  }
});
app.get("/api/maintenance/email/logs", async (_req, res) => {
  try {
    const logs = await listEmailLogs(250);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list email logs" });
  }
});
app.get("/api/maintenance/email/analytics", async (_req, res) => {
  try {
    const analytics = await getEmailAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch email analytics" });
  }
});
app.post("/api/maintenance/email/send", async (req, res) => {
  try {
    const body = req.body;
    if (!body.to || body.to.length === 0) {
      return res.status(400).json({ error: "At least one TO recipient is required" });
    }
    if (!body.subject.trim()) {
      return res.status(400).json({ error: "Email subject is required" });
    }
    const plainText = body.bodyHtml.replace(/<[^>]+>/g, " ").trim();
    const sendResult = await sendMaintenanceMail({
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html: body.bodyHtml,
      text: plainText
    });
    const date = currentIstDate();
    const time = currentIstTime();
    const actor = String(req.authUser?.email || "User");
    await appendEmailLog({
      triggerType: "manual",
      date,
      time,
      sender: actor,
      to: body.to,
      cc: body.cc || [],
      bcc: body.bcc || [],
      subject: body.subject,
      location: body.location,
      plantCode: body.plantCode,
      department: body.department,
      status: sendResult.ok ? "sent" : "failed",
      sentAt: sendResult.ok ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
      failureReason: sendResult.error,
      retryCount: sendResult.ok ? 0 : 1
    });
    if (!sendResult.ok) {
      return res.status(500).json({ error: sendResult.error || "Failed to send email" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send manual email" });
  }
});
app.post("/api/maintenance/email/test", async (req, res) => {
  try {
    const { testEmail, subject, bodyHtml } = req.body;
    if (!testEmail || !testEmail.includes("@")) {
      return res.status(400).json({ error: "Valid test email address is required" });
    }
    const sub = subject || "[TEST EMAIL] AEMS Maintenance Email Center Verification";
    const html = bodyHtml || `<div style="font-family:Arial,sans-serif;padding:16px;">
        <h2 style="color:#1d4ed8;">AEMS Test Notification</h2>
        <p>This is a successful test email verifying SMTP configuration and delivery from AEMS.</p>
        <p style="color:#64748b;font-size:12px;">Sent at: ${(/* @__PURE__ */ new Date()).toISOString()} (IST: ${currentIstDate()} ${currentIstTime()})</p>
      </div>`;
    const sendResult = await sendMaintenanceMail({
      to: [testEmail.trim()],
      subject: sub,
      html,
      text: html.replace(/<[^>]+>/g, " ").trim()
    });
    if (!sendResult.ok) {
      return res.status(500).json({ error: sendResult.error || "Test email delivery failed" });
    }
    res.json({ success: true, message: `Test email successfully dispatched to ${testEmail}` });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});
app.post("/api/maintenance/email/trigger-scheduler", async (_req, res) => {
  try {
    const result = await runEmailAutomationScheduler(true);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to trigger scheduler" });
  }
});
app.post("/api/maintenance/machines/:id/done", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceMachine(id);
    if (!current) return res.status(404).json({ error: "Machine not found" });
    const user = resolveRequestUser(req);
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to mark maintenance done for this plant."
      });
    }
    const days = daysUntilDate(effectiveNextMaintenanceDate(current));
    if (days == null || days > 7) {
      return res.status(400).json({
        error: "Done is only available within 1 week before the maintenance date (or when overdue)"
      });
    }
    const body = req.body || {};
    const technicians = parseTechnicianPayload(body);
    if ("error" in technicians) {
      return res.status(400).json({ error: technicians.error });
    }
    const remarks = String(body.remarks || "").trim();
    const wordCount = remarks.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50) {
      return res.status(400).json({ error: "Close-out remark must be at least 50 words" });
    }
    const actor = String(req.authUser?.email || "System");
    const doneOn = todayKey();
    const custom = isCustomTrend(machineTrendMonths(current));
    const plannedDate = effectiveNextMaintenanceDate(current);
    const plannedKey = String(plannedDate || "").trim().slice(0, 10);
    const inputNext = String(body.nextMaintenanceDate || "").trim();
    let resolvedNext = inputNext;
    let customPlanDates = current.customPlanDates;
    if (custom) {
      const remaining = pendingPlanDates(current).map((d) => formatDateOnly(d)).filter((d) => d !== plannedKey);
      if (inputNext && !remaining.includes(inputNext)) {
        remaining.push(inputNext);
      }
      if (!remaining.length) {
        return res.status(400).json({
          error: "Enter the next maintenance date (custom trend has no auto interval)"
        });
      }
      const merged = mergeCustomPlan("", remaining);
      resolvedNext = merged.nextMaintenanceDate;
      customPlanDates = merged.customPlanDates.length ? merged.customPlanDates : void 0;
    } else {
      if (!resolvedNext) {
        resolvedNext = suggestNextMaintenanceDate(/* @__PURE__ */ new Date(), machineTrendMonths(current));
      }
    }
    const wasAlreadyPlanned = pendingPlanDates(current).some(
      (d) => formatDateOnly(d) === resolvedNext
    );
    if (!custom || !wasAlreadyPlanned) {
      const nextDays = daysUntilDate(resolvedNext);
      if (nextDays == null || nextDays <= 7) {
        return res.status(400).json({
          error: "Enter a next maintenance date more than 7 days from today so Done hides until the next window"
        });
      }
    }
    const reminderCount = current.reminderCount || 0;
    const updated = {
      ...current,
      lastMaintenanceDate: doneOn,
      nextMaintenanceDate: resolvedNext,
      customPlanDates,
      status: "Active",
      remarks,
      pmLogs: [
        ...current.pmLogs || [],
        {
          plannedDate,
          doneOn,
          technicianCount: technicians.technicianCount,
          technicianNames: technicians.technicianNames,
          doneBy: actor,
          doneRemarks: remarks
        }
      ],
      lastReminderEmailOn: void 0,
      lastEscalationEmailOn: void 0,
      lastDailyEmailOn: void 0,
      lastMailSlot: void 0,
      reminderCount: 0,
      updatedBy: actor,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await upsertMaintenanceMachine(updated);
    const meta = await getMaintenanceMeta();
    const to = getPlantMaintenanceEmails(meta.plantContacts, saved.plantCode);
    if (to.length) {
      const payload = buildPreventiveSolvedEmail({
        ...pickMailIdentity(current),
        completedOn: doneOn,
        plannedDate,
        reminderCount,
        resolvedBy: actor,
        technicianCount: technicians.technicianCount,
        technicianNames: technicians.technicianNames,
        remarks
      });
      await sendMaintenanceMail({ to, ...payload });
    }
    res.json({ success: true, machine: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to mark done" });
  }
});
app.get("/api/maintenance/complaints", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    const role = String(user?.role || req.authUser?.role || "").trim().toLowerCase();
    if (role === "hr") {
      return res.status(403).json({ error: "Complaints are not available for HR role" });
    }
    const rawComplaints = await listMaintenanceComplaints();
    const settingsPlants = maintenanceSettingsPlants();
    const complaints = user && !isItAdminRole2(user.role) ? rawComplaints.filter((c) => userCanAccessPlantLocation(user, c.location, c.plantCode, settingsPlants)) : rawComplaints;
    complaints.sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt)));
    res.json({ complaints });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load complaints" });
  }
});
app.post("/api/maintenance/complaints/public", async (req, res) => {
  try {
    const body = req.body || {};
    const assetCode = String(body.assetCode || "").trim();
    const complaintText = String(body.complaintText || "").trim();
    const remark = String(body.remark || "").trim();
    const reporterName = String(body.reporterName || "").trim();
    const reporterEmployeeCode = String(body.reporterEmployeeCode || "").trim().toUpperCase();
    const reporterPhone = String(body.reporterPhone || "").trim().replace(/[\s\-+()]/g, "");
    const hours = Math.max(0, Math.floor(Number(body.downtimeHours) || 0));
    const mins = Math.max(0, Math.min(59, Math.floor(Number(body.downtimeMinutes) || 0)));
    const downtimeMinutes = hours * 60 + mins;
    if (!assetCode) return res.status(400).json({ error: "Asset code is required" });
    if (!complaintText || complaintText.length < 5) {
      return res.status(400).json({ error: "Please describe the breakdown (at least 5 characters)" });
    }
    if (!remark || remark.length < 3) {
      return res.status(400).json({ error: "Remark is required" });
    }
    if (!reporterName || reporterName.length < 2) {
      return res.status(400).json({ error: "Reporter name is required (at least 2 characters)" });
    }
    if (!reporterEmployeeCode || reporterEmployeeCode.length < 2) {
      return res.status(400).json({ error: "Employee code is required" });
    }
    if (!/^[A-Z0-9][A-Z0-9\-_/]{1,24}$/i.test(reporterEmployeeCode)) {
      return res.status(400).json({ error: "Enter a valid employee code (letters / numbers)" });
    }
    if (!/^\d{7,15}$/.test(reporterPhone)) {
      return res.status(400).json({ error: "Enter a valid mobile / phone number (7\u201315 digits)" });
    }
    if (!body.photoData || !String(body.photoData).trim()) {
      return res.status(400).json({ error: "Breakdown photo is required" });
    }
    const machine = await getMaintenanceMachineByAssetCode(assetCode);
    if (!machine) return res.status(404).json({ error: "Machine not found for this QR / asset code" });
    const existingComplaints = await listMaintenanceComplaints();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
    const recentDuplicate = existingComplaints.find(
      (c) => c.assetCode === machine.assetCode && c.reporterEmployeeCode === reporterEmployeeCode && c.complaintText.toLowerCase().trim() === complaintText.toLowerCase().trim() && new Date(c.reportedAt).getTime() > tenMinutesAgo
    );
    if (recentDuplicate) {
      return res.json({
        success: true,
        complaint: recentDuplicate,
        duplicateSuppressed: true,
        message: "Complaint already submitted and registered successfully."
      });
    }
    let photoUrl = "";
    let photoName = "";
    const photoData = String(body.photoData || "").trim();
    if (photoData) {
      const matches = photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
      if (!matches) {
        return res.status(400).json({ error: "Photo must be JPEG, PNG, or WebP" });
      }
      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2];
      const bytes = Buffer.from(base64Data, "base64");
      if (bytes.length > 8 * 1024 * 1024) {
        return res.status(413).json({ error: "Photo too large (max 8 MB)" });
      }
      const { saveLocalUpload: saveLocalUpload2 } = await Promise.resolve().then(() => (init_sqlFiles(), sqlFiles_exports));
      const savedPhoto = await saveLocalUpload2({
        filename: String(body.photoName || "complaint-photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120),
        mimeType,
        base64Data
      });
      photoUrl = savedPhoto.viewUrl || savedPhoto.url;
      photoName = savedPhoto.fileName;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const complaint = {
      id: `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      machineId: machine.id,
      assetCode: machine.assetCode,
      machineType: machine.machineType,
      machineNumber: machine.machineNumber,
      equipmentName: machine.equipmentName,
      department: machine.department,
      responsibility: machine.responsibility,
      location: machine.location,
      plantCode: machine.plantCode,
      complaintText,
      remark,
      reporterName,
      reporterEmployeeCode,
      reporterPhone,
      downtimeMinutes,
      photoUrl: photoUrl || void 0,
      photoName: photoName || void 0,
      status: "Open",
      reportedAt: now,
      reminderCount: 0
    };
    const saved = await upsertMaintenanceComplaint(complaint);
    await upsertMaintenanceMachine({
      ...machine,
      status: "Down",
      updatedAt: now
    });
    const meta = await getMaintenanceMeta();
    const to = getPlantMaintenanceEmails(meta.plantContacts, machine.plantCode);
    let mail;
    if (to.length) {
      const payload = buildComplaintNotifyEmail({
        ...pickMailIdentity(saved),
        complaintText: saved.complaintText,
        remark: saved.remark,
        reporterName: saved.reporterName,
        reporterEmployeeCode: saved.reporterEmployeeCode,
        reporterPhone: saved.reporterPhone,
        downtimeLabel: formatDowntimeLabel(saved.downtimeMinutes),
        photoUrl: saved.photoUrl,
        reportedAt: saved.reportedAt
      });
      mail = await sendMaintenanceMail({ to, ...payload });
      if (mail.ok) {
        await upsertMaintenanceComplaint({ ...saved, notifiedFhOn: todayKey() });
      }
    }
    res.json({
      success: true,
      complaint: saved,
      mailSent: Boolean(mail?.ok),
      mailError: mail && !mail.ok ? mail.error : void 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to submit complaint" });
  }
});
app.post("/api/maintenance/complaints/:id/done", async (req, res) => {
  try {
    const user = resolveRequestUser(req);
    const role = String(user?.role || req.authUser?.role || "").trim().toLowerCase();
    if (role === "hr") {
      return res.status(403).json({ error: "HR cannot resolve complaints" });
    }
    const id = String(req.params.id || "").trim();
    const current = await getMaintenanceComplaint(id);
    if (!current) return res.status(404).json({ error: "Complaint not found" });
    if (current.status === "Resolved") return res.json({ success: true, complaint: current });
    const settingsPlants = maintenanceSettingsPlants();
    if (!userCanAccessPlantLocation(user, current.location, current.plantCode, settingsPlants)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to resolve complaints for this plant."
      });
    }
    const remarks = String((req.body || {}).remarks || "").trim();
    const wordCount = remarks.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50) {
      return res.status(400).json({ error: "Resolution remark must be at least 50 words" });
    }
    const technicians = parseTechnicianPayload(req.body || {});
    if ("error" in technicians) {
      return res.status(400).json({ error: technicians.error });
    }
    const photoData = String((req.body || {}).photoData || "").trim();
    if (!photoData) {
      return res.status(400).json({ error: "Close-out evidence photo is required" });
    }
    const matches = photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
    if (!matches) {
      return res.status(400).json({ error: "Evidence photo must be JPEG, PNG, or WebP" });
    }
    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const bytes = Buffer.from(base64Data, "base64");
    if (bytes.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "Evidence photo too large (max 8 MB)" });
    }
    const { saveLocalUpload: saveLocalUpload2 } = await Promise.resolve().then(() => (init_sqlFiles(), sqlFiles_exports));
    const savedPhoto = await saveLocalUpload2({
      filename: String((req.body || {}).photoName || "resolution-evidence.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120),
      mimeType,
      base64Data
    });
    const actor = String(req.authUser?.email || "System");
    const reminderCount = current.reminderCount || 0;
    const updated = {
      ...current,
      status: "Resolved",
      remarks,
      resolutionPhotoUrl: savedPhoto.viewUrl || savedPhoto.url,
      resolutionPhotoName: savedPhoto.fileName,
      resolvedAt: (/* @__PURE__ */ new Date()).toISOString(),
      resolvedBy: actor,
      resolvedTechnicianCount: technicians.technicianCount,
      resolvedTechnicianNames: technicians.technicianNames,
      lastDailyEmailOn: void 0,
      lastMailSlot: void 0
    };
    const saved = await upsertMaintenanceComplaint(updated);
    const machine = await getMaintenanceMachine(current.machineId);
    if (machine && machine.status === "Down") {
      const openOthers = (await listMaintenanceComplaints()).some(
        (c) => c.machineId === machine.id && c.id !== saved.id && c.status === "Open"
      );
      if (!openOthers) {
        await upsertMaintenanceMachine({
          ...machine,
          status: "Active",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor
        });
      }
    }
    const meta = await getMaintenanceMeta();
    const to = getPlantMaintenanceEmails(meta.plantContacts, saved.plantCode);
    if (to.length) {
      const payload = buildComplaintSolvedEmail({
        ...pickMailIdentity(saved),
        complaintText: saved.complaintText,
        remarks: saved.remarks,
        resolutionPhotoUrl: saved.resolutionPhotoUrl,
        reportedAt: saved.reportedAt,
        resolvedAt: saved.resolvedAt || (/* @__PURE__ */ new Date()).toISOString(),
        resolvedBy: actor,
        reminderCount,
        technicianCount: technicians.technicianCount,
        technicianNames: technicians.technicianNames
      });
      await sendMaintenanceMail({ to, ...payload });
    }
    res.json({ success: true, complaint: saved });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to resolve complaint" });
  }
});
app.get("/api/maintenance/dashboard", async (_req, res) => {
  try {
    const machines = await listMaintenanceMachines();
    const complaints = await listMaintenanceComplaints();
    const preventivePending = machines.map((m) => {
      const daysUntil = daysUntilDate(m.nextMaintenanceDate);
      const overdueDays = maintenancePendingDays(m);
      const inWindow = daysUntil != null && daysUntil <= 7;
      if (!inWindow) return null;
      return {
        id: m.id,
        assetCode: m.assetCode,
        machineType: m.machineType,
        machineNumber: m.machineNumber,
        location: m.location,
        plantCode: m.plantCode,
        plantName: maintenancePlantName(m.plantCode),
        nextMaintenanceDate: m.nextMaintenanceDate,
        pendingDays: overdueDays > 0 ? overdueDays : 0,
        daysUntil: daysUntil ?? 0,
        status: overdueDays > 0 ? "Overdue" : "Due"
      };
    }).filter(Boolean);
    const openComplaints = complaints.filter((c) => c.status === "Open");
    const resolvedComplaints = complaints.filter((c) => c.status === "Resolved");
    const complaintRows = openComplaints.map((c) => {
      const reported = new Date(c.reportedAt);
      const pendingDays = Number.isNaN(reported.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - reported.getTime()) / (24 * 60 * 60 * 1e3)));
      return {
        id: c.id,
        assetCode: c.assetCode,
        machineType: c.machineType,
        machineNumber: c.machineNumber,
        location: c.location,
        plantCode: c.plantCode,
        plantName: maintenancePlantName(c.plantCode),
        complaintText: c.complaintText,
        remarks: c.remarks || "",
        reportedAt: c.reportedAt,
        pendingDays
      };
    });
    res.json({
      preventive: {
        pendingCount: preventivePending.length,
        items: preventivePending
      },
      complaints: {
        total: complaints.length,
        resolved: resolvedComplaints.length,
        pending: openComplaints.length,
        items: complaintRows
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});
function authorizeMaintenanceCron(req) {
  const secret = getEnv("CRON_SECRET") || getEnv("MAINTENANCE_CRON_SECRET");
  const header = String(req.headers["authorization"] || "");
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const fromQuery = String(req.query.secret || "").trim();
  const fromHeader = String(req.headers["x-cron-secret"] || "").trim();
  const vercelCron = String(req.headers["x-vercel-cron"] || "") === "1";
  if (vercelCron) return true;
  if (secret) {
    return bearer === secret || fromQuery === secret || fromHeader === secret;
  }
  return getEnv("NODE_ENV") !== "production" && getEnv("VERCEL_ENV") !== "production";
}
app.get("/api/maintenance/cron", async (req, res) => {
  try {
    if (!authorizeMaintenanceCron(req)) {
      return res.status(401).json({ error: "Unauthorized cron" });
    }
    const result = await runMaintenanceCron();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Cron failed" });
  }
});
app.post("/api/maintenance/cron", async (req, res) => {
  try {
    if (!authorizeMaintenanceCron(req)) {
      return res.status(401).json({ error: "Unauthorized cron" });
    }
    const result = await runMaintenanceCron();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Cron failed" });
  }
});
app.get("/api/cron/maintenance", async (req, res) => {
  try {
    if (!authorizeMaintenanceCron(req)) {
      return res.status(401).json({ error: "Unauthorized cron" });
    }
    const result = await runMaintenanceCron();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Cron failed" });
  }
});
app.post("/api/damaged-items", async (req, res) => {
  try {
    const previousDamagedItems = readDamagedItems();
    const body = req.body;
    const saved = upsertDamagedItem(body.item);
    if (body.syncSheet !== false && GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("add", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeDamagedItems(previousDamagedItems));
    }
    const assetStatus = body.item.Status === "Scrapped" ? "Scrap" : body.item.Status === "Repaired" ? "Available" : "Damaged";
    void syncAssetStatusUpdate(body.item["Asset ID"], assetStatus, body.item["Reported By"] || "System");
    res.json({ success: true, item: saved });
  } catch (error) {
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
      "Record ID": recordId
    };
    const saved = upsertDamagedItem(updated);
    if (GAS_WEBAPP_URL) {
      const gas = await persistDamagedItemToGas("update", saved, proxyToGas);
      assertSheetSyncOk(gas, () => writeDamagedItems(previousDamagedItems));
    }
    if (updated.Status !== "Deassigned" && updated.Status !== "Reassigned") {
      const assetStatus = updated.Status === "Scrapped" ? "Scrap" : updated.Status === "Repaired" ? "Available" : "Damaged";
      void syncAssetStatusUpdate(updated["Asset ID"], assetStatus, updated["Reported By"] || "System");
    }
    res.json({ success: true, item: saved });
  } catch (error) {
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
    void syncAssetStatusUpdate(existing["Asset ID"], "Available", user.email);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to delete" });
  }
});
app.post("/api/assets", async (req, res) => {
  try {
    const assetData = await prepareAssetPayload(req.body);
    console.log("[AMS] POST /api/assets \u2014 received payload:", JSON.stringify({
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
      documentUrl: assetData.documentUrl
    }));
    const assets = await getAssetsForOps();
    const mainCat = String(assetData.mainCategory || "IT Assets").trim();
    if (!isManualAssetCodeCategory(mainCat)) {
      const isCodeTaken = String(assetData.assetCode || "").trim() && (assets.some((a) => String(a.assetCode || "").trim().toLowerCase() === String(assetData.assetCode).trim().toLowerCase()) || isSavingCode(String(assetData.assetCode)));
      if (!String(assetData.assetCode || "").trim() || isCodeTaken) {
        assetData.assetCode = generateAssetCode(assets, mainCat);
        console.log(`[AMS] Concurrency detected. Auto-assigned new code: ${assetData.assetCode}`);
      }
    }
    const savingCode = String(assetData.assetCode || "");
    registerSavingCode(savingCode);
    let reservedIdNum = 0;
    try {
      await assertAssetUnique(assetData);
      const requestedId = assetData.id ? String(assetData.id).trim() : "";
      const isIdAlreadyTaken = requestedId && (assets.some((a) => String(a.id || "").trim() === requestedId) || isAssetIdReserved(parseInt(requestedId, 10) || 0));
      const assetId = requestedId && !isIdAlreadyTaken ? requestedId : generateNextAssetId(assets);
      reservedIdNum = parseInt(assetId, 10) || 0;
      reserveAssetId(reservedIdNum);
      assetData.id = assetId;
      assetData.uniqueCode = assetData.uniqueCode || assetData.assetCode || assetId;
      const baseUrl = getBaseUrl(req);
      const tempAsset = mapSheetRow({
        ...assetData,
        id: assetId,
        "S No": assetId,
        "Unique Code": assetData.uniqueCode
      });
      assetData.qrCodeText = getScanUrl(baseUrl, tempAsset);
      const dbMode = readAppData().settings.dbMode;
      let result;
      const masterHeaders = getDefaultAssetHeaders();
      let localCategory = String(assetData.mainCategory || "IT Assets");
      let localRow;
      if (dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, assetId, String(assetData.qrCodeText ?? ""));
        result = await proxyToGas({ action: "add_asset_redesigned", row });
        localRow = buildMasterAssetRow(assetData);
      } else {
        const row = buildMasterAssetRow(assetData);
        logAssetMappingAudit("sheet-write-add", assetData, masterHeaders, row);
        console.log("[AMS] Sheet row payload (add):", row.length, "columns");
        result = await proxyToGas({ action: "add", row });
        localRow = row;
      }
      if (result.error) throw new Error(result.error);
      const finalAssetId = result.id ? String(result.id) : assetId;
      const finalAssetCode = result.assetCode ? String(result.assetCode) : String(assetData.assetCode || "");
      if (finalAssetId !== assetId || finalAssetCode !== String(assetData.assetCode || "")) {
        console.log(`[AMS] Concurrency resolution: S No reassigned to ${finalAssetId}, Code reassigned to ${finalAssetCode}`);
        assetData.id = finalAssetId;
        assetData.assetCode = finalAssetCode;
        assetData.uniqueCode = assetData.uniqueCode === assetId || assetData.uniqueCode === String(assetData.assetCode || "") ? finalAssetId : assetData.uniqueCode;
        const baseUrl2 = getBaseUrl(req);
        const tempAsset2 = mapSheetRow({
          ...assetData,
          id: finalAssetId,
          "S No": finalAssetId,
          "Unique Code": assetData.uniqueCode
        });
        assetData.qrCodeText = getScanUrl(baseUrl2, tempAsset2);
        localRow = buildMasterAssetRow(assetData);
      }
      await insertAssetLocal(localCategory, localRow, masterHeaders);
      releaseIssuedCode(localCategory, String(assetData.assetCode || ""));
      console.log("[AMS] POST /api/assets \u2014 response:", { id: finalAssetId, success: true });
      persistAssetDynamicDetails(finalAssetId, assetData).catch((err) => {
        console.warn("[AMS] Background dynamic details sync failed:", err);
      });
      const hist = recordAssignmentChange({
        assetId: finalAssetId,
        previous: {},
        next: {
          employeeId: String(assetData.employeeId || ""),
          contactName: String(assetData.contactName || ""),
          contactEmail: String(assetData.contactEmail || ""),
          status: String(assetData.status || "")
        },
        assignedBy: String(assetData.createdBy || assetData.updatedBy || ""),
        assignedDate: String(assetData.assignedDate || "")
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
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
        "QR Code / Barcode": assetData.qrCodeText
      });
      upsertAssetInCache(savedAsset);
      if (GAS_WEBAPP_URL) {
        void refreshAssetsNow(GAS_WEBAPP_URL).catch(
          (err) => console.warn("[AMS] Post-save sheet refresh:", err)
        );
      }
      res.json({ success: true, asset: savedAsset });
    } finally {
      releaseSavingCode(savingCode);
      releaseAssetId(reservedIdNum);
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to add asset" });
  }
});
app.put("/api/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const assets = await getFreshAssetsForMutation();
    const existing = findMappedAssetByAnyId(assets, id);
    const canonicalId = String(existing?.id || id);
    const mergedInput = mergeAssetEditPayload({ ...req.body, id: canonicalId }, existing);
    const assetData = await prepareAssetPayload(mergedInput, existing);
    const savingCode = String(assetData.assetCode || "");
    registerSavingCode(savingCode);
    try {
      await assertAssetUnique(assetData, canonicalId);
      const baseUrl = getBaseUrl(req);
      assetData.qrCodeText = getScanUrl(baseUrl, { ...existing || {}, ...assetData, id: canonicalId });
      const dbMode = readAppData().settings.dbMode;
      let result;
      const masterHeaders = getDefaultAssetHeaders();
      let localCategory = String(assetData.mainCategory || "IT Assets");
      let localRow;
      if (isDbMode() || dbMode === "redesigned") {
        const row = buildRedesignedAssetRow(assetData, canonicalId, String(assetData.qrCodeText ?? ""));
        result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalId, row });
        localRow = buildMasterAssetRow(assetData);
      } else {
        const sheet = await fetchSheetData();
        if (!sheet.length) return res.status(500).json({ error: "Sheet has no data" });
        const sheetHeaders = sheet[0];
        const rows = sheet.slice(1);
        const idCol = sheetHeaders.findIndex(
          (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
        const normalizeId = (val) => String(val || "").replace(/^0+/, "").trim();
        const targetId = normalizeId(canonicalId);
        const rowIndex = rows.findIndex(
          (row) => normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId || existing.assetCode && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.assetCode) || existing.serialNumber && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.serialNumber)
        );
        if (rowIndex === -1) return res.status(404).json({ error: "Asset not found" });
        const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
        const updatedRow = buildMasterAssetRow(assetData, existingMaster);
        logAssetMappingAudit("sheet-write-update", assetData, masterHeaders, updatedRow);
        console.log("[AMS] Sheet row payload (update):", updatedRow.length, "columns for id", canonicalId);
        result = await proxyToGas({ action: "update", id: canonicalId, row: updatedRow, rowIndex: rowIndex + 2 });
        localRow = updatedRow;
      }
      if (result.error) throw new Error(result.error);
      await updateAssetLocal(localCategory, canonicalId, localRow, masterHeaders);
      releaseIssuedCode(localCategory, String(assetData.assetCode || ""));
      persistAssetDynamicDetails(canonicalId, assetData).catch((err) => {
        console.warn("[AMS] Background dynamic details sync failed:", err);
      });
      const hist = recordAssignmentChange({
        assetId: canonicalId,
        previous: {
          employeeId: existing?.employeeId || "",
          contactName: existing?.contactName || "",
          contactEmail: existing?.contactEmail || "",
          status: existing?.status || ""
        },
        next: {
          employeeId: String(assetData.employeeId || ""),
          contactName: String(assetData.contactName || ""),
          contactEmail: String(assetData.contactEmail || ""),
          status: String(assetData.status || "")
        },
        assignedBy: String(assetData.updatedBy || ""),
        assignedDate: String(assetData.assignedDate || "")
      });
      if (GAS_WEBAPP_URL) {
        syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
          console.warn("[AMS] Background history sync failed:", err);
        });
      }
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
        "QR Code / Barcode": assetData.qrCodeText
      });
      upsertAssetInCache(updatedAsset);
      if (GAS_WEBAPP_URL) {
        void refreshAssetsNow(GAS_WEBAPP_URL).catch(
          (err) => console.warn("[AMS] Post-update sheet refresh:", err)
        );
      }
      res.json({ success: true, asset: updatedAsset });
    } finally {
      releaseSavingCode(savingCode);
    }
  } catch (error) {
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
    const hadAssignee = hasAssigneeFields(existing);
    if (!hadAssignee) {
      const currentAsset = mapSheetRow({
        ...existing,
        id: canonicalId,
        "S No": canonicalId,
        "Asset ID": canonicalId,
        "QR Code / Barcode": existing.qrCodeText
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
      returnDate: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: actor,
      updatedDate: (/* @__PURE__ */ new Date()).toISOString()
    }, existing);
    const baseUrl = getBaseUrl(req);
    assetData.qrCodeText = getScanUrl(baseUrl, { ...existing || {}, ...assetData, id: canonicalId });
    const dbMode = readAppData().settings.dbMode;
    const masterHeaders = getDefaultAssetHeaders();
    let result;
    let localRow;
    const localCategory = String(assetData.mainCategory || "IT Assets");
    if (isDbMode() || dbMode === "redesigned") {
      const row = buildRedesignedAssetRow(assetData, canonicalId, String(assetData.qrCodeText ?? ""));
      result = await proxyToGas({ action: "update_asset_redesigned", id: canonicalId, row });
      localRow = buildMasterAssetRow(assetData);
    } else {
      const sheet = await fetchSheetData();
      if (!sheet.length) return res.status(500).json({ error: "Sheet has no data" });
      const sheetHeaders = sheet[0];
      const rows = sheet.slice(1);
      const idCol = sheetHeaders.findIndex(
        (h) => ["s no", "id", "sr.no", "assetid"].includes(h.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const normalizeId = (val) => String(val || "").replace(/^0+/, "").trim();
      const targetId = normalizeId(canonicalId);
      const rowIndex = rows.findIndex(
        (row) => normalizeId(row[idCol !== -1 ? idCol : 0]) === targetId || existing.assetCode && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.assetCode) || existing.serialNumber && normalizeId(row[idCol !== -1 ? idCol : 0]) === normalizeId(existing.serialNumber)
      );
      if (rowIndex === -1) return res.status(404).json({ error: "Asset not found" });
      const existingMaster = sheetRowToMasterRow(sheetHeaders, rows[rowIndex]);
      const updatedRow = buildMasterAssetRow(assetData, existingMaster);
      result = await proxyToGas({ action: "update", id: canonicalId, row: updatedRow, rowIndex: rowIndex + 2 });
      localRow = updatedRow;
    }
    if (result?.error) throw new Error(result.error);
    await updateAssetLocal(localCategory, canonicalId, localRow, masterHeaders);
    persistAssetDynamicDetails(canonicalId, assetData).catch((err) => {
      console.warn("[AMS] Background dynamic details sync failed:", err);
    });
    const hist = recordAssignmentChange({
      assetId: canonicalId,
      previous: {
        employeeId: existing.employeeId || "",
        contactName: existing.contactName || "",
        contactEmail: existing.contactEmail || "",
        status: existing.status || ""
      },
      next: {
        employeeId: "",
        contactName: "",
        contactEmail: "",
        status: "Available"
      },
      assignedBy: actor,
      remarks
    });
    if (GAS_WEBAPP_URL) {
      syncHistoryEntriesToGas(hist, proxyToGas).catch((err) => {
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
      "QR Code / Barcode": assetData.qrCodeText
    });
    upsertAssetInCache(updatedAsset);
    if (GAS_WEBAPP_URL) {
      void refreshAssetsNow(GAS_WEBAPP_URL).catch(
        (err) => console.warn("[AMS] Post-deassign sheet refresh:", err)
      );
    }
    res.json({ success: true, asset: updatedAsset });
  } catch (error) {
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
  } catch (error) {
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
    if (!isItAdminRole2(actorRole)) {
      return res.status(403).json({ error: "You do not have permission to delete assets." });
    }
    const id = req.params.id;
    const data = readAppData();
    const dbMode = data.settings.dbMode;
    const assets = await getAssetsForOps();
    const existing = findMappedAssetByAnyId(assets, id);
    const canonicalId = String(existing?.id || id);
    if (existing) {
      await archiveDeletedAsset(existing, actorEmail).catch(() => {
      });
    }
    let sheetWarning;
    if (GAS_WEBAPP_URL) {
      try {
        let result;
        if (dbMode === "redesigned") {
          result = await proxyToGas({ action: "delete_asset_redesigned", id: canonicalId });
        } else {
          result = await proxyToGas({ action: "delete", id: canonicalId });
        }
        if (result?.error) sheetWarning = String(result.error);
      } catch (gasErr) {
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete asset" });
  }
});
app.get("/scan/:id", (req, res) => {
  const id = encodeURIComponent(req.params.id);
  res.redirect(302, `/api/scan/${id}/pdf`);
});
app.get("/api/scan/:id/pdf", async (req, res) => {
  try {
    if (!GAS_WEBAPP_URL) {
      return res.status(500).json({ error: "GAS_WEBAPP_URL is not configured in .env" });
    }
    const scanId = req.params.id;
    let assets;
    try {
      const cached = await getAssetsWithCache(GAS_WEBAPP_URL, false);
      assets = cached.assets;
    } catch (fetchErr) {
      console.error("Fetch assets for PDF:", fetchErr);
      return res.status(500).json({ error: "Could not load assets from sheet" });
    }
    let asset = findAssetByScanId(assets, scanId);
    if (!asset) {
      try {
        assets = await refreshAssetsNow(GAS_WEBAPP_URL);
        asset = findAssetByScanId(assets, scanId);
      } catch {
      }
    }
    if (!asset) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(404).send(
        `<html><body style="font-family:system-ui;padding:24px"><h2>Asset not found</h2><p>No asset for ID: <b>${scanId}</b>. Re-save the asset to refresh its QR code.</p></body></html>`
      );
    }
    const healedAsset = healMisalignedAssetFields(asset);
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
  } catch (error) {
    console.error("PDF generation error:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(
      `<html><body style="font-family:system-ui;padding:24px"><h2>PDF error</h2><p>${error.message || "Failed to generate PDF"}</p></body></html>`
    );
  }
});
function pdfSafeFilename(id) {
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
      scanUrl: getScanUrl(getBaseUrl(req), asset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch asset" });
  }
});
function mountViteDev(app2, vite) {
  const indexHtml = path19.resolve(process.cwd(), "index.html");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
      return next();
    }
    vite.middlewares(req, res, next);
  });
  app2.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
      return next();
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    try {
      let html = fs19.readFileSync(indexHtml, "utf-8");
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
      "MISSING: Run 'npm install' \u2014 pdf-lib and qrcode are required for QR PDF generation"
    );
  }
  if (isSupabaseMode()) {
    const { initSupabase: initSupabase2 } = await Promise.resolve().then(() => (init_initSupabase(), initSupabase_exports));
    await initSupabase2();
  } else if (isSqlMode()) {
    const { initSqlServer: initSqlServer2 } = await Promise.resolve().then(() => (init_sqlPool(), sqlPool_exports));
    const { migrateLocalDataToSql: migrateLocalDataToSql2 } = await Promise.resolve().then(() => (init_sqlMigrate(), sqlMigrate_exports));
    await initSqlServer2();
    await migrateLocalDataToSql2();
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: 0
        }
      },
      appType: "custom"
    });
    mountViteDev(app, vite);
  } else {
    const distPath = path19.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/scan/")) {
        return next();
      }
      res.sendFile(path19.join(distPath, "index.html"));
    });
  }
  const startListening = (port) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log(`Open app at http://localhost:${port} (not Vite port 5173)`);
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`[AMS] Port ${port} is already in use. Trying port ${port + 1}...`);
        startListening(port + 1);
      } else {
        console.error("[AMS] Server error:", error);
      }
    });
  };
  startListening(PORT);
  startEmailSchedulerTimer();
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
export {
  server_default as default,
  recordAudit
};
