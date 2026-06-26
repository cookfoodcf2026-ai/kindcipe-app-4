import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1920;
const MAX_SIZE_BYTES = 6 * 1024 * 1024; // 6MB
const INITIAL_QUALITY = 0.8;
const FALLBACK_QUALITY = 0.7;
const FALLBACK_DIMENSION = 1280;

export type CompressedImage = {
  uri: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
};

export async function compressImage(uri: string): Promise<CompressedImage> {
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
    { compress: INITIAL_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (result.base64 && result.base64.length * 0.75 > MAX_SIZE_BYTES) {
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: FALLBACK_DIMENSION, height: FALLBACK_DIMENSION } }],
      { compress: FALLBACK_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
  }

  return {
    uri: result.uri,
    base64: result.base64 || "",
    mimeType: "image/jpeg",
    width: result.width,
    height: result.height,
  };
}
