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
    <div className="rounded-md border border-stone-200/90 bg-stone-50/80 px-1.5 py-1 min-h-[36px]">
      <p className="text-[7px] font-black uppercase tracking-wider text-stone-400 leading-none mb-0.5">{label}</p>
      <p className={`text-[10px] font-bold leading-tight truncate ${valueTone}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ pending, critical }: { pending: boolean; critical?: boolean }) {
  if (pending) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide text-white ${
          critical ? 'bg-red-700' : 'bg-red-600'
        }`}
      >
        <Clock size={9} strokeWidth={2.5} />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wide">
      <CheckCircle2 size={9} strokeWidth={2.5} />
      Done
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
      className={`group rounded-xl border bg-white cursor-pointer overflow-hidden shadow-[0_6px_18px_-12px_rgba(30,41,59,0.2)] hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(30,41,59,0.24)] transition-all duration-200 ${
        isOpen
          ? 'complaint-card-pending-beat border-red-300/90 bg-gradient-to-br from-white via-rose-50/25 to-red-50/15'
          : 'border-stone-200/90 ring-1 ring-emerald-100/60'
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
      <div className="flex items-start justify-between gap-2 px-2.5 pt-2.5 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1 mb-0.5">
            <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-600 text-white text-[7px] font-black uppercase">
              Breakdown
            </span>
            {plant ? (
              <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200/80 text-[7px] font-black uppercase">
                {plant}
              </span>
            ) : null}
            {critical ? (
              <span className="inline-flex px-1.5 py-0.5 rounded bg-red-700 text-white text-[7px] font-black uppercase">
                1w+
              </span>
            ) : null}
          </div>
          <h3 className="text-[12px] font-black text-stone-900 truncate leading-tight">{machineTitle}</h3>
          <p className="text-[10px] font-mono font-bold text-blue-700 leading-none mt-0.5">{c.assetCode}</p>
        </div>
        <StatusBadge pending={isOpen} critical={critical} />
      </div>

      <div className="flex gap-2 px-2.5 pb-2">
        {c.photoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPhoto?.();
            }}
            className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-stone-200/90 bg-stone-100 hover:ring-2 hover:ring-blue-400/40 transition-shadow"
          >
            <img src={c.photoUrl} alt={c.photoName || 'Breakdown photo'} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-14 h-14 rounded-lg border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-stone-300">
            <ImageIcon size={16} />
          </div>
        )}

        <div className="flex-1 min-w-0 grid grid-cols-2 gap-1">
          <MetricTile label="Plant" value={plant || '—'} tone="blue" />
          <MetricTile label="Reported" value={formatDateShort(c.reportedAt).split(' ')[0]} tone="slate" />
          <MetricTile label="Dept" value={c.department || '—'} />
          <MetricTile
            label={isOpen ? 'Open' : 'Fixed in'}
            value={isOpen ? `${pendingDays}d` : resolvedDays != null ? `${resolvedDays}d` : 'Done'}
            tone={isOpen ? (critical ? 'red' : 'orange') : 'green'}
          />
          {c.reporterName ? (
            <MetricTile label="Reporter" value={c.reporterName} />
          ) : (
            <MetricTile label="M/C No." value={c.machineNumber} />
          )}
          {c.reporterPhone ? (
            <MetricTile label="Phone" value={c.reporterPhone} tone="blue" />
          ) : downtime ? (
            <MetricTile label="Down" value={downtime} tone="orange" />
          ) : (
            <MetricTile label="Loc" value={c.location || '—'} />
          )}
        </div>
      </div>

      <div className="px-2.5 pb-2">
        <p className="text-[11px] font-semibold text-stone-800 leading-snug line-clamp-1">{c.complaintText}</p>
      </div>

      <div
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 border-t ${
          isOpen ? 'bg-red-50/50 border-red-100/70' : 'bg-emerald-50/40 border-emerald-100/70'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0 text-[9px] font-semibold text-stone-500">
          <CalendarClock size={10} className="shrink-0 text-stone-400" />
          <span className="truncate">
            {isOpen ? formatDateShort(c.reportedAt) : formatDateShort(c.resolvedAt)}
          </span>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-blue-700 group-hover:text-blue-800 shrink-0">
          Details
          <ArrowRight size={10} />
        </span>
      </div>
    </article>
  );
}

export { formatDateShort as complaintFormatDateShort };
