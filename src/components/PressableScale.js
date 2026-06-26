import React, { useRef } from 'react';
import { Animated, Platform, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  disabled = false,
  activeScale = 0.97,
  activeOpacity = 0.92,
  rippleColor = 'rgba(15, 23, 42, 0.08)',
  borderless = false,
  androidRipple,
  onPressIn,
  onPressOut,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animate = (toScale, toOpacity) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        friction: 8,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = (event) => {
    if (!disabled) {
      animate(activeScale, activeOpacity);
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event) => {
    animate(1, 1);
    onPressOut?.(event);
  };

  const animatedStyle = {
    opacity: disabled ? 0.6 : opacity,
    transform: [{ scale }],
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={
        Platform.OS === 'android'
          ? androidRipple || { color: rippleColor, borderless }
          : undefined
      }
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}

export const PRESS_FEEDBACK = {
  softRipple: 'rgba(37, 99, 235, 0.08)',
  lightRipple: 'rgba(255, 255, 255, 0.22)',
  dangerRipple: 'rgba(251,113,133,0.14)',
};
