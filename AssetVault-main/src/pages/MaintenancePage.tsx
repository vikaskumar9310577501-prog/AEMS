import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronDown,
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
import { DEFAULT_MACHINE_TYPES, isCustomTrend, trendMonthsLabel } from '../types/maintenance';
import {
  canMarkMaintenanceDone,
  complaintPendingDays,
  complaintResolutionDays,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
  daysUntilDate,
  machineTrendMonths,
  effectiveNextMaintenanceDate,
  pendingPlanDates,
  COMPLAINT_RESOLVE_SLA_DAYS,
  computePmPlanKpis,
  computeComplaintStats,
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
  canViewMaintenanceComplaintDashboard,
  canViewMaintenanceComplaintsInbox,
  canViewMaintenanceDashboard,
  defaultMaintenanceTab,
  isItAdminRole,
  type MaintenanceTabId,
} from '../lib/userPermissions';
import { toDisplayDateInput, toDateInputValue } from '../lib/formatDisplayDate';
import MaintenancePmPlanBoard from '../components/MaintenancePmPlanBoard';
import PremiumComplaintDashboard from '../components/PremiumComplaintDashboard';
import ComplaintsInbox, { type ComplaintsViewFilter } from '../components/ComplaintsInbox';
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

function machineTypeShort(type: string) {
  return type.replace(/\s+Machine$/i, '').trim() || type;
}

