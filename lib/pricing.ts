/**
 * Single source of truth for in-app price display.
 * Canonical spec: TIER_SPEC.md.
 *
 * Model: the REGULAR price is the anchor shown in-app; the first 100 held
 * families keep the founding price while continuously subscribed. "Store-first":
 * once StoreKit / Stripe returns a localized price we should display that for
 * the actual charge.
 */
export const PRICING = {
  currency: "HK$",
  monthly: 38, // regular anchor (in-app displayed)
  yearly: 388, // regular anchor (in-app displayed)
  promoMonthly: 30, // founding-member price (first 100 held families)
  promoYearly: 288, // founding-member price (first 100 held families)
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
