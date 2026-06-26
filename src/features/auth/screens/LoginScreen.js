import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { showErrorAlert } from '../../../utils/errorUtils';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { AppIcon } from '../../../components/AppIcon';
import { PressableScale } from '../../../components/PressableScale';

export function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.logo}>
          <AppIcon name="zap" size={42} color={colors.white} />
        </View>
        <Text style={styles.title}>Blink</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.form}>
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

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: SIZES.xl,
      paddingTop: SIZES.xxl,
      paddingBottom: SIZES.xxl,
    },
    logo: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primaryDark,
      ...SHADOWS.medium,
    },
    title: { ...FONTS.h1, color: colors.text, textAlign: 'center', marginTop: SIZES.sm },
    subtitle: { ...FONTS.body, color: colors.textSecondary, textAlign: 'center', marginBottom: SIZES.xl },
    form: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: SIZES.borderRadiusLg,
      padding: SIZES.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      ...SHADOWS.soft,
    },
    linkBtn: { alignItems: 'center', marginTop: SIZES.md },
    linkText: { ...FONTS.caption, color: colors.primary },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: SIZES.xxl,
    },
    footerText: { ...FONTS.body, color: colors.textSecondary },
    footerLink: { ...FONTS.bodyBold, color: colors.primary },
  });
}
