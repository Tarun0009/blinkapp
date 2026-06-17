import React from 'react';
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
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../../components/UserAvatar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { AppIcon } from '../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../components/PressableScale';
import { SurfaceCard } from '../../components/SurfaceCard';
import { showErrorAlert } from '../../utils/errorUtils';

export function ProfileScreen({ navigation }) {
  const { user, userProfile, logout } = useAuth();

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader title="Profile" subtitle="Account and preferences" />

        <SurfaceCard variant="strong" style={styles.card}>
          <View style={styles.profileGlow} />
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
          <View style={styles.profileMetaRow}>
            <View style={styles.profileMetaPill}>
              <AppIcon name="shield" size={13} color={COLORS.secondary} />
              <Text style={styles.profileMetaText}>Protected</Text>
            </View>
            <View style={styles.profileMetaPill}>
              <AppIcon name="zap" size={13} color={COLORS.primary} />
              <Text style={styles.profileMetaText}>Realtime</Text>
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard variant="strong" style={styles.menu}>
          <MenuItem
            icon="account-edit-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <MenuItem
            icon="lock"
            label="Change password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <MenuItem
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

function MenuItem({ icon, label, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      activeScale={0.99}
      activeOpacity={0.9}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={styles.menuItem}
      onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <AppIcon name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <AppIcon name="chevron-right" size={21} color={COLORS.textLight} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scrollContent: {
    paddingBottom: SIZES.xxl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: SIZES.lg,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
  },
  profileGlow: {
    position: 'absolute',
    top: SIZES.md,
    width: 140,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
  },
  name: { ...FONTS.h2, color: COLORS.text, marginTop: SIZES.sm },
  username: { ...FONTS.caption, color: COLORS.primary, fontWeight: '600', marginTop: SIZES.xs },
  email: { ...FONTS.caption, color: COLORS.textSecondary, marginTop: SIZES.xs },
  profileMetaRow: {
    flexDirection: 'row',
    marginTop: SIZES.md,
  },
  profileMetaPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm + 2,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: SIZES.xs,
  },
  profileMetaText: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    fontWeight: '800',
    marginLeft: SIZES.xs,
    textTransform: 'uppercase',
  },
  menu: {
    marginTop: SIZES.lg,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SIZES.sm + 4,
  },
  menuLabel: { ...FONTS.body, color: COLORS.text, flex: 1 },
  logoutBtn: {
    marginHorizontal: SIZES.md,
    marginTop: SIZES.xl,
    paddingVertical: SIZES.sm + 6,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
  },
  logoutText: { ...FONTS.bodyBold, color: COLORS.danger },
  dangerBtn: {
    marginHorizontal: SIZES.md,
    marginTop: SIZES.sm + 2,
    paddingVertical: SIZES.sm + 2,
    alignItems: 'center',
  },
  dangerText: { ...FONTS.small, color: COLORS.textLight, fontWeight: '600', textDecorationLine: 'underline' },
  version: {
    ...FONTS.small,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.xl,
  },
});
