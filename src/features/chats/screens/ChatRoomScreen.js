import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SIZES, FONTS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator, useUserPresence } from '../../../hooks/usePresence';
import { MessageBubble } from '../components/MessageBubble';
import { MessageActionSheet } from '../components/MessageActionSheet';
import { TypingIndicator } from '../components/TypingIndicator';
import { showErrorAlert } from '../../../utils/errorUtils';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { UserAvatar } from '../../../components/UserAvatar';
import { EmptyState } from '../../../components/EmptyState';
import { formatPresenceStatus } from '../../../utils/formatTime';
import { unblockUser } from '../../profile/services/blockService';
import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_EVENTS } from '../../../realtime/socketEvents';
import { setActiveNotificationChat } from '../../notifications/services/notificationHandlers';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const NEW_MESSAGE_HIGHLIGHT_MS = 3200;
const RECENT_INCOMING_WINDOW_MS = 15 * 1000;

function buildReplyPreview(message) {
  if (!message) return null;
  return {
    id: message.id,
    text: message.deletedAt ? 'Message deleted' : message.text || '',
    senderName: message.sender?.displayName || null,
  };
}

function getMessageTimestamp(message) {
  const rawDate = message?.createdAt?.toDate?.() || message?.createdAt;
  const timestamp = new Date(rawDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isRecentlyCreated(message) {
  const timestamp = getMessageTimestamp(message);
  return timestamp > 0 && Date.now() - timestamp <= RECENT_INCOMING_WINDOW_MS;
}

export function ChatRoomScreen({ route, navigation }) {
  const {
    chatId,
    chatName,
    isGroup = false,
    members = [],
    otherUserId,
    isPinned,
    isMuted,
    mutedUntil,
    isArchived,
    isBlocked: initialBlocked = false,
    blockedByMe: initialBlockedByMe = false,
    blockedByUserId: initialBlockedByUserId = null,
    highlightMessageId,
  } = route.params;
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const {
    messages,
    loading,
    error: messagesError,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    sendImage,
    editMessage,
    deleteMessage,
    toggleReaction,
  } = useMessages(chatId, user?.uid);
  const { typingUsers, setTyping } = useTypingIndicator(chatId, user?.uid);
  const otherMember = useMemo(() => {
    if (isGroup) return null;
    return (
      members.find((member) => member.id === otherUserId) ||
      members.find((member) => member.id !== user?.uid) ||
      null
    );
  }, [isGroup, members, otherUserId, user?.uid]);
  const otherPresence = useUserPresence(
    isGroup ? null : otherMember?.id || otherUserId,
    {
      online: otherMember?.online,
      lastSeenAt: otherMember?.lastSeenAt,
    },
  );
  const headerSubtitle = isGroup
    ? `${members.length || 1} member${members.length === 1 ? '' : 's'}`
    : formatPresenceStatus(otherPresence);
  const [chatState, setChatState] = useState(() => ({
    isBlocked: !!initialBlocked,
    blockedByMe: !!initialBlockedByMe,
    blockedByUserId: initialBlockedByUserId || null,
    isPinned,
    isMuted,
    mutedUntil,
    isArchived,
  }));
  const isBlocked = !isGroup && !!chatState.isBlocked;
  const blockedByMe = !!chatState.blockedByMe;
  const blockedCopy = useMemo(() => {
    if (!isBlocked) return null;

    return blockedByMe
      ? {
          title: 'You blocked this user',
          message: `Unblock ${chatName || 'this user'} to send messages again.`,
          actionLabel: 'Unblock',
        }
      : {
          title: 'Messaging unavailable',
          message: 'You cannot send messages in this conversation right now.',
          actionLabel: null,
        };
  }, [blockedByMe, chatName, isBlocked]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [actionSheetMessage, setActionSheetMessage] = useState(null);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState(() => new Set());
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const seenMessageIdsRef = useRef(new Set());
  const messageHighlightTimersRef = useRef(new Map());
  const didHydrateMessagesRef = useRef(false);
  const didHighlightRouteMessageRef = useRef(null);

  useEffect(() => {
    setActiveNotificationChat(chatId);
    return () => setActiveNotificationChat(null);
  }, [chatId]);
  useEffect(() => {
    setChatState({
      isBlocked: !!initialBlocked,
      blockedByMe: !!initialBlockedByMe,
      blockedByUserId: initialBlockedByUserId || null,
      isPinned,
      isMuted,
      mutedUntil,
      isArchived,
    });
  }, [
    initialBlocked,
    initialBlockedByMe,
    initialBlockedByUserId,
    isArchived,
    isMuted,
    isPinned,
    mutedUntil,
  ]);

  useEffect(() => {
    const unsubscribe = realtimeClient.on(SOCKET_EVENTS.CHAT_UPDATED, (payload = {}) => {
      const chat = payload.chat || payload;
      if (chat?.id !== chatId) return;

      setChatState((current) => ({
        ...current,
        isBlocked: !!chat.isBlocked,
        blockedByMe: !!chat.blockedByMe,
        blockedByUserId: chat.blockedByUserId || null,
        isPinned: chat.isPinned,
        isMuted: chat.isMuted,
        mutedUntil: chat.mutedUntil,
        isArchived: chat.isArchived,
      }));
    });

    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    if (!isBlocked) return;
    setTyping(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setText('');
  }, [isBlocked, setTyping]);

  useEffect(() => {
    if (messagesError) {
      showErrorAlert(messagesError, 'Unable to load messages. Please try again later.');
    }
  }, [messagesError]);

  useEffect(() => {
    const highlightTimers = messageHighlightTimersRef.current;

    highlightTimers.forEach(clearTimeout);
    highlightTimers.clear();
    seenMessageIdsRef.current = new Set();
    didHydrateMessagesRef.current = false;
    setHighlightedMessageIds(new Set());

    return () => {
      highlightTimers.forEach(clearTimeout);
      highlightTimers.clear();
    };
  }, [chatId]);

  useEffect(() => {
    if (
      !highlightMessageId ||
      messages.length === 0 ||
      didHighlightRouteMessageRef.current === highlightMessageId
    ) {
      return;
    }

    const targetMessage = messages.find((message) => message.id === highlightMessageId);
    if (!targetMessage) {
      return;
    }

    didHighlightRouteMessageRef.current = highlightMessageId;
    setHighlightedMessageIds((current) => {
      const next = new Set(current);
      next.add(highlightMessageId);
      return next;
    });

    const existingTimer = messageHighlightTimersRef.current.get(highlightMessageId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      setHighlightedMessageIds((current) => {
        const next = new Set(current);
        next.delete(highlightMessageId);
        return next;
      });
      messageHighlightTimersRef.current.delete(highlightMessageId);
    }, NEW_MESSAGE_HIGHLIGHT_MS);

    messageHighlightTimersRef.current.set(highlightMessageId, timer);
  }, [highlightMessageId, messages]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    if (!didHydrateMessagesRef.current) {
      seenMessageIdsRef.current = new Set(messages.map((message) => message.id));
      didHydrateMessagesRef.current = true;
      return;
    }

    const freshIncomingIds = [];
    const seenMessageIds = seenMessageIdsRef.current;

    messages.forEach((message, index) => {
      if (!message?.id || seenMessageIds.has(message.id)) {
        return;
      }

      seenMessageIds.add(message.id);

      if (message.senderId === user?.uid || index > 2 || !isRecentlyCreated(message)) {
        return;
      }

      freshIncomingIds.push(message.id);
    });

    if (freshIncomingIds.length === 0) {
      return;
    }

    setHighlightedMessageIds((current) => {
      const next = new Set(current);
      freshIncomingIds.forEach((messageId) => next.add(messageId));
      return next;
    });

    freshIncomingIds.forEach((messageId) => {
      const existingTimer = messageHighlightTimersRef.current.get(messageId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        setHighlightedMessageIds((current) => {
          const next = new Set(current);
          next.delete(messageId);
          return next;
        });
        messageHighlightTimersRef.current.delete(messageId);
      }, NEW_MESSAGE_HIGHLIGHT_MS);

      messageHighlightTimersRef.current.set(messageId, timer);
    });
  }, [messages, user?.uid]);

  // Clean up typing indicator when leaving the chat
  useEffect(() => {
    return () => {
      setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [setTyping]);

  const handleSend = useCallback(async () => {
    if (isBlocked) {
      Alert.alert('Messaging unavailable', 'You cannot send messages in this conversation right now.');
      return;
    }
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      if (editingMessage) {
        await editMessage(editingMessage.id, text);
        setEditingMessage(null);
      } else {
        await sendMessage(text, replyingTo ? { replyToMessageId: replyingTo.id } : undefined);
        setReplyingTo(null);
      }
      setText('');
      setTyping(false);
    } catch (error) {
      showErrorAlert(error, 'Unable to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [editMessage, editingMessage, isBlocked, replyingTo, sendMessage, sending, setTyping, text]);

  const openActionSheet = useCallback((message) => {
    setActionSheetMessage(message);
  }, []);

  const closeActionSheet = useCallback(() => {
    setActionSheetMessage(null);
  }, []);

  const handleReply = useCallback(() => {
    if (isBlocked) {
      Alert.alert('Messaging unavailable', 'You cannot reply in this conversation right now.');
      return;
    }
    if (!actionSheetMessage) return;
    setEditingMessage(null);
    setReplyingTo(buildReplyPreview(actionSheetMessage));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [actionSheetMessage, isBlocked]);

  const handleEdit = useCallback(() => {
    if (isBlocked) {
      Alert.alert('Messaging unavailable', 'You cannot edit messages while this conversation is blocked.');
      return;
    }
    if (!actionSheetMessage) return;
    setReplyingTo(null);
    setEditingMessage(actionSheetMessage);
    setText(actionSheetMessage.text || '');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [actionSheetMessage, isBlocked]);

  const handleDelete = useCallback(() => {
    const target = actionSheetMessage;
    if (!target) return;
    Alert.alert(
      'Delete message?',
      'This will delete the message for everyone in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(target.id);
              if (editingMessage?.id === target.id) {
                setEditingMessage(null);
                setText('');
              }
              if (replyingTo?.id === target.id) {
                setReplyingTo(null);
              }
            } catch (error) {
              showErrorAlert(error, 'Unable to delete message. Please try again.');
            }
          },
        },
      ],
    );
  }, [actionSheetMessage, deleteMessage, editingMessage, replyingTo]);

  const handleReact = useCallback(
    async (emoji) => {
      if (!actionSheetMessage) return;
      try {
        await toggleReaction(actionSheetMessage.id, emoji);
      } catch (error) {
        showErrorAlert(error, 'Unable to react right now.');
      }
    },
    [actionSheetMessage, toggleReaction],
  );

  const handleReactionTap = useCallback(
    async (message, emoji) => {
      try {
        await toggleReaction(message.id, emoji);
      } catch (error) {
        showErrorAlert(error, 'Unable to react right now.');
      }
    },
    [toggleReaction],
  );

  const cancelEditing = useCallback(() => {
    setEditingMessage(null);
    setText('');
  }, []);

  const cancelReplying = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const isEditingExpired =
    editingMessage &&
    Date.now() - new Date(editingMessage.createdAt).getTime() > EDIT_WINDOW_MS;

  useEffect(() => {
    if (isEditingExpired) {
      Alert.alert('Edit window expired', 'Messages can only be edited within 15 minutes.');
      cancelEditing();
    }
  }, [cancelEditing, isEditingExpired]);

  const handleImageSend = useCallback(async () => {
    if (isBlocked || sending) return;

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.82,
      });

      if (result.didCancel) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Image unavailable', 'Choose another image and try again.');
        return;
      }

      setSending(true);
      await sendImage(
        {
          base64: asset.base64,
          mimeType: asset.type || 'image/jpeg',
          fileName: asset.fileName,
          size: asset.fileSize,
          uri: asset.uri,
        },
        { replyToMessageId: replyingTo?.id },
      );
      setReplyingTo(null);
    } catch (error) {
      showErrorAlert(error, 'Unable to send image. Please try again.');
    } finally {
      setSending(false);
    }
  }, [isBlocked, replyingTo?.id, sendImage, sending]);

  const handleImageOpen = useCallback((url) => {
    if (!url) return;
    Linking.openURL(url).catch((error) => {
      showErrorAlert(error, 'Unable to open image.');
    });
  }, []);

  const handleTextChange = useCallback(
    (value) => {
      if (isBlocked) return;
      setText(value);
      if (editingMessage) return;
      setTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
    },
    [editingMessage, isBlocked, setTyping],
  );

  const handleUnblock = useCallback(async () => {
    if (!otherUserId || unblocking) return;

    setUnblocking(true);
    try {
      const payload = await unblockUser(otherUserId);
      if (payload?.chat) {
        setChatState((current) => ({
          ...current,
          isBlocked: !!payload.chat.isBlocked,
          blockedByMe: !!payload.chat.blockedByMe,
          blockedByUserId: payload.chat.blockedByUserId || null,
        }));
      } else {
        setChatState((current) => ({
          ...current,
          isBlocked: false,
          blockedByMe: false,
          blockedByUserId: null,
        }));
      }
    } catch (error) {
      showErrorAlert(error, 'Could not unblock user. Please try again.');
    } finally {
      setUnblocking(false);
    }
  }, [otherUserId, unblocking]);

  const getReceiptLabel = useCallback(
    (message, index) => {
      if (index !== 0 || message.senderId !== user?.uid || message.deletedAt) {
        return null;
      }

      const summary = message.receiptSummary;
      if (isGroup && summary?.recipientCount > 0) {
        if (summary.readCount === summary.recipientCount) {
          return 'Seen by all';
        }
        if (summary.readCount > 0) {
          return `Seen by ${summary.readCount}/${summary.recipientCount}`;
        }
        if (summary.deliveredCount > 0) {
          return `Delivered to ${summary.deliveredCount}/${summary.recipientCount}`;
        }
        return null;
      }

      if (message.status === 'read') return 'Seen';
      if (message.status === 'delivered') return 'Delivered';
      return null;
    },
    [isGroup, user?.uid],
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            hitSlop={12}
            activeScale={0.88}
            activeOpacity={0.78}
            borderless
            style={styles.backBtn}>
            <AppIcon name="arrow-left" size={24} color={colors.primary} />
          </PressableScale>
          <View style={styles.headerInfo}>
            <UserAvatar
              photoURL={isGroup ? undefined : otherMember?.photoURL}
              name={chatName}
              size={38}
              online={isGroup ? undefined : otherPresence.online}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {chatName}
              </Text>
              <View style={styles.headerMeta}>
                {!isGroup ? (
                  <View
                    style={[
                      styles.statusDot,
                      otherPresence.online ? styles.statusDotOnline : styles.statusDotOffline,
                    ]}
                  />
                ) : null}
                <Text style={[styles.headerSubtitle, otherPresence.online && styles.headerSubtitleOnline]}>
                  {headerSubtitle}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Search messages"
              onPress={() =>
                navigation.navigate('MessageSearch', {
                  chatId,
                  chatName,
                  isGroup,
                  members,
                  otherUserId,
                  isPinned: chatState.isPinned,
                  isMuted: chatState.isMuted,
                  mutedUntil: chatState.mutedUntil,
                  isArchived: chatState.isArchived,
                  isBlocked: chatState.isBlocked,
                  blockedByMe: chatState.blockedByMe,
                  blockedByUserId: chatState.blockedByUserId,
                })
              }
              hitSlop={12}
              activeScale={0.9}
              activeOpacity={0.82}
              borderless
              style={styles.backBtn}>
              <AppIcon name="magnify" size={21} color={colors.primary} />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Chat settings"
              onPress={() =>
                navigation.navigate('ChatSettings', {
                  chatId,
                  chatName,
                  isGroup,
                  members,
                  otherUserId,
                  isPinned: chatState.isPinned,
                  isMuted: chatState.isMuted,
                  mutedUntil: chatState.mutedUntil,
                  isArchived: chatState.isArchived,
                  isBlocked: chatState.isBlocked,
                  blockedByMe: chatState.blockedByMe,
                  blockedByUserId: chatState.blockedByUserId,
                })
              }
              hitSlop={12}
              activeScale={0.9}
              activeOpacity={0.82}
              borderless
              style={styles.backBtn}>
              <AppIcon name="more-vertical" size={22} color={colors.primary} />
            </PressableScale>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={isBlocked ? 'slash' : 'message-text-outline'}
              title={isBlocked ? 'Messaging unavailable' : 'No messages yet'}
              message={
                isBlocked
                  ? blockedCopy?.message || 'You cannot send messages in this conversation right now.'
                  : 'Send the first message and start the conversation.'
              }
            />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const receiptLabel = getReceiptLabel(item, index);
              return (
                <MessageBubble
                  highlightNewMessage={highlightedMessageIds.has(item.id)}
                  showSeenLabel={!!receiptLabel}
                  seenLabel={receiptLabel}
                  message={item}
                  isMe={item.senderId === user?.uid}
                  currentUid={user?.uid}
                  onLongPress={openActionSheet}
                  onImagePress={handleImageOpen}
                  onReactionPress={handleReactionTap}
                />
              );
            }}
            inverted
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasMore && !loadingMore) {
                loadMore();
              }
            }}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.olderLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            ListHeaderComponent={
              typingUsers.length > 0 ? <TypingIndicator names={typingUsers} /> : null
            }
          />
        )}

        <View style={styles.inputBarWrap}>
          {isBlocked && blockedCopy ? (
            <BlockedChatBanner
              copy={blockedCopy}
              blockedByMe={blockedByMe}
              busy={unblocking}
              onUnblock={handleUnblock}
              styles={styles}
              colors={colors}
            />
          ) : null}

          {editingMessage ? (
            <View style={styles.metaBar}>
              <AppIcon name="account-edit-outline" size={16} color={colors.primary} />
              <View style={styles.metaBody}>
                <Text style={styles.metaLabel}>Editing message</Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Cancel edit"
                onPress={cancelEditing}
                hitSlop={10}
                activeScale={0.9}
                borderless
                style={styles.metaClose}>
                <AppIcon name="close" size={16} color={colors.textSecondary} />
              </PressableScale>
            </View>
          ) : null}

          {replyingTo && !editingMessage ? (
            <View style={styles.metaBar}>
              <View style={styles.replyAccent} />
              <View style={styles.metaBody}>
                <Text style={styles.metaLabel}>
                  {`Replying to ${replyingTo.senderName || 'message'}`}
                </Text>
                <Text style={styles.metaPreview} numberOfLines={1}>
                  {replyingTo.text || 'Message'}
                </Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={cancelReplying}
                hitSlop={10}
                activeScale={0.9}
                borderless
                style={styles.metaClose}>
                <AppIcon name="close" size={16} color={colors.textSecondary} />
              </PressableScale>
            </View>
          ) : null}

          <View style={styles.inputBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Attach image"
              onPress={handleImageSend}
              disabled={isBlocked || sending}
              style={[styles.attachBtn, (isBlocked || sending) && styles.composerDisabled]}
              hitSlop={8}
              activeScale={0.9}
              activeOpacity={0.76}
              borderless>
              <AppIcon name="camera-outline" size={23} color={colors.textSecondary} />
            </PressableScale>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={isBlocked ? 'Messaging unavailable' : editingMessage ? 'Edit message…' : 'Type a message...'}
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={1000}
              editable={!isBlocked}
              showSoftInputOnFocus={!isBlocked}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={editingMessage ? 'Save edit' : 'Send message'}
              accessibilityState={{ disabled: !text.trim() || sending || isBlocked, busy: sending }}
              style={[styles.sendBtn, (!text.trim() || isBlocked) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending || isBlocked}
              activeScale={0.88}
              activeOpacity={0.84}
              rippleColor={PRESS_FEEDBACK.lightRipple}
              borderless>
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <AppIcon
                  name={editingMessage ? 'check' : 'send'}
                  size={18}
                  color={colors.white}
                />
              )}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>

      <MessageActionSheet
        visible={!!actionSheetMessage}
        message={actionSheetMessage}
        isMe={actionSheetMessage?.senderId === user?.uid}
        onClose={closeActionSheet}
        onReact={handleReact}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        disableMessageActions={isBlocked}
      />
    </SafeAreaView>
  );
}

