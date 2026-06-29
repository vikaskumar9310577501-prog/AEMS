import type { Asset, AssetFormData } from '../types';
import { normalizeAssetType } from './formAsset';

export function normAssetId(id: unknown): string {
  return String(id ?? '').replace(/^0+/, '');
}

/** Build a provisional asset for instant UI update before the server responds. */
export function formDataToOptimisticAsset(
  data: AssetFormData,
  editingAsset: Asset | null,
  existingAssets: Asset[]
): Asset {
  let id: number;
  if (editingAsset?.id != null) {
    id = editingAsset.id;
  } else {
    const maxId = existingAssets.reduce(
      (max, a) => Math.max(max, parseInt(String(a.id), 10) || 0),
      0
    );
    id = maxId + 1;
  }

  const code = (data.assetCode || editingAsset?.assetCode || String(id)).trim();

  return {
    ...(editingAsset || {}),
    ...data,
    id,
    assetType: normalizeAssetType(data.assetType, {
      make: data.make,
      model: data.model,
      subCategory: data.subCategory,
      assetTypeId: data.assetTypeId,
    }),
    assetName: data.assetName || `${data.make || ''} ${data.model || ''}`.trim(),
    qrCodeText: editingAsset?.qrCodeText || '',
    qrCodeImage: editingAsset?.qrCodeImage || '',
    uniqueCode: editingAsset?.uniqueCode || code,
    binaryCode: editingAsset?.binaryCode || '0',
  };
}

export function patchAssetsList(
  prev: Asset[],
  saved: Asset,
  editingAsset: Asset | null
): Asset[] {
  const targetNorm = normAssetId(saved.id);
  const editNorm = editingAsset?.id != null ? normAssetId(editingAsset.id) : '';

  const idx = prev.findIndex(
    (a) => normAssetId(a.id) === targetNorm || (editNorm && normAssetId(a.id) === editNorm)
  );

  if (idx >= 0) {
    return prev.map((a, i) => (i === idx ? { ...a, ...saved } : a));
  }
  return [...prev, saved];
}
