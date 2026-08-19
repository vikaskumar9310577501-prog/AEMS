import type { ReactNode } from 'react';
import { CheckCircle2, Clock, MessageSquareWarning, ShieldAlert, Zap } from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import type { PlantLike } from '../lib/plantDisplay';
import { plantShortName } from '../lib/plantDisplay';
import {
  complaintPendingDays,
  complaintResolutionDays,
  formatDowntimeLabel,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
} from '../lib/maintenanceCodes';

export type ComplaintsViewFilter = 'all' | 'pending' | 'resolved';

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()}`;
}

function InboxRow({
  complaint: c,
  plants,
  onOpen,
  onPreviewPhoto,
  onResolve,
}: {
  complaint: MaintenanceComplaint;
  plants: PlantLike[];
  onOpen: () => void;
  onPreviewPhoto?: () => void;
  onResolve: () => void;
}) {
  const isOpen = c.status === 'Open';
  const pending = complaintPendingDays(c.reportedAt);
  const overWeek = isComplaintOverOneWeek(c);
  const withinWeek = isComplaintResolvedWithinWeek(c);
  const resolvedDays =
    !isOpen && c.resolvedAt ? complaintResolutionDays(c.reportedAt, c.resolvedAt) : null;
  const downtime = formatDowntimeLabel(c.downtimeMinutes);

  const accent =
    overWeek && isOpen
      ? 'border-l-rose-500'
      : isOpen
        ? 'border-l-orange-500'
        : 'border-l-emerald-500';

  return (
    <li
      className={`group px-4 sm:px-5 py-4 bg-white hover:bg-[#FFFDF9] transition-colors cursor-pointer border-b border-stone-100 last:border-b-0 border-l-[4px] ${accent}`}
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
      <div className="flex items-start gap-4">
        {c.photoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPhoto?.();
            }}
            className="shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border border-stone-200/80 bg-stone-50 shadow-sm hover:ring-2 hover:ring-blue-400/40 transition-all"
          >
            <img src={c.photoUrl} alt={c.photoName || 'Complaint photo'} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
            <MessageSquareWarning size={22} className="text-stone-300" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {c.assetCode}
            </span>
            <span
              className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                isOpen
                  ? 'bg-orange-50 text-orange-800 border border-orange-200/80'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              }`}
            >
              {isOpen ? 'Pending' : 'Done'}
            </span>
            {isOpen && overWeek && (
              <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-600 text-white">
                Over 1 week
              </span>
            )}
            {withinWeek && (
              <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-violet-50 text-violet-700 border border-violet-200/80">
                Within 1 week
              </span>
            )}
          </div>

          <p className="text-[11px] font-semibold text-stone-500 mt-1 truncate">
            {c.machineType} · {c.machineNumber}
            {c.department ? ` · ${c.department}` : ''}
            {c.responsibility ? ` · ${c.responsibility}` : ''}
            {' · '}
            {c.location} · {plantShortName(c.plantCode, plants)}
          </p>

          <p className="text-sm font-semibold text-stone-900 mt-1.5 leading-snug whitespace-pre-wrap">
            {c.complaintText}
          </p>

          {(downtime || c.remark || c.remarks) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {downtime ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/60">
                  <Zap size={10} /> {downtime}
                </span>
              ) : null}
              {c.remark ? (
                <span className="text-[10px] text-stone-500 truncate max-w-[min(100%,320px)]">
                  Remark: {c.remark}
                </span>
              ) : null}
              {c.remarks ? (
                <span className="text-[10px] text-emerald-700 truncate max-w-[min(100%,320px)]">
                  Fixed: {c.remarks}
                </span>
              ) : null}
            </div>
          )}

          <p className="text-[10px] text-stone-400 mt-2">
            Reported {formatDateShort(c.reportedAt)}
            {c.resolvedAt ? ` · Done ${formatDateShort(c.resolvedAt)}` : ''}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {isOpen ? (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                overWeek
                  ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                  : 'bg-orange-50 text-orange-800 border border-orange-200/60'
              }`}
            >
              <Clock size={13} />
              {pending}d
            </div>
          ) : resolvedDays != null ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-black tabular-nums">
              <CheckCircle2 size={13} />
              {resolvedDays}d
            </div>
          ) : null}

          {isOpen ? (
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase shadow-md shadow-emerald-500/25 transition-colors"
            >
              <CheckCircle2 size={13} /> Mark Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-[10px] font-black uppercase hover:bg-stone-50 shadow-sm"
            >
              View detail
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function LaneBlock({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: 'amber' | 'emerald' | 'rose';
  count: number;
  children: ReactNode;
}) {
  const label =
    tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-orange-800' : 'text-emerald-800';
  const icon =
    tone === 'rose' ? (
      <ShieldAlert size={15} className="text-rose-600" />
    ) : tone === 'amber' ? (
      <Clock size={15} className="text-orange-600" />
    ) : (
      <CheckCircle2 size={15} className="text-emerald-600" />
    );

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-[0_8px_32px_-8px_rgba(120,90,60,0.12)]">
      <div className="px-4 py-2.5 border-b border-stone-200/60 flex items-center gap-2 bg-[#FFFCF8]">
        {icon}
        <h3 className={`text-[11px] font-black uppercase tracking-wider ${label}`}>
          {title} ({count})
        </h3>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

export default function ComplaintsInbox({
  complaints,
  plants,
  loading,
  viewFilter,
  onViewFilterChange,
  stats,
  onOpenDetail,
  onPreviewPhoto,
  onResolve,
}: {
  complaints: MaintenanceComplaint[];
  plants: PlantLike[];
  loading?: boolean;
  viewFilter: ComplaintsViewFilter;
  onViewFilterChange: (f: ComplaintsViewFilter) => void;
  stats: { total: number; pending: number; done: number };
  onOpenDetail: (c: MaintenanceComplaint) => void;
  onPreviewPhoto: (c: MaintenanceComplaint) => void;
  onResolve: (c: MaintenanceComplaint) => void;
}) {
  const pending = complaints.filter((c) => c.status === 'Open');
  const critical = pending.filter((c) => isComplaintOverOneWeek(c));
  const active = pending.filter((c) => !isComplaintOverOneWeek(c));
  const done = complaints.filter((c) => c.status === 'Resolved');

  const rowProps = (c: MaintenanceComplaint) => ({
    complaint: c,
    plants,
    onOpen: () => onOpenDetail(c),
    onPreviewPhoto: c.photoUrl ? () => onPreviewPhoto(c) : undefined,
    onResolve: () => onResolve(c),
  });

  const filterBtn = (id: ComplaintsViewFilter, label: string) => (
    <button
      type="button"
      onClick={() => onViewFilterChange(id)}
      className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-colors ${
        viewFilter === id
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="rounded-2xl border border-stone-200/80 bg-white px-4 sm:px-5 py-4 shadow-[0_8px_32px_-8px_rgba(120,90,60,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <MessageSquareWarning size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-stone-900 tracking-tight">QR Scan Complaints</h2>
              <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                Field inbox · fix hone par Mark Done karo
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/80 text-[10px] font-black uppercase text-stone-700">
              Total <span className="tabular-nums">{stats.total}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200/80 text-[10px] font-black uppercase text-orange-900">
              Pending <span className="tabular-nums">{stats.pending}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-[10px] font-black uppercase text-emerald-800">
              Done <span className="tabular-nums">{stats.done}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-stone-100">
          {filterBtn('all', 'All')}
          {filterBtn('pending', 'Pending')}
          {filterBtn('resolved', 'Done')}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-stone-500 py-12">Loading complaints…</p>
      ) : complaints.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-sm">
          <MessageSquareWarning className="mx-auto text-stone-300 mb-3" size={36} />
          <p className="text-sm font-semibold text-stone-600">No complaints match this search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(viewFilter === 'all' || viewFilter === 'pending') && critical.length > 0 && (
            <LaneBlock title="Critical — over 1 week open" tone="rose" count={critical.length}>
              {critical.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </LaneBlock>
          )}

          {(viewFilter === 'all' || viewFilter === 'pending') && active.length > 0 && (
            <LaneBlock title="Pending — needs action" tone="amber" count={active.length}>
              {active.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </LaneBlock>
          )}

          {(viewFilter === 'all' || viewFilter === 'resolved') && done.length > 0 && (
            <LaneBlock title="Completed" tone="emerald" count={done.length}>
              {done.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </LaneBlock>
          )}

          {viewFilter === 'pending' && pending.length === 0 && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-10 text-center shadow-sm">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={32} />
              <p className="text-sm font-semibold text-stone-600">No pending complaints right now.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
