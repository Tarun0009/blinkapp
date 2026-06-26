import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { FONTS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useChats } from '../hooks/useChats';
import { useFriendRequests } from '../../friend-requests/hooks/useFriendRequests';
import { ChatListItem } from '../components/ChatListItem';
import { SearchBar } from '../../../components/SearchBar';
import { IconButton } from '../../../components/IconButton';
import { EmptyState } from '../../../components/EmptyState';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';

const CHAT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'direct', label: 'Direct' },
  { key: 'groups', label: 'Groups' },
  { key: 'online', label: 'Online' },
];

function getOtherMember(chat, uid) {
  return chat.members?.find((member) => member.id !== uid);
}

function getChatName(chat, uid) {
  if (chat.type === 'group') {
    return chat.name || chat.title || 'Group Chat';
  }
  const otherMember = getOtherMember(chat, uid);
  return otherMember?.displayName || otherMember?.username || 'Blink User';
}

function isDirectChat(chat) {
  return chat.type !== 'group';
}

function isOnlineChat(chat, uid) {
  return isDirectChat(chat) && Boolean(getOtherMember(chat, uid)?.online);
}

function getSearchText(chat, uid) {
  const otherMember = getOtherMember(chat, uid);
  return [
    getChatName(chat, uid),
    chat.title,
    otherMember?.username,
    chat.lastMessage,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function FilterChip({ active, count, label, onPress, styles }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeScale={0.96}
      activeOpacity={0.82}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count > 0 ? (
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>
          {count > 99 ? '99+' : count}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function ChatSkeletonRow({ styles }) {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonPreview]} />
      </View>
    </View>
  );
}

function ChatsSkeleton({ styles }) {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <ChatSkeletonRow key={item} styles={styles} />
      ))}
    </View>
  );
}

