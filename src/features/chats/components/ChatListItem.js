import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { UserAvatar } from '../../../components/UserAvatar';
import { formatRelativeTime } from '../../../utils/formatTime';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { AppIcon } from '../../../components/AppIcon';

function getDisplayName(chat, otherUser, isGroup) {
  if (isGroup) {
    return chat.name || chat.title || 'Group Chat';
  }

  return otherUser?.displayName || otherUser?.username || 'Blink User';
}

function getPreviewText(chat) {
  const text = chat.lastMessage?.trim();
  if (text) {
    return text;
  }

  return 'Say hello and start the conversation';
}

function getMetaLabel({ isGroup, memberCount, online }) {
  if (isGroup) {
    return `${memberCount} member${memberCount === 1 ? '' : 's'}`;
  }

  return online ? 'Online now' : 'Direct message';
}

export function ChatListItem({ chat, currentUid, onPress, onLongPress }) {
  const isGroup = chat.type === 'group';
  const otherUser = isGroup ? null : chat.members?.find((m) => m.id !== currentUid);
  const name = getDisplayName(chat, otherUser, isGroup);
  const photo = isGroup ? chat.photoURL : otherUser?.photoURL;
  const online = isGroup ? undefined : otherUser?.online;
  const unread = chat.unreadCount?.[currentUid] || 0;
  const hasUnread = unread > 0;
  const memberCount = chat.members?.length || 0;
  const isPinned = !!chat.isPinned;
  const isMuted = !!chat.isMuted;

  const timeLabel = chat.lastMessageAt
    ? formatRelativeTime(chat.lastMessageAt.toDate?.() || chat.lastMessageAt)
    : '';
  const metaLabel = getMetaLabel({ isGroup, memberCount, online });
  const hasFreshUnread = hasUnread && !isMuted;
  const statusIcon = isGroup ? 'users' : online ? 'radio' : 'message-circle';
  const statusColor = isGroup ? COLORS.secondary : online ? COLORS.success : COLORS.textSecondary;

  return (
    <PressableScale
      style={[
        styles.container,
        hasFreshUnread && styles.containerUnread,
        isPinned && styles.containerPinned,
      ]}
      activeScale={0.972}
      activeOpacity={0.93}
      rippleColor={hasFreshUnread ? PRESS_FEEDBACK.lightRipple : PRESS_FEEDBACK.softRipple}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}>
      <View
        pointerEvents="none"
        style={[
          styles.cardGlow,
          isGroup && styles.cardGlowGroup,
          hasFreshUnread && styles.cardGlowUnread,
        ]}
      />
      {hasFreshUnread ? <View style={styles.unreadRail} /> : null}

      <View style={[styles.avatarWrap, hasFreshUnread && styles.avatarWrapUnread]}>
        <View
          pointerEvents="none"
          style={[
            styles.avatarHalo,
            isGroup && styles.avatarHaloGroup,
            hasFreshUnread && styles.avatarHaloUnread,
          ]}
        />
        <UserAvatar photoURL={photo} name={name} size={50} online={online} />
        {isGroup ? (
          <View style={styles.avatarBadge}>
            <AppIcon name="users" size={12} color={COLORS.secondary} />
          </View>
        ) : online ? (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineCore} />
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameWrap}>
            <Text style={[styles.name, hasFreshUnread && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.headerBadges}>
              {isPinned ? (
                <View style={styles.headerBadge}>
                  <AppIcon name="bookmark" size={12} color={COLORS.primary} />
                </View>
              ) : null}
              {isMuted ? (
                <View style={styles.headerBadge}>
                  <AppIcon name="bell-off" size={12} color={COLORS.textLight} />
                </View>
              ) : null}
            </View>
          </View>
          {timeLabel ? (
            <View style={[styles.timePill, hasFreshUnread && styles.timePillUnread]}>
              <Text style={[styles.time, hasFreshUnread && styles.timeUnread]}>{timeLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.previewRow, hasFreshUnread && styles.previewRowUnread]}>
          <View style={[styles.previewIcon, hasFreshUnread && styles.previewIconUnread]}>
            <AppIcon
              name={hasFreshUnread ? 'zap' : 'message-circle'}
              size={12}
              color={hasFreshUnread ? COLORS.primary : COLORS.textLight}
            />
          </View>
          {hasFreshUnread ? <Text style={styles.previewNewLabel}>New</Text> : null}
          <Text
            style={[styles.lastMessage, hasFreshUnread && styles.lastMessageUnread]}
            numberOfLines={1}>
            {getPreviewText(chat)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.statusChip, isGroup && styles.statusChipGroup]}>
            <AppIcon name={statusIcon} size={12} color={statusColor} />
            <Text
              style={[
                styles.metaText,
                isGroup && styles.metaTextGroup,
                online && !isGroup && styles.metaTextOnline,
              ]}
              numberOfLines={1}>
              {metaLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.trailing}>
        {hasUnread ? (
          <>
            {hasFreshUnread ? (
              <View style={styles.newPill}>
                <View style={styles.newDot} />
                <Text style={styles.newText}>New</Text>
              </View>
            ) : null}
            <View style={[styles.badge, isMuted && styles.badgeMuted]}>
              <Text style={[styles.badgeText, isMuted && styles.badgeTextMuted]}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.chevronWrap}>
            <AppIcon name="chevron-right" size={16} color={COLORS.textLight} />
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 98,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 5,
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.xs + 2,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  containerUnread: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.primary,
  },
  containerPinned: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceGlass,
  },
  cardGlow: {
    position: 'absolute',
    top: -36,
    right: -42,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.22,
  },
  cardGlowGroup: {
    backgroundColor: COLORS.secondaryLight,
  },
  cardGlowUnread: {
    opacity: 0.42,
  },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: SIZES.md,
    bottom: SIZES.md,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: COLORS.primary,
  },
  avatarWrap: {
    position: 'relative',
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.small,
  },
  avatarWrapUnread: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  avatarHalo: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.surfaceAlt,
  },
  avatarHaloGroup: {
    backgroundColor: COLORS.secondaryLight,
  },
  avatarHaloUnread: {
    backgroundColor: COLORS.primarySoft,
  },
  avatarBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    ...SHADOWS.small,
  },
  onlineBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.success,
    ...SHADOWS.small,
  },
  onlineCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  content: { flex: 1, minWidth: 0, marginLeft: SIZES.sm + 4 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.sm,
  },
  name: { ...FONTS.bodyBold, color: COLORS.text, flexShrink: 1 },
  nameUnread: { color: COLORS.white },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SIZES.xs,
  },
  headerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 3,
  },
  timePill: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: SIZES.sm,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timePillUnread: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  time: { ...FONTS.tiny, color: COLORS.textLight, fontWeight: '800' },
  timeUnread: { color: COLORS.primary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  statusChip: {
    maxWidth: 160,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    borderRadius: 13,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
  },
  statusChipGroup: {
    borderColor: COLORS.borderStrong,
  },
  metaText: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    fontWeight: '800',
    flex: 1,
    marginLeft: SIZES.xs,
  },
  metaTextGroup: { color: COLORS.secondary },
  metaTextOnline: { color: COLORS.success },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    marginTop: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
  },
  previewRowUnread: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  previewIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    marginRight: SIZES.xs,
  },
  previewIconUnread: {
    backgroundColor: COLORS.backgroundRaised,
  },
  previewNewLabel: {
    ...FONTS.tiny,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginRight: SIZES.xs,
  },
  lastMessage: { ...FONTS.caption, color: COLORS.textSecondary, flex: 1 },
  lastMessageUnread: { color: COLORS.text, fontWeight: '700' },
  trailing: {
    minWidth: 46,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: SIZES.xs,
  },
  newPill: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.xs + 2,
    borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: SIZES.xs,
  },
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: SIZES.xs,
  },
  newText: {
    ...FONTS.tiny,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 15,
    minWidth: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  badgeText: { ...FONTS.tiny, color: COLORS.white, fontWeight: '800' },
  badgeMuted: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  badgeTextMuted: { color: COLORS.textSecondary },
  chevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
