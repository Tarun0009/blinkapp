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

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password) {
      showErrorAlert('Validation', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      showErrorAlert(error, 'Login failed. Please check your email and password.');
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AppIcon name="zap" size={42} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Blink</Text>
          <Text style={styles.subtitle}>Private realtime chat for your trusted circle</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <View style={styles.securePill}>
              <AppIcon name="lock" size={13} color={COLORS.secondary} />
              <Text style={styles.securePillText}>Secure</Text>
            </View>
          </View>
          <TextField
            label="Email"
            icon="email-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
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
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button label="Log In" icon="login" loading={loading} onPress={handleLogin} />

          <PressableScale
            accessibilityRole="button"
            activeScale={0.96}
            activeOpacity={0.76}
            borderless
            style={styles.linkBtn}
            onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </PressableScale>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{"Don't have an account? "}</Text>
          <PressableScale
            accessibilityRole="button"
            activeScale={0.96}
            activeOpacity={0.76}
            borderless
            onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.footerLink}>Sign Up</Text>
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
    top: 74,
    left: SIZES.lg,
    right: SIZES.lg,
    height: 92,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.xl,
    paddingTop: SIZES.xxl + SIZES.lg,
    paddingBottom: SIZES.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  title: { ...FONTS.h1, color: COLORS.text, textAlign: 'center', marginTop: SIZES.sm },
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
  linkBtn: { alignItems: 'center', marginTop: SIZES.md },
  linkText: { ...FONTS.caption, color: COLORS.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.xxl,
  },
  footerText: { ...FONTS.body, color: COLORS.textSecondary },
  footerLink: { ...FONTS.bodyBold, color: COLORS.primary },
});
