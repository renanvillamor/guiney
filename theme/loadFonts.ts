import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf';
import * as Font from 'expo-font';

import { fonts } from './typography';

const SOURCES: Record<string, Font.FontSource> = {
  [fonts.displayMedium]: Fredoka_500Medium,
  [fonts.display]: Fredoka_600SemiBold,
  [fonts.body]: Nunito_400Regular,
  [fonts.bodySemi]: Nunito_600SemiBold,
  [fonts.bodyBold]: Nunito_700Bold,
  MaterialDesignIcons,
};

/**
 * Guiney's own builds embed these fonts, so there is usually nothing to do. Expo Go and
 * builds made before a font was added do not have them, and would show unknown glyphs.
 */
export async function loadFonts(): Promise<void> {
  const missing = Object.entries(SOURCES).filter(([family]) => !Font.isLoaded(family));
  if (missing.length === 0) return;
  try {
    await Font.loadAsync(Object.fromEntries(missing));
  } catch (error) {
    // Plain fonts are better than no cookbook.
    console.warn('Could not load fonts', error);
  }
}
