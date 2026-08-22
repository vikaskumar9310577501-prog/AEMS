import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  TrendingUp,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  Eye,
  CheckSquare,
  ShieldCheck,
  Building2,
  MapPin,
  Cpu,
  Info,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { MaintenanceComplaint, MaintenanceMachine } from '../types/maintenance';
import { plantShortName, type PlantLike } from '../lib/plantDisplay';
import {
  COMPLAINT_RESOLVE_SLA_DAYS,
  ComplaintDashboardFilter,
  complaintPendingDays,
  complaintResolutionDays,
  computeAverageResolutionDays,
  computeComplaintAgeing,
  computeExecutiveAlerts,
  computePlantPerformanceMatrix,
  computeTopProblematicEquipment,
  computeTotalDowntimeMinutes,
  formatDowntimeLabel,
  isComplaintOverOneWeek,
  isComplaintResolvedWithinWeek,
} from '../lib/maintenanceCodes';

interface ExecutiveComplaintDashboardProps {
  complaints: MaintenanceComplaint[];
  machines: MaintenanceMachine[];
  plants: PlantLike[];
  locations: string[];
  machineTypes: string[];
  userRole?: string;
  onRefresh: () => void;
  onResolveComplaint: (complaint: MaintenanceComplaint) => void;
  onViewPhoto: (photo: { url: string; name?: string }) => void;
  onViewDetail: (complaint: MaintenanceComplaint) => void;
  onViewMachineDetail?: (machine: MaintenanceMachine) => void;
  loading?: boolean;
}

