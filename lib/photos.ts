import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Picked photos sit in a cache Android may clear, so they are copied somewhere permanent. */
function keep(uri: string): string {
  const folder = new Directory(Paths.document, 'recipe-photos');
  if (!folder.exists) folder.create({ intermediates: true });
  const extension = /\.(png|webp|heic|jpe?g)$/i.exec(uri)?.[0] ?? '.jpg';
  const target = new File(folder, `${Crypto.randomUUID()}${extension}`);
  new File(uri).copy(target);
  return target.uri;
}

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,
};

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
  return asset ? { status: 'picked', uri: keep(asset.uri) } : { status: 'cancelled' };
}
