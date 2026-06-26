import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { UserAvatar } from '../../../components/UserAvatar';
import { formatPresenceStatus, formatRelativeTime } from '../../../utils/formatTime';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { AppIcon } from '../../../components/AppIcon';

function getDisplayName(chat, otherUser, isGroup) {
  if (isGroup) {
    return chat.name || chat.title || 'Group Chat';
  }
  return otherUser?.displayName || otherUser?.username || 'Blink User';
}

function getPreviewText(chat) {
  if (chat.isBlocked) {
    return chat.blockedByMe ? 'You blocked this user' : 'Messaging unavailable';
  }

  const text = chat.lastMessage?.trim();
  if (text) return text;
  return 'Say hello and start the conversation';
}

function getUnreadCount(chat, currentUid) {
  if (Number.isFinite(Number(chat.viewerUnreadCount))) {
    return Number(chat.viewerUnreadCount);
  }

  if (currentUid && Number.isFinite(Number(chat.unreadCount?.[currentUid]))) {
    return Number(chat.unreadCount[currentUid]);
  }

  const counts = Object.values(chat.unreadCount || {}).map((value) => Number(value));
  const fallback = counts.find((value) => Number.isFinite(value) && value > 0);
  return fallback || 0;
}

export function ChatListItem({ chat, currentUid, onPress, onLongPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isGroup = chat.type === 'group';
  const otherUser = isGroup ? null : chat.members?.find((m) => m.id !== currentUid);
  const name = getDisplayName(chat, otherUser, isGroup);
  const photo = isGroup ? chat.photoURL : otherUser?.photoURL;
  const online = isGroup ? undefined : otherUser?.online;
  const presenceLabel = isGroup
    ? ''
    : formatPresenceStatus({ online, lastSeen: otherUser?.lastSeenAt });
  const unread = getUnreadCount(chat, currentUid);
  const hasUnread = unread > 0;
  const hasFreshUnread = hasUnread;
  const isPinned = !!chat.isPinned;
  const isMuted = !!chat.isMuted;

  const timeLabel = chat.lastMessageAt
    ? formatRelativeTime(chat.lastMessageAt.toDate?.() || chat.lastMessageAt)
    : '';

  return (
    <PressableScale
      style={[styles.row, hasFreshUnread && styles.rowUnread]}
      activeScale={0.985}
      activeOpacity={0.94}
      rippleColor={PRESS_FEEDBACK.softRipple}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}>
      {hasFreshUnread ? <View style={styles.rail} /> : null}

      <View style={styles.avatarWrap}>
        <UserAvatar photoURL={photo} name={name} size={52} online={online} />
        {isGroup ? (
          <View style={styles.groupBadge}>
            <AppIcon name="users" size={11} color={colors.secondary} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.nameWrap}>
            <Text style={[styles.name, hasFreshUnread && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            {isPinned ? (
              <AppIcon name="bookmark" size={13} color={colors.primary} style={styles.inlineIcon} />
            ) : null}
            {isMuted ? (
              <AppIcon name="bell-off" size={13} color={colors.textLight} style={styles.inlineIcon} />
            ) : null}
          </View>
          <View style={styles.timeWrap}>
            {hasFreshUnread ? <View style={styles.unreadDot} /> : null}
            {timeLabel ? (
              <Text style={[styles.time, hasFreshUnread && styles.timeUnread]}>{timeLabel}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, hasFreshUnread && styles.previewUnread]}
            numberOfLines={1}>
            {getPreviewText(chat)}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadStack}>
              <Text style={[styles.newLabel, isMuted && styles.newLabelMuted]}>New</Text>
              <View style={[styles.badge, isMuted && styles.badgeMuted]}>
                <Text style={[styles.badgeText, isMuted && styles.badgeTextMuted]}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {!isGroup ? (
          <View style={styles.presenceRow}>
            <View
              style={[
                styles.presenceDot,
                online ? styles.presenceDotOnline : styles.presenceDotOffline,
              ]}
            />
            <Text style={[styles.presenceText, online && styles.presenceTextOnline]} numberOfLines={1}>
              {presenceLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 78,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 3,
      marginHorizontal: SIZES.sm,
      marginVertical: 4,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    rowUnread: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...SHADOWS.glow,
    },
    rail: {
      position: 'absolute',
      left: 8,
      top: 16,
      bottom: 16,
      width: 4,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    avatarWrap: {
      position: 'relative',
      width: 52,
      height: 52,
    },
    groupBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    body: {
      flex: 1,
      minWidth: 0,
      marginLeft: SIZES.sm + 4,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    nameWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: SIZES.sm,
    },
    name: {
      ...FONTS.bodyBold,
      color: colors.text,
      flexShrink: 1,
    },
    nameUnread: {
      color: colors.text,
      fontWeight: '900',
    },
    inlineIcon: {
      marginLeft: 6,
    },
    timeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 6,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 8,
      elevation: 4,
    },
    time: {
      ...FONTS.tiny,
      color: colors.textLight,
      fontWeight: '700',
    },
    timeUnread: {
      color: colors.primary,
      fontWeight: '900',
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    preview: {
      ...FONTS.caption,
      color: colors.textSecondary,
      flex: 1,
      marginRight: SIZES.sm,
    },
    previewUnread: {
      color: colors.text,
      fontWeight: '900',
    },
    unreadStack: {
      alignItems: 'flex-end',
      marginLeft: SIZES.sm,
    },
    newLabel: {
      ...FONTS.tiny,
      color: colors.primary,
      fontWeight: '900',
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    newLabelMuted: {
      color: colors.textLight,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 11,
      minWidth: 22,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 7,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 5,
    },
    badgeText: {
      ...FONTS.tiny,
      color: colors.white,
      fontWeight: '800',
    },
    badgeMuted: {
      backgroundColor: colors.surfaceAlt,
    },
    badgeTextMuted: {
      color: colors.textSecondary,
    },
    presenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    presenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    presenceDotOnline: {
      backgroundColor: colors.online,
    },
    presenceDotOffline: {
      backgroundColor: colors.offline,
    },
    presenceText: {
      ...FONTS.small,
      color: colors.textLight,
      flex: 1,
      fontWeight: '700',
    },
    presenceTextOnline: {
      color: colors.online,
    },
  });
}
