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
  formatDowntimeLabel,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
} from '../lib/maintenanceCodes';

export type ComplaintLaneFilter = 'all' | 'open' | 'critical' | 'resolved';

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
  lane: ComplaintLaneFilter,
  search: string
): MaintenanceComplaint[] {
  let list = complaints;
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
        </div>
      ) : null}
    </article>
  );
}

export default function PremiumComplaintDashboard({
  complaints,
  plants,
  lane,
  search,
  loading = false,
  onOpenDetail,
  onPreviewPhoto,
}: {
  complaints: MaintenanceComplaint[];
  plants?: PlantLike[];
  lane: ComplaintLaneFilter;
  search: string;
  loading?: boolean;
  onOpenDetail: (c: MaintenanceComplaint) => void;
  onPreviewPhoto?: (c: MaintenanceComplaint) => void;
}) {
  const filtered = filterComplaintsByLane(complaints, lane, search);

  const criticalOpen = filtered.filter((c) => c.status === 'Open' && isComplaintOverOneWeek(c));
  const activeOpen = filtered.filter((c) => c.status === 'Open' && !isComplaintOverOneWeek(c));
  const resolvedList = filtered.filter((c) => c.status === 'Resolved');

  const showLanes = lane === 'all' || lane === 'open';

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
              <ComplaintCard key={c.id} {...cardProps(c)} />
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
              <ComplaintCard key={c.id} {...cardProps(c)} />
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
              <ComplaintCard key={c.id} {...cardProps(c)} />
            ))}
          </div>
        </section>
      ) : null}

      {lane === 'critical' && criticalOpen.length === 0 && filtered.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <ComplaintCard key={c.id} {...cardProps(c)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
