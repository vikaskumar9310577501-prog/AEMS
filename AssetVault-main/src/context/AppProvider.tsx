import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';
import type { Asset, AssetFormData } from '../types';
import type { AppSessionUser } from '../types/session';
import { mapAssetsFromApi } from '../lib/assetMap';
import { MAIN_CATEGORIES, healMisalignedCategoryFields } from '../lib/assetCatalogByType';
import { healMisalignedAssetFields } from '../lib/healAssetFields';
import { expandCategoriesForSidebar, assetMatchesSidebarCategory, resolveAssetMainCategory } from '../lib/dashboardCategories';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import {
  formDataToOptimisticAsset,
  normAssetId,
  patchAssetsList,
} from '../lib/optimisticAssets';
import { buildCleanedSubmitPayload, preserveExistingEditValues } from '../lib/submitAssetPayload';
import { isItAdminRole } from '../lib/userPermissions';
import {
  ASSETS_CACHE_KEY,
  DAY_MS,
  LEGACY_LOGIN_KEY,
  LEGACY_USER_KEY,
  LOGIN_TIME_KEY,
  SESSION_TOKEN_KEY,
  USER_STORAGE_KEY,
} from '../lib/constants';

function normalizeUser(raw: Record<string, unknown>): AppSessionUser {
  const cats = raw.categories ?? raw.Categories ?? raw.category ?? raw.access;
  return {
    email: String(raw.email || '').trim().toLowerCase(),
    role: String(raw.role || 'User'),
    locations: Array.isArray(raw.locations)
      ? (raw.locations as string[])
      : String(raw.locations || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    plants: Array.isArray(raw.plants)
      ? (raw.plants as string[])
      : String(raw.plants || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    categories: Array.isArray(cats)
      ? (cats as string[])
      : typeof cats === 'string'
        ? cats.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    allowDelete: !!raw.allowDelete || String(raw.allowDelete) === 'true',
  };
}

interface AppContextValue {
  user: AppSessionUser | null;
  authChecked: boolean;
  assets: Asset[];
  loading: boolean;
  visibleCategories: string[];
  fetchAssets: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
  handleSubmit: (formData: AssetFormData, editingAsset: Asset | null) => Promise<void>;
  deassignAsset: (
    asset: Asset,
    opts?: { remarks?: string; updatedBy?: string }
  ) => Promise<Asset>;
  executeDelete: (id: number | string) => Promise<void>;
  handleLogout: () => void;
  loginSuccess: (user: AppSessionUser, token?: string) => void;
  filterAssets: (
    assets: Asset[],
    opts: { searchQuery: string; selectedCategory: string }
  ) => Asset[];
}

const AppContext = createContext<AppContextValue | null>(null);

function normalizedScopeValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function sameScopeValue(left: unknown, right: unknown): boolean {
  const l = normalizedScopeValue(left);
  const r = normalizedScopeValue(right);
  return !!l && !!r && l === r;
}

function scopeValueIncludes(left: unknown, right: unknown): boolean {
  const l = normalizedScopeValue(left);
  const r = normalizedScopeValue(right);
  return !!l && !!r && (l === r || l.includes(r));
}

const visibleMainCategories = () =>
  MISSING_ITEMS_FEATURE_ENABLED
    ? MAIN_CATEGORIES
    : MAIN_CATEGORIES.filter((cat) => String(cat) !== 'Missing Items');

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AppSessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const assetsLoadedRef = useRef(false);
  const assetsFingerprintRef = useRef('');
  const assetsRef = useRef<Asset[]>([]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const persistAssets = useCallback((next: Asset[]) => {
    assetsRef.current = next;
    setAssets(next);
    localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(next));
  }, []);

  const handleLogout = useCallback(() => {
    void fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setUser(null);
    setAssets([]);
    assetsLoadedRef.current = false;
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
    localStorage.removeItem(LEGACY_LOGIN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }, []);

  const loginSuccess = useCallback(
    (userData: AppSessionUser, token?: string) => {
      setUser(userData);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(userData));
      if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
      const now = Date.now().toString();
      localStorage.setItem(LOGIN_TIME_KEY, now);
      localStorage.setItem(LEGACY_LOGIN_KEY, now);
      setTimeout(() => {
        toast.error('Session expired. Please login again.');
        handleLogout();
      }, DAY_MS);
    },
    [handleLogout]
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const sessionRes = await fetch(
          (import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/session',
          { credentials: 'include' }
        );
        if (sessionRes.ok) {
          const data = (await sessionRes.json()) as { user?: Record<string, unknown>; token?: string };
          if (!cancelled && data.user) {
            const parsedUser = normalizeUser(data.user);
            setUser(parsedUser);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsedUser));
            localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(parsedUser));
            if (data.token) localStorage.setItem(SESSION_TOKEN_KEY, data.token);
            const now = Date.now().toString();
            localStorage.setItem(LOGIN_TIME_KEY, now);
            localStorage.setItem(LEGACY_LOGIN_KEY, now);
            setAuthChecked(true);
            return;
          }
        }
      } catch {
        /* fall back to local cache below */
      }

      try {
        const stored =
          localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(LEGACY_USER_KEY);
        const ts =
          localStorage.getItem(LOGIN_TIME_KEY) || localStorage.getItem(LEGACY_LOGIN_KEY);
        if (stored && ts) {
          const parsedUser = normalizeUser(JSON.parse(stored));
          const loginTime = parseInt(ts, 10);
          const now = Date.now();
          if (now - loginTime < DAY_MS) {
            if (!cancelled) setUser(parsedUser);
            if (!cancelled) {
              fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/users?refresh=1', {
                credentials: 'include',
              })
                .then((r) => (r.ok ? r.json() : null))
                .then((usersList) => {
                  if (usersList && Array.isArray(usersList)) {
                    const fresh = usersList.find(
                      (u: { email: string }) =>
                        u.email.toLowerCase() === parsedUser.email.toLowerCase()
                    );
                    if (fresh) {
                      const freshUser = normalizeUser(fresh as Record<string, unknown>);
                      setUser(freshUser);
                      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
                      localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(freshUser));
                    }
                  }
                })
                .catch(() => {});
            }
            if (!cancelled) setAuthChecked(true);
            return;
          }
          localStorage.removeItem(USER_STORAGE_KEY);
          localStorage.removeItem(LEGACY_USER_KEY);
          localStorage.removeItem(LOGIN_TIME_KEY);
          localStorage.removeItem(LEGACY_LOGIN_KEY);
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(LEGACY_USER_KEY);
        localStorage.removeItem(LOGIN_TIME_KEY);
        localStorage.removeItem(LEGACY_LOGIN_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      if (!cancelled) setAuthChecked(true);
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterAssetsForHr = useCallback(
    (list: Asset[]) => {
      if (user?.role !== 'HR') return list;
      return list.filter(
        (asset) =>
          !!String(asset.employeeId || '').trim() ||
          !!String(asset.contactName || '').trim() ||
          !!String(asset.contactEmail || '').trim()
      );
    },
    [user]
  );

  const renormalizeCachedAssets = useCallback((list: Asset[]): Asset[] => {
    return list.map((asset) => {
      const fieldHealed = healMisalignedAssetFields(asset);
      const healed = healMisalignedCategoryFields({
        mainCategory: fieldHealed.mainCategory,
        subCategory: fieldHealed.subCategory,
        assetType: fieldHealed.assetType,
        make: fieldHealed.make,
        assetCode: fieldHealed.assetCode,
      });
      return {
        ...fieldHealed,
        mainCategory: healed.mainCategory,
        subCategory: healed.subCategory || fieldHealed.subCategory,
        assetType: (healed.assetType || fieldHealed.assetType) as Asset['assetType'],
      };
    });
  }, []);

  const loadAssetsFromCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(ASSETS_CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setAssets(filterAssetsForHr(renormalizeCachedAssets(parsed)));
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }, [filterAssetsForHr, renormalizeCachedAssets]);

  const fetchAssets = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    const silent = opts?.silent ?? false;
    const force = opts?.force ?? false;
    if (!silent) setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const url = force ? `${base}/api/assets?refresh=1` : `${base}/api/assets`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error || `Failed to load assets (${res.status})`
        );
      }
      const data = await res.json();
      const mapped = mapAssetsFromApi(data);
      const nextAssets = filterAssetsForHr(mapped);
      if (import.meta.env.DEV && mapped.length > 0) {
        const latest = mapped[mapped.length - 1];
        console.log("[AMS] Recent entries data source — fetched assets:", mapped.length, {
          latestId: latest.id,
          latestCpu: latest.cpu,
          latestRam: latest.ram,
          latestMac: latest.macAddress,
          latestEmail: latest.contactEmail,
          latestMobile: latest.contactMobile,
        });
      }
      setAssets(nextAssets);
      localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(nextAssets));
      try {
        const metaRes = await fetch(`${base}/api/assets/sync-meta`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { fingerprint?: string };
          if (meta.fingerprint) assetsFingerprintRef.current = meta.fingerprint;
        }
      } catch {
        /* meta optional */
      }
    } catch (err) {
      if (force) {
        throw err instanceof Error ? err : new Error('Failed to refresh from database');
      }
      if (!loadAssetsFromCache()) {
        const msg = err instanceof Error ? err.message : 'Failed to load assets. Check connection and refresh.';
        toast.error(msg);
      } else if (!silent) {
        toast.error('Showing saved assets — sheet sync will retry.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterAssetsForHr, loadAssetsFromCache]);

  useEffect(() => {
    if (user && !assetsLoadedRef.current) {
      assetsLoadedRef.current = true;
      const hadCache = loadAssetsFromCache();
      fetchAssets({ silent: hadCache });
    }
    if (!user) {
      assetsLoadedRef.current = false;
    }
  }, [user, fetchAssets, loadAssetsFromCache]);

  // Lightweight poll: sync-meta checks fingerprint; full fetch only when sheet data changed.
  useEffect(() => {
    if (!user) return;

    const pollSheetChanges = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ''}/api/assets/sync-meta`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok) return;

        const meta = (await res.json()) as {
          fingerprint?: string;
          syncing?: boolean;
        };

        const nextFp = meta.fingerprint || '';
        const prevFp = assetsFingerprintRef.current;

        if (!prevFp && nextFp) {
          assetsFingerprintRef.current = nextFp;
          return;
        }

        if (nextFp && prevFp && nextFp !== prevFp) {
          await fetchAssets({ silent: true });
        } else if (meta.syncing && prevFp) {
          // Background sync in progress — re-check shortly after it finishes.
          window.setTimeout(() => void pollSheetChanges(), 8000);
        }
      } catch {
        /* silent poll */
      }
    };

    // Poll every 15 seconds — fast enough to show other users' new assets
    const interval = window.setInterval(pollSheetChanges, 15 * 1000);
    return () => window.clearInterval(interval);
  }, [user, fetchAssets]);

  const visibleCategories = useMemo(() => {
    if (
      !user ||
      user.role === 'IT Admin' ||
      !user.categories ||
      user.categories.length === 0 ||
      user.categories.includes('All')
    ) {
      return expandCategoriesForSidebar(visibleMainCategories());
    }
    return expandCategoriesForSidebar(
      visibleMainCategories().filter((cat) => user.categories?.includes(cat))
    );
  }, [user]);

  const filterAssets = useCallback(
    (list: Asset[], opts: { searchQuery: string; selectedCategory: string }) => {
      let filtered = list;
      const { searchQuery, selectedCategory } = opts;

      if (selectedCategory !== 'All') {
        filtered = filtered.filter((a) => assetMatchesSidebarCategory(a, selectedCategory));
      }

      if (user && user.role !== 'IT Admin') {
        if (user.locations?.length && !user.locations.includes('All')) {
          filtered = filtered.filter((a) =>
            user.locations.some((loc) => sameScopeValue(a.location, loc) || scopeValueIncludes(a.location, loc))
          );
        }
        if (user.plants?.length && !user.plants.includes('All')) {
          filtered = filtered.filter((a) =>
            user.plants.some((p) => sameScopeValue(a.plantCode, p) || scopeValueIncludes(a.plantCode, p))
          );
        }
        if (user.categories?.length && !user.categories.includes('All')) {
          filtered = filtered.filter((a) =>
            user.categories?.includes(resolveAssetMainCategory(a))
          );
        }
      }

      if (!searchQuery) return filtered;
      const search = searchQuery.toLowerCase();
      return filtered.filter((asset) =>
        [
          asset.id?.toString(),
          asset.assetCode,
          asset.mainCategory,
          asset.serialNumber,
          asset.vendorName,
          asset.macAddress,
          asset.location,
          asset.plantCode,
          asset.monitorAssetCode,
          asset.keyboardAssetCode,
          asset.mouseAssetCode,
          asset.upsAssetCode,
          asset.contactName,
          asset.make,
          asset.model,
          asset.department,
          asset.assetName,
          asset.subCategory,
          asset.employeeId,
          asset.contactEmail,
        ].some((field) => (field?.toString() || '').toLowerCase().includes(search))
      );
    },
    [user]
  );

  const handleSubmit = useCallback(
    async (formData: AssetFormData, editingAsset: Asset | null) => {
      const inputData = editingAsset
        ? preserveExistingEditValues(formData, editingAsset)
        : formData;
      const cleanedData = buildCleanedSubmitPayload(inputData);
      const previousSnapshot = [...assetsRef.current];

      const optimistic = formDataToOptimisticAsset(
        cleanedData,
        editingAsset,
        assetsRef.current
      );
      persistAssets(patchAssetsList(assetsRef.current, optimistic, editingAsset));

      const url = editingAsset
        ? `${import.meta.env.VITE_API_BASE_URL || ''}/api/assets/${editingAsset.id}`
        : `${import.meta.env.VITE_API_BASE_URL || ''}/api/assets`;
      const method = editingAsset ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanedData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Save failed');

        const saved = data.asset
          ? mapAssetsFromApi([{ ...data.asset, id: data.asset.id }])[0]
          : null;

        if (saved) {
          persistAssets(patchAssetsList(assetsRef.current, saved, editingAsset));
        }
        // Always force-refresh from server after save so the saving user
        // sees the final count (including any concurrency-resolved ID changes)
        void fetchAssets({ silent: true, force: true }).catch(() => {});
        toast.success(editingAsset ? 'Asset updated!' : 'Asset registered!');
      } catch (err: unknown) {
        persistAssets(previousSnapshot);
        const message = err instanceof Error ? err.message : 'Save failed — changes reverted';
        toast.error(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [fetchAssets, persistAssets]
  );

  const deassignAsset = useCallback(
    async (asset: Asset, opts?: { remarks?: string; updatedBy?: string }): Promise<Asset> => {
      const assetId = asset.id ?? asset.assetCode ?? asset.uniqueCode;
      if (assetId == null || String(assetId).trim() === '') {
        throw new Error('Asset ID is required');
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/assets/${encodeURIComponent(String(assetId))}/deassign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            updatedBy: opts?.updatedBy || user?.email || user?.role || 'System',
            remarks: opts?.remarks || 'Asset returned / deassigned',
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to deassign asset');
      }

      const saved = (data as { asset?: Record<string, unknown> }).asset
        ? mapAssetsFromApi([(data as { asset: Record<string, unknown> }).asset])[0]
        : null;

      if (saved) {
        persistAssets(patchAssetsList(assetsRef.current, saved, asset));
        void fetchAssets({ silent: true, force: true }).catch(() => {});
        return saved;
      }

      await fetchAssets({ silent: true, force: true });
      const current = assetsRef.current.find((a) => normAssetId(a.id) === normAssetId(assetId));
      return current || asset;
    },
    [fetchAssets, persistAssets, user?.email, user?.role]
  );

  const executeDelete = useCallback(
    (id: number | string): Promise<void> => {
      if (!user) return Promise.reject(new Error('Not authenticated'));
      if (!isItAdminRole(user.role)) {
        toast.error('Only IT Admin can delete assets');
        return Promise.reject(new Error('Only IT Admin can delete assets'));
      }

      const previousSnapshot = [...assetsRef.current];
      const targetNorm = normAssetId(id);

      persistAssets(assetsRef.current.filter((a) => normAssetId(a.id) !== targetNorm));
      toast.success('Asset deleted');

      void (async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || ''}/api/assets/${id}?userEmail=${encodeURIComponent(user.email)}`,
            { method: 'DELETE', credentials: 'include' }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Delete failed');

          if (data.sheetWarning) {
            toast('Deleted locally — sheet sync will retry', { icon: '⚠️' });
          }
        } catch (err: unknown) {
          persistAssets(previousSnapshot);
          toast.error(err instanceof Error ? err.message : 'Delete failed — restored');
        }
      })();

      return Promise.resolve();
    },
    [user, persistAssets]
  );

  const value = useMemo(
    () => ({
      user,
      authChecked,
      assets,
      loading,
      visibleCategories,
      fetchAssets,
      handleSubmit,
      deassignAsset,
      executeDelete,
      handleLogout,
      loginSuccess,
      filterAssets,
    }),
    [
      user,
      authChecked,
      assets,
      loading,
      visibleCategories,
      fetchAssets,
      handleSubmit,
      deassignAsset,
      executeDelete,
      handleLogout,
      loginSuccess,
      filterAssets,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export { normalizeUser };