export default function ExecutiveComplaintDashboard({
  complaints,
  machines,
  plants,
  locations,
  machineTypes,
  userRole,
  onRefresh,
  onResolveComplaint,
  onViewPhoto,
  onViewDetail,
  onViewMachineDetail,
  loading = false,
}: ExecutiveComplaintDashboardProps) {
  // Global Filters
  const [plantFilter, setPlantFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ComplaintDashboardFilter>('total');
  const [yearFilter, setYearFilter] = useState<number>(() => new Date().getFullYear());
  const [ageBucketFilter, setAgeBucketFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const now = useMemo(() => new Date(), []);

  // Department options from current complaints & machines
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const c of complaints) if (c.department) set.add(c.department.trim());
    for (const m of machines) if (m.department) set.add(m.department.trim());
    return Array.from(set).sort();
  }, [complaints, machines]);

  // Apply Global Filters to Complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Plant Filter
      if (plantFilter && String(c.plantCode || '').trim().toUpperCase() !== plantFilter.trim().toUpperCase()) {
        return false;
      }
      // Location Filter
      if (locationFilter && String(c.location || '').trim().toLowerCase() !== locationFilter.trim().toLowerCase()) {
        return false;
      }
      // Department Filter
      if (departmentFilter && String(c.department || '').trim().toLowerCase() !== departmentFilter.trim().toLowerCase()) {
        return false;
      }
      // Machine Type Filter
      if (machineTypeFilter && String(c.machineType || '').trim().toLowerCase() !== machineTypeFilter.trim().toLowerCase()) {
        return false;
      }
      // Year Filter
      if (yearFilter) {
        const d = new Date(c.reportedAt);
        if (!Number.isNaN(d.getTime()) && d.getFullYear() !== yearFilter) {
          return false;
        }
      }
      // Status Filter
      if (statusFilter === 'pending' && c.status !== 'Open') return false;
      if (statusFilter === 'resolved' && c.status !== 'Resolved') return false;
      if (statusFilter === 'within_week' && !isComplaintResolvedWithinWeek(c)) return false;
      if (statusFilter === 'over_week' && !isComplaintOverOneWeek(c, now)) return false;

      // Age Bucket Filter
      if (ageBucketFilter && c.status === 'Open') {
        const age = complaintPendingDays(c.reportedAt, now);
        if (ageBucketFilter === '0-2' && (age < 0 || age > 2)) return false;
        if (ageBucketFilter === '3-5' && (age < 3 || age > 5)) return false;
        if (ageBucketFilter === '6-7' && (age < 6 || age > 7)) return false;
        if (ageBucketFilter === '8-14' && (age < 8 || age > 14)) return false;
        if (ageBucketFilter === '15+' && age < 15) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${c.assetCode} ${c.machineType} ${c.machineNumber} ${c.equipmentName || ''} ${c.complaintText} ${c.location} ${c.plantCode}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [
    complaints,
    plantFilter,
    locationFilter,
    departmentFilter,
    machineTypeFilter,
    yearFilter,
    statusFilter,
    ageBucketFilter,
    searchQuery,
    now,
  ]);

  // Executive Metrics Calculations
  const totalCount = filteredComplaints.length;
  const openCount = useMemo(() => filteredComplaints.filter((c) => c.status === 'Open').length, [filteredComplaints]);
  const resolvedCount = useMemo(() => filteredComplaints.filter((c) => c.status === 'Resolved').length, [filteredComplaints]);
  const overdueCount = useMemo(() => filteredComplaints.filter((c) => isComplaintOverOneWeek(c, now)).length, [filteredComplaints, now]);
  const resolvedWithinWeek = useMemo(() => filteredComplaints.filter((c) => isComplaintResolvedWithinWeek(c)).length, [filteredComplaints]);

  const resolutionRatePct = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;
  const slaCompliancePct = totalCount > 0 ? Math.round((resolvedWithinWeek / totalCount) * 100) : 100;
  const avgResolutionDays = useMemo(() => computeAverageResolutionDays(filteredComplaints, now), [filteredComplaints, now]);
  const totalDowntimeMin = useMemo(() => computeTotalDowntimeMinutes(filteredComplaints), [filteredComplaints]);
  const downtimeLabel = formatDowntimeLabel(totalDowntimeMin) || '0m';

  // Overall Maintenance Health Calculations
  const maintenanceHealth = useMemo(() => {
    let complaintHealth: 'Healthy' | 'Attention Required' | 'Critical' = 'Healthy';
    if (overdueCount > 0) complaintHealth = 'Critical';
    else if (openCount > 3) complaintHealth = 'Attention Required';

    let downtimeHealth: 'Low Impact' | 'Moderate' | 'High Impact' = 'Low Impact';
    if (totalDowntimeMin >= 300) downtimeHealth = 'High Impact';
    else if (totalDowntimeMin >= 60) downtimeHealth = 'Moderate';

    const plantMatrix = computePlantPerformanceMatrix(filteredComplaints, plants, now);
    const bestPlant = plantMatrix.length ? [...plantMatrix].sort((a, b) => b.slaPct - a.slaPct)[0] : null;
    const worstPlant = plantMatrix.length ? [...plantMatrix].sort((a, b) => a.slaPct - b.slaPct)[0] : null;

    return { complaintHealth, downtimeHealth, bestPlant, worstPlant, plantMatrix };
  }, [filteredComplaints, openCount, overdueCount, totalDowntimeMin, plants, now]);

  // Executive Alerts
  const executiveAlerts = useMemo(() => {
    return computeExecutiveAlerts(filteredComplaints, plants, now);
  }, [filteredComplaints, plants, now]);

  // Top Problematic Equipment
  const topEquipment = useMemo(() => {
    return computeTopProblematicEquipment(filteredComplaints, 5);
  }, [filteredComplaints]);

  // Failure Concentration by Machine Type
  const machineTypeConcentration = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filteredComplaints) {
      map.set(c.machineType, (map.get(c.machineType) || 0) + 1);
    }
    const total = filteredComplaints.length || 1;
    return Array.from(map.entries())
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredComplaints]);

  // Complaint Ageing Buckets
  const ageing = useMemo(() => {
    return computeComplaintAgeing(filteredComplaints, now);
  }, [filteredComplaints, now]);

  // Open Complaints Prioritized (Overdue first, then longest pending, then downtime)
  const prioritizedOpenComplaints = useMemo(() => {
    const open = filteredComplaints.filter((c) => c.status === 'Open');
    return open.sort((a, b) => {
      const aOver = isComplaintOverOneWeek(a, now);
      const bOver = isComplaintOverOneWeek(b, now);
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      const ageA = complaintPendingDays(a.reportedAt, now);
      const ageB = complaintPendingDays(b.reportedAt, now);
      if (ageA !== ageB) return ageB - ageA;
      return (Number(b.downtimeMinutes) || 0) - (Number(a.downtimeMinutes) || 0);
    });
  }, [filteredComplaints, now]);

  // Recent Complaints Log (Latest 5)
  const recentComplaints = useMemo(() => {
    return [...filteredComplaints]
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 5);
  }, [filteredComplaints]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setPlantFilter('');
    setLocationFilter('');
    setDepartmentFilter('');
    setMachineTypeFilter('');
    setStatusFilter('total');
    setYearFilter(new Date().getFullYear());
    setAgeBucketFilter(null);
    setSearchQuery('');
  };

  // Last update timestamp display
  const refreshTimestamp = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }, [complaints]);

  return (
    <div className="space-y-6 pb-12">
      {/* 4. EXECUTIVE HEADER */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Executive Management Control Room
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight mt-1">
            Complaint & Maintenance Performance
          </h1>
          <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
            <span>{plantFilter ? plantShortName(plantFilter, plants) : 'All Manufacturing Plants'}</span>
            <span>•</span>
            <span>Year {yearFilter}</span>
            <span>•</span>
            <span className="text-slate-400">Updated {refreshTimestamp} IST</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* 5. GLOBAL FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Executive Global Filters
            </h3>
          </div>
          {(plantFilter || locationFilter || departmentFilter || machineTypeFilter || statusFilter !== 'total' || ageBucketFilter || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Plant Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plant</label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Plants</option>
              {plants.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Location Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Department Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Machine Type Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Machine Type</label>
            <select
              value={machineTypeFilter}
              onChange={(e) => setMachineTypeFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Machine Types</option>
              {machineTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Complaint Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ComplaintDashboardFilter)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="total">All Statuses</option>
              <option value="pending">Open Only</option>
              <option value="over_week">Overdue SLA Breach</option>
              <option value="within_week">Resolved Within SLA</option>
              <option value="resolved">All Resolved</option>
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(Number(e.target.value))}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="pt-1">
          <input
            type="text"
            placeholder="Search by asset code, machine number, complaint text, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 6. EXECUTIVE KPI SECTION (Level 1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Total Complaints */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Complaints</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{totalCount}</span>
            <span className="text-[10px] font-bold text-slate-500">Log Scope</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate">Filtered period total</p>
        </div>

        {/* KPI 2: Open / Pending */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'total' : 'pending')}
          className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
            openCount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Open / Pending</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-900 tabular-nums">{openCount}</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                openCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {openCount > 0 ? 'Active Issue' : 'Clear'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate">Click to filter open</p>
        </div>

        {/* KPI 3: Overdue / SLA Breach (Risk Highlight) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'over_week' ? 'total' : 'over_week')}
          className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
            overdueCount > 0
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200/50'
              : 'bg-emerald-50/30 border-emerald-200'
          }`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-wider ${
              overdueCount > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            SLA Breaches (&gt;7d)
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span
              className={`text-2xl font-black tabular-nums ${
                overdueCount > 0 ? 'text-rose-900' : 'text-emerald-900'
              }`}
            >
              {overdueCount}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                overdueCount > 0 ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {overdueCount > 0 ? 'CRITICAL RISK' : 'On Target'}
            </span>
          </div>
          <p
            className={`text-[10px] mt-2 truncate ${
              overdueCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'
            }`}
          >
            {overdueCount > 0 ? 'Requires immediate action' : '0 overdue breaches'}
          </p>
        </div>

        {/* KPI 4: Resolution Rate */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Resolution Rate</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{resolutionRatePct}%</span>
            <span className="text-[10px] font-bold text-slate-500">{resolvedCount} Solved</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${resolutionRatePct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${resolutionRatePct}%` }}
            />
          </div>
        </div>

        {/* KPI 5: Avg Resolution Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Avg Resolution</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{avgResolutionDays}d</span>
            <span className="text-[10px] font-bold text-slate-500">Target &le;7d</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate">Mean days to close</p>
        </div>

        {/* KPI 6: Total Downtime */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Downtime</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{downtimeLabel}</span>
            <span className="text-[10px] font-bold text-slate-500">{totalDowntimeMin}m</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate">Production loss time</p>
        </div>
      </div>

      {/* 7. MANAGEMENT HEALTH SUMMARY & 8. MANAGEMENT ATTENTION REQUIRED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Management Health Summary (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Overall Maintenance Health
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Calculated Metrics</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Complaint Health</p>
              <p
                className={`text-sm font-black mt-1 ${
                  maintenanceHealth.complaintHealth === 'Critical'
                    ? 'text-rose-600'
                    : maintenanceHealth.complaintHealth === 'Attention Required'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {maintenanceHealth.complaintHealth}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">SLA Target Met</p>
              <p
                className={`text-sm font-black mt-1 ${
                  slaCompliancePct >= 80 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {slaCompliancePct}% Compliance
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Downtime Level</p>
              <p
                className={`text-sm font-black mt-1 ${
                  maintenanceHealth.downtimeHealth === 'High Impact'
                    ? 'text-rose-600'
                    : maintenanceHealth.downtimeHealth === 'Moderate'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {maintenanceHealth.downtimeHealth}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Plant Performance</p>
              <p className="text-xs font-black text-slate-800 mt-1 truncate">
                Best: {maintenanceHealth.bestPlant ? maintenanceHealth.bestPlant.plantCode : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Management Attention Required Alerts (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Management Attention Required
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Dynamic Insights</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {executiveAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.filterPayload.statusFilter) setStatusFilter(alert.filterPayload.statusFilter);
                  if (alert.filterPayload.plantFilter) setPlantFilter(alert.filterPayload.plantFilter);
                  if (alert.filterPayload.machineTypeFilter) setMachineTypeFilter(alert.filterPayload.machineTypeFilter);
                }}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  alert.type === 'critical'
                    ? 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/80'
                    : alert.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        alert.type === 'critical'
                          ? 'bg-rose-200 text-rose-800'
                          : alert.type === 'warning'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      {alert.type}
                    </span>
                    <p className="text-xs font-bold truncate">{alert.title}</p>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5 truncate">{alert.description}</p>
                </div>
                <span className="text-[11px] font-bold shrink-0 flex items-center gap-1 underline">
                  {alert.actionText} <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 10. PLANT PERFORMANCE MATRIX (Level 4) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Plant-wise Performance Matrix
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">Click plant row to filter</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2.5 px-3">Plant</th>
                <th className="py-2.5 px-3 text-center">Total Complaints</th>
                <th className="py-2.5 px-3 text-center">Open</th>
                <th className="py-2.5 px-3 text-center">Resolved</th>
                <th className="py-2.5 px-3 text-center">SLA Compliance</th>
                <th className="py-2.5 px-3 text-center">Total Downtime</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {maintenanceHealth.plantMatrix.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 font-medium">
                    No plant performance data available for current filters
                  </td>
                </tr>
              ) : (
                maintenanceHealth.plantMatrix.map((item) => (
                  <tr
                    key={item.plantCode}
                    onClick={() => setPlantFilter(plantFilter === item.plantCode ? '' : item.plantCode)}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      plantFilter === item.plantCode ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {item.plantName}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">{item.total}</td>
                    <td className="py-3 px-3 text-center tabular-nums text-amber-700">{item.open}</td>
                    <td className="py-3 px-3 text-center tabular-nums text-emerald-700">{item.resolved}</td>
                    <td className="py-3 px-3 text-center tabular-nums font-bold">
                      <span
                        className={item.slaPct >= 80 ? 'text-emerald-600' : 'text-rose-600'}
                      >
                        {item.slaPct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {formatDowntimeLabel(item.downtimeMinutes) || '0m'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          item.status === 'Critical'
                            ? 'bg-rose-100 text-rose-700'
                            : item.status === 'Attention'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 12. ROOT CAUSE ANALYSIS & 13. MACHINE TYPE ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top Problematic Equipment (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Top Problematic Equipment
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Ranked by Breakdown Frequency</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                  <th className="pb-2">Equipment / Asset</th>
                  <th className="pb-2 text-center">Complaints</th>
                  <th className="pb-2 text-center">Open</th>
                  <th className="pb-2 text-center">Downtime</th>
                  <th className="pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {topEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      No equipment breakdown logs found
                    </td>
                  </tr>
                ) : (
                  topEquipment.map((eq) => (
                    <tr
                      key={eq.assetCode}
                      onClick={() => setSearchQuery(eq.assetCode)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2.5">
                        <p className="font-bold text-slate-900">{eq.equipmentName}</p>
                        <p className="text-[10px] text-slate-400">
                          {eq.assetCode} • {eq.plantCode}
                        </p>
                      </td>
                      <td className="py-2.5 text-center font-bold text-slate-900">{eq.complaintCount}</td>
                      <td className="py-2.5 text-center text-amber-700">{eq.openCount}</td>
                      <td className="py-2.5 text-center">{formatDowntimeLabel(eq.totalDowntimeMinutes) || '0m'}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            eq.risk === 'High'
                              ? 'bg-rose-100 text-rose-700'
                              : eq.risk === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {eq.risk} Risk
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Machine Type Concentration (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Failure by Machine Type
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Concentration Ratio</span>
          </div>

          <div className="space-y-3">
            {machineTypeConcentration.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No machine type data</p>
            ) : (
              machineTypeConcentration.map((item) => (
                <div
                  key={item.type}
                  onClick={() => setMachineTypeFilter(machineTypeFilter === item.type ? '' : item.type)}
                  className="space-y-1 cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 group-hover:text-blue-600 truncate">{item.type}</span>
                    <span className="text-slate-500 tabular-nums">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 16. COMPLAINT AGEING ANALYSIS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Open Complaint Ageing Analysis
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            Total Open: {ageing.totalOpen} | Click bucket to filter
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* 0-2 Days */}
          <div
            onClick={() => setAgeBucketFilter(ageBucketFilter === '0-2' ? null : '0-2')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              ageBucketFilter === '0-2'
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">0 – 2 Days</p>
            <p className="text-xl font-black mt-0.5">{ageing.b0_2}</p>
            <p className="text-[9px] opacity-70">Fresh Open</p>
          </div>

          {/* 3-5 Days */}
          <div
            onClick={() => setAgeBucketFilter(ageBucketFilter === '3-5' ? null : '3-5')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              ageBucketFilter === '3-5'
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">3 – 5 Days</p>
            <p className="text-xl font-black mt-0.5">{ageing.b3_5}</p>
            <p className="text-[9px] opacity-70">In Progress</p>
          </div>

          {/* 6-7 Days */}
          <div
            onClick={() => setAgeBucketFilter(ageBucketFilter === '6-7' ? null : '6-7')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              ageBucketFilter === '6-7'
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">6 – 7 Days</p>
            <p className="text-xl font-black mt-0.5">{ageing.b6_7}</p>
            <p className="text-[9px] opacity-70">SLA Warning</p>
          </div>

          {/* 8-14 Days */}
          <div
            onClick={() => setAgeBucketFilter(ageBucketFilter === '8-14' ? null : '8-14')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              ageBucketFilter === '8-14'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
            }`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">8 – 14 Days</p>
            <p className="text-xl font-black mt-0.5">{ageing.b8_14}</p>
            <p className="text-[9px] opacity-70">Overdue Breach</p>
          </div>

          {/* 15+ Days */}
          <div
            onClick={() => setAgeBucketFilter(ageBucketFilter === '15+' ? null : '15+')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              ageBucketFilter === '15+'
                ? 'bg-rose-700 text-white border-rose-800'
                : 'bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200'
            }`}
          >
            <p className="text-[10px] font-bold uppercase opacity-80">15+ Days</p>
            <p className="text-xl font-black mt-0.5">{ageing.b15_plus}</p>
            <p className="text-[9px] opacity-70">Severe Breach</p>
          </div>
        </div>
      </div>

      {/* 17. OPEN COMPLAINTS REQUIRING ATTENTION (Level 5) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Open Complaints Requiring Attention
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Prioritized by SLA breach status, pending age, and downtime impact
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {prioritizedOpenComplaints.length} Open Issues
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                <th className="py-2.5 px-3">Asset Code</th>
                <th className="py-2.5 px-3">Equipment / Machine</th>
                <th className="py-2.5 px-3">Plant & Location</th>
                <th className="py-2.5 px-3">Complaint Details</th>
                <th className="py-2.5 px-3 text-center">Pending Age</th>
                <th className="py-2.5 px-3 text-center">Downtime</th>
                <th className="py-2.5 px-3 text-center">SLA Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {prioritizedOpenComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No open breakdown complaints matching current filters 🎉
                  </td>
                </tr>
              ) : (
                prioritizedOpenComplaints.map((c) => {
                  const isOver = isComplaintOverOneWeek(c, now);
                  const ageDays = complaintPendingDays(c.reportedAt, now);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{c.assetCode}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{c.equipmentName || c.machineType}</p>
                        <p className="text-[10px] text-slate-400">No: {c.machineNumber}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800">{plantShortName(c.plantCode, plants)}</p>
                        <p className="text-[10px] text-slate-400">{c.location}</p>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <p className="line-clamp-2 text-slate-800">{c.complaintText}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-bold tabular-nums">
                        {ageDays} day{ageDays === 1 ? '' : 's'}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums">
                        {formatDowntimeLabel(c.downtimeMinutes) || '0m'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isOver
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-sky-100 text-sky-700 border border-sky-200'
                          }`}
                        >
                          {isOver ? 'OVERDUE' : 'WITHIN SLA'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.photoUrl && (
                            <button
                              type="button"
                              onClick={() => onViewPhoto({ url: c.photoUrl!, name: c.photoName })}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer"
                              title="View Photo"
                            >
                              Photo
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onResolveComplaint(c)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 18. RECENT COMPLAINTS AUDIT LOG */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Recent Complaints Activity Log
          </h3>
          <span className="text-[10px] font-bold text-slate-400">Latest 5 Entries</span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentComplaints.map((c) => (
            <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{c.assetCode}</span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                      c.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.reportedAt}</span>
                </div>
                <p className="text-slate-600 truncate mt-0.5">{c.complaintText}</p>
              </div>

              <button
                type="button"
                onClick={() => onViewDetail(c)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 shrink-0 cursor-pointer"
              >
                Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
