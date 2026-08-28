import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext, Navigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Filter,
  Briefcase,
  Laptop,
  Smartphone,
  Monitor,
  HardDrive,
  Building2,
  MapPin,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee } from '../lib/employeeStatus';
import { canAccessHr } from '../lib/userPermissions';
import HrKpiModal, { HrKpiType } from '../components/HrKpiModal';

const PAGE_SIZE = 8;

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const { assets, user } = useApp();
  const { employees } = useEmployees();
  const { headerPortalNode } = useOutletContext<{ headerPortalNode: HTMLDivElement | null }>() || {};

  if (!user || !canAccessHr(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'assets' | 'id'>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuEmployeeId, setActiveMenuEmployeeId] = useState<string | null>(null);
  const [activeKpiModal, setActiveKpiModal] = useState<HrKpiType | null>(null);

  // Department list for dropdown
  const departments = useMemo(() => {
    const dSet = new Set<string>();
    employees.forEach((e) => {
      if (e.department) dSet.add(e.department.trim());
    });
    return Array.from(dSet).sort();
  }, [employees]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => !isInactiveEmployee(e.status)).length;
    const inactive = total - active;

    let totalAssignedAssets = 0;
    employees.forEach((emp) => {
      const empAssets = assetsForEmployee(assets, emp);
      totalAssignedAssets += empAssets.length;
    });

    return {
      total,
      active,
      inactive,
      totalAssignedAssets,
    };
  }, [employees, assets]);

  // Filtered & Sorted Employees
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (statusFilter === 'Active') {
      list = list.filter((e) => !isInactiveEmployee(e.status));
    } else if (statusFilter === 'Inactive') {
      list = list.filter((e) => isInactiveEmployee(e.status));
    }

    if (selectedDept !== 'all') {
      list = list.filter(
        (e) => String(e.department || '').trim().toLowerCase() === selectedDept.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q) ||
          (e.plant || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'assets') {
      list = [...list].sort(
        (a, b) => assetsForEmployee(assets, b).length - assetsForEmployee(assets, a).length
      );
    } else if (sortBy === 'id') {
      list = [...list].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
    }

    return list;
  }, [employees, assets, statusFilter, selectedDept, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  const getDeviceBadge = (asset: (typeof assets)[number]) => {
    const text = `${asset.mainCategory || ''} ${asset.subCategory || ''} ${asset.assetName || ''}`.toLowerCase();
    if (text.includes('laptop')) {
      return { label: 'Laptop', icon: Laptop, color: 'text-blue-700 bg-blue-100 border-blue-200' };
    }
    if (text.includes('mobile') || text.includes('phone') || text.includes('tablet')) {
      return { label: 'Mobile', icon: Smartphone, color: 'text-slate-800 bg-slate-200 border-slate-300' };
    }
    if (text.includes('monitor') || text.includes('display') || text.includes('screen')) {
      return { label: 'Monitor', icon: Monitor, color: 'text-indigo-700 bg-indigo-100 border-indigo-200' };
    }
    return { label: asset.subCategory || asset.mainCategory || 'Hardware', icon: HardDrive, color: 'text-slate-700 bg-slate-100 border-slate-200' };
  };

  const portalTarget = headerPortalNode || (typeof document !== 'undefined' ? document.getElementById('portal-header-root') : null);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#F8F6F0] min-h-screen text-slate-900">
      {/* Top Header Portal: Search Bar, All Status, Departments, User Info */}
      {portalTarget &&
        createPortal(
          <div className="flex items-center gap-2.5 max-w-full overflow-x-auto scrollbar-none py-1">
            {/* Search Input in Top Header */}
            <div className="relative min-w-[180px] sm:w-60 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200" size={14} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search staff, ID, Dept, Plant..."
                className="w-full pl-9 pr-3 py-1.5 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder-blue-200/70 focus:placeholder-slate-400 rounded-xl text-xs border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            {/* Status Filter Dropdown in Top Header */}
            <div className="relative shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs font-bold text-white">
                <Filter size={12} className="text-blue-200" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-white focus:outline-none cursor-pointer pr-1 [&>option]:text-slate-900 [&>option]:bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Departments Dropdown in Top Header */}
            <div className="relative shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs font-bold text-white">
                <Briefcase size={12} className="text-blue-200" />
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-white focus:outline-none cursor-pointer pr-1 max-w-[130px] [&>option]:text-slate-900 [&>option]:bg-white"
                >
                  <option value="all">Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* User Badge */}
            {user && (
              <div className="hidden xl:flex items-center gap-2 text-white text-xs font-bold pl-2 border-l border-white/20 shrink-0">
                <span className="text-blue-200/80 font-medium truncate max-w-[140px]">{user.email}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/15 text-white border border-white/25 text-[10px] uppercase font-black">
                  {user.role}
                </span>
              </div>
            )}
          </div>,
          portalTarget
        )}

      {/* Custom Heartbeat Keyframes Style */}
      <style>{`
        @keyframes hrHeartbeat {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
          15% { transform: scale(1.025); box-shadow: 0 0 14px 3px rgba(225, 29, 72, 0.28); }
          30% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
          45% { transform: scale(1.02); box-shadow: 0 0 10px 2px rgba(225, 29, 72, 0.2); }
          60% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
        }
        .animate-heartbeat-subtle {
          animation: hrHeartbeat 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* STICKY TOP COMPACT KPI CARDS */}
      <div className="sticky top-0 z-20 bg-[#F8F6F0]/95 backdrop-blur-md border-b border-[#E8E5DF] px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto w-full">
          {/* 4 Compact Highlighted KPI Cards with exact requested color themes and clickable modal trigger */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Card 1: TOTAL EMPLOYEES (Warm White Theme) */}
            <div
              onClick={() => setActiveKpiModal('total_employees')}
              className="bg-[#FAF8F5] border border-[#E5E0D8] hover:border-amber-400 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between group"
              title="Click to view all employees list"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 group-hover:text-amber-800 transition-colors">
                  TOTAL EMPLOYEES
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-0.5">{stats.total}</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Users size={15} />
              </div>
            </div>

            {/* Card 2: ASSETS ASSIGNED (Blue Theme) */}
            <div
              onClick={() => setActiveKpiModal('assigned_assets')}
              className="bg-[#EFF6FF] border border-[#BFDBFE] hover:border-blue-500 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between group"
              title="Click to view all assigned assets"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 group-hover:text-blue-900 transition-colors">
                  ASSETS ASSIGNED
                </span>
                <p className="text-xl sm:text-2xl font-black text-blue-950 leading-none mt-0.5">{stats.totalAssignedAssets}</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                <Laptop size={15} />
              </div>
            </div>

            {/* Card 3: ACTIVE STAFF (Green Theme) */}
            <div
              onClick={() => setActiveKpiModal('active_staff')}
              className="bg-[#ECFDF5] border border-[#A7F3D0] hover:border-emerald-500 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between group"
              title="Click to view active staff"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 group-hover:text-emerald-900 transition-colors">
                  ACTIVE STAFF
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-950 leading-none mt-0.5">{stats.active}</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                <UserCheck size={15} />
              </div>
            </div>

            {/* Card 4: INACTIVE RECORDS (Darker Red Theme + Heartbeat Animation) */}
            <div
              onClick={() => setActiveKpiModal('inactive_records')}
              className={`border-2 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                statusFilter === 'Inactive'
                  ? 'bg-rose-200 border-rose-600 ring-2 ring-rose-500'
                  : 'bg-[#FFE4E6] border-rose-400 hover:border-rose-600'
              } animate-heartbeat-subtle`}
              title="Click to view inactive records"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-800 group-hover:text-rose-950 transition-colors">
                  INACTIVE RECORDS
                </span>
                <p className="text-xl sm:text-2xl font-black text-rose-950 leading-none mt-0.5">{stats.inactive}</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                <UserX size={15} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DIRECTORY SCROLLABLE LIST */}
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-4">
        {/* Employee Directory Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Blue accent line */}
            <div className="w-1 h-5 bg-[#1e60ec] rounded-full" />
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Employee Directory
            </h2>
            <span className="text-xs font-bold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
              {filteredEmployees.length} records
            </span>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="name">Recently Active</option>
              <option value="assets">Most Assets</option>
              <option value="id">Employee ID</option>
            </select>
          </div>
        </div>

        {/* Employee Directory List Cards */}
        <div className="space-y-2.5">
          {paginatedEmployees.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 font-bold text-xs">
              No matching employees found. Try adjusting your search query or filters.
            </div>
          ) : (
            paginatedEmployees.map((emp) => {
              const empAssets = assetsForEmployee(assets, emp);
              const isInactive = isInactiveEmployee(emp.status);

              return (
                <div
                  key={emp.employeeId}
                  className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 group"
                >
                  {/* Column 1: Avatar + Name + ID + Email */}
                  <div
                    onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                    className="flex items-center gap-3 min-w-[230px] cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-black text-slate-600 text-xs">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {/* Online dot indicator */}
                      <div
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          !isInactive ? 'bg-[#10b981]' : 'bg-rose-500'
                        }`}
                      />
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-[#1e60ec] transition-colors">
                        {emp.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                        <span className="font-mono font-bold text-slate-500 text-[10px]">
                          {emp.employeeId}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] sm:max-w-[190px] text-[10px] text-slate-400">
                          {emp.email || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Department + Location/Plant */}
                  <div className="min-w-[170px] space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Building2 size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{emp.department || 'General'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="uppercase">
                        {emp.location || 'BHIWADI'} - {emp.plant || '4020'}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: ASSIGNED ASSETS */}
                  <div className="min-w-[190px] lg:flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      ASSIGNED ASSETS
                    </span>
                    {empAssets.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">no assets assigned</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {empAssets.slice(0, 3).map((a) => {
                          const badge = getDeviceBadge(a);
                          const IconComponent = badge.icon;
                          return (
                            <span
                              key={a.id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${badge.color}`}
                            >
                              <IconComponent size={12} />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })}
                        {empAssets.length > 3 && (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            +{empAssets.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 4: Status Badge */}
                  <div className="shrink-0 flex items-center justify-between lg:justify-end gap-3">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        !isInactive
                          ? 'bg-[#10b981] text-white shadow-xs'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {emp.status || 'ACTIVE'}
                    </span>

                    {/* Column 5: More Options Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuEmployeeId(
                            activeMenuEmployeeId === emp.employeeId ? null : emp.employeeId
                          );
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Options"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {activeMenuEmployeeId === emp.employeeId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs font-bold"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuEmployeeId(null);
                              navigate(`/employees/${encodeURIComponent(emp.employeeId)}`);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <ExternalLink size={13} className="text-slate-400" />
                            <span>View Full Profile</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
          <p className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900 font-black">{paginatedEmployees.length}</span> of{' '}
            <span className="text-slate-900 font-black">{filteredEmployees.length}</span> results
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 2))
              .map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    currentPage === page
                      ? 'bg-[#1e60ec] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 pb-2 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/60">
          <p>© 2026 A.E.M.S Enterprise — Human Resources Module</p>
          <div className="flex items-center gap-4 text-slate-500 font-semibold">
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <span className="hover:underline cursor-pointer">Data Retention Policy</span>
            <span className="hover:underline cursor-pointer">Security Center</span>
          </div>
        </footer>
      </div>

      {/* HR Dashboard KPI Detail Popup Modal */}
      <HrKpiModal
        isOpen={!!activeKpiModal}
        onClose={() => setActiveKpiModal(null)}
        kpiType={activeKpiModal}
        employees={employees}
        assets={assets}
        onSelectEmployee={(emp) => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
        onSelectAsset={(asset) => navigate(`/asset/${encodeURIComponent(asset.id)}`)}
      />
    </div>
  );
}
