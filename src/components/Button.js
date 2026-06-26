import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { PRESS_FEEDBACK, PressableScale } from './PressableScale';

function getVariants(colors) {
  return {
    primary: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primary,
      color: colors.white,
    },
    secondary: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderStrong,
      color: colors.text,
    },
    danger: {
      backgroundColor: colors.dangerLight,
      borderColor: colors.danger,
      color: colors.danger,
    },
  };
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const variants = useMemo(() => getVariants(colors), [colors]);
  const palette = variants[variant] || variants.primary;
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

function createStyles(colors) {
  return StyleSheet.create({
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
      borderTopColor: colors.highlight,
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
}
