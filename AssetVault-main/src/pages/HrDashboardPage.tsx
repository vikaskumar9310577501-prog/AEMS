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
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee } from '../lib/employeeStatus';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { EMPTY_EMPLOYEE, type Employee } from '../types/employee';

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const { assets, user } = useApp();
  const { employees, loading, refresh } = useEmployees();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());

  // Metrics calculations
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => !isInactiveEmployee(e.status)).length;
    const inactive = total - active;

    let employeesWithAssets = 0;
    let totalAssignedAssets = 0;

    const deptMap: Record<string, { count: number; assets: number }> = {};
    const plantMap: Record<string, number> = {};

    employees.forEach((emp) => {
      const empAssets = assetsForEmployee(assets, emp);
      const assetCount = empAssets.length;
      if (assetCount > 0) employeesWithAssets++;
      totalAssignedAssets += assetCount;

      const dept = String(emp.department || 'General').trim() || 'General';
      if (!deptMap[dept]) deptMap[dept] = { count: 0, assets: 0 };
      deptMap[dept].count += 1;
      deptMap[dept].assets += assetCount;

      const plant = String(emp.plant || 'Unassigned').trim() || 'Unassigned';
      plantMap[plant] = (plantMap[plant] || 0) + 1;
    });

    const equippedRate = total > 0 ? Math.round((employeesWithAssets / total) * 100) : 0;

    const topDepts = Object.entries(deptMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const plantBreakdown = Object.entries(plantMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      active,
      inactive,
      employeesWithAssets,
      withoutAssets: total - employeesWithAssets,
      totalAssignedAssets,
      equippedRate,
      topDepts,
      plantBreakdown,
    };
  }, [employees, assets]);

  const recentEmployees = useMemo(() => {
    return [...employees]
      .reverse()
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [employees, search]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1">
              <Sparkles size={14} />
              <span>HR INTELLIGENCE & WORKFORCE MANAGEMENT</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              HR Operations Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overview of personnel directory, plant assignments, and workforce asset allocations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Users size={16} /> Directory View
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_EMPLOYEE());
                setModalOpen(true);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <Plus size={16} /> Add Employee
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Workforce */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Workforce</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{stats.total}</span>
              <span className="text-xs font-bold text-slate-500">Employees</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                <UserCheck size={12} /> {stats.active} Active
              </span>
              {stats.inactive > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  <UserX size={12} /> {stats.inactive} Inactive
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Assigned Assets */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Allocated Assets</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Laptop size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-950">{stats.totalAssignedAssets}</span>
              <span className="text-xs font-bold text-slate-500">Items Deployed</span>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Assigned across all departments</span>
            </div>
          </div>

          {/* Card 3: Asset Equipping Rate */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Equipped Personnel</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{stats.equippedRate}%</span>
              <span className="text-xs font-bold text-emerald-600">Equipped</span>
            </div>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.equippedRate}%` }}
              />
            </div>
          </div>

          {/* Card 4: Unallocated Pool */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Asset-Free Pool</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{stats.withoutAssets}</span>
              <span className="text-xs font-bold text-slate-500">Personnel</span>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
              <Clock size={13} className="text-amber-500" />
              <span>Available for hardware allotment</span>
            </div>
          </div>
        </div>

        {/* Breakdown Section: Departments & Plants */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Breakdown (2 cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">Department Headcount &amp; Assets</h2>
                <p className="text-xs text-slate-500 mt-0.5">Top departments by staff count and assigned equipment</p>
              </div>
              <Building2 size={18} className="text-slate-400" />
            </div>

            <div className="space-y-4">
              {stats.topDepts.map((dept) => {
                const percent = stats.total > 0 ? Math.round((dept.count / stats.total) * 100) : 0;
                return (
                  <div key={dept.name} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                      <span className="font-black text-slate-900">{dept.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] font-black">
                          {dept.count} Members ({percent}%)
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {dept.assets} Assets
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plant Distribution (1 col) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">Plant Allocation</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Staff headcount per plant unit</p>
                </div>
                <MapPin size={18} className="text-slate-400" />
              </div>

              <div className="space-y-3">
                {stats.plantBreakdown.map((plant) => {
                  const percent = stats.total > 0 ? Math.round((plant.count / stats.total) * 100) : 0;
                  return (
                    <div key={plant.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs font-black text-slate-900">Plant {plant.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{percent}% of workforce</p>
                      </div>
                      <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {plant.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/employees')}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <span>View Full Employee List</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Employees Table */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Quick Directory Search</h2>
              <p className="text-xs text-slate-500 mt-0.5">Access and manage individual employee profiles</p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, ID or dept..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Plant</th>
                  <th className="px-4 py-3">Corporate Email</th>
                  <th className="px-4 py-3 text-center">Assets Held</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentEmployees.map((emp) => {
                  const count = assetsForEmployee(assets, emp).length;
                  return (
                    <tr
                      key={emp.employeeId}
                      onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">{emp.employeeId}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{emp.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-semibold">{emp.department || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{emp.plant || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{emp.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black text-[11px]">
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            !isInactiveEmployee(emp.status)
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {emp.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
