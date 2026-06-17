import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { BACKEND_CONFIG } from '../../config/backend';

const HEALTH_CHECK_INTERVAL_MS = 30000;
const HEALTH_CHECK_TIMEOUT_MS = 4000;

export const BACKEND_STATUS = {
  UNKNOWN: 'unknown',
  CHECKING: 'checking',
  REACHABLE: 'reachable',
  UNREACHABLE: 'unreachable',
  SKIPPED: 'skipped',
};

const NetworkContext = createContext(null);

function isDeviceOffline(netInfo) {
  return netInfo.isConnected === false || netInfo.isInternetReachable === false;
}

async function fetchBackendHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_CONFIG.apiBaseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.ok === true;
  } finally {
    clearTimeout(timeout);
  }
}

export function NetworkProvider({ children }) {
  const [netInfo, setNetInfo] = useState({
    isConnected: null,
    isInternetReachable: null,
    type: 'unknown',
  });
  const [appState, setAppState] = useState(AppState.currentState);
  const [backendStatus, setBackendStatus] = useState(BACKEND_STATUS.UNKNOWN);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const isAppActive = appState === 'active';
  const isOffline = isDeviceOffline(netInfo);

  const refreshBackendStatus = useCallback(async () => {
    if (isOffline) {
      setBackendStatus(BACKEND_STATUS.SKIPPED);
      return BACKEND_STATUS.SKIPPED;
    }

    setBackendStatus((current) =>
      current === BACKEND_STATUS.UNREACHABLE || current === BACKEND_STATUS.UNKNOWN
        ? BACKEND_STATUS.CHECKING
        : current,
    );

    try {
      const reachable = await fetchBackendHealth();
      const nextStatus = reachable ? BACKEND_STATUS.REACHABLE : BACKEND_STATUS.UNREACHABLE;
      setBackendStatus(nextStatus);
      setLastCheckedAt(new Date());
      return nextStatus;
    } catch {
      setBackendStatus(BACKEND_STATUS.UNREACHABLE);
      setLastCheckedAt(new Date());
      return BACKEND_STATUS.UNREACHABLE;
    }
  }, [isOffline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetInfo({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type || 'unknown',
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAppActive) {
      return undefined;
    }

    refreshBackendStatus();
    const interval = setInterval(refreshBackendStatus, HEALTH_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAppActive, refreshBackendStatus]);

  const value = useMemo(
    () => ({
      backendStatus,
      isBackendReachable: backendStatus === BACKEND_STATUS.REACHABLE,
      isBackendUnavailable:
        !isOffline && backendStatus === BACKEND_STATUS.UNREACHABLE,
      isOffline,
      lastCheckedAt,
      netInfo,
      refreshBackendStatus,
    }),
    [backendStatus, isOffline, lastCheckedAt, netInfo, refreshBackendStatus],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetworkStatus must be used within NetworkProvider');
  return context;
}
