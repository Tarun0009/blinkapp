import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { UserAvatar } from '../../../components/UserAvatar';

export function FriendRequestCard({ request, onAccept, onReject }) {
  return (
    <View style={styles.requestCard}>
      <UserAvatar name={request.senderName} size={50} />
      <View style={styles.info}>
        <Text style={styles.name}>{request.senderName}</Text>
        <Text style={styles.msg}>wants to connect with you</Text>
      </View>
      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Accept request from ${request.senderName}`}
          style={[styles.btn, styles.acceptBtn]}
          activeScale={0.9}
          activeOpacity={0.82}
          rippleColor={PRESS_FEEDBACK.lightRipple}
          borderless
          onPress={() => onAccept(request)}>
          <AppIcon name="check" size={18} color={COLORS.white} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Reject request from ${request.senderName}`}
          style={[styles.btn, styles.rejectBtn]}
          activeScale={0.9}
          activeOpacity={0.78}
          rippleColor={PRESS_FEEDBACK.softRipple}
          borderless
          onPress={() => onReject(request.id)}>
          <AppIcon name="close" size={18} color={COLORS.textSecondary} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.md,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.sm,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  info: { flex: 1, marginLeft: SIZES.sm },
  name: { ...FONTS.bodyBold, color: COLORS.text },
  msg: { ...FONTS.caption, color: COLORS.textSecondary },
  actions: { flexDirection: 'row' },
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginLeft: SIZES.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  acceptBtn: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primary },
  rejectBtn: { backgroundColor: COLORS.backgroundRaised },
});
