import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  RefreshCw,
  Search,
  Factory,
  QrCode,
  CheckCircle2,
  LayoutDashboard,
  AlertTriangle,
  Settings,
  Filter,
  BarChart3,
  Clock,
  MessageSquareWarning,
  Trash2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  X,
  Pencil,
  Eye,
  ImageIcon,
  MoreVertical,
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { parseJsonResponse } from '../lib/apiFetch';
import type { MaintenanceComplaint, MaintenanceMachine, MaintenanceMeta } from '../types/maintenance';
import { DEFAULT_MACHINE_TYPES, TREND_SELECT_OPTIONS, isCustomTrend, trendMonthsLabel } from '../types/maintenance';
import {
  canMarkMaintenanceDone,
  complaintPendingDays,
  complaintResolutionDays,
  computeComplaintStats,
  filterComplaintsByDashboard,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
  daysUntilDate,
  machineTrendMonths,
  maintenancePendingDays,
  effectiveNextMaintenanceDate,
  upcomingPlanDates,
  customPlanSpan,
  pendingPlanDates,
  COMPLAINT_RESOLVE_SLA_DAYS,
  computePmPlanKpis,
  listMachinesForPmKpi,
  PM_KPI_TITLES,
  formatDowntimeLabel,
  type ComplaintDashboardFilter,
  type PmKpiId,
} from '../lib/maintenanceCodes';
import {
  canAccessMaintenance,
  canAccessMaintenanceTab,
  canAddMaintenanceMachine,
  canManageMaintenanceFhPh,
  canViewMaintenanceComplaints,
  canViewMaintenanceDashboard,
  defaultMaintenanceTab,
  isItAdminRole,
  type MaintenanceTabId,
} from '../lib/userPermissions';
import { toDisplayDateInput, toDateInputValue } from '../lib/formatDisplayDate';
import MaintenancePmPlanBoard from '../components/MaintenancePmPlanBoard';
import MaintenanceComplaintCharts from '../components/MaintenanceComplaintCharts';
import MaintenanceQRPrintModal from '../components/MaintenanceQRPrintModal';
import MaintenanceDoneModal from '../components/MaintenanceDoneModal';
import MaintenanceResolveModal from '../components/MaintenanceResolveModal';
import MaintenanceMachineEditModal from '../components/MaintenanceMachineEditModal';
import { plantShortName, plantTableLabel } from '../lib/plantDisplay';

type Tab = MaintenanceTabId;

function machineRowName(m: MaintenanceMachine) {
  return m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim();
}

function trendCompactLabel(months: number): string {
  if (isCustomTrend(months)) return 'Custom';
  if (months === 1) return '1 mo';
  if (months === 12) return '12 mo';
  return `${months} mo`;
}

