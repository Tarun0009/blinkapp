import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  ToastAndroid,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { UserAvatar } from '../../../components/UserAvatar';
import { TextField } from '../../../components/TextField';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { showErrorAlert } from '../../../utils/errorUtils';
import {
  USERNAME_REGEX,
  checkUsernameAvailability,
} from '../services/userService';

const AVAILABILITY_DEBOUNCE_MS = 400;
const USERNAME_FORMAT_HELP =
  'Lowercase letters, numbers, and underscores. 3–20 characters. Must start with a letter.';

export function EditProfileScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, userProfile, updateProfile } = useAuth();
  const [name, setName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [usernameStatus, setUsernameStatus] = useState({ state: 'idle', message: '' });
  const [saving, setSaving] = useState(false);
  const profileName = userProfile?.displayName || '';
  const profileUsername = userProfile?.username || '';
  const profileBio = userProfile?.bio || '';
  const availabilityRequestRef = useRef(0);

  useEffect(() => {
    setName(profileName);
  }, [profileName]);

  useEffect(() => {
    setUsername(profileUsername);
  }, [profileUsername]);

  useEffect(() => {
    setBio(profileBio);
  }, [profileBio]);

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();

    if (!trimmed || trimmed === profileUsername) {
      setUsernameStatus({ state: 'idle', message: '' });
      return undefined;
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameStatus({ state: 'invalid', message: USERNAME_FORMAT_HELP });
      return undefined;
    }

    setUsernameStatus({ state: 'checking', message: 'Checking availability…' });
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;

    const timeout = setTimeout(async () => {
      try {
        const payload = await checkUsernameAvailability(trimmed);
        if (availabilityRequestRef.current !== requestId) {
          return;
        }

        if (payload?.available) {
          setUsernameStatus({ state: 'available', message: `@${trimmed} is available` });
        } else if (payload?.reason === 'RESERVED') {
          setUsernameStatus({ state: 'taken', message: 'That username is reserved.' });
        } else if (payload?.reason === 'INVALID_FORMAT') {
          setUsernameStatus({ state: 'invalid', message: USERNAME_FORMAT_HELP });
        } else {
          setUsernameStatus({ state: 'taken', message: 'Username already taken.' });
        }
      } catch (error) {
        if (availabilityRequestRef.current !== requestId) {
          return;
        }
        setUsernameStatus({
          state: 'idle',
          message: 'Could not check availability. We will retry on save.',
        });
      }
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [profileUsername, username]);

  const hasDisplayNameChange = name.trim() && name.trim() !== profileName;
  const trimmedUsername = username.trim().toLowerCase();
  const hasUsernameChange = trimmedUsername !== profileUsername;
  const trimmedBio = bio.trim();
  const hasBioChange = trimmedBio !== profileBio;
  const bioTooLong = trimmedBio.length > 160;
  const usernameBlocked =
    hasUsernameChange &&
    (usernameStatus.state === 'taken' ||
      usernameStatus.state === 'invalid' ||
      usernameStatus.state === 'checking');
  const canSave =
    (hasDisplayNameChange || hasUsernameChange || hasBioChange) &&
    !usernameBlocked &&
    !bioTooLong;

  const usernameHelper = useMemo(() => {
    if (usernameStatus.message) return usernameStatus.message;
    if (!hasUsernameChange && profileUsername) return `Current handle: @${profileUsername}`;
    return USERNAME_FORMAT_HELP;
  }, [hasUsernameChange, profileUsername, usernameStatus.message]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (hasDisplayNameChange && !trimmedName) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (!hasDisplayNameChange && !hasUsernameChange && !hasBioChange) {
      navigation.goBack();
      return;
    }

    if (usernameBlocked) {
      Alert.alert('Username unavailable', usernameStatus.message || USERNAME_FORMAT_HELP);
      return;
    }

    if (bioTooLong) {
      Alert.alert('Bio too long', 'Bios are limited to 160 characters.');
      return;
    }

    const updates = {};
    if (hasDisplayNameChange) updates.displayName = trimmedName;
    if (hasUsernameChange) updates.username = trimmedUsername || undefined;
    if (hasBioChange) updates.bio = trimmedBio;

    setSaving(true);
    try {
      await updateProfile(updates);
      setSaving(false);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Profile updated!', ToastAndroid.SHORT);
      } else {
        Alert.alert('Success', 'Profile updated!');
      }
      navigation.goBack();
    } catch (error) {
      setSaving(false);
      if (error?.code === 'USERNAME_TAKEN' || error?.code === 'USERNAME_RESERVED') {
        setUsernameStatus({ state: 'taken', message: error.serverMessage || 'Username unavailable.' });
        return;
      }
      showErrorAlert(error, 'Failed to update profile. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <View pointerEvents="none" style={styles.topBand} />
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Cancel editing profile"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          activeScale={0.96}
          activeOpacity={0.74}
          rippleColor={PRESS_FEEDBACK.dangerRipple}
          style={styles.headerBtn}>
          <Text style={styles.cancel}>Cancel</Text>
        </PressableScale>
        <Text style={styles.title}>Edit Profile</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          accessibilityState={{ disabled: !canSave || saving, busy: saving }}
          onPress={handleSave}
          disabled={!canSave || saving}
          hitSlop={12}
          activeScale={0.96}
          activeOpacity={0.74}
          rippleColor={PRESS_FEEDBACK.softRipple}
          style={styles.headerBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.save, !canSave && styles.saveDisabled]}>Save</Text>
          )}
        </PressableScale>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.avatarSection}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Edit profile photo"
              activeScale={0.96}
              activeOpacity={0.88}
              rippleColor={PRESS_FEEDBACK.softRipple}
              borderless
              onPress={() => Alert.alert('Coming Soon', 'Profile photo uploads will be available in a future update.')}>
              <View pointerEvents="none" style={styles.avatarHalo} />
              <UserAvatar
                photoURL={userProfile?.photoURL}
                name={userProfile?.displayName}
                size={100}
              />
              <View style={styles.editBadge}>
                <AppIcon name="camera" size={16} color={colors.white} />
              </View>
            </PressableScale>
          </View>

          <SurfaceCard variant="strong" style={styles.form}>
            <TextField
              label="Display Name"
              icon="account-outline"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />

            <UsernameField
              colors={colors}
              styles={styles}
              value={username}
              onChangeText={setUsername}
              helperText={usernameHelper}
              status={usernameStatus.state}
            />

            <TextField
              label="Bio"
              icon="message-text-outline"
              value={bio}
              onChangeText={setBio}
              placeholder="A short line about yourself"
              autoCapitalize="sentences"
              autoCorrect
              multiline
              maxLength={160}
              helperText={`${trimmedBio.length}/160`}
              returnKeyType="done"
            />

            <TextField
              label="Email"
              icon="email-outline"
              value={user?.email}
              editable={false}
            />
          </SurfaceCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UsernameField({ colors, styles, helperText, onChangeText, status, value }) {
  const trailingIcon = (() => {
    if (status === 'checking') return <ActivityIndicator size="small" color={colors.textSecondary} />;
    if (status === 'available') return <AppIcon name="check" size={18} color={colors.success} />;
    if (status === 'taken' || status === 'invalid')
      return <AppIcon name="close" size={18} color={colors.danger} />;
    return null;
  })();

  return (
    <View>
      <TextField
        label="Username"
        icon="account-search-outline"
        value={value}
        onChangeText={(text) => onChangeText(text.toLowerCase())}
        placeholder="yourhandle"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="done"
        maxLength={20}
      />
      <View style={styles.usernameRow}>
        <Text
          style={[
            styles.usernameHelper,
            status === 'available' && styles.usernameHelperAvailable,
            (status === 'taken' || status === 'invalid') && styles.usernameHelperError,
          ]}>
          {helperText}
        </Text>
        {trailingIcon ? <View style={styles.usernameStatusIcon}>{trailingIcon}</View> : null}
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingTop: SIZES.sm,
      paddingBottom: SIZES.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
      backgroundColor: colors.backgroundSoft,
      ...SHADOWS.soft,
    },
    headerBtn: {
      paddingVertical: SIZES.sm,
      paddingHorizontal: SIZES.sm,
      minWidth: 60,
      alignItems: 'center',
    },
    cancel: { ...FONTS.body, color: colors.danger },
    title: { ...FONTS.h3, color: colors.text },
    save: { ...FONTS.bodyBold, color: colors.primary },
    saveDisabled: { color: colors.textLight },
    kav: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: SIZES.xl },
    avatarSection: { alignItems: 'center', paddingVertical: SIZES.lg },
    avatarHalo: {
      position: 'absolute',
      top: -10,
      left: -10,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primaryDark,
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.backgroundSoft,
      ...SHADOWS.small,
    },
    form: {
      marginHorizontal: SIZES.md,
      marginTop: SIZES.md,
      padding: SIZES.md,
      borderRadius: 18,
    },
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: -SIZES.sm,
      marginBottom: SIZES.sm + 4,
      marginLeft: 2,
    },
    usernameHelper: {
      ...FONTS.small,
      color: colors.textLight,
      flex: 1,
    },
    usernameHelperAvailable: { color: colors.success },
    usernameHelperError: { color: colors.danger },
    usernameStatusIcon: { marginLeft: SIZES.xs },
  });
}
