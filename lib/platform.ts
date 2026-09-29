/**
 * Platform helpers for the universal (native + web) build.
 *
 * Keep platform branching here and in the handful of adapter modules
 * (auth.ts, purchase.ts, socialAuth.ts) instead of scattering
 * `Platform.OS === "web"` checks across screens.
 */
import { Platform } from "react-native";

export const isWeb = Platform.OS === "web";
export const isNative = !isWeb;
export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

/**
 * The public origin of the web app (no trailing slash), used for share links.
 * Native falls back to the marketing site until EXPO_PUBLIC_WEBAPP_URL is set.
 */
export function getWebappUrl(): string {
  return (
    process.env.EXPO_PUBLIC_WEBAPP_URL ??
    process.env.EXPO_PUBLIC_STORE_URL ??
    "https://kindcipe.com"
  );
}

/** Current browser origin (web only); empty string on native. */
export function getWebOrigin(): string {
  if (!isWeb || typeof window === "undefined") return "";
  return window.location.origin;
}

/** Build a shareable recipe link that works on both platforms. */
export function buildRecipeShareUrl(recipeId: string | number): string {
  return `${getWebappUrl()}/recipe/${recipeId}`;
}

/**
 * Share URL for a recipe. Official recipes have a public SEO page at
 * `/recipes/<name>/` (backend-driven static site); everything else falls back
 * to the app's own recipe route.
 */
export function buildRecipeShareUrlFor(recipe: {
  id: string | number;
  name?: string | null;
  source?: string | null;
}): string {
  const isOfficial = recipe.source === "official" || recipe.source === "kol";
  if (isOfficial && recipe.name) {
    return `${getWebappUrl()}/recipes/${encodeURIComponent(recipe.name.trim())}/`;
  }
  return buildRecipeShareUrl(recipe.id);
}

/** Build the app deep link (native) for a recipe. */
export function buildRecipeDeepLink(recipeId: string | number): string {
  return `kindcipe://recipe/${recipeId}`;
}
