export interface Palette {
  primary: string;
  primaryDark: string;
  primaryTint: string;
  secondary: string;
  warning: string;
  danger: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  /**
   * Filled controls: buttons, badges, today. White on `primary` is only 2.8:1, so these use a
   * deeper orange. `primary` is for borders, switches and progress.
   */
  fill: string;
  fillPressed: string;
  onFill: string;
  onWarning: string;
  onDanger: string;
  onSecondary: string;
  /** Orange that is readable as text on background/surface in this scheme. */
  accentText: string;
  /** The square that stands in for a missing photo, and its icon. */
  tile: string;
  tileIcon: string;
  /** Soft backgrounds behind danger and success text. */
  dangerTint: string;
  successTint: string;
  scrim: string;
}

export const light: Palette = {
  primary: '#F97316',
  primaryDark: '#C2410C',
  primaryTint: '#FFEDD5',
  secondary: '#4D7C0F',
  warning: '#F59E0B',
  danger: '#DC2626',
  background: '#FFF8F1',
  surface: '#FFFFFF',
  text: '#2B1D14',
  textMuted: '#7A685C',
  border: '#F1DCC9',
  fill: '#C2410C',
  fillPressed: '#9A3412',
  onFill: '#FFFFFF',
  onWarning: '#2B1D14',
  onDanger: '#FFFFFF',
  onSecondary: '#FFFFFF',
  accentText: '#C2410C',
  tile: '#FFEDD5',
  tileIcon: '#C2410C',
  dangerTint: '#FFF5F3',
  successTint: '#F3F8E6',
  scrim: 'rgba(43, 29, 20, 0.5)',
};

export const dark: Palette = {
  primary: '#FB923C',
  primaryDark: '#EA580C',
  primaryTint: '#46301F',
  secondary: '#84CC16',
  warning: '#FBBF24',
  danger: '#F87171',
  background: '#1A120D',
  // Clearly lighter than the page, so cards stand out.
  surface: '#2B211B',
  text: '#FBEFE6',
  textMuted: '#CDBBAF',
  border: '#4A3B31',
  fill: '#C2410C',
  fillPressed: '#9A3412',
  onFill: '#FFFFFF',
  onWarning: '#1A120D',
  onDanger: '#1A120D',
  onSecondary: '#1A120D',
  accentText: '#FB923C',
  tile: '#5C3317',
  tileIcon: '#FED7AA',
  dangerTint: '#3A1A16',
  successTint: '#232B0E',
  scrim: 'rgba(0, 0, 0, 0.65)',
};

export const palettes = { light, dark } as const;
export type Scheme = keyof typeof palettes;

/** Cream used behind Guiney artwork and the splash in both schemes. */
export const CREAM = '#FFF8F1';
