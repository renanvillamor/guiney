import { Text, type TextProps } from 'react-native';

import type { Palette } from '@/theme/colors';
import { useColors } from '@/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/theme/typography';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: keyof Palette;
  center?: boolean;
}

const HEADINGS: TypographyVariant[] = ['hero', 'title', 'heading'];

export function Txt({ variant = 'body', color = 'text', center, style, ...rest }: Props) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole={HEADINGS.includes(variant) ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    />
  );
}
