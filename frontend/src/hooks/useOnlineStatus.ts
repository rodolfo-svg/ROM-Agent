/**
 * ROM Agent - useOnlineStatus Hook
 *
 * Hook React para monitorar status de conectividade
 * com integracao ao OfflineManager
 *
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOfflineManager, type OfflineStats } from '@/utils/offline-manager';

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

export interface UseOnlineStatusOptions {
  /**
   * Callback quando fica online
   */
  onOnline?: () => void;

  /**
   * Callback quando fica offline
   */
  onOffline?: () => void;

  /**
   * Sincronizar automaticamente quando voltar online
   * @default true
   */
  autoSync?: boolean;

  /**
   * Intervalo para verificar conectividade (ms)
   * @default 30000
   */
  pingInterval?: number;

  /**
   * URL para ping de verificacao
   * @default '/api/health'
   */
  pingUrl?: string;
}

export interface UseOnlineStatusReturn extends OnlineStatusState {
  /**
   * Forca verificacao de conectividade
   */
  checkConnection: () => Promise<boolean>;

  /**
   * Sincroniza acoes pendentes
   */
  syncPendingActions: () => Promise<{ success: number; failed: number }>;

  /**
   * Obtem estatisticas do cache offline
   */
  getOfflineStats: () => Promise<OfflineStats>;

  /**
   * Se esta sincronizando
   */
  isSyncing: boolean;

  /**
   * Erro de sincronizacao
   */
  syncError: Error | null;
}

// Network Information API types
interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  onchange?: () => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

/**
 * Hook para monitorar status de conectividade
 */
export function useOnlineStatus(
  options: UseOnlineStatusOptions = {}
): UseOnlineStatusReturn {
  const {
    onOnline,
    onOffline,
    autoSync = true,
    pingInterval = 30000,
    pingUrl = '/api/health',
  } = options;

  // State
  const [state, setState] = useState<OnlineStatusState>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
    connectionType: null,
    effectiveType: null,
    downlink: null,
    rtt: null,
  }));

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);

  // Refs
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineManagerRef = useRef(getOfflineManager());

  /**
   * Get network information
   */
  const getNetworkInfo = useCallback(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      return {
        connectionType: connection.type || null,
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
      };
    }

    return {
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null,
    };
  }, []);

  /**
   * Check actual connectivity with ping
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isConnected = response.ok;

      if (isConnected !== state.isOnline) {
        setState((prev) => ({
          ...prev,
          isOnline: isConnected,
          wasOffline: !isConnected || prev.wasOffline,
          lastOnlineAt: isConnected ? new Date() : prev.lastOnlineAt,
          lastOfflineAt: !isConnected ? new Date() : prev.lastOfflineAt,
          ...getNetworkInfo(),
        }));
      }

      return isConnected;
    } catch {
      // Network error - assume offline
      if (state.isOnline) {
        setState((prev) => ({
          ...prev,
          isOnline: false,
          wasOffline: true,
          lastOfflineAt: new Date(),
        }));
      }
      return false;
    }
  }, [pingUrl, state.isOnline, getNetworkInfo]);

  /**
   * Sync pending actions
   */
  const syncPendingActions = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await offlineManagerRef.current.syncWhenOnline();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sync failed');
      setSyncError(err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Get offline stats
   */
  const getOfflineStats = useCallback(async () => {
    return offlineManagerRef.current.getStats();
  }, []);

  /**
   * Handle online event
   */
  const handleOnline = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOnline: true,
      lastOnlineAt: new Date(),
      ...getNetworkInfo(),
    }));

    onOnline?.();

    if (autoSync) {
      syncPendingActions().catch(console.error);
    }
  }, [onOnline, autoSync, syncPendingActions, getNetworkInfo]);

  /**
   * Handle offline event
   */
  const handleOffline = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOnline: false,
      wasOffline: true,
      lastOfflineAt: new Date(),
    }));

    onOffline?.();
  }, [onOffline]);

  /**
   * Handle network change
   */
  const handleNetworkChange = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ...getNetworkInfo(),
    }));
  }, [getNetworkInfo]);

  // Setup event listeners
  useEffect(() => {
    // Browser events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleNetworkChange);
    }

    // Initial network info
    setState((prev) => ({
      ...prev,
      ...getNetworkInfo(),
    }));

    // Initialize offline manager
    offlineManagerRef.current.init().catch(console.error);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleNetworkChange);
      }
    };
  }, [handleOnline, handleOffline, handleNetworkChange, getNetworkInfo]);

  // Setup ping interval
  useEffect(() => {
    if (pingInterval > 0) {
      pingIntervalRef.current = setInterval(() => {
        checkConnection().catch(console.error);
      }, pingInterval);
    }

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [pingInterval, checkConnection]);

  return {
    ...state,
    checkConnection,
    syncPendingActions,
    getOfflineStats,
    isSyncing,
    syncError,
  };
}

/**
 * Simplified hook - just returns online status
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;
