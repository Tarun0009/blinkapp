import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { IconButton } from './IconButton';

export function ScreenHeader({ title, subtitle, onBack, rightActions, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {onBack ? (
          <IconButton
            name="arrow-left"
            onPress={onBack}
            color={colors.primary}
            backgroundColor={colors.primaryLight}
            accessibilityLabel="Go back"
            style={styles.backButton}
          />
        ) : null}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightActions ? <View style={styles.actions}>{rightActions}</View> : null}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.md,
      paddingTop: SIZES.sm + 4,
      paddingBottom: SIZES.md,
      backgroundColor: colors.backgroundSoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
      ...SHADOWS.soft,
    },
    left: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    backButton: {
      marginLeft: 0,
      marginRight: SIZES.sm,
    },
    textWrap: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...FONTS.h2,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: SIZES.sm,
    },
  });
}
