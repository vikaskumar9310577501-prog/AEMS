import type { Asset } from '../types';

/** ID used in QR /scan URLs — matches server getCanonicalScanId */
export function getAssetScanId(asset: Pick<Asset, 'id' | 'uniqueCode' | 'assetCode' | 'serialNumber'>): string {
  const code = String(asset.uniqueCode || '').trim();
  if (code) return code;
  const ac = String(asset.assetCode || '').trim();
  if (ac) return ac;
  const sn = String(asset.serialNumber || '').trim();
  if (sn) return sn;
  return String(asset.id || '').trim();
}

export function buildScanUrl(asset: Pick<Asset, 'id' | 'uniqueCode' | 'assetCode' | 'serialNumber' | 'qrCodeText'>): string {
  
  const id = getAssetScanId(asset);
  return `${window.location.origin}/scan/${encodeURIComponent(id)}`;
}
