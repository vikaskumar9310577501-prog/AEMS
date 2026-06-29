export const ASSET_CONDITION_OPTIONS = [
  { value: 'NEW PURCHASE', label: 'New Purchase' },
  { value: 'EXISTING ASSETS', label: 'Existing Asset' },
  { value: 'Damaged', label: 'Damaged' },
] as const;

export type StandardAssetCondition = (typeof ASSET_CONDITION_OPTIONS)[number]['value'];

export function isNewPurchaseCondition(condition?: string): boolean {
  const c = String(condition || '').trim().toUpperCase();
  return c === 'NEW PURCHASE' || c === 'NEW';
}

/** Normalize legacy sheet values to the standard three-option set. */
export function normalizeAssetCondition(raw?: string): StandardAssetCondition {
  const c = String(raw || '').trim();
  if (!c) return 'EXISTING ASSETS';
  if (isNewPurchaseCondition(c)) return 'NEW PURCHASE';
  if (c === 'Damaged' || c === 'Poor' || c === 'Average') return 'Damaged';
  return 'EXISTING ASSETS';
}

export function validateNewPurchaseRequirements(payload: {
  condition?: string;
  invoiceNumber?: string;
  documentUrl?: string;
}): string | null {
  if (!isNewPurchaseCondition(payload.condition)) return null;
  if (!String(payload.invoiceNumber || '').trim()) {
    return 'PO Number is required for new purchases';
  }
  if (!String(payload.documentUrl || '').trim()) {
    return 'Attach Asset Document is required for new purchases';
  }
  return null;
}
