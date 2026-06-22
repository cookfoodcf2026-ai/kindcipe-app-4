import { colors } from './colors';

export const theme = {
  colors,

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 999,
  },

  fontFamily: {
    bold: 'SFProDisplay-Bold',
    medium: 'SFProDisplay-Medium',
    regular: 'SFProDisplay-Regular',
  },
};

export type Theme = typeof theme;
export default function Theme() { return null; }
