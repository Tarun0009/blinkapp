import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { realtimeClient } from '../realtime/socketClient';
import { SOCKET_STATUS } from '../realtime/socketEvents';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(SOCKET_STATUS.IDLE);
  const [appState, setAppState] = useState(AppState.currentState);
  const isAppActive = appState === 'active';

  const tokenProvider = useCallback(
    () => user?.getIdToken?.() || Promise.resolve(null),
    [user],
  );

  useEffect(() => {
    return realtimeClient.onStatus(setStatus);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      realtimeClient.disconnect();
      return;
    }

    realtimeClient.setSession({
      uid: user.uid,
      tokenProvider,
    });

    if (isAppActive) {
      realtimeClient.resume();
    } else {
      realtimeClient.pause();
    }
  }, [isAppActive, tokenProvider, user?.uid]);

  useEffect(() => {
    return () => {
      realtimeClient.disconnect();
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      appState,
      isAppActive,
      isConnected: status === SOCKET_STATUS.AUTHENTICATED,
      isConnecting:
        status === SOCKET_STATUS.CONNECTING ||
        status === SOCKET_STATUS.RECONNECTING,
    }),
    [appState, isAppActive, status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider');
  return context;
}
