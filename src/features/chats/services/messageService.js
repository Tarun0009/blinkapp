import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_EVENTS, SOCKET_STATUS } from '../../../realtime/socketEvents';
import { backendRequest } from '../../../api/backendClient';
import { readCachedMessages, writeCachedMessages } from './realtimeCache';

const RECONNECT_FROM_STATUSES = new Set([
  SOCKET_STATUS.RECONNECTING,
  SOCKET_STATUS.ERROR,
  SOCKET_STATUS.CLOSED,
  SOCKET_STATUS.BACKGROUND,
]);

function normalizeMessage(message) {
  return {
    ...message,
    status: message.status || 'sent',
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    deliveredAt: message.deliveredAt ? new Date(message.deliveredAt) : null,
    readAt: message.readAt ? new Date(message.readAt) : null,
    receiptSummary: message.receiptSummary || null,
    receipts: Array.isArray(message.receipts)
      ? message.receipts.map((receipt) => ({
          ...receipt,
          deliveredAt: receipt.deliveredAt ? new Date(receipt.deliveredAt) : null,
          readAt: receipt.readAt ? new Date(receipt.readAt) : null,
        }))
      : [],
    editedAt: message.editedAt ? new Date(message.editedAt) : null,
    deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
    updatedAt: message.updatedAt ? new Date(message.updatedAt) : null,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          createdAt: message.replyTo.createdAt ? new Date(message.replyTo.createdAt) : null,
          deletedAt: message.replyTo.deletedAt ? new Date(message.replyTo.deletedAt) : null,
        }
      : null,
  };
}

function getViewerReceipt(message, uid) {
  return message.receipts?.find((receipt) => receipt.userId === uid) || null;
}

function isReadByViewer(message, uid) {
  const receipt = getViewerReceipt(message, uid);
  return Boolean(receipt?.readAt) || message.status === 'read';
}

function isDeliveredToViewer(message, uid) {
  const receipt = getViewerReceipt(message, uid);
  return Boolean(receipt?.deliveredAt || receipt?.readAt) || ['delivered', 'read'].includes(message.status);
}

