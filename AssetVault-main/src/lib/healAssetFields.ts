/**
 * Repairs assets whose sheet cells were written under the wrong headers
 * (legacy positional writes). Uses value patterns, not column index.
 */

import { PERIPHERAL_TYPES } from './assetCatalogByType';
import { inferCategoryAssetType } from './assetDisplay';

const LOCATION_NAMES = new Set([
  'BHIWADI',
  'NOIDA',
  'HEAD OFFICE',
  'HEAD OFFICE NOIDA',
  'GURGAON',
  'MANESAR',
  'PUNE',
  'CHENNAI',
  'HYDERABAD',
]);

const DEPARTMENTS = new Set([
  'IT',
  'ADMIN',
  'SECURITY',
  'STORE',
  'PRODUCTION',
  'QUALITY',
  'HR',
  'FINANCE',
  'ACCOUNTS',
  'MAINTENANCE',
  'ENGINEERING',
  'PURCHASE',
  'LOGISTICS',
]);

const STATUS_VALUES = new Set(['AVAILABLE', 'ASSIGNED', 'IN REPAIR', 'RETIRED', 'DISPOSED']);
const CONDITION_VALUES = new Set(['NEW PURCHASE', 'EXISTING ASSETS', 'EXISTING ASSET']);

type Healable = Record<string, unknown>;

function trim(v: unknown): string {
  return String(v ?? '').trim();
}

function isLikelyEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value);
}

function isLikelyDate(value: string): boolean {
  const v = trim(value);
  if (!v) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(v)) return true;
  const n = Date.parse(v);
  return !Number.isNaN(n);
}

