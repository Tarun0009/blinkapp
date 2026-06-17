import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { UserAvatar } from '../../../components/UserAvatar';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';

export function GroupMemberPickerRow({ person, selected, disabled, onPress }) {
  const displayName = person.displayName || person.username || 'Blink User';

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      activeScale={0.985}
      activeOpacity={0.9}
      disabled={disabled}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={[styles.row, selected && styles.rowSelected, disabled && styles.rowDisabled]}
      onPress={onPress}>
      <UserAvatar
        photoURL={person.photoURL}
        name={displayName}
        size={46}
        online={person.online}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {person.username ? (
          <Text style={styles.meta} numberOfLines={1}>
            @{person.username}
          </Text>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            Connected on Blink
          </Text>
        )}
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? (
          <AppIcon name="check" size={16} color={COLORS.white} />
        ) : (
          <View style={styles.emptyDot} />
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.xs,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  rowSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  body: {
    flex: 1,
    minWidth: 0,
    marginLeft: SIZES.sm + 4,
  },
  name: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  meta: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    marginLeft: SIZES.sm,
  },
  checkSelected: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textLight,
  },
});
