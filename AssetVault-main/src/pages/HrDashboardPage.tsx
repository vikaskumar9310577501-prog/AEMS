import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Laptop,
  Building2,
  MapPin,
  TrendingUp,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Briefcase,
  Smartphone,
  HardDrive,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Percent,
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee, employeeStatusLabel } from '../lib/employeeStatus';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { EMPTY_EMPLOYEE, type Employee } from '../types/employee';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

type DirectoryFilterTab = 'all' | 'equipped' | 'unallocated' | 'inactive';

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const { assets, user } = useApp();
  const { employees, loading, refresh } = useEmployees();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DirectoryFilterTab>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());

  // Metrics & Stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => !isInactiveEmployee(e.status)).length;
    const inactive = total - active;

    let employeesWithAssets = 0;
    let totalAssignedAssets = 0;
    let laptopsCount = 0;
    let desktopsCount = 0;
    let mobilesCount = 0;
    let othersCount = 0;

    const deptMap: Record<string, { count: number; assets: number; active: number }> = {};
    const plantMap: Record<string, { count: number; assets: number; location: string }> = {};

    employees.forEach((emp) => {
      const empAssets = assetsForEmployee(assets, emp);
      const assetCount = empAssets.length;
      if (assetCount > 0) employeesWithAssets++;
      totalAssignedAssets += assetCount;

      empAssets.forEach((a) => {
        const cat = `${a.mainCategory || ''} ${a.subCategory || ''} ${a.assetName || ''}`.toLowerCase();
        if (cat.includes('laptop')) laptopsCount++;
        else if (cat.includes('desktop') || cat.includes('workstation')) desktopsCount++;
        else if (cat.includes('mobile') || cat.includes('phone') || cat.includes('tablet')) mobilesCount++;
        else othersCount++;
      });

      const dept = String(emp.department || 'General').trim() || 'General';
      if (!deptMap[dept]) deptMap[dept] = { count: 0, assets: 0, active: 0 };
      deptMap[dept].count += 1;
      deptMap[dept].assets += assetCount;
      if (!isInactiveEmployee(emp.status)) deptMap[dept].active += 1;

      const plant = String(emp.plant || '4020').trim() || '4020';
      if (!plantMap[plant]) plantMap[plant] = { count: 0, assets: 0, location: emp.location || 'Bhiwadi' };
      plantMap[plant].count += 1;
      plantMap[plant].assets += assetCount;
    });

    const equippedRate = total > 0 ? Math.round((employeesWithAssets / total) * 100) : 0;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

    const topDepts = Object.entries(deptMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    const plantBreakdown = Object.entries(plantMap)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      active,
      inactive,
      employeesWithAssets,
      withoutAssets: total - employeesWithAssets,
      totalAssignedAssets,
      equippedRate,
      activeRate,
      topDepts,
      plantBreakdown,
      hardwareBreakdown: {
        laptops: laptopsCount,
        desktops: desktopsCount,
        mobiles: mobilesCount,
        others: othersCount,
      },
    };
  }, [employees, assets]);

  // Filtered employees list for bottom directory
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (activeTab === 'equipped') {
      list = list.filter((e) => assetsForEmployee(assets, e).length > 0);
    } else if (activeTab === 'unallocated') {
      list = list.filter((e) => assetsForEmployee(assets, e).length === 0);
    } else if (activeTab === 'inactive') {
      list = list.filter((e) => isInactiveEmployee(e.status));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q) ||
          (e.designation || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [employees, assets, activeTab, search]);

  const exportExcel = () => {
    try {
      const data = employees.map((emp) => {
        const empAssets = assetsForEmployee(assets, emp);
        return {
          'Employee ID': emp.employeeId,
          'Full Name': emp.name,
          'Department': emp.department || '',
          'Designation': emp.designation || '',
          'Email Address': emp.email || '',
          'Contact Phone': emp.phone || '',
          'Location': emp.location || '',
          'Plant Code': emp.plant || '',
          'Employment Status': emp.status || 'Active',
          'Assigned Assets Count': empAssets.length,
          'Asset Codes': empAssets.map((a) => a.assetCode || a.id).join(', '),
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'HR_Master_Directory');
      XLSX.writeFile(wb, `HR_Workforce_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Master HR report exported to Excel');
    } catch {
      toast.error('Failed to export Excel report');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 min-h-screen">
      {/* Executive Hero Banner */}
      <div className="bg-white border-b border-slate-200 px-6 lg:px-8 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1">
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100 font-black tracking-wide">
                <Sparkles size={12} /> HR OPERATIONS &amp; WORKFORCE INTELLIGENCE
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Human Resources Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time directory analytics, department personnel assignments, and company asset governance.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                toast.promise(
                  refresh(true),
                  { loading: 'Syncing directory...', success: 'Sync complete', error: 'Sync failed' },
                  { id: 'sync-hr' }
                );
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200/80"
              title="Sync latest database records"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={exportExcel}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200/80"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export Master Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_EMPLOYEE());
                setModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-blue-500/20 flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Add Employee</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* 4 Premium Executive Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {/* Card 1: Total Personnel */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-lg shadow-blue-500/10 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">
                  Total Workforce
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <Users size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl lg:text-4xl font-black">{stats.total}</span>
                <span className="text-xs font-bold text-blue-200">Registered</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-md text-[11px]">
                <UserCheck size={11} /> {stats.active} Active ({stats.activeRate}%)
              </span>
              {stats.inactive > 0 && (
                <span className="text-blue-200 text-[11px] font-medium">{stats.inactive} Inactive</span>
              )}
            </div>
          </div>

          {/* Card 2: Allocated Hardware Assets */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Hardware Deployed
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Laptop size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl lg:text-4xl font-black text-slate-900">{stats.totalAssignedAssets}</span>
                <span className="text-xs font-bold text-slate-400">Items Allotted</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 text-[11px] font-bold text-slate-500">
              <span>💻 {stats.hardwareBreakdown.laptops} Laptops</span>
              <span>🖥️ {stats.hardwareBreakdown.desktops} Desktops</span>
            </div>
          </div>

          {/* Card 3: Asset Equipping Rate */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Asset Coverage
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl lg:text-4xl font-black text-slate-900">{stats.equippedRate}%</span>
                <span className="text-xs font-bold text-emerald-600">Staff Equipped</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.equippedRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Unallocated / Pool */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Hardware-Free Staff
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Package size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl lg:text-4xl font-black text-slate-900">{stats.withoutAssets}</span>
                <span className="text-xs font-bold text-slate-400">Available Pool</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-amber-700 font-bold">Pending Allotment</span>
              <button
                type="button"
                onClick={() => setActiveTab('unallocated')}
                className="text-blue-600 hover:underline font-bold"
              >
                View Pool →
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Department Workload & Plant Allocation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Breakdown (2 Columns) */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Department Workforce &amp; Asset Density
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Headcount distribution and equipment allotment across active divisions
                </p>
              </div>
              <Building2 size={18} className="text-slate-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {stats.topDepts.slice(0, 8).map((dept) => {
                const percent = stats.total > 0 ? Math.round((dept.count / stats.total) * 100) : 0;
                return (
                  <div
                    key={dept.name}
                    className="p-4 bg-slate-50 hover:bg-slate-50/80 rounded-2xl border border-slate-100 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-slate-900 text-xs truncate max-w-[140px]">
                          {dept.name}
                        </span>
                        <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {dept.count} Staff
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {dept.assets} Assets assigned • {dept.active} active members
                      </p>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                        <span>Workforce Share</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plant Distribution (1 Column) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">Plant Deployment</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Personnel and assets by operational facility</p>
                </div>
                <MapPin size={18} className="text-slate-400" />
              </div>

              <div className="space-y-3">
                {stats.plantBreakdown.map((plant) => {
                  const percent = stats.total > 0 ? Math.round((plant.count / stats.total) * 100) : 0;
                  return (
                    <div
                      key={plant.code}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-mono font-black text-xs">
                          {plant.code}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">Plant {plant.code}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{plant.location}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">{plant.count}</span>
                        <p className="text-[10px] text-slate-500 font-bold">{plant.assets} Assets</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/employees')}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <span>Full Directory Browser</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Live Workforce Directory Table */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
          {/* Tabs & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
              {[
                { id: 'all', label: `All Staff (${stats.total})` },
                { id: 'equipped', label: `Equipped (${stats.employeesWithAssets})` },
                { id: 'unallocated', label: `No Hardware (${stats.withoutAssets})` },
                { id: 'inactive', label: `Inactive (${stats.inactive})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as DirectoryFilterTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name, ID or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200/80 transition-all"
              />
            </div>
          </div>

          {/* Table */}
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs">
              No matching employee records found for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">Corporate Email</th>
                    <th className="px-4 py-3">Plant</th>
                    <th className="px-4 py-3 text-center">Allocated Assets</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEmployees.slice(0, 15).map((emp) => {
                    const count = assetsForEmployee(assets, emp).length;
                    const isInactive = isInactiveEmployee(emp.status);
                    return (
                      <tr
                        key={emp.employeeId}
                        onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        {/* Employee Name + Monogram */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0 border border-blue-200/60">
                              {emp.photoUrl ? (
                                <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                emp.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                {emp.name}
                              </p>
                              <span className="font-mono text-[10px] font-bold text-slate-400">
                                {emp.employeeId}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-bold text-slate-700">{emp.department || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-500">{emp.designation || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-500 truncate max-w-[180px]">{emp.email || '—'}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{emp.plant || '—'}</td>

                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-md font-black text-[11px] ${
                              count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {count} {count === 1 ? 'Asset' : 'Assets'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              !isInactive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {employeeStatusLabel(emp.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredEmployees.length > 15 && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => navigate('/employees')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                View all {filteredEmployees.length} employees in Directory →
              </button>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <CreateEmployeeModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => refresh(true)}
          initialData={form}
        />
      )}
    </div>
  );
}
