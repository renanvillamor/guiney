import * as SystemUI from 'expo-system-ui';
import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { palettes, type Palette, type Scheme } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeValue {
  scheme: Scheme;
  colors: Palette;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'light', colors: palettes.light });

export function GuineyThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: Scheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);

  // Native dialogs, date pickers and the keyboard follow the choice too.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(value.colors.background);
  }, [value]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export const useTheme = () => use(ThemeContext);
export const useColors = () => use(ThemeContext).colors;
