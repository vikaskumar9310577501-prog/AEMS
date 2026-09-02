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
  User,
  QrCode,
  Boxes,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AssetTable, { AssetViewMode } from '../components/AssetTable';
import QRCodeDisplay from '../components/QRCodeDisplay';
import BulkQRPrintModal from '../components/BulkQRPrintModal';
import DeleteAssetModal from '../components/DeleteAssetModal';
import AvailableAssetsModal from '../components/AvailableAssetsModal';
import { AssetTableSkeleton } from '../components/LoadingSkeleton';
import { APP_NAME, APP_SHORT_NAME } from '../lib/constants';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { formatFilenameDate } from '../lib/formatDisplayDate';
import { SYNC_DATABASE_MSG, SYNC_DATABASE_OK, SYNC_DATABASE_ERR } from '../lib/uiLabels';
import { syncDatabaseAssets } from '../lib/syncDatabase';
import { assetRouteId, buildAssetLookupIndex, findAssetInLookup } from '../lib/assetLookup';
import { useApp } from '../context/AppProvider';
import { canAccessAssetManagement, resolveDefaultRouteForUser } from '../lib/userPermissions';
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
  'Electrical Assets',
  'Production Assets',
  'Safety Assets',
  'Vehicle Assets',
  'Furniture Assets',
  'Software / License Assets',
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
  'Electrical Assets': Zap,
  'Production Assets': Factory,
  'Safety Assets': ShieldAlert,
  'Vehicle Assets': Car,
  'Furniture Assets': TableIcon,
  'Software / License Assets': FileText,
  'Maintenance Assets': Wrench,
  'Missing Items': AlertCircle,
};

