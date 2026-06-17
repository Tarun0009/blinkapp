import { io } from 'socket.io-client';
import { REALTIME_CONFIG } from '../config/realtime';
import { SOCKET_STATUS } from './socketEvents';

class SocketClient {
  constructor() {
    this.socket = null;
    this.uid = null;
    this.tokenProvider = null;
    this.status = SOCKET_STATUS.IDLE;
    this.paused = false;
    this.openAttempt = 0;
    this.listeners = new Map();
    this.statusListeners = new Set();
  }

  connect({ uid, tokenProvider }) {
    this.setSession({ uid, tokenProvider });
    this.resume();
  }

  setSession({ uid, tokenProvider }) {
    if (!uid) {
      this.disconnect();
      return;
    }

    if (this.uid !== uid) {
      this.disconnectSocketOnly();
    }

    this.uid = uid;
    this.tokenProvider = tokenProvider;
  }

  resume() {
    this.paused = false;

    if (!this.uid) {
      this.setStatus(SOCKET_STATUS.IDLE);
      return;
    }

    if (this.socket?.connected) {
      this.setStatus(SOCKET_STATUS.AUTHENTICATED);
      return;
    }

    if (this.socket) {
      return;
    }

    this.openSocket();
  }

  pause() {
    this.paused = true;
    this.openAttempt += 1;
    this.disconnectSocketOnly();

    if (this.uid) {
      this.setStatus(SOCKET_STATUS.BACKGROUND);
    }
  }

  async openSocket() {
    const attempt = this.openAttempt + 1;
    this.openAttempt = attempt;
    this.disconnectSocketOnly();
    this.setStatus(SOCKET_STATUS.CONNECTING);

    let token = null;
    try {
      token = this.tokenProvider ? await this.tokenProvider() : null;
    } catch (error) {
      this.emit('error', error);
      this.setStatus(SOCKET_STATUS.ERROR);
      return;
    }

    if (attempt !== this.openAttempt || this.paused || !this.uid) {
      return;
    }

    this.socket = io(REALTIME_CONFIG.socketUrl, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: REALTIME_CONFIG.reconnectBaseDelayMs,
      reconnectionDelayMax: REALTIME_CONFIG.reconnectMaxDelayMs,
    });

    this.socket.on('connect', () => {
      this.setStatus(SOCKET_STATUS.AUTHENTICATED);
    });

    this.socket.on('disconnect', () => {
      this.setStatus(SOCKET_STATUS.RECONNECTING);
    });

    this.socket.on('connect_error', (error) => {
      this.emit('error', error);
      this.setStatus(SOCKET_STATUS.ERROR);
    });

    this.socket.onAny((eventType, payload) => {
      this.emit(eventType, payload);
    });
  }

  disconnect() {
    this.openAttempt += 1;
    this.paused = false;
    this.uid = null;
    this.tokenProvider = null;
    this.disconnectSocketOnly();
    this.setStatus(SOCKET_STATUS.CLOSED);
  }

  disconnectSocketOnly() {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  on(eventType, listener) {
    const listeners = this.listeners.get(eventType) || new Set();
    listeners.add(listener);
    this.listeners.set(eventType, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  onStatus(listener) {
    this.statusListeners.add(listener);
    listener(this.status);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  send(eventType, payload = {}) {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(eventType, payload);
  }

  request(eventType, payload = {}, timeoutMs = REALTIME_CONFIG.requestTimeoutMs) {
    if (!this.socket?.connected) {
      return Promise.reject(new Error('Realtime server is not connected.'));
    }

    return this.socket.timeout(timeoutMs).emitWithAck(eventType, payload);
  }

  joinChat(chatId) {
    this.send('chat:join', { chatId });
  }

  leaveChat(chatId) {
    this.send('chat:leave', { chatId });
  }

  emit(eventType, payload) {
    const listeners = this.listeners.get(eventType);
    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      listener(payload);
    });
  }

  setStatus(status) {
    this.status = status;
    this.statusListeners.forEach((listener) => {
      listener(status);
    });
  }
}

export const realtimeClient = new SocketClient();
