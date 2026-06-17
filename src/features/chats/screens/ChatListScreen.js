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
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useChats } from '../hooks/useChats';
import { useFriendRequests } from '../../friend-requests/hooks/useFriendRequests';
import { ChatListItem } from '../components/ChatListItem';
import { SearchBar } from '../../../components/SearchBar';
import { IconButton } from '../../../components/IconButton';
import { EmptyState } from '../../../components/EmptyState';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';

const CHAT_FILTERS = [
  { key: 'all', label: 'All', icon: 'message-circle' },
  { key: 'direct', label: 'Direct', icon: 'user' },
  { key: 'groups', label: 'Groups', icon: 'users' },
  { key: 'online', label: 'Online', icon: 'radio' },
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

function MetricPill({ icon, label, value, tone = 'primary' }) {
  const toneMap = {
    primary: { bg: COLORS.primaryLight, color: COLORS.primary },
    success: { bg: COLORS.successLight, color: COLORS.success },
    warning: { bg: COLORS.warningLight, color: COLORS.warning },
  };
  const toneStyle = toneMap[tone] || toneMap.primary;

  return (
    <View style={styles.metricPill}>
      <View style={[styles.metricIcon, { backgroundColor: toneStyle.bg }]}>
        <AppIcon name={icon} size={16} color={toneStyle.color} />
      </View>
      <View style={styles.metricTextWrap}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function FilterChip({ active, count, icon, label, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeScale={0.96}
      activeOpacity={0.82}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}>
      <AppIcon
        name={icon}
        size={15}
        color={active ? COLORS.primary : COLORS.textSecondary}
      />
      <Text
        style={[styles.filterText, active && styles.filterTextActive]}
        numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.filterCount, active && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    </PressableScale>
  );
}

function ChatSkeletonRow({ compact = false }) {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, styles.skeletonTitle, compact && styles.skeletonShort]} />
        <View style={[styles.skeletonLine, styles.skeletonMeta]} />
        <View style={[styles.skeletonLine, styles.skeletonPreview, compact && styles.skeletonMedium]} />
      </View>
    </View>
  );
}

function ChatsSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((item) => (
        <ChatSkeletonRow key={item} compact={item % 2 === 1} />
      ))}
    </View>
  );
}

