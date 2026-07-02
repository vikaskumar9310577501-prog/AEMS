import type { Asset, AssetFormData } from '../types';
import { PERIPHERAL_TYPES } from './assetCatalogByType';
import { assetToFormData } from './formAsset';

function isCctvSecurityAsset(formData: Pick<AssetFormData, 'assetTypeId' | 'assetType' | 'subCategory'>): boolean {
  return (
    formData.assetTypeId === 'cctv_security' ||
    formData.assetType === 'Camera' ||
    formData.assetType === 'NVR' ||
    formData.subCategory === 'CCTV / Security Device'
  );
}

/** Sanitize form payload before save (same rules as server-side expectations). */
export function buildCleanedSubmitPayload(formData: AssetFormData): AssetFormData {
  const isIT = (formData.mainCategory || 'IT Assets') === 'IT Assets';
  const isLaptopOrDesktop =
    formData.assetTypeId === 'laptop' ||
    formData.assetTypeId === 'desktop' ||
    (isIT && ['Laptop', 'Desktop'].includes(formData.assetType));
  const isDesktop = isIT && formData.assetType === 'Desktop';
  const isPeripheral = isIT && PERIPHERAL_TYPES.includes(formData.assetType);
  const isCctvSecurity = isCctvSecurityAsset(formData);

  let cleanRemarks = formData.additionalItems || '';
  const tLower = String(formData.assetType || '').toLowerCase();
  const allowedTypes = ['laptop', 'desktop', 'input device', 'output device', 'laptop / desktop'];
  const isAllowed = allowedTypes.some((t) => tLower.includes(t));
  if (!isAllowed && cleanRemarks) {
    const wordsToRemove = ['case', 'charger', 'adapter', 'adpater', 'etc'];
    for (const word of wordsToRemove) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleanRemarks = cleanRemarks.replace(regex, '');
    }
    cleanRemarks = cleanRemarks
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .replace(/,\s*\./g, '.')
      .replace(/^\s*,\s*/g, '')
      .replace(/,\s*$/g, '')
      .trim();
    if (cleanRemarks === '.' || cleanRemarks === ',' || cleanRemarks === ',.') {
      cleanRemarks = '';
    }
  }

  const details = formData.dynamicDetails || {};
  const ipFromDynamic = String(details.ip_address || details.ipAddress || '').trim();
  const hostFromDynamic = String(
    details.host_name ||
      details.hostname ||
      details.hostName ||
      details.location_name ||
      ''
  ).trim();

  return {
    ...formData,
    dynamicDetails: formData.dynamicDetails || {},
    assetTypeId: formData.assetTypeId || (isCctvSecurity ? 'cctv_security' : ''),
    assetType: formData.assetType,
    subCategory:
      formData.subCategory ||
      (isCctvSecurity ? 'CCTV / Security Device' : formData.subCategory),
    ram: isLaptopOrDesktop ? formData.ram : '',
    ssd: isLaptopOrDesktop ? formData.ssd : '',
    cpu: isLaptopOrDesktop ? formData.cpu : '',
    windowsVersion: isLaptopOrDesktop ? formData.windowsVersion : '',
    macAddress: isIT && (!isPeripheral || isCctvSecurity) ? formData.macAddress : '',
    ipAddress: isIT ? formData.ipAddress || ipFromDynamic || '' : '',
    hostName: isIT ? formData.hostName || hostFromDynamic || '' : '',
    monitorAssetCode: isDesktop ? formData.monitorAssetCode : '',
    monitorSerial: isDesktop ? formData.monitorSerial : '',
    monitorMake: isDesktop ? formData.monitorMake : '',
    monitorModel: isDesktop ? formData.monitorModel : '',
    keyboardAssetCode: isDesktop ? formData.keyboardAssetCode : '',
    keyboardSerial: isDesktop ? formData.keyboardSerial : '',
    keyboardMake: isDesktop ? formData.keyboardMake : '',
    keyboardModel: isDesktop ? formData.keyboardModel : '',
    keyboardConnectivity: isDesktop ? formData.keyboardConnectivity : '',
    mouseAssetCode: isDesktop ? formData.mouseAssetCode : '',
    mouseSerial: isDesktop ? formData.mouseSerial : '',
    mouseMake: isDesktop ? formData.mouseMake : '',
    mouseModel: isDesktop ? formData.mouseModel : '',
    mouseConnectivity: isDesktop ? formData.mouseConnectivity : '',
    upsAssetCode: isDesktop ? formData.upsAssetCode : '',
    upsSerial: isDesktop ? formData.upsSerial : '',
    upsMake: isDesktop ? formData.upsMake : '',
    upsModel: isDesktop ? formData.upsModel : '',
    additionalItems: cleanRemarks,
  };
}

