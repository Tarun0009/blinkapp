import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useMessages(chatId, uid) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const markVisibleMessagesRead = useCallback(
    (visibleMessages) => {
      markMessagesRead(chatId, uid, visibleMessages).catch(() => {});
    },
    [chatId, uid],
  );

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      setHasMore(false);
      cursorRef.current = null;
      return undefined;
    }

    setLoading(true);
    setHasMore(false);
    cursorRef.current = null;
    loadingMoreRef.current = false;

    const unsubscribe = subscribeToMessages(
      chatId,
      (msgs, meta = {}) => {
        setMessages(msgs);
        setLoading(false);
        setError(null);
        cursorRef.current = meta.nextCursor || null;
        setHasMore(!!meta.hasMore);
        markVisibleMessagesRead(msgs);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [chatId, markVisibleMessagesRead]);

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
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        const additions = result.messages.filter((message) => !seen.has(message.id));
        if (additions.length === 0) return current;
        return [...current, ...additions].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
      });
      cursorRef.current = result.nextCursor || null;
      setHasMore(!!result.hasMore);
    } catch (err) {
      setError(err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [chatId]);

  const sendMessage = useCallback(
    async (text, options) => {
      if (!uid || !chatId || !text.trim()) return;

      await addTextMessage(chatId, uid, text, options);
    },
    [chatId, uid],
  );

  const sendImage = useCallback(
    async (imageURL) => {
      if (!uid || !chatId || !imageURL) return;

      await addImageMessage(chatId, uid, imageURL);
    },
    [chatId, uid],
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
  };
}
