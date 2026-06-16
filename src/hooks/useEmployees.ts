import { useCallback, useEffect, useState } from 'react';
import type { Employee } from '../types/employee';
import { parseJsonResponse } from '../lib/apiFetch';

export function useEmployees(opts?: { autoLoad?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(!!opts?.autoLoad);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const url = force ? `${base}/api/employees?refresh=1` : `${base}/api/employees`;
      const res = await fetch(url, { credentials: 'include' });
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
