import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Search,
  User,
  RefreshCw,
  LayoutGrid,
  List,
  Filter,
  Building2,
  Users as UsersIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Download,
  CheckCircle2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useEmployees } from '../hooks/useEmployees';
import { useApp } from '../context/AppProvider';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee, employeeStatusLabel } from '../lib/employeeStatus';
import type { Employee, EmployeeStatus } from '../types/employee';
import { EMPTY_EMPLOYEE } from '../types/employee';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import * as XLSX from 'xlsx';

type StatusFilter = 'all' | 'Active' | 'Inactive';

const PAGE_SIZE = 12;

function isInactiveStatus(status: string | undefined): boolean {
  return isInactiveEmployee(status);
}

function employeeMatchesSearch(employee: Employee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    employee.employeeId.toLowerCase().includes(q) ||
    employee.name.toLowerCase().includes(q) ||
    employee.email.toLowerCase().includes(q) ||
    (employee.department || '').toLowerCase().includes(q) ||
    (employee.designation || '').toLowerCase().includes(q)
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, assets } = useApp();
  const { employees, loading, refresh } = useEmployees();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const isAdmin = user?.role === 'IT Admin' || user?.role === 'Admin';
  const isHr = user?.role === 'HR';
  const canView = isAdmin || isHr;

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      try {
        const draft = sessionStorage.getItem('assestflow_new_employee_draft');
        if (draft) {
          setForm(JSON.parse(draft) as Employee);
          sessionStorage.removeItem('assestflow_new_employee_draft');
        }
      } catch {
        /* ignore */
      }
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Unique departments & plants for filter dropdown
  const { departments, plants } = useMemo(() => {
    const dSet = new Set<string>();
    const pSet = new Set<string>();
    employees.forEach((e) => {
      if (e.department) dSet.add(e.department.trim());
      if (e.plant) pSet.add(e.plant.trim());
    });
    return {
      departments: Array.from(dSet).sort(),
      plants: Array.from(pSet).sort(),
    };
  }, [employees]);

  const activeCount = useMemo(
    () => employees.filter((e) => !isInactiveStatus(e.status)).length,
    [employees]
  );

  const filtered = useMemo(() => {
    let list = employees;

    if (statusFilter === 'Active') {
      list = list.filter((e) => !isInactiveStatus(e.status));
    } else if (statusFilter === 'Inactive') {
      list = list.filter((e) => isInactiveStatus(e.status));
    }

    if (departmentFilter !== 'all') {
      list = list.filter((e) => String(e.department || '').trim().toLowerCase() === departmentFilter.toLowerCase());
    }

    if (plantFilter !== 'all') {
      list = list.filter((e) => String(e.plant || '').trim().toLowerCase() === plantFilter.toLowerCase());
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => employeeMatchesSearch(e, q));
    }

    return list;
  }, [employees, search, statusFilter, departmentFilter, plantFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, departmentFilter, plantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const exportExcel = () => {
    try {
      const data = filtered.map((emp) => ({
        'Employee ID': emp.employeeId,
        'Name': emp.name,
        'Department': emp.department || '',
        'Designation': emp.designation || '',
        'Email': emp.email || '',
        'Phone': emp.phone || '',
        'Location': emp.location || '',
        'Plant': emp.plant || '',
        'Status': emp.status || 'Active',
        'Assigned Assets Count': assetsForEmployee(assets, emp).length,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      XLSX.writeFile(wb, `Employees_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Directory exported to Excel');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 min-h-screen">
      {/* Top Header & Search Bar - Compact & Sleek */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-3.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              Employees
            </h1>
            {/* Badges inline */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                <Building2 size={12} />
                <span>Department: IT &amp; Operations</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                <UsersIcon size={12} />
                <span>{activeCount} Active</span>
              </span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Table View"
              >
                <List size={15} />
              </button>
            </div>

            {/* Sync Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                toast.promise(
                  refresh(true),
                  {
                    loading: 'Syncing employee directory...',
                    success: 'Sync complete',
                    error: 'Sync failed',
                  },
                  { id: 'sync-employees' }
                );
              }}
              className={`px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200/80 ${
                loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span>Sync Directory</span>
            </button>

            {/* Add Employee Button */}
            {!isHr && (
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY_EMPLOYEE());
                  setModalOpen(true);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs shadow-blue-500/20"
              >
                <Plus size={15} />
                <span>Add Employee</span>
              </button>
            )}

            {/* Export Menu */}
            <button
              type="button"
              onClick={exportExcel}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200/80"
              title="Export to Excel"
            >
              <Download size={15} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-3 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, or corporate email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200/80 transition-all"
            />
          </div>

          {/* Quick Status Filters */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            {(['all', 'Active', 'Inactive'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === status
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>

          {/* Dropdown Filters (Department & Plant) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                departmentFilter !== 'all' || plantFilter !== 'all'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
              }`}
            >
              <Filter size={14} />
              <span>
                {departmentFilter !== 'all' || plantFilter !== 'all'
                  ? 'Filtered'
                  : 'Filter'}
              </span>
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl p-4 shadow-xl border border-slate-200 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Refine Directory</span>
                  {(departmentFilter !== 'all' || plantFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setDepartmentFilter('all');
                        setPlantFilter('all');
                      }}
                      className="text-[11px] text-blue-600 hover:underline font-bold"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Department</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Plant Code</label>
                  <select
                    value={plantFilter}
                    onChange={(e) => setPlantFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Plants</option>
                    {plants.map((p) => (
                      <option key={p} value={p}>Plant {p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {loading && employees.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto shadow-sm">
            <User className="mx-auto mb-3 text-slate-300" size={48} />
            <p className="font-black text-slate-800 text-lg">No employees found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or clear active filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View - Matching Image 1 Perfectly */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
            {paginatedEmployees.map((emp) => {
              const count = assetsForEmployee(assets, emp).length;
              const isInactive = isInactiveStatus(emp.status);
              return (
                <div
                  key={emp.employeeId}
                  onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                  className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  {/* Top info */}
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                      {emp.employeeId}
                    </span>
                    <h3 className="font-black text-slate-900 text-base mt-1 tracking-tight leading-snug truncate">
                      {emp.name}
                    </h3>
                    <p className="text-[11px] font-black uppercase text-slate-400 mt-2.5 tracking-wider truncate">
                      {emp.department || 'GENERAL'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {emp.email || '—'}
                    </p>
                  </div>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                      {count} {count === 1 ? 'asset' : 'assets'}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider ${
                        !isInactive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {employeeStatusLabel(emp.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">Designation</th>
                    <th className="px-5 py-3.5">Corporate Email</th>
                    <th className="px-5 py-3.5">Plant</th>
                    <th className="px-5 py-3.5 text-center">Assets</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedEmployees.map((emp) => {
                    const count = assetsForEmployee(assets, emp).length;
                    const isInactive = isInactiveStatus(emp.status);
                    return (
                      <tr
                        key={emp.employeeId}
                        onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-blue-700">{emp.employeeId}</td>
                        <td className="px-5 py-3.5 font-black text-slate-900">{emp.name}</td>
                        <td className="px-5 py-3.5 text-slate-600 font-semibold">{emp.department || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-500">{emp.designation || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-500 truncate max-w-[200px]">{emp.email}</td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono">{emp.plant || '—'}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black text-[11px]">
                            {count}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              !isInactive
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
        )}

        {/* Bottom Pagination Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900 font-black">{paginatedEmployees.length}</span> of{' '}
            <span className="text-slate-900 font-black">{filtered.length}</span> employees
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
              .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
              .map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
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
