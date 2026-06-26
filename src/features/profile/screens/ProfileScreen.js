import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { SIZES, FONTS } from '../../../constants/theme';
import { useTheme, THEME_OPTIONS } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { UserAvatar } from '../../../components/UserAvatar';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { showErrorAlert } from '../../../utils/errorUtils';

const THEME_LABELS = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const THEME_ICONS = {
  system: 'smartphone',
  light: 'sun',
  dark: 'moon',
};

export function ProfileScreen({ navigation }) {
  const { user, userProfile, logout } = useAuth();
  const { colors, scheme, preference, setThemePreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            showErrorAlert(error, 'Failed to log out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader title="Profile" subtitle="Account and preferences" />

        <SurfaceCard variant="strong" style={styles.card}>
          <UserAvatar
            photoURL={userProfile?.photoURL}
            name={userProfile?.displayName}
            size={SIZES.avatarLg}
            online={userProfile?.online}
          />
          <Text style={styles.name}>{userProfile?.displayName || 'User'}</Text>
          {userProfile?.username ? (
            <Text style={styles.username}>{`@${userProfile.username}`}</Text>
          ) : null}
          <Text style={styles.email}>{user?.email}</Text>
        </SurfaceCard>

        <SurfaceCard variant="strong" style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const active = preference === option;
              return (
                <PressableScale
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeScale={0.96}
                  activeOpacity={0.85}
                  rippleColor={PRESS_FEEDBACK.softRipple}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                  onPress={() => setThemePreference(option)}>
                  <AppIcon
                    name={THEME_ICONS[option]}
                    size={16}
                    color={active ? colors.white : colors.textSecondary}
                  />
                  <Text
                    style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}
                    numberOfLines={1}>
                    {THEME_LABELS[option]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </SurfaceCard>

        <SurfaceCard variant="strong" style={styles.menu}>
          <MenuItem
            colors={colors}
            styles={styles}
            icon="account-edit-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <MenuItem
            colors={colors}
            styles={styles}
            icon="lock"
            label="Change password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <MenuItem
            colors={colors}
            styles={styles}
            icon="bell"
            label="Notifications"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <MenuItem
            colors={colors}
            styles={styles}
            icon="shield"
            label="Blocked users"
            onPress={() => navigation.navigate('BlockedUsers')}
          />
        </SurfaceCard>

        <PressableScale
          accessibilityRole="button"
          activeScale={0.98}
          activeOpacity={0.88}
          rippleColor={PRESS_FEEDBACK.dangerRipple}
          style={styles.logoutBtn}
          onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          activeScale={0.98}
          activeOpacity={0.88}
          rippleColor={PRESS_FEEDBACK.dangerRipple}
          style={styles.dangerBtn}
          onPress={() => navigation.navigate('DeleteAccount')}>
          <Text style={styles.dangerText}>Delete account</Text>
        </PressableScale>

        <Text style={styles.version}>Blink v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ colors, styles, icon, label, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      activeScale={0.99}
      activeOpacity={0.9}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={styles.menuItem}
      onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <AppIcon name={icon} size={21} color={colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <AppIcon name="chevron-right" size={21} color={colors.textLight} />
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    scrollContent: {
      paddingBottom: SIZES.xl,
    },
    card: {
      alignItems: 'center',
      paddingVertical: SIZES.lg,
      marginHorizontal: SIZES.md,
    },
    name: { ...FONTS.h2, color: colors.text, marginTop: SIZES.sm },
    username: { ...FONTS.caption, color: colors.primary, fontWeight: '600', marginTop: SIZES.xs },
    email: { ...FONTS.caption, color: colors.textSecondary, marginTop: SIZES.xs },
    section: {
      marginTop: SIZES.md,
      marginHorizontal: SIZES.md,
      padding: SIZES.md,
    },
    sectionTitle: {
      ...FONTS.small,
      color: colors.textLight,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: SIZES.sm,
    },
    themeRow: {
      flexDirection: 'row',
    },
    themeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SIZES.sm + 2,
      paddingHorizontal: SIZES.sm,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      marginRight: SIZES.xs + 2,
    },
    themeChipActive: {
      backgroundColor: colors.primary,
    },
    themeChipLabel: {
      ...FONTS.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      marginLeft: 6,
    },
    themeChipLabelActive: {
      color: colors.white,
      fontWeight: '700',
    },
    menu: {
      marginTop: SIZES.md,
      marginHorizontal: SIZES.md,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SIZES.sm + 6,
      paddingHorizontal: SIZES.md,
    },
    menuIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      marginRight: SIZES.sm + 4,
    },
    menuLabel: { ...FONTS.body, color: colors.text, flex: 1 },
    logoutBtn: {
      marginHorizontal: SIZES.md,
      marginTop: SIZES.xl,
      paddingVertical: SIZES.sm + 6,
      borderRadius: SIZES.borderRadius,
      borderWidth: 1,
      borderColor: colors.danger,
      alignItems: 'center',
    },
    logoutText: { ...FONTS.bodyBold, color: colors.danger },
    dangerBtn: {
      marginHorizontal: SIZES.md,
      marginTop: SIZES.sm + 2,
      paddingVertical: SIZES.sm + 2,
      alignItems: 'center',
    },
    dangerText: {
      ...FONTS.small,
      color: colors.textLight,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    version: {
      ...FONTS.small,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: SIZES.xl,
    },
  });
}
