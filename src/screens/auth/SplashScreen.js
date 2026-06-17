import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../constants/theme';
import { AppIcon } from '../../components/AppIcon';

export function SplashScreen() {
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
          <AppIcon name="zap" size={48} color={COLORS.white} />
        </View>
        <Text style={styles.title}>Blink</Text>
        <Text style={styles.subtitle}>Private realtime conversations</Text>
      </Animated.View>

      <View style={styles.loaderBlock}>
        <View style={styles.loaderPill}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  accentBand: {
    position: 'absolute',
    top: 120,
    left: SIZES.lg,
    right: SIZES.lg,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
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
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.white,
    marginTop: SIZES.md,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  loaderText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginLeft: SIZES.sm,
  },
});
