import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import { isComplaintOverOneWeek } from '../lib/maintenanceCodes';

export type ComplaintLaneFilter = 'all' | 'open' | 'critical' | 'resolved';

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

function LaneSection({
  title,
  icon,
  tone,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: 'rose' | 'amber' | 'emerald';
  count: number;
  children: ReactNode;
}) {
  const bar =
    tone === 'rose'
      ? 'border-rose-200/80 bg-gradient-to-r from-rose-50/80 to-white'
      : tone === 'amber'
        ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/60 to-white'
        : 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 to-white';
  const label =
    tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-800' : 'text-emerald-800';

  return (
    <section className={`rounded-2xl border overflow-hidden shadow-sm ${bar}`}>
      <div className="px-4 py-2.5 border-b border-stone-200/40 flex items-center gap-2">
        {icon}
        <h3 className={`text-[11px] font-black uppercase tracking-wider ${label}`}>
          {title} ({count})
        </h3>
      </div>
      <ul className="divide-y divide-stone-100/90 bg-white/80">{children}</ul>
    </section>
  );
}

export default function PremiumComplaintDashboard({
  complaints,
  lane,
  search,
  loading = false,
  renderItem,
}: {
  complaints: MaintenanceComplaint[];
  lane: ComplaintLaneFilter;
  search: string;
  loading?: boolean;
  renderItem: (c: MaintenanceComplaint) => ReactNode;
}) {
  const filtered = filterComplaintsByLane(complaints, lane, search);

  const criticalOpen = filtered.filter((c) => c.status === 'Open' && isComplaintOverOneWeek(c));
  const activeOpen = filtered.filter((c) => c.status === 'Open' && !isComplaintOverOneWeek(c));
  const resolvedList = filtered.filter((c) => c.status === 'Resolved');

  const showCritical = (lane === 'all' || lane === 'open' || lane === 'critical') && criticalOpen.length > 0;
  const showActive = (lane === 'all' || lane === 'open') && activeOpen.length > 0;
  const showResolved =
    (lane === 'all' || lane === 'resolved') && resolvedList.length > 0;

  if (loading) {
    return <p className="text-center text-sm text-stone-500 py-12">Loading complaints…</p>;
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-sm">
        <ShieldAlert className="mx-auto text-stone-300 mb-3" size={36} />
        <p className="text-sm font-semibold text-stone-600">No complaints match this view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {showCritical ? (
        <LaneSection
          title="Critical — open over 7 days"
          tone="rose"
          count={criticalOpen.length}
          icon={<AlertTriangle size={15} className="text-rose-600" />}
        >
          {criticalOpen.map((c) => renderItem(c))}
        </LaneSection>
      ) : null}

      {showActive ? (
        <LaneSection
          title="Active — open within 7 days"
          tone="amber"
          count={activeOpen.length}
          icon={<Clock size={15} className="text-amber-600" />}
        >
          {activeOpen.map((c) => renderItem(c))}
        </LaneSection>
      ) : null}

      {showResolved ? (
        <LaneSection
          title="Resolved"
          tone="emerald"
          count={resolvedList.length}
          icon={<CheckCircle2 size={15} className="text-emerald-600" />}
        >
          {resolvedList.map((c) => renderItem(c))}
        </LaneSection>
      ) : null}
    </div>
  );
}