function isLikelyPhone(value: string): boolean {
  const digits = trim(value).replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

function isPoNumber(value: string): boolean {
  return /^PO[-\s]?\d+/i.test(trim(value));
}

function isScanUrl(value: string): boolean {
  return /\/scan\/[^/?#\s]+/i.test(trim(value));
}

function isDriveUrl(value: string): boolean {
  return /drive\.google\.com/i.test(trim(value));
}

function looksLikePlantCode(value: string): boolean {
  const v = trim(value);
  return /^\d{3,5}$/.test(v);
}

function looksLikeLocationName(value: string): boolean {
  const u = trim(value).toUpperCase();
  if (!u || u.length < 3) return false;
  if (LOCATION_NAMES.has(u)) return true;
  return /^[A-Z][A-Z\s]{2,}$/.test(u) && !looksLikeDepartment(value) && !isLikelyEmail(value);
}

function looksLikeDepartment(value: string): boolean {
  const u = trim(value).toUpperCase();
  if (!u) return false;
  if (DEPARTMENTS.has(u)) return true;
  return ['SECURITY', 'ADMIN', 'STORE', 'PRODUCTION', 'QUALITY'].some((d) => u.includes(d));
}

function looksLikeEmployeeId(value: string): boolean {
  const v = trim(value).toUpperCase();
  if (!v) return false;
  if (/^(NGM|PGTL|PGEL|EMP|PG)\d+/i.test(v)) return true;
  if (/^[A-Z]{2,5}\d{3,}$/.test(v)) return true;
  return false;
}

function looksLikePersonName(value: string): boolean {
  const v = trim(value);
  if (!v || isLikelyEmail(v) || isLikelyDate(v) || looksLikeEmployeeId(v)) return false;
  return /\s/.test(v) && /^[A-Za-z\s.'-]+$/.test(v);
}

function looksLikeVendorName(value: string): boolean {
  const v = trim(value);
  if (!v || isPoNumber(v) || isLikelyDate(v)) return false;
  return /\b(LTD|PVT|PRIVATE|LIMITED|INC|CORP|CO\.)\b/i.test(v) || v.split(/\s+/).length >= 2;
}

function looksLikeAccountAssetCode(value: string): boolean {
  return /^(AST|ACC)-[\w-]+$/i.test(trim(value));
}

function isLikelyRam(value: string): boolean {
  return /^\d+\s*GB$/i.test(trim(value)) || /^[\d.]+\s*GB\s*RAM$/i.test(trim(value));
}

function isLikelyStorage(value: string): boolean {
  const v = trim(value);
  return /^\d+\s*(GB|TB)$/i.test(v) || /NVMe|SSD|HDD/i.test(v);
}

function isLikelyCpu(value: string): boolean {
  return /core\s*i[3579]|ryzen|celeron|pentium|xeon|apple\s*m/i.test(trim(value));
}

function isLikelyWindows(value: string): boolean {
  return /windows\s*\d+/i.test(trim(value));
}

function isLikelyMac(value: string): boolean {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(trim(value));
}

function isLikelyIp(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(trim(value));
}

function normalizeDateOnly(value: string): string {
  const v = trim(value);
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}

function healMakeModelBlock(a: Healable): void {
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

function healAccountAssetCode(a: Healable): void {
  const assetName = trim(a.assetName);
  if (looksLikeAccountAssetCode(assetName) && !trim(a.accountAssetCode)) {
    a.accountAssetCode = assetName;
    const type = trim(a.assetType);
    const make = trim(a.make);
    const model = trim(a.model);
    a.assetName = [type, make, model].filter(Boolean).join(' ').trim();
  }
}

function healQuantity(a: Healable): void {
  const q = trim(a.quantity);
  if (!q) {
    a.quantity = '1';
    return;
  }
  if (isLikelyPhone(q)) {
    if (!trim(a.contactMobile)) a.contactMobile = q;
    a.quantity = '1';
    return;
  }
  if (!/^\d+$/.test(q)) a.quantity = '1';
}

function healSerialNumber(a: Healable): void {
  const serial = trim(a.serialNumber);
  const model = trim(a.model);
  if (!serial || !model || serial !== model) return;

  const q = trim(a.quantity);
  if (q && !isLikelyPhone(q) && q !== serial && q.length >= 4 && !/^\d+$/.test(q)) {
    a.serialNumber = q;
    a.quantity = '1';
  } else {
    a.serialNumber = '';
  }
}

function itFieldsLookShifted(a: Healable): boolean {
  const ssd = trim(a.ssd);
  const cpu = trim(a.cpu);
  const mac = trim(a.macAddress);
  const ip = trim(a.ipAddress);
  const ram = trim(a.ram);
  return (
    isLikelyRam(ssd) ||
    (isLikelyStorage(cpu) && !isLikelyCpu(cpu)) ||
    isLikelyCpu(trim(a.windowsVersion)) ||
    isLikelyMac(ip) ||
    isLikelyWindows(mac) ||
    (isLikelyIp(trim(a.hostName)) && !isLikelyIp(ip)) ||
    (isLikelyRam(ram) && !trim(a.ssd))
  );
}

function healItSpecBlock(a: Healable): void {
  const ram = trim(a.ram);
  if (isLikelyPhone(ram) && !isLikelyRam(ram)) {
    if (!trim(a.contactMobile)) a.contactMobile = ram;
    a.ram = '';
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
    a.cpu = isLikelyCpu(win) ? win : '';
    a.windowsVersion = isLikelyWindows(mac) ? mac : '';
  } else {
    if (isLikelyStorage(cpu)) a.ssd = cpu;
    if (isLikelyCpu(win)) a.cpu = win;
    if (isLikelyWindows(mac)) a.windowsVersion = mac;
  }

  if (isLikelyMac(ip)) {
    a.macAddress = ip;
    a.ipAddress = isLikelyIp(host) ? host : '';
    a.hostName = '';
  } else if (isLikelyMac(host)) {
    a.macAddress = host;
    a.ipAddress = isLikelyIp(ip) ? ip : '';
    a.hostName = '';
  } else if (isLikelyIp(host) && !isLikelyIp(ip)) {
    a.ipAddress = host;
    a.hostName = '';
  }
}

function healLocationEmployeeShift(a: Healable): void {
  const location = trim(a.location);
  const department = trim(a.department);
  const plantCode = trim(a.plantCode);
  const contactName = trim(a.contactName);

  if (looksLikeEmployeeId(location) && looksLikeLocationName(department)) {
    a.location = department;
    a.employeeId = location;
    if (looksLikeDepartment(contactName)) {
      a.department = contactName;
      a.contactName = '';
    }
    if (/^\d{1,2}$/.test(plantCode)) {
      a.plantCode = '';
    }
  }
}

function healLocationAssigneeBlock(a: Healable): void {
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
      const purchaseDateField = trim(a.purchaseDate);
      if (looksLikeEmployeeId(purchaseDateField)) {
        a.employeeId = purchaseDateField;
      } else if (looksLikeEmployeeId(employeeField)) {
        a.employeeId = employeeField;
        a.contactName = '';
      }
    }
  }

  const purchaseDateField = trim(a.purchaseDate);
  const purchaseCost = trim(a.purchaseCost);
  if (looksLikeEmployeeId(purchaseDateField)) {
    a.employeeId = purchaseDateField;
    if (isLikelyDate(purchaseCost)) {
      a.purchaseDate = normalizeDateOnly(purchaseCost);
      a.purchaseCost = '';
    } else {
      a.purchaseDate = '';
    }
  } else if (isLikelyDate(purchaseCost) && !trim(a.purchaseDate)) {
    a.purchaseDate = normalizeDateOnly(purchaseCost);
    a.purchaseCost = '';
  }
}

function healVendorInvoiceBlock(a: Healable): void {
  const invoice = trim(a.invoiceNumber);
  const warrantyStart = trim(a.warrantyStartDate);
  const vendor = trim(a.vendorName);

  if (invoice && !isPoNumber(invoice) && !vendor && !isLikelyDate(invoice) && !isLikelyEmail(invoice)) {
    a.vendorName = invoice;
    a.invoiceNumber = '';
  }

  if (isPoNumber(warrantyStart)) {
    if (!trim(a.invoiceNumber)) a.invoiceNumber = warrantyStart;
    a.warrantyStartDate = '';
  }

  const invoiceAfter = trim(a.invoiceNumber);
  const vendorAfter = trim(a.vendorName);
  if (invoiceAfter && !isPoNumber(invoiceAfter) && looksLikeVendorName(invoiceAfter) && !vendorAfter) {
    a.vendorName = invoiceAfter;
    a.invoiceNumber = isPoNumber(warrantyStart) ? warrantyStart : '';
  }
}

function healContactMobile(a: Healable): void {
  const mobile = trim(a.contactMobile);
  const ram = trim(a.ram);

  if (isLikelyDate(mobile)) {
    if (!trim(a.purchaseDate)) a.purchaseDate = normalizeDateOnly(mobile);
    if (isLikelyPhone(ram)) {
      a.contactMobile = ram;
      if (!isLikelyRam(ram)) a.ram = '';
    } else {
      a.contactMobile = '';
    }
    return;
  }

  if (!isLikelyPhone(mobile) && isLikelyPhone(ram) && !isLikelyRam(ram)) {
    a.contactMobile = ram;
    a.ram = '';
  }
}

function healUrlBlock(a: Healable): void {
  const additional = trim(a.additionalItems);
  const qr = trim(a.qrCodeText);
  const doc = trim(a.documentUrl);
  let img = trim(a.imageUrl);

  const scanUrl = isScanUrl(additional)
    ? additional
    : isScanUrl(qr)
      ? qr
      : '';
  const drives = [doc, qr, img].filter((u) => isDriveUrl(u) && !isScanUrl(u));
  const uniqueDrives = [...new Set(drives)];

  if (isScanUrl(additional)) a.additionalItems = '';
  if (scanUrl) a.qrCodeText = scanUrl;

  if (!img && uniqueDrives.length > 0) {
    a.imageUrl = uniqueDrives[0];
    img = uniqueDrives[0];
  } else if (img) {
    a.imageUrl = img;
  }

  const docDrive = uniqueDrives.find((u) => u !== trim(a.imageUrl));
  if (docDrive) {
    a.documentUrl = docDrive;
  } else if (isDriveUrl(doc) && doc !== trim(a.imageUrl)) {
    a.documentUrl = doc;
  }
}

function healStatusCondition(a: Healable): void {
  const status = trim(a.status).toUpperCase();
  const maintenance = trim(a.maintenanceRequired);
  const existingCondition = trim(a.condition).toUpperCase();

  if (CONDITION_VALUES.has(status)) {
    if (!existingCondition || existingCondition === status) {
      a.condition = status.replace('EXISTING ASSET', 'EXISTING ASSETS');
    }
    a.status = trim(a.employeeId) || trim(a.contactName) ? 'Assigned' : 'Available';
  }

  if (STATUS_VALUES.has(maintenance.toUpperCase())) {
    a.maintenanceRequired = 'No';
    if (!trim(a.employeeId) && !trim(a.contactName)) {
      a.status = maintenance;
    }
  } else if (maintenance.toLowerCase() === 'no' && trim(a.lastMaintenanceDate).toLowerCase() === 'available') {
    a.status = 'Available';
    a.lastMaintenanceDate = '';
  }

  if (trim(a.lastMaintenanceDate).toLowerCase() === 'no') {
    a.lastMaintenanceDate = '';
  }

  if (trim(a.employeeId) || trim(a.contactName)) {
    a.status = 'Assigned';
  }
}

function healAssignedDateBlock(a: Healable): void {
  const assigned = trim(a.assignedDate);
  const empId = trim(a.employeeId);
  const contact = trim(a.contactName);
  const hasAssignee = !!(empId || contact);

  if (looksLikeEmployeeId(assigned)) {
    if (!empId) a.employeeId = assigned;
    a.assignedDate = '';
  }

  if (hasAssignee && !trim(a.assignedDate)) {
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

function healWrongItTypeOnNonItAsset(a: Healable): void {
  const main = trim(a.mainCategory);
  if (!main || main === 'IT Assets') return;

  const type = trim(a.assetType);
  const itTypes = new Set<string>(['Laptop', 'Desktop', ...PERIPHERAL_TYPES]);
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
    if (!sub || itTypes.has(sub) || sub === 'Laptop / Desktop') {
      a.subCategory = inferred;
    }
    if (a.assetTypeId === 'laptop' || a.assetTypeId === 'desktop') {
      a.assetTypeId = '';
    }
  }
}

function healAuditFields(a: Healable): void {
  const createdBy = trim(a.createdBy);
  const createdDate = trim(a.createdDate);
  const updatedBy = trim(a.updatedBy);
  const updatedDate = trim(a.updatedDate);

  if (!createdBy && isLikelyEmail(createdDate)) {
    a.createdBy = createdDate;
    a.createdDate = isLikelyDate(updatedBy) ? normalizeDateOnly(updatedBy) : '';
  }

  if (isLikelyDate(updatedBy) && isLikelyEmail(updatedDate)) {
    a.updatedDate = normalizeDateOnly(updatedBy);
    a.updatedBy = updatedDate;
  } else if (isLikelyDate(updatedBy) && !updatedDate) {
    a.updatedDate = normalizeDateOnly(updatedBy);
    a.updatedBy = '';
  } else if (!updatedBy && isLikelyEmail(updatedDate)) {
    a.updatedBy = updatedDate;
  }
}

/** Repair column-shift corruption on a single asset record. Safe to run on every read. */
export function healMisalignedAssetFields<T>(asset: T): T {
  if (!asset || typeof asset !== 'object') return asset;

  const a = { ...(asset as Record<string, unknown>) };

  healMakeModelBlock(a);
  healAccountAssetCode(a);
  healQuantity(a);
  healSerialNumber(a);
  healLocationEmployeeShift(a);
  healLocationAssigneeBlock(a);
  healVendorInvoiceBlock(a);
  healContactMobile(a);
  healItSpecBlock(a);
  healUrlBlock(a);
  healStatusCondition(a);
  healWrongItTypeOnNonItAsset(a);
  healAssignedDateBlock(a);
  healAuditFields(a);

  return a as T;
}

/** Batch heal for lists from API / cache. */
export function healMisalignedAssetList<T>(assets: T[]): T[] {
  return assets.map((item) => healMisalignedAssetFields(item));
}
