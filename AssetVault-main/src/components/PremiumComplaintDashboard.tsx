import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import type { MaintenanceComplaint } from '../types/maintenance';
import type { PlantLike } from '../lib/plantDisplay';
import {
  filterComplaintsByDashboard,
  isComplaintOverOneWeek,
  type ComplaintDashboardFilter,
} from '../lib/maintenanceCodes';
import ComplaintProCard from './ComplaintProCard';

export type ComplaintLaneFilter = ComplaintDashboardFilter;

export function filterComplaintsByLane(
  complaints: MaintenanceComplaint[],
  filter: ComplaintDashboardFilter,
  search: string
): MaintenanceComplaint[] {
  let list = filterComplaintsByDashboard(complaints, filter);
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((c) =>
      `${c.assetCode} ${c.machineType} ${c.machineNumber} ${c.complaintText} ${c.location} ${c.plantCode} ${c.reporterName || ''} ${c.reporterEmployeeCode || ''} ${c.reporterPhone || ''}`
        .toLowerCase()
        .includes(q)
    );
  }
  return [...list].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
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
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-sm">
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

  const cardGrid = (items: MaintenanceComplaint[]) => (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => (
        <ComplaintProCard key={c.id} {...cardProps(c)} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4 pb-3">
      {showCritical ? (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-red-700">
              Critical — open over 1 week ({criticalOpen.length})
            </h3>
          </div>
          {cardGrid(criticalOpen)}
        </section>
      ) : null}

      {showActive ? (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-red-500" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-red-700">
              Active — pending within 1 week ({activeOpen.length})
            </h3>
          </div>
          {cardGrid(activeOpen)}
        </section>
      ) : null}

      {showResolved ? (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              {filter === 'within_week' ? 'Resolved within 1 week' : 'Resolved'} ({resolvedList.length})
            </h3>
          </div>
          {cardGrid(resolvedList.slice(0, filter === 'total' ? 6 : undefined))}
        </section>
      ) : null}

      {filter === 'over_week' && criticalOpen.length === 0 && filtered.length > 0 ? cardGrid(filtered) : null}
    </div>
  );
}
