import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { AppIcon } from './AppIcon';
import { PRESS_FEEDBACK, PressableScale } from './PressableScale';

export function EmptyState({ icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={styles.iconHalo} />
        <AppIcon name={icon} size={ICON_SIZES.xl - 14} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityRole="button"
          activeScale={0.97}
          activeOpacity={0.9}
          rippleColor={PRESS_FEEDBACK.lightRipple}
          style={styles.action}
          onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.xxl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceGlass,
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOWS.soft,
  },
  iconHalo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.sm,
    lineHeight: 20,
  },
  action: {
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm + 2,
    borderRadius: SIZES.borderRadiusLg,
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  actionText: {
    ...FONTS.caption,
    color: COLORS.white,
    fontWeight: '700',
  },
});
