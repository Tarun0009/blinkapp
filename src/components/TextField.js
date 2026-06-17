import React, { useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { AppIcon } from './AppIcon';
import { PressableScale } from './PressableScale';

export const TextField = forwardRef(function TextField(
  {
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    helperText,
    editable = true,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const inputRef = useRef(null);
  const secure = secureTextEntry && !isSecureVisible;

  useImperativeHandle(ref, () => inputRef.current);

  const toggleSecureVisibility = () => {
    setIsSecureVisible((current) => !current);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const focusInput = () => {
    if (editable) {
      inputRef.current?.focus();
    }
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessible={false}
        onPressIn={focusInput}
        style={[
          styles.inputWrap,
          isFocused && styles.inputFocused,
          !editable && styles.inputDisabled,
        ]}>
        {icon ? (
          <AppIcon
            name={icon}
            size={ICON_SIZES.md}
            color={isFocused ? COLORS.primary : COLORS.textLight}
            style={styles.leadingIcon}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry={secure}
          editable={editable}
          showSoftInputOnFocus
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {secureTextEntry ? (
          <PressableScale
            onPress={toggleSecureVisibility}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityLabel={isSecureVisible ? 'Hide password' : 'Show password'}
            accessibilityState={{ disabled: !editable, checked: isSecureVisible }}
            hitSlop={10}
            activeScale={0.88}
            activeOpacity={0.74}
            borderless
            style={styles.trailingButton}>
            <AppIcon
              name={isSecureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={ICON_SIZES.md}
              color={isFocused ? COLORS.primary : COLORS.textSecondary}
            />
          </PressableScale>
        ) : null}
      </Pressable>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SIZES.sm + 4,
  },
  label: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: SIZES.xs,
    marginLeft: 2,
  },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    paddingHorizontal: SIZES.md,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundRaised,
    ...SHADOWS.glow,
  },
  inputDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
  leadingIcon: {
    marginRight: SIZES.sm,
  },
  input: {
    flex: 1,
    ...FONTS.body,
    color: COLORS.text,
    paddingVertical: SIZES.sm,
    paddingHorizontal: 0,
  },
  trailingButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -SIZES.xs,
    marginLeft: SIZES.xs,
  },
  helper: {
    ...FONTS.small,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
    marginLeft: 2,
  },
});
