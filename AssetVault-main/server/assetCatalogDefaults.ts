export interface AssetCatalog {
  brands: Record<string, string[]>;
  vendors: string[];
  departments: string[];
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
    departments: [...DEFAULT_DEPARTMENTS],
  };
}

export function mergeCatalog(saved?: any): any {
  const base = defaultCatalog();
  if (!saved) return base;
  const brands = { ...base.brands };
  if (saved.brands) {
    for (const [brand, models] of Object.entries(saved.brands as Record<string, string[]>)) {
      const existing = brands[brand] || [];
      brands[brand] = Array.from(new Set([...existing, ...(models || [])]));
    }
  }
  return {
    ...saved,
    brands,
    vendors: Array.from(new Set([...base.vendors, ...(saved.vendors || [])])).sort(),
    departments: Array.from(
      new Set([...base.departments, ...(saved.departments || [])])
    ).sort(),
  };
}
