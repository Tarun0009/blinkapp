import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { AppIcon } from '../../../components/AppIcon';
import { EmptyState } from '../../../components/EmptyState';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SearchBar } from '../../../components/SearchBar';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { UserAvatar } from '../../../components/UserAvatar';
import { formatRelativeTime } from '../../../utils/formatTime';
import { searchMessages } from '../services/searchService';

const SEARCH_DEBOUNCE_MS = 320;

function getOtherMember(chat, uid) {
  return chat?.members?.find((member) => member.id !== uid) || null;
}

function isGroupChat(chat, routeIsGroup) {
  return chat?.type === 'group' || routeIsGroup === true;
}

function getChatName(chat, uid, fallback) {
  if (!chat) return fallback || 'Chat';
  if (chat.type === 'group') {
    return chat.name || chat.title || fallback || 'Group chat';
  }
  const otherMember = getOtherMember(chat, uid);
  return otherMember?.displayName || otherMember?.username || fallback || 'Blink User';
}

function getMessageText(message) {
  if (message?.deletedAt) return 'Message deleted';
  if (message?.text) return message.text;
  if (message?.type === 'image') return 'Photo';
  return 'Message';
}

function getPreviewText(text, query) {
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleanText) return 'Message';
  const lowerText = cleanText.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index <= 28) return cleanText;
  return `...${cleanText.slice(Math.max(0, index - 28))}`;
}

