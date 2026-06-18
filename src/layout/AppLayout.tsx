import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Users,
  UserCircle,
  Settings,
  Menu,
  Cpu,
  Sofa,
  Zap,
  Factory,
  ShieldAlert,
  Car,
  FileText,
  Building2,
  Wrench,
  Table as TableIcon,
  AlertTriangle,
  Camera as CameraIcon,
  Video as VideoIcon,
  Trash2,
} from 'lucide-react';
import { APP_NAME, LOGO_SRC } from '../lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import { canAccessUserManagement, isItAdminRole, isHrRole } from '../lib/userPermissions';
import { SIDEBAR_CCTV_CATEGORY } from '../lib/dashboardCategories';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'IT Assets': Cpu,
  [SIDEBAR_CCTV_CATEGORY]: CameraIcon,
  Camera: CameraIcon,
  NVR: VideoIcon,
  'Office Assets': Sofa,
  'Electrical Assets': Zap,
  'Production Assets': Factory,
  'Safety Assets': ShieldAlert,
  'Vehicle Assets': Car,
  'Furniture Assets': TableIcon,
  'Software / License Assets': FileText,
  'Admin / Facility Assets': Building2,
  'Maintenance Assets': Wrench,
};

function categoryToQuery(cat: string) {
  return cat === 'All' ? '' : `?category=${encodeURIComponent(cat)}`;
}

export default function AppLayout() {
  const { user, handleLogout, visibleCategories } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  if (!user) return null;

  const selectedCategory = searchParams.get('category') || 'All';
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';
  const isAdminRole = canAccessUserManagement(user.role);
  const isItAdmin = isItAdminRole(user.role);
  const isHr = isHrRole(user.role);
  const hideAllDashboard =
    user.role !== 'IT Admin' &&
    user.categories &&
    user.categories.length > 0 &&
    !user.categories.includes('All');

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
      isActive
        ? 'bg-[#eaf2fb] text-[#113355] border border-[#d8e7f6] shadow-sm'
        : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-950'
    }`;

  const categoryNavClass = (cat: string) => {
    const active = isDashboard && selectedCategory === cat;
    return `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
      active
        ? 'bg-[#eef5ff] text-[#113355] border border-[#d9e8f8] shadow-sm'
        : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-950'
    }`;
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans">
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? 'w-[5.5rem]' : 'w-72'
        }`}
      >
        <div
          className={`relative border-b flex ${
            sidebarCollapsed
              ? 'flex-col items-center gap-4 border-gray-200 p-4 py-5'
              : 'min-h-[109px] items-center border-[#0b2744] bg-[#113355] px-4 py-4 pr-12'
          }`}
        >
          {sidebarCollapsed ? (
            <>
              <img
                src={LOGO_SRC}
                alt={APP_NAME}
                className="object-contain shrink-0 w-16 h-16 logo-sidebar-pulse transition-all"
              />
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors shrink-0"
                title="Expand menu"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-16 w-16 bg-white rounded-lg shadow-sm shrink-0 flex items-center justify-center">
                  <img
                    src={LOGO_SRC}
                    alt={APP_NAME}
                    className="object-contain w-12 h-12 logo-sidebar-pulse transition-all"
                  />
                </div>
                <div className="min-w-0 w-[145px] leading-tight">
                  <p className="w-[92px] text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/70">PG Group</p>
                  <p className="mt-1 text-[15px] font-black text-white leading-[1.08] tracking-normal">
                    <span className="block">Asset Entry</span>
                    <span className="block">Management</span>
                    <span className="block pl-2">System</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 text-white transition-colors shrink-0"
                title="Collapse menu"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
          {!hideAllDashboard && !isHr && (
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => navClass({ isActive: isActive && selectedCategory === 'All' })}
              title="Dashboard"
            >
              <LayoutDashboard size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </NavLink>
          )}

          {!sidebarCollapsed && !isHr && (
            <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase text-slate-400 tracking-[0.18em]">
              Categories
            </div>
          )}

          {!isHr && visibleCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Cpu;
            const active = isDashboard && selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                className={categoryNavClass(cat)}
                onClick={() => navigate(`/dashboard${categoryToQuery(cat)}`)}
                title={cat}
              >
                <Icon size={16} className={active ? 'text-[#113355] shrink-0' : 'text-slate-500 shrink-0'} />
                {!sidebarCollapsed && (
                  <span className="truncate">{cat.replace(' / ', '/')}</span>
                )}
              </button>
            );
          })}

          {!sidebarCollapsed && (
            <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase text-slate-400 tracking-[0.18em]">
              Management
            </div>
          )}

          {(isAdminRole || isHr) && (
            <NavLink to="/employees" className={navClass} title="Employees">
              <UserCircle size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Employees</span>}
            </NavLink>
          )}
          {MISSING_ITEMS_FEATURE_ENABLED && !isHr && (
            <NavLink to="/missing" className={navClass} title="Missing Items">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              {!sidebarCollapsed && <span>Missing Items</span>}
            </NavLink>
          )}
          {!isHr && (
            <NavLink to="/damaged-scrap" className={navClass} title="Damaged / Scrap">
              <Trash2 size={18} className="text-red-650 shrink-0" />
              {!sidebarCollapsed && <span>Damaged / Scrap</span>}
            </NavLink>
          )}
          {isAdminRole && !isHr && (
            <NavLink to="/users" className={navClass} title="User Management">
              <Users size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>User Management</span>}
            </NavLink>
          )}
          {isItAdmin && !isHr && (
            <NavLink to="/settings" className={navClass} title="Settings">
              <Settings size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-950 truncate">{user.email}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{user.role}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-100 text-slate-700 hover:text-red-600 text-xs font-bold transition-all"
          >
            <LogOut size={14} />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
