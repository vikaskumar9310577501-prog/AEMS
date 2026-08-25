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
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { APP_NAME, LOGO_SRC } from '../lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import { canAccessUserManagement, canAccessMaintenance, isItAdminRole, isHrRole } from '../lib/userPermissions';
import { SIDEBAR_CCTV_CATEGORY } from '../lib/dashboardCategories';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'IT Assets': Cpu,
  [SIDEBAR_CCTV_CATEGORY]: CameraIcon,
  Camera: CameraIcon,
  NVR: VideoIcon,
  'Electrical Assets': Zap,
  'Production Assets': Factory,
  'Safety Assets': ShieldAlert,
  'Vehicle Assets': Car,
  'Furniture Assets': TableIcon,
  'Software / License Assets': FileText,
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
  const isUserAdmin = canAccessUserManagement(user.role);
  const isItAdmin = isItAdminRole(user.role);
  const isHr = isHrRole(user.role);
  const hideAllDashboard =
    user.role !== 'IT Admin' &&
    user.categories &&
    user.categories.length > 0 &&
    !user.categories.includes('All');

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  // Modern Light Theme Sidebar Nav Item Classes
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 group ${
      isActive
        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm shadow-blue-500/5'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-transparent'
    }`;

  const categoryNavClass = (cat: string) => {
    const active = isDashboard && selectedCategory === cat;
    return `w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group ${
      active
        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm shadow-blue-500/5'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-transparent'
    }`;
  };

  const SidebarContent = (
    <div
      onMouseEnter={openSidebar}
      onMouseLeave={closeSidebar}
      className="flex flex-col h-full bg-white text-slate-800 select-none border-r border-slate-200/90 shadow-2xl w-72"
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center gap-3.5 border-b border-slate-200/80 bg-slate-50/50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
          <Boxes size={22} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-black text-slate-900 text-base tracking-tight leading-none truncate">
            A.E.M.S
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 truncate">
            Asset Management
          </p>
        </div>
        {/* Close button */}
        <button
          type="button"
          onClick={closeSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close Sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        {isHr && (
          <NavLink
            to="/hr-dashboard"
            end
            onClick={closeSidebar}
            className={({ isActive }) => navClass({ isActive })}
            title="HR Dashboard"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className="shrink-0 text-blue-600" />
              <span className="font-black text-blue-700">HR Dashboard</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {!hideAllDashboard && !isHr && (
          <NavLink
            to="/dashboard"
            end
            onClick={closeSidebar}
            className={({ isActive }) => navClass({ isActive: isActive && selectedCategory === 'All' })}
            title="Dashboard"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span>Dashboard</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {/* Categories Section */}
        {!isHr && (
          <div className="pt-4 pb-1.5 px-3 flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-[0.16em]">
            <span>Asset Categories</span>
            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono font-bold">
              {visibleCategories.length}
            </span>
          </div>
        )}

        {!isHr &&
          visibleCategories.map((cat) => {
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className={active ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0 group-hover:text-slate-700'} />
                  <span className="truncate">{cat.replace(' / ', '/')}</span>
                </div>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
              </button>
            );
          })}

        {/* Prevention / Maintenance placed directly under Maintenance Assets */}
        {!isHr && canAccessMaintenance(user.role, user.categories) && (
          <NavLink
            to="/maintenance"
            className={navClass}
            title="Prevention / Maintenance"
            onClick={closeSidebar}
          >
            <div className="flex items-center gap-3">
              <Wrench size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span className="truncate">Prevention / Maintenance</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {/* Management Section */}
        <div className="pt-4 pb-1.5 px-3 text-[10px] font-black uppercase text-slate-400 tracking-[0.16em]">
          Management
        </div>

        {(isUserAdmin || isHr) && (
          <NavLink to="/employees" className={navClass} title="Employees" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <UserCircle size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span>Employees</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {!isHr && isUserAdmin && (
          <NavLink to="/hr-dashboard" className={navClass} title="HR Operations" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Building2 size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span>HR Operations</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {!isHr && (
          <NavLink to="/damaged-scrap" className={navClass} title="Damaged / Scrap" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Trash2 size={18} className="shrink-0 text-rose-500" />
              <span>Damaged / Scrap</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {MISSING_ITEMS_FEATURE_ENABLED && !isHr && (
          <NavLink to="/missing" className={navClass} title="Missing Items" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="shrink-0 text-amber-500" />
              <span>Missing Items</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {isUserAdmin && !isHr && (
          <NavLink to="/users" className={navClass} title="User Management" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Users size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span>User Management</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}

        {isItAdmin && !isHr && (
          <NavLink to="/settings" className={navClass} title="Settings" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Settings size={18} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
              <span>Settings</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
          </NavLink>
        )}
      </nav>

      {/* Bottom Profile & Sign Out */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-3 mb-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{user.email}</p>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-wider">{user.role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-600 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden font-sans bg-[#F8F6F0] relative">
      {/* Invisible Hover Trigger Zone on Left Corner / Edge */}
      <div
        onMouseEnter={openSidebar}
        className="fixed left-0 top-0 bottom-0 w-3.5 z-40 cursor-pointer group"
        title="Move cursor here to open menu"
      >
        <div className="h-full w-1 bg-transparent group-hover:bg-blue-500/40 transition-colors" />
      </div>

      {/* Slide-out Hover Sidebar (Light Theme) */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-out flex ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        {SidebarContent}
      </div>

      {/* Backdrop when open */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 transition-opacity"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar - Corporate Navy Blue matching Image Reference */}
        <header className="bg-[#0B2545] border-b border-[#081b33] h-16 flex items-center px-4 sm:px-6 justify-between shrink-0 shadow-md z-20">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Sidebar Toggle / Hover Button */}
            <button
              type="button"
              onMouseEnter={openSidebar}
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 flex items-center justify-center cursor-pointer border border-white/10"
              title="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>

            {/* White Pill Container for PG Logo */}
            <div
              onClick={() => navigate(isHr ? '/hr-dashboard' : '/dashboard')}
              className="bg-white px-2.5 sm:px-3 py-1 rounded-xl flex items-center justify-center shadow-xs shrink-0 h-9 cursor-pointer hover:opacity-95 transition-opacity"
              title="Home"
            >
              <img src={LOGO_SRC} alt="PG Logo" className="h-5 sm:h-6 w-auto object-contain" />
            </div>

            {/* A.E.M.S Brand Title with Underline and Subtitle */}
            <div
              onClick={() => navigate(isHr ? '/hr-dashboard' : '/dashboard')}
              className="flex flex-col justify-center cursor-pointer select-none shrink-0"
            >
              <div className="border-b border-blue-300/40 pb-0.5">
                <span className="font-black text-white text-sm sm:text-base md:text-lg tracking-wider leading-none font-mono">
                  A.E.M.S
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-white/95 font-bold tracking-tight leading-tight mt-0.5 whitespace-nowrap hidden min-[480px]:inline">
                Asset Entry Management System
              </span>
            </div>

            {/* Vertical Divider & Current Page Name */}
            <div className="h-6 w-[1px] bg-blue-300/40 mx-1.5 sm:mx-2 shrink-0 hidden sm:block" />
            <span className="text-white font-bold text-xs sm:text-sm tracking-wide truncate hidden sm:inline-block max-w-[160px] md:max-w-none">
              {location.pathname === '/hr-dashboard'
                ? 'HR Dashboard'
                : isDashboard
                ? selectedCategory === 'All'
                  ? 'Asset Inventory'
                  : selectedCategory
                : location.pathname.startsWith('/employees')
                ? 'Employee Directory'
                : location.pathname.startsWith('/maintenance')
                ? 'Prevention / Maintenance'
                : location.pathname.startsWith('/damaged-scrap')
                ? 'Damaged & Scrap'
                : location.pathname.startsWith('/missing')
                ? 'Missing Items'
                : location.pathname.startsWith('/users')
                ? 'User Management'
                : location.pathname.startsWith('/settings')
                ? 'System Settings'
                : 'Asset Management'}
            </span>
          </div>

          {/* Header Action Portal (Search, Filters, Export, User Role) */}
          <div
            ref={setHeaderPortalNode}
            id="portal-header-root"
            className="flex-1 h-full flex items-center justify-end gap-3 min-w-0"
          >
            {!isDashboard && !isMaintenance && location.pathname !== '/hr-dashboard' && (
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <span className="hidden sm:inline text-blue-200/80 font-medium">{user.email}</span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-white border border-white/25 text-[10px] uppercase font-black tracking-wider">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Nested Routed Page */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <Outlet context={{ headerPortalNode }} />
        </main>
      </div>
    </div>
  );
}
