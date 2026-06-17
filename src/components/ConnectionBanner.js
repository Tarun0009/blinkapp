import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNetworkStatus } from '../shared/network/NetworkProvider';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { SOCKET_STATUS } from '../realtime/socketEvents';
import { AppIcon } from './AppIcon';

function getBannerState({ backendStatus, hasUser, isBackendUnavailable, isOffline, realtimeStatus }) {
  if (isOffline) {
    return {
      icon: 'wifi-off',
      text: 'No internet connection',
      color: COLORS.danger,
      backgroundColor: COLORS.dangerLight,
    };
  }

  if (isBackendUnavailable) {
    return {
      icon: 'server',
      text: 'Service unavailable',
      color: COLORS.warning,
      backgroundColor: COLORS.warningLight,
    };
  }

  if (!hasUser) {
    return null;
  }

  if (realtimeStatus === SOCKET_STATUS.CONNECTING) {
    return {
      icon: 'wifi',
      text: 'Connecting realtime...',
      color: COLORS.primary,
      backgroundColor: COLORS.primaryLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.RECONNECTING) {
    return {
      icon: 'refresh-cw',
      text: 'Reconnecting...',
      color: COLORS.warning,
      backgroundColor: COLORS.warningLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.ERROR) {
    return {
      icon: 'wifi-off',
      text:
        backendStatus === 'reachable'
          ? 'Realtime connection issue'
          : 'Checking service connection',
      color: COLORS.danger,
      backgroundColor: COLORS.dangerLight,
    };
  }

  if (realtimeStatus === SOCKET_STATUS.CLOSED) {
    return {
      icon: 'wifi-off',
      text: 'Realtime disconnected',
      color: COLORS.textSecondary,
      backgroundColor: COLORS.surfaceAlt,
    };
  }

  return null;
}

export function ConnectionBanner() {
  const { user } = useAuth();
  const { status, isAppActive } = useRealtime();
  const { backendStatus, isBackendUnavailable, isOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const banner = getBannerState({
    backendStatus,
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

const styles = StyleSheet.create({
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
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  text: {
    ...FONTS.small,
    fontWeight: '700',
    marginLeft: SIZES.xs,
  },
});
