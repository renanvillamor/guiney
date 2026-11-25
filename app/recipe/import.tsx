import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { clearSharedPayloads, getResolvedSharedPayloadsAsync, getSharedPayloads } from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { Input, TextField } from '@/components/Fields';
import { whileCooking } from '@/components/Overlays';
import { FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { fetchRecipe } from '@/lib/fetchRecipe';
import { keepShared, MAX_PAGES, pickPages } from '@/lib/photos';
import { canReadPhotos, readPhoto } from '@/lib/readPhoto';
import { findUrl } from '@/lib/recipeImport';
import { fromText } from '@/lib/recipeText';
import { messageOf } from '@/store/account';
import { reviewImport } from '@/store/importDraft';
import { radius, spacing } from '@/theme/spacing';

type From = 'link' | 'photo' | 'text';

const browse = (url: string) => router.push({ pathname: '/recipe/browse', params: { url } });

export default function ImportRecipe() {
  const params = useLocalSearchParams<{ from?: From; shared?: string }>();
  const [from, setFrom] = useState<From>(params.from ?? 'link');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pages, setPages] = useState<string[]>([]);

  // Something shared to Guiney from another app.
  useEffect(() => {
    if (!params.shared) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = getSharedPayloads();
        // Only photos have to be fetched from the other app.
        const images = items.some((item) => item.shareType === 'image')
          ? (await getResolvedSharedPayloadsAsync()).flatMap((item) => item.contentUri ?? [])
          : [];
        if (cancelled) return;
        const words = items
          .filter((item) => item.shareType === 'text' || item.shareType === 'url')
          .map((item) => item.value)
          .join('\n');
        const url = findUrl(words);
        if (images.length > 0) {
          setFrom('photo');
          const copies = await Promise.all(images.slice(0, MAX_PAGES).map(keepShared));
          if (cancelled) return;
          setPages(copies);
        } else if (url && words.length < 400) {
          setFrom('link');
          setLink(url);
        } else if (words !== '') {
          setFrom('text');
          setText(words);
        }
      } catch (error) {
        console.warn('Could not open what was shared', error);
        Alert.alert('Could not open what was shared', 'Save it on this phone, then choose it here.');
      }
      clearSharedPayloads();
    })();
    return () => {
      cancelled = true;
    };
  }, [params.shared]);

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (from === 'text') {
      setText(clip);
    } else {
      setLink(findUrl(clip) ?? clip);
      setLinkError(null);
    }
  };

  const importLink = async () => {
    const url = findUrl(link);
    if (!url) {
      setLinkError('Use a web address, like panlasangpinoy.com/adobo.');
      return;
    }
    setLinkError(null);
    const result = await whileCooking('Guiney is reading the page…', async () => {
      const found = await fetchRecipe(url);
      if (found.status === 'recipe') await reviewImport(found.recipe);
      return found;
    });
    if (result.status === 'offline') {
      setLinkError('Could not reach the page. Check the address and your connection.');
    } else if (result.status === 'blocked') {
      Alert.alert('This site needs a browser', 'Open the page in Guiney, then import from there.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open the page', onPress: () => browse(url) },
      ]);
    } else if (result.status === 'none') {
      Alert.alert(
        'No recipe found on that page',
        'Open it to look, or copy the recipe and use the Text tab.',
        [
          { text: 'Use text', onPress: () => setFrom('text') },
          { text: 'Open the page', onPress: () => browse(url) },
        ],
      );
    }
  };

  const importText = async () => {
    await reviewImport(fromText(text), { text: text.trim() });
  };

  const addPages = async (source: 'camera' | 'gallery') => {
    try {
      const result = await pickPages(source);
      if (result.status === 'picked') {
        setPages((all) => [...all, ...result.uris].slice(0, MAX_PAGES));
      } else if (result.status === 'denied') {
        Alert.alert('Camera is off', 'Allow camera access for Guiney in Android settings, or pick a photo instead.');
      }
    } catch (error) {
      Alert.alert('Could not add the photo', messageOf(error));
    }
  };

  const importPhotos = async () => {
    try {
      const read = await whileCooking('Guiney is reading the photo…', async () => {
        const parts: string[] = [];
        for (const uri of pages) parts.push(await readPhoto(uri));
        return parts.join('\n').trim();
      });
      if (read === '') {
        Alert.alert('No text found', 'Try a sharper photo, in good light, with the page filling the frame.');
        return;
      }
      await reviewImport(fromText(read), { pages, text: read });
    } catch (error) {
      console.warn('Could not read the photo', error);
      Alert.alert('Could not read the photo', 'Try taking or choosing it again.');
    }
  };

  const footer =
    from === 'link' ? (
      <Button title="Import" icon="web" disabled={link.trim() === ''} onPress={() => void importLink()} style={styles.flex} />
    ) : from === 'text' ? (
      <Button title="Continue" disabled={text.trim() === ''} onPress={() => void importText()} style={styles.flex} />
    ) : (
      <Button
        title={pages.length > 1 ? `Read ${pages.length} photos` : 'Read photo'}
        icon="text-recognition"
        disabled={pages.length === 0 || !canReadPhotos}
        onPress={() => void importPhotos()}
        style={styles.flex}
      />
    );

  return (
    <FormScreen title="Import a recipe" footer={footer}>
      <Segmented
        options={[
          { value: 'link', label: 'Website' },
          { value: 'photo', label: 'Photo' },
          { value: 'text', label: 'Text' },
        ]}
        value={from}
        onChange={setFrom}
      />

      {from === 'link' ? (
        <>
          <TextField
            label="Link to the recipe"
            value={link}
            onChangeText={setLink}
            placeholder="https://"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void importLink()}
            error={linkError}
            hint="Or use Share in your browser and choose Guiney."
          />
          <Button kind="tint" icon="content-paste" title="Paste" onPress={() => void paste()} />
        </>
      ) : null}

      {from === 'text' ? (
        <>
          <Input
            label="Recipe text"
            value={text}
            onChangeText={setText}
            placeholder={'Chicken adobo\n\nIngredients\n1 kg chicken\n1/2 cup soy sauce\n\nInstructions\n1. Brown the chicken.'}
            multiline
            style={styles.text}
          />
          <Button kind="tint" icon="content-paste" title="Paste" onPress={() => void paste()} />
          <Txt variant="caption" color="textMuted">
            Headings like Ingredients and Instructions help Guiney sort it.
          </Txt>
        </>
      ) : null}

      {from === 'photo' ? (
        <>
          <Txt color="textMuted">
            {canReadPhotos
              ? 'Works best on clear, printed pages. The photo is read on this phone and is not sent anywhere.'
              : 'Reading photos needs the Guiney app. It does not work in Expo Go.'}
          </Txt>
          {pages.length > 0 ? (
            <View style={styles.pages}>
              {pages.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.page}>
                  <Image source={{ uri }} style={styles.image} contentFit="cover" accessibilityLabel={`Page ${index + 1}`} />
                  <View style={styles.remove}>
                    <IconButton
                      tint
                      icon="close"
                      size={18}
                      label={`Remove page ${index + 1}`}
                      onPress={() => setPages((all) => all.filter((_, other) => other !== index))}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <Button
            kind="tint"
            icon="camera-outline"
            title="Take a photo"
            disabled={!canReadPhotos || pages.length >= MAX_PAGES}
            onPress={() => void addPages('camera')}
          />
          <Button
            kind="tint"
            icon="image-multiple-outline"
            title="Choose photos"
            disabled={!canReadPhotos || pages.length >= MAX_PAGES}
            onPress={() => void addPages('gallery')}
          />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { minHeight: 220 },
  pages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  page: { width: 104, height: 140 },
  image: { width: '100%', height: '100%', borderRadius: radius.md },
  remove: { position: 'absolute', top: 0, right: 0 },
});