const CATEGORY_STYLES: Record<string, { gradient: string; text: string; iconBg: string; shadow: string; border: string }> = {
  'IT Assets': { gradient: 'from-blue-50 to-indigo-50/30', text: 'text-blue-700', iconBg: 'bg-blue-100 text-blue-700', shadow: 'hover:shadow-blue-500/5', border: 'border-blue-100' },
  [SIDEBAR_CCTV_CATEGORY]: { gradient: 'from-cyan-50 to-violet-50/30', text: 'text-cyan-700', iconBg: 'bg-cyan-100 text-cyan-700', shadow: 'hover:shadow-cyan-500/5', border: 'border-cyan-100' },
  Camera: { gradient: 'from-cyan-50 to-sky-50/30', text: 'text-cyan-700', iconBg: 'bg-cyan-100 text-cyan-700', shadow: 'hover:shadow-cyan-500/5', border: 'border-cyan-100' },
  NVR: { gradient: 'from-violet-50 to-purple-50/30', text: 'text-violet-700', iconBg: 'bg-violet-100 text-violet-700', shadow: 'hover:shadow-violet-500/5', border: 'border-violet-100' },
  'Electrical Assets': { gradient: 'from-amber-50 to-yellow-50/30', text: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-700', shadow: 'hover:shadow-amber-500/5', border: 'border-amber-100' },
  'Production Assets': { gradient: 'from-purple-50 to-violet-50/30', text: 'text-purple-700', iconBg: 'bg-purple-100 text-purple-700', shadow: 'hover:shadow-purple-500/5', border: 'border-purple-100' },
  'Safety Assets': { gradient: 'from-rose-50 to-red-50/30', text: 'text-rose-700', iconBg: 'bg-rose-100 text-rose-700', shadow: 'hover:shadow-rose-500/5', border: 'border-rose-100' },
  'Vehicle Assets': { gradient: 'from-emerald-50 to-teal-50/30', text: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-700', shadow: 'hover:shadow-emerald-500/5', border: 'border-emerald-100' },
  'Furniture Assets': { gradient: 'from-amber-50 to-yellow-50/10', text: 'text-amber-800', iconBg: 'bg-amber-100 text-amber-800', shadow: 'hover:shadow-amber-700/5', border: 'border-amber-200' },
  'Software / License Assets': { gradient: 'from-fuchsia-50 to-pink-50/30', text: 'text-fuchsia-700', iconBg: 'bg-fuchsia-100 text-fuchsia-700', shadow: 'hover:shadow-fuchsia-500/5', border: 'border-fuchsia-100' },
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

  if (!canAccessAssetManagement(user)) {
    return <Navigate to={resolveDefaultRouteForUser(user)} replace />;
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
  const [showAvailableModal, setShowAvailableModal] = useState(false);

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

  const userScopeBadge = useMemo(() => {
    const isGlobal =
      user?.role === 'IT Admin' ||
      !user?.locations?.length ||
      user.locations.some((l) => l.trim().toLowerCase() === 'all');

    const loc = isGlobal ? 'All Locations' : (user?.locations || []).join(', ');

    const plantList = isGlobal
      ? 'All Plants'
      : (user?.plants || [])
          .map((pCode) => {
            const clean = pCode.trim();
            const rec = plants.find(
              (p) => sameFilterValue(p.code, clean) || sameFilterValue(p.name, clean)
            );
            return rec && rec.name && rec.name.toLowerCase() !== rec.code.toLowerCase()
              ? `${rec.name} (${rec.code})`
              : clean;
          })
          .join(', ') || 'All Plants';

    return { isGlobal, location: loc, plant: plantList };
  }, [user, plants]);

  const hasActiveFilters =
    selectedLocation !== 'All' || selectedPlant !== 'All' || selectedStatus !== 'All';

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F8FAFC]">
      {headerPortalNode && createPortal(
        <div className="flex items-center gap-2.5 w-full justify-end pr-2 sm:pr-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm sm:max-w-md min-w-[140px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isSoftwareCategory
                  ? 'Search software, license, vendor...'
                  : 'Search assets, serial, employee...'
              }
              className="w-full pl-9 pr-4 py-2 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium text-slate-900 shadow-inner-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border ${
                filtersOpen || hasActiveFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Filter Assets"
            >
              <Filter size={14} className={filtersOpen || hasActiveFilters ? 'text-blue-600' : 'text-slate-500'} />
              <span className="hidden xl:inline">Filter</span>
              <ChevronDown
                size={12}
                className={filtersOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            </button>

            {/* View switcher: Grid / Card / Table */}
            <div
              className={`relative shrink-0 z-[60] ${viewingQR ? 'hidden' : ''}`}
              ref={viewMenuRef}
            >
              <button
                type="button"
                onClick={() => setViewMenuOpen((o) => !o)}
                className="p-2 sm:px-3 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                title="Switch View"
              >
                <Settings2 size={14} className="text-slate-500" />
                <span className="hidden xl:inline capitalize">{viewMode}</span>
                <ChevronDown size={12} className={viewMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {viewMenuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[11rem] w-44 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] p-1.5 font-sans whitespace-nowrap">
                  {([
                    { key: 'grid', label: 'Grid View', icon: Eye },
                    { key: 'card', label: 'Card View', icon: LayoutGrid },
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
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

            {/* Sync Database Button */}
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
              className={`p-2 sm:px-2.5 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              title="Sync with Google Sheets / SQL"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span className="sr-only">Sync</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={exportToExcel}
              className="p-2 sm:px-2.5 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Export to Excel (.xlsx)"
            >
              <Download size={14} />
              <span className="sr-only">Export</span>
            </button>

            {/* + New Asset Primary Action Button */}
            <button
              type="button"
              onClick={() =>
                navigate('/assets/new', {
                  state: newAssetPrefillFromCategory(
                    selectedCategory !== 'All' ? selectedCategory : undefined
                  ),
                })
              }
              className="px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="hidden sm:inline">
                {isSoftwareCategory
                  ? 'New Software'
                  : isCctvSidebarCategory
                    ? 'New Camera/NVR'
                    : 'New Asset'}
              </span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>,
        headerPortalNode
      )}

      {/* Collapsible Filter Bar */}
      {filtersOpen && (
        <div className="bg-white border-b border-slate-200/90 px-4 lg:px-8 py-3.5 shrink-0 w-full shadow-sm">
          <div className="flex flex-wrap gap-4 items-end w-full">
            <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider shrink-0">
              <Filter size={14} className="text-blue-600" /> Filter Options
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[10px] uppercase font-black text-slate-400">Location</span>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setSelectedPlant('All');
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="All">All Locations</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[10px] uppercase font-black text-slate-400">Plant / Plant Code</span>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="All">All Plants</option>
                {plantsFiltered.map((p) => (
                  <option key={p.code} value={p.code}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-none sm:min-w-[160px]">
              <span className="text-[10px] uppercase font-black text-slate-400">Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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
                className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors uppercase tracking-wider shrink-0 pb-1.5 underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top 5-Column Modern KPI Cards Bar */}
      <div className="px-4 lg:px-6 pt-3.5 pb-2 shrink-0 space-y-2.5">
        {/* Active Location & Plant Access Scope Display */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-slate-200/90 text-slate-800 shadow-xs text-xs">
              <div className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin size={12} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Assigned Scope:</span>
                <span className="font-bold text-slate-800">{userScopeBadge.location}</span>
                <span className="text-slate-300">·</span>
                <span className="font-bold text-blue-600">{userScopeBadge.plant}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3`}>
          {/* Card 1: TOTAL ASSETS */}
          <div
            onClick={() => setSelectedStatus('All')}
            className={`group cursor-pointer bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
              selectedStatus === 'All'
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200/90 hover:border-blue-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedCategory === 'Software / License Assets' ? 'TOTAL SOFTWARE' : 'TOTAL ASSETS'}
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                  {locationPlantFilteredAssets.length}
                </h3>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <Boxes className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            {/* Active Indicator Line */}
            <div className={`mt-2.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 ${selectedStatus === 'All' ? 'bg-blue-600' : 'bg-transparent group-hover:bg-blue-200'} transition-all`} />
          </div>

          {/* Card 2: ASSIGNED / IN USE */}
          <div
            onClick={() => setSelectedStatus('Assigned')}
            className={`group cursor-pointer bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
              selectedStatus === 'Assigned'
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200/90 hover:border-blue-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ASSIGNED / IN USE
                </p>
                <h3 className="text-2xl font-black text-blue-600 mt-1 tracking-tight">
                  {dashboardAssignedCount}
                </h3>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className={`mt-2.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 ${selectedStatus === 'Assigned' ? 'bg-blue-600' : 'bg-transparent group-hover:bg-blue-200'} transition-all`} />
          </div>

          {/* Card 3: AVAILABLE */}
          <div
            onClick={() => {
              setSelectedStatus('Available');
              setShowAvailableModal(true);
            }}
            className={`group cursor-pointer bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
              selectedStatus === 'Available'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-slate-200/90 hover:border-emerald-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AVAILABLE
                </p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1 tracking-tight">
                  {dashboardAvailableCount}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                  Assets Available
                </p>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 group-hover:underline flex items-center gap-0.5">
                Click to View →
              </span>
            </div>

            <div className={`mt-1.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 ${selectedStatus === 'Available' ? 'bg-emerald-500' : 'bg-transparent group-hover:bg-emerald-400'} transition-all`} />
          </div>

          {/* Card 4: MAINTENANCE / EXPIRY */}
          <div
            onClick={() => setSelectedStatus(maintenanceCardStatus)}
            className={`group cursor-pointer bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
              selectedStatus === maintenanceCardStatus
                ? 'border-amber-500 ring-2 ring-amber-500/20'
                : 'border-slate-200/90 hover:border-amber-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isSoftwareCategory ? 'EXPIRY' : 'MAINTENANCE'}
                </p>
                <h3 className="text-2xl font-black text-amber-600 mt-1 tracking-tight">
                  {dashboardMaintenanceOrExpiryCount}
                </h3>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className={`mt-2.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 ${selectedStatus === maintenanceCardStatus ? 'bg-amber-500' : 'bg-transparent group-hover:bg-amber-200'} transition-all`} />
          </div>

          {/* Card 5: DAMAGED / SCRAP */}
          {!isSoftwareCategory && (
            <div
              onClick={() => navigate('/damaged-scrap')}
              className="group cursor-pointer bg-white border border-slate-200/90 hover:border-rose-200 rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between text-left"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    SCRAPPED
                  </p>
                  <h3 className="text-2xl font-black text-rose-600 mt-1 tracking-tight">
                    {damagedStats.activeCount}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/damaged-scrap');
                    }}
                    className="text-[9px] text-rose-500 font-bold hover:text-rose-700 transition-colors mt-0.5 block"
                  >
                    View components →
                  </button>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shadow-xs">
                  <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="mt-2.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 bg-transparent group-hover:bg-rose-200 transition-all" />
            </div>
          )}

          {isSoftwareCategory && (
            <div
              onClick={() => setSelectedStatus(renewableSoftwareCardStatus)}
              className={`group cursor-pointer bg-white border rounded-xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                selectedStatus === renewableSoftwareCardStatus
                  ? 'border-violet-500 ring-2 ring-violet-500/20'
                  : 'border-slate-200/90 hover:border-violet-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    RENEWABLE DATE
                  </p>
                  <h3 className="text-2xl font-black text-violet-700 mt-1 tracking-tight">
                    {dashboardRenewableSoftwareCount}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shadow-xs">
                  <AlertCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className={`mt-2.5 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 h-1 ${selectedStatus === renewableSoftwareCardStatus ? 'bg-violet-600' : 'bg-transparent group-hover:bg-violet-200'} transition-all`} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-auto px-4 lg:px-8 pb-8 pt-2">
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

      {/* Floating Action Button (FAB) for Quick Print / Scanner matching Image 2 */}
      <button
        type="button"
        onClick={() => {
          if (displayAssets.length > 0) {
            setBulkPrintingAssets(displayAssets.slice(0, 24));
          } else {
            toast('No assets to print QR', { icon: 'ℹ️' });
          }
        }}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 flex items-center justify-center transition-all duration-300 z-40"
        title="Quick QR Batch Print"
      >
        <QrCode size={22} className="text-white" />
      </button>

      {/* Available Assets Modal (Interactive View with Dynamic Category Counts) */}
      <AvailableAssetsModal
        isOpen={showAvailableModal}
        onClose={() => setShowAvailableModal(false)}
        assets={locationPlantFilteredAssets}
        onSelectAsset={(asset) => navigate(`/assets/${assetRouteId(asset)}`)}
      />

    </div>
  );
}
