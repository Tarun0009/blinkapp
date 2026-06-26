import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { PRESS_FEEDBACK, PressableScale } from './PressableScale';

const HIDDEN_ROUTES = new Set([
  'AddGroupMembers',
  'ArchivedChats',
  'BlockedUsers',
  'ChangePassword',
  'ChatRoom',
  'ChatSettings',
  'CreateGroup',
  'DeleteAccount',
  'EditProfile',
  'FriendRequests',
  'NewChat',
]);

function getNestedRouteName(route) {
  const nestedState = route.state;
  if (!nestedState?.routes?.length) {
    return undefined;
  }

  return nestedState.routes[nestedState.index || 0]?.name;
}

export function AppTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const focusedRoute = state.routes[state.index];
  const nestedRouteName = getNestedRouteName(focusedRoute);

  if (HIDDEN_ROUTES.has(nestedRouteName)) {
    return null;
  }

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, SIZES.sm) }]}>
      <View style={styles.shell}>
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel || options.title || route.name;
            const iconName = options.tabBarIconName || 'circle';

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <PressableScale
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : undefined}
                accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
                activeScale={0.96}
                activeOpacity={0.88}
                rippleColor={focused ? PRESS_FEEDBACK.lightRipple : PRESS_FEEDBACK.softRipple}
                style={[styles.item, focused && styles.itemActive]}
                onPress={onPress}>
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <AppIcon
                    name={iconName}
                    size={focused ? ICON_SIZES.lg : ICON_SIZES.md}
                    color={focused ? colors.white : colors.textSecondary}
                  />
                </View>
                <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safeArea: {
      backgroundColor: colors.background,
      paddingHorizontal: SIZES.md,
      paddingTop: SIZES.xs,
    },
    shell: {
      position: 'relative',
    },
    bar: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SIZES.xs,
      borderRadius: 24,
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderTopColor: colors.highlight,
      ...SHADOWS.medium,
    },
    item: {
      flex: 1,
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      paddingHorizontal: SIZES.sm,
    },
    itemActive: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrapActive: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primary,
      ...SHADOWS.glow,
    },
    label: {
      ...FONTS.small,
      color: colors.textSecondary,
      fontWeight: '700',
      marginLeft: SIZES.sm,
    },
    labelActive: {
      color: colors.primary,
    },
  });
}
