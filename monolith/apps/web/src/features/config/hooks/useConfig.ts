import { useEffect, useState, useCallback } from 'react';
import { clientConfigCache } from '../services/config-cache.service.js';

export function useConfig(key: string, defaultValue = ''): { value: string; loading: boolean } {
  const [value, setValue] = useState<string>(() => clientConfigCache.get(key, defaultValue));
  const [loading, setLoading] = useState<boolean>(!clientConfigCache.getStats().isInitialized);

  useEffect(() => {
    // Initial fetch in background if not yet initialized
    clientConfigCache.fetchConfigs().then(() => {
      setValue(clientConfigCache.get(key, defaultValue));
      setLoading(false);
    });

    const unsubscribe = clientConfigCache.subscribe(() => {
      setValue(clientConfigCache.get(key, defaultValue));
    });

    return unsubscribe;
  }, [key, defaultValue]);

  return { value, loading };
}

export function useConfigBoolean(key: string, defaultValue = false): { value: boolean; loading: boolean } {
  const [value, setValue] = useState<boolean>(() => clientConfigCache.getBoolean(key, defaultValue));
  const [loading, setLoading] = useState<boolean>(!clientConfigCache.getStats().isInitialized);

  useEffect(() => {
    clientConfigCache.fetchConfigs().then(() => {
      setValue(clientConfigCache.getBoolean(key, defaultValue));
      setLoading(false);
    });

    const unsubscribe = clientConfigCache.subscribe(() => {
      setValue(clientConfigCache.getBoolean(key, defaultValue));
    });

    return unsubscribe;
  }, [key, defaultValue]);

  return { value, loading };
}

export function useAppConfigs(): {
  configs: Record<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
  stats: ReturnType<typeof clientConfigCache.getStats>;
} {
  const [configs, setConfigs] = useState<Record<string, string>>(() => clientConfigCache.getAll());
  const [loading, setLoading] = useState<boolean>(!clientConfigCache.getStats().isInitialized);
  const [stats, setStats] = useState(() => clientConfigCache.getStats());

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await clientConfigCache.fetchConfigs(true);
    setConfigs(data);
    setStats(clientConfigCache.getStats());
    setLoading(false);
  }, []);

  useEffect(() => {
    clientConfigCache.fetchConfigs().then(data => {
      setConfigs(data);
      setStats(clientConfigCache.getStats());
      setLoading(false);
    });

    const unsubscribe = clientConfigCache.subscribe(updated => {
      setConfigs({ ...updated });
      setStats(clientConfigCache.getStats());
    });

    return unsubscribe;
  }, []);

  return { configs, loading, refresh, stats };
}
