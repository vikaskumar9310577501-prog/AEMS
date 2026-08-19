import type { ReactNode } from 'react';
import type { MaintenanceComplaint } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import {
  complaintPendingDays,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
} from '../lib/maintenanceCodes';

type Slice = { label: string; value: number; color: string };

function DonutChart({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="mx-auto">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <text x="50" y="54" textAnchor="middle" className="fill-slate-400 text-[10px] font-bold">
          No data
        </text>
      </svg>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {slices.map((slice) => {
          if (slice.value <= 0) return null;
          const len = (slice.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={slice.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="48" textAnchor="middle" className="fill-slate-900 text-[14px] font-black">
          {total}
        </text>
        <text x="50" y="58" textAnchor="middle" className="fill-slate-500 text-[7px] font-bold uppercase">
          Total
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs w-full">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-slate-600 truncate">{s.label}</span>
            </span>
            <span className="font-black text-slate-900 tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HorizontalBars({
  rows,
  emptyLabel = 'No data',
}: {
  rows: { label: string; value: number; color: string }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return <p className="text-sm text-slate-400 text-center py-6">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
            <span className="font-semibold text-slate-700 truncate">{row.label}</span>
            <span className="font-black text-slate-900 tabular-nums shrink-0">{row.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(row.value / max) * 100}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function VerticalBars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No trend data yet</p>;
  }
  return (
    <div className="flex items-end justify-between gap-2 h-36 pt-2">
      {rows.map((row) => (
        <div key={row.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] font-black text-slate-800 tabular-nums">{row.value}</span>
          <div className="w-full flex items-end justify-center h-24">
            <div
              className="w-full max-w-[2.5rem] rounded-t-lg transition-all duration-500"
              style={{
                height: `${Math.max(8, (row.value / max) * 100)}%`,
                background: row.color,
              }}
            />
          </div>
          <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 h-full">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">{title}</h3>
      {subtitle ? <p className="text-[10px] text-slate-500 mt-0.5 mb-3">{subtitle}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}

function groupCount(complaints: MaintenanceComplaint[], key: (c: MaintenanceComplaint) => string) {
  const map = new Map<string, number>();
  for (const c of complaints) {
    const k = key(c).trim() || 'Unknown';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

const BAR_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#e11d48'];

export default function MaintenanceComplaintCharts({
  complaints,
  plants,
}: {
  complaints: MaintenanceComplaint[];
  plants?: PlantLike[];
}) {
  const pending = complaints.filter((c) => c.status === 'Open').length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const withinWeek = complaints.filter((c) => isComplaintResolvedWithinWeek(c)).length;
  const overWeek = complaints.filter((c) => isComplaintOverOneWeek(c)).length;
  const pendingUnderWeek = complaints.filter(
    (c) => c.status === 'Open' && complaintPendingDays(c.reportedAt) <= 7
  ).length;

  const byPlant = groupCount(complaints, (c) => plantShortName(c.plantCode, plants)).map((r, i) => ({
    ...r,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  const byType = groupCount(complaints, (c) => c.machineType).map((r, i) => ({
    ...r,
    color: BAR_COLORS[(i + 2) % BAR_COLORS.length],
  }));

  const byLocation = groupCount(complaints, (c) => c.location).map((r, i) => ({
    ...r,
    color: BAR_COLORS[(i + 1) % BAR_COLORS.length],
  }));

  const monthMap = new Map<string, number>();
  for (const c of complaints) {
    const d = new Date(c.reportedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  }
  const monthRows = Array.from(monthMap.entries())
    .sort((a, b) => {
      const [ma, ya] = a[0].split('/');
      const [mb, yb] = b[0].split('/');
      return Number(`20${ya}${ma}`) - Number(`20${yb}${mb}`);
    })
    .slice(-6)
    .map(([label, value], i) => ({ label, value, color: BAR_COLORS[i % BAR_COLORS.length] }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <ChartCard title="Status split" subtitle="Pending vs resolved">
        <DonutChart
          slices={[
            { label: 'Pending', value: pending, color: '#f59e0b' },
            { label: 'Resolved', value: resolved, color: '#10b981' },
          ]}
        />
      </ChartCard>

      <ChartCard title="Resolution SLA" subtitle="1-week target performance">
        <DonutChart
          slices={[
            { label: 'Resolved ≤ 7 days', value: withinWeek, color: '#8b5cf6' },
            { label: 'Open ≤ 7 days', value: pendingUnderWeek, color: '#38bdf8' },
            { label: 'Over 1 week', value: overWeek, color: '#f43f5e' },
          ]}
        />
      </ChartCard>

      <ChartCard title="Monthly trend" subtitle="Complaints reported per month">
        <VerticalBars rows={monthRows} />
      </ChartCard>

      <ChartCard title="By plant" subtitle="Complaint count per plant">
        <HorizontalBars rows={byPlant} emptyLabel="No plant data" />
      </ChartCard>

      <ChartCard title="By machine type" subtitle="Which equipment types fail most">
        <HorizontalBars rows={byType} emptyLabel="No machine type data" />
      </ChartCard>

      <ChartCard title="By location" subtitle="Site-wise breakdown">
        <HorizontalBars rows={byLocation} emptyLabel="No location data" />
      </ChartCard>
    </div>
  );
}
