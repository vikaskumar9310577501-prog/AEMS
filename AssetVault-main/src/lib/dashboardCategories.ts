import type { Asset } from '../types';
import { normalizeMainCategory, PERIPHERAL_TYPES, healMisalignedCategoryFields } from './assetCatalogByType';
import { resolveSpecificAssetType } from './assetDisplay';

/** Combined sidebar category for CCTV assets (Camera + NVR). */
export const SIDEBAR_CCTV_CATEGORY = 'Camera/NVR';

export const CCTV_ASSET_TYPES = ['Camera', 'NVR'] as const;

export type CctvAssetType = (typeof CCTV_ASSET_TYPES)[number];

/** @deprecated Use isSidebarCctvCategory */
export const SIDEBAR_IT_TYPE_CATEGORIES = [SIDEBAR_CCTV_CATEGORY] as const;

export type SidebarItTypeCategory = typeof SIDEBAR_CCTV_CATEGORY;

export function isSidebarCctvCategory(cat: string): boolean {
  return cat === SIDEBAR_CCTV_CATEGORY || cat === 'Camera' || cat === 'NVR';
}

export function isSidebarItTypeCategory(cat: string): cat is SidebarItTypeCategory {
  return cat === SIDEBAR_CCTV_CATEGORY;
}

/** Insert Camera/NVR after IT Assets in sidebar / dashboard category lists. */
export function expandCategoriesForSidebar(categories: readonly string[]): string[] {
  const out: string[] = [];
  for (const cat of categories) {
    out.push(cat);
    if (cat === 'IT Assets') {
      out.push(SIDEBAR_CCTV_CATEGORY);
    }
  }
  return out;
}

export function resolveAssetItDisplayType(
  asset: Pick<Asset, 'assetType' | 'subCategory' | 'model' | 'make' | 'assetTypeId'>
): string {
  return (
    resolveSpecificAssetType({
      assetType: asset.assetType,
      subCategory: asset.subCategory,
      assetTypeId: asset.assetTypeId,
      make: asset.make,
      model: asset.model,
    }) || asset.assetType ||
    ''
  );
}

export function resolveAssetMainCategory(
  asset: Pick<Asset, 'mainCategory' | 'subCategory' | 'assetType' | 'assetCode' | 'make'>
): string {
  const healed = healMisalignedCategoryFields({
    mainCategory: asset.mainCategory,
    subCategory: asset.subCategory,
    assetType: asset.assetType,
    make: asset.make,
    assetCode: asset.assetCode,
  });
  return healed.mainCategory;
}

/** Only true CCTV assets — avoid mis-bucketing laptops/peripherals via fuzzy model text. */
function assetIsExplicitCctv(
  asset: Pick<Asset, 'assetType' | 'subCategory' | 'assetTypeId'>
): boolean {
  const type = (asset.assetType || '').trim();
  if (type === 'Camera' || type === 'NVR') return true;
  const sub = (asset.subCategory || '').trim().toLowerCase();
  if (sub === 'cctv / security device') return true;
  const typeId = (asset.assetTypeId || '').trim().toLowerCase();
  return typeId === 'cctv_security';
}

function assetIsStandardItHardware(
  asset: Pick<Asset, 'assetType' | 'subCategory'>
): boolean {
  const type = (asset.assetType || '').trim();
  if (type === 'Laptop' || type === 'Desktop') return true;
  const sub = (asset.subCategory || '').trim().toLowerCase();
  if (sub === 'laptop / desktop') return true;
  return (
    !!type &&
    (PERIPHERAL_TYPES as readonly string[]).includes(type) &&
    type !== 'Camera' &&
    type !== 'NVR'
  );
}

export function assetMatchesSidebarCategory(asset: Asset, category: string): boolean {
  if (category === 'All') return true;

  const main = resolveAssetMainCategory(asset);
  const sidebarCat = normalizeMainCategory(category);

  if (category === SIDEBAR_CCTV_CATEGORY) {
    return main === 'IT Assets' && assetIsExplicitCctv(asset);
  }

  if (category === 'Camera' || category === 'NVR') {
    const type = (asset.assetType || '').trim();
    return main === 'IT Assets' && type === category;
  }

  if (category === 'IT Assets') {
    if (main !== 'IT Assets') return false;
    if (assetIsStandardItHardware(asset)) return true;
    return !assetIsExplicitCctv(asset);
  }

  return main === sidebarCat;
}

export function newAssetPrefillFromCategory(category: string | undefined): {
  mainCategory?: string;
  assetType?: CctvAssetType;
} {
  if (!category || category === 'All') return {};
  if (isSidebarCctvCategory(category)) {
    return { mainCategory: SIDEBAR_CCTV_CATEGORY };
  }
  return { mainCategory: category };
}
