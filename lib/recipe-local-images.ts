/**
 * Shared recipe local image mapping
 *
 * ⚠️ PRODUCTION-CRITICAL:
 *   Local recipe PNGs are INTENTIONALLY NOT bundled into the app binary.
 *   These 316 images (~600 MB) live in assets/recipes/ for reference and
 *   one-off scripts only. ALL runtime recipe covers now come from the
 *   backend R2 storage via `thumbnailUrl` / `image` (remote-first).
 *
 *   Bundling them statically would inflate the app to ~600 MB and fail
 *   App Store / Play Store review. Keep this file asset-require-free.
 *
 *   To regenerate the name→file mapping (used by backend upload scripts):
 *     node scripts/extract-recipe-image-map.cjs
 */

export interface RecipeImageMap {
  [recipeName: string]: any;
}

/**
 * Local image map is intentionally EMPTY in production bundles.
 * Recipe covers are served from backend R2 (remote-first).
 */
export const RECIPE_LOCAL_IMAGES: RecipeImageMap = {};

/**
 * Returns undefined — local images are not bundled.
 * Kept for API-compatibility with callers that expect a fallback resolver.
 */
export function getRecipeLocalImage(_recipeName: string): any {
  return undefined;
}

/** All recipe names that have a local image. */
export function getAllRecipeNames(): string[] {
  return Object.keys(RECIPE_LOCAL_IMAGES);
}

/** Always false — no local images are bundled. */
export function hasLocalImage(_recipeName: string): boolean {
  return false;
}