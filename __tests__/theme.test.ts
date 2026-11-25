import { dark, light, type Palette } from '@/theme/colors';

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every text-on-background pair the components use. */
const PAIRS: [text: keyof Palette, background: keyof Palette][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'primaryTint'],
  ['text', 'dangerTint'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['accentText', 'background'],
  ['accentText', 'surface'],
  ['accentText', 'primaryTint'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['danger', 'dangerTint'],
  ['secondary', 'background'],
  ['secondary', 'surface'],
  ['textMuted', 'primaryTint'],
  ['tileIcon', 'tile'],
  ['onFill', 'fill'],
  ['onFill', 'fillPressed'],
  ['onWarning', 'warning'],
  ['onDanger', 'danger'],
  ['onSecondary', 'secondary'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s palette', (_name, palette) => {
  it.each(PAIRS)('%s on %s meets WCAG AA', (text, background) => {
    expect(contrast(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5);
  });
});

it('keeps the brand colours from the brief', () => {
  expect(light).toMatchObject({ primary: '#F97316', background: '#FFF8F1', danger: '#DC2626' });
  expect(dark).toMatchObject({ primary: '#FB923C', background: '#1A120D', danger: '#F87171' });
});
