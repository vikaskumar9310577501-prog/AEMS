import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Filter,
  Briefcase,
  Building2,
  MapPin,
  Laptop,
  Smartphone,
  Monitor,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  History,
  CheckCircle2,
  ExternalLink,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee } from '../lib/employeeStatus';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { EMPTY_EMPLOYEE, type Employee } from '../types/employee';
import { toast } from 'react-hot-toast';

const PAGE_SIZE = 8;

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const { assets, user } = useApp();
  const { employees, loading, refresh } = useEmployees();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => !isInactiveEmployee(e.status)).length;
    const inactive = total - active;

    let totalAssignedAssets = 0;
    employees.forEach((emp) => {
      totalAssignedAssets += assetsForEmployee(assets, emp).length;
    });

    return {
      total,
      active,
      inactive,
      totalAssignedAssets,
    };
  }, [employees, assets]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (statusFilter === 'Active') {
      list = list.filter((e) => !isInactiveEmployee(e.status));
    } else if (statusFilter === 'Inactive') {
      list = list.filter((e) => isInactiveEmployee(e.status));
    }

    if (departmentFilter !== 'All') {
      list = list.filter((e) => String(e.department || '').trim().toLowerCase() === departmentFilter.toLowerCase());
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

    return list;
  }, [employees, search, statusFilter, departmentFilter]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  const getAssetTypePills = (emp: Employee) => {
    const empAssets = assetsForEmployee(assets, emp);
    if (empAssets.length === 0) {
      return <span className="text-slate-400 text-xs italic">No assets assigned</span>;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {empAssets.slice(0, 3).map((a, i) => {
          const text = `${a.mainCategory || ''} ${a.subCategory || ''} ${a.assetName || ''}`.toLowerCase();
          const isLaptop = text.includes('laptop') || text.includes('macbook');
          const isPhone = text.includes('mobile') || text.includes('phone') || text.includes('tablet');
          const isMonitor = text.includes('monitor') || text.includes('screen') || text.includes('display');

          return (
            <span
              key={a.id || i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/80 text-blue-700 text-xs font-bold border border-blue-100"
            >
              {isLaptop && <Laptop size={13} className="text-blue-600" />}
              {isPhone && <Smartphone size={13} className="text-indigo-600" />}
              {isMonitor && <Monitor size={13} className="text-cyan-600" />}
              {!isLaptop && !isPhone && !isMonitor && <Laptop size={13} className="text-blue-600" />}
              <span>{a.subCategory || a.assetName || 'Hardware'}</span>
            </span>
          );
        })}
        {empAssets.length > 3 && (
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            +{empAssets.length - 3} more
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/60 min-h-screen">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Title & Actions (Matching Screenshot) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              HR Asset Assignment
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage employee identities and track hardware assignments across your global organization.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-2xs flex items-center gap-2"
            >
              <Clock size={14} className="text-slate-500" />
              <span>Audit Logs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_EMPLOYEE());
                setModalOpen(true);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-blue-500/20 flex items-center gap-2"
            >
              <UserPlus size={15} />
              <span>Onboard Employee</span>
            </button>
          </div>
        </div>

        {/* 4 Top KPI Stat Cards (Matching Screenshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {/* Card 1: TOTAL EMPLOYEES */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL EMPLOYEES
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-black">
                <TrendingUp size={13} /> +12%
              </span>
              <span className="text-slate-400 font-bold uppercase text-[10px]">vs last month</span>
            </div>
          </div>

          {/* Card 2: ASSETS ASSIGNED */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  ASSETS ASSIGNED
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.totalAssignedAssets}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-black">
                <TrendingUp size={13} /> +9.2%
              </span>
              <span className="text-slate-400 font-bold uppercase text-[10px]">vs last month</span>
            </div>
          </div>

          {/* Card 3: ACTIVE STAFF */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  ACTIVE STAFF
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.active}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <UserCheck size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className="text-emerald-600 font-bold text-[11px]">Active in organization</span>
            </div>
          </div>

          {/* Card 4: INACTIVE RECORDS */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  INACTIVE RECORDS
                </span>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.inactive}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <UserX size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-black">
                <TrendingDown size={13} /> -2%
              </span>
              <span className="text-slate-400 font-bold uppercase text-[10px]">vs last month</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls (Matching Screenshot) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Employee ID, Email, Dept, or Plant..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200 transition-all"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          {/* Department Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Header (Matching Screenshot) */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-blue-600 rounded-full" />
            <h2 className="text-base font-black text-slate-900 tracking-tight">Employee Directory</h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
              {filteredEmployees.length} records
            </span>
          </div>

          <div className="text-xs text-slate-400 font-semibold hidden sm:block">
            Sort by: <span className="text-slate-700 font-bold">Recently Active</span>
          </div>
        </div>

        {/* Employee Cards List (Exact Match to Screenshot Cards) */}
        <div className="space-y-3">
          {paginatedEmployees.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 shadow-2xs">
              <Users className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-black text-slate-800 text-base">No matching employee records</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing your search query or filters.</p>
            </div>
          ) : (
            paginatedEmployees.map((emp) => {
              const isInactive = isInactiveEmployee(emp.status);
              return (
                <div
                  key={emp.employeeId}
                  className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                >
                  {/* Left Column: Avatar + Name + ID + Email */}
                  <div
                    onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                    className="flex items-center gap-3.5 min-w-[260px] cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-xs flex items-center justify-center font-black text-sm text-slate-600">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{emp.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {/* Status indicator dot */}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          !isInactive ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors truncate">
                        {emp.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span className="font-mono font-bold text-slate-600">{emp.employeeId}</span>
                        <span>•</span>
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">{emp.email || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column 1: Department & Plant */}
                  <div
                    onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                    className="min-w-[180px] text-xs cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{emp.department || 'General'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>
                        {emp.location || 'BHIWADI'} - {emp.plant || '4020'}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column 2: ASSIGNED ASSETS */}
                  <div className="min-w-[220px]">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                      ASSIGNED ASSETS
                    </span>
                    {getAssetTypePills(emp)}
                  </div>

                  {/* Right Column: Status Badge & Options */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <span
                      className={`text-[11px] font-black uppercase px-3.5 py-1 rounded-full tracking-wider ${
                        !isInactive
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {emp.status || 'ACTIVE'}
                    </span>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === emp.employeeId ? null : emp.employeeId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {activeMenuId === emp.employeeId && (
                        <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs font-bold text-slate-700">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              navigate(`/employees/${encodeURIComponent(emp.employeeId)}`);
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                          >
                            <ExternalLink size={13} className="text-blue-600" />
                            <span>View Profile</span>
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

        {/* Bottom Pagination (Matching Screenshot) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-bold">
            Showing <span className="text-slate-900 font-black">{paginatedEmployees.length}</span> of{' '}
            <span className="text-slate-900 font-black">{filteredEmployees.length}</span> results
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                      ? 'bg-blue-600 text-white shadow-xs'
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
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>

        {/* Footer (Matching Screenshot) */}
        <div className="pt-6 pb-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 font-medium">
          <p>© 2026 A.E.M.S Enterprise — Human Resources Module</p>
          <div className="flex items-center gap-4">
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <span className="hover:underline cursor-pointer">Data Retention Policy</span>
            <span className="hover:underline cursor-pointer">Security Center</span>
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
