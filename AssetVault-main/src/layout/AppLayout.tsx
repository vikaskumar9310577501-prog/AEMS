import React, { useEffect, useState } from 'react';
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
  X,
} from 'lucide-react';
import { APP_NAME, LOGO_SRC } from '../lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import { canAccessUserManagement, canAccessMaintenance, isItAdminRole, isHrRole, isAdminRole } from '../lib/userPermissions';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerPortalNode, setHeaderPortalNode] = useState<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  if (!user) return null;

  const selectedCategory = searchParams.get('category') || 'All';
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';
  const isMaintenance = location.pathname.startsWith('/maintenance');
  const isAdminRole = canAccessUserManagement(user.role);
  const isItAdmin = isItAdminRole(user.role);
  const isHr = isHrRole(user.role);
  const hideAllDashboard =
    user.role !== 'IT Admin' &&
    user.categories &&
    user.categories.length > 0 &&
    !user.categories.includes('All');

  const closeSidebar = () => setSidebarOpen(false);

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
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-white">
      <header className="bg-[#113355] border-b border-[#0b2744] h-[68px] flex items-center px-3 sm:px-4 justify-between shrink-0 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors shrink-0"
            title={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white rounded-xl px-3 py-1.5 h-[52px] shadow-sm shrink-0 flex items-center justify-center">
              <img src={`${LOGO_SRC}?v=2`} alt="PG Electroplast" className="h-10 w-auto max-w-[140px] object-contain" />
            </div>
            <div className="min-w-0 flex items-center gap-3">
              <div className="min-w-0 flex flex-col justify-center w-fit">
                <h1 className="font-bold text-white text-sm sm:text-base md:text-lg tracking-tight whitespace-nowrap leading-none">
                  A.E.M.S
                </h1>
                <div className="w-full flex flex-col gap-[2px] my-1">
                  <div className="w-full h-[1px] bg-white/40" />
                  <div className="w-full h-[1px] bg-white/40" />
                </div>
                <p className="text-[10px] sm:text-[11px] md:text-xs font-medium text-slate-300 whitespace-nowrap leading-none">
                  Asset Entry Management System
                </p>
              </div>
              {isMaintenance ? (
                <div className="flex items-center shrink-0 border-l border-white/20 pl-3 self-center">
                  <span className="font-semibold text-sky-100 text-xs sm:text-sm whitespace-nowrap">
                    Preventive Set-up
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          ref={setHeaderPortalNode}
          id="portal-header-root"
          className="flex-1 h-full flex items-center justify-end gap-3 min-w-0"
        >
          {!isDashboard && !isMaintenance && (
            <div className="flex items-center gap-3 text-white text-xs font-bold">
              <span className="hidden sm:inline text-slate-300">{user.email} ({user.role})</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/25 z-30 border-0 cursor-default"
            aria-label="Close sidebar overlay"
            onClick={closeSidebar}
          />
        )}

        <aside
          onMouseLeave={closeSidebar}
          className={`absolute left-0 top-0 bottom-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col shadow-xl transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
            {!hideAllDashboard && !isHr && (
              <NavLink
                to="/dashboard"
                end
                onClick={closeSidebar}
                className={({ isActive }) => navClass({ isActive: isActive && selectedCategory === 'All' })}
                title="Dashboard"
              >
                <LayoutDashboard size={18} className="shrink-0" />
                <span>Dashboard</span>
              </NavLink>
            )}

            {!isHr && (
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
                  onClick={() => {
                    navigate(`/dashboard${categoryToQuery(cat)}`);
                    closeSidebar();
                  }}
                  title={cat}
                >
                  <Icon size={16} className={active ? 'text-[#113355] shrink-0' : 'text-slate-500 shrink-0'} />
                  <span className="truncate">{cat.replace(' / ', '/')}</span>
                </button>
              );
            })}

            <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase text-slate-400 tracking-[0.18em]">
              Management
            </div>

            {(isAdminRole || isHr) && (
              <NavLink to="/employees" className={navClass} title="Employees" onClick={closeSidebar}>
                <UserCircle size={18} className="shrink-0" />
                <span>Employees</span>
              </NavLink>
            )}
            {MISSING_ITEMS_FEATURE_ENABLED && !isHr && (
              <NavLink to="/missing" className={navClass} title="Missing Items" onClick={closeSidebar}>
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <span>Missing Items</span>
              </NavLink>
            )}
            {!isHr && (
              <NavLink to="/damaged-scrap" className={navClass} title="Damaged / Scrap" onClick={closeSidebar}>
                <Trash2 size={18} className="text-red-650 shrink-0" />
                <span>Damaged / Scrap</span>
              </NavLink>
            )}
            {canAccessMaintenance(user.role, user.categories) && (
              <NavLink to="/maintenance" className={navClass} title="Preventive Set-up (PM)" onClick={closeSidebar}>
                <Wrench size={18} className="text-slate-600 shrink-0" />
                <span>Preventive Set-up</span>
              </NavLink>
            )}
            {isAdminRole && !isHr && (
              <NavLink to="/users" className={navClass} title="User Management" onClick={closeSidebar}>
                <Users size={18} className="shrink-0" />
                <span>User Management</span>
              </NavLink>
            )}
            {isItAdmin && !isHr && (
              <NavLink to="/settings" className={navClass} title="Settings" onClick={closeSidebar}>
                <Settings size={18} className="shrink-0" />
                <span>Settings</span>
              </NavLink>
            )}
          </nav>

          <div className="p-4 border-t border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-950 truncate">{user.email}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{user.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-100 text-slate-700 hover:text-red-600 text-xs font-bold transition-all"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet context={{ headerPortalNode }} />
        </main>
      </div>
    </div>
  );
}
