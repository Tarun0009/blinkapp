import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';

function getVariants(colors) {
  return {
    default: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
    },
    strong: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.borderStrong,
    },
    tint: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    danger: {
      backgroundColor: colors.dangerLight,
      borderColor: colors.danger,
    },
  };
}

export function SurfaceCard({ children, style, variant = 'default' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const variants = useMemo(() => getVariants(colors), [colors]);
  const palette = variants[variant] || variants.default;

  return (
    <View style={[styles.surface, palette, styles.topHighlight, SHADOWS.soft, style]}>
      {children}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    surface: {
      position: 'relative',
      borderWidth: 1,
      borderRadius: SIZES.cardRadius,
      overflow: 'hidden',
    },
    topHighlight: {
      borderTopColor: colors.highlight,
    },
  });
}
