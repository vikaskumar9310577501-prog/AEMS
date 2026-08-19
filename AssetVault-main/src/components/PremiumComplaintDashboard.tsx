import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ImageIcon,
  MessageSquareWarning,
  Search,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import {
  complaintPendingDays,
  complaintResolutionDays,
  formatDowntimeLabel,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
} from '../lib/maintenanceCodes';

type LaneFilter = 'all' | 'open' | 'critical' | 'resolved';

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()}`;
}

function ComplaintCard({
  complaint: c,
  plants,
  onOpen,
  onResolve,
  onPreviewPhoto,
}: {
  complaint: MaintenanceComplaint;
  plants?: PlantLike[];
  onOpen: () => void;
  onResolve: () => void;
  onPreviewPhoto?: () => void;
}) {
  const open = c.status === 'Open';
  const pendingDays = open ? complaintPendingDays(c.reportedAt) : 0;
  const critical = open && isComplaintOverOneWeek(c);
  const resolvedFast = !open && isComplaintResolvedWithinWeek(c);
  const downtime = formatDowntimeLabel(c.downtimeMinutes);

  return (
    <article
      className={`group rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${
        critical
          ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/90 to-white shadow-sm shadow-rose-100/50'
          : open
            ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white shadow-sm shadow-amber-100/40'
            : 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm'
      }`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
    >
      <div className="flex gap-3">
        {c.photoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPhoto?.();
            }}
            className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-stone-200/80 bg-stone-100 hover:ring-2 hover:ring-blue-400/40"
          >
            <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-14 h-14 rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-stone-300">
            <ImageIcon size={18} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
              {c.assetCode}
            </span>
            <span className="text-[10px] font-bold text-stone-500 truncate">
              {c.machineType} · {c.machineNumber}
            </span>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
              {plantShortName(c.plantCode, plants)}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-stone-800 leading-snug line-clamp-2">{c.complaintText}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {open ? (
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                  critical ? 'bg-rose-500 text-white' : 'bg-amber-500/15 text-amber-800 border border-amber-200'
                }`}
              >
                <Clock size={10} />
                {pendingDays}d open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={10} />
                Resolved {formatDateShort(c.resolvedAt)}
              </span>
            )}
            {resolvedFast ? (
              <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                SLA ✓
              </span>
            ) : null}
            {downtime ? (
              <span className="text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Zap size={9} /> {downtime}
              </span>
            ) : null}
            <span className="text-[9px] text-stone-400 ml-auto">Reported {formatDateShort(c.reportedAt)}</span>
          </div>
        </div>
      </div>

      {open ? (
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-stone-100/80" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onOpen}
            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Details
          </button>
          <button
            type="button"
            onClick={onResolve}
            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            Resolve
          </button>
        </div>
      ) : null}
    </article>
  );
}

