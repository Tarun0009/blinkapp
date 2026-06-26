import { realtimeClient } from '../realtime/socketClient';
import { SOCKET_EVENTS } from '../realtime/socketEvents';

export function setPresenceStatus(uid, online) {
  // Presence is now controlled by the Socket.IO connection lifecycle.
  if (!uid && online === undefined) {
    return Promise.resolve();
  }

  return Promise.resolve();
}

export function subscribeToPresence(userId, onPresence, onError) {
  if (!userId) {
    return () => {};
  }

  const handlePresence = (payload = {}) => {
    if (payload.userId !== userId && payload.uid !== userId) {
      return;
    }

    const lastSeenValue = payload.lastSeen || payload.lastSeenAt;

    onPresence({
      online: Boolean(payload.online),
      lastSeen: lastSeenValue ? new Date(lastSeenValue) : null,
    });
  };

  const unsubscribeOnline = realtimeClient.on(SOCKET_EVENTS.PRESENCE_ONLINE, handlePresence);
  const unsubscribeOffline = realtimeClient.on(SOCKET_EVENTS.PRESENCE_OFFLINE, handlePresence);

  const unsubscribeError = realtimeClient.on(SOCKET_EVENTS.ERROR, onError || (() => {}));

  return () => {
    unsubscribeOnline();
    unsubscribeOffline();
    unsubscribeError();
  };
}
