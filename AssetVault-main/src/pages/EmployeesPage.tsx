import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Plus, Search, User, RefreshCw } from 'lucide-react';
import { ViewModeToggle, useListViewMode } from '../components/ViewModeToggle';
import { useEmployees } from '../hooks/useEmployees';
import { useApp } from '../context/AppProvider';
import { assetsForEmployee } from '../lib/employeeAssets';
import { isInactiveEmployee, employeeStatusLabel } from '../lib/employeeStatus';
import type { Employee, EmployeeStatus } from '../types/employee';
import { EMPTY_EMPLOYEE } from '../types/employee';
import CreateEmployeeModal from '../components/CreateEmployeeModal';

type StatusFilter = 'all' | EmployeeStatus;

function isInactiveStatus(status: string | undefined): boolean {
  return isInactiveEmployee(status);
}

function employeeMatchesSearch(employee: Employee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    employee.employeeId.toLowerCase().includes(q) ||
    employee.name.toLowerCase().includes(q) ||
    employee.email.toLowerCase().includes(q)
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, assets, visibleCategories } = useApp();
  const { employees, loading, refresh } = useEmployees();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE());
  const [viewMode, setViewMode] = useListViewMode('assetvault.employees.viewMode', 'grid');

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

  const filtered = useMemo(() => {
    let list = employees;

    if (statusFilter === 'Active') {
      list = list.filter((e) => !isInactiveStatus(e.status));
    } else if (statusFilter === 'Inactive') {
      list = list.filter((e) => isInactiveStatus(e.status));
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((e) => employeeMatchesSearch(e, q));
  }, [employees, search, statusFilter]);

  const departmentLabel = useMemo(() => {
    if (isHr) return 'HR';
    if (isAdmin) return 'IT';
    return user?.role || 'User';
  }, [isAdmin, isHr, user?.role]);

  const openMatchedProfile = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;

    const exact = employees.find(
      (e) =>
        e.employeeId.toLowerCase() === q ||
        e.email.toLowerCase() === q ||
        e.name.toLowerCase() === q
    );
    if (exact) {
      navigate(`/employees/${encodeURIComponent(exact.employeeId)}`);
      return;
    }
    if (filtered.length === 1) {
      navigate(`/employees/${encodeURIComponent(filtered[0].employeeId)}`);
    }
  };

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Employees</h1>
            <p className="text-sm text-slate-500 mt-1">Directory &amp; asset assignments by employee</p>
            <p className="text-xs text-slate-500 mt-1">Department: {departmentLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          {!isHr && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  toast.promise(refresh(true), {
                    loading: 'Syncing employees...',
                    success: 'Sync complete',
                    error: 'Sync failed'
                  }, { id: 'sync-employees' });
                }}
                className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY_EMPLOYEE());
                  setModalOpen(true);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2"
              >
                <Plus size={16} /> Add employee
              </button>
            </>
          )}
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  openMatchedProfile();
                }
              }}
              placeholder="Search by employee ID, name, or email…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            {([
              ['all', 'All'],
              ['Active', 'Active'],
              ['Inactive', 'Inactive'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                  statusFilter === value
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(search || statusFilter !== 'all') && (
          <p className="mt-2 text-xs text-slate-500 font-bold">
            Showing {filtered.length} of {employees.length} employees
          </p>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {loading && employees.length === 0 ? (
          <p className="text-slate-500 font-bold animate-pulse">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <User className="mx-auto mb-3 opacity-40" size={48} />
            <p className="font-bold">No employees found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((emp) => {
              const count = assetsForEmployee(assets, emp).length;
              return (
                <button
                  key={emp.employeeId}
                  type="button"
                  onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                  className="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <p className="font-mono text-xs font-bold text-blue-700">{emp.employeeId}</p>
                  <p className="font-black text-slate-900 text-lg mt-1">{emp.name}</p>
                  <p className="text-sm text-slate-500 mt-2">{emp.department || '—'}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{emp.email}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                      {count} assets
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        !isInactiveStatus(emp.status)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {employeeStatusLabel(emp.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Employee ID</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Department</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Assets</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => {
                  const count = assetsForEmployee(assets, emp).length;
                  return (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/employees/${encodeURIComponent(emp.employeeId)}`)}
                    >
                      <td className="px-6 py-4 font-mono text-sm font-bold text-blue-700">{emp.employeeId}</td>
                      <td className="px-6 py-4 font-black text-slate-900 text-sm">{emp.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.department || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                          {count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                            !isInactiveStatus(emp.status)
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700 border border-red-100'
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
      </div>

      <CreateEmployeeModal
        open={modalOpen}
        mode="create"
        initial={form}
        onClose={() => setModalOpen(false)}
        onSaved={async (emp) => {
          setModalOpen(false);
          setForm(EMPTY_EMPLOYEE());
          await refresh(true);
          navigate(`/employees/${encodeURIComponent(emp.employeeId)}`);
        }}
      />
    </div>
  );
}