export function ChatListScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { chats, loading } = useChats(user?.uid);
  const { incomingRequests } = useFriendRequests(user?.uid);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const pendingRequestCount = incomingRequests.length;
  const pendingRequestLabel = pendingRequestCount > 99 ? '99+' : String(pendingRequestCount);

  const stats = useMemo(() => {
    const direct = chats.filter(isDirectChat).length;
    const groups = chats.length - direct;
    const online = chats.filter((chat) => isOnlineChat(chat, user?.uid)).length;
    return { all: chats.length, direct, groups, online };
  }, [chats, user?.uid]);

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return chats.filter((chat) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'direct' && isDirectChat(chat)) ||
        (activeFilter === 'groups' && chat.type === 'group') ||
        (activeFilter === 'online' && isOnlineChat(chat, user?.uid));
      if (!matchesFilter) return false;
      if (!searchTerm) return true;
      return getSearchText(chat, user?.uid).includes(searchTerm);
    });
  }, [activeFilter, chats, search, user?.uid]);

  const selectedFilter = CHAT_FILTERS.find((filter) => filter.key === activeFilter);
  const emptyState = search.trim()
    ? {
        title: 'No matching chats',
        message: 'Try a different name or clear the search.',
        actionLabel: 'Clear Search',
        onAction: () => setSearch(''),
      }
    : activeFilter !== 'all'
      ? {
          title: `No ${selectedFilter?.label.toLowerCase()} chats`,
          message: 'Switch filters to see the rest of your conversations.',
          actionLabel: 'Show All',
          onAction: () => setActiveFilter('all'),
        }
      : {
          title: 'No conversations yet',
          message: 'Start by connecting with someone from your user list.',
          actionLabel: 'Find People',
          onAction: () => navigation.navigate('NewChat'),
        };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>
            {loading && stats.all === 0
              ? 'Syncing...'
              : stats.all === 1
                ? '1 conversation'
                : `${stats.all} conversations`}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.requestAction}>
            <IconButton
              name="account-multiple-outline"
              onPress={() => navigation.navigate('FriendRequests')}
              color={pendingRequestCount > 0 ? colors.danger : colors.primary}
              backgroundColor={pendingRequestCount > 0 ? colors.dangerLight : colors.primaryLight}
              accessibilityLabel={
                pendingRequestCount > 0
                  ? `${pendingRequestCount} pending friend requests`
                  : 'Friend requests'
              }
            />
            {pendingRequestCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestLabel}</Text>
              </View>
            )}
          </View>
          <IconButton
            name="magnify"
            onPress={() => navigation.navigate('MessageSearch')}
            color={colors.primary}
            backgroundColor={colors.primaryLight}
            accessibilityLabel="Search messages"
          />
          <IconButton
            name="archive"
            onPress={() => navigation.navigate('ArchivedChats')}
            color={colors.primary}
            backgroundColor={colors.primaryLight}
            accessibilityLabel="Archived chats"
          />
          <IconButton
            name="users"
            onPress={() => navigation.navigate('CreateGroup')}
            color={colors.secondary}
            backgroundColor={colors.secondaryLight}
            accessibilityLabel="Create group"
          />
          <IconButton
            name="plus"
            onPress={() => navigation.navigate('NewChat')}
            color={colors.white}
            backgroundColor={colors.primaryDark}
            accessibilityLabel="Start new chat"
          />
        </View>
      </View>

      <View style={styles.controls}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          onClear={() => setSearch('')}
          style={styles.searchBar}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filtersContent}>
          {CHAT_FILTERS.map((filter) => (
            <FilterChip
              key={filter.key}
              active={activeFilter === filter.key}
              count={stats[filter.key]}
              label={filter.label}
              onPress={() => setActiveFilter(filter.key)}
              styles={styles}
            />
          ))}
        </ScrollView>
      </View>

      {loading && chats.length === 0 ? (
        <ChatsSkeleton styles={styles} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              currentUid={user?.uid}
              onPress={() =>
                navigation.navigate('ChatRoom', {
                  chatId: item.id,
                  chatName: getChatName(item, user?.uid),
                  isGroup: item.type === 'group',
                  members: item.members || [],
                  otherUserId: isDirectChat(item)
                    ? getOtherMember(item, user?.uid)?.id || null
                    : null,
                  isPinned: item.isPinned,
                  isMuted: item.isMuted,
                  mutedUntil: item.mutedUntil,
                  isArchived: item.isArchived,
                  isBlocked: item.isBlocked,
                  blockedByMe: item.blockedByMe,
                  blockedByUserId: item.blockedByUserId,
                })
              }
              onLongPress={() =>
                navigation.navigate('ChatSettings', {
                  chatId: item.id,
                  chatName: getChatName(item, user?.uid),
                  isPinned: item.isPinned,
                  isMuted: item.isMuted,
                  mutedUntil: item.mutedUntil,
                  isArchived: item.isArchived,
                  isBlocked: item.isBlocked,
                  blockedByMe: item.blockedByMe,
                  blockedByUserId: item.blockedByUserId,
                  isGroup: item.type === 'group',
                  members: item.members || [],
                  otherUserId: isDirectChat(item)
                    ? getOtherMember(item, user?.uid)?.id || null
                    : null,
                })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={search.trim() ? 'magnify' : 'message-text-outline'}
              title={emptyState.title}
              message={emptyState.message}
              actionLabel={emptyState.actionLabel}
              onAction={emptyState.onAction}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
        />
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
      paddingTop: SIZES.sm,
      paddingBottom: SIZES.sm,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      paddingRight: SIZES.sm,
    },
    title: {
      ...FONTS.h1,
      color: colors.text,
      fontSize: 28,
    },
    subtitle: {
      ...FONTS.small,
      color: colors.textLight,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    requestAction: {
      position: 'relative',
      marginRight: SIZES.xs,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.danger,
      borderRadius: 11,
      minWidth: 22,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
      paddingHorizontal: 5,
    },
    badgeText: { ...FONTS.tiny, color: colors.white, fontWeight: '800' },
    controls: {
      paddingHorizontal: SIZES.md,
      paddingBottom: SIZES.xs,
    },
    searchBar: {
      height: 46,
      marginHorizontal: 0,
      marginVertical: 0,
      borderRadius: SIZES.borderRadiusLg,
    },
    filtersContent: {
      paddingTop: SIZES.sm,
      paddingBottom: SIZES.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      paddingHorizontal: SIZES.sm + 4,
      marginRight: SIZES.xs + 2,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    chipTextActive: {
      color: colors.white,
      fontWeight: '700',
    },
    chipCount: {
      ...FONTS.tiny,
      color: colors.textLight,
      fontWeight: '700',
      marginLeft: 6,
    },
    chipCountActive: {
      color: colors.white,
    },
    listContent: { flexGrow: 1, paddingTop: 4, paddingBottom: SIZES.xl + SIZES.md },
    emptyListContent: {
      justifyContent: 'center',
    },
    skeletonWrap: {
      paddingTop: SIZES.sm,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      marginHorizontal: SIZES.sm,
    },
    skeletonAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surfaceAlt,
    },
    skeletonContent: {
      flex: 1,
      marginLeft: SIZES.sm + 4,
    },
    skeletonLine: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceAlt,
    },
    skeletonTitle: {
      width: '50%',
      height: 13,
    },
    skeletonPreview: {
      width: '80%',
      marginTop: 10,
    },
  });
}

