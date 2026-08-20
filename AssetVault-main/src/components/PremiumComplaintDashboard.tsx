import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ImageIcon,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import {
  complaintPendingDays,
  filterComplaintsByDashboard,
  formatDowntimeLabel,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
  type ComplaintDashboardFilter,
} from '../lib/maintenanceCodes';

export type ComplaintLaneFilter = ComplaintDashboardFilter;

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()}`;
}

export function filterComplaintsByLane(
  complaints: MaintenanceComplaint[],
  filter: ComplaintDashboardFilter,
  search: string
): MaintenanceComplaint[] {
  let list = filterComplaintsByDashboard(complaints, filter);
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((c) =>
      `${c.assetCode} ${c.machineType} ${c.machineNumber} ${c.complaintText} ${c.location} ${c.plantCode}`
        .toLowerCase()
        .includes(q)
    );
  }
  return [...list].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
}

function ComplaintCard({
  complaint: c,
  plants,
  onOpen,
  onPreviewPhoto,
}: {
  complaint: MaintenanceComplaint;
  plants?: PlantLike[];
  onOpen: () => void;
  onPreviewPhoto?: () => void;
}) {
  const open = c.status === 'Open';
  const pendingDays = open ? complaintPendingDays(c.reportedAt) : 0;
  const critical = open && isComplaintOverOneWeek(c);
  const resolvedFast = !open && isComplaintResolvedWithinWeek(c);
  const downtime = formatDowntimeLabel(c.downtimeMinutes);

  return (
    <article
      className={`group rounded-2xl border border-stone-200/80 p-3.5 bg-white cursor-pointer shadow-[0_8px_20px_-12px_rgba(120,90,60,0.18)] hover:-translate-y-px hover:shadow-[0_12px_24px_-12px_rgba(120,90,60,0.22)] transition-all ${
        critical ? 'ring-1 ring-rose-200/80' : open ? '' : 'ring-1 ring-emerald-100/80'
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
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80">
              {plantShortName(c.plantCode, plants)}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-stone-800 leading-snug line-clamp-2">{c.complaintText}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {open ? (
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                  critical ? 'bg-rose-600 text-white' : 'bg-orange-50 text-orange-800 border border-orange-200/80'
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
        </div>
      ) : null}
    </article>
  );
}

export default function PremiumComplaintDashboard({
  complaints,
  plants,
  filter,
  search,
  loading = false,
  onOpenDetail,
  onPreviewPhoto,
}: {
  complaints: MaintenanceComplaint[];
  plants?: PlantLike[];
  filter: ComplaintDashboardFilter;
  search: string;
  loading?: boolean;
  onOpenDetail: (c: MaintenanceComplaint) => void;
  onPreviewPhoto?: (c: MaintenanceComplaint) => void;
}) {
  const filtered = filterComplaintsByLane(complaints, filter, search);

  const criticalOpen = filtered.filter((c) => c.status === 'Open' && isComplaintOverOneWeek(c));
  const activeOpen = filtered.filter((c) => c.status === 'Open' && !isComplaintOverOneWeek(c));
  const resolvedList = filtered.filter((c) => c.status === 'Resolved');

  const showCritical =
    (filter === 'total' || filter === 'pending' || filter === 'over_week') && criticalOpen.length > 0;
  const showActive = (filter === 'total' || filter === 'pending') && activeOpen.length > 0;
  const showResolved =
    (filter === 'total' || filter === 'resolved' || filter === 'within_week') && resolvedList.length > 0;

  if (loading) {
    return <p className="text-center text-sm text-stone-500 py-12">Loading complaints…</p>;
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
        <ShieldAlert className="mx-auto text-stone-300 mb-3" size={36} />
        <p className="text-sm font-semibold text-stone-600">No complaints match this view.</p>
      </div>
    );
  }

  const cardProps = (c: MaintenanceComplaint) => ({
    complaint: c,
    plants,
    onOpen: () => onOpenDetail(c),
    onPreviewPhoto: onPreviewPhoto ? () => onPreviewPhoto(c) : undefined,
  });

  return (
    <div className="space-y-5 pb-4">
      {showCritical ? (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle size={16} className="text-rose-600" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-rose-700">
              Critical — open over 7 days ({criticalOpen.length})
            </h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {criticalOpen.map((c) => (
              <ComplaintCard key={c.id} {...cardProps(c)} />
            ))}
          </div>
        </section>
      ) : null}

      {showActive ? (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <Clock size={16} className="text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-800">
              Active — open within 7 days ({activeOpen.length})
            </h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {activeOpen.map((c) => (
              <ComplaintCard key={c.id} {...cardProps(c)} />
            ))}
          </div>
        </section>
      ) : null}

      {showResolved ? (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              {filter === 'within_week' ? 'Resolved within 1 week' : 'Resolved'} ({resolvedList.length})
            </h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {resolvedList.slice(0, filter === 'total' ? 6 : undefined).map((c) => (
              <ComplaintCard key={c.id} {...cardProps(c)} />
            ))}
          </div>
        </section>
      ) : null}

      {filter === 'over_week' && criticalOpen.length === 0 && filtered.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <ComplaintCard key={c.id} {...cardProps(c)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
