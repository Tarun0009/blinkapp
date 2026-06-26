import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_STATUS } from '../../../realtime/socketEvents';
import {
  addImageMessage,
  addTextMessage,
  deleteMessage as deleteMessageService,
  editMessage as editMessageService,
  loadOlderMessages,
  markMessagesRead,
  subscribeToMessages,
  toggleReaction as toggleReactionService,
} from '../services/messageService';
import { readPendingMessages, writePendingMessages } from '../services/realtimeCache';

function sortMessages(messages) {
  return [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function mergeMessages(serverMessages, pendingMessages) {
  const serverIds = new Set(serverMessages.map((message) => message.id));
  const pending = pendingMessages.filter((message) => !serverIds.has(message.id));
  return sortMessages([...serverMessages, ...pending]);
}

function isQueueableSendError(error) {
  return (
    error?.isNetworkError ||
    error?.code === 'BACKEND_TIMEOUT' ||
    error?.code === 'BACKEND_UNREACHABLE'
  );
}

function createPendingMessage({ chatId, uid, type, text, asset, options }) {
  const now = new Date();
  const id = `pending-${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    clientId: id,
    chatId,
    senderId: uid,
    sender: { id: uid, uid },
    text: text || '',
    type,
    imageURL: asset?.uri || asset?.url || null,
    mediaUrl: asset?.uri || asset?.url || null,
    mediaMimeType: asset?.mimeType,
    mediaSize: asset?.size,
    mediaName: asset?.fileName,
    status: 'pending',
    pendingStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    readAt: null,
    editedAt: null,
    deletedAt: null,
    reactions: [],
    replyToMessageId: options?.replyToMessageId || null,
    replyTo: null,
    payload: { type, text, asset, options },
  };
}

export function useMessages(chatId, uid) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const serverMessagesRef = useRef([]);
  const pendingMessagesRef = useRef([]);
  const flushingRef = useRef(false);

  const publishMessages = useCallback(() => {
    setMessages(mergeMessages(serverMessagesRef.current, pendingMessagesRef.current));
  }, []);

  const persistPending = useCallback(
    (nextPending) => {
      pendingMessagesRef.current = nextPending;
      writePendingMessages(chatId, nextPending).catch(() => {});
      publishMessages();
    },
    [chatId, publishMessages],
  );

  const markVisibleMessagesRead = useCallback(
    (visibleMessages) => {
      markMessagesRead(chatId, uid, visibleMessages).catch(() => {});
    },
    [chatId, uid],
  );

  const removePending = useCallback(
    (pendingId) => {
      persistPending(pendingMessagesRef.current.filter((message) => message.id !== pendingId));
    },
    [persistPending],
  );

  const updatePending = useCallback(
    (pendingId, updates) => {
      persistPending(
        pendingMessagesRef.current.map((message) =>
          message.id === pendingId ? { ...message, ...updates, updatedAt: new Date() } : message,
        ),
      );
    },
    [persistPending],
  );

  const deliverPendingMessage = useCallback(
    async (pendingMessage) => {
      const payload = pendingMessage.payload || {};
      if (payload.type === 'image') {
        await addImageMessage(chatId, uid, payload.asset, payload.options);
      } else {
        await addTextMessage(chatId, uid, payload.text, payload.options);
      }
    },
    [chatId, uid],
  );

  const flushPendingMessages = useCallback(async () => {
    if (!chatId || !uid || flushingRef.current || pendingMessagesRef.current.length === 0) {
      return;
    }

    flushingRef.current = true;
    try {
      const pendingSnapshot = [...pendingMessagesRef.current];
      for (const pendingMessage of pendingSnapshot) {
        if (!pendingMessagesRef.current.some((message) => message.id === pendingMessage.id)) {
          continue;
        }

        updatePending(pendingMessage.id, { pendingStatus: 'pending', status: 'pending' });
        try {
          await deliverPendingMessage(pendingMessage);
          removePending(pendingMessage.id);
        } catch (sendError) {
          if (isQueueableSendError(sendError)) {
            updatePending(pendingMessage.id, { pendingStatus: 'failed', status: 'failed' });
          } else {
            updatePending(pendingMessage.id, { pendingStatus: 'failed', status: 'failed' });
          }
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [chatId, deliverPendingMessage, removePending, uid, updatePending]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      setHasMore(false);
      cursorRef.current = null;
      serverMessagesRef.current = [];
      pendingMessagesRef.current = [];
      return undefined;
    }

    setLoading(true);
    setHasMore(false);
    cursorRef.current = null;
    loadingMoreRef.current = false;
    serverMessagesRef.current = [];
    pendingMessagesRef.current = [];

    readPendingMessages(chatId).then((pending) => {
      pendingMessagesRef.current = pending.map((message) => ({
        ...message,
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
        updatedAt: message.updatedAt ? new Date(message.updatedAt) : new Date(),
        pendingStatus: message.pendingStatus || 'failed',
        status: message.status || 'failed',
      }));
      publishMessages();
      flushPendingMessages();
    });

    const unsubscribe = subscribeToMessages(
      chatId,
      (msgs, meta = {}) => {
        serverMessagesRef.current = msgs;
        setLoading(false);
        setError(null);
        cursorRef.current = meta.nextCursor || null;
        setHasMore(!!meta.hasMore);
        publishMessages();
        markVisibleMessagesRead(msgs);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [chatId, flushPendingMessages, markVisibleMessagesRead, publishMessages]);

  useEffect(() => {
    const unsubscribe = realtimeClient.onStatus((status) => {
      if (status === SOCKET_STATUS.AUTHENTICATED) {
        flushPendingMessages();
      }
    });

    return unsubscribe;
  }, [flushPendingMessages]);

  const loadMore = useCallback(async () => {
    if (!chatId || loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await loadOlderMessages(chatId, cursor);
      if (result.messages.length === 0) {
        setHasMore(false);
        cursorRef.current = null;
        return;
      }
      serverMessagesRef.current = sortMessages([
        ...serverMessagesRef.current,
        ...result.messages.filter(
          (message) => !serverMessagesRef.current.some((current) => current.id === message.id),
        ),
      ]);
      publishMessages();
      cursorRef.current = result.nextCursor || null;
      setHasMore(!!result.hasMore);
    } catch (err) {
      setError(err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [chatId, publishMessages]);

  const queueAndAttempt = useCallback(
    async (pendingMessage) => {
      persistPending([pendingMessage, ...pendingMessagesRef.current]);
      try {
        await deliverPendingMessage(pendingMessage);
        removePending(pendingMessage.id);
      } catch (sendError) {
          if (isQueueableSendError(sendError)) {
          updatePending(pendingMessage.id, { pendingStatus: 'failed', status: 'failed' });
          return;
        }
        removePending(pendingMessage.id);
        throw sendError;
      }
    },
    [deliverPendingMessage, persistPending, removePending, updatePending],
  );

  const sendMessage = useCallback(
    async (text, options) => {
      if (!uid || !chatId || !text.trim()) return;
      const pendingMessage = createPendingMessage({
        chatId,
        uid,
        type: 'text',
        text: text.trim(),
        options,
      });
      await queueAndAttempt(pendingMessage);
    },
    [chatId, queueAndAttempt, uid],
  );

  const sendImage = useCallback(
    async (asset, options) => {
      if (!uid || !chatId || !asset) return;
      const pendingMessage = createPendingMessage({
        chatId,
        uid,
        type: 'image',
        text: '',
        asset,
        options,
      });
      await queueAndAttempt(pendingMessage);
    },
    [chatId, queueAndAttempt, uid],
  );

  const editMessage = useCallback(
    async (messageId, text) => {
      if (!chatId || !messageId || !text.trim()) return;
      await editMessageService(chatId, messageId, text);
    },
    [chatId],
  );

  const deleteMessage = useCallback(
    async (messageId) => {
      if (!chatId || !messageId) return;
      await deleteMessageService(chatId, messageId);
    },
    [chatId],
  );

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!chatId || !messageId || !emoji) return;
      await toggleReactionService(chatId, messageId, emoji);
    },
    [chatId],
  );

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    sendImage,
    editMessage,
    deleteMessage,
    toggleReaction,
    retryPendingMessages: flushPendingMessages,
  };
}