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

export function useUserPresence(userId) {
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;

    const unsubscribe = subscribeToPresence(userId, (presence) => {
      setOnline(presence.online);
      setLastSeen(presence.lastSeen);
    });

    return unsubscribe;
  }, [userId]);

  return { online, lastSeen };
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
