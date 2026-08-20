import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Heart, MessageSquareWarning, ShieldAlert, Zap } from 'lucide-react';
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

function InboxRow({
  complaint: c,
  plants,
  onOpen,
  onPreviewPhoto,
}: {
  complaint: MaintenanceComplaint;
  plants: PlantLike[];
  onOpen: () => void;
  onPreviewPhoto?: () => void;
}) {
  const isOpen = c.status === 'Open';
  const pending = complaintPendingDays(c.reportedAt);
  const overWeek = isComplaintOverOneWeek(c);
  const withinWeek = isComplaintResolvedWithinWeek(c);
  const resolvedDays =
    !isOpen && c.resolvedAt ? complaintResolutionDays(c.reportedAt, c.resolvedAt) : null;
  const downtime = formatDowntimeLabel(c.downtimeMinutes);

  return (
    <li
      className="group rounded-xl border border-stone-200/80 bg-white px-3 py-2 cursor-pointer shadow-[0_6px_16px_-12px_rgba(120,90,60,0.16)] hover:bg-[#FFFDF9] hover:border-stone-300/80 transition-colors"
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
      <div className="flex items-center gap-3">
        {c.photoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPhoto?.();
            }}
            className="shrink-0 w-11 h-11 rounded-lg overflow-hidden border border-stone-200/80 bg-stone-50 hover:ring-2 hover:ring-blue-400/40"
          >
            <img src={c.photoUrl} alt={c.photoName || 'Complaint photo'} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-11 h-11 rounded-lg border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
            <MessageSquareWarning size={16} className="text-stone-300" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
              {c.assetCode}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                isOpen
                  ? 'bg-rose-100/90 text-rose-500 border border-rose-200/80 complaint-heartbeat'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              }`}
            >
              {isOpen ? <Heart size={9} className="fill-rose-400/80" /> : null}
              {isOpen ? 'Pending' : 'Done'}
            </span>
            {isOpen && overWeek ? (
              <span className="inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-red-500/10 text-red-700 border border-red-200/80">
                Over 1 week
              </span>
            ) : null}
            {withinWeek ? (
              <span className="inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-violet-50 text-violet-700 border border-violet-200/80">
                Within 1 week
              </span>
            ) : null}
            {downtime ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md">
                <Zap size={9} /> {downtime}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-semibold text-stone-500 mt-0.5 truncate">
            {c.machineType} · {c.machineNumber}
            {c.department ? ` · ${c.department}` : ''}
            {' · '}
            {c.location} · {plantShortName(c.plantCode, plants)}
          </p>
          <p className="text-[13px] font-bold text-stone-900 truncate">{c.complaintText}</p>
        </div>

        <div
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black tabular-nums ${
            isOpen
              ? overWeek
                ? 'bg-red-500/10 text-red-700 border border-red-200/70'
                : 'bg-orange-50 text-orange-800 border border-orange-200/60'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
          }`}
        >
          {isOpen ? <Clock size={12} /> : <CheckCircle2 size={12} />}
          {isOpen ? `${pending}d` : resolvedDays != null ? `${resolvedDays}d` : 'Done'}
        </div>
      </div>
    </li>
  );
}

function Lane({
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
    <section>
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        {icon}
        <h3 className={`text-[11px] font-black uppercase tracking-wider ${label}`}>
          {title} ({count})
        </h3>
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

export default function ComplaintsInbox({
  complaints,
  plants,
  loading,
  viewFilter,
  onViewFilterChange,
  onOpenDetail,
  onPreviewPhoto,
}: {
  complaints: MaintenanceComplaint[];
  plants: PlantLike[];
  loading?: boolean;
  viewFilter: ComplaintsViewFilter;
  onViewFilterChange: (f: ComplaintsViewFilter) => void;
  stats?: { total: number; pending: number; done: number };
  onOpenDetail: (c: MaintenanceComplaint) => void;
  onPreviewPhoto: (c: MaintenanceComplaint) => void;
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
  });

  const filterBtn = (id: ComplaintsViewFilter, label: string) => (
    <button
      type="button"
      onClick={() => onViewFilterChange(id)}
      className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border transition-colors ${
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
      <div className="flex flex-wrap gap-2">
        {filterBtn('all', 'All')}
        {filterBtn('pending', 'Pending')}
        {filterBtn('resolved', 'Done')}
      </div>

      {loading ? (
        <p className="text-center text-sm text-stone-500 py-12">Loading complaints…</p>
      ) : complaints.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-sm">
          <MessageSquareWarning className="mx-auto text-stone-300 mb-3" size={36} />
          <p className="text-sm font-semibold text-stone-600">No complaints match this search.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(viewFilter === 'all' || viewFilter === 'pending') && critical.length > 0 && (
            <Lane title="Critical — over 1 week open" tone="rose" count={critical.length}>
              {critical.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </Lane>
          )}

          {(viewFilter === 'all' || viewFilter === 'pending') && active.length > 0 && (
            <Lane title="Pending — needs action" tone="amber" count={active.length}>
              {active.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </Lane>
          )}

          {(viewFilter === 'all' || viewFilter === 'resolved') && done.length > 0 && (
            <Lane title="Completed" tone="emerald" count={done.length}>
              {done.map((c) => (
                <InboxRow key={c.id} {...rowProps(c)} />
              ))}
            </Lane>
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
