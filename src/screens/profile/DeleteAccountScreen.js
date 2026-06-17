import React, { useRef, useState } from 'react';
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
import { COLORS, FONTS, SHADOWS, SIZES } from '../../constants/theme';
import { AppIcon } from '../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../components/PressableScale';
import { SurfaceCard } from '../../components/SurfaceCard';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { showErrorAlert } from '../../utils/errorUtils';

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountScreen({ navigation }) {
  const { deleteAccount, userProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmationRef = useRef(null);

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />
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
          <AppIcon name="arrow-left" size={22} color={COLORS.primary} />
        </PressableScale>
        <Text style={styles.title}>Delete account</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <SurfaceCard variant="strong" style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <AppIcon name="alert-triangle" size={24} color={COLORS.danger} />
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
              blurOnSubmit={false}
              onSubmitEditing={() => confirmationRef.current?.focus()}
            />
            <TextField
              ref={confirmationRef}
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
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <AppIcon name="trash-2" size={16} color={COLORS.white} />
                <Text style={styles.deleteText}>Delete my account</Text>
              </>
            )}
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    height: 244,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSoft,
    ...SHADOWS.soft,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...FONTS.h3, color: COLORS.text, flex: 1, textAlign: 'center' },
  kav: { flex: 1 },
  scroll: { padding: SIZES.md, paddingBottom: SIZES.xxl },
  warningCard: {
    padding: SIZES.md,
    marginBottom: SIZES.md,
    alignItems: 'center',
    borderRadius: 18,
  },
  warningIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  warningTitle: { ...FONTS.bodyBold, color: COLORS.danger, textAlign: 'center' },
  warningBody: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
    lineHeight: 20,
  },
  card: { padding: SIZES.md, marginBottom: SIZES.md, borderRadius: 18 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.sm + 6,
    borderRadius: 18,
    backgroundColor: COLORS.danger,
    borderWidth: 1,
    borderColor: COLORS.danger,
    ...SHADOWS.soft,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteText: { ...FONTS.bodyBold, color: COLORS.white, marginLeft: SIZES.xs },
});
