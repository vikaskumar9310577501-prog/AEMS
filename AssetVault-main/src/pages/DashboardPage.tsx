import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Navigate, useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search,
  Plus,
  Download,
  CheckCircle,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Edit2,
  Cpu,
  Sofa,
  Zap,
  Factory,
  ShieldAlert,
  Car,
  Table as TableIcon,
  FileText,
  Building2,
  Wrench,
  MapPin,
  Building,
  Filter,
  Layers,
  Camera as CameraIcon,
  Video as VideoIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutGrid,
  List,
  Settings2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AssetTable, { AssetViewMode } from '../components/AssetTable';
import QRCodeDisplay from '../components/QRCodeDisplay';
import BulkQRPrintModal from '../components/BulkQRPrintModal';
import DeleteAssetModal from '../components/DeleteAssetModal';
import { AssetTableSkeleton } from '../components/LoadingSkeleton';
import { APP_NAME, APP_SHORT_NAME } from '../lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { formatFilenameDate } from '../lib/formatDisplayDate';
import { SYNC_DATABASE_MSG, SYNC_DATABASE_OK, SYNC_DATABASE_ERR } from '../lib/uiLabels';
import { syncDatabaseAssets } from '../lib/syncDatabase';
import { assetRouteId, buildAssetLookupIndex, findAssetInLookup } from '../lib/assetLookup';
import { useApp } from '../context/AppProvider';
import { isAssetAssignedToEmployee } from '../lib/employeeAssets';
import {
  isSoftwareLicenseExpired,
  isSoftwareLicenseRenewable,
  SOFTWARE_LICENSE_CATEGORY,
} from '../lib/softwareLicense';
import type { Asset } from '../types';
import type { MissingItemRecord, DamagedItemRecord } from '../types/redesigned';
import { parseJsonResponse } from '../lib/apiFetch';
import {
  assetMatchesSidebarCategory,
  isSidebarCctvCategory,
  newAssetPrefillFromCategory,
  SIDEBAR_CCTV_CATEGORY,
} from '../lib/dashboardCategories';
import { useEmployees } from '../hooks/useEmployees';
import { SUB_TO_MAIN_MAP, subCategoryForItAssetType, PERIPHERAL_TYPES } from '../lib/assetCatalogByType';
import {
  buildScopedLocationOptions,
  buildScopedPlantOptions,
  sameScopeOption,
} from '../lib/scopeOptions';
import { normalizeEmployeeId } from '../lib/employeeLookup';

type PlantOption = { code: string; name: string; location: string };
type EmployeeScope = { location?: string; plant?: string; plantCode?: string };

const ALL_CATEGORIES = [
  'IT Assets',
  SIDEBAR_CCTV_CATEGORY,
  'Office Assets',
  'Electrical Assets',
  'Production Assets',
  'Safety Assets',
  'Vehicle Assets',
  'Furniture Assets',
  'Software / License Assets',
  'Admin / Facility Assets',
  'Maintenance Assets',
  ...(MISSING_ITEMS_FEATURE_ENABLED ? ['Missing Items'] : []),
];

const DASHBOARD_FILTER_STORAGE_KEY = 'assetvault.dashboardFilters';

function readSavedDashboardFilters() {
  if (typeof window === 'undefined') {
    return { location: 'All', plant: 'All', status: 'All' };
  }
  try {
    const raw = window.localStorage.getItem(DASHBOARD_FILTER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      location: String(parsed.location || 'All'),
      plant: String(parsed.plant || 'All'),
      status: String(parsed.status || 'All'),
    };
  } catch {
    return { location: 'All', plant: 'All', status: 'All' };
  }
}

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
  'Missing Items': AlertCircle,
};

