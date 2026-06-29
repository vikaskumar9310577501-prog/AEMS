import type { Asset } from '../types';
import { parseStoredDate, partsToStored } from './warrantyDate';

export const SOFTWARE_LICENSE_CATEGORY = 'Software / License Assets';

/** Renewal / expiry date from dynamic field or warranty end on the asset row. */
export function getSoftwareLicenseRenewalRaw(asset: Asset): string {
  if ((asset.mainCategory || '') !== SOFTWARE_LICENSE_CATEGORY) return '';
  const fromDynamic =
    asset.dynamicDetails?.renewal_date?.trim() ||
    asset.dynamicDetails?.expiry_date?.trim();
  if (fromDynamic) return fromDynamic;
  return asset.warrantyEndDate?.trim() || '';
}

/** @deprecated use getSoftwareLicenseRenewalRaw */
export function getSoftwareLicenseExpiryRaw(asset: Asset): string {
  return getSoftwareLicenseRenewalRaw(asset);
}

export function parseLicenseExpiryDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const normalized = partsToStored(parseStoredDate(raw.trim()));
  const ymd = normalized.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = ymd[3] ? parseInt(ymd[3], 10) : 1;
    const date = new Date(y, m, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const ms = Date.parse(raw.trim());
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function referenceDay(asOf?: unknown): Date {
  if (asOf instanceof Date && !Number.isNaN(asOf.getTime())) return startOfDay(asOf);
  return startOfDay(new Date());
}

export function isSoftwareLicenseExpired(asset: Asset, asOf?: Date): boolean {
  if ((asset.mainCategory || '') !== SOFTWARE_LICENSE_CATEGORY) return false;
  const expiry = parseLicenseExpiryDate(getSoftwareLicenseRenewalRaw(asset));
  if (!expiry) return false;
  const today = referenceDay(asOf);
  const expDay = startOfDay(expiry);
  return expDay.getTime() < today.getTime();
}

export const UPCOMING_SOFTWARE_DAYS = 30;

/** Renewal date within the next N days (not yet expired). */
export function isSoftwareLicenseRenewable(
  asset: Asset,
  asOf?: Date,
  withinDays = UPCOMING_SOFTWARE_DAYS
): boolean {
  if ((asset.mainCategory || '') !== SOFTWARE_LICENSE_CATEGORY) return false;
  const renewal = parseLicenseExpiryDate(getSoftwareLicenseRenewalRaw(asset));
  if (!renewal) return false;
  const today = referenceDay(asOf);
  const renewalDay = startOfDay(renewal);
  if (renewalDay.getTime() < today.getTime()) return false;
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);
  return renewalDay.getTime() <= limit.getTime();
}

/** @deprecated use isSoftwareLicenseRenewable */
export function isSoftwareLicenseUpcoming(
  asset: Asset,
  asOf = new Date(),
  withinDays = UPCOMING_SOFTWARE_DAYS
): boolean {
  return isSoftwareLicenseRenewable(asset, asOf, withinDays);
}
