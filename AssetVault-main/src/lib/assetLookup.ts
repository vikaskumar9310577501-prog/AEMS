import type { Asset } from '../types';
import { getAssetScanId } from './scanId';

function safeDecodeLookupId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

export function normalizeAssetLookupId(value: unknown): string {
  const s = String(value || '').trim();
  const n = parseInt(s, 10);
  const withoutLeadingZeroes = s.replace(/^0+/, '') || '0';
  if (!Number.isNaN(n) && (String(n) === withoutLeadingZeroes || String(n) === s)) {
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

export type AssetLookupIndex = Map<string, Asset>;

export function buildAssetLookupIndex(assets: Asset[]): AssetLookupIndex {
  const index: AssetLookupIndex = new Map();
  for (const asset of assets) {
    for (const candidate of assetLookupCandidates(asset)) {
      index.set(candidate, asset);
      index.set(normalizeAssetLookupId(candidate), asset);
    }
  }
  return index;
}

export function findAssetInLookup(index: AssetLookupIndex, lookupId: unknown): Asset | undefined {
  const decoded = safeDecodeLookupId(lookupId);
  if (!decoded) return undefined;
  return index.get(decoded) || index.get(normalizeAssetLookupId(decoded));
}

export function findAssetByAnyId(assets: Asset[], lookupId: unknown): Asset | undefined {
  const decoded = safeDecodeLookupId(lookupId);
  if (!decoded) return undefined;

  return findAssetInLookup(buildAssetLookupIndex(assets), decoded);
}

/** Resolve asset from route param (id, asset code, unique code, serial). */
export function findAssetByRouteId(assets: Asset[], routeId: string): Asset | undefined {
  return findAssetByAnyId(assets, routeId);
}

export function assetRouteId(asset: Asset): string {
  const id = asset.id != null && String(asset.id).trim() !== '' ? String(asset.id) : getAssetScanId(asset);
  return encodeURIComponent(id);
}