function MachineCell({
  children,
  className = '',
  title,
  onClick,
  edge = 'mid',
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
  edge?: 'first' | 'mid' | 'last';
}) {
  const edgeClass =
    edge === 'first'
      ? 'border-l rounded-l-xl pl-4'
      : edge === 'last'
        ? 'border-r rounded-r-xl pr-4'
        : '';
  return (
    <td
      className={`px-3 py-3.5 align-middle border-y border-stone-200/70 bg-white group-hover:bg-[#FFFDF9] group-hover:border-stone-300/80 transition-colors ${edgeClass} ${className}`}
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

function statusBadge(machine: MaintenanceMachine): { label: string; className: string; detail?: string } | null {
  const days = daysUntilDate(effectiveNextMaintenanceDate(machine));
  if (days == null) return null;
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: 'OVERDUE',
      detail: `${overdueDays}d late`,
      className: 'bg-red-500/10 text-red-700 border border-red-200/80 shadow-sm shadow-red-100/80',
    };
  }
  if (days <= 7) {
    return {
      label: 'DELAYED',
      detail: `${days}d left`,
      className: 'bg-orange-500/10 text-orange-700 border border-orange-200/80 shadow-sm shadow-orange-100/80',
    };
  }
  return null;
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
  const [complaintsViewFilter, setComplaintsViewFilter] = useState<ComplaintsViewFilter>('all');
  const [complaintSearch, setComplaintSearch] = useState('');
  const [machines, setMachines] = useState<MaintenanceMachine[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([...DEFAULT_MACHINE_TYPES]);
  const [complaints, setComplaints] = useState<MaintenanceComplaint[]>([]);
  const [meta, setMeta] = useState<MaintenanceMeta | null>(null);
  const [plants, setPlants] = useState<{ code: string; name: string; location: string }[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterMachineType, setFilterMachineType] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const filterWrapRef = React.useRef<HTMLDivElement | null>(null);
  const typeFilterRef = React.useRef<HTMLDivElement | null>(null);
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
  const [machineMenuId, setMachineMenuId] = useState<string | null>(null);
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
      const wantComplaints =
        canViewMaintenanceComplaintDashboard(role) || canViewMaintenanceComplaintsInbox(role);
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
    if (!user || !canAccessMaintenance(user.role, user.categories)) return;
    const next = defaultMaintenanceTab(user.role);
    setTab((prev) => (canAccessMaintenanceTab(user.role, prev) ? prev : next));
  }, [user?.role]);

  useEffect(() => {
    if (!machineMenuId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (target instanceof Element && target.closest('[data-machine-menu]')) return;
      setMachineMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [machineMenuId]);

  useEffect(() => {
    if (!typeFilterOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = typeFilterRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setTypeFilterOpen(false);
      }
    };
    const onScroll = () => setTypeFilterOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [typeFilterOpen]);

  useEffect(() => {
    if (!user || !canAccessMaintenance(user.role, user.categories)) return;
    void load();
  }, [load, user?.role]);

  useEffect(() => {
    if (
      !user ||
      (!canViewMaintenanceComplaintsInbox(user.role) && !canViewMaintenanceComplaintDashboard(user.role))
    )
      return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [user?.role]);

  useEffect(() => {
    if (
      !user ||
      (!canViewMaintenanceComplaintsInbox(user.role) && !canViewMaintenanceComplaintDashboard(user.role))
    )
      return;
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

  const typeFilterOptions = useMemo(() => {
    const set = new Set<string>(machineTypes);
    for (const m of machines) {
      if (m.machineType?.trim()) set.add(m.machineType.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [machineTypes, machines]);

  const scopedMachines = useMemo(() => {
    return machines.filter((m) => {
      if (filterLocation && !sameLoc(m.location, filterLocation)) return false;
      if (filterPlant && String(m.plantCode || '').toLowerCase() !== filterPlant.toLowerCase()) return false;
      if (filterMachineType && m.machineType !== filterMachineType) return false;
      return true;
    });
  }, [machines, filterLocation, filterPlant, filterMachineType]);

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

  const openComplaints = useMemo(() => scopedComplaints.filter((c) => c.status === 'Open'), [scopedComplaints]);
  const resolvedComplaints = useMemo(
    () => scopedComplaints.filter((c) => c.status === 'Resolved'),
    [scopedComplaints]
  );

  const dashboardKpis = useMemo(
    () => computePmPlanKpis(scopedMachines, dashboardYear),
    [scopedMachines, dashboardYear]
  );

  /** Plan board: only machines with at least one PM date in the real current calendar month. */
  const currentMonthPlanMachines = useMemo(
    () => listMachinesForPmKpi(scopedMachines, new Date().getFullYear(), 'plannedThisMonth'),
    [scopedMachines]
  );

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

  const complaintStats = useMemo(() => computeComplaintStats(scopedComplaints), [scopedComplaints]);

  const complaintsInboxList = useMemo(() => {
    let list = searchedComplaints;
    if (complaintsViewFilter === 'pending') list = list.filter((c) => c.status === 'Open');
    if (complaintsViewFilter === 'resolved') list = list.filter((c) => c.status === 'Resolved');
    return list;
  }, [searchedComplaints, complaintsViewFilter]);

  const pickComplaintFilter = useCallback((filter: ComplaintDashboardFilter) => {
    setComplaintFilter(filter);
  }, []);

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

  if (!user || !canAccessMaintenance(user.role, user.categories)) {
    return <Navigate to={user?.role === 'HR' ? '/employees' : '/dashboard'} replace />;
  }

  const canDash = canViewMaintenanceDashboard(user.role);
  const canComplaintDash = canViewMaintenanceComplaintDashboard(user.role);
  const canComplaintsInbox = canViewMaintenanceComplaintsInbox(user.role);
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#FAF8F5]">
      <div className="shrink-0 px-4 lg:px-6 pt-2 pb-1 space-y-1.5">
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
              {canComplaintDash && (
                <button
                  type="button"
                  onClick={() => goTab('complaint-dashboard')}
                  className={navBtn(tab === 'complaint-dashboard')}
                >
                  <BarChart3 size={14} />
                  Complaint Dashboard
                </button>
              )}
              {canComplaintsInbox && (
                <button
                  type="button"
                  onClick={() => goTab('complaints')}
                  className={navBtn(tab === 'complaints')}
                >
                  <AlertTriangle size={14} />
                  Complaints
                </button>
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
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {(tab === 'complaint-dashboard' || tab === 'complaints') &&
              (canComplaintDash || canComplaintsInbox) && (
              <div className="relative min-w-[200px] max-w-[280px]">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                  size={14}
                />
                <input
                  type="search"
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  placeholder="Search asset, machine, complaint…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200/80 bg-white/90 text-xs font-semibold text-stone-800 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/60"
                />
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
            {tab === 'dashboard' && canDash && (
              <div className="inline-flex items-center gap-1 bg-[#FFFCF8] border border-stone-200/80 rounded-xl p-1 shadow-sm shadow-stone-200/40">
                <button
                  type="button"
                  onClick={() => setDashboardYear((y) => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 transition-colors"
                  aria-label="Previous year"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-black text-stone-800 bg-white/80 rounded-lg border border-stone-200/60">
                  <CalendarRange size={14} className="text-blue-600" />
                  {dashboardYear}
                </span>
                <button
                  type="button"
                  onClick={() => setDashboardYear((y) => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 transition-colors"
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
              className="px-3 py-2 bg-white/90 hover:bg-white border border-stone-200/80 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-sm text-stone-700"
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
              tone="slate"
              active={kpiOverlay === 'total'}
              onClick={() => setKpiOverlay('total')}
            />
            <DashboardKpi
              label="Planned this month"
              value={dashboardKpis.plannedThisMonth}
              tone="amber"
              active={kpiOverlay === 'plannedThisMonth'}
              onClick={() => setKpiOverlay('plannedThisMonth')}
            />
            <DashboardKpi
              label="Done this month"
              value={dashboardKpis.doneThisMonth}
              tone="violet"
              active={kpiOverlay === 'doneThisMonth'}
              onClick={() => setKpiOverlay('doneThisMonth')}
            />
            <DashboardKpi
              label="On time"
              value={dashboardKpis.onTime}
              tone="emerald"
              active={kpiOverlay === 'onTime'}
              onClick={() => setKpiOverlay('onTime')}
            />
            <DashboardKpi
              label="Delayed"
              value={dashboardKpis.delayed}
              tone="orange"
              alert="delayed"
              active={kpiOverlay === 'delayed'}
              onClick={() => setKpiOverlay('delayed')}
            />
            <DashboardKpi
              label="Overdue"
              value={dashboardKpis.overdue}
              tone="overdue"
              alert="overdue"
              active={kpiOverlay === 'overdue'}
              onClick={() => setKpiOverlay('overdue')}
            />
          </div>
        )}

        {tab === 'complaint-dashboard' && canComplaintDash && (
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
        className={`flex-1 min-h-0 flex flex-col ${
          tab === 'machines' || tab === 'dashboard'
            ? 'overflow-hidden px-4 lg:px-6 pb-3'
            : 'overflow-y-auto px-4 lg:px-6 pb-6'
        }`}
      >
        {tab === 'dashboard' && canDash && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            {kpiOverlay ? (
              <DashboardKpiOverlay
                title={PM_KPI_TITLES[kpiOverlay]}
                machines={listMachinesForPmKpi(scopedMachines, dashboardYear, kpiOverlay)}
                complaints={scopedComplaints}
                plants={plants}
                onBack={() => setKpiOverlay(null)}
                onOpenMachine={setDetailMachine}
              />
            ) : (
              <MaintenancePmPlanBoard
                machines={currentMonthPlanMachines}
                loading={loading}
                year={dashboardYear}
              />
            )}
          </div>
        )}

        {tab === 'complaint-dashboard' && canComplaintDash && (
          <PremiumComplaintDashboard
            complaints={scopedComplaints}
            plants={plants}
            filter={complaintFilter}
            search={complaintSearch}
            loading={loading}
            onOpenDetail={setDetailComplaint}
            onPreviewPhoto={(c) =>
              c.photoUrl ? setComplaintPhotoPreview({ url: c.photoUrl, name: c.photoName }) : undefined
            }
          />
        )}

        {tab === 'machines' && (
          <div className="flex flex-col flex-1 min-h-0 bg-[#FFFCF8] rounded-2xl border border-stone-200/80 overflow-hidden shadow-[0_8px_32px_-8px_rgba(120,90,60,0.14)] mb-4">
            <div className="px-4 py-3 border-b border-stone-200/60 flex flex-wrap items-center gap-3 shrink-0 bg-gradient-to-r from-[#FFF7EE] via-[#FFFCF8] to-[#F6F1EA]">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Factory size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-stone-800 leading-none">Machines</h2>
                  <p className="text-[10px] font-semibold text-stone-500 mt-0.5">{filtered.length} registered</p>
                </div>
              </div>
              {selectedMachines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPrintMachines(selectedMachines)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-500/25"
                >
                  <QrCode size={12} /> Print QR ({selectedMachines.length})
                </button>
              ) : scopedMachines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPrintMachines(scopedMachines)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-500/25"
                >
                  <QrCode size={12} /> Print All QR
                </button>
              ) : null}
              <div className="relative flex-1 min-w-[180px] max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machines…"
                  className="w-full border border-stone-200/80 rounded-xl text-[12px] py-2 pl-9 pr-3 bg-white/90 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 shadow-inner shadow-stone-100/50"
                />
              </div>
              {canAddMachine && (
                <Link
                  to="/maintenance/machines/new"
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wide shrink-0 shadow-md shadow-blue-500/25"
                >
                  + Add
                </Link>
              )}
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-stone-500">Loading machines…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-stone-100 flex items-center justify-center">
                  <Factory size={24} className="text-stone-400" />
                </div>
                <p className="text-sm text-stone-500">No machines for this filter.</p>
                {canAddMachine && (
                  <button
                    type="button"
                    onClick={() => navigate('/maintenance/machines/new')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Add Machine
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto bg-[#F7F3EE]/60 px-3 py-3">
                <table className="w-full min-w-[1060px] border-separate border-spacing-y-2.5 text-[13px] leading-normal">
                  <thead className="sticky top-0 z-30">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                      <th className="px-3 py-2.5 w-10 text-center bg-[#F0EBE3]/95 backdrop-blur-sm rounded-tl-lg border border-stone-200/50">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAllFiltered}
                          className="rounded border-stone-300 text-blue-600 focus:ring-blue-400/40"
                          title="Select all"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Machine ID</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Machine Name</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">
                        <div ref={typeFilterRef} className="relative inline-flex items-center gap-1">
                          <span>Type</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTypeFilterOpen((v) => !v);
                            }}
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-md border transition-colors ${
                              filterMachineType
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-white/80 border-stone-200/80 text-stone-500 hover:bg-white hover:text-stone-800'
                            }`}
                            title="Filter by machine type"
                            aria-label="Filter by machine type"
                          >
                            <ChevronDown size={12} className={typeFilterOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                          </button>
                          {typeFilterOpen ? (
                            <div className="absolute left-0 top-full mt-1.5 min-w-[220px] max-h-[280px] overflow-y-auto bg-white rounded-xl shadow-xl border border-stone-200/80 py-1.5 z-[60] text-left normal-case font-semibold tracking-normal">
                              <button
                                type="button"
                                onClick={() => {
                                  setFilterMachineType('');
                                  setTypeFilterOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-[12px] hover:bg-stone-50 ${
                                  !filterMachineType ? 'bg-blue-50 text-blue-800 font-bold' : 'text-stone-700'
                                }`}
                              >
                                All types
                              </button>
                              {typeFilterOptions.map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => {
                                    setFilterMachineType(type);
                                    setTypeFilterOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-stone-50 truncate ${
                                    filterMachineType === type ? 'bg-blue-50 text-blue-800 font-bold' : 'text-stone-700'
                                  }`}
                                  title={type}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left w-16 bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">No.</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Department</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Plant</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Frequency</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">Next PM</th>
                      <th className="px-3 py-2.5 text-left bg-[#F0EBE3]/95 backdrop-blur-sm border-y border-stone-200/50">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-right bg-[#F0EBE3]/95 backdrop-blur-sm rounded-tr-lg border border-stone-200/50">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, rowIdx) => {
                      const badge = statusBadge(m);
                      const plant = plantTableLabel(m.plantCode, plants);
                      const trendM = machineTrendMonths(m);
                      const menuDropUp = rowIdx >= filtered.length - 2;
                      const displayName = m.equipmentName?.trim() || machineTypeShort(m.machineType);
                      return (
                        <tr
                          key={m.id}
                          className={`group cursor-pointer transition-all duration-200 hover:-translate-y-px hover:drop-shadow-[0_8px_16px_rgba(120,90,60,0.10)] ${
                            machineMenuId === m.id ? 'relative z-50' : 'relative z-0'
                          }`}
                          onClick={() => {
                            setMachineMenuId(null);
                            setDetailMachine(m);
                          }}
                          onMouseEnter={() => {
                            if (machineMenuId !== null && machineMenuId !== m.id) {
                              setMachineMenuId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setMachineMenuId(null);
                              setDetailMachine(m);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <MachineCell
                            edge="first"
                            className="text-center shadow-sm group-hover:shadow-md"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(m.id)}
                              onChange={() => toggleOne(m.id)}
                              className="rounded border-stone-300 text-blue-600 focus:ring-blue-400/40"
                            />
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/80 font-mono text-[12px] font-bold text-blue-700 shadow-sm">
                              {m.assetCode}
                            </span>
                          </MachineCell>
                          <MachineCell title={machineRowName(m)} className="shadow-sm group-hover:shadow-md">
                            <p className="font-bold text-stone-800 leading-tight">{displayName}</p>
                            <p className="text-[10px] font-semibold text-stone-400 mt-0.5 font-mono">{m.machineNumber}</p>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <span className="inline-flex px-2 py-1 rounded-md bg-stone-100/80 border border-stone-200/60 text-[11px] font-semibold text-stone-600">
                              {machineTypeShort(m.machineType)}
                            </span>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <span className="font-mono text-[12px] font-bold text-stone-700 bg-stone-50 px-2 py-1 rounded-md border border-stone-200/60">
                              {m.machineNumber}
                            </span>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <span className="inline-flex px-2 py-1 rounded-md bg-violet-50/80 border border-violet-100 text-[10px] font-black uppercase tracking-wide text-violet-700">
                              {m.department || '—'}
                            </span>
                          </MachineCell>
                          <MachineCell title={plant.full} className="shadow-sm group-hover:shadow-md">
                            <span className="inline-flex px-2 py-1 rounded-md bg-amber-50/80 border border-amber-100 text-[10px] font-black uppercase tracking-wide text-amber-800">
                              {plant.short}
                            </span>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-stone-100/90 border border-stone-200/70 text-[11px] font-bold text-stone-700">
                              {trendCompactLabel(trendM)}
                            </span>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200/70 shadow-inner shadow-stone-100/80">
                              <CalendarRange size={14} className="text-blue-500 shrink-0" />
                              <span className="text-[12px] font-semibold text-stone-700">
                                {formatDate(effectiveNextMaintenanceDate(m))}
                              </span>
                            </div>
                          </MachineCell>
                          <MachineCell className="shadow-sm group-hover:shadow-md">
                            {badge ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                                {badge.detail ? (
                                  <span className="text-[9px] font-bold text-stone-500 pl-0.5">{badge.detail}</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[12px] font-medium text-stone-400">—</span>
                            )}
                          </MachineCell>
                          <MachineCell
                            edge="last"
                            className="text-right shadow-sm group-hover:shadow-md"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-stone-100/90 border border-stone-200/70 shadow-inner">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDetailMachine(m); }}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-stone-500 hover:text-blue-600 transition-all"
                                title="View details"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditMachine(m)}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-stone-500 hover:text-blue-600 transition-all"
                                title="Edit"
                              >
                                <Pencil size={15} />
                              </button>
                              <div className="relative" data-machine-menu>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMachineMenuId(machineMenuId === m.id ? null : m.id);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-stone-500 hover:text-stone-800 transition-all"
                                  title="More actions"
                                >
                                  <MoreVertical size={15} />
                                </button>
                                {machineMenuId === m.id && (
                                  <div
                                    className={`absolute right-0 min-w-[160px] bg-white rounded-xl shadow-xl border border-stone-200/80 py-1.5 z-[70] whitespace-nowrap ${menuDropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => { setPrintMachines([m]); setMachineMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-[13px] hover:bg-stone-50 flex items-center gap-3 text-stone-700"
                                    >
                                      <QrCode size={15} className="shrink-0" /> Print QR
                                    </button>
                                    {canMarkMaintenanceDone(m) && (
                                      <button
                                        type="button"
                                        disabled={markingDoneId === m.id}
                                        onClick={() => { setDoneMachine(m); setMachineMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-[13px] hover:bg-stone-50 flex items-center gap-3 text-emerald-700 disabled:opacity-40"
                                      >
                                        <CheckCircle2 size={15} className="shrink-0" /> Mark Done
                                      </button>
                                    )}
                                    {canDeleteMachine && (
                                      <button
                                        type="button"
                                        disabled={deletingMachineId === m.id}
                                        onClick={() => { void deleteMachine(m); setMachineMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-[13px] hover:bg-stone-50 flex items-center gap-3 text-rose-600 disabled:opacity-40"
                                      >
                                        <Trash2 size={15} className="shrink-0" /> Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </MachineCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'complaints' && canComplaintsInbox && (
          <ComplaintsInbox
            complaints={complaintsInboxList}
            plants={plants}
            loading={loading}
            viewFilter={complaintsViewFilter}
            onViewFilterChange={setComplaintsViewFilter}
            stats={{
              total: scopedComplaints.length,
              pending: openComplaints.length,
              done: resolvedComplaints.length,
            }}
            onOpenDetail={setDetailComplaint}
            onPreviewPhoto={(c) =>
              c.photoUrl ? setComplaintPhotoPreview({ url: c.photoUrl, name: c.photoName }) : undefined
            }
            onResolve={setResolveComplaintTarget}
          />
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
  tone,
  alert,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'amber' | 'violet' | 'emerald' | 'orange' | 'overdue';
  alert?: 'delayed' | 'overdue';
  active?: boolean;
  onClick: () => void;
}) {
  const toneStyles: Record<typeof tone, string> = {
    slate: 'bg-gradient-to-br from-stone-50 to-stone-100/90 border-stone-200/80 shadow-stone-200/40',
    amber: 'bg-gradient-to-br from-amber-50 to-amber-100/90 border-amber-200/80 shadow-amber-200/40',
    violet: 'bg-gradient-to-br from-violet-50 to-violet-100/90 border-violet-200/80 shadow-violet-200/40',
    emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/90 border-emerald-200/80 shadow-emerald-200/40',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100/90 border-orange-200/80 shadow-orange-200/40',
    overdue: 'bg-gradient-to-br from-red-600 to-red-700 border-red-500/80 shadow-red-500/30',
  };
  const labelTone =
    tone === 'overdue'
      ? 'text-red-100'
      : tone === 'slate'
        ? 'text-stone-600'
        : tone === 'amber'
          ? 'text-amber-800'
          : tone === 'violet'
            ? 'text-violet-800'
            : tone === 'emerald'
              ? 'text-emerald-800'
              : 'text-orange-800';
  const valueTone = tone === 'overdue' ? 'text-white' : 'text-stone-900';
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
      className={`rounded-2xl border px-3.5 py-2.5 text-left w-full cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200 ${toneStyles[tone]} ${alertClass} ${
        active ? 'ring-2 ring-blue-500/80 ring-offset-2 ring-offset-[#FAF8F5] shadow-md scale-[1.02]' : ''
      }`}
    >
      <p className={`text-[9px] font-black uppercase tracking-wider ${labelTone}`}>{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-0.5 leading-none ${valueTone}`}>{value}</p>
    </button>
  );
}

function DashboardKpiOverlay({
  title,
  machines,
  plants,
  onBack,
  onOpenMachine,
}: {
  title: string;
  machines: MaintenanceMachine[];
  complaints: MaintenanceComplaint[];
  plants: { code: string; name: string; location: string }[];
  onBack: () => void;
  onOpenMachine: (machine: MaintenanceMachine) => void;
}) {
  return (
    <div className="absolute inset-0 z-20 bg-white rounded-2xl border-2 border-stone-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
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
                    onClick={() => onOpenMachine(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenMachine(m);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMachine(m);
                        }}
                        className="text-left font-bold text-stone-900 hover:text-blue-700 underline-offset-2 hover:underline"
                      >
                        {name}
                      </button>
                      <p className="text-[11px] text-stone-500">{m.machineType}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-700">{m.assetCode}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      {isCustomTrend(freq) ? 'Custom' : freq === 1 ? '1 month' : `${freq} months`}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{m.department || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{m.responsibility || '—'}</td>
                    <td className="px-4 py-2.5">
                      {badge ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase w-fit ${badge.className}`}>
                            {badge.label}
                          </span>
                          {badge.detail ? (
                            <span className="text-[9px] font-bold text-stone-500">{badge.detail}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {formatDate(effectiveNextMaintenanceDate(m))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 min-w-0 overflow-visible shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900 whitespace-normal break-words leading-snug">
        {value || '—'}
      </p>
    </div>
  );
}

function PmHistoryPanel({ machine }: { machine: MaintenanceMachine }) {
  const currentPlan = effectiveNextMaintenanceDate(machine);
  const pending = pendingPlanDates(machine);
  const nextKey = pending[0] ? formatDateIso(pending[0]) : '';

  return (
    <div className="space-y-3 mt-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2.5 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-wider text-blue-600/80">Current plan date</p>
        <p className="mt-0.5 text-sm font-bold text-blue-900">{currentPlan ? formatDate(currentPlan) : '—'}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Planned PM dates</p>
        {pending.length === 0 ? (
          <p className="text-xs font-medium text-slate-500">—</p>
        ) : (
          <ul className="space-y-1.5">
            {pending.map((d) => {
              const iso = formatDateIso(d);
              const isNext = iso === nextKey;
              return (
                <li
                  key={iso}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                    isNext ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50/80'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <CalendarRange size={13} className={`shrink-0 ${isNext ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold ${isNext ? 'text-blue-800' : 'text-slate-700'}`}>
                      {formatDate(iso)}
                    </span>
                  </span>
                  {isNext ? (
                    <span className="text-[8px] font-black uppercase tracking-wider text-blue-600 shrink-0">Next</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
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

  const popup = (
    <div
      className="fixed inset-0 z-[200] bg-stone-900/50 backdrop-blur-[2px] p-2 sm:p-4 md:p-5 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div className="min-h-[min(100%,100dvh)] flex items-start sm:items-center justify-center py-2 sm:py-4">
        <div
          className="w-full max-w-[1120px] max-h-none sm:max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-[#FFFCF8] border border-stone-200/80 shadow-[0_24px_64px_-12px_rgba(80,60,40,0.28)] flex flex-col my-auto"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="machine-detail-title"
        >
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-stone-200/60 bg-gradient-to-r from-[#FFF7EE] via-[#FFFCF8] to-[#F6F1EA]">
            <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Machine detail</p>
                <h3 id="machine-detail-title" className="text-base sm:text-lg font-black text-slate-900 break-words">
                  {name}
                </h3>
              </div>
              <p className="font-mono text-sm font-bold text-blue-700">{machine.assetCode}</p>
              {badge ? (
                <span className={`inline-flex flex-col px-2 py-1 rounded-lg text-[10px] font-black uppercase ${badge.className}`}>
                  <span>{badge.label}</span>
                  {badge.detail ? <span className="text-[8px] font-bold normal-case opacity-80">{badge.detail}</span> : null}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-600 shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_300px]">
            {/* Left: Machine Info + Complaints */}
            <div className="overflow-y-auto min-h-0 p-5 space-y-5">
              {/* Machine Info Grid */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Machine Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  <DetailField label="Machine ID" value={machine.assetCode} />
                  <DetailField label="Machine Type" value={machine.machineType} />
                  <DetailField label="Machine No." value={machine.machineNumber} />
                  <DetailField label="Department" value={machine.department || '—'} />
                  <DetailField label="Responsibility" value={machine.responsibility || '—'} />
                  <DetailField label="Location" value={machine.location || '—'} />
                  <DetailField label="Plant" value={plantShortName(machine.plantCode, plants)} />
                </div>
              </div>

              {/* Maintenance Info */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Maintenance Schedule</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  <DetailField label="Status" value={badge ? `${badge.label}${badge.detail ? ` · ${badge.detail}` : ''}` : '—'} />
                  <DetailField label="Frequency" value={trendMonthsLabel(machine.trendMonths ?? 2)} />
                  <DetailField label="Next PM Date" value={formatDate(effectiveNextMaintenanceDate(machine))} />
                  <DetailField label="Open Complaints" value={String(openCount)} />
                  <DetailField label="Resolved Complaints" value={String(resolvedCount)} />
                </div>
              </div>

              {machine.remarks ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Remarks</p>
                  <p className="text-sm font-semibold text-slate-900 whitespace-pre-wrap break-words">{machine.remarks}</p>
                </div>
              ) : null}

              {/* Complaints List */}
              {complaints.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Complaints ({complaints.length})
                  </p>
                  <div className="space-y-2">
                    {complaints.map((c) => (
                      <div
                        key={c.id}
                        className={`rounded-xl border px-4 py-2.5 ${
                          c.status === 'Open'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-emerald-200 bg-emerald-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-600">{c.assetCode}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              c.status === 'Open'
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-emerald-200 text-emerald-700'
                            }`}
                          >
                            {c.status === 'Open' ? 'Pending' : 'Resolved'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{c.complaintText}</p>
                        {c.remark ? (
                          <p className="text-xs text-slate-500 mt-0.5">{c.remark}</p>
                        ) : null}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Reported: {formatDate(c.reportedAt)}
                          {c.resolvedAt ? ` · Resolved: ${formatDate(c.resolvedAt)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No complaints recorded for this machine.
                </div>
              )}
            </div>

            {/* Right: PM schedule */}
            <div className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/80 p-4 overflow-y-auto min-h-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">PM History</p>
              <PmHistoryPanel machine={machine} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(popup, document.body);
}

function ComplaintListItem({
  complaint: c,
  plants,
  onOpen,
  onPreviewPhoto,
  onResolve,
  hideResolve = false,
  expanded = false,
}: {
  complaint: MaintenanceComplaint;
  plants: { code: string; name: string; location: string }[];
  onOpen: () => void;
  onPreviewPhoto?: () => void;
  onResolve?: () => void;
  hideResolve?: boolean;
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
          {c.status === 'Open' && !hideResolve && onResolve ? (
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
  const isOpen = c.status === 'Open';

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-[2px] p-3 sm:p-5 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div className="min-h-full flex items-center justify-center">
        <div
          className="w-full max-w-[920px] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl bg-[#FFFCF8] border border-stone-200/80 shadow-[0_24px_64px_-12px_rgba(80,60,40,0.28)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="shrink-0 px-5 py-4 border-b border-stone-200/60 bg-gradient-to-r from-[#FFF7EE] via-[#FFFCF8] to-[#F6F1EA] flex items-start justify-between gap-4">
            <div className="min-w-0 flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isOpen
                    ? overWeek
                      ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/25'
                      : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25'
                }`}
              >
                <MessageSquareWarning size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600/90">
                  Complaint detail
                </p>
                <h3 className="text-lg sm:text-xl font-black text-stone-900 font-mono leading-tight">
                  {c.assetCode}
                </h3>
                <p className="text-xs font-semibold text-stone-500 mt-0.5 truncate">
                  {c.machineType} · {c.machineNumber}
                  {c.location ? ` · ${c.location}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                      isOpen ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {isOpen ? 'Pending' : 'Resolved'}
                  </span>
                  {isOpen && overWeek && (
                    <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                      Over 1 week
                    </span>
                  )}
                  {withinWeek && (
                    <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-violet-100 text-violet-700">
                      Within 1 week
                    </span>
                  )}
                  {formatDowntimeLabel(c.downtimeMinutes) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-stone-100 text-stone-700">
                      <Clock size={11} /> {formatDowntimeLabel(c.downtimeMinutes)} downtime
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-200/60 text-stone-600 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <DetailField label="Machine Type" value={c.machineType} />
              <DetailField label="Machine ID" value={c.machineNumber} />
              <DetailField label="Ref ID" value={c.assetCode} />
              <DetailField label="Department" value={c.department} />
              <DetailField label="Responsibility" value={c.responsibility} />
              <DetailField label="Location" value={c.location} />
              <DetailField label="Reported On" value={formatDate(c.reportedAt)} />
              {c.resolvedAt ? (
                <DetailField label="Resolved On" value={formatDate(c.resolvedAt)} />
              ) : null}
              <DetailField
                label={isOpen ? 'Pending' : 'Resolution'}
                value={
                  isOpen
                    ? `${pending} day${pending === 1 ? '' : 's'} open`
                    : resolvedDays != null
                      ? `${resolvedDays} day${resolvedDays === 1 ? '' : 's'}`
                      : '—'
                }
              />
            </div>

            <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-stone-500">Complaint</p>
              <p className="mt-1 text-sm font-semibold text-stone-900 whitespace-pre-wrap leading-relaxed">
                {c.complaintText}
              </p>
            </div>

            {c.remark ? (
              <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-wider text-stone-500">Remark</p>
                <p className="mt-1 text-sm font-semibold text-stone-900 whitespace-pre-wrap leading-relaxed">
                  {c.remark}
                </p>
              </div>
            ) : null}

            {c.remarks ? (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                  Resolution notes
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-900 whitespace-pre-wrap leading-relaxed">
                  {c.remarks}
                </p>
              </div>
            ) : null}

            {c.photoUrl ? (
              <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-stone-500">Photo</p>
                  <button
                    type="button"
                    onClick={() => onPreviewPhoto(c.photoUrl!, c.photoName)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase shadow-sm shadow-indigo-500/25"
                  >
                    <Eye size={12} /> Preview image
                  </button>
                </div>
                <img
                  src={c.photoUrl}
                  alt={c.photoName || 'Complaint photo'}
                  className="max-h-52 w-full rounded-xl border border-stone-200/80 object-contain bg-stone-50"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200/80 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-400">
                <ImageIcon className="mx-auto mb-2 opacity-50" size={24} />
                No photo attached
              </div>
            )}
          </div>

          {isOpen ? (
            <div className="shrink-0 px-5 py-3.5 border-t border-stone-200/60 bg-gradient-to-r from-[#FFF7EE]/80 to-[#FFFCF8] flex justify-end">
              <button
                type="button"
                onClick={onResolve}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase shadow-md shadow-emerald-500/25 transition-colors"
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
