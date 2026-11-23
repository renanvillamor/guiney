import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Overlays, SplashOverlay } from '@/components/Overlays';
import { loadAllStores } from '@/store';
import { startAccount } from '@/store/account';
import { useSettings } from '@/store/settings';
import { loadFonts } from '@/theme/loadFonts';
import { GuineyThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

type Boot = 'loading' | 'ready' | 'failed';

export default function RootLayout() {
  const preference = useSettings((state) => state.theme);
  const [boot, setBoot] = useState<Boot>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stopAccount: (() => void) | undefined;
    void (async () => {
      await loadFonts();
      try {
        await useSettings.getState().load();
        await loadAllStores();
        if (cancelled) return;
        stopAccount = startAccount();
        setBoot('ready');
      } catch (error) {
        console.error('Could not open the database', error);
        if (!cancelled) setBoot('failed');
      }
    })();
    return () => {
      cancelled = true;
      stopAccount?.();
    };
  }, [attempt]);

  return (
    <SafeAreaProvider>
      <GuineyThemeProvider preference={preference}>
        <Root
          boot={boot}
          onRetry={() => {
            setBoot('loading');
            setAttempt((count) => count + 1);
          }}
        />
      </GuineyThemeProvider>
    </SafeAreaProvider>
  );
}

function Root({ boot, onRetry }: { boot: Boot; onRetry: () => void }) {
  const { colors, scheme } = useTheme();
  const onboarded = useSettings((state) => state.onboarded);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.background,
          text: colors.text,
          border: colors.border,
          notification: colors.danger,
        },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {boot === 'ready' ? (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.display, fontSize: 20 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={onboarded}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
              <Stack.Screen name="profile" />
              <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
              <Stack.Screen name="recipe/edit" />
              <Stack.Screen name="fridge-item" />
              <Stack.Screen name="precooked/index" />
              <Stack.Screen name="precooked/edit" />
              <Stack.Screen name="planner/new" />
              <Stack.Screen name="planner/[id]" />
              <Stack.Screen name="planner/pick" />
              <Stack.Screen name="planner/slots" />
              <Stack.Screen name="grocery/generate" />
              <Stack.Screen name="grocery/move" />
              <Stack.Screen name="grocery/item" />
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="settings/member" />
              <Stack.Screen name="auth/sign-in" />
              <Stack.Screen name="auth/household" />
            </Stack.Protected>
          </Stack>
        ) : null}
        {boot === 'failed' ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <EmptyState
              variant="warning"
              title="Guiney can't open the cookbook"
              body="Your data is still on this phone. Free up some storage, then try again."
            />
            <Button title="Try again" onPress={onRetry} />
          </View>
        ) : null}
        <Overlays />
        {boot === 'failed' ? null : (
          <SplashOverlay ready={boot === 'ready'} onShown={() => SplashScreen.hide()} />
        )}
      </View>
    </ThemeProvider>
  );
}
