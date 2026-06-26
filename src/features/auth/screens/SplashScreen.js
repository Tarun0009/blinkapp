import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';

export function SplashScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.topBand} />
      <View pointerEvents="none" style={styles.accentBand} />
      <Animated.View
        style={[
          styles.brand,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}>
        <View style={styles.logo}>
          <AppIcon name="zap" size={48} color={colors.white} />
        </View>
        <Text style={styles.title}>Blink</Text>
        <Text style={styles.subtitle}>Private realtime conversations</Text>
      </Animated.View>

      <View style={styles.loaderBlock}>
        <View style={styles.loaderPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loaderText}>Loading...</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      backgroundColor: colors.backgroundSoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    accentBand: {
      position: 'absolute',
      top: 120,
      left: SIZES.lg,
      right: SIZES.lg,
      height: 90,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    brand: {
      alignItems: 'center',
    },
    logo: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDark,
      borderWidth: 1,
      borderColor: colors.primary,
      ...SHADOWS.glow,
    },
    title: {
      ...FONTS.h1,
      color: colors.white,
      marginTop: SIZES.md,
    },
    subtitle: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: SIZES.xs,
    },
    loaderBlock: {
      position: 'absolute',
      bottom: SIZES.xxl + SIZES.md,
      alignItems: 'center',
    },
    loaderPill: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      borderRadius: 19,
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    loaderText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginLeft: SIZES.sm,
    },
  });
}
