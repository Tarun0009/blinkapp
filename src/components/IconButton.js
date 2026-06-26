import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { PressableScale } from './PressableScale';

export function IconButton({
  name,
  onPress,
  color,
  size = ICON_SIZES.lg,
  backgroundColor,
  disabled = false,
  accessibilityLabel,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconColor = color ?? colors.text;
  const bgColor = backgroundColor ?? colors.surfaceElevated;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      activeScale={0.9}
      activeOpacity={0.78}
      borderless
      style={[
        styles.button,
        { backgroundColor: bgColor },
        disabled && styles.disabled,
        style,
      ]}>
      <AppIcon name={name} size={size} color={iconColor} />
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: SIZES.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopColor: colors.highlight,
      ...SHADOWS.soft,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
