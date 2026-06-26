import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FONTS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';

function getStatusLabel(status) {
  if (status === 'pending') return 'Pending';
  if (status === 'accepted') return 'Connected';
  return 'Rejected';
}

export function UserConnectionAction({
  connectionState,
  displayName,
  isAccepting,
  isRejecting,
  isRequesting,
  onAccept,
  onConnect,
  onReject,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (connectionState.type === 'incoming') {
    return (
      <View style={styles.incomingActions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Reject request from ${displayName}`}
          accessibilityState={{ disabled: isRejecting, busy: isRejecting }}
          style={[styles.requestActionBtn, styles.rejectBtn]}
          activeScale={0.9}
          activeOpacity={0.78}
          rippleColor={PRESS_FEEDBACK.softRipple}
          borderless
          onPress={onReject}
          disabled={isRejecting}>
          {isRejecting ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <AppIcon name="close" size={18} color={colors.textSecondary} />
          )}
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Accept request from ${displayName}`}
          accessibilityState={{ disabled: isAccepting, busy: isAccepting }}
          style={[styles.requestActionBtn, styles.acceptBtn]}
          activeScale={0.9}
          activeOpacity={0.9}
          rippleColor={PRESS_FEEDBACK.lightRipple}
          borderless
          onPress={onAccept}
          disabled={isAccepting}>
          {isAccepting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <AppIcon name="check" size={18} color={colors.white} />
          )}
        </PressableScale>
      </View>
    );
  }

  if (connectionState.type === 'outgoing' || connectionState.type === 'connected') {
    return (
      <View
        style={[
          styles.statusBadge,
          connectionState.status === 'accepted' && styles.statusAccepted,
        ]}>
        <Text
          style={[
            styles.statusText,
            connectionState.status === 'accepted' && styles.statusTextAccepted,
          ]}>
          {getStatusLabel(connectionState.status)}
        </Text>
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Connect with ${displayName}`}
      accessibilityState={{ disabled: isRequesting, busy: isRequesting }}
      style={styles.connectBtn}
      activeScale={0.94}
      activeOpacity={0.9}
      rippleColor={PRESS_FEEDBACK.lightRipple}
      onPress={onConnect}
      disabled={isRequesting}>
      {isRequesting ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <>
          <AppIcon
            name="account-plus"
            size={16}
            color={colors.white}
            style={styles.connectIcon}
          />
          <Text style={styles.connectBtnText}>Connect</Text>
        </>
      )}
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    incomingActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    requestActionBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      marginLeft: SIZES.xs,
    },
    connectBtn: {
      backgroundColor: colors.primaryDark,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm + 4,
      paddingVertical: SIZES.xs + 2,
      borderRadius: SIZES.borderRadius,
    },
    acceptBtn: {
      backgroundColor: colors.primaryDark,
    },
    rejectBtn: { backgroundColor: colors.surfaceAlt },
    connectIcon: { marginRight: SIZES.xs },
    connectBtnText: { ...FONTS.small, color: colors.white, fontWeight: 'bold' },
    statusBadge: {
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.xs,
      borderRadius: SIZES.borderRadius,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusAccepted: { backgroundColor: colors.primaryLight },
    statusText: { ...FONTS.small, color: colors.textSecondary, fontWeight: '600' },
    statusTextAccepted: { color: colors.primary },
  });
}
