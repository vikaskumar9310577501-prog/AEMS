import { useCallback, useEffect, useState } from 'react';
import type { Employee } from '../types/employee';
import { parseJsonResponse } from '../lib/apiFetch';

export function useEmployees(opts?: { autoLoad?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(!!opts?.autoLoad);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      let userEmail = '';
      try {
        const stored = localStorage.getItem('ams_user_data') || localStorage.getItem('asset_vault_user');
        if (stored) userEmail = JSON.parse(stored)?.email || '';
      } catch {
        /* ignore */
      }
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const sep = force ? '?refresh=1' : '';
      const emailParam = userEmail ? (sep ? `&userEmail=${encodeURIComponent(userEmail)}` : `?userEmail=${encodeURIComponent(userEmail)}`) : '';
      const url = `${base}/api/employees${sep}${emailParam}`;
      const res = await fetch(url, {
        credentials: 'include',
        headers: userEmail ? { 'X-User-Email': userEmail } : {},
      });
      if (res.ok) {
        const data = await parseJsonResponse<Employee[] | { employees?: Employee[] }>(res);
        setEmployees(Array.isArray(data) ? data : data.employees || []);
      } else {
        setEmployees([]);
      }
    } catch {
      /* keep cache */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opts?.autoLoad !== false) void refresh(true);
  }, [refresh, opts?.autoLoad]);

  return { employees, loading, refresh, setEmployees };
}
