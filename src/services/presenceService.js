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

    onPresence({
      online: Boolean(payload.online),
      lastSeen: payload.lastSeen ? new Date(payload.lastSeen) : null,
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
