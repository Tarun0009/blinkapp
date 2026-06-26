import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { showErrorAlert } from '../../../utils/errorUtils';
import {
  fetchNotificationPreferences,
  hasNotificationPermission,
  requestNotificationPermission,
  updateNotificationPreferences,
} from '../services/notificationService';

const CATEGORIES = [
  {
    key: 'messagesEnabled',
    label: 'Messages',
    description: 'New direct and group chat messages.',
    icon: 'message-circle',
  },
  {
    key: 'friendRequestsEnabled',
    label: 'Friend requests',
    description: 'When someone wants to connect with you.',
    icon: 'user-plus',
  },
  {
    key: 'groupInvitesEnabled',
    label: 'Group invites',
    description: 'When you are added to a new group chat.',
    icon: 'users',
  },
];

export function NotificationSettingsScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(null);

  const loadPermission = useCallback(async () => {
    try {
      const granted = await hasNotificationPermission();
      setPermissionGranted(granted);
    } catch {
      setPermissionGranted(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const prefs = await fetchNotificationPreferences();
        if (active) {
          setPreferences(
            prefs || {
              messagesEnabled: true,
              friendRequestsEnabled: true,
              groupInvitesEnabled: true,
            },
          );
        }
      } catch (error) {
        if (active) {
          showErrorAlert(error, 'Could not load notification settings.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    loadPermission();
    return () => {
      active = false;
    };
  }, [loadPermission]);

  const handleEnablePermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
  }, []);

  const handleToggle = useCallback(
    async (key, nextValue) => {
      if (!preferences) return;
      const previous = preferences;
      setPreferences({ ...preferences, [key]: nextValue });
      setSavingKey(key);
      try {
        const updated = await updateNotificationPreferences({ [key]: nextValue });
        if (updated) setPreferences(updated);
      } catch (error) {
        setPreferences(previous);
        showErrorAlert(error, 'Could not update notification preference.');
      } finally {
        setSavingKey(null);
      }
    },
    [preferences],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          activeScale={0.9}
          borderless
          rippleColor={PRESS_FEEDBACK.softRipple}
          style={styles.headerBtn}>
          <AppIcon name="arrow-left" size={22} color={colors.primary} />
        </PressableScale>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {permissionGranted === false ? (
            <SurfaceCard variant="strong" style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <AppIcon name="bell-off" size={20} color={colors.warning} />
              </View>
              <View style={styles.permissionBody}>
                <Text style={styles.permissionTitle}>System notifications are off</Text>
                <Text style={styles.permissionText}>
                  Even with these toggles on, your device won't show alerts until you grant
                  notification access.
                </Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Enable system notifications"
                activeScale={0.96}
                activeOpacity={0.86}
                rippleColor={PRESS_FEEDBACK.softRipple}
                style={styles.permissionBtn}
                onPress={handleEnablePermission}>
                <Text style={styles.permissionBtnText}>Enable</Text>
              </PressableScale>
            </SurfaceCard>
          ) : null}

          <SurfaceCard variant="strong" style={styles.menu}>
            {CATEGORIES.map((category, index) => {
              const value = !!preferences?.[category.key];
              const isLast = index === CATEGORIES.length - 1;
              return (
                <View
                  key={category.key}
                  style={[styles.row, !isLast && styles.rowDivider]}>
                  <View style={styles.iconWrap}>
                    <AppIcon name={category.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{category.label}</Text>
                    <Text style={styles.rowDescription}>{category.description}</Text>
                  </View>
                  {savingKey === category.key ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Switch
                      value={value}
                      onValueChange={(next) => handleToggle(category.key, next)}
                      trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  )}
                </View>
              );
            })}
          </SurfaceCard>

          <Text style={styles.footer}>
            Muted chats never push, even when "Messages" is on. Disabling a category here turns
            off pushes from this account on every device you've signed in on.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      ...SHADOWS.small,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { ...FONTS.h3, color: colors.text, flex: 1, textAlign: 'center' },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: SIZES.md, paddingBottom: SIZES.xxl },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SIZES.md,
      marginBottom: SIZES.md,
    },
    permissionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warningLight,
      marginRight: SIZES.sm + 4,
    },
    permissionBody: { flex: 1, minWidth: 0 },
    permissionTitle: { ...FONTS.bodyBold, color: colors.text },
    permissionText: { ...FONTS.small, color: colors.textSecondary, marginTop: 2 },
    permissionBtn: {
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      borderRadius: SIZES.borderRadius,
      backgroundColor: colors.primary,
      marginLeft: SIZES.sm,
    },
    permissionBtnText: { ...FONTS.small, color: colors.white, fontWeight: '700' },
    menu: {
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SIZES.sm + 6,
      paddingHorizontal: SIZES.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      marginRight: SIZES.sm + 4,
    },
    rowBody: { flex: 1, minWidth: 0, marginRight: SIZES.sm },
    rowLabel: { ...FONTS.body, color: colors.text, fontWeight: '600' },
    rowDescription: { ...FONTS.small, color: colors.textSecondary, marginTop: 2 },
    footer: {
      ...FONTS.small,
      color: colors.textLight,
      marginTop: SIZES.md,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
