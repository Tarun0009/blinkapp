import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { SIZES, FONTS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { formatMessageTime } from '../../../utils/formatTime';
import { PressableScale } from '../../../components/PressableScale';
import { AppIcon } from '../../../components/AppIcon';
import { UserAvatar } from '../../../components/UserAvatar';

function ReceiptTicks({ status, colors, styles }) {
  const normalizedStatus = status || 'sent';
  const isDoubleTick = normalizedStatus === 'delivered' || normalizedStatus === 'read';
  const color = normalizedStatus === 'read' ? colors.secondary : colors.whiteMuted;

  return (
    <View style={styles.receiptWrap}>
      <AppIcon name="check" size={12} color={color} />
      {isDoubleTick ? (
        <AppIcon name="check" size={12} color={color} style={styles.receiptSecondIcon} />
      ) : null}
    </View>
  );
}

function ReplyPreview({ reply, isMe, styles }) {
  if (!reply) return null;
  const previewText = reply.deletedAt ? 'Message deleted' : reply.text || 'Message';
  return (
    <View style={[styles.replyPreview, isMe ? styles.replyPreviewMe : styles.replyPreviewOther]}>
      <View style={[styles.replyAccent, isMe ? styles.replyAccentMe : styles.replyAccentOther]} />
      <View style={styles.replyBody}>
        {reply.senderName ? (
          <Text
            style={[styles.replyName, isMe ? styles.replyNameMe : styles.replyNameOther]}
            numberOfLines={1}>
            {reply.senderName}
          </Text>
        ) : null}
        <Text
          style={[styles.replyText, isMe ? styles.replyTextMe : styles.replyTextOther]}
          numberOfLines={2}>
          {previewText}
        </Text>
      </View>
    </View>
  );
}

function ReactionChips({ reactions, currentUid, isMe, onPress, styles }) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={[styles.reactionsRow, isMe ? styles.reactionsRowMe : styles.reactionsRowOther]}>
      {reactions.map((reaction) => {
        const youReacted = reaction.userIds?.includes(currentUid);
        return (
          <PressableScale
            key={reaction.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${reaction.emoji} ${reaction.count}`}
            activeScale={0.9}
            activeOpacity={0.8}
            borderless
            style={[styles.reactionChip, youReacted && styles.reactionChipMine]}
            onPress={() => onPress?.(reaction.emoji)}>
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={[styles.reactionCount, youReacted && styles.reactionCountMine]}>
              {reaction.count}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function MessageBubble({
  highlightNewMessage = false,
  showSeenLabel = false,
  seenLabel = 'Seen',
  message,
  isMe,
  currentUid,
  onImagePress,
  onLongPress,
  onReactionPress,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isImage = message.type === 'image';
  const isDeleted = !!message.deletedAt;
  const isEdited = !!message.editedAt && !isDeleted;
  const isLocalPending = ['pending', 'failed'].includes(message.pendingStatus);
  const pendingLabel = message.pendingStatus === 'failed' ? 'Failed' : 'Sending';
  const senderName = message.sender?.displayName || message.sender?.username || 'Blink User';
  const senderPhoto = message.sender?.photoURL;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
      {!isMe ? (
        <View style={styles.avatarSlot}>
          <UserAvatar photoURL={senderPhoto} name={senderName} size={28} />
        </View>
      ) : null}

      <View style={[styles.messageColumn, isMe ? styles.messageColumnMe : styles.messageColumnOther]}>
        {!isMe ? (
          <Text style={styles.senderName} numberOfLines={1}>
            {senderName}
          </Text>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Message"
          activeScale={1}
          activeOpacity={0.96}
          borderless
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={250}
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            highlightNewMessage && !isMe && styles.bubbleNewIncoming,
            isDeleted && styles.bubbleDeleted,
          ]}>
          {message.replyTo ? <ReplyPreview reply={message.replyTo} isMe={isMe} styles={styles} /> : null}

          {isDeleted ? (
            <View style={styles.deletedRow}>
              <AppIcon
                name="close-circle"
                size={14}
                color={isMe ? colors.whiteMuted : colors.textLight}
              />
              <Text
                style={[
                  styles.deletedText,
                  isMe ? styles.deletedTextMe : styles.deletedTextOther,
                ]}>
                Message deleted
              </Text>
            </View>
          ) : (
            <>
              {isImage && message.imageURL ? (
                <PressableScale
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Open image"
                  activeScale={0.98}
                  activeOpacity={0.86}
                  onPress={() => onImagePress?.(message.imageURL)}
                  onLongPress={() => onLongPress?.(message)}
                  delayLongPress={250}>
                  <Image source={{ uri: message.imageURL }} style={styles.image} />
                </PressableScale>
              ) : null}
              {message.text ? (
                <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>
                  {message.text}
                </Text>
              ) : null}
            </>
          )}

          <View style={styles.metaRow}>
            {isEdited ? (
              <Text style={[styles.editedTag, isMe ? styles.editedTagMe : styles.editedTagOther]}>
                edited ·{' '}
              </Text>
            ) : null}
            <Text style={[styles.time, isMe ? styles.timeMe : styles.timeOther]}>
              {formatMessageTime(message.createdAt)}
            </Text>
            {isMe && !isDeleted && !isLocalPending ? (
              <ReceiptTicks status={message.status} colors={colors} styles={styles} />
            ) : null}
            {isMe && isLocalPending ? (
              <Text style={[styles.pendingText, message.pendingStatus === 'failed' && styles.failedText]}>
                {' · '}{pendingLabel}
              </Text>
            ) : null}
          </View>
        </PressableScale>

        <ReactionChips
          reactions={message.reactions}
          currentUid={currentUid}
          isMe={isMe}
          onPress={(emoji) => onReactionPress?.(message, emoji)}
          styles={styles}
        />
        {showSeenLabel && isMe ? <Text style={styles.seenLabel}>{seenLabel}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginVertical: 3,
      paddingHorizontal: SIZES.md,
    },
    rowMe: { justifyContent: 'flex-end' },
    rowOther: { justifyContent: 'flex-start' },
    avatarSlot: {
      width: 32,
      alignItems: 'flex-start',
      marginRight: SIZES.xs + 2,
      marginBottom: 2,
    },
    messageColumn: {
      maxWidth: '78%',
      minWidth: 0,
    },
    messageColumnMe: { alignItems: 'flex-end' },
    messageColumnOther: { alignItems: 'flex-start' },
    senderName: {
      ...FONTS.tiny,
      color: colors.textLight,
      fontWeight: '700',
      marginBottom: 3,
      marginLeft: SIZES.sm,
      maxWidth: 180,
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: SIZES.md - 2,
      paddingVertical: SIZES.sm + 2,
      minHeight: 38,
      maxWidth: '100%',
    },
    bubbleMe: {
      backgroundColor: colors.primaryDark,
      borderBottomRightRadius: 6,
    },
    bubbleOther: {
      backgroundColor: colors.surfaceElevated,
      borderBottomLeftRadius: 6,
    },
    bubbleNewIncoming: {
      backgroundColor: colors.primarySoft,
    },
    bubbleDeleted: {
      opacity: 0.78,
    },
    text: { ...FONTS.body, lineHeight: 22 },
    textMe: { color: colors.white },
    textOther: { color: colors.text },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    time: { ...FONTS.tiny },
    timeMe: { color: colors.whiteMuted },
    timeOther: { color: colors.textLight },
    receiptWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 4,
      width: 18,
    },
    receiptSecondIcon: {
      marginLeft: -7,
    },
    image: {
      width: 200,
      height: 200,
      borderRadius: SIZES.cardRadius,
      marginBottom: SIZES.xs,
      backgroundColor: colors.surfaceAlt,
    },
    editedTag: { ...FONTS.tiny, fontStyle: 'italic' },
    editedTagMe: { color: colors.whiteMuted },
    editedTagOther: { color: colors.textLight },
    replyPreview: {
      flexDirection: 'row',
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: 6,
      overflow: 'hidden',
    },
    replyPreviewMe: { backgroundColor: 'rgba(255,255,255,0.14)' },
    replyPreviewOther: { backgroundColor: colors.backgroundRaised },
    replyAccent: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
      marginRight: 8,
    },
    replyAccentMe: { backgroundColor: colors.white },
    replyAccentOther: { backgroundColor: colors.primary },
    replyBody: { flex: 1, minWidth: 0 },
    replyName: { ...FONTS.small, fontWeight: '700' },
    replyNameMe: { color: colors.white },
    replyNameOther: { color: colors.primary },
    replyText: { ...FONTS.small },
    replyTextMe: { color: colors.whiteMuted },
    replyTextOther: { color: colors.textSecondary },
    deletedRow: { flexDirection: 'row', alignItems: 'center' },
    deletedText: { ...FONTS.body, fontStyle: 'italic', marginLeft: 6 },
    deletedTextMe: { color: colors.whiteMuted },
    deletedTextOther: { color: colors.textLight },
    reactionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      maxWidth: '100%',
      marginTop: 4,
      marginHorizontal: 4,
    },
    reactionsRowMe: {
      alignSelf: 'flex-end',
      justifyContent: 'flex-end',
    },
    reactionsRowOther: {
      alignSelf: 'flex-start',
      justifyContent: 'flex-start',
    },
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 24,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      marginRight: 4,
      marginTop: 3,
    },
    reactionChipMine: {
      backgroundColor: colors.primaryLight,
    },
    reactionEmoji: { fontSize: 13 },
    reactionCount: { ...FONTS.tiny, color: colors.textSecondary, marginLeft: 4, fontWeight: '600' },
    reactionCountMine: { color: colors.primary },
    pendingText: {
      ...FONTS.tiny,
      color: colors.whiteMuted,
      fontWeight: '800',
    },
    failedText: {
      color: colors.danger,
    },
    seenLabel: {
      ...FONTS.tiny,
      color: colors.textLight,
      fontWeight: '800',
      marginTop: 3,
      marginRight: 6,
    },
  });
}
