import { Platform } from 'react-native';

// One source of truth for UI typography.
//
// Web: an explicit system stack prevents the Safari/WebKit "unknown family ->
// Times/serif" fallback that happened with the old, unloaded SFProDisplay-* names.
// Native: undefined lets the platform use its system font, while fontWeight still
// selects the native weight. No font assets / useFonts are required.
const systemFontFamily = Platform.select({
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  android: 'sans-serif',
  default: undefined,
});

const base = systemFontFamily ? { fontFamily: systemFontFamily } : {};

export const typography = {
  fontFamily: systemFontFamily,
  display: { ...base, fontSize: 30, lineHeight: 38, fontWeight: '900' as const },
  h1: { ...base, fontSize: 24, lineHeight: 32, fontWeight: '800' as const },
  h2: { ...base, fontSize: 20, lineHeight: 28, fontWeight: '800' as const },
  h3: { ...base, fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { ...base, fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodySmall: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  caption: { ...base, fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  button: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '800' as const },
  navTitle: { ...base, fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
  sectionLabel: { ...base, fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
  cardTitle: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  meta: { ...base, fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
};

export type TypographyToken = keyof typeof typography;

export default function Typography() { return null; }
