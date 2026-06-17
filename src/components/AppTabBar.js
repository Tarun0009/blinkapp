import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, ICON_SIZES, SHADOWS, SIZES } from '../constants/theme';
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
                    color={focused ? COLORS.white : COLORS.textSecondary}
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
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
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrapActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
    ...SHADOWS.glow,
  },
  label: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginLeft: SIZES.sm,
  },
  labelActive: {
    color: COLORS.primary,
  },
});
