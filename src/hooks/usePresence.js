import { useState, useEffect, useCallback } from 'react';
import {
  setTypingStatus,
  subscribeToTypingUsers,
} from '../features/chats/services/chatService';
import { setPresenceStatus, subscribeToPresence } from '../services/presenceService';
import { useRealtime } from '../context/RealtimeContext';

export function usePresence(uid) {
  const { isAppActive, isConnected } = useRealtime();

  useEffect(() => {
    if (!uid) return undefined;

    if (isAppActive && isConnected) {
      setPresenceStatus(uid, true).catch(() => {});
    }

    return () => {
      setPresenceStatus(uid, false).catch(() => {});
    };
  }, [isAppActive, isConnected, uid]);
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPresence(initialPresence) {
  return {
    online: Boolean(initialPresence?.online),
    lastSeen: toDate(initialPresence?.lastSeen || initialPresence?.lastSeenAt),
  };
}

export function useUserPresence(userId, initialPresence) {
  const initialOnline = initialPresence?.online;
  const initialLastSeen = initialPresence?.lastSeen;
  const initialLastSeenAt = initialPresence?.lastSeenAt;
  const [presence, setPresence] = useState(() => buildPresence(initialPresence));

  useEffect(() => {
    setPresence(buildPresence({
      online: initialOnline,
      lastSeen: initialLastSeen,
      lastSeenAt: initialLastSeenAt,
    }));
  }, [initialLastSeen, initialLastSeenAt, initialOnline, userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const unsubscribe = subscribeToPresence(userId, (nextPresence) => {
      setPresence((current) => ({
        online: nextPresence.online,
        lastSeen: nextPresence.lastSeen || current.lastSeen,
      }));
    });

    return unsubscribe;
  }, [userId]);

  return presence;
}

export function useTypingIndicator(chatId, uid) {
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!chatId) return undefined;

    const unsubscribe = subscribeToTypingUsers(chatId, uid, setTypingUsers);

    return unsubscribe;
  }, [chatId, uid]);

  const setTyping = useCallback(
    (isTyping) => {
      setTypingStatus(chatId, uid, isTyping).catch(() => {});
    },
    [chatId, uid],
  );

  return { typingUsers, setTyping };
}