function BlockedChatBanner({ blockedByMe, busy, colors, copy, onUnblock, styles }) {
  return (
    <View style={styles.blockedBanner}>
      <View style={styles.blockedIcon}>
        <AppIcon name="slash" size={18} color={colors.danger} />
      </View>
      <View style={styles.blockedBody}>
        <Text style={styles.blockedTitle}>{copy.title}</Text>
        <Text style={styles.blockedMessage}>{copy.message}</Text>
      </View>
      {blockedByMe ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Unblock user"
          activeScale={0.94}
          activeOpacity={0.85}
          disabled={busy}
          rippleColor={PRESS_FEEDBACK.dangerRipple}
          style={styles.unblockInlineBtn}
          onPress={onUnblock}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Text style={styles.unblockInlineText}>Unblock</Text>
          )}
        </PressableScale>
      ) : null}
    </View>
  );
}
function createStyles(colors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm + 2,
      paddingVertical: SIZES.sm + 2,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    headerText: { flex: 1, minWidth: 0, marginLeft: SIZES.sm },
    headerTitle: { ...FONTS.h3, color: colors.text },
    headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: SIZES.xs,
    },
    statusDotOnline: {
      backgroundColor: colors.online,
    },
    statusDotOffline: {
      backgroundColor: colors.offline,
    },
    headerSubtitle: { ...FONTS.small, color: colors.textLight, fontWeight: '500' },
    headerSubtitleOnline: { color: colors.online, fontWeight: '700' },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    messagesList: {
      paddingTop: SIZES.md,
      paddingBottom: SIZES.sm,
    },
    olderLoader: {
      paddingVertical: SIZES.md,
      alignItems: 'center',
    },
    inputBarWrap: {
      paddingHorizontal: SIZES.sm,
      paddingTop: SIZES.xs + 2,
      paddingBottom: SIZES.sm,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.xs + 2,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      marginBottom: SIZES.xs,
    },
    replyAccent: {
      width: 3,
      alignSelf: 'stretch',
      backgroundColor: colors.primary,
      borderRadius: 2,
      marginRight: SIZES.sm,
    },
    metaBody: { flex: 1, minWidth: 0, marginLeft: SIZES.xs },
    metaLabel: {
      ...FONTS.small,
      fontWeight: '700',
      color: colors.primary,
    },
    metaPreview: {
      ...FONTS.small,
      color: colors.textSecondary,
    },
    metaClose: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm + 2,
      paddingVertical: SIZES.sm,
      borderRadius: 16,
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginBottom: SIZES.xs,
    },
    blockedIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SIZES.sm,
    },
    blockedBody: {
      flex: 1,
      minWidth: 0,
    },
    blockedTitle: {
      ...FONTS.small,
      color: colors.danger,
      fontWeight: '900',
    },
    blockedMessage: {
      ...FONTS.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    unblockInlineBtn: {
      minHeight: 34,
      paddingHorizontal: SIZES.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.danger,
      marginLeft: SIZES.sm,
    },
    unblockInlineText: {
      ...FONTS.small,
      color: colors.danger,
      fontWeight: '800',
    },    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: SIZES.xs,
      paddingVertical: 4,
      borderRadius: 24,
      backgroundColor: colors.surfaceElevated,
    },
    attachBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 1,
    },
    input: {
      flex: 1,
      ...FONTS.body,
      backgroundColor: 'transparent',
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.sm,
      maxHeight: 100,
      color: colors.text,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 4,
    },
    sendBtnDisabled: { backgroundColor: colors.surfaceAlt },
    composerDisabled: { opacity: 0.45 },
  });
}


