import type { Asset } from '../types';
import { getAssetScanId } from './scanId';

function normalizeId(value: string): string {
  const s = String(value || '').trim();
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && String(n) === s.replace(/^0+/, '') || String(n) === s) {
    return String(n);
  }
  return s.toLowerCase();
}

/** Resolve asset from route param (id, asset code, unique code, serial). */
export function findAssetByRouteId(assets: Asset[], routeId: string): Asset | undefined {
  const decoded = decodeURIComponent(routeId).trim();
  if (!decoded) return undefined;

  const targetNorm = normalizeId(decoded);

  return assets.find((a) => {
    const candidates = [
      String(a.id ?? ''),
      String(a.assetCode ?? ''),
      String(a.uniqueCode ?? ''),
      String(a.serialNumber ?? ''),
      getAssetScanId(a),
    ].filter(Boolean);

    return candidates.some((c) => {
      if (c === decoded) return true;
      return normalizeId(c) === targetNorm;
    });
  });
}

export function assetRouteId(asset: Asset): string {
  const id = asset.id != null && String(asset.id).trim() !== '' ? String(asset.id) : getAssetScanId(asset);
  return encodeURIComponent(id);
}