const ALWAYS_PRESERVE_ON_EDIT: (keyof AssetFormData)[] = [
  'location',
  'plantCode',
  'department',
  'make',
  'model',
  'serialNumber',
  'assetCode',
  'accountAssetCode',
  'vendorName',
  'warrantyStartDate',
  'warrantyEndDate',
  'contactName',
  'contactEmail',
  'contactMobile',
  'documentUrl',
  'imageUrl',
  'assetName',
  'mainCategory',
  'subCategory',
  'quantity',
  'employeeId',
  'purchaseDate',
  'purchaseCost',
  'invoiceNumber',
  'condition',
  'status',
  'maintenanceRequired',
  'lastMaintenanceDate',
  'nextMaintenanceDate',
  'createdBy',
  'createdDate',
  'extraItems',
  'missingItems',
  'assignedDate',
  'returnDate',
  'amcVendor',
  'amcStartDate',
  'amcEndDate',
  'amcCost',
];

const TYPE_SPECIFIC_PRESERVE_ON_EDIT: (keyof AssetFormData)[] = [
  'ram',
  'ssd',
  'cpu',
  'windowsVersion',
  'macAddress',
  'ipAddress',
  'hostName',
  'monitorSerial',
  'monitorAssetCode',
  'monitorMake',
  'monitorModel',
  'keyboardSerial',
  'keyboardAssetCode',
  'keyboardMake',
  'keyboardModel',
  'keyboardConnectivity',
  'mouseSerial',
  'mouseAssetCode',
  'mouseMake',
  'mouseModel',
  'mouseConnectivity',
  'upsSerial',
  'upsAssetCode',
  'upsMake',
  'upsModel',
  'additionalItems',
  'assetType',
  'assetTypeId',
];

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return String(value).trim() === '';
}

function sameEditShape(next: AssetFormData, existing: AssetFormData): boolean {
  const keys: (keyof AssetFormData)[] = ['mainCategory', 'subCategory', 'assetType', 'assetTypeId'];
  return keys.every((key) => {
    const a = String(next[key] || '').trim().toLowerCase();
    const b = String(existing[key] || '').trim().toLowerCase();
    return !a || !b || a === b;
  });
}

/** Preserve existing values on edit when hidden/sanitized fields come through as blanks. */
export function preserveExistingEditValues(formData: AssetFormData, existingAsset: Asset): AssetFormData {
  const existing = assetToFormData(existingAsset);
  const next: AssetFormData = { ...formData };
  const hadAssignee =
    !isBlank(existing.employeeId) ||
    !isBlank(existing.contactName) ||
    !isBlank(existing.contactEmail) ||
    !isBlank(existing.contactMobile);
  const clearedAssignee =
    hadAssignee &&
    isBlank(next.employeeId) &&
    isBlank(next.contactName) &&
    isBlank(next.contactEmail) &&
    isBlank(next.contactMobile);
  const preserveKeys = sameEditShape(next, existing)
    ? [...ALWAYS_PRESERVE_ON_EDIT, ...TYPE_SPECIFIC_PRESERVE_ON_EDIT]
    : ALWAYS_PRESERVE_ON_EDIT;

  for (const key of preserveKeys) {
    if (
      clearedAssignee &&
      (key === 'employeeId' ||
        key === 'contactName' ||
        key === 'contactEmail' ||
        key === 'contactMobile' ||
        key === 'assignedDate')
    ) {
      continue;
    }
    if (isBlank(next[key]) && !isBlank(existing[key])) {
      (next as Record<string, unknown>)[key] = existing[key] as unknown;
    }
  }

  if (clearedAssignee) {
    next.employeeId = '';
    next.contactName = '';
    next.contactEmail = '';
    next.contactMobile = '';
    next.assignedDate = '';
    next.status = 'Available';
  }

  if (
    sameEditShape(next, existing) &&
    isBlank(next.dynamicDetails) &&
    !isBlank(existing.dynamicDetails)
  ) {
    next.dynamicDetails = existing.dynamicDetails;
  }

  return next;
}
