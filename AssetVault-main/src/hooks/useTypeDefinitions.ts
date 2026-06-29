import { useCallback, useEffect, useState } from 'react';
import type { TypeDefinitionsConfig } from '../types/categoryTypes';
import { defaultTypeDefinitionsConfig, mergeTypeDefinitions } from '../lib/typeDefinitions';

export function useTypeDefinitions() {
  const [config, setConfig] = useState<TypeDefinitionsConfig>(defaultTypeDefinitionsConfig());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/type-definitions');
      if (res.ok) {
        const data = (await res.json()) as TypeDefinitionsConfig;
        setConfig(mergeTypeDefinitions(data));
      }
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { config, loading, refresh };
}
