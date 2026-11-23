import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { CREAM } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Guiney, GuineyCooking } from './Guiney';
import { Txt } from './Txt';

interface OverlayState {
  cooking: string | null;
  celebration: { title: string; body: string } | null;
  celebrate: (title: string, body: string) => void;
  dismiss: () => void;
}

export const useOverlay = create<OverlayState>((set) => ({
  cooking: null,
  celebration: null,
  celebrate: (title, body) => set({ celebration: { title, body } }),
  dismiss: () => set({ celebration: null }),
}));

/** Long enough for the message to be read instead of flickering. */
const MIN_COOKING_MS = 900;

export async function whileCooking<T>(message: string, work: () => Promise<T>): Promise<T> {
  useOverlay.setState({ cooking: message });
  try {
    const [result] = await Promise.all([
      work(),
      new Promise((resolve) => setTimeout(resolve, MIN_COOKING_MS)),
    ]);
    return result;
  } finally {
    useOverlay.setState({ cooking: null });
  }
}

/** Mounted once, above all screens. */
export function Overlays() {
  const colors = useColors();
  const { cooking, celebration, dismiss } = useOverlay();
  return (
    <>
      <Modal visible={cooking !== null} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={[styles.full, { backgroundColor: colors.background }]}>
          <GuineyCooking message={cooking ?? ''} />
        </View>
      </Modal>
      <Modal
        visible={celebration !== null && cooking === null}
        transparent
        animationType="fade"
        onRequestClose={dismiss}>
        <Pressable
          style={[styles.full, { backgroundColor: colors.scrim }]}
          onPress={dismiss}
          accessible={false}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} accessible={false}>
            <Guiney variant="celebrate" size={150} />
            <Txt variant="title" center>
              {celebration?.title}
            </Txt>
            <Txt center color="textMuted">
              {celebration?.body}
            </Txt>
            <Button title="Nice" onPress={dismiss} style={styles.wide} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * The full splash artwork. Android 12+ only lets the system splash show a small
 * masked icon, so this takes over from it until the database is ready.
 */
export function SplashOverlay({ ready, onShown }: { ready: boolean; onShown: () => void }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: 280,
      delay: 500,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setGone(true);
    });
    return () => fade.stop();
  }, [ready, opacity]);

  if (gone) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: CREAM, opacity }]}
      pointerEvents={ready ? 'none' : 'auto'}>
      <Image
        source={require('@/assets/images/splash.png')}
        style={styles.splash}
        contentFit="contain"
        onDisplay={onShown}
        onError={onShown}
        accessibilityLabel="Guiney, your kitchen buddy"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  wide: { alignSelf: 'stretch', marginTop: spacing.sm },
  splash: { flex: 1 },
});
