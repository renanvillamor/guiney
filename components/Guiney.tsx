import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { CREAM } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

import { Txt } from './Txt';

export type GuineyVariant =
  | 'icon'
  | 'splash'
  | 'empty-recipes'
  | 'empty-fridge'
  | 'empty-groceries'
  | 'cooking'
  | 'celebrate'
  | 'warning';

/** Replace the files in assets/mascot to change the artwork; nothing here needs editing. */
const ART: Record<GuineyVariant, ImageSource> = {
  icon: require('@/assets/mascot/icon.png'),
  splash: require('@/assets/mascot/splash.png'),
  'empty-recipes': require('@/assets/mascot/empty-recipes.png'),
  'empty-fridge': require('@/assets/mascot/empty-fridge.png'),
  'empty-groceries': require('@/assets/mascot/empty-groceries.png'),
  cooking: require('@/assets/mascot/cooking.png'),
  celebrate: require('@/assets/mascot/celebrate.png'),
  warning: require('@/assets/mascot/warning.png'),
};

const LABELS: Record<GuineyVariant, string> = {
  icon: 'Guiney the guinea pig chef',
  splash: 'Guiney stirring a pot',
  'empty-recipes': 'Guiney waiting for a recipe',
  'empty-fridge': 'Guiney peeking into an open fridge',
  'empty-groceries': 'Guiney holding a basket',
  cooking: 'Guiney stirring a pot',
  celebrate: 'Guiney celebrating',
  warning: 'Guiney holding a warning sign',
};

interface Props {
  variant: GuineyVariant;
  size?: number;
  /** When nearby text already says it all, screen readers can skip the picture. */
  decorative?: boolean;
}

export function Guiney({ variant, size = 160, decorative = false }: Props) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          // The logo has shaded corners baked in; this radius clips them off.
          borderRadius: size * 0.22,
          // Cream plate in both modes, so dark lettering in the artwork stays legible.
          backgroundColor: CREAM,
          borderColor: variant === 'warning' ? colors.danger : colors.border,
          borderWidth: variant === 'warning' ? 2 : scheme === 'dark' ? 1 : 0,
        },
      ]}>
      <Image
        source={ART[variant]}
        style={styles.image}
        contentFit="contain"
        accessible={!decorative}
        accessibilityLabel={decorative ? undefined : LABELS[variant]}
      />
    </View>
  );
}

/** Guiney rocking as if stirring, unless the person asked for less motion. */
export function GuineyCooking({ message }: { message: string }) {
  const [rock] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      const swing = (toValue: number) =>
        Animated.timing(rock, {
          toValue,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        });
      loop = Animated.loop(Animated.sequence([swing(1), swing(-1)]));
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [rock]);

  const rotate = rock.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });
  return (
    <View style={styles.cooking} accessibilityLiveRegion="polite">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Guiney variant="cooking" size={180} decorative />
      </Animated.View>
      <Txt variant="heading" center>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { overflow: 'hidden', alignSelf: 'center' },
  image: { width: '100%', height: '100%' },
  cooking: { alignItems: 'center', gap: 20, padding: 24 },
});
