import { BACKEND_CONFIG } from './backend';

export const REALTIME_CONFIG = {
  socketUrl: BACKEND_CONFIG.socketUrl,
  reconnectBaseDelayMs: 1000,
  reconnectMaxDelayMs: 15000,
  heartbeatIntervalMs: 30000,
  requestTimeoutMs: 10000,
};
