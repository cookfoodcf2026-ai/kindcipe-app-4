/**
 * Single source of truth for in-app price display.
 * Canonical spec: TIER_SPEC.md.
 *
 * "Store-first": once StoreKit / Stripe returns a localized price we should
 * display that for the actual charge. These constants are the fallback shown
 * before/without a live store price.
 */
export const PRICING = {
  currency: "HK$",
  monthlyEarly: 30,
  yearlyEarly: 288,
  monthlyRegular: 38,
  yearlyRegular: 365,
} as const;

export const fmtPrice = (n: number) => `${PRICING.currency}${n}`;

export const PRICE = {
  monthly: fmtPrice(PRICING.monthlyEarly),
  yearly: fmtPrice(PRICING.yearlyEarly),
  monthlyRegular: fmtPrice(PRICING.monthlyRegular),
  yearlyRegular: fmtPrice(PRICING.yearlyRegular),
};

/** Early-bird yearly saving vs the regular yearly price (rounded %). */
export const YEARLY_SAVE_PCT = Math.round(
  (1 - PRICING.yearlyEarly / PRICING.yearlyRegular) * 100
);
