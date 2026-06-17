import React, { useRef } from 'react';
import { Pressable, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS, ICON_SIZES, SHADOWS } from '../constants/theme';
import { AppIcon } from './AppIcon';
import { PressableScale } from './PressableScale';

export function SearchBar({ value, onChangeText, placeholder = 'Search...', onClear, style }) {
  const inputRef = useRef(null);

  return (
    <Pressable
      accessible={false}
      onPressIn={() => inputRef.current?.focus()}
      style={[styles.container, style]}>
      <AppIcon
        name="magnify"
        size={ICON_SIZES.md}
        color={COLORS.textLight}
        style={styles.icon}
      />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        autoCapitalize="none"
        autoCorrect={false}
        showSoftInputOnFocus
      />
      {value?.length > 0 && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={onClear}
          hitSlop={8}
          activeScale={0.88}
          activeOpacity={0.72}
          borderless
          style={styles.clearButton}>
          <AppIcon name="close-circle" size={ICON_SIZES.md} color={COLORS.textLight} />
        </PressableScale>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: SIZES.borderRadiusLg,
    paddingHorizontal: SIZES.sm + 4,
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.sm,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  icon: { marginRight: SIZES.sm },
  input: {
    flex: 1,
    ...FONTS.body,
    color: COLORS.text,
    padding: 0,
  },
  clearButton: { padding: 4 },
});
