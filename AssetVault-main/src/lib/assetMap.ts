import type { Asset } from '../types';
import { healMisalignedCategoryFields, matchMainCategoryLabel, normalizeMainCategory } from './assetCatalogByType';
import { healMisalignedAssetFields } from './healAssetFields';
import { isGroupedSubCategory, resolveSpecificAssetType, inferCctvDeviceType, defaultAssetTypeForCategory } from './assetDisplay';

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getVal(item: Record<string, unknown>, keys: string[], camelKey?: string): string {
  for (const key of keys) {
    const v = item[key];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  const normalizedKeys = keys.map((k) => normalizeKey(k));
  for (const itemKey of Object.keys(item)) {
    if (normalizedKeys.includes(normalizeKey(itemKey))) {
      const v = item[itemKey];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
  }
  if (camelKey) {
    const v = item[camelKey];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

function isLikelyEmail(value: string): boolean {
  const v = String(value || '').trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v);
}

function isLikelyDate(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return false;
  return !Number.isNaN(Date.parse(v));
}

function isLikelyPhone(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export function mapAssetsFromApi(data: Record<string, unknown>[]): Asset[] {
  return data.map((item) => {
    const subCatRaw = getVal(item, ['Sub Category', 'subCategory']);
    const assetTypeRaw = getVal(item, ['Asset Type', 'Type']);
    const mainCatEarly = getVal(item, ['Main Category', 'Category', 'mainCategory']);
    let subCat = subCatRaw;
    if (!subCat) {
      if (assetTypeRaw && isGroupedSubCategory(assetTypeRaw)) subCat = assetTypeRaw;
      else if (assetTypeRaw === 'Laptop' || assetTypeRaw === 'Desktop') subCat = 'Laptop / Desktop';
      else if (mainCatEarly && mainCatEarly !== 'IT Assets') subCat = '';
      else subCat = assetTypeRaw || 'Other IT Asset';
    } else if (subCat === 'Laptop' || subCat === 'Desktop') {
      subCat = 'Laptop / Desktop';
    }

    const assetCode = getVal(item, ['Asset Code']);
    const healed = healMisalignedCategoryFields({
      mainCategory: getVal(item, ['Main Category', 'Category', 'mainCategory']),
      subCategory: subCat,
      assetType: assetTypeRaw,
      make: getVal(item, ['Make', 'Brand', 'Brand/Make']),
      assetCode,
    });
    subCat = healed.subCategory || subCat;
    const rawMainCat = healed.mainCategory;
    const healedType = healed.assetType || assetTypeRaw;
    const assetName = getVal(item, ['Asset Name']);

    return {
      id: getVal(item, ['S No', 'ID', 'SR.NO', 'id', 'Asset ID']) as unknown as number,
      location: getVal(item, ['Location', 'Loc']),
      plantCode: getVal(item, ['Plant Code', 'Plant', 'plantCode', 'Plant Name']),
      department: getVal(item, ['Department', 'Dept']),
      make: getVal(item, ['Make', 'Brand', 'Brand/Make']),
      model: getVal(item, ['Model']),
      serialNumber: getVal(item, ['Serial Number', 'SN', 'SERIAL NO.']),
      assetCode,
      accountAssetCode: getVal(item, ['Account Asset Code']),
      vendorName: getVal(item, ['Vendor Name', 'Vendor']),
      warrantyStartDate: getVal(item, ['Warranty Start Date', 'Warranty Start'], 'warrantyStartDate'),
      warrantyEndDate: getVal(item, ['Warranty Expiry Date', 'Warranty End', 'Warranty Date'], 'warrantyEndDate'),
      ram: getVal(item, ['RAM']),
      ssd: getVal(item, ['SSD', 'Storage']),
      cpu: getVal(item, ['CPU', 'Processor']),
      windowsVersion: getVal(item, ['Windows Version', 'OS']),
      assetType: (() => {
        const resolved = resolveSpecificAssetType({
          assetType: healedType,
          subCategory: subCat,
          assetTypeId: getVal(item, ['assetTypeId', 'Asset Type ID']),
          make: getVal(item, ['Make', 'Brand', 'Brand/Make']),
          model: getVal(item, ['Model']),
          mainCategory: rawMainCat,
          assetName,
          monitorSerial: getVal(item, ['Monitor Serial', 'Monitor SN']),
          monitorAssetCode: getVal(item, ['Monitor Asset Code', 'Monitor Code']),
          monitorMake: getVal(item, ['Monitor Brand', 'Monitor Make']),
          monitorModel: getVal(item, ['Monitor Model Number', 'Monitor Model']),
          keyboardSerial: getVal(item, ['Keyboard Serial', 'Keyboard SN']),
          keyboardAssetCode: getVal(item, ['Keyboard Asset Code', 'Keyboard Code']),
          keyboardMake: getVal(item, ['Keyboard Brand', 'Keyboard Make']),
          keyboardModel: getVal(item, ['Keyboard Model Number', 'Keyboard Model']),
          keyboardConnectivity: getVal(item, ['Keyboard Connectivity', 'Keyboard Type']),
          mouseSerial: getVal(item, ['Mouse Serial', 'Mouse SN']),
          mouseAssetCode: getVal(item, ['Mouse Asset Code', 'Mouse Code']),
          mouseMake: getVal(item, ['Mouse Brand', 'Mouse Make']),
          mouseModel: getVal(item, ['Mouse Model Number', 'Mouse Model']),
          mouseConnectivity: getVal(item, ['Mouse Connectivity', 'Mouse Type']),
          upsSerial: getVal(item, ['UPS Serial', 'UPS SN']),
          upsAssetCode: getVal(item, ['UPS Asset Code', 'UPS Code']),
          upsMake: getVal(item, ['UPS Brand', 'UPS Make']),
          upsModel: getVal(item, ['UPS Model Number', 'UPS Model']),
        });
        if (resolved) return resolved as Asset['assetType'];
        if (healedType && !isGroupedSubCategory(healedType) && !matchMainCategoryLabel(healedType))
          return healedType as Asset['assetType'];
        if (assetTypeRaw && !isGroupedSubCategory(assetTypeRaw) && !matchMainCategoryLabel(assetTypeRaw))
          return assetTypeRaw as Asset['assetType'];
        const cctv = inferCctvDeviceType({
          assetType: healedType || assetTypeRaw,
          subCategory: subCat,
          make: getVal(item, ['Make', 'Brand', 'Brand/Make']),
          model: getVal(item, ['Model']),
        });
        if (cctv) return cctv as Asset['assetType'];
        return defaultAssetTypeForCategory(rawMainCat, subCat) as Asset['assetType'];
      })(),
      macAddress: getVal(item, ['MAC Address', 'MAC']),
      ipAddress: getVal(item, ['IP Address', 'ipAddress']),
      hostName: getVal(item, ['Host Name', 'hostName', 'Hostname']),
      monitorSerial: getVal(item, ['Monitor Serial', 'Monitor SN']),
      monitorAssetCode: getVal(item, ['Monitor Asset Code', 'Monitor Code']),
      monitorMake: getVal(item, ['Monitor Brand', 'Monitor Make']),
      monitorModel: getVal(item, ['Monitor Model Number', 'Monitor Model']),
      keyboardSerial: getVal(item, ['Keyboard Serial', 'Keyboard SN']),
      keyboardAssetCode: getVal(item, ['Keyboard Asset Code', 'Keyboard Code']),
      keyboardMake: getVal(item, ['Keyboard Brand', 'Keyboard Make']),
      keyboardModel: getVal(item, ['Keyboard Model Number', 'Keyboard Model']),
      keyboardConnectivity: getVal(item, ['Keyboard Connectivity', 'Keyboard Type']) as Asset['keyboardConnectivity'],
      mouseSerial: getVal(item, ['Mouse Serial', 'Mouse SN']),
      mouseAssetCode: getVal(item, ['Mouse Asset Code', 'Mouse Code']),
      mouseMake: getVal(item, ['Mouse Brand', 'Mouse Make']),
      mouseModel: getVal(item, ['Mouse Model Number', 'Mouse Model']),
      mouseConnectivity: getVal(item, ['Mouse Connectivity', 'Mouse Type']) as Asset['mouseConnectivity'],
      upsSerial: getVal(item, ['UPS Serial', 'UPS SN']),
      upsAssetCode: getVal(item, ['UPS Asset Code', 'UPS Code']),
      upsMake: getVal(item, ['UPS Brand', 'UPS Make']),
      upsModel: getVal(item, ['UPS Model Number', 'UPS Model']),
      contactName: getVal(item, [
        'Assigned To',
        'Contact Person Name',
        'Auth Target / Owner',
        'Owner',
        'ASSIGNEE NAME ',
      ], 'contactName'),
      contactEmail: (() => {
        const email = getVal(item, ['Contact Email', 'Contact Person Email', 'Email', 'MAIL ID '], 'contactEmail');
        const mobile = getVal(item, [
          'Contact Number',
          'Contact Person Mobile Number',
          'Mobile',
          'CONTACT NUMBER ',
        ], 'contactMobile');
        if (!isLikelyEmail(email) && isLikelyEmail(mobile)) {
          if (!email || isLikelyDate(email) || isLikelyPhone(email)) return mobile;
        }
        return email;
      })(),
      contactMobile: (() => {
        const email = getVal(item, ['Contact Email', 'Contact Person Email', 'Email', 'MAIL ID '], 'contactEmail');
        const mobile = getVal(item, [
        'Contact Number',
        'Contact Person Mobile Number',
        'Mobile',
        'CONTACT NUMBER ',
        ], 'contactMobile');
        if (!isLikelyEmail(email) && isLikelyEmail(mobile)) {
          if (!email || isLikelyDate(email) || isLikelyPhone(email)) return email;
        }
        return mobile;
      })(),
      documentUrl: getVal(item, ['Document URL / Attached Documents', 'Document Link', 'Document URL', 'Document'], 'documentUrl'),
      imageUrl: getVal(item, ['Photo URL / Photo Upload', 'Asset Image', 'Image', 'Image URL']),
      additionalItems: getVal(item, ['Remarks', 'Additional Items']),
      qrCodeText: getVal(item, ['QR Code / Barcode', 'QR Code Text']),
      qrCodeImage: '',
      uniqueCode: getVal(item, ['Unique Code']),
      binaryCode: getVal(item, ['Binary Code']),
      assetName: getVal(item, ['Asset Name']) || getVal(item, ['Model']) || '',
      mainCategory: rawMainCat,
      subCategory: subCat,
      quantity: getVal(item, ['Quantity']) || '1',
      employeeId: getVal(item, ['Employee ID']),
      purchaseDate: getVal(item, ['Purchase Date']),
      purchaseCost: getVal(item, ['Purchase Cost']),
      invoiceNumber: getVal(item, ['Invoice Number']),
      condition: (() => {
        const cond = getVal(item, ['Condition']);
        if (cond === 'New') return 'NEW PURCHASE';
        if (cond === 'Good' || !cond) return 'EXISTING ASSETS';
        return cond;
      })() as Asset['condition'],
      status: (getVal(item, ['Status']) || 'Available') as Asset['status'],
      maintenanceRequired: getVal(item, ['Maintenance Required']) as Asset['maintenanceRequired'],
      lastMaintenanceDate: getVal(item, ['Last Maintenance Date']),
      nextMaintenanceDate: getVal(item, ['Next Maintenance Date']),
      createdBy: getVal(item, ['Created By']),
      createdDate: getVal(item, ['Created Date']),
      updatedBy: getVal(item, ['Updated By']),
      updatedDate: getVal(item, ['Updated Date']),
      extraItems: getVal(item, ['Extra Items', 'extraItems']),
      missingItems: getVal(item, ['Missing Items', 'missingItems']),
      assignedDate: getVal(item, ['Assigned Date', 'Assign Date', 'Assignment Date', 'assignedDate']),
      returnDate: getVal(item, ['Return Date', 'returnDate']),
      amcVendor: getVal(item, ['AMC Vendor', 'amcVendor']),
      amcStartDate: getVal(item, ['AMC Start Date', 'amcStartDate']),
      amcEndDate: getVal(item, ['AMC End Date', 'amcEndDate']),
      amcCost: getVal(item, ['AMC Cost', 'amcCost']),
      dynamicDetails:
        item.dynamicDetails && typeof item.dynamicDetails === 'object'
          ? (item.dynamicDetails as Record<string, string>)
          : {},
      assetTypeId: getVal(item, ['assetTypeId', 'Asset Type ID']),
    };
  }).map((asset) => healMisalignedAssetFields(asset));
}
