import React, { useMemo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { SHADOWS, SIZES } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';

export function UserAvatar({ photoURL, name, size = SIZES.avatarMd, online }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.primaryDark,
            },
          ]}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
      )}
      {typeof online === 'boolean' && (
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: online ? colors.online : colors.offline,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              borderWidth: size * 0.05,
            },
          ]}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      position: 'relative',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      ...SHADOWS.small,
    },
    image: { resizeMode: 'cover' },
    placeholder: {
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.highlight,
    },
    initials: { color: colors.white, fontWeight: '800' },
    indicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      borderColor: colors.surface,
    },
  });
}
