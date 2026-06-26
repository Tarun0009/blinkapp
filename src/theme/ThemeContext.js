import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme';

const STORAGE_KEY = '@blink:theme-preference';

const ThemeContext = createContext(null);

export const THEME_OPTIONS = ['system', 'light', 'dark'];

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && THEME_OPTIONS.includes(stored)) {
          setPreference(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setThemePreference = useCallback(async (value) => {
    if (!THEME_OPTIONS.includes(value)) return;
    setPreference(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Persistence is best-effort.
    }
  }, []);

  const value = useMemo(() => {
    const resolvedScheme =
      preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
    const colors = resolvedScheme === 'light' ? LIGHT_COLORS : DARK_COLORS;
    return {
      colors,
      scheme: resolvedScheme,
      preference,
      setThemePreference,
      hydrated,
    };
  }, [hydrated, preference, setThemePreference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
