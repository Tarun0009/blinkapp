import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { formatMessageTime } from '../../../utils/formatTime';
import { PressableScale } from '../../../components/PressableScale';
import { AppIcon } from '../../../components/AppIcon';
import { UserAvatar } from '../../../components/UserAvatar';

function ReceiptTicks({ status }) {
  const normalizedStatus = status || 'sent';
  const isDoubleTick = normalizedStatus === 'delivered' || normalizedStatus === 'read';
  const color = normalizedStatus === 'read' ? COLORS.secondary : COLORS.whiteMuted;

  return (
    <View style={styles.receiptWrap}>
      <AppIcon name="check" size={12} color={color} />
      {isDoubleTick ? (
        <AppIcon name="check" size={12} color={color} style={styles.receiptSecondIcon} />
      ) : null}
    </View>
  );
}

function ReplyPreview({ reply, isMe }) {
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

function ReactionChips({ reactions, currentUid, isMe, onPress }) {
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
  message,
  isMe,
  currentUid,
  onImagePress,
  onLongPress,
  onReactionPress,
}) {
  const isImage = message.type === 'image';
  const isDeleted = !!message.deletedAt;
  const isEdited = !!message.editedAt && !isDeleted;
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
          {highlightNewMessage && !isMe ? (
            <View style={styles.newMessagePill}>
              <View style={styles.newMessageDot} />
              <Text style={styles.newMessageText}>New message</Text>
            </View>
          ) : null}

          {message.replyTo ? <ReplyPreview reply={message.replyTo} isMe={isMe} /> : null}

          {isDeleted ? (
            <View style={styles.deletedRow}>
              <AppIcon
                name="close-circle"
                size={14}
                color={isMe ? COLORS.whiteMuted : COLORS.textLight}
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

          <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
            {isEdited ? (
              <Text
                style={[styles.editedTag, isMe ? styles.editedTagMe : styles.editedTagOther]}>
                edited ·{' '}
              </Text>
            ) : null}
            <Text style={[styles.time, isMe ? styles.timeMe : styles.timeOther]}>
              {formatMessageTime(message.createdAt)}
            </Text>
            {isMe && !isDeleted ? <ReceiptTicks status={message.status} /> : null}
          </View>
        </PressableScale>

        <ReactionChips
          reactions={message.reactions}
          currentUid={currentUid}
          isMe={isMe}
          onPress={(emoji) => onReactionPress?.(message, emoji)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: SIZES.md,
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: {
    width: 36,
    alignItems: 'flex-start',
    marginRight: SIZES.xs + 1,
    marginBottom: 2,
  },
  messageColumn: {
    maxWidth: '82%',
    minWidth: 0,
  },
  messageColumnMe: {
    alignItems: 'flex-end',
  },
  messageColumnOther: {
    alignItems: 'flex-start',
  },
  senderName: {
    ...FONTS.tiny,
    color: COLORS.textLight,
    marginBottom: 4,
    marginLeft: SIZES.xs,
    maxWidth: 180,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 3,
    minHeight: 40,
    maxWidth: '100%',
    ...SHADOWS.small,
  },
  bubbleMe: {
    backgroundColor: COLORS.primaryDark,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: COLORS.primaryDark,
  },
  bubbleOther: {
    backgroundColor: COLORS.surfaceGlass,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
  },
  bubbleNewIncoming: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDark,
    ...SHADOWS.glow,
  },
  bubbleDeleted: {
    opacity: 0.84,
  },
  newMessagePill: {
    alignSelf: 'flex-start',
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    borderRadius: 11,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: SIZES.xs,
  },
  newMessageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: SIZES.xs,
  },
  newMessageText: {
    ...FONTS.tiny,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  text: { ...FONTS.body, letterSpacing: 0 },
  textMe: { color: COLORS.white },
  textOther: { color: COLORS.text },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaRowMe: { alignSelf: 'flex-end' },
  metaRowOther: { alignSelf: 'flex-end' },
  time: { ...FONTS.tiny },
  timeMe: { color: COLORS.whiteMuted },
  timeOther: { color: COLORS.textLight },
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
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  editedTag: { ...FONTS.tiny, fontStyle: 'italic' },
  editedTagMe: { color: COLORS.whiteMuted },
  editedTagOther: { color: COLORS.textLight },
  replyPreview: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  replyPreviewMe: { backgroundColor: 'rgba(255,255,255,0.14)' },
  replyPreviewOther: { backgroundColor: COLORS.backgroundRaised },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 8,
  },
  replyAccentMe: { backgroundColor: COLORS.white },
  replyAccentOther: { backgroundColor: COLORS.primary },
  replyBody: { flex: 1, minWidth: 0 },
  replyName: { ...FONTS.small, fontWeight: '700' },
  replyNameMe: { color: COLORS.white },
  replyNameOther: { color: COLORS.primary },
  replyText: { ...FONTS.small },
  replyTextMe: { color: COLORS.whiteMuted },
  replyTextOther: { color: COLORS.textSecondary },
  deletedRow: { flexDirection: 'row', alignItems: 'center' },
  deletedText: { ...FONTS.body, fontStyle: 'italic', marginLeft: 6 },
  deletedTextMe: { color: COLORS.whiteMuted },
  deletedTextOther: { color: COLORS.textLight },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: '100%',
    marginTop: 5,
    marginHorizontal: SIZES.xs,
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
    minHeight: 25,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    marginRight: 4,
    marginTop: 2,
    ...SHADOWS.small,
  },
  reactionChipMine: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { ...FONTS.tiny, color: COLORS.textSecondary, marginLeft: 4, fontWeight: '600' },
  reactionCountMine: { color: COLORS.primary },
});
