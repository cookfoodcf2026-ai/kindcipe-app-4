import { useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Responsive breakpoints for the universal app.
 * Mobile/native keeps the compact (bottom-tab) layout; `lg`+ is desktop web.
 */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSm: width >= BREAKPOINTS.sm,
    isMd: width >= BREAKPOINTS.md,
    isLg: width >= BREAKPOINTS.lg,
    isXl: width >= BREAKPOINTS.xl,
    /** Desktop: wide viewport → sidebar navigation. */
    isDesktop: width >= BREAKPOINTS.lg,
  };
}

export default useBreakpoint;
