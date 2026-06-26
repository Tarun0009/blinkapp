import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { showErrorAlert } from '../../../utils/errorUtils';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9!@#$%^&*])(?=.{6,})/;

export function ChangePasswordScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const newPasswordRef = useRef(null);
  const confirmRef = useRef(null);

  const canSave =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    PASSWORD_REGEX.test(newPassword) &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const handleSave = async () => {
    if (!canSave || saving) return;

    if (!PASSWORD_REGEX.test(newPassword)) {
      Alert.alert(
        'Weak password',
        'Password must include one uppercase letter and one number or special character.',
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      setSaving(false);
      if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        Alert.alert('Wrong password', 'Your current password is incorrect.');
        return;
      }
      if (error?.code === 'auth/weak-password') {
        Alert.alert('Weak password', 'Please choose a stronger password.');
        return;
      }
      if (error?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Re-authentication required',
          'Please sign out and sign back in, then try again.',
        );
        return;
      }
      showErrorAlert(error, 'Could not change your password.');
    }
  };

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
        <Text style={styles.title}>Change password</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Save new password"
          accessibilityState={{ disabled: !canSave || saving, busy: saving }}
          onPress={handleSave}
          disabled={!canSave || saving}
          hitSlop={12}
          activeScale={0.94}
          borderless
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
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <SurfaceCard variant="strong" style={styles.card}>
            <TextField
              label="Current password"
              icon="lock-outline"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Your current password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
            <TextField
              ref={newPasswordRef}
              label="New password"
              icon="lock-check-outline"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmRef.current?.focus()}
              helperText="6+ characters, one uppercase letter, one number or symbol."
            />
            <TextField
              ref={confirmRef}
              label="Confirm new password"
              icon="lock-check-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter the new password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </SurfaceCard>

          <Text style={styles.footer}>
            We'll re-verify your current password before changing it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    headerBtn: {
      paddingVertical: SIZES.sm,
      paddingHorizontal: SIZES.sm,
      minWidth: 64,
      alignItems: 'center',
    },
    title: { ...FONTS.h3, color: colors.text, flex: 1, textAlign: 'center' },
    save: { ...FONTS.bodyBold, color: colors.primary },
    saveDisabled: { color: colors.textLight },
    kav: { flex: 1 },
    scroll: { padding: SIZES.md, paddingBottom: SIZES.xxl },
    card: { padding: SIZES.md },
    footer: {
      ...FONTS.small,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: SIZES.md,
    },
  });
}