const CATEGORY_STYLES: Record<string, { gradient: string; text: string; iconBg: string; shadow: string; border: string }> = {
  'IT Assets': { gradient: 'from-blue-50 to-indigo-50/30', text: 'text-blue-700', iconBg: 'bg-blue-100 text-blue-700', shadow: 'hover:shadow-blue-500/5', border: 'border-blue-100' },
  [SIDEBAR_CCTV_CATEGORY]: { gradient: 'from-cyan-50 to-violet-50/30', text: 'text-cyan-700', iconBg: 'bg-cyan-100 text-cyan-700', shadow: 'hover:shadow-cyan-500/5', border: 'border-cyan-100' },
  Camera: { gradient: 'from-cyan-50 to-sky-50/30', text: 'text-cyan-700', iconBg: 'bg-cyan-100 text-cyan-700', shadow: 'hover:shadow-cyan-500/5', border: 'border-cyan-100' },
  NVR: { gradient: 'from-violet-50 to-purple-50/30', text: 'text-violet-700', iconBg: 'bg-violet-100 text-violet-700', shadow: 'hover:shadow-violet-500/5', border: 'border-violet-100' },
  'Office Assets': { gradient: 'from-orange-50 to-amber-50/30', text: 'text-orange-700', iconBg: 'bg-orange-100 text-orange-700', shadow: 'hover:shadow-orange-500/5', border: 'border-orange-100' },
  'Electrical Assets': { gradient: 'from-amber-50 to-yellow-50/30', text: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-700', shadow: 'hover:shadow-amber-500/5', border: 'border-amber-100' },
  'Production Assets': { gradient: 'from-purple-50 to-violet-50/30', text: 'text-purple-700', iconBg: 'bg-purple-100 text-purple-700', shadow: 'hover:shadow-purple-500/5', border: 'border-purple-100' },
  'Safety Assets': { gradient: 'from-rose-50 to-red-50/30', text: 'text-rose-700', iconBg: 'bg-rose-100 text-rose-700', shadow: 'hover:shadow-rose-500/5', border: 'border-rose-100' },
  'Vehicle Assets': { gradient: 'from-emerald-50 to-teal-50/30', text: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-700', shadow: 'hover:shadow-emerald-500/5', border: 'border-emerald-100' },
  'Furniture Assets': { gradient: 'from-amber-50 to-yellow-50/10', text: 'text-amber-800', iconBg: 'bg-amber-100 text-amber-800', shadow: 'hover:shadow-amber-700/5', border: 'border-amber-200' },
  'Software / License Assets': { gradient: 'from-fuchsia-50 to-pink-50/30', text: 'text-fuchsia-700', iconBg: 'bg-fuchsia-100 text-fuchsia-700', shadow: 'hover:shadow-fuchsia-500/5', border: 'border-fuchsia-100' },
  'Admin / Facility Assets': { gradient: 'from-sky-50 to-blue-50/30', text: 'text-sky-700', iconBg: 'bg-sky-100 text-sky-700', shadow: 'hover:shadow-sky-500/5', border: 'border-sky-100' },
  'Maintenance Assets': { gradient: 'from-slate-50 to-slate-100/30', text: 'text-slate-700', iconBg: 'bg-slate-200/60 text-slate-700', shadow: 'hover:shadow-slate-500/5', border: 'border-slate-200' },
  'Missing Items': { gradient: 'from-rose-50 to-red-50/30', text: 'text-rose-700', iconBg: 'bg-rose-100 text-rose-700', shadow: 'hover:shadow-rose-500/5', border: 'border-rose-100' },
};

function normFilterValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function sameFilterValue(left: unknown, right: unknown): boolean {
  return normFilterValue(left) === normFilterValue(right);
}

function assetMatchesLocation(asset: Asset, selectedLocation: string): boolean {
  return selectedLocation === 'All' || sameFilterValue(asset.location, selectedLocation);
}

function valueMatchesPlant(
  value: unknown,
  selectedPlant: string,
  plants: PlantOption[]
): boolean {
  if (selectedPlant === 'All') return true;
  const plant = plants.find(
    (p) => sameFilterValue(p.code, selectedPlant) || sameFilterValue(p.name, selectedPlant)
  );
  return (
    sameFilterValue(value, selectedPlant) ||
    (plant ? sameFilterValue(value, plant.name) || sameFilterValue(value, plant.code) : false)
  );
}

function assetMatchesPlant(
  asset: Asset,
  selectedPlant: string,
  plants: PlantOption[]
): boolean {
  return valueMatchesPlant(asset.plantCode, selectedPlant, plants);
}

function getMissingItemMainCategory(assetType: string): string {
  if (!assetType) return 'IT Assets';
  const itTypes = ['Laptop', 'Desktop', ...PERIPHERAL_TYPES];
  if (itTypes.includes(assetType)) {
    return 'IT Assets';
  }
  if (SUB_TO_MAIN_MAP[assetType]) {
    return SUB_TO_MAIN_MAP[assetType];
  }
  const itSub = subCategoryForItAssetType(assetType);
  if (SUB_TO_MAIN_MAP[itSub]) {
    return SUB_TO_MAIN_MAP[itSub];
  }
  return 'IT Assets';
}

function missingItemMatchesCategory(m: MissingItemRecord, category: string): boolean {
  if (category === 'All') return true;
  const assetType = m['Asset Type'] || m['Missing Item Name'] || '';
  const mainCategory = getMissingItemMainCategory(assetType);

  if (category === SIDEBAR_CCTV_CATEGORY) {
    return mainCategory === 'IT Assets' && (assetType === 'Camera' || assetType === 'NVR');
  }
  if (category === 'Camera' || category === 'NVR') {
    return mainCategory === 'IT Assets' && assetType === category;
  }
  if (category === 'IT Assets') {
    return mainCategory === 'IT Assets' && assetType !== 'Camera' && assetType !== 'NVR';
  }
  return mainCategory === category;
}

function isStandaloneMissingParent(parentAssetId: unknown): boolean {
  const parent = String(parentAssetId || '').trim();
  return !parent || parent.toUpperCase() === 'STANDALONE';
}

function employeePlantValue(employee: EmployeeScope): string {
  return employee.plant || employee.plantCode || '';
}

function getDashboardAssetCategories(asset: Asset): string[] {
  const categories: string[] = [];
  for (const category of ALL_CATEGORIES) {
    if (category !== 'Missing Items' && assetMatchesSidebarCategory(asset, category)) {
      categories.push(category);
    }
  }
  return categories;
}

type CategorySummaryStats = {
  total: number;
  available: number;
  assigned: number;
  repair: number;
  lost: number;
};

const emptyCategorySummaryStats = (): CategorySummaryStats => ({
  total: 0,
  available: 0,
  assigned: 0,
  repair: 0,
  lost: 0,
});

export default function DashboardPage() {
  const { user } = useApp();

  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }

  return <DashboardPageContent />;
}

function DashboardPageContent() {
  const { headerPortalNode } = useOutletContext<{ headerPortalNode: HTMLDivElement | null }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, assets, loading, visibleCategories, fetchAssets, filterAssets, executeDelete } =
    useApp();
  const { employees } = useEmployees({ autoLoad: true });

  const selectedCategory = searchParams.get('category') || 'All';
  const isSoftwareCategory = selectedCategory === SOFTWARE_LICENSE_CATEGORY;
  const isCctvSidebarCategory = isSidebarCctvCategory(selectedCategory);
  const maintenanceCardStatus = isSoftwareCategory ? 'Expiry' : 'Maintenance';
  const renewableSoftwareCardStatus = 'Renewable';
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [viewingQR, setViewingQR] = useState<Asset | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  // Dashboard view mode
  const [viewMode, setViewMode] = useState<AssetViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem('assetvault.viewMode');
    return saved === 'card' || saved === 'grid' || saved === 'table' ? saved : 'grid';
  });
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  const [selectedAssetIds, setSelectedAssetIds] = useState<(string | number)[]>([]);
  const [bulkPrintingAssets, setBulkPrintingAssets] = useState<Asset[] | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('assetvault.viewMode', viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [viewMenuOpen]);

  // Settings Locations/Plants states
  const [locations, setLocations] = useState<string[]>([]);
  const [plants, setPlants] = useState<{ code: string; name: string; location: string }[]>([]);

  // Advanced Filters
  const savedFilters = useMemo(readSavedDashboardFilters, []);
  const [selectedLocation, setSelectedLocation] = useState(savedFilters.location);
  const [selectedPlant, setSelectedPlant] = useState(savedFilters.plant);
  const [selectedStatus, setSelectedStatus] = useState(savedFilters.status);

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_FILTER_STORAGE_KEY,
      JSON.stringify({
        location: selectedLocation,
        plant: selectedPlant,
        status: selectedStatus,
      })
    );
  }, [selectedLocation, selectedPlant, selectedStatus]);

  useEffect(() => {
    setSelectedAssetIds([]);
  }, [selectedCategory, selectedStatus, selectedLocation, selectedPlant, searchQuery]);

  const [missingItemRecords, setMissingItemRecords] = useState<MissingItemRecord[]>([]);
  const [damagedItemRecords, setDamagedItemRecords] = useState<DamagedItemRecord[]>([]);

  const loadMissingItems = useCallback(async (force = false) => {
    if (!MISSING_ITEMS_FEATURE_ENABLED) {
      setMissingItemRecords([]);
      return;
    }
    try {
      const url = force ? '/api/missing-items?refresh=1' : '/api/missing-items';
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + url, { credentials: 'include' });
      const data = await parseJsonResponse<{ items?: MissingItemRecord[] }>(res);
      if (res.ok) setMissingItemRecords(data.items || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDamagedItems = useCallback(async (force = false) => {
    try {
      const url = force ? '/api/damaged-items?refresh=1' : '/api/damaged-items';
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + url, { credentials: 'include' });
      const data = await parseJsonResponse<{ items?: DamagedItemRecord[] }>(res);
      if (res.ok) setDamagedItemRecords(data.items || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (MISSING_ITEMS_FEATURE_ENABLED) void loadMissingItems();
    void loadDamagedItems();
  }, [loadMissingItems, loadDamagedItems]);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings?refresh=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setLocations(data.locations || []);
        setPlants(data.plants || []);
      })
      .catch(() => {});
  }, []);

  const locationOptions = useMemo(
    () => buildScopedLocationOptions(locations, plants, user, [selectedLocation]),
    [locations, plants, user, selectedLocation]
  );

  const plantOptions = useMemo(
    () =>
      buildScopedPlantOptions(
        plants,
        user,
        selectedPlant !== 'All'
          ? [
              {
                code: selectedPlant,
                name: selectedPlant,
                location: selectedLocation === 'All' ? '' : selectedLocation,
              },
            ]
          : [],
        locationOptions
      ),
    [plants, user, selectedPlant, selectedLocation, locationOptions]
  );

  useEffect(() => {
    setSelectedStatus('All');
  }, [selectedCategory]);

  useEffect(() => {
    if (isSoftwareCategory && selectedStatus === 'Maintenance') {
      setSelectedStatus('Expiry');
    } else if (isSoftwareCategory && selectedStatus === 'Upcoming') {
      setSelectedStatus('Renewable');
    } else if (!isSoftwareCategory && selectedStatus === 'Expiry') {
      setSelectedStatus('All');
    }
    if (isSoftwareCategory && selectedStatus === 'Damaged') {
      setSelectedStatus('All');
    }
    if (isSoftwareCategory && selectedStatus === 'Lost') {
      setSelectedStatus('All');
    }
  }, [isSoftwareCategory, selectedStatus]);

  useEffect(() => {
    if (
      user &&
      user.role !== 'IT Admin' &&
      user.categories &&
      user.categories.length > 0 &&
      !user.categories.includes('All')
    ) {
      const cats = visibleCategories;
      if (cats.length > 0 && (selectedCategory === 'All' || !cats.includes(selectedCategory))) {
        setSearchParams({ category: cats[0] }, { replace: true });
      }
    }
  }, [user, visibleCategories, selectedCategory, setSearchParams]);

  const filteredAssets = useMemo(
    () => filterAssets(assets, { searchQuery, selectedCategory }),
    [assets, searchQuery, selectedCategory, filterAssets]
  );

  const scopedDashboardAssets = useMemo(
    () => filterAssets(assets, { searchQuery, selectedCategory: 'All' }),
    [assets, searchQuery, filterAssets]
  );

  const scopedDashboardAssetsLookup = useMemo(
    () => buildAssetLookupIndex(scopedDashboardAssets),
    [scopedDashboardAssets]
  );
  const employeesById = useMemo(() => {
    const byId = new Map<string, EmployeeScope>();
    for (const employee of employees) {
      byId.set(normalizeEmployeeId(employee.employeeId), employee);
    }
    return byId;
  }, [employees]);

  const locationPlantFilteredAssets = useMemo(() => {
    let list = filteredAssets;
    if (selectedLocation !== 'All') {
      list = list.filter((a) => assetMatchesLocation(a, selectedLocation));
    }

    if (selectedPlant !== 'All') {
      list = list.filter((a) => assetMatchesPlant(a, selectedPlant, plantOptions));
    }

    return list;
  }, [filteredAssets, plantOptions, selectedLocation, selectedPlant]);

  const displayAssets = useMemo(() => {
    let list = locationPlantFilteredAssets;

    if (selectedStatus !== 'All') {
      if (selectedStatus === 'Assigned') {
        list = list.filter(isAssetAssignedToEmployee);
      } else if (selectedStatus === 'Available') {
        list = list.filter((a) => !a.status || a.status === 'Available');
      } else if (selectedStatus === 'Expiry') {
        list = list.filter((a) => isSoftwareLicenseExpired(a));
      } else if (selectedStatus === 'Renewable' || selectedStatus === 'Upcoming') {
        list = list.filter((a) => isSoftwareLicenseRenewable(a));
      } else if (selectedStatus === 'Maintenance') {
        list = list.filter((a) => a.status === 'Under Maintenance' || a.maintenanceRequired === 'Yes');
      } else if (selectedStatus === 'Damaged') {
        list = list.filter((a) => a.status === 'Damaged' || a.status === 'Scrap');
      } else if (selectedStatus === 'Lost') {
        list = list.filter((a) => a.status === 'Lost');
      } else {
        list = list.filter((a) => a.status === selectedStatus);
      }
    }
    return list;
  }, [locationPlantFilteredAssets, selectedStatus]);

  const dashboardAssignedCount = useMemo(
    () => locationPlantFilteredAssets.filter(isAssetAssignedToEmployee).length,
    [locationPlantFilteredAssets]
  );

  const dashboardAvailableCount = useMemo(() => {
    return locationPlantFilteredAssets.filter((a) => !a.status || a.status === 'Available').length;
  }, [locationPlantFilteredAssets]);

  const dashboardMaintenanceOrExpiryCount = useMemo(() => {
    if (isSoftwareCategory) {
      return locationPlantFilteredAssets.filter((a) => isSoftwareLicenseExpired(a)).length;
    }
    return locationPlantFilteredAssets.filter(
      (a) => a.status === 'Under Maintenance' || a.maintenanceRequired === 'Yes'
    ).length;
  }, [locationPlantFilteredAssets, isSoftwareCategory]);

  const dashboardRenewableSoftwareCount = useMemo(
    () => locationPlantFilteredAssets.filter((a) => isSoftwareLicenseRenewable(a)).length,
    [locationPlantFilteredAssets]
  );

  const missingStats = useMemo(() => {
    let activeCount = 0;
    let recoveredCount = 0;
    let totalCount = 0;
    let standaloneActiveCount = 0;
    let packageActiveCount = 0;

    for (const m of missingItemRecords) {
      const parentAssetId = m['Parent Asset ID'];
      const isStandalone = isStandaloneMissingParent(parentAssetId);
      let include = false;

      if (isStandalone) {
        const matchesCategory = selectedCategory === 'All' || missingItemMatchesCategory(m, selectedCategory);
        if (!matchesCategory) continue;

        const empId = m['Employee ID'];
        if (empId) {
          const emp = employeesById.get(normalizeEmployeeId(String(empId)));
          if (emp) {
            const matchesLocation = selectedLocation === 'All' || sameFilterValue(emp.location, selectedLocation);
            if (!matchesLocation) continue;

            const matchesPlant = valueMatchesPlant(employeePlantValue(emp), selectedPlant, plantOptions);
            if (!matchesPlant) continue;
          } else {
            if (selectedLocation !== 'All' || selectedPlant !== 'All') continue;
          }
        } else {
          if (selectedLocation !== 'All' || selectedPlant !== 'All') continue;
        }

        include = true;
      } else {
        const asset = findAssetInLookup(scopedDashboardAssetsLookup, parentAssetId);
        if (!asset) continue;

        const matchesCategory = selectedCategory === 'All' || assetMatchesSidebarCategory(asset, selectedCategory);
        if (!matchesCategory) continue;

        const matchesLocation = assetMatchesLocation(asset, selectedLocation);
        if (!matchesLocation) continue;

        const matchesPlant = assetMatchesPlant(asset, selectedPlant, plantOptions);
        if (!matchesPlant) continue;

        include = true;
      }

      if (!include) continue;
      totalCount += 1;
      if (m.Status === 'Missing') activeCount += 1;
      if (m.Status === 'Recovered') recoveredCount += 1;
      if (m.Status === 'Missing' && isStandalone) standaloneActiveCount += 1;
      if (m.Status === 'Missing' && !isStandalone) packageActiveCount += 1;
    }

    return {
      activeCount,
      recoveredCount,
      totalCount,
      standaloneActiveCount,
      packageActiveCount,
    };
  }, [
    missingItemRecords,
    scopedDashboardAssetsLookup,
    employeesById,
    plantOptions,
    selectedCategory,
    selectedLocation,
    selectedPlant,
  ]);

  const damagedStats = useMemo(() => {
    let activeCount = 0;
    let totalCount = 0;

    for (const d of damagedItemRecords) {
      const asset = findAssetInLookup(scopedDashboardAssetsLookup, d['Asset ID']);
      if (!asset) continue;

      const matchesCategory = selectedCategory === 'All' || assetMatchesSidebarCategory(asset, selectedCategory);
      if (!matchesCategory) continue;

      const matchesLocation = assetMatchesLocation(asset, selectedLocation);
      if (!matchesLocation) continue;

      const matchesPlant = assetMatchesPlant(asset, selectedPlant, plantOptions);
      if (!matchesPlant) continue;

      totalCount += 1;
      if (d.Status !== 'Repaired') activeCount += 1;
    }

    return {
      activeCount,
      totalCount,
    };
  }, [
    damagedItemRecords,
    scopedDashboardAssetsLookup,
    plantOptions,
    selectedCategory,
    selectedLocation,
    selectedPlant,
  ]);

  const categorySummaryStats = useMemo(() => {
    const stats = new Map<string, CategorySummaryStats>();
    const getStats = (cat: string) => {
      let next = stats.get(cat);
      if (!next) {
        next = emptyCategorySummaryStats();
        stats.set(cat, next);
      }
      return next;
    };

    for (const asset of scopedDashboardAssets) {
      if (!assetMatchesLocation(asset, selectedLocation)) continue;
      if (!assetMatchesPlant(asset, selectedPlant, plantOptions)) continue;

      const assigned = isAssetAssignedToEmployee(asset);
      const available = !asset.status || asset.status === 'Available';
      const expired = isSoftwareLicenseExpired(asset);
      const maintenance =
        asset.status === 'Under Maintenance' ||
        asset.status === 'Under Repair' ||
        asset.maintenanceRequired === 'Yes';
      const lost = asset.status === 'Lost';

      for (const category of getDashboardAssetCategories(asset)) {
        const entry = getStats(category);
        entry.total += 1;
        if (available) entry.available += 1;
        if (assigned) entry.assigned += 1;
        if (category === SOFTWARE_LICENSE_CATEGORY ? expired : maintenance) entry.repair += 1;
        if (lost) entry.lost += 1;
      }
    }

    for (const damaged of damagedItemRecords) {
      if (damaged.Status === 'Repaired') continue;
      const asset = findAssetInLookup(scopedDashboardAssetsLookup, damaged['Asset ID']);
      if (!asset) continue;
      if (!assetMatchesLocation(asset, selectedLocation)) continue;
      if (!assetMatchesPlant(asset, selectedPlant, plantOptions)) continue;

      for (const category of getDashboardAssetCategories(asset)) {
        if (category !== SOFTWARE_LICENSE_CATEGORY) {
          getStats(category).repair += 1;
        }
      }
    }

    return stats;
  }, [
    scopedDashboardAssets,
    scopedDashboardAssetsLookup,
    damagedItemRecords,
    selectedLocation,
    selectedPlant,
    plantOptions,
  ]);


  const exportToExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(displayAssets);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assets');
      XLSX.writeFile(wb, `${APP_SHORT_NAME}_Export_${formatFilenameDate()}.xlsx`);
      toast.success('Exported!');
    } catch {
      toast.error('Export failed');
    }
  };

  const onDeleteConfirm = () => {
    if (deleteConfirmId === null) return;
    executeDelete(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const plantsFiltered = useMemo(() => {
    return selectedLocation === 'All'
      ? plantOptions
      : plantOptions.filter((p) => !p.location || sameScopeOption(p.location, selectedLocation));
  }, [plantOptions, selectedLocation]);

  const departmentLabel = useMemo(() => {
    if (user?.role === 'HR') return 'HR';
    if (user?.role === 'IT Admin' || user?.role === 'Admin') return 'IT';
    return user?.role || 'User';
  }, [user?.role]);

  const headerLocationPlant = useMemo(() => {
    const location =
      selectedLocation !== 'All'
        ? selectedLocation
        : user?.locations?.[0] || locations[0] || '—';

    const plantCode =
      selectedPlant !== 'All' ? selectedPlant : user?.plants?.[0];

    if (plantCode) {
      const plantRec = plantOptions.find(
        (p) => sameFilterValue(p.code, plantCode) || sameFilterValue(p.name, plantCode)
      );
      const plantName = plantRec?.name || plantCode;
      return `${location} (${plantName})`;
    }

    return location;
  }, [selectedLocation, selectedPlant, user, locations, plantOptions]);

  const hasActiveFilters =
    selectedLocation !== 'All' || selectedPlant !== 'All' || selectedStatus !== 'All';

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/50">
      {headerPortalNode && createPortal(
        <div className="flex items-center gap-3 w-full justify-end pr-4 lg:pr-5">
          <div className="flex items-center shrink-0 min-w-[150px] max-w-[300px]">
            <p className="text-[11px] font-bold text-slate-300 truncate">
              {headerLocationPlant} <span className="text-slate-500 px-1">|</span> {departmentLabel}
            </p>
          </div>
          <div className="relative flex-1 max-w-md min-w-[150px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isSoftwareCategory
                  ? 'Search software...'
                  : 'Search assets...'
              }
              className="w-full pl-10 pr-4 py-2 bg-white/95 border border-white/10 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50 transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filtersOpen || hasActiveFilters
                  ? 'bg-white text-[#113355] hover:bg-slate-100'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Filter size={14} />
              <span className="hidden min-[1500px]:inline">Filter</span>
              <ChevronDown
                size={12}
                className={filtersOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            </button>

            {/* View settings: Card / Grid / Table */}
            <div
              className={`relative shrink-0 z-[60] ${viewingQR ? 'hidden' : ''}`}
              ref={viewMenuRef}
            >
              <button
                type="button"
                onClick={() => setViewMenuOpen((o) => !o)}
                className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Settings2 size={14} /> <span className="hidden min-[1500px]:inline">View</span>
                <ChevronDown size={12} className={viewMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {viewMenuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[11rem] w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] p-1.5 font-sans whitespace-nowrap">
                  {([
                    { key: 'card', label: 'Card View', icon: LayoutGrid },
                    { key: 'grid', label: 'Grid View', icon: Eye },
                    { key: 'table', label: 'Table View', icon: List },
                  ] as { key: AssetViewMode; label: string; icon: typeof List }[]).map((opt) => {
                    const Icon = opt.icon;
                    const active = viewMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setViewMode(opt.key);
                          setViewMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={14} /> {opt.label}
                        {active && <CheckCircle2 size={13} className="ml-auto text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                toast.promise(
                  (async () => {
                    await syncDatabaseAssets({
                      userEmail: user?.email,
                      userRole: user?.role,
                      fetchAssets,
                    });
                    await Promise.all([
                      MISSING_ITEMS_FEATURE_ENABLED ? loadMissingItems(true) : Promise.resolve(),
                      loadDamagedItems(true),
                    ]);
                  })(),
                  {
                    loading: SYNC_DATABASE_MSG,
                    success: SYNC_DATABASE_OK,
                    error: (err) =>
                      err instanceof Error ? err.message : SYNC_DATABASE_ERR,
                  },
                  { id: 'sync-assets' }
                );
              }}
              className={`px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="sr-only">Sync</span>
            </button>
            <button
              type="button"
              onClick={exportToExcel}
              className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download size={14} /> <span className="sr-only">Export</span>
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/assets/new', {
                  state: newAssetPrefillFromCategory(
                    selectedCategory !== 'All' ? selectedCategory : undefined
                  ),
                })
              }
              className="px-3 py-2 bg-white hover:bg-slate-100 text-[#113355] rounded-lg text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={15} strokeWidth={3} />
              <span className="hidden min-[1700px]:inline">
                {isSoftwareCategory
                  ? 'New Software'
                  : isCctvSidebarCategory
                    ? 'New Camera/NVR'
                    : 'New Asset'}
              </span>
              <span className="min-[1700px]:hidden">New</span>
            </button>
          </div>
        </div>,
        headerPortalNode
      )}

      {filtersOpen && (
        <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 shrink-0 w-full">
          <div className="flex flex-wrap gap-4 items-end w-full">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider shrink-0">
              <Filter size={14} className="text-blue-500" /> Filters
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[9px] uppercase font-black text-slate-400">Location</span>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setSelectedPlant('All');
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Locations</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[9px] uppercase font-black text-slate-400">Plant / Plant Code</span>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Plants</option>
                {plantsFiltered.map((p) => (
                  <option key={p.code} value={p.code}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[9px] uppercase font-black text-slate-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Assigned">Assigned / In Use</option>
                {isSoftwareCategory ? (
                  <>
                    <option value="Expiry">Expired</option>
                    <option value="Renewable">Renewable Date</option>
                  </>
                ) : (
                  <>
                    <option value="Maintenance">Under Maintenance</option>
                    <option value="Damaged">Damaged / Scrap</option>
                    <option value="Lost">Lost</option>
                  </>
                )}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation('All');
                  setSelectedPlant('All');
                  setSelectedStatus('All');
                }}
                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider shrink-0 pb-1.5"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 shrink-0">
        {selectedCategory !== 'All' && (
          <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Category</span>
              <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">{selectedCategory}</h2>
            </div>
            {!(
              user &&
              user.role !== 'IT Admin' &&
              user.categories &&
              user.categories.length > 0 &&
              !user.categories.includes('All')
            ) && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0"
              >
                ← All Categories
              </button>
            )}
          </div>
        )}
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 ${isSoftwareCategory ? 'lg:grid-cols-5' : 'lg:grid-cols-5'}`}>
              <div 
                onClick={() => {
                  setSelectedStatus('All');
                }}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm ${selectedStatus === 'All' ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-slate-200'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${selectedStatus === 'All' ? 'text-slate-600' : 'text-slate-400'}`}>
                      {selectedCategory === 'Software / License Assets' ? 'Total Software' : 'Total Assets'}
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{locationPlantFilteredAssets.length}</h3>
                  </div>
                  <Layers className={`w-6 h-6 shrink-0 ${selectedStatus === 'All' ? 'text-slate-700' : 'text-slate-400'}`} />
                </div>
              </div>
              
              <div 
                onClick={() => {
                  setSelectedStatus('Assigned');
                }}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between ${selectedStatus === 'Assigned' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}
              >
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${selectedStatus === 'Assigned' ? 'text-blue-600' : 'text-slate-400'}`}>Assigned / In Use</p>
                  <h3 className="text-2xl font-black text-blue-600 mt-1">
                    {dashboardAssignedCount}
                  </h3>
                </div>
                <CheckCircle2 className={`w-8 h-8 shrink-0 ${selectedStatus === 'Assigned' ? 'text-blue-500' : 'text-blue-100'}`} />
              </div>
              
              <div 
                onClick={() => setSelectedStatus('Available')}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between ${
                  selectedStatus === 'Available'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${
                    selectedStatus === 'Available'
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }`}>Available</p>
                  <h3 className="text-2xl font-black text-emerald-600 mt-1">
                    {dashboardAvailableCount}
                  </h3>
                </div>
                <CheckCircle className={`w-8 h-8 shrink-0 ${
                  selectedStatus === 'Available'
                    ? 'text-emerald-500'
                    : 'text-emerald-100'
                }`} />
              </div>
              
              {isSoftwareCategory && (
              <div 
                onClick={() => setSelectedStatus(renewableSoftwareCardStatus)}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between ${selectedStatus === renewableSoftwareCardStatus ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'}`}
              >
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${selectedStatus === renewableSoftwareCardStatus ? 'text-violet-600' : 'text-slate-400'}`}>
                    Renewable Date
                  </p>
                  <h3 className="text-2xl font-black text-violet-700 mt-1">
                    {dashboardRenewableSoftwareCount}
                  </h3>
                </div>
                <AlertCircle className={`w-8 h-8 shrink-0 ${selectedStatus === renewableSoftwareCardStatus ? 'text-violet-500' : 'text-violet-100'}`} />
              </div>
              )}

              <div 
                onClick={() => setSelectedStatus(maintenanceCardStatus)}
                className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between ${selectedStatus === maintenanceCardStatus ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200'}`}
              >
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${selectedStatus === maintenanceCardStatus ? 'text-amber-600' : 'text-slate-400'}`}>
                    {isSoftwareCategory ? 'Expiry' : 'Maintenance'}
                  </p>
                  <h3 className="text-2xl font-black text-amber-600 mt-1">
                    {dashboardMaintenanceOrExpiryCount}
                  </h3>
                </div>
                <AlertTriangle className={`w-8 h-8 shrink-0 ${selectedStatus === maintenanceCardStatus ? 'text-amber-500' : 'text-amber-100'}`} />
              </div>
              
              {!isSoftwareCategory && (
              <div 
                onClick={() => navigate('/damaged-scrap')}
                className="cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between text-left border-slate-200 hover:border-red-300"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-600">
                    Damaged / Scrap
                  </p>
                  <h3 className="text-2xl font-black mt-1 text-red-700">
                    {damagedStats.activeCount}
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate('/damaged-scrap'); }} 
                    className="text-[9px] text-red-600/80 mt-1 font-bold hover:text-red-800 transition-colors"
                  >
                    View component tracking →
                  </button>
                </div>
                <Trash2 className="w-8 h-8 shrink-0 text-red-100" />
              </div>
              )}
              {MISSING_ITEMS_FEATURE_ENABLED && !isSoftwareCategory && (
              <div 
                onClick={() => navigate('/missing')}
                className="cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between text-left border-slate-200 hover:border-amber-300"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                    Missing items
                  </p>
                  <h3 className="text-2xl font-black mt-1 text-amber-700">
                    {missingStats.activeCount}
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate('/missing'); }} 
                    className="text-[9px] text-amber-600/80 mt-1 font-bold hover:text-amber-800 transition-colors"
                  >
                    View component tracking →
                  </button>
                </div>
                <AlertCircle className="w-8 h-8 shrink-0 text-amber-100" />
              </div>
              )}
            </div>
      </div>

      <div className="flex-1 overflow-auto px-6 lg:px-8 pb-6 lg:pb-8 pt-4">
        {/* Categories Dynamic Overview Grid (Visible when category is 'All') */}
        {selectedCategory === 'All' && (
          <div className="mb-10">
            <div 
              onClick={() => setSummaryCollapsed(!summaryCollapsed)}
              className="flex items-center justify-between cursor-pointer select-none group mb-4"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 group-hover:text-slate-600 transition-colors">
                <Layers size={14} /> Category Summary
              </h3>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <span>{summaryCollapsed ? 'Show Summary' : 'Hide Summary'}</span>
                {summaryCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            <AnimatePresence initial={false}>
              {!summaryCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100" />
                            <div className="h-4 bg-slate-200 rounded w-1/2" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div className="h-6 bg-slate-200 rounded" />
                            <div className="h-6 bg-slate-200 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1 pb-1">
                      {ALL_CATEGORIES.filter(cat => 
                        visibleCategories.includes(cat) ||
                        (MISSING_ITEMS_FEATURE_ENABLED && cat === 'Missing Items')
                      ).map((cat) => {
                        const Icon = CATEGORY_ICONS[cat] || Cpu;
                        const style = CATEGORY_STYLES[cat] || {
                          gradient: 'from-slate-50 to-slate-100',
                          text: 'text-slate-700',
                          iconBg: 'bg-slate-100 text-slate-700',
                          shadow: 'hover:shadow-slate-500/5',
                          border: 'border-slate-200'
                        };

                        const stats =
                          cat === 'Missing Items'
                            ? {
                                total: missingStats.activeCount,
                                available: missingStats.recoveredCount,
                                assigned: missingStats.totalCount,
                                repair: missingStats.standaloneActiveCount,
                                lost: missingStats.packageActiveCount,
                              }
                            : categorySummaryStats.get(cat) || emptyCategorySummaryStats();
                        const { total, available, assigned, repair, lost } = stats;

                        const handleClick = () => {
                          if (cat === 'Missing Items') {
                            navigate('/missing');
                          } else {
                            setSearchParams({ category: cat });
                          }
                        };

                        return (
                          <div
                            key={cat}
                            onClick={handleClick}
                            className={`cursor-pointer bg-white border ${style.border} rounded-2xl p-5 hover:scale-[1.01] hover:shadow-xl ${style.shadow} transition-all duration-300 group flex flex-col justify-between`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center font-bold`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                    {cat}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                                    {cat === 'Missing Items' ? 'Active missing' : 'Registered'}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-lg font-black ${style.text} bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 font-mono`}>
                                {total}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                              <div className="bg-emerald-50/50 border border-emerald-100/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400 block font-sans">
                                  {cat === 'Missing Items' ? 'Recovered' : 'Available'}
                                </span>
                                <span className="text-emerald-700 font-bold text-xs">{available}</span>
                              </div>
                              <div className="bg-blue-50/50 border border-blue-100/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400 block font-sans">
                                  {cat === 'Missing Items' ? 'Total logged' : 'Assigned'}
                                </span>
                                <span className="text-blue-700 font-bold text-xs">{assigned}</span>
                              </div>
                              <div className="bg-amber-50/50 border border-amber-100/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400 block font-sans">
                                  {cat === 'Missing Items' ? 'Standalone' : cat === SOFTWARE_LICENSE_CATEGORY ? 'Expired' : 'Repair/Maint'}
                                </span>
                                <span className="text-amber-700 font-bold text-xs">{repair}</span>
                              </div>
                              <div className="bg-rose-50/50 border border-rose-100/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400 block font-sans">
                                  {cat === 'Missing Items' ? 'From package' : 'Missing'}
                                </span>
                                <span className="text-rose-700 font-bold text-xs">{lost}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {loading && assets.length === 0 ? (
          <AssetTableSkeleton />
        ) : (
          <AssetTable
            assets={displayAssets}
            onEdit={(a) => navigate(`/assets/${assetRouteId(a)}/edit`)}
            onDelete={(id) => setDeleteConfirmId(id)}
            onViewQR={setViewingQR}
            onViewAsset={(a) => navigate(`/assets/${assetRouteId(a)}`)}
            role={user?.role}
            viewMode={viewMode}
            selectedAssetIds={selectedAssetIds}
            onSelectionChange={setSelectedAssetIds}
          />
        )}
      </div>

      <AnimatePresence>
        {viewingQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setViewingQR(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 w-full max-w-xs sm:max-w-sm my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <QRCodeDisplay asset={viewingQR} onClose={() => setViewingQR(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteAssetModal
        open={deleteConfirmId !== null}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={onDeleteConfirm}
        deleting={false}
      />

      {/* Floating Action Bar for Bulk QR Printing */}
      <AnimatePresence>
        {selectedAssetIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 80, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 left-1/2 bg-slate-900/90 backdrop-blur-md text-white border border-slate-800 rounded-2xl py-3 px-6 shadow-2xl z-[100] flex items-center gap-6 no-print shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider font-mono">
                {selectedAssetIds.length} Selected
              </span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800" />
            <button
              onClick={() => setSelectedAssetIds([])}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              Deselect
            </button>
            <button
              onClick={() => {
                const selectedAssets = assets.filter((a) => selectedAssetIds.includes(a.id));
                setBulkPrintingAssets(selectedAssets);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-600/20 uppercase tracking-wider"
            >
              Print QR
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk QR Print Modal */}
      {bulkPrintingAssets && (
        <BulkQRPrintModal
          assets={bulkPrintingAssets}
          onClose={() => setBulkPrintingAssets(null)}
        />
      )}

    </div>
  );
}
