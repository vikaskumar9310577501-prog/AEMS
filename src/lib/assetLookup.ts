import type { Asset } from '../types';
import { getAssetScanId } from './scanId';

export function normalizeAssetLookupId(value: unknown): string {
  const s = String(value || '').trim();
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && String(n) === s.replace(/^0+/, '') || String(n) === s) {
    return String(n);
  }
  return s.toLowerCase();
}

function assetLookupCandidates(asset: Asset): string[] {
  return [
    String(asset.id ?? ''),
    String(asset.assetCode ?? ''),
    String(asset.uniqueCode ?? ''),
    String(asset.serialNumber ?? ''),
    getAssetScanId(asset),
  ].filter(Boolean);
}

export function findAssetByAnyId(assets: Asset[], lookupId: unknown): Asset | undefined {
  const decoded = decodeURIComponent(String(lookupId ?? '')).trim();
  if (!decoded) return undefined;

  const targetNorm = normalizeAssetLookupId(decoded);
  return assets.find((asset) =>
    assetLookupCandidates(asset).some((candidate) => {
      if (candidate === decoded) return true;
      return normalizeAssetLookupId(candidate) === targetNorm;
    })
  );
}

/** Resolve asset from route param (id, asset code, unique code, serial). */
export function findAssetByRouteId(assets: Asset[], routeId: string): Asset | undefined {
  return findAssetByAnyId(assets, routeId);
}

export function assetRouteId(asset: Asset): string {
  const id = asset.id != null && String(asset.id).trim() !== '' ? String(asset.id) : getAssetScanId(asset);
  return encodeURIComponent(id);
}
