import { useCallback } from "react";
import { useRouter } from "expo-router";

/**
 * Safe "go back" that never traps the user.
 * If there is a screen to pop, pop it; otherwise fall back to a root route.
 * Industry practice: edge-swipe / hardware back is a shortcut, not the only exit.
 */
export function useGoBackSafe(fallback: string = "/(tabs)") {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  }, [router, fallback]);
}