function sortMessages(messages) {
  return [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function upsertById(items, item) {
  const index = items.findIndex((existing) => existing.id === item.id);

  if (index === -1) {
    return sortMessages([item, ...items]);
  }

  const next = [...items];
  next[index] = { ...next[index], ...item };
  return sortMessages(next);
}

export function subscribeToMessages(chatId, onMessages, onError) {
  if (!chatId) {
    return () => {};
  }

  let messages = [];
  let active = true;
  let hasFreshData = false;
  let meta = { hasMore: false, nextCursor: null };
  realtimeClient.joinChat(chatId);

  const emit = () => {
    onMessages(messages, meta);
    if (hasFreshData) {
      writeCachedMessages(chatId, messages);
    }
  };

  // Optimistic cache hydration — show stale messages instantly while we wait for the server.
  readCachedMessages(chatId).then((cached) => {
    if (!active || hasFreshData || cached.length === 0) return;
    messages = sortMessages(cached.map(normalizeMessage));
    onMessages(messages, meta);
  });

  const fetchMessages = () =>
    backendRequest(`/api/chats/${chatId}/messages`)
      .then((payload = {}) => {
        if (!active) return;
        hasFreshData = true;
        messages = sortMessages((payload.messages || []).map(normalizeMessage));
        meta = {
          hasMore: !!payload.hasMore,
          nextCursor: payload.nextCursor || null,
        };
        emit();
      })
      .catch(onError);

  fetchMessages();

  const handleMessageUpsert = (payload = {}) => {
    const message = normalizeMessage(payload.message || payload);
    if (message.chatId !== chatId) {
      return;
    }

    messages = upsertById(messages, message);
    emit();
  };

  const unsubscribeCreated = realtimeClient.on(SOCKET_EVENTS.MESSAGE_CREATED, handleMessageUpsert);
  const unsubscribeUpdated = realtimeClient.on(SOCKET_EVENTS.MESSAGE_UPDATED, handleMessageUpsert);
  const unsubscribeStatusUpdated = realtimeClient.on(
    SOCKET_EVENTS.MESSAGE_STATUS_UPDATED,
    handleMessageUpsert,
  );

  const unsubscribeRemoved = realtimeClient.on(SOCKET_EVENTS.MESSAGE_REMOVED, (payload = {}) => {
    if (payload.chatId !== chatId) {
      return;
    }

    const messageId = payload.messageId || payload.id;
    messages = messages.filter((message) => message.id !== messageId);
    emit();
  });

  const unsubscribeError = realtimeClient.on(SOCKET_EVENTS.ERROR, onError);

  // Refetch when the socket comes back after a drop / background.
  let previousStatus = realtimeClient.status;
  const unsubscribeStatus = realtimeClient.onStatus((status) => {
    if (
      hasFreshData &&
      RECONNECT_FROM_STATUSES.has(previousStatus) &&
      status === SOCKET_STATUS.AUTHENTICATED
    ) {
      realtimeClient.joinChat(chatId);
      fetchMessages();
    }
    previousStatus = status;
  });

  return () => {
    active = false;
    realtimeClient.leaveChat(chatId);
    unsubscribeCreated();
    unsubscribeUpdated();
    unsubscribeStatusUpdated();
    unsubscribeRemoved();
    unsubscribeError();
    unsubscribeStatus();
  };
}

export function markMessagesRead(chatId, uid, messages = []) {
  if (!uid || !chatId || messages.length === 0) {
    return Promise.resolve();
  }

  const hasUnreadMessages = messages
    .filter((message) => message.senderId !== uid && !isReadByViewer(message, uid))
    .some((message) => Boolean(message.id));

  if (!hasUnreadMessages) {
    return Promise.resolve();
  }

  const messageIds = messages
    .filter((message) => message.senderId !== uid && !isReadByViewer(message, uid))
    .map((message) => message.id)
    .filter(Boolean);

  return backendRequest(`/api/chats/${chatId}/messages/read`, {
    method: 'POST',
    body: { messageIds },
  });
}

export function markMessagesDelivered(chatId, uid, messages = []) {
  if (!uid || !chatId || messages.length === 0) {
    return Promise.resolve();
  }

  const messageIds = messages
    .filter((message) => message.senderId !== uid && !isDeliveredToViewer(message, uid))
    .map((message) => message.id)
    .filter(Boolean);

  if (messageIds.length === 0) {
    return Promise.resolve();
  }

  return backendRequest(`/api/chats/${chatId}/messages/delivered`, {
    method: 'POST',
    body: { messageIds },
  });
}

export function loadOlderMessages(chatId, cursor, { limit } = {}) {
  if (!chatId || !cursor) {
    return Promise.resolve({ messages: [], nextCursor: null, hasMore: false });
  }

  const params = new URLSearchParams({ cursor });
  if (limit) params.set('limit', String(limit));

  return backendRequest(`/api/chats/${chatId}/messages?${params.toString()}`).then((payload = {}) => ({
    messages: (payload.messages || []).map(normalizeMessage),
    nextCursor: payload.nextCursor || null,
    hasMore: !!payload.hasMore,
  }));
}

export function addTextMessage(chatId, uid, text, { replyToMessageId } = {}) {
  return backendRequest(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: {
      text: text.trim(),
      ...(replyToMessageId ? { replyToMessageId } : {}),
    },
  });
}

export function editMessage(chatId, messageId, text) {
  return backendRequest(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'PATCH',
    body: { text: text.trim() },
  });
}

export function deleteMessage(chatId, messageId) {
  return backendRequest(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export function toggleReaction(chatId, messageId, emoji) {
  return backendRequest(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
  });
}

export function uploadMedia(asset) {
  if (!asset?.base64 || !asset?.mimeType) {
    return Promise.reject(new Error('Image upload data is missing.'));
  }

  return backendRequest('/api/media/uploads', {
    method: 'POST',
    body: {
      base64: asset.base64,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    },
  }).then((payload = {}) => payload.media);
}

export async function addImageMessage(chatId, uid, asset, { caption, replyToMessageId } = {}) {
  if (!chatId || !uid || !asset) {
    return Promise.resolve();
  }

  const media = asset.url ? asset : await uploadMedia(asset);
  if (!media?.url) {
    throw new Error('Image upload failed.');
  }

  return backendRequest(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: {
      type: 'image',
      text: caption?.trim() || '',
      media: {
        url: media.url,
        mimeType: media.mimeType || asset.mimeType || 'image/jpeg',
        size: media.size || asset.size,
        fileName: media.fileName || asset.fileName,
      },
      ...(replyToMessageId ? { replyToMessageId } : {}),
    },
  });
}