export function ChatListScreen({ navigation }) {
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
    const unreadMessages = chats.reduce(
      (count, chat) =>
        chat.isMuted ? count : count + (chat.unreadCount?.[user?.uid] || 0),
      0,
    );
    const unreadChats = chats.filter(
      (chat) => !chat.isMuted && (chat.unreadCount?.[user?.uid] || 0) > 0,
    ).length;

    return {
      all: chats.length,
      direct,
      groups,
      online,
      pending: pendingRequestCount,
      unreadChats,
      unreadMessages,
    };
  }, [chats, pendingRequestCount, user?.uid]);

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return chats.filter((chat) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'direct' && isDirectChat(chat)) ||
        (activeFilter === 'groups' && chat.type === 'group') ||
        (activeFilter === 'online' && isOnlineChat(chat, user?.uid));

      if (!matchesFilter) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return getSearchText(chat, user?.uid).includes(searchTerm);
    });
  }, [activeFilter, chats, search, user?.uid]);

  const selectedFilter = CHAT_FILTERS.find((filter) => filter.key === activeFilter);
  const totalLabel = stats.all === 1 ? '1 conversation' : `${stats.all} conversations`;
  const newMessageLabel =
    stats.unreadMessages > 99
      ? '99+ new'
      : stats.unreadMessages === 1
        ? '1 new'
        : `${stats.unreadMessages} new`;
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Messages</Text>
            <Text style={styles.title}>Blink</Text>
            <Text style={styles.subtitle}>
              {loading && stats.all === 0 ? 'Syncing conversations...' : totalLabel}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.requestAction}>
              <IconButton
                name="account-multiple-outline"
                onPress={() => navigation.navigate('FriendRequests')}
                color={pendingRequestCount > 0 ? COLORS.danger : COLORS.primary}
                backgroundColor={pendingRequestCount > 0 ? COLORS.dangerLight : COLORS.primaryLight}
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
              name="archive"
              onPress={() => navigation.navigate('ArchivedChats')}
              color={COLORS.primary}
              backgroundColor={COLORS.primaryLight}
              accessibilityLabel="Archived chats"
            />
            <IconButton
              name="users"
              onPress={() => navigation.navigate('CreateGroup')}
              color={COLORS.secondary}
              backgroundColor={COLORS.secondaryLight}
              accessibilityLabel="Create group"
            />
            <IconButton
              name="plus"
              onPress={() => navigation.navigate('NewChat')}
              color={COLORS.white}
              backgroundColor={COLORS.primaryDark}
              accessibilityLabel="Start new chat"
            />
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <AppIcon name="zap" size={20} color={COLORS.white} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Realtime conversations</Text>
            <Text style={styles.heroText} numberOfLines={2}>
              {pendingRequestCount > 0
                ? `${pendingRequestCount} request${pendingRequestCount === 1 ? '' : 's'} waiting for your response.`
                : 'Your direct chats and groups stay organized here.'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricPill icon="message-circle" label="Chats" value={stats.all} />
          <MetricPill icon="radio" label="Online" value={stats.online} tone="success" />
          <MetricPill
            icon="users"
            label="Requests"
            value={stats.pending}
            tone={stats.pending > 0 ? 'warning' : 'primary'}
          />
        </View>
      </View>

      <View style={styles.controls}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
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
              icon={filter.icon}
              label={filter.label}
              onPress={() => setActiveFilter(filter.key)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <View style={styles.sectionIcon}>
            <AppIcon
              name={selectedFilter?.icon || 'message-circle'}
              size={16}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>{selectedFilter?.label || 'All'} chats</Text>
            <Text style={styles.sectionSubtitle}>
              {filtered.length === 1 ? '1 conversation' : `${filtered.length} conversations`}
              {stats.unreadChats > 0
                ? ` • ${stats.unreadChats} unread`
                : ''}
            </Text>
          </View>
        </View>
        <View style={[styles.livePill, stats.unreadMessages > 0 && styles.newMessagesPill]}>
          <View style={[styles.liveDot, stats.unreadMessages > 0 && styles.newMessagesDot]} />
          <Text style={[styles.liveText, stats.unreadMessages > 0 && styles.newMessagesText]}>
            {stats.unreadMessages > 0 ? newMessageLabel : 'Live'}
          </Text>
        </View>
      </View>

      {loading && chats.length === 0 ? (
        <ChatsSkeleton />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 292,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: SIZES.sm,
  },
  eyebrow: {
    ...FONTS.small,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    ...FONTS.h1,
    color: COLORS.text,
    marginTop: 2,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
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
    top: -7,
    right: -7,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surfaceElevated,
    paddingHorizontal: 5,
  },
  badgeText: { ...FONTS.tiny, color: COLORS.white, fontWeight: '800' },
  heroCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.md,
    padding: SIZES.md,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryDark,
    marginRight: SIZES.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  heroText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: SIZES.sm,
  },
  metricPill: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    marginRight: SIZES.xs,
    ...SHADOWS.small,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.xs,
  },
  metricTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  metricValue: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  metricLabel: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  controls: {
    paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.sm,
  },
  searchBar: {
    height: 48,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: SIZES.borderRadiusLg,
    ...SHADOWS.soft,
  },
  filtersContent: {
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.xs,
  },
  filterChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SIZES.sm + 2,
    paddingRight: SIZES.xs,
    marginRight: SIZES.sm,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  filterText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginLeft: SIZES.xs,
  },
  filterTextActive: {
    color: COLORS.primary,
  },
  filterCount: {
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    marginLeft: SIZES.xs,
  },
  filterCountActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  filterCountText: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    fontWeight: '800',
  },
  filterCountTextActive: {
    color: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.sm,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SIZES.sm,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  sectionSubtitle: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  livePill: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    marginLeft: SIZES.sm,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: SIZES.xs,
  },
  newMessagesPill: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  newMessagesDot: {
    backgroundColor: COLORS.primary,
  },
  liveText: {
    ...FONTS.small,
    color: COLORS.success,
    fontWeight: '800',
  },
  newMessagesText: {
    color: COLORS.primary,
  },
  listContent: { flexGrow: 1, paddingTop: SIZES.xs, paddingBottom: SIZES.xl + SIZES.md },
  emptyListContent: {
    justifyContent: 'center',
  },
  skeletonWrap: {
    paddingTop: SIZES.xs,
    paddingBottom: SIZES.xl,
  },
  skeletonRow: {
    minHeight: 98,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.xs + 2,
    padding: SIZES.md,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  skeletonAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonContent: {
    flex: 1,
    marginLeft: SIZES.sm + 4,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonTitle: {
    width: '62%',
    height: 14,
  },
  skeletonMeta: {
    width: 86,
    marginTop: SIZES.sm,
  },
  skeletonPreview: {
    width: '88%',
    marginTop: SIZES.sm,
  },
  skeletonShort: {
    width: '46%',
  },
  skeletonMedium: {
    width: '68%',
  },
});
