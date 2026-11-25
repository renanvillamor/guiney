import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Picked photos sit in a cache Android may clear, so they are copied somewhere permanent. */
async function keep(uri: string): Promise<string> {
  const folder = new Directory(Paths.document, 'recipe-photos');
  if (!folder.exists) folder.create({ intermediates: true });
  const extension = /\.(png|webp|heic|jpe?g)$/i.exec(uri)?.[0] ?? '.jpg';
  const target = new File(folder, `${Crypto.randomUUID()}${extension}`);
  await new File(uri).copy(target);
  return target.uri;
}

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,
};

/** Saves a picture from the web. Null if it cannot be had; a recipe is fine without one. */
export async function keepRemotePhoto(url: string): Promise<string | null> {
  if (!url.startsWith('https://')) return null;
  const target = new File(Paths.cache, `import-${Crypto.randomUUID()}.jpg`);
  try {
    const file = await File.downloadFileAsync(url, target);
    if (file.size < 1000 || file.size > 15_000_000) return null;
    return await keep(file.uri);
  } catch {
    return null;
  } finally {
    if (target.exists) target.delete();
  }
}

/** Our own copy of a shared photo: the shared one goes when the share is cleared. */
export async function keepShared(uri: string): Promise<string> {
  const copy = new File(Paths.cache, `shared-${Crypto.randomUUID()}.jpg`);
  await new File(uri).copy(copy);
  return copy.uri;
}

/** Photos of a written recipe, at full size so the text can be read. */
export async function pickPages(from: 'camera' | 'gallery'): Promise<{ status: 'picked'; uris: string[] } | { status: 'cancelled' | 'denied' }> {
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
  }
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          orderedSelection: true,
          selectionLimit: MAX_PAGES,
          quality: 1,
        });
  if (result.canceled) return { status: 'cancelled' };
  return { status: 'picked', uris: result.assets.map((asset) => asset.uri) };
}
export const MAX_PAGES = 6;

export type PhotoResult =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

export async function pickPhoto(from: 'camera' | 'gallery'): Promise<PhotoResult> {
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
  }
  // Android's photo picker needs no permission.
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { status: 'picked', uri: await keep(asset.uri) } : { status: 'cancelled' };
}
