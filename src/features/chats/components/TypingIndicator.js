import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';

export function TypingIndicator({ names = [] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (names.length === 0) return;

    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [names.length, dot1, dot2, dot3]);

  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.join(', ')} are typing`;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { opacity: dot, transform: [{ scale: Animated.add(0.5, Animated.multiply(dot, 0.5)) }] },
          ]}
        />
      ))}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      marginHorizontal: SIZES.md,
      marginBottom: SIZES.xs,
      borderRadius: SIZES.borderRadiusLg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    text: { ...FONTS.small, color: colors.textSecondary, marginRight: SIZES.xs },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 2,
    },
  });
}
