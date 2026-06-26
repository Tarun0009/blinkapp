import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNetworkStatus } from '../shared/network/NetworkProvider';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { SOCKET_STATUS } from '../realtime/socketEvents';
import { AppIcon } from './AppIcon';

function getBannerState({ backendStatus, colors, hasUser, isBackendUnavailable, isOffline, realtimeStatus }) {
  if (isOffline) {
    return {
      icon: 'wifi-off',
      text: 'No internet connection',
      color: colors.danger,
      backgroundColor: colors.dangerLight,
    };
  }

  if (isBackendUnavailable) {
    return {
      icon: 'server',
      text: 'Service unavailable',
      color: colors.warning,
      backgroundColor: colors.warningLight,
    };
  }

  if (!hasUser) {
    return null;
  }

  if (realtimeStatus === SOCKET_STATUS.CONNECTING) {
    return {
      icon: 'wifi',
      text: 'Connecting realtime...',
      color: colors.primary,
      backgroundColor: colors.primaryLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.RECONNECTING) {
    return {
      icon: 'refresh-cw',
      text: 'Reconnecting...',
      color: colors.warning,
      backgroundColor: colors.warningLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.ERROR) {
    return {
      icon: 'wifi-off',
      text:
        backendStatus === 'reachable'
          ? 'Realtime connection issue'
          : 'Checking service connection',
      color: colors.danger,
      backgroundColor: colors.dangerLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.CLOSED) {
    return {
      icon: 'wifi-off',
      text: 'Realtime disconnected',
      color: colors.textSecondary,
      backgroundColor: colors.surfaceAlt,
    };
  }

  return null;
}

export function ConnectionBanner() {
  const { user } = useAuth();
  const { status, isAppActive } = useRealtime();
  const { backendStatus, isBackendUnavailable, isOffline } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const banner = getBannerState({
    backendStatus,
    colors,
    hasUser: Boolean(user),
    isBackendUnavailable,
    isOffline,
    realtimeStatus: status,
  });

  if (!isAppActive || !banner) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + SIZES.sm }]}>
      <View style={[styles.banner, { backgroundColor: banner.backgroundColor }]}>
        <AppIcon name={banner.icon} size={14} color={banner.color} />
        <Text style={[styles.text, { color: banner.color }]}>{banner.text}</Text>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: SIZES.md,
      right: SIZES.md,
      zIndex: 50,
      alignItems: 'center',
    },
    banner: {
      minHeight: 32,
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    text: {
      ...FONTS.small,
      fontWeight: '700',
      marginLeft: SIZES.xs,
    },
  });
}