function MachineCell({
  children,
  className = '',
  title,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      className={`px-2 py-1.5 align-middle whitespace-nowrap border-b border-slate-100 ${className}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return toDisplayDateInput(value) || value;
  } catch {
    return value;
  }
}

function statusBadge(machine: MaintenanceMachine) {
  if (machine.status === 'Down') {
    return { label: 'DOWN', className: 'bg-red-50 text-red-600 border border-red-200' };
  }
  if (machine.status === 'Maintenance') {
    return { label: 'MAINTENANCE', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  }
  if (machine.status === 'Planned') {
    return { label: 'PLANNED', className: 'bg-blue-50 text-blue-600 border border-blue-200' };
  }
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine));
  if (days == null) return { label: machine.status?.toUpperCase() || 'ACTIVE', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  if (days < 0) return { label: `OVERDUE`, className: 'bg-red-50 text-red-600 border border-red-200' };
  if (days <= 7) return { label: `OVERDUE`, className: 'bg-orange-50 text-orange-600 border border-orange-200' };
  return { label: 'ACTIVE', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
}

function MiniTrendSvg({ months }: { months: number }) {
  const isCustom = isCustomTrend(months);
  const color = isCustom ? '#f59e0b' : months <= 3 ? '#ef4444' : '#22c55e';
  const points = isCustom
    ? '2,12 8,8 14,14 20,6 26,10 32,4 38,9'
    : months <= 3
      ? '2,10 8,4 14,12 20,6 26,14 32,8 38,10'
      : '2,14 8,10 14,6 20,8 26,4 32,6 38,2';
  return (
    <svg width={40} height={16} viewBox="0 0 40 16" className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function sameLoc(a?: string, b?: string) {
  return (
    String(a || '')
      .trim()
      .toLowerCase() ===
    String(b || '')
      .trim()
      .toLowerCase()
  );
}

export default function MaintenancePage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => defaultMaintenanceTab(user?.role));
  const [dashboardYear, setDashboardYear] = useState(() => new Date().getFullYear());
  const [kpiOverlay, setKpiOverlay] = useState<PmKpiId | null>(null);
  const [contactFocus, setContactFocus] = useState<'hod' | 'fh' | 'ph' | null>(null);
  const [complaintFilter, setComplaintFilter] = useState<ComplaintDashboardFilter>('total');
  const [complaintSearch, setComplaintSearch] = useState('');
  const [machines, setMachines] = useState<MaintenanceMachine[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([...DEFAULT_MACHINE_TYPES]);
  const [complaints, setComplaints] = useState<MaintenanceComplaint[]>([]);
  const [meta, setMeta] = useState<MaintenanceMeta | null>(null);
  const [plants, setPlants] = useState<{ code: string; name: string; location: string }[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterWrapRef = React.useRef<HTMLDivElement | null>(null);
  const complaintListRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printMachines, setPrintMachines] = useState<MaintenanceMachine[] | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [markingDoneId, setMarkingDoneId] = useState<string | null>(null);
  const [doneMachine, setDoneMachine] = useState<MaintenanceMachine | null>(null);
  const [resolveComplaintTarget, setResolveComplaintTarget] = useState<MaintenanceComplaint | null>(null);
  const [resolvingComplaint, setResolvingComplaint] = useState(false);
  const [plantContactsDraft, setPlantContactsDraft] = useState<
    Record<string, { hodEmail?: string; fhEmail?: string; phEmail?: string }>
  >({});
  const [updatingTrendId, setUpdatingTrendId] = useState<string | null>(null);
  const [machineMenuId, setMachineMenuId] = useState<string | null>(null);
  const [updatingDateId, setUpdatingDateId] = useState<string | null>(null);
  const [deletingMachineId, setDeletingMachineId] = useState<string | null>(null);
  const [editMachine, setEditMachine] = useState<MaintenanceMachine | null>(null);
  const [detailMachine, setDetailMachine] = useState<MaintenanceMachine | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [detailComplaint, setDetailComplaint] = useState<MaintenanceComplaint | null>(null);
  const [complaintPhotoPreview, setComplaintPhotoPreview] = useState<{ url: string; name?: string } | null>(null);
  const seenComplaintIds = useRef<Set<string> | null>(null);

  const notifyNewComplaint = useCallback((c: MaintenanceComplaint) => {
    const title = `New complaint — ${c.assetCode}`;
    const downtime = formatDowntimeLabel(c.downtimeMinutes);
    const body = [
      c.machineType,
      c.machineNumber,
      c.location,
      plantShortName(c.plantCode, plants),
      downtime ? `Downtime ${downtime}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    toast.custom(
      (t) => (
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            setTab('complaints');
            setComplaintFilter('pending');
          }}
          className="max-w-sm w-[min(92vw,360px)] text-left bg-white border border-rose-200 shadow-xl rounded-2xl p-3 flex gap-3"
        >
          {c.photoUrl ? (
            <img
              src={c.photoUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-rose-600" size={22} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-600">New complaint</p>
            <p className="text-sm font-black text-slate-900 font-mono">{c.assetCode}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 truncate">{body}</p>
            <p className="text-[11px] text-slate-800 mt-1 line-clamp-2">{c.complaintText}</p>
          </div>
        </button>
      ),
      { duration: 12000, position: 'top-right' }
    );

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body: `${c.complaintText}${c.remark ? `\nRemark: ${c.remark}` : ''}`,
          icon: c.photoUrl || undefined,
          tag: c.id,
        });
        n.onclick = () => {
          window.focus();
          setTab('complaints');
          setComplaintFilter('pending');
          n.close();
        };
      } catch {
        /* ignore */
      }
    }
  }, [plants]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const role = user?.role;
      const wantComplaints = canViewMaintenanceComplaints(role);
      const [machRes, cmpRes, settingsRes] = await Promise.all([
        fetch(`${base}/api/maintenance/machines`, { credentials: 'include' }),
        wantComplaints
          ? fetch(`${base}/api/maintenance/complaints`, { credentials: 'include' })
          : Promise.resolve(null),
        fetch(`${base}/api/settings`, { credentials: 'include' }),
      ]);
      const machData = await parseJsonResponse<{
        machines?: MaintenanceMachine[];
        machineTypes?: string[];
        meta?: MaintenanceMeta;
        error?: string;
      }>(machRes);
      const cmpData = cmpRes
        ? await parseJsonResponse<{ complaints?: MaintenanceComplaint[]; error?: string }>(cmpRes)
        : { complaints: [] as MaintenanceComplaint[] };
      const settingsData = await parseJsonResponse<{
        plants?: { code: string; name: string; location: string }[];
        locations?: string[];
      }>(settingsRes);
      if (!machRes.ok) throw new Error(machData.error || 'Failed to load machines');
      if (cmpRes && !cmpRes.ok) throw new Error(cmpData.error || 'Failed to load complaints');
      setMachines(machData.machines || []);
      if (Array.isArray(machData.machineTypes) && machData.machineTypes.length) {
        setMachineTypes(machData.machineTypes);
      }
      const nextComplaints = cmpData.complaints || [];
      setComplaints(nextComplaints);
      seenComplaintIds.current = new Set(nextComplaints.map((c) => c.id));
      setMeta(machData.meta || null);
      setPlantContactsDraft(machData.meta?.plantContacts || {});
      setPlants(settingsData.plants || []);
      setLocations(settingsData.locations || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load maintenance');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!user || !canAccessMaintenance(user.role)) return;
    const next = defaultMaintenanceTab(user.role);
    setTab((prev) => (canAccessMaintenanceTab(user.role, prev) ? prev : next));
  }, [user?.role]);

  useEffect(() => {
    if (!machineMenuId) return;
    const close = () => setMachineMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [machineMenuId]);

  useEffect(() => {
    if (!user || !canAccessMaintenance(user.role)) return;
    void load();
  }, [load, user?.role]);

  useEffect(() => {
    if (!user || !canViewMaintenanceComplaints(user.role)) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [user?.role]);

  useEffect(() => {
    if (!user || !canViewMaintenanceComplaints(user.role)) return;
    const base = import.meta.env.VITE_API_BASE_URL || '';
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/maintenance/complaints`, { credentials: 'include' });
        const data = await parseJsonResponse<{ complaints?: MaintenanceComplaint[]; error?: string }>(res);
        if (cancelled || !res.ok) return;
        const next = data.complaints || [];
        setComplaints((prev) => {
          const seen = seenComplaintIds.current;
          if (seen) {
            for (const c of next) {
              if (!seen.has(c.id)) notifyNewComplaint(c);
            }
          }
          seenComplaintIds.current = new Set(next.map((c) => c.id));
          const same =
            prev.length === next.length && prev.every((row, i) => row.id === next[i]?.id && row.status === next[i]?.status);
          return same ? prev : next;
        });
      } catch {
        /* keep last list */
      }
    };

    const id = window.setInterval(() => void poll(), 8000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.role, notifyNewComplaint]);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = filterWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    const onScroll = () => setFilterOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [filterOpen]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const loc of locations) if (loc.trim()) set.add(loc.trim());
    for (const m of machines) if (m.location?.trim()) set.add(m.location.trim());
    for (const c of complaints) if (c.location?.trim()) set.add(c.location.trim());
    for (const p of plants) if (p.location?.trim()) set.add(p.location.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [locations, machines, complaints, plants]);

  const plantOptions = useMemo(() => {
    return plants
      .filter((p) => !filterLocation || sameLoc(p.location, filterLocation))
      .map((p) => p.code)
      .concat(
        machines
          .filter((m) => !filterLocation || sameLoc(m.location, filterLocation))
          .map((m) => m.plantCode)
      )
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b));
  }, [plants, machines, filterLocation]);

  const scopedMachines = useMemo(() => {
    return machines.filter((m) => {
      if (filterLocation && !sameLoc(m.location, filterLocation)) return false;
      if (filterPlant && String(m.plantCode || '').toLowerCase() !== filterPlant.toLowerCase()) return false;
      return true;
    });
  }, [machines, filterLocation, filterPlant]);

  const scopedComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (filterLocation && !sameLoc(c.location, filterLocation)) return false;
      if (filterPlant && String(c.plantCode || '').toLowerCase() !== filterPlant.toLowerCase()) return false;
      return true;
    });
  }, [complaints, filterLocation, filterPlant]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedMachines;
    return scopedMachines.filter((m) =>
      [
        m.assetCode,
        m.machineType,
        m.machineNumber,
        m.equipmentName,
        m.department,
        m.responsibility,
        m.location,
        m.plantCode,
        plantShortName(m.plantCode, plants),
        m.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [scopedMachines, search, plants]);

  const [machinePage, setMachinePage] = useState(1);
  const [machinePageSize, setMachinePageSize] = useState(10);
  const totalMachinePages = Math.max(1, Math.ceil(filtered.length / machinePageSize));
  const safeMachinePage = Math.min(machinePage, totalMachinePages);
  const paginatedMachines = useMemo(() => {
    const start = (safeMachinePage - 1) * machinePageSize;
    return filtered.slice(start, start + machinePageSize);
  }, [filtered, safeMachinePage, machinePageSize]);
  useEffect(() => { setMachinePage(1); }, [search, machinePageSize]);

  const openComplaints = useMemo(() => scopedComplaints.filter((c) => c.status === 'Open'), [scopedComplaints]);
  const resolvedComplaints = useMemo(
    () => scopedComplaints.filter((c) => c.status === 'Resolved'),
    [scopedComplaints]
  );

  const complaintStats = useMemo(() => computeComplaintStats(scopedComplaints), [scopedComplaints]);
  const dashboardKpis = useMemo(
    () => computePmPlanKpis(scopedMachines, dashboardYear),
    [scopedMachines, dashboardYear]
  );

  const complaintDashboardList = useMemo(
    () => filterComplaintsByDashboard(scopedComplaints, complaintFilter),
    [scopedComplaints, complaintFilter]
  );

  const pickComplaintFilter = useCallback((filter: ComplaintDashboardFilter) => {
    setComplaintFilter(filter);
    window.setTimeout(() => {
      complaintListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const searchedComplaints = useMemo(() => {
    const q = complaintSearch.trim().toLowerCase();
    if (!q) return scopedComplaints;
    return scopedComplaints.filter((c) =>
      [
        c.assetCode,
        c.machineType,
        c.machineNumber,
        c.location,
        c.plantCode,
        plantShortName(c.plantCode, plants),
        c.complaintText,
        c.remark,
        c.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [scopedComplaints, complaintSearch, plants]);

  const selectedMachines = useMemo(
    () => machines.filter((m) => selectedIds.has(m.id)),
    [machines, selectedIds]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const m of filtered) next.delete(m.id);
      } else {
        for (const m of filtered) next.add(m.id);
      }
      return next;
    });
  };

  const confirmMachineDone = async (nextMaintenanceDate: string) => {
    if (!doneMachine || markingDoneId) return;
    setMarkingDoneId(doneMachine.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines/${encodeURIComponent(doneMachine.id)}/done`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextMaintenanceDate }),
        }
      );
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to mark done');
      toast.success('Maintenance marked Done — button hidden until next due window');
      setDoneMachine(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setMarkingDoneId(null);
    }
  };

  const changeMachineTrend = async (machine: MaintenanceMachine, trendMonths: number) => {
    if (updatingTrendId || machineTrendMonths(machine) === trendMonths) return;
    setUpdatingTrendId(machine.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines/${encodeURIComponent(machine.id)}/trend`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trendMonths }),
        }
      );
      const data = await parseJsonResponse<{
        error?: string;
        machine?: MaintenanceMachine;
        mail?: { ok?: boolean; skipped?: boolean };
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update trend');
      if (data.machine) {
        setMachines((prev) => prev.map((m) => (m.id === data.machine!.id ? data.machine! : m)));
      } else {
        await load();
      }
      if (data.mail?.ok) {
        toast.success(`Trend updated · mail sent to HOD / FH / PH`);
      } else if (data.mail?.skipped) {
        toast.success('Trend updated · add HOD/FH/PH emails in settings for notifications');
      } else {
        toast.success('Trend updated');
      }
      if (isCustomTrend(trendMonths)) {
        toast('Custom trend: add extra PM dates from Edit. Dashboard will not auto-fill months.', { icon: '📅' });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update trend');
    } finally {
      setUpdatingTrendId(null);
    }
  };

  const changeMachineNextDate = async (machine: MaintenanceMachine, nextMaintenanceDate: string) => {
    const current = toDateInputValue(machine.nextMaintenanceDate);
    if (updatingDateId || !nextMaintenanceDate || nextMaintenanceDate === current) return;
    setUpdatingDateId(machine.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines/${encodeURIComponent(machine.id)}/next-date`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextMaintenanceDate }),
        }
      );
      const data = await parseJsonResponse<{ error?: string; machine?: MaintenanceMachine }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update date');
      if (data.machine) {
        setMachines((prev) => prev.map((m) => (m.id === data.machine!.id ? data.machine! : m)));
      } else {
        await load();
      }
      toast.success('Next maintenance date updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update date');
    } finally {
      setUpdatingDateId(null);
    }
  };

  const saveMachineEdit = async (payload: Partial<MaintenanceMachine>) => {
    if (!editMachine || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines/${encodeURIComponent(editMachine.id)}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await parseJsonResponse<{ error?: string; machine?: MaintenanceMachine }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update machine');
      if (data.machine) {
        setMachines((prev) => prev.map((m) => (m.id === data.machine!.id ? data.machine! : m)));
      } else {
        await load();
      }
      toast.success('Machine updated');
      setEditMachine(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmResolveComplaint = async (remarks: string) => {
    if (!resolveComplaintTarget || resolvingComplaint) return;
    setResolvingComplaint(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/complaints/${encodeURIComponent(resolveComplaintTarget.id)}/done`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remarks }),
        }
      );
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to resolve');
      toast.success('Complaint marked Done');
      setResolveComplaintTarget(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setResolvingComplaint(false);
    }
  };

  const savePlantContacts = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/meta`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineTypes: meta?.machineTypes,
          plantContacts: plantContactsDraft,
        }),
      });
      const data = await parseJsonResponse<{ meta?: MaintenanceMeta; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMeta(data.meta || null);
      toast.success('HOD / FH / PH emails saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const deleteMachine = async (machine: MaintenanceMachine) => {
    if (!isItAdminRole(user?.role) || deletingMachineId) return;
    const ok = window.confirm(`Delete ${machine.assetCode}? This cannot be undone.`);
    if (!ok) return;
    setDeletingMachineId(machine.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/maintenance/machines/${encodeURIComponent(machine.id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMachines((prev) => prev.filter((row) => row.id !== machine.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(machine.id);
        return next;
      });
      toast.success(`${machine.assetCode} deleted`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingMachineId(null);
    }
  };

  if (!user || !canAccessMaintenance(user.role)) {
    return <Navigate to={user?.role === 'HR' ? '/employees' : '/dashboard'} replace />;
  }

  const canDash = canViewMaintenanceDashboard(user.role);
  const canComplaints = canViewMaintenanceComplaints(user.role);
  const canFhPh = canManageMaintenanceFhPh(user.role);
  const canAddMachine = canAddMaintenanceMachine(user.role);
  const canDeleteMachine = isItAdminRole(user.role);

  const goTab = (id: Tab) => {
    setTab(id);
    setFilterOpen(false);
    setKpiOverlay(null);
    if (id !== 'settings') setContactFocus(null);
  };

  const navBtn = (active: boolean, extra = '') =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    } ${extra}`;

  const plantRows = useMemo(() => {
    const codes = new Set<string>();
    for (const p of plants) if (p.code) codes.add(p.code);
    for (const m of machines) if (m.plantCode) codes.add(m.plantCode);
    for (const code of Object.keys(plantContactsDraft || {})) codes.add(code);
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [plants, machines, plantContactsDraft]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 px-6 lg:px-8 pt-3 lg:pt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {canDash && (
                <button
                  type="button"
                  onClick={() => goTab('dashboard')}
                  className={navBtn(tab === 'dashboard')}
                >
                  <LayoutDashboard size={14} />
                  Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={() => goTab('machines')}
                className={navBtn(tab === 'machines')}
              >
                <Factory size={14} />
                Machines
              </button>
              {canComplaints && (
                <>
                  <button
                    type="button"
                    onClick={() => goTab('complaint-dashboard')}
                    className={navBtn(tab === 'complaint-dashboard')}
                  >
                    <BarChart3 size={14} />
                    Complaint Dashboard
                  </button>
                  {(tab === 'complaint-dashboard' || tab === 'complaints') && (
                    <button
                      type="button"
                      onClick={() => goTab('complaints')}
                      className={navBtn(tab === 'complaints')}
                    >
                      <AlertTriangle size={14} />
                      Complaints
                    </button>
                  )}
                </>
              )}

              {(tab === 'dashboard' || tab === 'machines' || tab === 'complaint-dashboard' || tab === 'complaints') && (
                <div className="relative" ref={filterWrapRef}>
                  <button
                    type="button"
                    onClick={() => setFilterOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      filterOpen || filterLocation || filterPlant
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Location / Plant filter"
                  >
                    <Filter size={13} />
                    Filter
                    {(filterLocation || filterPlant) && (
                      <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-300" />
                    )}
                  </button>

                  {filterOpen && (
                    <div
                      className="absolute left-0 top-full mt-2 z-30 w-[min(92vw,280px)] rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2"
                      onMouseLeave={() => setFilterOpen(false)}
                    >
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Location</label>
                        <select
                          value={filterLocation}
                          onChange={(e) => {
                            setFilterLocation(e.target.value);
                            setFilterPlant('');
                          }}
                          className="mt-1 w-full input-geometric text-xs font-semibold py-1.5"
                        >
                          <option value="">All locations</option>
                          {locationOptions.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Plant</label>
                        <select
                          value={filterPlant}
                          onChange={(e) => setFilterPlant(e.target.value)}
                          className="mt-1 w-full input-geometric text-xs font-semibold py-1.5"
                        >
                          <option value="">All plants</option>
                          {plantOptions.map((code) => (
                            <option key={code} value={code}>
                              {plantShortName(code, plants)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(filterLocation || filterPlant) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterLocation('');
                            setFilterPlant('');
                          }}
                          className="w-full px-2 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {canFhPh && (
                <button
                  type="button"
                  onClick={() => goTab('settings')}
                  className={navBtn(tab === 'settings', 'w-9 h-9 justify-center px-0')}
                  title="HOD / FH / PH settings"
                  aria-label="Settings"
                >
                  <Settings size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {tab === 'dashboard' && canDash && (
              <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDashboardYear((y) => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700"
                  aria-label="Previous year"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="inline-flex items-center gap-1.5 px-2 text-sm font-black text-slate-900">
                  <CalendarRange size={14} className="text-blue-600" />
                  {dashboardYear}
                </span>
                <button
                  type="button"
                  onClick={() => setDashboardYear((y) => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700"
                  aria-label="Next year"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {tab === 'dashboard' && canDash && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-1 overflow-visible">
            <DashboardKpi
              label="Machines"
              value={dashboardKpis.total}
              className="border-slate-300 bg-slate-50"
              tone="slate"
              active={kpiOverlay === 'total'}
              onClick={() => setKpiOverlay('total')}
            />
            <DashboardKpi
              label="Planned this month"
              value={dashboardKpis.plannedThisMonth}
              className="border-amber-300 bg-amber-100"
              tone="amber"
              active={kpiOverlay === 'plannedThisMonth'}
              onClick={() => setKpiOverlay('plannedThisMonth')}
            />
            <DashboardKpi
              label="Done this month"
              value={dashboardKpis.doneThisMonth}
              className="border-violet-400 bg-violet-200"
              tone="violet"
              active={kpiOverlay === 'doneThisMonth'}
              onClick={() => setKpiOverlay('doneThisMonth')}
            />
            <DashboardKpi
              label="On time"
              value={dashboardKpis.onTime}
              className="border-emerald-400 bg-emerald-100"
              tone="emerald"
              active={kpiOverlay === 'onTime'}
              onClick={() => setKpiOverlay('onTime')}
            />
            <DashboardKpi
              label="Delayed"
              value={dashboardKpis.delayed}
              className="border-orange-300 bg-orange-100"
              tone="orange"
              alert="delayed"
              active={kpiOverlay === 'delayed'}
              onClick={() => setKpiOverlay('delayed')}
            />
            <DashboardKpi
              label="Overdue"
              value={dashboardKpis.overdue}
              className="border-red-700 bg-red-600"
              tone="overdue"
              alert="overdue"
              active={kpiOverlay === 'overdue'}
              onClick={() => setKpiOverlay('overdue')}
            />
          </div>
        )}

        {tab === 'complaint-dashboard' && canComplaints && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-1 overflow-visible">
            <ComplaintKpi
              label="Total complaints"
              value={complaintStats.total}
              className="border-slate-300 bg-slate-50"
              tone="slate"
              active={complaintFilter === 'total'}
              onClick={() => pickComplaintFilter('total')}
            />
            <ComplaintKpi
              label="Pending"
              value={complaintStats.pending}
              className="border-amber-300 bg-amber-100"
              tone="amber"
              active={complaintFilter === 'pending'}
              onClick={() => pickComplaintFilter('pending')}
            />
            <ComplaintKpi
              label="Resolved"
              value={complaintStats.resolved}
              className="border-emerald-400 bg-emerald-100"
              tone="emerald"
              active={complaintFilter === 'resolved'}
              onClick={() => pickComplaintFilter('resolved')}
            />
            <ComplaintKpi
              label="Resolved %"
              value={`${complaintStats.resolvedPct}%`}
              className="border-blue-300 bg-blue-100"
              tone="blue"
              active={complaintFilter === 'resolved'}
              onClick={() => pickComplaintFilter('resolved')}
            />
            <ComplaintKpi
              label="Within 1 week"
              value={complaintStats.resolvedWithinWeek}
              className="border-violet-400 bg-violet-200"
              tone="violet"
              active={complaintFilter === 'within_week'}
              onClick={() => pickComplaintFilter('within_week')}
            />
            <ComplaintKpi
              label="Over 1 week"
              value={complaintStats.overOneWeek}
              className="border-red-700 bg-red-600"
              tone="overdue"
              alert="overdue"
              active={complaintFilter === 'over_week'}
              onClick={() => pickComplaintFilter('over_week')}
            />
          </div>
        )}
      </div>

      <div
        className={`flex-1 px-6 lg:px-8 pb-4 lg:pb-6 min-h-0 ${
          tab === 'dashboard' ? 'overflow-hidden flex flex-col' : 'overflow-auto'
        }`}
      >
        {tab === 'dashboard' && canDash && (
          <div className="relative flex-1 min-h-0 flex flex-col">
            {kpiOverlay ? (
              <DashboardKpiOverlay
                title={PM_KPI_TITLES[kpiOverlay]}
                machines={listMachinesForPmKpi(scopedMachines, dashboardYear, kpiOverlay)}
                complaints={scopedComplaints}
                plants={plants}
                onBack={() => setKpiOverlay(null)}
              />
            ) : (
              <MaintenancePmPlanBoard machines={scopedMachines} loading={loading} year={dashboardYear} />
            )}
          </div>
        )}

        {tab === 'complaint-dashboard' && canComplaints && (
          <div className="space-y-3">
            <MaintenanceComplaintCharts complaints={scopedComplaints} plants={plants} />
            <div ref={complaintListRef} className="bg-white rounded-2xl border border-slate-200 overflow-hidden scroll-mt-4">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {complaintFilter === 'total'
                    ? 'All complaints'
                    : complaintFilter === 'pending'
                      ? 'Pending complaints'
                      : complaintFilter === 'resolved'
                        ? 'Resolved complaints'
                        : complaintFilter === 'within_week'
                          ? 'Resolved within 1 week'
                          : 'Over 1 week'}
                </h2>
                <span className="text-[10px] font-bold text-slate-500">{complaintDashboardList.length} shown</span>
              </div>
              {loading ? (
                <p className="p-6 text-sm text-slate-500">Loading complaints…</p>
              ) : complaintDashboardList.length === 0 ? (
                <div className="p-8 text-center">
                  <BarChart3 className="mx-auto text-slate-300 mb-2" size={28} />
                  <p className="text-sm text-slate-500">No complaints in this category.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {complaintDashboardList.map((c) => (
                    <ComplaintListItem
                      key={c.id}
                      complaint={c}
                      plants={plants}
                      onOpen={() => setDetailComplaint(c)}
                      onPreviewPhoto={
                        c.photoUrl
                          ? () => setComplaintPhotoPreview({ url: c.photoUrl!, name: c.photoName })
                          : undefined
                      }
                      onResolve={() => setResolveComplaintTarget(c)}
                      expanded
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'machines' && (
          <div className="flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap items-center gap-2 shrink-0 bg-white">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                <Factory size={14} className="text-blue-600" /> Machines
                <span className="text-slate-400 font-normal">({filtered.length})</span>
              </h2>
              {selectedMachines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPrintMachines(selectedMachines)}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                >
                  <QrCode size={11} /> QR ({selectedMachines.length})
                </button>
              ) : scopedMachines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPrintMachines(scopedMachines)}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                >
                  <QrCode size={11} /> Print All QR
                </button>
              ) : null}
              <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full border border-slate-200 rounded text-[11px] py-1 pl-7 pr-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              {canAddMachine && (
                <Link
                  to="/maintenance/machines/new"
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold shrink-0"
                >
                  + Add
                </Link>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading machines…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">No machines for this filter.</p>
                {canAddMachine && (
                  <button
                    type="button"
                    onClick={() => navigate('/maintenance/machines/new')}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-[10px] font-semibold"
                  >
                    Add Machine
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0 max-h-[calc(100dvh-11rem)]">
                <table className="w-full min-w-[1060px] border-collapse text-[13px] leading-normal">
                  <thead className="sticky top-0 z-30 bg-white text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAllFiltered}
                          className="rounded border-slate-300"
                          title="Select all"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Machine ID</th>
                      <th className="px-4 py-3 text-left font-semibold">Machine Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-left font-semibold w-16">No.</th>
                      <th className="px-4 py-3 text-left font-semibold">Department</th>
                      <th className="px-4 py-3 text-left font-semibold">Plant</th>
                      <th className="px-4 py-3 text-left font-semibold">Trend</th>
                      <th className="px-4 py-3 text-left font-semibold">Next PM</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedMachines.map((m, rowIdx) => {
                      const badge = statusBadge(m);
                      const pendingDays = maintenancePendingDays(m);
                      const plant = plantTableLabel(m.plantCode, plants);
                      const trendM = machineTrendMonths(m);
                      const menuDropUp = rowIdx >= paginatedMachines.length - 2;
                      return (
                        <tr
                          key={m.id}
                          className="group border-b border-slate-200 hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => setDetailMachine(m)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetailMachine(m);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td
                            className="px-4 py-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(m.id)}
                              onChange={() => toggleOne(m.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-4 font-semibold text-blue-600 whitespace-nowrap">
                            {m.assetCode}
                          </td>
                          <td className="px-4 py-4 font-medium text-slate-800" title={m.equipmentName || m.machineType}>
                            {m.equipmentName || m.machineType}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {m.machineType}
                          </td>
                          <td className="px-4 py-4 text-slate-600 font-mono">
                            {m.machineNumber}
                          </td>
                          <td className="px-4 py-4 text-slate-600 uppercase text-[12px]">
                            {m.department || '—'}
                          </td>
                          <td className="px-4 py-4 text-slate-600 uppercase text-[12px] font-medium" title={plant.full}>
                            {plant.short}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <MiniTrendSvg months={trendM} />
                              <select
                                value={trendM}
                                disabled={updatingTrendId === m.id}
                                onChange={(e) => void changeMachineTrend(m, Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                className="border border-slate-200 rounded text-[12px] font-medium py-0.5 px-1.5 bg-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-5 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%3E%3Cpath%20d%3D%22M0%200l5%206%205-6H0z%22%20fill%3D%22%2394a3b8%22/%3E%3C/svg%3E')] bg-[length:10px_6px] bg-[right_6px_center] bg-no-repeat"
                                title={trendMonthsLabel(trendM)}
                              >
                                {TREND_SELECT_OPTIONS.map((n) => (
                                  <option key={n} value={n}>
                                    {trendCompactLabel(n)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <CalendarRange size={14} className="text-slate-400 shrink-0" />
                              <input
                                type="date"
                                value={toDateInputValue(m.nextMaintenanceDate)}
                                disabled={updatingDateId === m.id}
                                onChange={(e) => void changeMachineNextDate(m, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="border border-slate-200 rounded text-[12px] font-medium py-0.5 px-1.5 bg-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                title="Next maintenance date"
                              />
                            </div>
                            {(pendingDays > 0 || (isCustomTrend(trendM) && (m.customPlanDates?.length || 0) > 0)) && (
                              <div className="flex items-center gap-1 mt-1 pl-5">
                                {pendingDays > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-[9px] font-bold text-red-600">
                                    {pendingDays}d overdue
                                  </span>
                                )}
                                {isCustomTrend(trendM) && (m.customPlanDates?.length || 0) > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700">
                                    {m.customPlanDates!.length} extra
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td
                            className="px-4 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailMachine(m)}
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                                title="View details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditMachine(m)}
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil size={16} />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMachineMenuId(machineMenuId === m.id ? null : m.id);
                                  }}
                                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                  title="More actions"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {machineMenuId === m.id && (
                                  <div className={`absolute right-0 min-w-[160px] bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 whitespace-nowrap ${menuDropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                    <button
                                      type="button"
                                      onClick={() => { setPrintMachines([m]); setMachineMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                                    >
                                      <QrCode size={15} className="shrink-0" /> Print QR
                                    </button>
                                    {canMarkMaintenanceDone(m) && (
                                      <button
                                        type="button"
                                        disabled={markingDoneId === m.id}
                                        onClick={() => { setDoneMachine(m); setMachineMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 flex items-center gap-3 text-emerald-700 disabled:opacity-40"
                                      >
                                        <CheckCircle2 size={15} className="shrink-0" /> Mark Done
                                      </button>
                                    )}
                                    {canDeleteMachine && (
                                      <button
                                        type="button"
                                        disabled={deletingMachineId === m.id}
                                        onClick={() => { void deleteMachine(m); setMachineMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 flex items-center gap-3 text-rose-600 disabled:opacity-40"
                                      >
                                        <Trash2 size={15} className="shrink-0" /> Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-[12px] text-slate-500">
                  <span>
                    Showing {Math.min((safeMachinePage - 1) * machinePageSize + 1, filtered.length)} to{' '}
                    {Math.min(safeMachinePage * machinePageSize, filtered.length)} of {filtered.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safeMachinePage <= 1}
                      onClick={() => setMachinePage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(totalMachinePages, 5) }, (_, i) => {
                      let page: number;
                      if (totalMachinePages <= 5) {
                        page = i + 1;
                      } else if (safeMachinePage <= 3) {
                        page = i + 1;
                      } else if (safeMachinePage >= totalMachinePages - 2) {
                        page = totalMachinePages - 4 + i;
                      } else {
                        page = safeMachinePage - 2 + i;
                      }
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setMachinePage(page)}
                          className={`w-8 h-8 rounded text-[12px] font-semibold ${
                            page === safeMachinePage
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    {totalMachinePages > 5 && safeMachinePage < totalMachinePages - 2 && (
                      <>
                        <span className="px-1 text-slate-400">…</span>
                        <button
                          type="button"
                          onClick={() => setMachinePage(totalMachinePages)}
                          className="w-8 h-8 rounded border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {totalMachinePages}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={safeMachinePage >= totalMachinePages}
                      onClick={() => setMachinePage((p) => Math.min(totalMachinePages, p + 1))}
                      className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <select
                      value={machinePageSize}
                      onChange={(e) => setMachinePageSize(Number(e.target.value))}
                      className="ml-2 border border-slate-200 rounded text-[12px] py-1 px-2 bg-white text-slate-600"
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>{n} / page</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'complaints' && canComplaints && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={complaintSearch}
                onChange={(e) => setComplaintSearch(e.target.value)}
                placeholder="Search asset, machine, plant, complaint…"
                className="w-full input-geometric pl-10"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <MessageSquareWarning className="text-rose-600" size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900">QR Scan Complaints</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Submitted from machine QR · resolve with Done when fixed
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                      Total {scopedComplaints.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                      Pending {openComplaints.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">
                      Done {resolvedComplaints.length}
                    </span>
                  </div>
                </div>
              </div>

              {loading ? (
                <p className="p-8 text-sm text-slate-500 text-center">Loading…</p>
              ) : searchedComplaints.length === 0 ? (
                <p className="p-10 text-sm text-slate-500 text-center">No complaints match this filter.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {searchedComplaints.map((c) => (
                    <ComplaintListItem
                      key={c.id}
                      complaint={c}
                      plants={plants}
                      onOpen={() => setDetailComplaint(c)}
                      onPreviewPhoto={
                        c.photoUrl
                          ? () => setComplaintPhotoPreview({ url: c.photoUrl!, name: c.photoName })
                          : undefined
                      }
                      onResolve={() => setResolveComplaintTarget(c)}
                      expanded
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && canFhPh && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">Settings — HOD / FH / PH emails</h2>
                <p className="text-xs text-slate-500">
                  Used for trend-change alerts, 1-week reminders, overdue escalation, and complaint notifications.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void savePlantContacts()}
                disabled={savingSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase disabled:opacity-60"
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </button>
            </div>
            {plantRows.length === 0 ? (
              <p className="p-8 text-sm text-slate-500 text-center">
                No plants found. Add plants in Settings, or register a machine first.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Plant</th>
                      <th className={`px-4 py-3 ${contactFocus === 'hod' ? 'bg-blue-100 text-blue-800' : ''}`}>
                        Head of Department (HOD) email
                      </th>
                      <th className={`px-4 py-3 ${contactFocus === 'fh' ? 'bg-blue-100 text-blue-800' : ''}`}>
                        Factory Head (FH) email
                      </th>
                      <th className={`px-4 py-3 ${contactFocus === 'ph' ? 'bg-blue-100 text-blue-800' : ''}`}>
                        Plant Head (PH) email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plantRows.map((code) => {
                      const plant = plants.find((p) => p.code === code);
                      const contact = plantContactsDraft[code] || {};
                      return (
                        <tr key={code}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{plantShortName(code, plants)}</p>
                            {plant?.location ? (
                              <p className="text-xs text-slate-500">{plant.location}</p>
                            ) : null}
                          </td>
                          <td className={`px-4 py-3 ${contactFocus === 'hod' ? 'bg-blue-50' : ''}`}>
                            <input
                              type="email"
                              value={contact.hodEmail || ''}
                              onChange={(e) =>
                                setPlantContactsDraft((prev) => ({
                                  ...prev,
                                  [code]: { ...prev[code], hodEmail: e.target.value },
                                }))
                              }
                              placeholder="hod@company.com"
                              className="w-full input-geometric text-sm"
                            />
                          </td>
                          <td className={`px-4 py-3 ${contactFocus === 'fh' ? 'bg-blue-50' : ''}`}>
                            <input
                              type="email"
                              value={contact.fhEmail || ''}
                              onChange={(e) =>
                                setPlantContactsDraft((prev) => ({
                                  ...prev,
                                  [code]: { ...prev[code], fhEmail: e.target.value },
                                }))
                              }
                              placeholder="fh@company.com"
                              className="w-full input-geometric text-sm"
                            />
                          </td>
                          <td className={`px-4 py-3 ${contactFocus === 'ph' ? 'bg-blue-50' : ''}`}>
                            <input
                              type="email"
                              value={contact.phEmail || ''}
                              onChange={(e) =>
                                setPlantContactsDraft((prev) => ({
                                  ...prev,
                                  [code]: { ...prev[code], phEmail: e.target.value },
                                }))
                              }
                              placeholder="ph@company.com"
                              className="w-full input-geometric text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {printMachines && printMachines.length > 0 && (
        <MaintenanceQRPrintModal machines={printMachines} onClose={() => setPrintMachines(null)} />
      )}
      <MaintenanceDoneModal
        machine={doneMachine}
        plants={plants}
        saving={Boolean(markingDoneId)}
        onClose={() => !markingDoneId && setDoneMachine(null)}
        onConfirm={confirmMachineDone}
      />
      <MaintenanceMachineEditModal
        machine={editMachine}
        saving={savingEdit}
        machineTypes={machineTypes}
        locations={locations}
        plants={plants}
        onClose={() => !savingEdit && setEditMachine(null)}
        onSave={saveMachineEdit}
      />
      {detailMachine ? (
        <MachineDetailPopup
          machine={detailMachine}
          complaints={complaints.filter((c) => c.machineId === detailMachine.id || c.assetCode === detailMachine.assetCode)}
          plants={plants}
          onClose={() => setDetailMachine(null)}
        />
      ) : null}
      {detailComplaint ? (
        <ComplaintDetailPopup
          complaint={detailComplaint}
          plants={plants}
          onClose={() => setDetailComplaint(null)}
          onPreviewPhoto={(url, name) => setComplaintPhotoPreview({ url, name })}
          onResolve={() => {
            setResolveComplaintTarget(detailComplaint);
            setDetailComplaint(null);
          }}
        />
      ) : null}
      {complaintPhotoPreview ? (
        <ComplaintPhotoPreviewModal
          url={complaintPhotoPreview.url}
          name={complaintPhotoPreview.name}
          onClose={() => setComplaintPhotoPreview(null)}
        />
      ) : null}
      <MaintenanceResolveModal
        complaint={resolveComplaintTarget}
        saving={resolvingComplaint}
        onClose={() => !resolvingComplaint && setResolveComplaintTarget(null)}
        onConfirm={confirmResolveComplaint}
      />
    </div>
  );
}

function ComplaintKpi({
  label,
  value,
  className,
  tone,
  alert,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  className: string;
  tone: 'slate' | 'amber' | 'emerald' | 'blue' | 'violet' | 'overdue';
  alert?: 'overdue';
  active?: boolean;
  onClick: () => void;
}) {
  const labelTone =
    tone === 'overdue'
      ? 'text-red-50'
      : tone === 'slate'
        ? 'text-slate-700'
        : tone === 'amber'
          ? 'text-amber-900'
          : tone === 'emerald'
            ? 'text-emerald-900'
            : tone === 'blue'
              ? 'text-blue-900'
              : tone === 'violet'
                ? 'text-violet-900'
                : 'text-orange-900';
  const valueTone = tone === 'overdue' ? 'text-white' : 'text-slate-900';
  const numeric = typeof value === 'number' ? value : parseInt(String(value), 10);
  const alertClass = alert === 'overdue' && Number.isFinite(numeric) && numeric > 0 ? 'kpi-alert-overdue' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left w-full cursor-pointer ${className} ${alertClass} ${
        active ? 'ring-2 ring-blue-600 ring-offset-1 shadow-sm' : ''
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-wider ${labelTone}`}>{label}</p>
      <p className={`text-xl font-black tabular-nums mt-0.5 ${valueTone}`}>{value}</p>
    </button>
  );
}

function DashboardKpi({
  label,
  value,
  className,
  tone,
  alert,
  active,
  onClick,
}: {
  label: string;
  value: number;
  className: string;
  tone: 'slate' | 'amber' | 'violet' | 'emerald' | 'orange' | 'overdue';
  alert?: 'delayed' | 'overdue';
  active?: boolean;
  onClick: () => void;
}) {
  const labelTone =
    tone === 'overdue'
      ? 'text-red-50'
      : tone === 'slate'
        ? 'text-slate-700'
        : tone === 'amber'
          ? 'text-amber-900'
          : tone === 'violet'
            ? 'text-violet-900'
            : tone === 'emerald'
              ? 'text-emerald-900'
              : 'text-orange-900';
  const valueTone = tone === 'overdue' ? 'text-white' : 'text-slate-900';
  const alertClass =
    value > 0 && alert === 'overdue'
      ? 'kpi-alert-overdue'
      : value > 0 && alert === 'delayed'
        ? 'kpi-alert-delayed'
        : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left w-full cursor-pointer ${className} ${alertClass} ${
        active ? 'ring-2 ring-blue-600 ring-offset-1 shadow-sm' : ''
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-wider ${labelTone}`}>{label}</p>
      <p className={`text-xl font-black tabular-nums mt-0.5 ${valueTone}`}>{value}</p>
    </button>
  );
}

function DashboardKpiOverlay({
  title,
  machines,
  complaints,
  plants,
  onBack,
}: {
  title: string;
  machines: MaintenanceMachine[];
  complaints: MaintenanceComplaint[];
  plants: { code: string; name: string; location: string }[];
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<MaintenanceMachine | null>(null);

  return (
    <div className="absolute inset-0 z-20 bg-white rounded-2xl border-2 border-slate-300 shadow-sm flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-700"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <p className="text-[11px] font-semibold text-slate-500">{machines.length} machine{machines.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {machines.length === 0 ? (
          <p className="p-10 text-sm text-slate-500 text-center">No machines in this category.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Machine Name</th>
                <th className="px-4 py-3">Asset Code</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Responsibility</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machines.map((m) => {
                const name = m.equipmentName?.trim() || `${m.machineType} ${m.machineNumber}`.trim();
                const freq = machineTrendMonths(m);
                const badge = statusBadge(m);
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-blue-50 cursor-pointer"
                    onClick={() => setDetail(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetail(m);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-[11px] text-slate-500">{m.machineType}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-700">{m.assetCode}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      {isCustomTrend(freq) ? 'Custom' : freq === 1 ? '1 month' : `${freq} months`}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{m.department || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{m.responsibility || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{formatDate(effectiveNextMaintenanceDate(m))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {detail && (
        <MachineDetailPopup
          machine={detail}
          complaints={complaints.filter((c) => c.machineId === detail.id || c.assetCode === detail.assetCode)}
          plants={plants}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 min-w-0 overflow-visible">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 whitespace-normal break-words leading-snug">
        {value || '—'}
      </p>
    </div>
  );
}

function MachinePlanCard({ machine }: { machine: MaintenanceMachine }) {
  const freq = machineTrendMonths(machine);
  const custom = isCustomTrend(freq);
  const upcoming = upcomingPlanDates(machine);
  const next = upcoming[0];
  const after = upcoming.slice(1);
  const span = custom ? customPlanSpan(machine) : null;
  const pending = pendingPlanDates(machine);

  return (
    <div
      className={`rounded-xl px-3 py-2.5 sm:col-span-2 xl:col-span-4 min-w-0 border ${
        custom ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-wider ${custom ? 'text-amber-800' : 'text-blue-800'}`}>
        {custom ? 'Manual plan (no trend)' : 'Trend plan'}
      </p>
      {custom ? (
        <div className="mt-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            This machine does not follow a month interval. Dates are set manually.
          </p>
          {span ? (
            <p className="text-xs font-semibold text-slate-700">
              {span.count} date{span.count === 1 ? '' : 's'} set
              {span.months > 0
                ? ` · covers ${span.months} month${span.months === 1 ? '' : 's'} (${formatDate(span.from)} → ${formatDate(span.to)})`
                : ` · ${formatDate(span.from)}`}
            </p>
          ) : (
            <p className="text-xs text-slate-600">No extra dates yet — only the next PM date is stored.</p>
          )}
          <p className="text-xs font-semibold text-slate-800">
            Next due: {next ? formatDate(formatDateIso(next)) : '—'}
          </p>
          {pending.length > 1 ? (
            <p className="text-xs text-slate-700">
              Remaining planned: {pending.map((d) => formatDate(formatDateIso(d))).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{trendMonthsLabel(freq)}</p>
          <p className="text-xs font-semibold text-slate-800">
            Next due: {next ? formatDate(formatDateIso(next)) : formatDate(machine.nextMaintenanceDate)}
          </p>
          {after.length > 0 ? (
            <p className="text-xs text-slate-700">
              After that: {after.map((d) => formatDate(formatDateIso(d))).join(' · ')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatDateIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function MachineDetailPopup({
  machine,
  complaints,
  plants,
  onClose,
}: {
  machine: MaintenanceMachine;
  complaints: MaintenanceComplaint[];
  plants: { code: string; name: string; location: string }[];
  onClose: () => void;
}) {
  const name = machine.equipmentName?.trim() || `${machine.machineType} ${machine.machineNumber}`.trim();
  const badge = statusBadge(machine);
  const openCount = complaints.filter((c) => c.status === 'Open').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;
  const logs = [...(machine.pmLogs || [])].slice().reverse();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 p-3 sm:p-5 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div className="min-h-full flex items-center justify-center">
        <div
          className="w-full max-w-[1120px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="machine-detail-title"
        >
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Machine detail</p>
                <h3 id="machine-detail-title" className="text-base sm:text-lg font-black text-slate-900 break-words">
                  {name}
                </h3>
              </div>
              <p className="font-mono text-sm font-bold text-blue-700">{machine.assetCode}</p>
              <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_260px]">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 content-start overflow-y-auto min-h-0">
              <DetailField label="Machine Name" value={name} />
              <DetailField label="Machine Type" value={machine.machineType} />
              <DetailField label="Machine Number" value={machine.machineNumber} />
              <DetailField label="Asset Code" value={machine.assetCode} />
              <DetailField label="Department" value={machine.department} />
              <DetailField label="Responsibility" value={machine.responsibility} />
              <DetailField label="Location" value={machine.location} />
              <DetailField label="Plant" value={plantShortName(machine.plantCode, plants)} />
              <MachinePlanCard machine={machine} />
              <DetailField label="Status" value={machine.status} />
              <DetailField label="Next Maintenance Date" value={formatDate(effectiveNextMaintenanceDate(machine))} />
              <DetailField label="Last Maintenance Date" value={formatDate(machine.lastMaintenanceDate)} />
              <DetailField label="Complaints" value={`${openCount} open · ${resolvedCount} resolved`} />
              {machine.remarks ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2 xl:col-span-4 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Remarks</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 whitespace-pre-wrap break-words">{machine.remarks}</p>
                </div>
              ) : null}
            </div>

            <div className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/80 p-4 overflow-y-auto min-h-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">PM history</p>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500">No completed cycles recorded yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Planned</th>
                      <th className="py-1">Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.map((log, i) => (
                      <tr key={`${log.doneOn}-${i}`}>
                        <td className="py-1.5 pr-2 font-semibold text-slate-800">{formatDate(log.plannedDate)}</td>
                        <td className="py-1.5 font-semibold text-slate-800">{formatDate(log.doneOn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplaintListItem({
  complaint: c,
  plants,
  onOpen,
  onPreviewPhoto,
  onResolve,
  expanded = false,
}: {
  complaint: MaintenanceComplaint;
  plants: { code: string; name: string; location: string }[];
  onOpen: () => void;
  onPreviewPhoto?: () => void;
  onResolve: () => void;
  expanded?: boolean;
}) {
  const pending = complaintPendingDays(c.reportedAt);
  const overWeek = isComplaintOverOneWeek(c);
  const withinWeek = isComplaintResolvedWithinWeek(c);
  const resolvedDays =
    c.status === 'Resolved' && c.resolvedAt
      ? complaintResolutionDays(c.reportedAt, c.resolvedAt)
      : null;

  return (
    <li
      className={`px-3 py-2.5 hover:bg-slate-50/80 cursor-pointer ${overWeek && c.status === 'Open' ? 'bg-rose-50/30' : ''}`}
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
      <div className="flex items-start gap-3">
        {c.photoUrl ? (
          <div className="shrink-0 flex flex-col items-center gap-1">
            <img
              src={c.photoUrl}
              alt={c.photoName || 'Complaint photo'}
              className="h-14 w-20 object-cover rounded-lg border border-slate-200"
            />
            {onPreviewPhoto ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewPhoto();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase"
              >
                <Eye size={10} /> Preview
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-sm font-black text-blue-700">{c.assetCode}</p>
            <span
              className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                c.status === 'Open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {c.status === 'Open' ? 'Pending' : 'Resolved'}
            </span>
            {c.status === 'Open' && overWeek && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-700">
                Over 1 week
              </span>
            )}
            {withinWeek && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-violet-100 text-violet-700">
                Within 1 week
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5 truncate">
            {c.machineType} · <span className="font-mono">{c.machineNumber}</span>
            {c.equipmentName ? ` · ${c.equipmentName}` : ''}
            {c.department ? ` · ${c.department}` : ''}
            {c.responsibility ? ` · ${c.responsibility}` : ''}
            {' · '}
            {c.location} · {plantShortName(c.plantCode, plants)}
            {' · '}
            {formatDate(c.reportedAt)}
            {c.resolvedAt ? ` · Resolved ${formatDate(c.resolvedAt)}` : ''}
          </p>
          <p className={`text-xs text-slate-800 mt-1 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {c.complaintText}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {[
              formatDowntimeLabel(c.downtimeMinutes) ? `Downtime ${formatDowntimeLabel(c.downtimeMinutes)}` : '',
              c.remark ? `Remark: ${c.remark}` : '',
              c.remarks ? `Resolution: ${c.remarks}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-[10px] font-bold text-blue-600 mt-1">Tap for full detail</p>
        </div>

        <div className="shrink-0 ml-auto flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
          {c.status === 'Open' ? (
            <div className="flex items-center gap-1 text-red-600">
              <Clock size={13} />
              <span className="text-xs font-black tabular-nums">{pending}d</span>
            </div>
          ) : resolvedDays != null ? (
            <div className="flex items-center gap-1 text-slate-600">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span className="text-xs font-black tabular-nums">{resolvedDays}d</span>
            </div>
          ) : null}
          {c.status === 'Open' ? (
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase whitespace-nowrap"
            >
              <CheckCircle2 size={12} /> Mark Done
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ComplaintDetailPopup({
  complaint: c,
  plants,
  onClose,
  onPreviewPhoto,
  onResolve,
}: {
  complaint: MaintenanceComplaint;
  plants: { code: string; name: string; location: string }[];
  onClose: () => void;
  onPreviewPhoto: (url: string, name?: string) => void;
  onResolve: () => void;
}) {
  const pending = complaintPendingDays(c.reportedAt);
  const overWeek = isComplaintOverOneWeek(c);
  const withinWeek = isComplaintResolvedWithinWeek(c);
  const resolvedDays =
    c.status === 'Resolved' && c.resolvedAt
      ? complaintResolutionDays(c.reportedAt, c.resolvedAt)
      : null;
  const machineLabel =
    c.equipmentName?.trim() || `${c.machineType} ${c.machineNumber}`.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 p-3 sm:p-5 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div className="min-h-full flex items-center justify-center">
        <div
          className="w-full max-w-[920px] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Complaint detail</p>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-mono">{c.assetCode}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-700"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <DetailField label="Machine" value={machineLabel} />
              <DetailField label="Machine Type" value={c.machineType} />
              <DetailField label="Machine Number" value={c.machineNumber} />
              <DetailField label="Asset Code" value={c.assetCode} />
              <DetailField label="Department" value={c.department} />
              <DetailField label="Responsibility" value={c.responsibility} />
              <DetailField label="Location" value={c.location} />
              <DetailField label="Plant" value={plantShortName(c.plantCode, plants)} />
              <DetailField label="Status" value={c.status === 'Open' ? 'Pending' : 'Resolved'} />
              <DetailField label="Reported On" value={formatDate(c.reportedAt)} />
              <DetailField label="Resolved On" value={c.resolvedAt ? formatDate(c.resolvedAt) : '—'} />
              <DetailField
                label="Downtime"
                value={formatDowntimeLabel(c.downtimeMinutes) || '—'}
              />
              <DetailField
                label="Pending / Resolution"
                value={
                  c.status === 'Open'
                    ? `${pending} day${pending === 1 ? '' : 's'} open${overWeek ? ' · Over 1 week' : ''}`
                    : resolvedDays != null
                      ? `Resolved in ${resolvedDays} day${resolvedDays === 1 ? '' : 's'}${withinWeek ? ' · Within 1 week' : ''}`
                      : '—'
                }
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Complaint</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 whitespace-pre-wrap">{c.complaintText}</p>
            </div>

            {c.remark ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Remark</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 whitespace-pre-wrap">{c.remark}</p>
              </div>
            ) : null}

            {c.remarks ? (
              <div className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Resolution notes</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 whitespace-pre-wrap">{c.remarks}</p>
              </div>
            ) : null}

            {c.photoUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Photo</p>
                  <button
                    type="button"
                    onClick={() => onPreviewPhoto(c.photoUrl!, c.photoName)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase"
                  >
                    <Eye size={12} /> Preview image
                  </button>
                </div>
                <img
                  src={c.photoUrl}
                  alt={c.photoName || 'Complaint photo'}
                  className="max-h-48 rounded-lg border border-slate-200 object-contain bg-white"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
                <ImageIcon className="mx-auto mb-1 opacity-50" size={22} />
                No photo attached
              </div>
            )}
          </div>

          {c.status === 'Open' ? (
            <div className="shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={onResolve}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase"
              >
                <CheckCircle2 size={14} /> Mark Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ComplaintPhotoPreviewModal({
  url,
  name,
  onClose,
}: {
  url: string;
  name?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/80 p-4 flex flex-col items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-w-[min(96vw,900px)] max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <p className="text-xs font-semibold text-white/80 truncate">{name || 'Complaint photo'}</p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <img
          src={url}
          alt={name || 'Complaint photo'}
          className="max-w-full max-h-[calc(90dvh-4rem)] object-contain rounded-xl border border-white/20 bg-black/20 mx-auto"
        />
      </div>
    </div>
  );
}
