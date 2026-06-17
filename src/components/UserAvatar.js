import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

export function UserAvatar({ photoURL, name, size = SIZES.avatarMd, online }) {
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
              backgroundColor: COLORS.primaryDark,
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
              backgroundColor: online ? COLORS.online : COLORS.offline,
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

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOWS.small,
  },
  image: { resizeMode: 'cover' },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.highlight,
  },
  initials: { color: COLORS.white, fontWeight: '800' },
  indicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: COLORS.surface,
  },
});
