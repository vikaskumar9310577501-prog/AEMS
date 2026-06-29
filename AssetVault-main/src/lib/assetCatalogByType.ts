/** Brand → models, scoped per asset type (used in asset entry form). */
export type BrandsByType = Record<string, Record<string, string[]>>;

export const DEFAULT_BRANDS_BY_TYPE: BrandsByType = {
  Laptop: {
    Dell: ["Latitude 5420", "Latitude 5430", "Latitude 5440", "Precision 3560", "XPS 13"],
    HP: ["EliteBook 840 G8", "EliteBook 850 G9", "ProBook 450 G9", "ZBook Firefly 14"],
    Lenovo: ["ThinkPad T14", "ThinkPad E14", "ThinkPad L14", "ThinkPad X1 Carbon", "IdeaPad Slim 5"],
    Apple: ["MacBook Air M2", "MacBook Air M3", "MacBook Pro 14", "MacBook Pro 16"],
    Asus: ["VivoBook 15", "ZenBook 14", "ExpertBook B1"],
    Acer: ["Aspire 5", "TravelMate P2", "Swift 3"],
    Microsoft: ["Surface Laptop 5", "Surface Laptop Go 3"],
  },
  Desktop: {
    Dell: ["OptiPlex 7090", "OptiPlex 7010", "Precision 3660", "Vostro 3030"],
    HP: ["ProDesk 400 G9", "EliteDesk 800 G9", "Pavilion Desktop"],
    Lenovo: ["ThinkCentre M70q", "ThinkCentre M90q", "IdeaCentre 3"],
    Asus: ["ExpertCenter D5", "ROG Strix GT"],
    Acer: ["Veriton X", "Aspire TC"],
  },
  Monitor: {
    Lenovo: ["ThinkVision T24", "ThinkVision T27", "ThinkVision P27h"],
    Dell: ["P2422H", "U2722D", "E2423H"],
    HP: ["E24 G5", "Z24f G3", "M27f"],
    LG: ["24MP88", "27UL850", "27GN800"],
    Samsung: ["S24R350", "27\" UR55", "Odyssey G5"],
    BenQ: ["GW2480", "PD2700Q"],
    Acer: ["KA242Y", "CB242Y"],
  },
  Keyboard: {
    Dell: ["KB216", "KM5221W", "KB522"],
    Logitech: ["K380", "K120", "MX Keys", "MK270"],
    HP: ["225 USB Keyboard", "350 Compact"],
    Lenovo: ["ThinkPad TrackPoint Keyboard", "Go Wireless"],
    Zebronics: ["Zeb-KM2100", "Zeb-Companion 2"],
  },
  Mouse: {
    Dell: ["MS116", "WM126", "MS5320W"],
    Logitech: ["M185", "M331", "MX Master 3", "M650"],
    HP: ["FM710A", "X500", "280 Silent"],
    Lenovo: ["Go Wireless", "ThinkPad USB-C"],
    Zebronics: ["Zeb-Blaze", "Zeb-Jaguar"],
  },
  UPS: {
    Microtek: ["Legend 650", "Legend 1000", "Energy Save 1500"],
    APC: ["Back-UPS 600", "Back-UPS 1100", "Smart-UPS 1500"],
    Emerson: ["Liebert GXT4", "Liebert PSI"],
    Eaton: ["5E 650i", "5E 1100i"],
    Luminous: ["Pro 600", "Zelio 1100"],
  },
  Printer: {
    HP: ["Smart Tank 580", "Smart Tank 589", "LaserJet Pro M404", "M126nw"],
    Canon: ["LBP6030", "imageCLASS MF301", "PIXMA G3730"],
    Epson: ["L3250", "L6290", "DS-530"],
    Brother: ["DCP-L2520D", "HL-L2351DW"],
  },
  "QR Scanner": {
    Tera: ["HW0002", "HW0008", "D5100"],
    Zebra: ["DS2208", "LI4278", "DS8108"],
    Honeywell: ["1900GHD", "1470G"],
    Datalogic: ["QuickScan QD2430", "Gryphon GD4500"],
  },
  "Network Switch": {
    "TP-Link": ["TL-SG108E", "TL-SG116E", "TL-SG1024DE"],
    Cisco: ["Catalyst 2960", "CBS350-8T"],
    "D-Link": ["DGS-108", "DGS-1210-08"],
    Netgear: ["GS108", "GS308"],
    HPE: ["Aruba 1930 8G", "OfficeConnect 1820"],
  },
  Camera: {
    Hikvision: ["DS-2CD1023G0", "DS-2CD2043G2"],
    "CP Plus": ["CP-PLUS Dome", "CP-PLUS Bullet"],
    Dahua: ["DH-IPC-HFW1230S", "DH-IPC-HDBW1230E"],
    "TP-Link VIGI": ["C400", "C200", "C500"],
  },
  NVR: {
    "TP-Link VIGI": ["NVR1008H", "NVR1016H"],
    Hikvision: ["DS-7104NI", "DS-7604NI"],
    Dahua: ["NVR4104", "NVR4216"],
    "CP Plus": ["CP-UVR-0401E1", "CP-UVR-0801E1"],
  },
  "Network Rack": {
    Netrack: ["9U Wall Mount", "15U Floor", "42U Server Rack"],
    APW: ["6U Wall", "12U Floor"],
    Rittal: ["TS IT 19\"", "AX Compact"],
  },
  "Laptop Kit": {
    Dell: ["Latitude Kit", "Mobile Workstation Kit"],
    HP: ["EliteBook Kit", "ProBook Kit"],
    Lenovo: ["ThinkPad Kit", "Travel Kit"],
  },
  "Attendance Machine": {
    ZKTeco: ["K40 Pro", "iClock 680", "MB360"],
    eSSL: ["K21 Pro", "F18", "X990"],
    Realtime: ["T502", "RS20"],
    Hikvision: ["DS-K1T671M", "DS-K1T804A"],
  },
  "External HDD": {
    Seagate: ["Backup Plus 1TB", "Expansion 2TB", "Portable 4TB"],
    "Western Digital": ["My Passport 1TB", "Elements 2TB"],
    Toshiba: ["Canvio Basics 1TB", "Canvio Advance 2TB"],
    Samsung: ["T7 Shield 1TB", "T7 2TB"],
  },
  "Access Point": {
    "TP-Link": ["EAP225", "EAP245", "Archer AX23"],
    Cisco: ["Meraki MR36", "Catalyst 9120"],
    Ubiquiti: ["UniFi AP AC Lite", "UniFi 6 Lite"],
    "D-Link": ["DAP-2610", "DAP-1860"],
    Aruba: ["AP-505", "Instant On AP22"],
  },
  Firewall: {
    Fortinet: ["FortiGate 60F", "FortiGate 100F", "FortiGate 200F"],
    Cisco: ["ASA 5506", "Firepower 1010"],
    SonicWall: ["TZ270", "TZ470"],
    pfSense: ["SG-1100", "Netgate 4100"],
    WatchGuard: ["T20", "T40"],
  },
  "Network Controller": {
    Cisco: ["3504 WLC", "9800-CL", "Catalyst 9800-L"],
    Aruba: ["7005", "9012"],
    "TP-Link Omada": ["OC200", "OC300"],
    Ruckus: ["R350", "SmartZone 100"],
  },
};

