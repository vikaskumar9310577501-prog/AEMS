import type { MaintenanceComplaint, MaintenanceMachine } from '../types/maintenance';
import { CUSTOM_TREND_MONTHS, DEFAULT_TREND_MONTHS, isCustomTrend } from '../types/maintenance';

export const COMPLAINT_RESOLVE_SLA_DAYS = 7;

export type ComplaintDashboardFilter =
  | 'total'
  | 'pending'
  | 'resolved'
  | 'within_week'
  | 'over_week';

/** Build next PM asset code: PM-00001, PM-00002, … */
export function nextMaintenanceAssetCode(machines: Pick<MaintenanceMachine, 'assetCode'>[]): string {
  let max = 0;
  for (const m of machines) {
    const match = String(m.assetCode || '')
      .trim()
      .toUpperCase()
      .match(/^PM-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return `PM-${String(max + 1).padStart(5, '0')}`;
}

export function normalizeMachineNumber(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizeMaintenanceAssetCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

/** QR points to downtime complaint form (Phase 5); works offline of auth. */
export function buildMaintenanceScanUrl(
  machine: Pick<MaintenanceMachine, 'assetCode' | 'id'>,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const code = normalizeMaintenanceAssetCode(machine.assetCode) || String(machine.id || '').trim();
  return `${origin}/maintenance/report/${encodeURIComponent(code)}`;
}

/** Calendar date in India (yyyy-mm-dd). */
export function istTodayKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function istHour(d = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  return parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
}

/** Morning slot from 9:00 IST; evening slot from 16:00 IST. Hours 8–15 count as am for cron buffer. */
export function istMailSlot(d = new Date()): 'am' | 'pm' | null {
  const h = istHour(d);
  if (h >= 16) return 'pm';
  if (h >= 8) return 'am';
  return null;
}

export function istMailSlotKey(d = new Date()): string | null {
  const slot = istMailSlot(d);
  if (!slot) return null;
  return `${istTodayKey(d)}-${slot}`;
}

export function daysUntilDate(dateStr: string, now = new Date()): number | null {
  const raw = String(dateStr || '').trim();
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/** Days until a yyyy-mm-dd date using India calendar (not UTC). */
export function daysUntilDateIst(dateStr: string, now = new Date()): number | null {
  const raw = String(dateStr || '').trim().slice(0, 10);
  if (!raw) return null;
  const today = istTodayKey(now);
  const t = Date.parse(`${today}T00:00:00`);
  const d = Date.parse(`${raw}T00:00:00`);
  if (Number.isNaN(t) || Number.isNaN(d)) return null;
  return Math.round((d - t) / (24 * 60 * 60 * 1000));
}

export function isSameIstMonth(dateStr: string, now = new Date()): boolean {
  const raw = String(dateStr || '').trim().slice(0, 10);
  if (raw.length < 7) return false;
  return raw.slice(0, 7) === istTodayKey(now).slice(0, 7);
}

/** Calendar days from an ISO timestamp to India today. */
export function istCalendarDaysSince(iso: string, now = new Date()): number {
  const reported = new Date(iso);
  if (Number.isNaN(reported.getTime())) return 0;
  const a = Date.parse(`${istTodayKey(reported)}T00:00:00`);
  const b = Date.parse(`${istTodayKey(now)}T00:00:00`);
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

type PlanMachine = Pick<
  MaintenanceMachine,
  'trendMonths' | 'nextMaintenanceDate' | 'lastMaintenanceDate' | 'pmLogs' | 'customPlanDates'
>;

export function dateKey(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : formatDateOnly(value);
  const d = parseDateOnly(value);
  return d ? formatDateOnly(d) : '';
}

/** Dates already completed (Done / last PM). These must not count as overdue. */
export function completedPlanDateKeys(machine: Pick<MaintenanceMachine, 'lastMaintenanceDate' | 'pmLogs'>): Set<string> {
  const keys = new Set<string>();
  for (const log of machine.pmLogs || []) {
    const planned = dateKey(log.plannedDate);
    const done = dateKey(log.doneOn);
    if (planned) keys.add(planned);
    if (done) keys.add(done);
  }
  const last = dateKey(machine.lastMaintenanceDate);
  if (last) keys.add(last);
  return keys;
}

/** Manual plan = all stored dates (next + extras), sorted earliest first. */
export function manualPlanDates(
  machine: Pick<MaintenanceMachine, 'nextMaintenanceDate' | 'customPlanDates'>
): Date[] {
  const sorted = uniqueDates([machine.nextMaintenanceDate, ...(machine.customPlanDates || [])]);
  return sorted.sort((a, b) => a.getTime() - b.getTime());
}

/** Combined custom plan inputs for editing (next + extras, deduped). */
export function allCustomPlanDateStrings(
  machine: Pick<MaintenanceMachine, 'nextMaintenanceDate' | 'customPlanDates'>
): string[] {
  return normalizeCustomPlanDates([machine.nextMaintenanceDate, ...(machine.customPlanDates || [])]);
}

export function isPlanDateCompleted(machine: PlanMachine, planned: Date): boolean {
  const k = formatDateOnly(planned);
  if (completedPlanDateKeys(machine).has(k)) return true;
  const last = parseDateOnly(machine.lastMaintenanceDate);
  if (last && planned.getTime() <= last.getTime()) return true;
  return false;
}

export function pendingPlanDates(machine: PlanMachine): Date[] {
  if (isCustomTrend(machineTrendMonths(machine))) {
    return manualPlanDates(machine)
      .filter((d) => !isPlanDateCompleted(machine, d))
      .sort((a, b) => a.getTime() - b.getTime());
  }
  const next = parseDateOnly(machine.nextMaintenanceDate);
  if (!next) return [];
  return isPlanDateCompleted(machine, next) ? [] : [next];
}

/** Next open PM date: earliest pending manual date for Custom, else stored next date. */
export function effectiveNextMaintenanceDate(machine: PlanMachine): string {
  const pending = pendingPlanDates(machine);
  if (pending[0]) return formatDateOnly(pending[0]);
  return String(machine.nextMaintenanceDate || '').trim();
}

/** Merge all manual dates — earliest becomes next, rest stay as extras (nothing dropped). */
export function mergeCustomPlan(
  next: string,
  extras?: string[]
): { nextMaintenanceDate: string; customPlanDates: string[] } {
  const all = normalizeCustomPlanDates([next, ...(extras || [])]);
  if (!all.length) return { nextMaintenanceDate: String(next || '').trim(), customPlanDates: [] };
  return {
    nextMaintenanceDate: all[0],
    customPlanDates: all.slice(1),
  };
}

export function customPlanSpan(machine: PlanMachine): {
  count: number;
  months: number;
  from: string;
  to: string;
} | null {
  const dates = manualPlanDates(machine);
  if (!dates.length) return null;
  const from = dates[0];
  const to = dates[dates.length - 1];
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return {
    count: dates.length,
    months: Math.max(0, months),
    from: formatDateOnly(from),
    to: formatDateOnly(to),
  };
}

/** Upcoming PM dates to show in machine detail. */
export function upcomingPlanDates(machine: PlanMachine, count = 5): Date[] {
  const trend = machineTrendMonths(machine);
  if (isCustomTrend(trend)) return pendingPlanDates(machine);
  const next = parseDateOnly(effectiveNextMaintenanceDate(machine));
  if (!next) return [];
  const out: Date[] = [];
  let cursor = next;
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(cursor));
    const n = parseDateOnly(addMonthsToDate(cursor, trend));
    if (!n || n.getTime() === cursor.getTime()) break;
    cursor = n;
  }
  return out;
}

export function groupDatesByCellKey(dates: Date[]): Map<string, Date[]> {
  const map = new Map<string, Date[]>();
  for (const d of dates) {
    const k = dateToPmCellKey(d);
    const arr = map.get(k) || [];
    arr.push(d);
    map.set(k, arr);
  }
  return map;
}

export function maintenancePendingDays(machine: PlanMachine, now = new Date()): number {
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine), now);
  if (days == null) return 0;
  if (days >= 0) return 0;
  return Math.abs(days);
}

/** Done button only inside 1-week window (including overdue). Hides after Done until next window. */
export function canMarkMaintenanceDone(machine: PlanMachine, now = new Date()): boolean {
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine), now);
  if (days == null || days > 7) return false;
  return true;
}

