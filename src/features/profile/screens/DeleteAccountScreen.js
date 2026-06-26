import React, { useMemo, useState } from 'react';
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

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { deleteAccount, userProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete =
    password.length > 0 && confirmation.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleDelete = () => {
    if (!canDelete || deleting) return;
    Alert.alert(
      'Delete account?',
      'This permanently removes your account, profile, messages, and friend connections. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(password);
              // Auth state listener will kick the user back to the login screen.
            } catch (error) {
              setDeleting(false);
              if (
                error?.code === 'auth/wrong-password' ||
                error?.code === 'auth/invalid-credential'
              ) {
                Alert.alert('Wrong password', 'Your password is incorrect.');
                return;
              }
              if (error?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication required',
                  'Please sign out and sign back in, then try again.',
                );
                return;
              }
              showErrorAlert(error, 'Could not delete your account.');
            }
          },
        },
      ],
    );
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
        <Text style={styles.title}>Delete account</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <SurfaceCard variant="strong" style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <AppIcon name="alert-triangle" size={24} color={colors.danger} />
            </View>
            <Text style={styles.warningTitle}>This action is permanent</Text>
            <Text style={styles.warningBody}>
              {`Deleting ${userProfile?.displayName || 'your account'} will remove your profile, all messages you've sent, your connections, and any group memberships. Other people may still see your past messages in their copies of conversations.`}
            </Text>
          </SurfaceCard>

          <SurfaceCard variant="strong" style={styles.card}>
            <TextField
              label="Confirm with your password"
              icon="lock-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="next"
            />
            <TextField
              label={`Type ${CONFIRM_PHRASE} to confirm`}
              icon="alert-triangle"
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={CONFIRM_PHRASE}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleDelete}
            />
          </SurfaceCard>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: !canDelete || deleting, busy: deleting }}
            activeScale={0.97}
            activeOpacity={0.86}
            rippleColor={PRESS_FEEDBACK.dangerRipple}
            style={[styles.deleteBtn, (!canDelete || deleting) && styles.deleteBtnDisabled]}
            disabled={!canDelete || deleting}
            onPress={handleDelete}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <AppIcon name="trash-2" size={16} color={colors.white} />
                <Text style={styles.deleteText}>Delete my account</Text>
              </>
            )}
          </PressableScale>
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
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { ...FONTS.h3, color: colors.text, flex: 1, textAlign: 'center' },
    kav: { flex: 1 },
    scroll: { padding: SIZES.md, paddingBottom: SIZES.xxl },
    warningCard: {
      padding: SIZES.md,
      marginBottom: SIZES.md,
      alignItems: 'center',
    },
    warningIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerLight,
      marginBottom: SIZES.sm,
    },
    warningTitle: { ...FONTS.bodyBold, color: colors.danger, textAlign: 'center' },
    warningBody: {
      ...FONTS.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SIZES.xs,
      lineHeight: 20,
    },
    card: { padding: SIZES.md, marginBottom: SIZES.md },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SIZES.sm + 6,
      borderRadius: SIZES.borderRadius,
      backgroundColor: colors.danger,
      ...SHADOWS.small,
    },
    deleteBtnDisabled: { opacity: 0.5 },
    deleteText: { ...FONTS.bodyBold, color: colors.white, marginLeft: SIZES.xs },
  });
}