/** Map Input/Output Device peripheral picks to catalog keys. */
export function catalogKeyForAssetType(assetType: string): string {
  if (DEFAULT_BRANDS_BY_TYPE[assetType]) return assetType;
  return assetType;
}

// Company-Level Main Categories and sheet mappings
export const MAIN_CATEGORIES = [
  "IT Assets",
  "Office Assets",
  "Electrical Assets",
  "Production Assets",
  "Safety Assets",
  "Vehicle Assets",
  "Furniture Assets",
  "Software / License Assets",
  "Admin / Facility Assets",
  "Maintenance Assets"
] as const;

export type MainCategory = typeof MAIN_CATEGORIES[number];

export const CATEGORY_SHEET_MAP: Record<string, string> = {
  "IT Assets": "IT Assets",
  "Office Assets": "Office Assets",
  "Electrical Assets": "Electrical Assets",
  "Production Assets": "Production Assets",
  "Safety Assets": "Safety Assets",
  "Vehicle Assets": "Vehicle Assets",
  "Furniture Assets": "Furniture Assets",
  "Software / License Assets": "Software License Assets",
  "Admin / Facility Assets": "Admin Facility Assets",
  "Maintenance Assets": "Maintenance Assets"
};

export const CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
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
  "Office Assets": [
    "Table",
    "Chair",
    "Almirah",
    "File Cabinet",
    "Sofa",
    "Whiteboard",
    "Fan",
    "AC",
    "Water Dispenser",
    "Refrigerator",
    "Tea/Coffee Machine",
    "Other Office Asset"
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
    "Meeting Table",
    "Rack",
    "Storage Box",
    "Bench",
    "Visitor Chair",
    "Locker",
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
  "Admin / Facility Assets": [
    "Housekeeping Item",
    "Pantry Item",
    "Security Equipment",
    "Attendance Machine",
    "Visitor Gate Pass Device",
    "PA System",
    "Projector",
    "Speaker",
    "Mic",
    "Other Admin / Facility Asset"
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
    "Measuring Tape",
  ]
};

export const SUB_TO_MAIN_MAP: Record<string, string> = {};
Object.entries(CATEGORY_SUBCATEGORIES).forEach(([main, subs]) => {
  subs.forEach(sub => {
    SUB_TO_MAIN_MAP[sub] = main;
  });
});

