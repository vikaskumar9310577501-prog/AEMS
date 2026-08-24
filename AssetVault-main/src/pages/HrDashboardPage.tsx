import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  UserPlus,
  Clock,
  Search,
  Filter,
  Briefcase,
  Laptop,
  Smartphone,
  Monitor,
  HardDrive,
  Building2,
  MapPin,
  Mail,
  MoreHorizontal,
  ChevronDown,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee } from '../lib/employeeStatus';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { EMPTY_EMPLOYEE, type Employee } from '../types/employee';

const PAGE_SIZE = 8;

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const { assets, user } = useApp();
  const { employees, loading, refresh } = useEmployees();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'assets' | 'id'>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [activeMenuEmployeeId, setActiveMenuEmployeeId] = useState<string | null>(null);

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
      return { label: 'Laptop', icon: Laptop, color: 'text-blue-600 bg-blue-50 border-blue-100' };
    }
    if (text.includes('mobile') || text.includes('phone') || text.includes('tablet')) {
      return { label: 'Mobile', icon: Smartphone, color: 'text-slate-700 bg-slate-100 border-slate-200' };
    }
    if (text.includes('monitor') || text.includes('display') || text.includes('screen')) {
      return { label: 'Monitor', icon: Monitor, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
    }
    return { label: asset.subCategory || asset.mainCategory || 'Hardware', icon: HardDrive, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#f8fafc] min-h-screen text-slate-900">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              HR Asset Assignment
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage employee identities and track hardware assignments across your global organization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Audit Logs Button */}
            <button
              type="button"
              onClick={() => setAuditLogsOpen(true)}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Clock size={15} className="text-slate-500" />
              <span>Audit Logs</span>
            </button>

            {/* Onboard Employee Button */}
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_EMPLOYEE());
                setModalOpen(true);
              }}
              className="px-4.5 py-2.5 bg-[#1e60ec] hover:bg-[#1550c7] text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Onboard Employee</span>
            </button>
          </div>
        </div>

        {/* 4 Metric KPI Cards - Matching Screenshot Exactly */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL EMPLOYEES */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL EMPLOYEES
                </span>
                <p className="text-3xl font-black text-slate-900 mt-2">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#1e60ec] flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <TrendingUp size={13} />
              <span>+12% VS LAST MONTH</span>
            </div>
          </div>

          {/* Card 2: ASSETS ASSIGNED */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  ASSETS ASSIGNED
                </span>
                <p className="text-3xl font-black text-slate-900 mt-2">{stats.totalAssignedAssets}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <TrendingUp size={13} />
              <span>+5.2% VS LAST MONTH</span>
            </div>
          </div>

          {/* Card 3: ACTIVE STAFF */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  ACTIVE STAFF
                </span>
                <p className="text-3xl font-black text-slate-900 mt-2">{stats.active}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <UserCheck size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span>{Math.round((stats.active / Math.max(1, stats.total)) * 100)}% active workforce</span>
            </div>
          </div>

          {/* Card 4: INACTIVE RECORDS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  INACTIVE RECORDS
                </span>
                <p className="text-3xl font-black text-slate-900 mt-2">{stats.inactive}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#fef2f2] text-[#ef4444] flex items-center justify-center">
                <UserX size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <TrendingDown size={13} />
              <span>-2% VS LAST MONTH</span>
            </div>
          </div>
        </div>

        {/* Filter Bar (Search + All Status + Departments) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Name, Employee ID, Email, Dept, or Plant..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200/80 transition-all"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                <option value="all">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Departments Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
              <Briefcase size={14} className="text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent focus:outline-none cursor-pointer pr-2 max-w-[150px]"
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
        </div>

        {/* Employee Directory Section Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            {/* Blue accent line */}
            <div className="w-1 h-5 bg-[#1e60ec] rounded-full" />
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Employee Directory
            </h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
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

        {/* Employee Directory List Cards - Matching Screenshot Rows */}
        <div className="space-y-3">
          {paginatedEmployees.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-bold text-xs">
              No matching employees found. Try adjusting your search query or filters.
            </div>
          ) : (
            paginatedEmployees.map((emp) => {
              const empAssets = assetsForEmployee(assets, emp);
              const isInactive = isInactiveEmployee(emp.status);

              return (
                <div
                  key={emp.employeeId}
                  className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4.5 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                >
                  {/* Column 1: Avatar + Name + ID + Email */}
                  <div
                    onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                    className="flex items-center gap-3.5 min-w-[240px] cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-black text-slate-600 text-sm">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {/* Online dot indicator */}
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          !isInactive ? 'bg-[#10b981]' : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900 text-sm group-hover:text-[#1e60ec] transition-colors">
                        {emp.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span className="font-mono font-bold text-slate-500 text-[11px]">
                          {emp.employeeId}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[150px] sm:max-w-[200px] text-[11px] text-slate-400">
                          {emp.email || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Department + Location/Plant */}
                  <div className="min-w-[180px] space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{emp.department || 'General'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span className="uppercase">
                        {emp.location || 'BHIWADI'} - {emp.plant || '4020'}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: ASSIGNED ASSETS */}
                  <div className="min-w-[200px] lg:flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
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
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
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
                          ? 'bg-[#10b981] text-white'
                          : 'bg-slate-200 text-slate-600'
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

      {/* Onboard Employee Modal */}
      {modalOpen && (
        <CreateEmployeeModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            refresh(true);
            setModalOpen(false);
          }}
          initialData={form}
        />
      )}

      {/* Audit Logs Modal */}
      {auditLogsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                <h3 className="text-base font-black text-slate-900">HR Operations Audit Log</h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditLogsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              {employees.slice(0, 12).map((emp, i) => (
                <div key={emp.employeeId} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{emp.name}</span>{' '}
                    <span className="font-mono text-slate-400 text-[11px]">({emp.employeeId})</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assigned to {emp.department || 'Operations'} • Plant {emp.plant || '4020'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">Recent</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditLogsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
