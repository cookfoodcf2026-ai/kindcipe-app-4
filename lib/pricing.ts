/**
 * Single source of truth for in-app price display.
 * Canonical spec: TIER_SPEC.md.
 *
 * Model: the REGULAR price is the anchor shown in-app; the Instagram promo
 * code gives the discounted early-bird price. "Store-first": once StoreKit /
 * Stripe returns a localized price we should display that for the actual charge.
 */
export const PRICING = {
  currency: "HK$",
  monthly: 38, // regular anchor (in-app displayed)
  yearly: 365, // regular anchor (in-app displayed)
  promoMonthly: 30, // Instagram promo-code price (limited-time early bird)
  promoYearly: 288, // Instagram promo-code price (limited-time early bird)
} as const;

export const fmtPrice = (n: number) => `${PRICING.currency}${n}`;

export const PRICE = {
  monthly: fmtPrice(PRICING.monthly),
  yearly: fmtPrice(PRICING.yearly),
  promoMonthly: fmtPrice(PRICING.promoMonthly),
  promoYearly: fmtPrice(PRICING.promoYearly),
};

/** Yearly saving vs paying monthly (regular prices). */
export const YEARLY_SAVE_PCT = Math.round(
  (1 - PRICING.yearly / (PRICING.monthly * 12)) * 100
);
