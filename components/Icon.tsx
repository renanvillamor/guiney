import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';
import type { ComponentProps } from 'react';

import type { Palette } from '@/theme/colors';
import { useColors } from '@/theme/ThemeProvider';

export type IconName = ComponentProps<typeof MaterialDesignIcons>['name'];

interface Props {
  name: IconName;
  size?: number;
  color?: keyof Palette;
}

/** Decorative: the control around it carries the accessible label. */
export function Icon({ name, size = 24, color = 'text' }: Props) {
  const colors = useColors();
  // A fixed box, so an icon is never cut by a width measured before its font had loaded.
  const box = Math.round(size);
  return (
    <MaterialDesignIcons
      name={name}
      size={box}
      style={{ width: box, height: box, lineHeight: box, textAlign: 'center' }}
      color={colors[color]}
      importantForAccessibility="no"
      accessible={false}
    />
  );
}
