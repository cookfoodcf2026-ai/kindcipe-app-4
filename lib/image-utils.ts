import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1920;
const MAX_BASE64_LENGTH = 5_000_000; // ≈ 3.75MB, under backend 5.5M char limit
const INITIAL_QUALITY = 0.9; // Increased from 0.8 to preserve more detail for AI analysis
const MIN_QUALITY = 0.6; // Increased from 0.4 to maintain minimum quality
const MIN_DIMENSION = 800;

export type CompressedImage = {
  uri: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
};

export async function compressImage(uri: string): Promise<CompressedImage> {
  let quality = INITIAL_QUALITY;
  let dimension = MAX_DIMENSION;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: dimension, height: dimension } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  while (
    result.base64 &&
    result.base64.length > MAX_BASE64_LENGTH &&
    (quality > MIN_QUALITY || dimension > MIN_DIMENSION)
  ) {
    if (quality > MIN_QUALITY) quality -= 0.2;
    if (dimension > MIN_DIMENSION) dimension = Math.floor(dimension * 0.8);
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: dimension, height: dimension } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
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
