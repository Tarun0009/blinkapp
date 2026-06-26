import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function isEditable(message) {
  if (!message || message.deletedAt) return false;
  const created = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  return Date.now() - created.getTime() < EDIT_WINDOW_MS;
}

export function MessageActionSheet({
  visible,
  message,
  isMe,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
  disableMessageActions = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!message) {
    return null;
  }

  const canReply = !message.deletedAt && !disableMessageActions;
  const canEdit = isMe && isEditable(message) && !disableMessageActions;
  const canDelete = isMe && !message.deletedAt;
  const showReactions = !message.deletedAt;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />

          {showReactions ? (
            <View style={styles.reactionsRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <PressableScale
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                  activeScale={0.86}
                  activeOpacity={0.7}
                  rippleColor={PRESS_FEEDBACK.softRipple}
                  borderless
                  style={styles.reactionBtn}
                  onPress={() => {
                    onReact?.(emoji);
                    onClose?.();
                  }}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}

          <View style={styles.divider} />

          <ActionRow colors={colors} styles={styles} icon="message-text-outline" label="Reply" onPress={() => { onReply?.(); onClose?.(); }} disabled={!canReply} />
          {canEdit ? (
            <ActionRow colors={colors} styles={styles} icon="account-edit-outline" label="Edit" onPress={() => { onEdit?.(); onClose?.(); }} />
          ) : null}
          {canDelete ? (
            <ActionRow
              colors={colors}
              styles={styles}
              icon="close-circle"
              label="Delete for everyone"
              destructive
              onPress={() => { onDelete?.(); onClose?.(); }}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({ colors, styles, icon, label, onPress, destructive, disabled }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      activeScale={0.99}
      activeOpacity={0.86}
      rippleColor={destructive ? PRESS_FEEDBACK.dangerRipple : PRESS_FEEDBACK.softRipple}
      onPress={onPress}
      disabled={disabled}
      style={[styles.row, disabled && styles.rowDisabled]}>
      <AppIcon
        name={icon}
        size={20}
        color={destructive ? colors.danger : colors.text}
      />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDanger]}>{label}</Text>
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderTopWidth: 1,
      borderColor: colors.borderStrong,
      paddingTop: SIZES.md,
      paddingBottom: SIZES.xl,
      ...SHADOWS.medium,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: SIZES.md,
    },
    reactionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: SIZES.md,
      paddingBottom: SIZES.md,
    },
    reactionBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    reactionEmoji: { fontSize: 24 },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: SIZES.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.lg,
      paddingVertical: SIZES.sm + 6,
      marginHorizontal: SIZES.sm,
      borderRadius: SIZES.borderRadius,
    },
    rowDisabled: { opacity: 0.5 },
    rowLabel: {
      ...FONTS.body,
      color: colors.text,
      marginLeft: SIZES.md,
    },
    rowLabelDanger: { color: colors.danger },
  });
}
