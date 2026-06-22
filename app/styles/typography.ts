import { theme } from './theme';

export const typography = {
  h1: {
    fontSize: theme.fontSize.xxl,
    fontFamily: theme.fontFamily.bold,
    lineHeight: 32,
  },
  h2: {
    fontSize: theme.fontSize.xl,
    fontFamily: theme.fontFamily.bold,
    lineHeight: 28,
  },
  h3: {
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fontFamily.medium,
    lineHeight: 24,
  },
  body: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fontFamily.regular,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fontFamily.regular,
    lineHeight: 18,
  },
  caption: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fontFamily.regular,
    lineHeight: 16,
  },
};

export default function Typography() { return null; }
