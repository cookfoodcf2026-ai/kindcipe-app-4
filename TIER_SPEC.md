# Kindcipe Tier Spec — Single Source of Truth

> Canonical Free vs Pro definition. **If any other doc/copy conflicts with this file, this file wins.**
> Update this file first, then align code + copy + other docs.

## Tiers

| Feature | Free | Pro |
|---|---|---|
| Kitchen members | **2** (you + 1) | **4** |
| Recipe imports | **20 / month** | **300 / month** |
| Custom recipes created | **20 / month** | **Unlimited** |
| AI chat | **20 / month** | **300 / month** |
| Languages | **Chinese (zh-TW) + English** | **zh-TW / en / fil / id** |
| Screenshot / camera import | ❌ | ✅ |
| Ingredient search | ✅ | ✅ |
| Shopping list export / share | ✅ | ✅ |
| Meal-plan approvals | Role-based (not plan-gated) | Role-based |
| New kitchen default | **Free** (Pro via IG promo code) | — |

## Pricing

**Model: the REGULAR price is the in-app anchor; the Instagram promo code gives a limited-time early-bird price.**

| | Monthly | Yearly |
|---|---|---|
| Regular (displayed anchor) | **HK$38** | **HK$365** |
| IG promo-code price (limited-time early bird) | **HK$30** | **HK$288** |

- Display shows the **regular** price; entering the IG promo code reduces it to the early-bird price (order summary shows the discount).
- Promo is **limited-time** ("優惠結束後恢復原價") — the code is a Stripe promotion code that can be expired when we decide. Doing so makes new sign-ups pay the regular price; existing subscribers keep their signed-up price (grandfathered).
- **No-card 7-day trial** via IG code (`subscription.redeemTrialCode`) — iOS today; web/Android can also subscribe (Stripe) directly.
- App Store / Play / Stripe product IDs remain `kindcipe_monthly_30` / `kindcipe_yearly_288` (do **not** rename; keep neutral names for any *new* product).
- Display source: `lib/pricing.ts` (`PRICE.monthly`/`yearly` regular; `promoMonthly`/`promoYearly`). Backend is source of truth for the charged amount (`billing.previewPromoCode`, `billing.createCheckoutSession`).

## Paywall (platform-aware)
- **Web/Android (Stripe)**: hero + features + 方案選擇（月/年）+ 訂單摘要 + IG 優惠碼「套用」+ Stripe CTA；FAQ；信任列。
- **iOS (no IAP yet)**: IG 7-day free trial variant only (no purchase UI; Apple 3.1.1).
- Responsive: desktop web ≥1024 → two columns; mobile → stacked sheet. `components/PaywallModal.tsx`.
- "Manage subscription" hidden for non-subscribers; shown for paid (web/Android).

## Entitlements source of truth (code)

- Backend computes everything in `getFamilySubscription()` — `server/db.ts`.
  - `isPaid` = `status === "active" || status === "trial"`.
  - `multiLang` = `isPaid` (gates fil/id).
  - `maxMembers` = `isPaid ? 4 : 2`.
  - `maxImportsPerMonth` = `isPaid ? 300 : 20`.
  - `maxCustomRecipesPerMonth` = `isPaid ? null : 20`.
  - `aiChatLimit` = `isPaid ? 300 : 20`.
- New kitchens: `createFamily()` inserts `subscriptionStatus: "free"` (schema default `"free"`).
- Pro unlock: IG promo code → `grantFamilyTrial()` (7 days) or paid IAP/Stripe → `activateFamilySubscription()`.
- `BETA_ALL_PAID=true` (env) makes everyone Pro — must be **false** in production.

## Enforcement points (must stay in sync)

| Rule | File |
|---|---|
| Import quota | `server/db.ts` `assertFamilyQuota`; `server/routers/recipes.ts` |
| Custom recipe quota | `server/routers/customRecipe.ts`; `server/routers/aiRecipe.ts` |
| AI chat quota | `server/routers/aiRecipe.ts`; `server/routers/weeklyMenu.ts` |
| Member cap | `server/routers.ts` `family.join`; `getFamilySubscription` |
| Kitchen count (1 own + 1 join) | `server/routers.ts` `family.create` / `family.join` |
| Screenshot import = Pro | `server/routers/recipes.ts` `parseImage` + `app/import.tsx` |
| Language fil/id = Pro | `app/settings.tsx` language picker |
| Paywall copy | `locales/*.json` `paywall.*`; `components/PaywallModal.tsx` |
| Stripe promo code | `server/routers/billing.ts` `previewPromoCode` / `createCheckoutSession`; `server/_core/stripe.ts` |
| Marketing copy | `kindcipe-site` (separate repo) + `marketing/src/i18n/ui.ts` |

## Change log
- 2026-10-12: Initial canonical spec (fixed "new kitchen always Pro" bug; aligned paywall + marketing).
- 2026-10-13: Pricing model → regular anchor (38/365) + limited-time IG promo code (30/288); platform-aware paywall redesign; shopping zero-Chinese; Stripe promo codes replace auto-coupons.
