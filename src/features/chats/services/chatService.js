import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_EVENTS, SOCKET_STATUS } from '../../../realtime/socketEvents';
import { backendRequest } from '../../../api/backendClient';
import { readCachedChats, writeCachedChats } from './realtimeCache';

const RECONNECT_FROM_STATUSES = new Set([
  SOCKET_STATUS.RECONNECTING,
  SOCKET_STATUS.ERROR,
  SOCKET_STATUS.CLOSED,
  SOCKET_STATUS.BACKGROUND,
]);

function byLastMessage(a, b) {
  return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
}

function toActiveChats(items = []) {
  return items.filter((chat) => !chat.isArchived).sort(byLastMessage);
}

function upsertById(items, item) {
  if (item.isArchived) {
    return items.filter((chat) => chat.id !== item.id);
  }

  const index = items.findIndex((existing) => existing.id === item.id);

  if (index === -1) {
    return [item, ...items].sort(byLastMessage);
  }

  const next = [...items];
  next[index] = { ...next[index], ...item };
  return next.sort(byLastMessage);
}

function applyPresenceToChats(items, payload = {}) {
  const targetId = payload.userId || payload.uid;
  if (!targetId) return { chats: items, changed: false };

  const lastSeenValue = payload.lastSeen || payload.lastSeenAt;
  let changed = false;

  const nextChats = items.map((chat) => {
    if (!Array.isArray(chat.members)) return chat;

    let chatChanged = false;
    const members = chat.members.map((member) => {
      if (member.id !== targetId) return member;

      chatChanged = true;
      return {
        ...member,
        online: Boolean(payload.online),
        lastSeenAt: payload.online ? member.lastSeenAt : lastSeenValue || member.lastSeenAt,
      };
    });

    if (!chatChanged) return chat;
    changed = true;
    return { ...chat, members };
  });

  return { chats: nextChats, changed };
}
export function subscribeToUserChats(uid, onChats, onError) {
  if (!uid) {
    return () => {};
  }

  let chats = [];
  let active = true;
  let hasFreshData = false;

  const emit = () => {
    onChats(chats);
    if (hasFreshData) {
      writeCachedChats(uid, chats);
    }
  };

  // Optimistic cache hydration — show stale chats instantly if available.
  readCachedChats(uid).then((cached) => {
    if (!active || hasFreshData || cached.length === 0) return;
    chats = toActiveChats(cached);
    if (chats.length > 0) {
      onChats(chats);
    }
  });

  const fetchChats = () =>
    backendRequest('/api/chats')
      .then((payload = {}) => {
        if (!active) return;
        hasFreshData = true;
        chats = toActiveChats(payload.chats || []);
        emit();
      })
      .catch(onError);

  fetchChats();

  const unsubscribeUpdated = realtimeClient.on(SOCKET_EVENTS.CHAT_UPDATED, (payload = {}) => {
    const chat = payload.chat || payload;
    if (!chat?.id || !chat.memberIds?.includes(uid)) {
      return;
    }

    chats = upsertById(chats, chat);
    emit();
  });

  const unsubscribeRemoved = realtimeClient.on(SOCKET_EVENTS.CHAT_REMOVED, (payload = {}) => {
    const chatId = payload.chatId || payload.id;
    if (!chatId) {
      return;
    }

    chats = chats.filter((chat) => chat.id !== chatId);
    emit();
  });

  const handlePresence = (payload = {}) => {
    const result = applyPresenceToChats(chats, payload);
    if (!result.changed) return;
    chats = result.chats;
    emit();
  };

  const unsubscribePresenceOnline = realtimeClient.on(
    SOCKET_EVENTS.PRESENCE_ONLINE,
    handlePresence,
  );
  const unsubscribePresenceOffline = realtimeClient.on(
    SOCKET_EVENTS.PRESENCE_OFFLINE,
    handlePresence,
  );
  const unsubscribeError = realtimeClient.on(SOCKET_EVENTS.ERROR, onError);

  // Refetch when the socket comes back after a drop / background.
  let previousStatus = realtimeClient.status;
  const unsubscribeStatus = realtimeClient.onStatus((status) => {
    if (
      hasFreshData &&
      RECONNECT_FROM_STATUSES.has(previousStatus) &&
      status === SOCKET_STATUS.AUTHENTICATED
    ) {
      fetchChats();
    }
    previousStatus = status;
  });

  return () => {
    active = false;
    unsubscribeUpdated();
    unsubscribeRemoved();
    unsubscribePresenceOnline();
    unsubscribePresenceOffline();
    unsubscribeError();
    unsubscribeStatus();
  };
}

export function subscribeToTypingUsers(chatId, uid, onTypingUsers, onError) {
  if (!chatId) {
    return () => {};
  }

  const typingUsers = new Map();

  const emitTypingUsers = () => {
    onTypingUsers([...typingUsers.values()]);
  };

  const unsubscribeTypingStart = realtimeClient.on(SOCKET_EVENTS.TYPING_START, (payload = {}) => {
    if (payload.chatId !== chatId || payload.userId === uid) {
      return;
    }

    typingUsers.set(
      payload.userId,
      payload.user?.displayName || payload.user?.email || 'Someone',
    );
    emitTypingUsers();
  });

  const unsubscribeTypingStop = realtimeClient.on(SOCKET_EVENTS.TYPING_STOP, (payload = {}) => {
    if (payload.chatId !== chatId || payload.userId === uid) {
      return;
    }

    typingUsers.delete(payload.userId);
    emitTypingUsers();
  });

  const unsubscribeError = realtimeClient.on(SOCKET_EVENTS.ERROR, onError || (() => {}));

  return () => {
    unsubscribeTypingStart();
    unsubscribeTypingStop();
    unsubscribeError();
  };
}

export function fetchArchivedChats() {
  return backendRequest('/api/chats?archived=true').then((payload) =>
    (payload?.chats || []).filter((chat) => chat.isArchived),
  );
}

export function fetchChatById(chatId) {
  if (!chatId) {
    return Promise.resolve(null);
  }

  return backendRequest(`/api/chats/${encodeURIComponent(chatId)}`).then(
    (payload) => payload?.chat || null,
  );
}

export function setTypingStatus(chatId, uid, isTyping) {
  if (!uid || !chatId) {
    return Promise.resolve();
  }

  realtimeClient.send(isTyping ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP, {
    chatId,
  });
  return Promise.resolve();
}
