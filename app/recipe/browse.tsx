import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { whileCooking } from '@/components/Overlays';
import { cleanUrl, fromPage, siteName, type PageReading } from '@/lib/recipeImport';
import { messageOf } from '@/store/account';
import { reviewImport } from '@/store/importDraft';
import { spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

/** Reads the recipe out of the open page and posts it back. It changes nothing. */
const READ = `(function () {
  var text = function (node) { return node ? (node.innerText || node.textContent || node.content || '').trim() : ''; };
  var all = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var blocks = all('script[type*="ld+json"]').map(function (node) { return node.textContent || ''; });
  var root = document.querySelector('[itemtype*="schema.org/Recipe"]');
  var marked = null;
  if (root) {
    var image = root.querySelector('[itemprop="image"]');
    marked = {
      name: text(root.querySelector('[itemprop="name"]')),
      ingredients: all('[itemprop="recipeIngredient"], [itemprop="ingredients"]', root).map(text).slice(0, 100),
      steps: all('[itemprop="recipeInstructions"]', root).map(text).slice(0, 100),
      image: image ? (image.src || image.content || null) : null
    };
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({
    guiney: 1, url: location.href, jsonLd: blocks.slice(0, 40), marked: marked
  }));
})(); true;`;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** A page can post anything, so it is checked before use. */
function readMessage(data: string): PageReading | null {
  if (data.length > 5_000_000) return null;
  try {
    const value = JSON.parse(data) as Record<string, unknown>;
    if (value.guiney !== 1 || typeof value.url !== 'string' || !isStrings(value.jsonLd)) return null;
    const marked = value.marked as Record<string, unknown> | null;
    const ok =
      marked !== null && typeof marked === 'object' && typeof marked.name === 'string' &&
      isStrings(marked.ingredients) && isStrings(marked.steps);
    return {
      url: value.url,
      jsonLd: value.jsonLd,
      marked: ok
        ? {
            name: marked.name as string,
            ingredients: marked.ingredients as string[],
            steps: marked.steps as string[],
            image: typeof marked.image === 'string' ? marked.image : null,
          }
        : null,
    };
  } catch {
    return null;
  }
}

export default function BrowseRecipe() {
  const params = useLocalSearchParams<{ url: string }>();
  const url = cleanUrl(params.url ?? '');
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView<object>>(null);
  // Only a message we asked for counts, not one the page sends by itself.
  const asked = useRef(false);
  const [site, setSite] = useState(url ? siteName(url) : '');
  const [loading, setLoading] = useState(true);

  if (!url) {
    return (
      <EmptyState variant="warning" title="That is not a web address" action={{ title: 'Back', onPress: () => router.back() }} />
    );
  }

  const onMessage = (event: WebViewMessageEvent) => {
    if (!asked.current) return;
    const page = readMessage(event.nativeEvent.data);
    if (!page) return;
    asked.current = false;
    const recipe = fromPage(page);
    if (!recipe) {
      Alert.alert(
        'No recipe found on this page',
        'Open the recipe itself, then try again. Or copy it and use From text.',
      );
      return;
    }
    whileCooking('Guiney is reading the page…', () => reviewImport(recipe)).catch((error: unknown) =>
      Alert.alert('Could not import the recipe', messageOf(error)),
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: site }} />
      <WebView<object>
        ref={web}
        source={{ uri: url }}
        style={styles.flex}
        originWhitelist={['https://*', 'http://*']}
        onShouldStartLoadWithRequest={(request) => /^https?:|^about:blank/i.test(request.url)}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        geolocationEnabled={false}
        mediaPlaybackRequiresUserAction
        onNavigationStateChange={(state) => {
          setSite(siteName(state.url));
          setLoading(state.loading);
        }}
        onMessage={onMessage}
        accessibilityLabel={`Web page from ${site}`}
      />
      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md },
        ]}>
        {loading ? <ActivityIndicator color={colors.accentText} accessibilityLabel="Loading page" /> : null}
        <Button
          icon="download"
          title="Import this recipe"
          style={styles.flex}
          onPress={() => {
            asked.current = true;
            web.current?.injectJavaScript(READ);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
