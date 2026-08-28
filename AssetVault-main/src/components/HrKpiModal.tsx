import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Users,
  Laptop,
  UserCheck,
  UserX,
  Building2,
  MapPin,
  ArrowRight,
  ExternalLink,
  Layers,
  Briefcase,
  Smartphone,
  Monitor,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Employee } from '../types/employee';
import type { Asset } from '../types';
import { isInactiveEmployee } from '../lib/employeeStatus';
import { assetsForEmployee } from '../lib/employeeAssets';
import DeviceThumb from './DeviceThumb';

export type HrKpiType = 'total_employees' | 'assigned_assets' | 'active_staff' | 'inactive_records';

interface HrKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: HrKpiType | null;
  employees: Employee[];
  assets: Asset[];
  onSelectEmployee: (emp: Employee) => void;
  onSelectAsset?: (asset: Asset) => void;
}

export default function HrKpiModal({
  isOpen,
  onClose,
  kpiType,
  employees,
  assets,
  onSelectEmployee,
  onSelectAsset,
}: HrKpiModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterChip, setSelectedFilterChip] = useState<string>('All');

  // Reset internal search/filter when KPI type changes
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedFilterChip('All');
  };

  // Determine base data for current KPI
  const baseEmployees = useMemo(() => {
    if (!kpiType || kpiType === 'assigned_assets') return [];
    if (kpiType === 'active_staff') {
      return employees.filter((e) => !isInactiveEmployee(e.status));
    }
    if (kpiType === 'inactive_records') {
      return employees.filter((e) => isInactiveEmployee(e.status));
    }
    return employees; // 'total_employees'
  }, [kpiType, employees]);

  // For Assigned Assets KPI: compute list of assigned asset items with their assigned employee
  const assignedAssetItems = useMemo(() => {
    if (kpiType !== 'assigned_assets') return [];
    const items: Array<{ asset: Asset; employee: Employee }> = [];
    employees.forEach((emp) => {
      const empAssets = assetsForEmployee(assets, emp);
      empAssets.forEach((asset) => {
        items.push({ asset, employee: emp });
      });
    });
    return items;
  }, [kpiType, employees, assets]);

  // Dynamic filter chips & counts
  const filterChips = useMemo(() => {
    const counts = new Map<string, number>();
    if (kpiType === 'assigned_assets') {
      assignedAssetItems.forEach(({ asset }) => {
        const key = asset.assetType?.trim() || asset.mainCategory?.trim() || 'General';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    } else {
      baseEmployees.forEach((emp) => {
        const key = emp.department?.trim() || 'General';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    }
    const list = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [kpiType, baseEmployees, assignedAssetItems]);

  // Filtered employees based on search & chip
  const filteredEmployees = useMemo(() => {
    if (kpiType === 'assigned_assets') return [];
    const q = searchQuery.trim().toLowerCase();

    return baseEmployees.filter((emp) => {
      // Department chip filter
      if (selectedFilterChip !== 'All') {
        const dept = emp.department?.trim() || 'General';
        if (dept !== selectedFilterChip) return false;
      }

      // Search query
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.designation || '').toLowerCase().includes(q) ||
        (emp.location || '').toLowerCase().includes(q) ||
        (emp.plant || '').toLowerCase().includes(q)
      );
    });
  }, [kpiType, baseEmployees, selectedFilterChip, searchQuery]);

  // Filtered assigned assets based on search & chip
  const filteredAssignedAssets = useMemo(() => {
    if (kpiType !== 'assigned_assets') return [];
    const q = searchQuery.trim().toLowerCase();

    return assignedAssetItems.filter(({ asset, employee }) => {
      // Type/Category chip filter
      if (selectedFilterChip !== 'All') {
        const key = asset.assetType?.trim() || asset.mainCategory?.trim() || 'General';
        if (key !== selectedFilterChip) return false;
      }

      // Search query
      if (!q) return true;
      return (
        (asset.assetCode || '').toLowerCase().includes(q) ||
        (asset.id || '').toLowerCase().includes(q) ||
        (asset.serialNumber || '').toLowerCase().includes(q) ||
        (asset.assetName || '').toLowerCase().includes(q) ||
        (asset.assetType || '').toLowerCase().includes(q) ||
        (asset.mainCategory || '').toLowerCase().includes(q) ||
        (asset.make || '').toLowerCase().includes(q) ||
        (asset.model || '').toLowerCase().includes(q) ||
        employee.name.toLowerCase().includes(q) ||
        employee.employeeId.toLowerCase().includes(q) ||
        (employee.department || '').toLowerCase().includes(q) ||
        (asset.location || employee.location || '').toLowerCase().includes(q) ||
        (asset.plantCode || employee.plant || '').toLowerCase().includes(q)
      );
    });
  }, [kpiType, assignedAssetItems, selectedFilterChip, searchQuery]);

  if (!isOpen || !kpiType) return null;

  // Header configuration per KPI type
  const headerConfig = {
    total_employees: {
      title: 'Total Employees',
      subtitle: 'Complete list of all registered employees under current scope & filters.',
      count: baseEmployees.length,
      countLabel: 'Total Staff',
      icon: Users,
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      pillBg: 'bg-amber-100 text-amber-900 border-amber-200',
      searchPlaceholder: 'Search staff by Name, Employee ID, Email, Department, Plant, Location...',
      chipIcon: Briefcase,
      allChipLabel: 'All Departments',
    },
    assigned_assets: {
      title: 'Assets Assigned',
      subtitle: 'Detailed list of assets currently allocated and deployed to active staff.',
      count: assignedAssetItems.length,
      countLabel: 'Assigned Assets',
      icon: Laptop,
      iconBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
      pillBg: 'bg-blue-100 text-blue-900 border-blue-200',
      searchPlaceholder: 'Search by Asset Code, Serial, Type, Make/Model, or Assignee Name/ID...',
      chipIcon: Layers,
      allChipLabel: 'All Categories',
    },
    active_staff: {
      title: 'Active Staff',
      subtitle: 'Currently active workforce personnel eligible for asset allocations.',
      count: baseEmployees.length,
      countLabel: 'Active Staff',
      icon: UserCheck,
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      pillBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      searchPlaceholder: 'Search active personnel by Name, ID, Department, Plant, Location...',
      chipIcon: Briefcase,
      allChipLabel: 'All Departments',
    },
    inactive_records: {
      title: 'Inactive Records',
      subtitle: 'Separated, relieved, or inactive employee records requiring asset reconciliation.',
      count: baseEmployees.length,
      countLabel: 'Inactive Records',
      icon: UserX,
      iconBg: 'bg-rose-50 text-rose-700 border-rose-200/80',
      pillBg: 'bg-rose-100 text-rose-900 border-rose-200',
      searchPlaceholder: 'Search inactive records by Name, ID, Department, Plant, Location...',
      chipIcon: Briefcase,
      allChipLabel: 'All Departments',
    },
  }[kpiType];

  const IconComponent = headerConfig.icon;
  const ChipIconComponent = headerConfig.chipIcon;
  const totalCount = headerConfig.count;
  const isAssetView = kpiType === 'assigned_assets';

  const getDeviceBadge = (asset: Asset) => {
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
    return {
      label: asset.subCategory || asset.mainCategory || asset.assetType || 'Hardware',
      icon: HardDrive,
      color: 'text-slate-700 bg-slate-100 border-slate-200',
    };
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/75 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-5 sm:px-6 py-4 sm:py-5 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 shadow-xs ${headerConfig.iconBg}`}
                >
                  <IconComponent size={22} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {headerConfig.title}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide border ${headerConfig.pillBg}`}
                    >
                      {totalCount} {headerConfig.countLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{headerConfig.subtitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Close (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="mt-4 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={headerConfig.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Interactive Filter Chips / Tabs */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedFilterChip('All')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  selectedFilterChip === 'All'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <ChipIconComponent size={13} />
                <span>{headerConfig.allChipLabel}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                    selectedFilterChip === 'All'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {totalCount}
                </span>
              </button>

              {filterChips.map(({ name, count }) => {
                const isActive = selectedFilterChip === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedFilterChip(name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{name}</span>
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        isActive ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            {/* VIEW 1: ASSIGNED ASSETS LIST */}
            {isAssetView && (
              <>
                {filteredAssignedAssets.length === 0 ? (
                  <div className="py-14 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-3.5 shadow-xs">
                      <Laptop size={30} />
                    </div>
                    <h3 className="text-base font-black text-slate-800">No Assigned Assets Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {searchQuery || selectedFilterChip !== 'All'
                        ? 'No assigned assets match your current category or search filter.'
                        : 'No assets are currently assigned to employees in the selected scope.'}
                    </p>
                    {(searchQuery || selectedFilterChip !== 'All') && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredAssignedAssets.map(({ asset, employee }) => {
                      const displayId =
                        asset.assetCode ||
                        (asset.id ? `IT-${String(asset.id).padStart(3, '0')}` : 'N/A');
                      const badge = getDeviceBadge(asset);

                      return (
                        <div
                          key={`${asset.id}-${employee.employeeId}`}
                          onClick={() => {
                            onClose();
                            if (onSelectAsset) {
                              onSelectAsset(asset);
                            } else {
                              onSelectEmployee(employee);
                            }
                          }}
                          className="group bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
                        >
                          <div>
                            {/* Card Top Header */}
                            <div className="flex items-start gap-3">
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                                <DeviceThumb
                                  assetType={asset.assetType}
                                  mainCategory={asset.mainCategory}
                                  subCategory={asset.subCategory}
                                  imageUrl={asset.imageUrl}
                                  size="sm"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-mono text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md truncate">
                                    {displayId}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                                    {asset.status || 'Assigned'}
                                  </span>
                                </div>
                                <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate mt-1 group-hover:text-blue-600 transition-colors">
                                  {asset.assetName || asset.model || asset.assetType}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {asset.make} {asset.model}
                                </p>
                              </div>
                            </div>

                            {/* Assigned Employee Details Box */}
                            <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>Assigned To</span>
                                <span className="font-mono text-slate-600">
                                  {employee.employeeId}
                                </span>
                              </div>
                              <p className="font-black text-slate-800 text-xs truncate">
                                {employee.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Building2 size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {employee.department || asset.department || 'General'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom Metadata & Action */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate uppercase">
                                {asset.location || employee.location || 'BHIWADI'} •{' '}
                                {asset.plantCode || employee.plant || '4020'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                              <span>View</span>
                              <ArrowRight size={11} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: EMPLOYEE LIST (TOTAL, ACTIVE, INACTIVE) */}
            {!isAssetView && (
              <>
                {filteredEmployees.length === 0 ? (
                  <div className="py-14 text-center flex flex-col items-center justify-center">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3.5 shadow-xs border ${headerConfig.iconBg}`}
                    >
                      <IconComponent size={30} />
                    </div>
                    <h3 className="text-base font-black text-slate-800">No Employees Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {searchQuery || selectedFilterChip !== 'All'
                        ? 'No employee profiles match your current search or department filter.'
                        : 'No employees found under this category in current scope.'}
                    </p>
                    {(searchQuery || selectedFilterChip !== 'All') && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredEmployees.map((emp) => {
                      const empAssets = assetsForEmployee(assets, emp);
                      const isInactive = isInactiveEmployee(emp.status);

                      return (
                        <div
                          key={emp.employeeId}
                          onClick={() => {
                            onClose();
                            onSelectEmployee(emp);
                          }}
                          className="group bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3.5 cursor-pointer relative"
                        >
                          {/* Left: Avatar, Name, ID, Email */}
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="relative shrink-0">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-black text-base flex items-center justify-center overflow-hidden">
                                {emp.photoUrl ? (
                                  <img
                                    src={emp.photoUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  emp.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  !isInactive ? 'bg-[#10b981]' : 'bg-rose-500'
                                }`}
                              />
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors truncate">
                                {emp.name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                                <span className="font-mono font-bold text-slate-600 text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">
                                  {emp.employeeId}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[140px] sm:max-w-[200px] text-[10px] text-slate-400">
                                  {emp.email || '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Center: Department & Plant Info */}
                          <div className="min-w-[160px] space-y-0.5 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
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

                          {/* Center-Right: Assigned Assets Badges */}
                          <div className="min-w-[180px] flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              Assigned Assets ({empAssets.length})
                            </span>
                            {empAssets.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">No assets assigned</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {empAssets.slice(0, 3).map((a) => {
                                  const badge = getDeviceBadge(a);
                                  const BadgeIcon = badge.icon;
                                  return (
                                    <span
                                      key={a.id}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}
                                    >
                                      <BadgeIcon size={11} />
                                      <span>{badge.label}</span>
                                    </span>
                                  );
                                })}
                                {empAssets.length > 3 && (
                                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                                    +{empAssets.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right: Status Pill & Action */}
                          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                !isInactive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {emp.status || 'ACTIVE'}
                            </span>

                            <div className="flex items-center gap-1 font-bold text-xs text-blue-600 group-hover:translate-x-0.5 transition-transform">
                              <span>Profile</span>
                              <ExternalLink size={12} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-100/80 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="font-semibold">
              Showing{' '}
              <strong className="text-slate-800 font-black">
                {isAssetView ? filteredAssignedAssets.length : filteredEmployees.length}
              </strong>{' '}
              of <strong className="text-slate-800 font-black">{totalCount}</strong> items
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