function KpiTile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: 'slate' | 'amber' | 'rose' | 'emerald' | 'violet';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    slate: 'from-stone-100 to-stone-50 border-stone-200 text-stone-800',
    amber: 'from-amber-100/90 to-amber-50 border-amber-200 text-amber-900',
    rose: 'from-rose-100/90 to-rose-50 border-rose-200 text-rose-900',
    emerald: 'from-emerald-100/90 to-emerald-50 border-emerald-200 text-emerald-900',
    violet: 'from-violet-100/90 to-violet-50 border-violet-200 text-violet-900',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border bg-gradient-to-br px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tones[tone]} ${
        active ? 'ring-2 ring-blue-500/60 ring-offset-2 ring-offset-[#FAF8F5]' : ''
      }`}
    >
      <p className="text-[9px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums mt-0.5 leading-none">{value}</p>
    </button>
  );
}

export default function PremiumComplaintDashboard({
  complaints,
  plants,
  loading = false,
  onOpenDetail,
  onResolve,
  onPreviewPhoto,
}: {
  complaints: MaintenanceComplaint[];
  plants?: PlantLike[];
  loading?: boolean;
  onOpenDetail: (c: MaintenanceComplaint) => void;
  onResolve: (c: MaintenanceComplaint) => void;
  onPreviewPhoto?: (c: MaintenanceComplaint) => void;
}) {
  const [lane, setLane] = useState<LaneFilter>('all');
  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState('');

  const stats = useMemo(() => {
    const open = complaints.filter((c) => c.status === 'Open');
    const critical = open.filter((c) => isComplaintOverOneWeek(c));
    const resolved = complaints.filter((c) => c.status === 'Resolved');
    const slaHits = complaints.filter((c) => isComplaintResolvedWithinWeek(c)).length;
    const openAges = open.map((c) => complaintPendingDays(c.reportedAt));
    const avgOpenAge =
      openAges.length > 0 ? Math.round(openAges.reduce((a, b) => a + b, 0) / openAges.length) : 0;
    const resolvedDays = resolved
      .filter((c) => c.resolvedAt)
      .map((c) => complaintResolutionDays(c.reportedAt, c.resolvedAt!));
    const avgResolve =
      resolvedDays.length > 0
        ? (resolvedDays.reduce((a, b) => a + b, 0) / resolvedDays.length).toFixed(1)
        : '—';
    return {
      total: complaints.length,
      open: open.length,
      critical: critical.length,
      resolved: resolved.length,
      slaPct: complaints.length ? Math.round((slaHits / complaints.length) * 100) : 100,
      avgOpenAge,
      avgResolve,
    };
  }, [complaints]);

  const plantCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of complaints) {
      const k = c.plantCode || '—';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count, label: plantShortName(code, plants) }))
      .sort((a, b) => b.count - a.count);
  }, [complaints, plants]);

  const filtered = useMemo(() => {
    let list = complaints;
    if (plantFilter) {
      list = list.filter((c) => String(c.plantCode || '').toLowerCase() === plantFilter.toLowerCase());
    }
    if (lane === 'open') list = list.filter((c) => c.status === 'Open');
    if (lane === 'critical') list = list.filter((c) => c.status === 'Open' && isComplaintOverOneWeek(c));
    if (lane === 'resolved') list = list.filter((c) => c.status === 'Resolved');
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        `${c.assetCode} ${c.machineType} ${c.machineNumber} ${c.complaintText} ${c.location} ${c.plantCode}`
          .toLowerCase()
          .includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [complaints, lane, plantFilter, search]);

  const criticalOpen = useMemo(
    () => filtered.filter((c) => c.status === 'Open' && isComplaintOverOneWeek(c)),
    [filtered]
  );
  const activeOpen = useMemo(
    () => filtered.filter((c) => c.status === 'Open' && !isComplaintOverOneWeek(c)),
    [filtered]
  );
  const resolvedList = useMemo(() => filtered.filter((c) => c.status === 'Resolved'), [filtered]);

  const showLanes = lane === 'all' || lane === 'open';

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="rounded-2xl border border-stone-200/80 bg-gradient-to-r from-[#FFF7EE] via-[#FFFCF8] to-[#F6F1EA] px-4 py-4 shadow-[0_8px_32px_-8px_rgba(120,90,60,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/25">
              <MessageSquareWarning size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 tracking-tight">Complaint Command Center</h2>
              <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                Priority lanes · no charts · action-first view
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-stone-200/70 px-3 py-2 min-w-[200px] flex-1 max-w-md">
            <Search size={14} className="text-stone-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset, machine, complaint…"
              className="flex-1 bg-transparent text-[12px] font-semibold text-stone-800 placeholder:text-stone-400 outline-none"
            />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          <KpiTile label="Total" value={stats.total} tone="slate" active={lane === 'all'} onClick={() => setLane('all')} />
          <KpiTile label="Open" value={stats.open} tone="amber" active={lane === 'open'} onClick={() => setLane('open')} />
          <KpiTile
            label="Critical 7d+"
            value={stats.critical}
            tone="rose"
            active={lane === 'critical'}
            onClick={() => setLane('critical')}
          />
          <KpiTile
            label="Resolved"
            value={stats.resolved}
            tone="emerald"
            active={lane === 'resolved'}
            onClick={() => setLane('resolved')}
          />
          <KpiTile label="SLA hit %" value={`${stats.slaPct}%`} tone="violet" />
          <KpiTile label="Avg open age" value={`${stats.avgOpenAge}d`} tone="slate" />
        </div>

        {/* Plant chips */}
        {plantCounts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-stone-200/50">
            <button
              type="button"
              onClick={() => setPlantFilter('')}
              className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-colors ${
                !plantFilter
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              All plants
            </button>
            {plantCounts.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setPlantFilter(plantFilter === p.code ? '' : p.code)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  plantFilter === p.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-blue-50'
                }`}
              >
                {p.label} ({p.count})
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-center text-sm text-stone-500 py-12">Loading complaints…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <ShieldAlert className="mx-auto text-stone-300 mb-3" size={36} />
          <p className="text-sm font-semibold text-stone-600">No complaints match this view.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {showLanes && criticalOpen.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <AlertTriangle size={16} className="text-rose-600" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-rose-700">
                  Critical — open over 7 days ({criticalOpen.length})
                </h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {criticalOpen.map((c) => (
                  <ComplaintCard
                    key={c.id}
                    complaint={c}
                    plants={plants}
                    onOpen={() => onOpenDetail(c)}
                    onResolve={() => onResolve(c)}
                    onPreviewPhoto={onPreviewPhoto ? () => onPreviewPhoto(c) : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {showLanes && activeOpen.length > 0 ? (
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                  Active — open within 7 days ({activeOpen.length})
                </h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {activeOpen.map((c) => (
                  <ComplaintCard
                    key={c.id}
                    complaint={c}
                    plants={plants}
                    onOpen={() => onOpenDetail(c)}
                    onResolve={() => onResolve(c)}
                    onPreviewPhoto={onPreviewPhoto ? () => onPreviewPhoto(c) : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {(lane === 'resolved' || (lane === 'all' && resolvedList.length > 0)) ? (
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                  Resolved ({resolvedList.length})
                </h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {(lane === 'resolved' ? filtered : resolvedList).slice(0, lane === 'all' ? 6 : undefined).map((c) => (
                  <ComplaintCard
                    key={c.id}
                    complaint={c}
                    plants={plants}
                    onOpen={() => onOpenDetail(c)}
                    onResolve={() => onResolve(c)}
                    onPreviewPhoto={onPreviewPhoto ? () => onPreviewPhoto(c) : undefined}
                  />
                ))}
              </div>
              {lane === 'all' && resolvedList.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setLane('resolved')}
                  className="mt-2 text-[11px] font-bold text-blue-700 hover:underline"
                >
                  View all {resolvedList.length} resolved →
                </button>
              ) : null}
            </section>
          ) : null}

          {lane === 'critical' && criticalOpen.length === 0 && filtered.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <ComplaintCard
                  key={c.id}
                  complaint={c}
                  plants={plants}
                  onOpen={() => onOpenDetail(c)}
                  onResolve={() => onResolve(c)}
                  onPreviewPhoto={onPreviewPhoto ? () => onPreviewPhoto(c) : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