export function normalizeTrendMonths(raw: unknown, fallback: number = DEFAULT_TREND_MONTHS): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
  if (n === CUSTOM_TREND_MONTHS) return CUSTOM_TREND_MONTHS;
  if (Number.isFinite(n) && n >= 1 && n <= 24) return Math.round(n);
  return fallback;
}

export function machineTrendMonths(
  machine: Pick<MaintenanceMachine, 'trendMonths'>
): number {
  const n = typeof machine.trendMonths === 'number' ? machine.trendMonths : parseInt(String(machine.trendMonths || ''), 10);
  if (n === CUSTOM_TREND_MONTHS) return CUSTOM_TREND_MONTHS;
  return normalizeTrendMonths(machine.trendMonths);
}

export function normalizeCustomPlanDates(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;\s]+/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const d = parseDateOnly(String(v || '').trim());
    if (!d) continue;
    const k = formatDateOnly(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.sort();
}

/** Add N calendar months to a yyyy-mm-dd date (or Date). */
export function addMonthsToDate(from: string | Date, months: number): string {
  const base =
    typeof from === 'string'
      ? new Date(from.includes('T') ? from : `${from}T00:00:00`)
      : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Suggest next maintenance date after Done using machine trend. Empty for Custom. */
export function suggestNextMaintenanceDate(
  from: string | Date = new Date(),
  trendMonths: number = DEFAULT_TREND_MONTHS
): string {
  const trend = normalizeTrendMonths(trendMonths);
  if (isCustomTrend(trend)) return '';
  return addMonthsToDate(from, trend);
}

/** Next date after trend change — from last done date or today. Custom keeps current next date. */
export function nextDateForTrend(
  machine: Pick<MaintenanceMachine, 'lastMaintenanceDate' | 'nextMaintenanceDate'>,
  trendMonths: number,
  now = new Date()
): string {
  const trend = normalizeTrendMonths(trendMonths);
  if (isCustomTrend(trend)) {
    return String(machine.nextMaintenanceDate || '').trim() || todayIso(now);
  }
  const base = machine.lastMaintenanceDate?.trim() || todayIso(now);
  return addMonthsToDate(base, trend);
}

function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function complaintPendingDays(reportedAt: string, now = new Date()): number {
  const reported = new Date(reportedAt);
  if (Number.isNaN(reported.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - reported.getTime()) / (24 * 60 * 60 * 1000)));
}

