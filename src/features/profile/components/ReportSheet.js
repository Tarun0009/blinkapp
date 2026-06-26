import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { REPORT_REASONS } from '../services/blockService';

export function ReportSheet({ visible, targetName, onClose, onSubmit }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setReason(null);
    setDetails('');
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit?.(reason, details.trim());
      setReason(null);
      setDetails('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Report {targetName || 'user'}</Text>
              <Text style={styles.subtitle}>
                Reports help keep Blink safe. We review every report.
              </Text>
            </View>

            <View style={styles.reasons}>
              {REPORT_REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <PressableScale
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    activeScale={0.97}
                    activeOpacity={0.9}
                    rippleColor={PRESS_FEEDBACK.softRipple}
                    style={[styles.reason, selected && styles.reasonSelected]}
                    onPress={() => setReason(option.value)}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                      {option.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.textLight}
              style={styles.details}
              multiline
              maxLength={500}
              editable={!submitting}
              showSoftInputOnFocus
            />

            <View style={styles.footer}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Cancel report"
                onPress={close}
                disabled={submitting}
                activeScale={0.97}
                activeOpacity={0.86}
                rippleColor={PRESS_FEEDBACK.softRipple}
                style={[styles.btn, styles.cancelBtn]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Send report"
                accessibilityState={{ disabled: !reason || submitting, busy: submitting }}
                onPress={handleSubmit}
                disabled={!reason || submitting}
                activeScale={0.97}
                activeOpacity={0.84}
                rippleColor={PRESS_FEEDBACK.dangerRipple}
                style={[styles.btn, styles.submitBtn, (!reason || submitting) && styles.submitBtnDisabled]}>
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <AppIcon name="flag" size={16} color={colors.white} />
                    <Text style={styles.submitText}>Send report</Text>
                  </>
                )}
              </PressableScale>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    kav: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingTop: SIZES.sm,
      paddingHorizontal: SIZES.md,
      paddingBottom: SIZES.xl,
      ...SHADOWS.medium,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: SIZES.md,
    },
    header: { marginBottom: SIZES.md },
    title: { ...FONTS.h3, color: colors.text },
    subtitle: { ...FONTS.small, color: colors.textSecondary, marginTop: 4 },
    reasons: { marginBottom: SIZES.sm },
    reason: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SIZES.sm,
      paddingHorizontal: SIZES.sm + 2,
      borderRadius: SIZES.borderRadius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      marginBottom: SIZES.xs,
    },
    reasonSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: SIZES.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    reasonLabel: { ...FONTS.body, color: colors.text },
    reasonLabelSelected: { color: colors.primary, fontWeight: '600' },
    details: {
      ...FONTS.body,
      minHeight: 80,
      backgroundColor: colors.surfaceAlt,
      borderRadius: SIZES.borderRadius,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      color: colors.text,
      textAlignVertical: 'top',
      marginBottom: SIZES.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    footer: { flexDirection: 'row', justifyContent: 'space-between' },
    btn: {
      flex: 1,
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: SIZES.borderRadius,
    },
    cancelBtn: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SIZES.sm,
    },
    cancelText: { ...FONTS.bodyBold, color: colors.textSecondary },
    submitBtn: { backgroundColor: colors.danger },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { ...FONTS.bodyBold, color: colors.white, marginLeft: SIZES.xs },
  });
}
