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
  HelpCircle,
  Layers,
  Bell,
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
  const isUserAdmin = canAccessUserManagement(user.role);
  const isItAdmin = isItAdminRole(user.role);
  const isHr = isHrRole(user.role);
  const hideAllDashboard =
    user.role !== 'IT Admin' &&
    user.categories &&
    user.categories.length > 0 &&
    !user.categories.includes('All');

  const closeSidebar = () => setSidebarOpen(false);

  // Modern Dark Sidebar Nav Item Classes
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 group ${
      isActive
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-transparent'
    }`;

  const categoryNavClass = (cat: string) => {
    const active = isDashboard && selectedCategory === cat;
    return `w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group ${
      active
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-transparent'
    }`;
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0B132B] text-slate-300 select-none border-r border-[#1E293B]">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center gap-3.5 border-b border-[#1E293B]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
          <Boxes size={22} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-black text-white text-base tracking-tight leading-none truncate">
            A.E.M.S
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">
            Asset Management
          </p>
        </div>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={closeSidebar}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {!hideAllDashboard && !isHr && (
          <NavLink
            to="/dashboard"
            end
            onClick={closeSidebar}
            className={({ isActive }) => navClass({ isActive: isActive && selectedCategory === 'All' })}
            title="Dashboard"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className="shrink-0" />
              <span>Dashboard</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {/* Categories Section */}
        {!isHr && (
          <div className="pt-4 pb-1.5 px-3 flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-[0.16em]">
            <span>Asset Categories</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
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
                  <Icon size={16} className={active ? 'text-blue-400 shrink-0' : 'text-slate-500 shrink-0 group-hover:text-slate-300'} />
                  <span className="truncate">{cat.replace(' / ', '/')}</span>
                </div>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
              </button>
            );
          })}

        {/* Management Section */}
        <div className="pt-4 pb-1.5 px-3 text-[10px] font-black uppercase text-slate-500 tracking-[0.16em]">
          Management
        </div>

        {(isUserAdmin || isHr) && (
          <NavLink to="/employees" className={navClass} title="Employees" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <UserCircle size={18} className="shrink-0" />
              <span>Employees</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {canAccessMaintenance(user.role, user.categories) && (
          <NavLink to="/maintenance" className={navClass} title="Maintenance" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Wrench size={18} className="shrink-0" />
              <span>Maintenance</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {!isHr && (
          <NavLink to="/damaged-scrap" className={navClass} title="Damaged / Scrap" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Trash2 size={18} className="shrink-0 text-rose-400" />
              <span>Damaged / Scrap</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {MISSING_ITEMS_FEATURE_ENABLED && !isHr && (
          <NavLink to="/missing" className={navClass} title="Missing Items" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="shrink-0 text-amber-400" />
              <span>Missing Items</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {isUserAdmin && !isHr && (
          <NavLink to="/users" className={navClass} title="User Management" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Users size={18} className="shrink-0" />
              <span>User Management</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}

        {isItAdmin && !isHr && (
          <NavLink to="/settings" className={navClass} title="Settings" onClick={closeSidebar}>
            <div className="flex items-center gap-3">
              <Settings size={18} className="shrink-0" />
              <span>Settings</span>
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        )}
      </nav>

      {/* Bottom Profile & Sign Out */}
      <div className="p-3.5 border-t border-[#1E293B] bg-[#080E21]/60">
        <div className="flex items-center gap-3 mb-2.5 p-2 rounded-xl bg-white/[0.04]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-100 truncate">{user.email}</p>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{user.role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-rose-500/15 border border-white/5 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 text-xs font-bold transition-all"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden font-sans bg-[#F8FAFC]">
      {/* Desktop Fixed Dark Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 h-full flex-col shrink-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={closeSidebar}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-2xl z-50">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200/90 h-16 flex items-center px-4 sm:px-6 justify-between shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shrink-0"
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb Title */}
            <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 truncate">
              <span className="text-slate-400 font-semibold hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard')}>
                Dashboard
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-black truncate">
                {isDashboard
                  ? (selectedCategory === 'All' ? 'Asset Inventory' : selectedCategory)
                  : location.pathname.startsWith('/employees')
                  ? 'Employee Directory'
                  : location.pathname.startsWith('/maintenance')
                  ? 'Maintenance Hub'
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
          </div>

          {/* Header Action Portal (Search, Filters, Export, New Asset) */}
          <div
            ref={setHeaderPortalNode}
            id="portal-header-root"
            className="flex-1 h-full flex items-center justify-end gap-3 min-w-0"
          >
            {!isDashboard && !isMaintenance && (
              <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                <span className="hidden sm:inline text-slate-500">{user.email}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] uppercase font-black">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#F8FAFC]">
          <Outlet context={{ headerPortalNode }} />
        </main>
      </div>
    </div>
  );
}
