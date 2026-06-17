import React from 'react';
import { StyleSheet } from 'react-native';
import { COLORS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { AppIcon } from './AppIcon';
import { PressableScale } from './PressableScale';

export function IconButton({
  name,
  onPress,
  color = COLORS.text,
  size = ICON_SIZES.lg,
  backgroundColor = COLORS.surfaceElevated,
  disabled = false,
  accessibilityLabel,
  style,
}) {
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
        { backgroundColor },
        disabled && styles.disabled,
        style,
      ]}>
      <AppIcon name={name} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  disabled: {
    opacity: 0.45,
  },
});
