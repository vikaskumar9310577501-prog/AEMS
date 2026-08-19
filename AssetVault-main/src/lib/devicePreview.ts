/**
 * Device and Asset preview images — local photos or offline-safe CDN.
 */
const PREVIEW_BASE: Record<string, string> = {
  Laptop: "/device-previews/laptop.jpg",
  Desktop: "/device-previews/desktop.jpg",
  Monitor: "/device-previews/monitor.jpg",
  Keyboard: "/device-previews/keyboard.jpg",
  Mouse: "/device-previews/mouse.jpg",
  Printer: "/device-previews/printer.jpg",
  Scanner: "/device-previews/qr-scanner.jpg",
  Router: "/device-previews/access-point.jpg",
  UPS: "/device-previews/ups.jpg",
  "Network Switch": "/device-previews/network-switch.jpg",
  "Access Point": "/device-previews/access-point.jpg",
  "QR Scanner": "/device-previews/qr-scanner.jpg",
  Camera: "/device-previews/camera.jpg",
  NVR: "/device-previews/nvr.jpg",
  Firewall: "/device-previews/firewall.jpg",
  "Network Controller": "/device-previews/network-controller.jpg",
  "Network Rack": "/device-previews/network-rack.jpg",
  "Laptop Kit": "/device-previews/laptop-kit.jpg",
  "Attendance Machine": "/device-previews/attendance-machine.jpg",
  "External HDD": "/device-previews/external-hdd.jpg",
};

const TYPE_ALIASES: Record<string, string> = {
  "Input/Output Device": "Monitor",
};

const REMOTE_FALLBACK: Record<string, string> = {
  Laptop:
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
  Desktop:
    "https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=900&q=85",
  Monitor:
    "https://images.unsplash.com/photo-1527443228754-95e86e724b91?auto=format&fit=crop&w=900&q=85",
};

export function getDevicePreviewUrl(assetType: string): string {
  const key = TYPE_ALIASES[assetType] || assetType;
  return PREVIEW_BASE[key] || PREVIEW_BASE.Laptop || REMOTE_FALLBACK.Laptop;
}

export function getDevicePreviewFallbackUrl(assetType: string): string {
  const key = TYPE_ALIASES[assetType] || assetType;
  return REMOTE_FALLBACK[key] || REMOTE_FALLBACK.Laptop;
}

export function getDevicePreviewLabel(assetType: string): string {
  return assetType;
}

// ============================================================
// Enterprise Expansion Preview Mappings
// ============================================================

const DEFAULT_PREVIEW = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85";

const CATEGORY_DEFAULTS: Record<string, string> = {
  "IT Assets": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
  "Office Assets": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=85",
  "Electrical Assets": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=85",
  "Production Assets": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=85",
  "Production / Manufacturing Assets": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=85",
  "Production Manufacturing Assets": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=85",
  "Safety Assets": "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=900&q=85",
  "Vehicle Assets": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=85",
  "Furniture Assets": "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=85",
  "Software / License Assets": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=85",
  "Software License Assets": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=85",
  "Admin / Facility Assets": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85",
  "Admin Facility Assets": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85",
  "Maintenance Tools": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85",
  "Maintenance Assets": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85"
};

const SUBCATEGORY_PREVIEWS: Record<string, string> = {
  // Office Assets subcategories
  "Fan": "https://images.unsplash.com/photo-1618943716942-835697d8b51a?auto=format&fit=crop&w=900&q=85",
  "AC": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=900&q=85",
  "Sofa": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85",
  "Table": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=85",
  "Chair": "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=900&q=85",
  "Water Dispenser": "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=85",
  "Refrigerator": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=85",
  "Tea/Coffee Machine": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85",
  "Almirah": "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=900&q=85",
  "File Cabinet": "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=900&q=85",
  
  // Electrical subcategories
  "Generator": "https://images.unsplash.com/photo-1590373977797-4028bc166d3a?auto=format&fit=crop&w=900&q=85",
  "Inverter": "https://images.unsplash.com/photo-1620288627223-53302f4e8c74?auto=format&fit=crop&w=900&q=85",
  "Battery": "https://images.unsplash.com/photo-1626908013351-800ddd734b8a?auto=format&fit=crop&w=900&q=85",
  "Stabilizer": "https://images.unsplash.com/photo-1601524909162-be87252be298?auto=format&fit=crop&w=900&q=85",
  "Control Panel": "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?auto=format&fit=crop&w=900&q=85",
  "LED Lights": "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&w=900&q=85",
  
  // Production / Manufacturing subcategories
  "Machine": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=85",
  "Conveyor Belt": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=900&q=85",
  "Welding Machine": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=85",
  "Drill Machine": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=85",
  "Compressor": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=85",
  "Mould": "https://images.unsplash.com/photo-1537462715879-360eeb61a0bc?auto=format&fit=crop&w=900&q=85",
  "Die": "https://images.unsplash.com/photo-1537462715879-360eeb61a0bc?auto=format&fit=crop&w=900&q=85",
  
  // Safety subcategories
  "Fire Extinguisher": "https://images.unsplash.com/photo-1606248981604-db8fb726715f?auto=format&fit=crop&w=900&q=85",
  "First Aid Box": "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=85",
  "Safety Helmet": "https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=900&q=85",
  "Safety Shoes": "https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=900&q=85",
  "Gloves": "https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=900&q=85",
  
  // Vehicle subcategories
  "Company Car": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=85",
  "Bike": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85",
  "Truck": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=85",
  "Forklift": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=85",
  
  // Furniture subcategories
  "Workstation": "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=900&q=85",
  "Meeting Table": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=85",
  "Rack": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=85",
  
  // Software / Admin / Tools
  "Projector": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85",
  "Attendance Machine": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=85",
  "Ladder": "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=900&q=85",
  "Multimeter": "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=85"
};

export function getAssetPreviewUrl(
  mainCategory: string,
  subCategory: string,
  assetType: string,
  subCategoryImages?: Record<string, string>,
  softwareSubCategoryImages?: Record<string, string>
): string {
  if (mainCategory === "IT Assets") {
    if (assetType && subCategoryImages?.[assetType]) {
      return subCategoryImages[assetType];
    }
    return getDevicePreviewUrl(assetType);
  }

  if (subCategory && subCategoryImages?.[subCategory]) {
    return subCategoryImages[subCategory];
  }

  if (
    mainCategory === "Software / License Assets" &&
    subCategory &&
    softwareSubCategoryImages?.[subCategory]
  ) {
    return softwareSubCategoryImages[subCategory];
  }
  
  // 1. Try exact subCategory match
  if (subCategory && SUBCATEGORY_PREVIEWS[subCategory]) {
    return SUBCATEGORY_PREVIEWS[subCategory];
  }
  
  // 2. Try partial subCategory match (e.g., "Office Sofa" contains "Sofa")
  if (subCategory) {
    const cleanSub = subCategory.toLowerCase();
    const key = Object.keys(SUBCATEGORY_PREVIEWS).find(
      (k) => cleanSub.includes(k.toLowerCase()) || k.toLowerCase().includes(cleanSub)
    );
    if (key) return SUBCATEGORY_PREVIEWS[key];
  }
  
  // 3. Try mainCategory default
  if (mainCategory && CATEGORY_DEFAULTS[mainCategory]) {
    return CATEGORY_DEFAULTS[mainCategory];
  }
  
  return DEFAULT_PREVIEW;
}
