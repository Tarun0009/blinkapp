import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { showErrorAlert } from '../../utils/errorUtils';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { AppIcon } from '../../components/AppIcon';
import { PressableScale } from '../../components/PressableScale';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9!@#$%^&*])(?=.{6,})/;

export function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleSignup = async () => {
    Keyboard.dismiss();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      showErrorAlert('Validation', 'Please fill in all fields');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      showErrorAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      showErrorAlert('Weak Password', 'Password must be at least 6 characters');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      showErrorAlert(
        'Weak Password',
        'Password must include one uppercase letter and one number or special character.',
      );
      return;
    }
    if (password !== confirmPassword) {
      showErrorAlert('Mismatch', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
    } catch (error) {
      showErrorAlert(error, 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View pointerEvents="none" style={styles.backgroundTop} />
      <View pointerEvents="none" style={styles.backgroundBand} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AppIcon name="account-plus" size={38} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your private chat space on Blink</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Your profile</Text>
            <View style={styles.securePill}>
              <AppIcon name="shield" size={13} color={COLORS.secondary} />
              <Text style={styles.securePillText}>Protected</Text>
            </View>
          </View>
          <TextField
            label="Full Name"
            icon="account-outline"
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            importantForAutofill="no"
            autoComplete="off"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <TextField
            ref={emailRef}
            label="Email"
            icon="email-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            importantForAutofill="no"
            autoComplete="off"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            icon="lock-outline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            importantForAutofill="no"
            autoComplete="off"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            helperText="Use 6+ characters, one uppercase letter, and one number or symbol."
          />
          <TextField
            ref={confirmPasswordRef}
            label="Confirm Password"
            icon="lock-check-outline"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            importantForAutofill="no"
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <Button label="Create Account" icon="account-plus" loading={loading} onPress={handleSignup} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <PressableScale
            accessibilityRole="button"
            activeScale={0.96}
            activeOpacity={0.76}
            borderless
            onPress={() => navigation.goBack()}>
            <Text style={styles.footerLink}>Log In</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backgroundTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backgroundBand: {
    position: 'absolute',
    top: 72,
    left: SIZES.lg,
    right: SIZES.lg,
    height: 94,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: SIZES.xl,
    paddingTop: SIZES.xxl,
    paddingBottom: SIZES.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  title: { ...FONTS.h1, color: COLORS.text, textAlign: 'center' },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
    maxWidth: 280,
  },
  form: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 24,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.md,
  },
  formTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  securePill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    borderRadius: 14,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  securePillText: {
    ...FONTS.tiny,
    color: COLORS.secondary,
    fontWeight: '800',
    marginLeft: SIZES.xs,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.xxl,
    marginBottom: SIZES.xl,
  },
  footerText: { ...FONTS.body, color: COLORS.textSecondary },
  footerLink: { ...FONTS.bodyBold, color: COLORS.primary },
});
