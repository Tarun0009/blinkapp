import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

const VARIANTS = {
  default: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
  },
  strong: {
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.borderStrong,
  },
  tint: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  danger: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.danger,
  },
};

export function SurfaceCard({ children, style, variant = 'default' }) {
  const palette = VARIANTS[variant] || VARIANTS.default;

  return (
    <View style={[styles.surface, palette, styles.topHighlight, SHADOWS.soft, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: SIZES.cardRadius,
    overflow: 'hidden',
  },
  topHighlight: {
    borderTopColor: COLORS.highlight,
  },
});
