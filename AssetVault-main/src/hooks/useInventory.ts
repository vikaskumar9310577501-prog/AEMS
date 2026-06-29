import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem } from '../types/inventory';
import { parseJsonResponse } from '../lib/apiFetch';

export function useInventory(opts?: { autoLoad?: boolean }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(!!opts?.autoLoad);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const url = force ? '/api/inventory?refresh=1' : '/api/inventory';
      const res = await fetch(base + url, { credentials: 'include' });
      if (res.ok) {
        const data = await parseJsonResponse<InventoryItem[] | { inventory?: InventoryItem[] }>(res);
        setInventory(Array.isArray(data) ? data : data.inventory || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opts?.autoLoad !== false) void refresh();
  }, [refresh, opts?.autoLoad]);

  return { inventory, loading, refresh, setInventory };
}
