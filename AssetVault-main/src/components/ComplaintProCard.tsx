import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ImageIcon,
} from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import {
  complaintPendingDays,
  complaintResolutionDays,
  formatDowntimeLabel,
  isComplaintOverOneWeek,
} from '../lib/maintenanceCodes';

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mon}/${yr} ${hh}:${mm}`;
}

function MetricTile({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'blue' | 'green' | 'orange' | 'red';
}) {
  const valueTone =
    tone === 'blue'
      ? 'text-blue-700'
      : tone === 'green'
        ? 'text-emerald-700'
        : tone === 'orange'
          ? 'text-orange-700'
          : tone === 'red'
            ? 'text-red-600'
            : 'text-stone-800';

  return (
    <div className="rounded-lg border border-stone-200/90 bg-stone-50/80 px-2 py-1.5 min-h-[52px]">
      <p className="text-[8px] font-black uppercase tracking-wider text-stone-400 leading-none mb-1">{label}</p>
      <p className={`text-[11px] font-bold leading-snug truncate ${valueTone}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ pending, critical }: { pending: boolean; critical?: boolean }) {
  if (pending) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide text-white shadow-sm ${
          critical ? 'bg-red-700' : 'bg-red-600'
        }`}
      >
        <Clock size={11} strokeWidth={2.5} />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wide shadow-sm">
      <CheckCircle2 size={11} strokeWidth={2.5} />
      Resolved
    </span>
  );
}

export default function ComplaintProCard({
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
  const isOpen = c.status === 'Open';
  const pendingDays = isOpen ? complaintPendingDays(c.reportedAt) : 0;
  const critical = isOpen && isComplaintOverOneWeek(c);
  const resolvedDays =
    !isOpen && c.resolvedAt ? complaintResolutionDays(c.reportedAt, c.resolvedAt) : null;
  const downtime = formatDowntimeLabel(c.downtimeMinutes);
  const plant = plantShortName(c.plantCode, plants);
  const machineTitle =
    c.equipmentName?.trim() || `${c.machineType.replace(/\s+Machine$/i, '')} ${c.machineNumber}`.trim();

  return (
    <article
      className={`group rounded-2xl border bg-white cursor-pointer overflow-hidden shadow-[0_10px_28px_-14px_rgba(30,41,59,0.22)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-14px_rgba(30,41,59,0.28)] transition-all duration-200 ${
        isOpen
          ? 'complaint-card-pending-beat border-red-300/90 bg-gradient-to-br from-white via-rose-50/30 to-red-50/20'
          : 'border-stone-200/90 ring-1 ring-emerald-100/70'
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-stone-900 truncate">{machineTitle}</h3>
          <p className="text-[11px] font-mono font-bold text-blue-700 mt-0.5">{c.assetCode}</p>
        </div>
        <StatusBadge pending={isOpen} critical={critical} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-black uppercase tracking-wide">
          Breakdown
        </span>
        <span className="inline-flex px-2 py-0.5 rounded-md border border-stone-200 bg-white text-[9px] font-bold text-stone-700">
          {c.assetCode}
        </span>
        {plant ? (
          <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[9px] font-black uppercase">
            {plant}
          </span>
        ) : null}
        {critical ? (
          <span className="inline-flex px-2 py-0.5 rounded-md bg-red-700 text-white text-[9px] font-black uppercase">
            Over 1 week
          </span>
        ) : null}
      </div>

      {/* Photo + metrics */}
      <div className="flex gap-3 px-4 pb-3">
        {c.photoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPhoto?.();
            }}
            className="shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden border-2 border-stone-200/90 bg-stone-100 shadow-inner hover:ring-2 hover:ring-blue-400/40 transition-shadow"
          >
            <img src={c.photoUrl} alt={c.photoName || 'Breakdown photo'} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-[88px] h-[88px] rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 flex flex-col items-center justify-center text-stone-300">
            <ImageIcon size={22} />
            <span className="text-[8px] font-bold uppercase mt-1">No photo</span>
          </div>
        )}

        <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
          <MetricTile label="Plant" value={plant || '—'} tone="blue" />
          <MetricTile
            label="Reported"
            value={formatDateShort(c.reportedAt).split(' ')[0]}
            tone="slate"
          />
          <MetricTile label="Department" value={c.department || '—'} />
          <MetricTile
            label={isOpen ? 'Open age' : 'Resolution'}
            value={isOpen ? `${pendingDays} day${pendingDays === 1 ? '' : 's'}` : resolvedDays != null ? `${resolvedDays}d` : 'Done'}
            tone={isOpen ? (critical ? 'red' : 'orange') : 'green'}
          />
          {c.reporterName ? (
            <MetricTile label="Reporter" value={c.reporterName} />
          ) : (
            <MetricTile label="Machine no." value={c.machineNumber} />
          )}
          {c.reporterPhone ? (
            <MetricTile label="Phone" value={c.reporterPhone} tone="blue" />
          ) : downtime ? (
            <MetricTile label="Downtime" value={downtime} tone="orange" />
          ) : (
            <MetricTile label="Location" value={c.location || '—'} />
          )}
        </div>
      </div>

      {/* Complaint text */}
      <div className="px-4 pb-3">
        <p className="text-[12px] font-semibold text-stone-800 leading-snug line-clamp-2">{c.complaintText}</p>
        {c.remark ? (
          <p className="text-[10px] text-stone-500 mt-1 line-clamp-1">{c.remark}</p>
        ) : null}
      </div>

      {/* Footer strip */}
      <div
        className={`flex items-center justify-between gap-2 px-4 py-2.5 border-t ${
          isOpen ? 'bg-red-50/60 border-red-100/80' : 'bg-emerald-50/50 border-emerald-100/80'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 text-[10px] font-semibold text-stone-500">
          <CalendarClock size={12} className="shrink-0 text-stone-400" />
          <span className="truncate">
            {isOpen ? `Reported ${formatDateShort(c.reportedAt)}` : `Resolved ${formatDateShort(c.resolvedAt)}`}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-blue-700 group-hover:text-blue-800 shrink-0">
          Detailed view
          <ArrowRight size={12} />
        </span>
      </div>
    </article>
  );
}

export { formatDateShort as complaintFormatDateShort };