export const PERIPHERAL_TYPES = [
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

/** Map sheet / legacy category labels to sidebar main categories. */
const MAIN_CATEGORY_ALIASES: Record<string, string> = {
  it: 'IT Assets',
  'it assets': 'IT Assets',
  'software license assets': 'Software / License Assets',
  'admin facility assets': 'Admin / Facility Assets',
  'production manufacturing assets': 'Production Assets',
};

/** Asset-code prefix → main category (matches server/assetCodeGenerator.ts). */
const CODE_PREFIX_TO_MAIN: Record<string, string> = {
  IT: 'IT Assets',
  OFF: 'Office Assets',
  ELE: 'Electrical Assets',
  PRD: 'Production Assets',
  SAF: 'Safety Assets',
  VEH: 'Vehicle Assets',
  FUR: 'Furniture Assets',
  SW: 'Software / License Assets',
  ADM: 'Admin / Facility Assets',
  MNT: 'Maintenance Assets',
};

/** Return canonical main category if `value` is a known category label, else null. */
export function matchMainCategoryLabel(value: string): string | null {
  const trimmed = (value || '').trim();
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

function mainCategoryFromAssetCode(code: string): string | null {
  const m = String(code || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)-/);
  if (!m) return null;
  return CODE_PREFIX_TO_MAIN[m[1]] || null;
}

/**
 * Repair rows where a column shift put the main category into subCategory/assetType
 * (common with legacy misaligned Google Sheet columns).
 */
export function healMisalignedCategoryFields(input: {
  mainCategory?: string;
  subCategory?: string;
  assetType?: string;
  make?: string;
  assetCode?: string;
}): { mainCategory: string; subCategory: string; assetType: string } {
  let main = (input.mainCategory || '').trim();
  let sub = (input.subCategory || '').trim();
  let type = (input.assetType || '').trim();
  const make = (input.make || '').trim();

  const mainFromSub = matchMainCategoryLabel(sub);
  const mainFromType = matchMainCategoryLabel(type);

  if (mainFromSub && !matchMainCategoryLabel(main)) {
    main = mainFromSub;
    if (mainFromType) {
      type = make;
      sub = '';
    } else if (matchMainCategoryLabel(type)) {
      type = make;
      sub = '';
    } else {
      sub = type;
      type = make;
    }
  } else if (mainFromType && !matchMainCategoryLabel(main)) {
    main = mainFromType;
    type = make || sub;
    if (matchMainCategoryLabel(sub)) sub = '';
  }

  if (!matchMainCategoryLabel(main)) {
    const fromCode = mainCategoryFromAssetCode(input.assetCode || '');
    if (fromCode) main = fromCode;
  }

  main = normalizeMainCategory(main, {
    subCategory: sub,
    assetType: type,
    assetCode: input.assetCode,
  });

  if (matchMainCategoryLabel(sub)) sub = '';
  if (matchMainCategoryLabel(type)) type = make || sub;

  if (main === 'IT Assets' && !type && (make === 'Laptop' || make === 'Desktop')) {
    type = make;
  }

  if (main === 'IT Assets' && type && !sub) {
    sub = subCategoryForItAssetType(type);
  }

  return { mainCategory: main, subCategory: sub, assetType: type };
}

/** Normalize any stored/sheet category value to a sidebar main category. */
export function normalizeMainCategory(
  main: string,
  hints?: { subCategory?: string; assetType?: string; assetCode?: string }
): string {
  const trimmed = (main || '').trim();
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
  if (type === 'Laptop' || type === 'Desktop') return 'IT Assets';
  if (type && (PERIPHERAL_TYPES as readonly string[]).includes(type)) return 'IT Assets';

  const fromCode = hints?.assetCode ? mainCategoryFromAssetCode(hints.assetCode) : null;
  if (fromCode) return fromCode;

  if (!trimmed) return 'IT Assets';
  return trimmed;
}

/** Top-level IT asset type tabs in the asset form (Camera/NVR use combined sidebar + type picker). */
export const IT_PRIMARY_TYPES = [
  "Laptop",
  "Desktop",
  "Input/Output Device",
] as const;

export const CCTV_IT_TYPES = ["Camera", "NVR"] as const;

/** Device grid under Input/Output Device — excludes Camera/NVR (top-level tabs). */
export const PERIPHERAL_GRID_TYPES = PERIPHERAL_TYPES.filter(
  (t) => t !== "Camera" && t !== "NVR"
);

export function subCategoryForItAssetType(assetType: string): string {
  if (assetType === "Laptop" || assetType === "Desktop") return "Laptop / Desktop";
  if (assetType === "Camera" || assetType === "NVR") return "CCTV / Security Device";
  if (["Keyboard", "Mouse", "QR Scanner"].includes(assetType)) return "Input Device";
  if (assetType === "Monitor") return "Output Device";
  if (
    ["Network Switch", "Network Rack", "Access Point", "Firewall", "Network Controller"].includes(
      assetType
    )
  ) {
    return "Network Device";
  }
  if (assetType === "External HDD") return "Storage Device";
  if (assetType === "Printer") return "Printer / Scanner";
  if (assetType === "UPS") return "Server / UPS";
  return "Other IT Asset";
}
