import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator } from '../../../hooks/usePresence';
import { MessageBubble } from '../components/MessageBubble';
import { MessageActionSheet } from '../components/MessageActionSheet';
import { TypingIndicator } from '../components/TypingIndicator';
import { showErrorAlert } from '../../../utils/errorUtils';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { UserAvatar } from '../../../components/UserAvatar';
import { EmptyState } from '../../../components/EmptyState';

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
  const { chatId, chatName, isGroup = false, members = [], otherUserId } = route.params;
  const { user } = useAuth();
  const {
    messages,
    loading,
    error: messagesError,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  } = useMessages(chatId, user?.uid);
  const { typingUsers, setTyping } = useTypingIndicator(chatId, user?.uid);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
  }, [editMessage, editingMessage, replyingTo, sendMessage, sending, setTyping, text]);

  const openActionSheet = useCallback((message) => {
    setActionSheetMessage(message);
  }, []);

  const closeActionSheet = useCallback(() => {
    setActionSheetMessage(null);
  }, []);

  const handleReply = useCallback(() => {
    if (!actionSheetMessage) return;
    setEditingMessage(null);
    setReplyingTo(buildReplyPreview(actionSheetMessage));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [actionSheetMessage]);

  const handleEdit = useCallback(() => {
    if (!actionSheetMessage) return;
    setReplyingTo(null);
    setEditingMessage(actionSheetMessage);
    setText(actionSheetMessage.text || '');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [actionSheetMessage]);

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

  const handleImageSend = useCallback(() => {
    Alert.alert(
      'Coming Soon',
      'Image sharing is currently in development. You can still send text and emojis!',
    );
  }, []);

  const handleTextChange = useCallback(
    (value) => {
      setText(value);
      if (editingMessage) return;
      setTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
    },
    [editingMessage, setTyping],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
            <AppIcon name="arrow-left" size={24} color={COLORS.primary} />
          </PressableScale>
          <View style={styles.headerInfo}>
            <UserAvatar name={chatName} size={38} online={isGroup ? undefined : true} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {chatName}
              </Text>
              <View style={styles.headerMeta}>
                {!isGroup ? <View style={styles.statusDot} /> : null}
                <Text style={styles.headerSubtitle}>
                  {isGroup
                    ? `${members.length || 1} member${members.length === 1 ? '' : 's'}`
                    : 'Secure realtime chat'}
                </Text>
              </View>
            </View>
          </View>
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
              })
            }
            hitSlop={12}
            activeScale={0.9}
            activeOpacity={0.82}
            borderless
            style={styles.backBtn}>
            <AppIcon name="more-vertical" size={22} color={COLORS.primary} />
          </PressableScale>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="message-text-outline"
              title="No messages yet"
              message="Send the first message and start the conversation."
            />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                highlightNewMessage={highlightedMessageIds.has(item.id)}
                message={item}
                isMe={item.senderId === user?.uid}
                currentUid={user?.uid}
                onLongPress={openActionSheet}
                onReactionPress={handleReactionTap}
              />
            )}
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
                  <ActivityIndicator size="small" color={COLORS.primary} />
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
          {editingMessage ? (
            <View style={styles.metaBar}>
              <AppIcon name="account-edit-outline" size={16} color={COLORS.primary} />
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
                <AppIcon name="close" size={16} color={COLORS.textSecondary} />
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
                <AppIcon name="close" size={16} color={COLORS.textSecondary} />
              </PressableScale>
            </View>
          ) : null}

          <View style={styles.inputBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Attach image"
              onPress={handleImageSend}
              style={styles.attachBtn}
              hitSlop={8}
              activeScale={0.9}
              activeOpacity={0.76}
              borderless>
              <AppIcon name="camera-outline" size={23} color={COLORS.textSecondary} />
            </PressableScale>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={editingMessage ? 'Edit message…' : 'Type a message...'}
              placeholderTextColor={COLORS.textLight}
              multiline
              maxLength={1000}
              showSoftInputOnFocus
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={editingMessage ? 'Save edit' : 'Send message'}
              accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeScale={0.88}
              activeOpacity={0.84}
              rippleColor={PRESS_FEEDBACK.lightRipple}
              borderless>
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <AppIcon
                  name={editingMessage ? 'check' : 'send'}
                  size={18}
                  color={COLORS.white}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 4,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    ...SHADOWS.soft,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  headerText: { flex: 1, minWidth: 0, marginLeft: SIZES.sm },
  headerTitle: { ...FONTS.h3, color: COLORS.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.online,
    marginRight: SIZES.xs,
  },
  headerSubtitle: { ...FONTS.small, color: COLORS.textSecondary, fontWeight: '600' },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.xs,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  messagesList: {
    paddingTop: SIZES.lg,
    paddingBottom: SIZES.lg,
  },
  olderLoader: {
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  inputBarWrap: {
    paddingHorizontal: SIZES.sm,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.sm,
    backgroundColor: COLORS.backgroundSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderStrong,
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm + 2,
    paddingVertical: SIZES.xs + 2,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.xs,
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: SIZES.sm,
  },
  metaBody: { flex: 1, minWidth: 0, marginLeft: SIZES.xs },
  metaLabel: {
    ...FONTS.small,
    fontWeight: '700',
    color: COLORS.primary,
  },
  metaPreview: {
    ...FONTS.small,
    color: COLORS.textSecondary,
  },
  metaClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SIZES.xs,
    paddingVertical: SIZES.xs,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    backgroundColor: COLORS.surfaceGlass,
    ...SHADOWS.medium,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    ...FONTS.body,
    backgroundColor: 'transparent',
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 1,
    maxHeight: 100,
    color: COLORS.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SIZES.sm,
  },
  sendBtnDisabled: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
});
