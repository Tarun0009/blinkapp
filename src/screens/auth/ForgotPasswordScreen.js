import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
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

export function ForgotPasswordScreen({ navigation }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    Keyboard.dismiss();
    if (!email.trim()) {
      showErrorAlert('Validation', 'Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert('Email Sent', 'Check your inbox for password reset instructions.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      showErrorAlert(error, 'Unable to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View pointerEvents="none" style={styles.backgroundTop} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeScale={0.96}
          activeOpacity={0.78}
          borderless
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <AppIcon name="arrow-left" size={22} color={COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>
        <View style={styles.card}>
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
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />
          <Button label="Send Reset Link" icon="email-fast-outline" loading={loading} onPress={handleReset} />
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
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.xl,
    paddingTop: 80,
    paddingBottom: SIZES.xl,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.lg },
  backText: { ...FONTS.body, color: COLORS.primary },
  title: { ...FONTS.h1, color: COLORS.text, marginBottom: SIZES.sm },
  subtitle: { ...FONTS.body, color: COLORS.textSecondary, marginBottom: SIZES.xl },
  card: {
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 24,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
});
