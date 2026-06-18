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
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
      isActive ? 'bg-blue-100 text-black shadow-sm' : 'text-gray-600 hover:bg-gray-200 hover:text-black'
    }`;

  const categoryNavClass = (cat: string) => {
    const active = isDashboard && selectedCategory === cat;
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
      active
        ? 'bg-blue-50 text-blue-700 shadow-sm border-l-4 border-blue-600 rounded-l-none'
        : 'text-gray-600 hover:bg-gray-200 hover:text-black'
    }`;
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans">
      <aside
        className={`bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? 'w-[5.5rem]' : 'w-72'
        }`}
      >
        <div
          className={`p-4 border-b border-gray-200 flex ${
            sidebarCollapsed ? 'flex-col items-center gap-4 py-5' : 'items-center justify-between gap-3'
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
                className="p-2 rounded-lg hover:bg-gray-200 text-black transition-colors shrink-0"
                title="Expand menu"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center min-w-0">
                <img
                  src={LOGO_SRC}
                  alt={APP_NAME}
                  className="object-contain shrink-0 w-32 h-24 logo-sidebar-pulse transition-all"
                />
                <div className="mt-2 text-center leading-tight">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-600">PG Group</p>
                  <p className="mt-1 text-[11px] font-black text-slate-900 max-w-[180px]">
                    {APP_NAME}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-200 text-black transition-colors shrink-0"
                title="Collapse menu"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {!hideAllDashboard && !isHr && (
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => navClass({ isActive: isActive && selectedCategory === 'All' })}
              title="Dashboard"
            >
              <LayoutDashboard size={18} className="text-black shrink-0" />
              {!sidebarCollapsed && <span className="text-black">Dashboard</span>}
            </NavLink>
          )}

          {!sidebarCollapsed && !isHr && (
            <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase text-gray-400 tracking-wider">
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
                <Icon size={16} className={active ? 'text-blue-600 shrink-0' : 'text-gray-500 shrink-0'} />
                {!sidebarCollapsed && (
                  <span className="truncate">{cat.replace(' / ', '/')}</span>
                )}
              </button>
            );
          })}

          {!sidebarCollapsed && (
            <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase text-gray-400 tracking-wider">
              Management
            </div>
          )}

          {(isAdminRole || isHr) && (
            <NavLink to="/employees" className={navClass} title="Employees">
              <UserCircle size={18} className="text-gray-700 shrink-0" />
              {!sidebarCollapsed && <span className="text-gray-800">Employees</span>}
            </NavLink>
          )}
          {!isHr && (
            <NavLink to="/missing" className={navClass} title="Missing Items">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              {!sidebarCollapsed && <span className="text-gray-800">Missing Items</span>}
            </NavLink>
          )}
          {!isHr && (
            <NavLink to="/damaged-scrap" className={navClass} title="Damaged / Scrap">
              <Trash2 size={18} className="text-red-650 shrink-0" />
              {!sidebarCollapsed && <span className="text-gray-800">Damaged / Scrap</span>}
            </NavLink>
          )}
          {isAdminRole && !isHr && (
            <NavLink to="/users" className={navClass} title="User Management">
              <Users size={18} className="text-gray-700 shrink-0" />
              {!sidebarCollapsed && <span className="text-gray-800">User Management</span>}
            </NavLink>
          )}
          {isItAdmin && !isHr && (
            <NavLink to="/settings" className={navClass} title="Settings">
              <Settings size={18} className="text-gray-700 shrink-0" />
              {!sidebarCollapsed && <span className="text-gray-800">Settings</span>}
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-black truncate">{user.email}</p>
                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">{user.role}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 text-xs font-bold transition-all"
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
