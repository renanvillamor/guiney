import { requireOptionalNativeModule } from 'expo';

import { readingOrder, type TextBox } from './pageLayout';

interface Box {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
interface OcrModule {
  recognizeText(uri: string): Promise<{
    text: string;
    blocks: { text: string; lines: { text: string; boundingBox: Box }[] }[];
  }>;
}

// Looked up rather than imported, so the app still opens in Expo Go, which has no such module.
const ocr = requireOptionalNativeModule<OcrModule>('ExpoMlkitOcr');

export const canReadPhotos = ocr !== null;

/** The text in a photo, read on this phone. Nothing is sent anywhere. */
export async function readPhoto(uri: string): Promise<string> {
  if (!ocr) throw new Error('Reading photos needs the Guiney app, not Expo Go.');
  const result = await ocr.recognizeText(uri);
  const boxes: TextBox[] = result.blocks.flatMap((block) =>
    block.lines.map(({ text, boundingBox: box }) => ({
      text,
      x: box.x ?? 0,
      y: box.y ?? 0,
      width: box.width ?? 0,
      height: box.height ?? 0,
    })),
  );
  return readingOrder(boxes) || result.text;
}
