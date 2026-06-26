import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { UserAvatar } from '../../../components/UserAvatar';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { formatPresenceStatus } from '../../../utils/formatTime';

export function GroupMemberPickerRow({ person, selected, disabled, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const displayName = person.displayName || person.username || 'Blink User';
  const presenceLabel = formatPresenceStatus({
    online: person.online,
    lastSeen: person.lastSeenAt,
  });

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
        <Text style={[styles.meta, person.online && styles.metaOnline]} numberOfLines={1}>
          {person.username ? `${presenceLabel} · @${person.username}` : presenceLabel}
        </Text>
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? (
          <AppIcon name="check" size={16} color={colors.white} />
        ) : (
          <View style={styles.emptyDot} />
        )}
      </View>
    </PressableScale>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    row: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      marginHorizontal: SIZES.md,
      marginVertical: SIZES.xs,
      borderRadius: 18,
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderTopColor: colors.highlight,
      ...SHADOWS.soft,
    },
    rowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
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
      color: colors.text,
    },
    meta: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    metaOnline: {
      color: colors.online,
      fontWeight: '700',
    },
    check: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginLeft: SIZES.sm,
    },
    checkSelected: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primary,
    },
    emptyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textLight,
    },
  });
}