function ResultRow({ colors, currentUid, isScopedSearch, onPress, query, result, styles }) {
  const chat = result.chat;
  const message = result.message;
  const chatName = getChatName(chat, currentUid);
  const otherMember = getOtherMember(chat, currentUid);
  const isGroup = chat?.type === 'group';
  const messageText = getPreviewText(getMessageText(message), query);
  const senderName = message?.sender?.displayName || message?.sender?.username || 'Someone';
  const timeLabel = message?.createdAt ? formatRelativeTime(message.createdAt) : '';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open message from ${senderName}`}
      activeScale={0.985}
      activeOpacity={0.9}
      rippleColor={PRESS_FEEDBACK.softRipple}
      onPress={onPress}>
      <SurfaceCard variant="strong" style={styles.resultCard}>
        <View style={styles.resultRow}>
          <UserAvatar
            photoURL={isGroup ? chat?.photoURL : otherMember?.photoURL}
            name={chatName}
            size={46}
            online={isGroup ? undefined : otherMember?.online}
          />
          <View style={styles.resultBody}>
            {!isScopedSearch ? (
              <Text style={styles.resultTitle} numberOfLines={1}>
                {chatName}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.senderName} numberOfLines={1}>
                {senderName}
              </Text>
              {timeLabel ? <Text style={styles.timeText}>{timeLabel}</Text> : null}
            </View>
            <Text style={styles.previewText} numberOfLines={2}>
              {messageText}
            </Text>
          </View>
          <View style={styles.openIcon}>
            <AppIcon name="chevron-right" size={18} color={colors.primary} />
          </View>
        </View>
      </SurfaceCard>
    </PressableScale>
  );
}

export function MessageSearchScreen({ route, navigation }) {
  const params = route.params || {};
  const {
    chatId,
    chatName,
    isGroup,
    members = [],
    otherUserId,
    isPinned,
    isMuted,
    mutedUntil,
    isArchived,
    isBlocked,
    blockedByMe,
    blockedByUserId,
  } = params;
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const trimmedQuery = query.trim();
  const scopedChat = useMemo(() => (
    chatId
      ? {
          id: chatId,
          type: isGroup ? 'group' : 'direct',
          title: chatName,
          name: chatName,
          members,
          isPinned,
          isMuted,
          mutedUntil,
          isArchived,
          isBlocked,
          blockedByMe,
          blockedByUserId,
        }
      : null
  ), [
    blockedByMe,
    blockedByUserId,
    chatId,
    chatName,
    isArchived,
    isBlocked,
    isGroup,
    isMuted,
    isPinned,
    members,
    mutedUntil,
  ]);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      setError(null);
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchMessages(trimmedQuery, { chatId, limit: chatId ? 30 : 40 })
        .then((nextResults) => {
          if (!active) return;
          setResults(nextResults);
          setHasSearched(true);
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setHasSearched(true);
          setError('Search is unavailable right now. Please try again.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [chatId, trimmedQuery]);

  const handleResultPress = useCallback(
    (result) => {
      const chat = result.chat || scopedChat;
      const message = result.message;
      if (!chat?.id || !message?.id) return;

      const direct = chat.type !== 'group';
      const otherMember = direct ? getOtherMember(chat, user?.uid) : null;

      navigation.navigate('ChatRoom', {
        chatId: chat.id,
        chatName: getChatName(chat, user?.uid, chatName),
        isGroup: isGroupChat(chat, isGroup),
        members: chat.members || members || [],
        otherUserId: direct ? otherMember?.id || otherUserId || null : null,
        isPinned: chat.isPinned,
        isMuted: chat.isMuted,
        mutedUntil: chat.mutedUntil,
        isArchived: chat.isArchived,
        isBlocked: chat.isBlocked,
        blockedByMe: chat.blockedByMe,
        blockedByUserId: chat.blockedByUserId,
        highlightMessageId: message.id,
      });
    },
    [chatName, isGroup, members, navigation, otherUserId, scopedChat, user?.uid],
  );

  const emptyState = useMemo(() => {
    if (trimmedQuery.length < 2) {
      return {
        icon: 'magnify',
        title: chatId ? 'Search this chat' : 'Search messages',
        message: 'Type at least two characters to find older messages.',
      };
    }
    if (error) {
      return {
        icon: 'cloud-alert-outline',
        title: 'Search paused',
        message: error,
      };
    }
    return {
      icon: 'message-text-outline',
      title: 'No messages found',
      message: 'Try another word or search from a different chat.',
    };
  }, [chatId, error, trimmedQuery.length]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeScale={0.9}
          borderless
          hitSlop={12}
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}>
          <AppIcon name="arrow-left" size={22} color={colors.primary} />
        </PressableScale>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {chatId ? 'Search in chat' : 'Search messages'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {chatId ? chatName || 'Current conversation' : 'Across your conversations'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={chatId ? 'Find in this chat' : 'Search all messages'}
          onClear={() => setQuery('')}
          style={styles.searchBar}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.message?.id || `${item.chat?.id}-${item.message?.createdAt}`}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ResultRow
              colors={colors}
              currentUid={user?.uid}
              isScopedSearch={!!chatId}
              onPress={() => handleResultPress(item)}
              query={trimmedQuery}
              result={chatId && !item.chat ? { ...item, chat: scopedChat } : item}
              styles={styles}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={emptyState.icon}
            title={emptyState.title}
            message={hasSearched || trimmedQuery.length < 2 ? emptyState.message : ' '}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundSoft,
    },
    headerBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
    },
    title: {
      ...FONTS.h3,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    searchWrap: {
      paddingHorizontal: SIZES.md,
      paddingTop: SIZES.sm,
      paddingBottom: SIZES.xs,
    },
    searchBar: {
      marginHorizontal: 0,
      marginVertical: 0,
      height: 48,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: SIZES.sm,
    },
    listContent: {
      paddingHorizontal: SIZES.md,
      paddingTop: SIZES.xs,
      paddingBottom: SIZES.xxl,
    },
    resultCard: {
      marginBottom: SIZES.sm,
      padding: SIZES.sm + 2,
      borderRadius: 18,
      ...SHADOWS.soft,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    resultBody: {
      flex: 1,
      minWidth: 0,
      marginLeft: SIZES.sm + 2,
    },
    resultTitle: {
      ...FONTS.bodyBold,
      color: colors.text,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    senderName: {
      ...FONTS.small,
      color: colors.primary,
      fontWeight: '800',
      flexShrink: 1,
      marginRight: SIZES.xs,
    },
    timeText: {
      ...FONTS.tiny,
      color: colors.textLight,
      fontWeight: '700',
    },
    previewText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: 4,
    },
    openIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      marginLeft: SIZES.sm,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
    },
  });
}




