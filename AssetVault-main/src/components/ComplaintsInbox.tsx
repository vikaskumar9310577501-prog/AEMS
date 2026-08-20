import type { ReactNode } from 'react';
import { CheckCircle2, Clock, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import type { PlantLike } from '../lib/plantDisplay';
import { isComplaintOverOneWeek } from '../lib/maintenanceCodes';
import ComplaintProCard from './ComplaintProCard';

export type ComplaintsViewFilter = 'all' | 'pending' | 'resolved';

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
    tone === 'rose' ? 'text-red-700' : tone === 'amber' ? 'text-red-700' : 'text-emerald-800';
  const icon =
    tone === 'rose' ? (
      <ShieldAlert size={15} className="text-red-600" />
    ) : tone === 'amber' ? (
      <Clock size={15} className="text-red-500" />
    ) : (
      <CheckCircle2 size={15} className="text-emerald-600" />
    );

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 px-0.5">
        {icon}
        <h3 className={`text-[11px] font-black uppercase tracking-wider ${label}`}>
          {title} ({count})
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
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

  const cardProps = (c: MaintenanceComplaint) => ({
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
                <ComplaintProCard key={c.id} {...cardProps(c)} />
              ))}
            </Lane>
          )}

          {(viewFilter === 'all' || viewFilter === 'pending') && active.length > 0 && (
            <Lane title="Pending — needs action" tone="amber" count={active.length}>
              {active.map((c) => (
                <ComplaintProCard key={c.id} {...cardProps(c)} />
              ))}
            </Lane>
          )}

          {(viewFilter === 'all' || viewFilter === 'resolved') && done.length > 0 && (
            <Lane title="Completed" tone="emerald" count={done.length}>
              {done.map((c) => (
                <ComplaintProCard key={c.id} {...cardProps(c)} />
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