export function formatDowntimeLabel(minutes?: number | null): string {
  const n = Math.round(Number(minutes) || 0);
  if (n <= 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function complaintResolutionDays(
  reportedAt: string,
  resolvedAt: string,
  now = new Date()
): number {
  const reported = new Date(reportedAt);
  const resolved = new Date(resolvedAt);
  if (Number.isNaN(reported.getTime()) || Number.isNaN(resolved.getTime())) {
    return complaintPendingDays(reportedAt, now);
  }
  return Math.max(
    0,
    Math.floor((resolved.getTime() - reported.getTime()) / (24 * 60 * 60 * 1000))
  );
}

/** Resolved within 7 days of QR scan / report. */
export function isComplaintResolvedWithinWeek(c: MaintenanceComplaint): boolean {
  if (c.status !== 'Resolved' || !c.resolvedAt) return false;
  return complaintResolutionDays(c.reportedAt, c.resolvedAt) <= COMPLAINT_RESOLVE_SLA_DAYS;
}

/** Open >7 days OR resolved after 7 days. */
export function isComplaintOverOneWeek(c: MaintenanceComplaint, now = new Date()): boolean {
  if (c.status === 'Open') {
    return complaintPendingDays(c.reportedAt, now) > COMPLAINT_RESOLVE_SLA_DAYS;
  }
  if (c.status === 'Resolved' && c.resolvedAt) {
    return complaintResolutionDays(c.reportedAt, c.resolvedAt) > COMPLAINT_RESOLVE_SLA_DAYS;
  }
  return false;
}

export interface ComplaintStats {
  total: number;
  pending: number;
  resolved: number;
  resolvedPct: number;
  resolvedWithinWeek: number;
  overOneWeek: number;
}

export function computeComplaintStats(
  complaints: MaintenanceComplaint[],
  now = new Date()
): ComplaintStats {
  const total = complaints.length;
  const pending = complaints.filter((c) => c.status === 'Open').length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const resolvedWithinWeek = complaints.filter((c) => isComplaintResolvedWithinWeek(c)).length;
  const overOneWeek = complaints.filter((c) => isComplaintOverOneWeek(c, now)).length;
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return { total, pending, resolved, resolvedPct, resolvedWithinWeek, overOneWeek };
}

export function filterComplaintsByDashboard(
  complaints: MaintenanceComplaint[],
  filter: ComplaintDashboardFilter,
  now = new Date()
): MaintenanceComplaint[] {
  switch (filter) {
    case 'pending':
      return complaints.filter((c) => c.status === 'Open');
    case 'resolved':
      return complaints.filter((c) => c.status === 'Resolved');
    case 'within_week':
      return complaints.filter((c) => isComplaintResolvedWithinWeek(c));
    case 'over_week':
      return complaints.filter((c) => isComplaintOverOneWeek(c, now));
    default:
      return complaints;
  }
}

export function parseDateOnly(value?: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sheet-style week bucket: W1=1–7, W2=8–14, W3=15–21, W4=22–end. */
export function weekOfMonth(d: Date): 1 | 2 | 3 | 4 {
  const day = d.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function pmCellKey(year: number, monthIndex: number, week: number): string {
  return `${year}-${monthIndex}-${week}`;
}

export function dateToPmCellKey(d: Date): string {
  return pmCellKey(d.getFullYear(), d.getMonth(), weekOfMonth(d));
}

function uniqueDates(values: Array<string | undefined>): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const v of values) {
    const d = parseDateOnly(v);
    if (!d) continue;
    const k = formatDateOnly(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

/** Planned PM dates for a calendar year. Custom = only entered dates; trend = next date forward (no invented past misses). */
export function plannedDatesForYear(machine: PlanMachine, year: number): Date[] {
  const trend = machineTrendMonths(machine);
  const raw: Array<string | undefined> = (machine.pmLogs || []).map((l) => l.plannedDate);

  if (isCustomTrend(trend)) {
    raw.push(...manualPlanDates(machine).map((d) => formatDateOnly(d)));
    return uniqueDates(raw).filter((d) => d.getFullYear() === year);
  }

  const next = parseDateOnly(machine.nextMaintenanceDate);
  if (next && next.getFullYear() <= year) {
    let cursor = new Date(next);
    let guard = 0;
    while (guard < 48 && cursor.getFullYear() <= year) {
      if (cursor.getFullYear() === year) raw.push(formatDateOnly(cursor));
      const n = parseDateOnly(addMonthsToDate(cursor, trend));
      if (!n || n.getTime() === cursor.getTime()) break;
      cursor = n;
      guard += 1;
    }
  }

  return uniqueDates(raw).filter((d) => d.getFullYear() === year);
}

export function actualDatesForYear(
  machine: Pick<MaintenanceMachine, 'lastMaintenanceDate' | 'pmLogs'>,
  year: number
): Date[] {
  return uniqueDates([
    machine.lastMaintenanceDate,
    ...(machine.pmLogs || []).map((l) => l.doneOn),
  ]).filter((d) => d.getFullYear() === year);
}

export interface PmPlanKpis {
  total: number;
  plannedThisMonth: number;
  doneThisMonth: number;
  overdue: number;
  onTime: number;
  delayed: number;
}

export type PmKpiId = 'total' | 'plannedThisMonth' | 'doneThisMonth' | 'onTime' | 'delayed' | 'overdue';

function machinePmFlags(
  machine: MaintenanceMachine,
  year: number,
  now: Date
): {
  plannedThisMonth: boolean;
  doneThisMonth: boolean;
  overdue: boolean;
  delayed: boolean;
  onTime: boolean;
  plannedThisMonthCount: number;
  doneThisMonthCount: number;
} {
  const month = now.getFullYear() === year ? now.getMonth() : -1;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const planned = plannedDatesForYear(machine, year);
  const actual = actualDatesForYear(machine, year);
  let plannedThisMonthCount = 0;
  let doneThisMonthCount = 0;
  let hasOverdue = false;
  let hasDelayed = false;
  let hasOnTime = false;

  for (const p of planned) {
    if (month >= 0 && p.getMonth() === month) plannedThisMonthCount += 1;
    const key = dateToPmCellKey(p);
    const matched = actual.find((a) => dateToPmCellKey(a) === key);
    const later = actual.find((a) => a.getTime() > p.getTime() && a.getMonth() === p.getMonth());
    if (matched || isPlanDateCompleted(machine, p)) hasOnTime = true;
    else if (later) hasDelayed = true;
    else if (p.getTime() < today.getTime()) hasOverdue = true;
  }
  for (const a of actual) {
    if (month >= 0 && a.getMonth() === month) doneThisMonthCount += 1;
  }

  return {
    plannedThisMonth: plannedThisMonthCount > 0,
    doneThisMonth: doneThisMonthCount > 0,
    overdue: hasOverdue,
    delayed: !hasOverdue && hasDelayed,
    onTime: !hasOverdue && !hasDelayed && hasOnTime,
    plannedThisMonthCount,
    doneThisMonthCount,
  };
}

export function computePmPlanKpis(
  machines: MaintenanceMachine[],
  year: number,
  now = new Date()
): PmPlanKpis {
  let plannedThisMonth = 0;
  let doneThisMonth = 0;
  let overdue = 0;
  let onTime = 0;
  let delayed = 0;

  for (const m of machines) {
    const flags = machinePmFlags(m, year, now);
    plannedThisMonth += flags.plannedThisMonthCount;
    doneThisMonth += flags.doneThisMonthCount;
    if (flags.overdue) overdue += 1;
    else if (flags.delayed) delayed += 1;
    else if (flags.onTime) onTime += 1;
  }

  return {
    total: machines.length,
    plannedThisMonth,
    doneThisMonth,
    overdue,
    onTime,
    delayed,
  };
}

export function listMachinesForPmKpi(
  machines: MaintenanceMachine[],
  year: number,
  kpi: PmKpiId,
  now = new Date()
): MaintenanceMachine[] {
  if (kpi === 'total') return machines;
  return machines.filter((m) => {
    const flags = machinePmFlags(m, year, now);
    if (kpi === 'plannedThisMonth') return flags.plannedThisMonth;
    if (kpi === 'doneThisMonth') return flags.doneThisMonth;
    if (kpi === 'overdue') return flags.overdue;
    if (kpi === 'delayed') return flags.delayed;
    if (kpi === 'onTime') return flags.onTime;
    return false;
  });
}

export const PM_KPI_TITLES: Record<PmKpiId, string> = {
  total: 'All machines',
  plannedThisMonth: 'Planned this month',
  doneThisMonth: 'Done this month',
  onTime: 'On time',
  delayed: 'Delayed',
  overdue: 'Overdue',
};
