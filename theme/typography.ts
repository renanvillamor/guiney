import type { TextStyle } from 'react-native';

export const fonts = {
  displayMedium: 'Fredoka_500Medium',
  display: 'Fredoka_600SemiBold',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

/** Fredoka carries the voice (titles, buttons); Nunito does the reading. */
export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
