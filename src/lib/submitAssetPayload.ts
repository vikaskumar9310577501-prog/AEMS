import type { AssetFormData } from '../types';
import { PERIPHERAL_TYPES } from './assetCatalogByType';

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
    keyboardAssetCode: isDesktop ? formData.keyboardAssetCode : '',
    keyboardSerial: isDesktop ? formData.keyboardSerial : '',
    mouseAssetCode: isDesktop ? formData.mouseAssetCode : '',
    mouseSerial: isDesktop ? formData.mouseSerial : '',
    upsAssetCode: isDesktop ? formData.upsAssetCode : '',
    upsSerial: isDesktop ? formData.upsSerial : '',
    additionalItems: cleanRemarks,
  };
}
