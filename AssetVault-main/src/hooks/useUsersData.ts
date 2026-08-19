import { useState, useEffect, useCallback, useRef } from 'react';

export interface AppUser {
  email: string;
  role: string;
  locations: string[];
  plants: string[];
  categories?: string[];
  allowDelete?: boolean;
}

function normalizeUserRow(u: Record<string, unknown>): AppUser {
  const loc = u.locations ?? u.Locations;
  const plt = u.plants ?? u.Plants;
  const cats = u.categories ?? u.Categories ?? u.category ?? u.access;
  return {
    email: String(u.email || u.Email || '').trim().toLowerCase(),
    role: String(u.role || u.Role || 'User'),
    locations: Array.isArray(loc)
      ? loc.map(String)
      : typeof loc === 'string'
        ? loc.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    plants: Array.isArray(plt)
      ? plt.map(String)
      : typeof plt === 'string'
        ? plt.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    categories: Array.isArray(cats)
      ? cats.map(String)
      : typeof cats === 'string'
        ? cats.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    allowDelete: !!u.allowDelete || String(u.allowDelete) === 'true',
  };
}

function extractUserList(data: unknown): AppUser[] {
  if (Array.isArray(data)) {
    return data
      .map((u) => normalizeUserRow(u as Record<string, unknown>))
      .filter((u) => u.email);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.users)) return extractUserList(obj.users);
  }
  return [];
}

const POLL_MS = 25_000;

export function useUsersData() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    try {
      localStorage.removeItem('assestflow_users_cache');
    } catch {
      /* ignore */
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const loadUsers = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setInitialLoading(true);
    } else {
      setSyncing(true);
    }

    try {
      const res = await fetch(`/api/users?refresh=1&_=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Server returned HTML. Run: npm run dev — then open http://localhost:3000');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to load users');
      }

      const next = extractUserList(data);
      if (mountedRef.current) {
        setUsers(next);
        setSyncHint(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      if (mountedRef.current && !silent) {
        setSyncHint(err instanceof Error ? err.message : 'Could not load users from sheet.');
      }
    } finally {
      if (mountedRef.current) {
        setInitialLoading(false);
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    const interval = setInterval(() => loadUsers({ silent: true }), POLL_MS);
    const onFocus = () => loadUsers({ silent: true });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadUsers]);

  return {
    users,
    initialLoading,
    syncing,
    syncHint,
    refreshUsers: () => loadUsers({ silent: true }),
  };
}
