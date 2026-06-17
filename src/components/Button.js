import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { COLORS, FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { AppIcon } from './AppIcon';
import { PRESS_FEEDBACK, PressableScale } from './PressableScale';

const VARIANTS = {
  primary: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
    color: COLORS.white,
  },
  secondary: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.borderStrong,
    color: COLORS.text,
  },
  danger: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.danger,
    color: COLORS.danger,
  },
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      activeScale={0.98}
      activeOpacity={0.9}
      rippleColor={variant === 'primary' ? PRESS_FEEDBACK.lightRipple : PRESS_FEEDBACK.softRipple}
      style={[
        styles.button,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        variant === 'primary' && styles.primaryShadow,
        variant === 'secondary' && styles.secondaryBorder,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.color} />
      ) : (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              size={ICON_SIZES.md}
              color={palette.color}
              style={styles.icon}
            />
          ) : null}
          <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: SIZES.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  primaryShadow: {
    ...SHADOWS.glow,
  },
  secondaryBorder: {
    borderTopColor: COLORS.highlight,
  },
  disabled: {
    opacity: 0.65,
  },
  icon: {
    marginRight: SIZES.sm,
  },
  label: {
    ...FONTS.bodyBold,
  },
});
