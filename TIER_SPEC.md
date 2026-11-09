# Kindcipe Tier Spec — Single Source of Truth

> Canonical Free vs Pro definition. **If any other doc/copy conflicts with this file, this file wins.**
> Update this file first, then align code + copy + other docs.

## Tiers

| Feature | Free | Pro |
|---|---|---|
| Kitchen members | **2** (you + 1) | **4** |
| Recipe imports | **5 / month** | **100 / month** |
| Custom recipes created | **5 / month** | **Unlimited** |
| AI credits | **15 / month** | **250 / month** |
| Languages | **Chinese (zh-TW) + English** | **zh-TW / en / fil / id** |
| Screenshot / camera import | ❌ | ✅ |
| Ingredient search | ✅ | ✅ |
| Shopping list export / share | ✅ | ✅ |
| Meal-plan approvals | Role-based (not plan-gated) | Role-based |
| New kitchen default | **Free** (Pro via C9T trial or paid subscription) | — |

## Pricing

**The regular price is the anchor. The first 100 held families keep the founding price permanently while continuously subscribed.**

| | Monthly | Yearly |
|---|---|---|
| Regular | **HK$38** | **HK$388** |
| Founding member (first 100 held families) | **HK$30** | **HK$288** |

- Founding pricing is a **separate Stripe recurring price**, not a Stripe coupon or client-side promo code.
- A paid founding member keeps HK$30/HK$288 for as long as the subscription remains continuously active.
- Cancel or lapse → the slot is not re-used by the same family; rejoining later uses regular HK$38/HK$388.
- A paid founding member who cancels keeps the slot counted as paid forever. A **trial** that cancels before payment releases the slot back to the pool.
- Capacity is **100 held families**, where held = `reserved + paid` in `earlybird_redemptions`.
- Display source: `lib/pricing.ts`. Backend is the source of truth for charged amounts via `billing.previewCheckout` and `billing.createCheckoutSession`.

## Instagram trial-first promo (C9T)

- IG DM sends only a **C9T-XXXXXXXX** code. C9D is generated and bound to the family server-side; it is never shown to clients and clients cannot submit it.
- C9T grants a **7-day Pro trial with no card and no auto-charge**.
- Founding pricing is unlocked by C9T / founding code; after the trial, the family has a **7-day claim window** (`trialEnd + 7 days`). Without a code, paywall shows regular pricing.
- Inside the claim window:
  - ≥48 hours of trial remaining → Stripe Checkout starts a trial to the app trial end; card is collected, **HK$0 today**, founding price after trial.
  - <48 hours or trial already ended → immediate charge at HK$30/HK$288 with an explicit amount disclosure.
- After the claim window, or once the 100 founding slots are filled → regular HK$38/HK$388.
- Initial batch: **100 C9T codes**. Top up after 7 days based on reserved + paid, capped at 100 held.
- **Any current family member** can redeem C9T or start checkout. Redeeming marks every current member’s one-time trial as used atomically.
- Only **owner/admin** can open the Stripe Billing Portal and manage/cancel.

## Platform behavior

- **Web**: Stripe Checkout + C9T redemption + Stripe Billing Portal.
- **iOS/Android (until IAP/Play Billing ships)**: no native purchase UI and no Stripe payment; C9T redemption remains available. Native CTA opens the web app.
- No Android Stripe. No iOS Stripe.
- AI recipe images remain permanently off until a separate launch decision; do not set `DASHSCOPE_IMAGE_MODEL`.

## Paywall

- Server-authoritative order summary from `billing.previewCheckout`: tier, amount, charge today, trial end, slots remaining, claim deadline.
- Web: plan choice, founding/trial/regular state, C9T code entry, Stripe CTA, FAQ.
- Native: C9T entry only; purchase CTA sends the user to `app.kindcipe.com` (Apple 3.1.1 / Play policy).
- Trial active: show trial state; a Stripe trial with a card shows **Manage subscription** instead of a second checkout.
- Responsive: desktop web ≥1024 → two columns; mobile → stacked sheet. `components/PaywallModal.tsx`.

## Entitlements source of truth (code)

- Backend computes everything in `getFamilySubscription()` — `server/db.ts`.
  - `isPaid` = `status === "active" || status === "trial"`.
  - `multiLang` = `isPaid` (gates fil/id).
  - `maxMembers` = `isPaid ? 4 : 2`.
  - `maxImportsPerMonth` = `isPaid ? 100 : 5`.
  - `maxCustomRecipesPerMonth` = `isPaid ? null : 5`.
  - `aiChatLimit` = `isPaid ? 250 : 15`.
- A delayed Stripe webhook must not downgrade a live trial/paid period; `getFamilySubscription()` checks the latest live Stripe row before expiring.
- New kitchens: `createFamily()` inserts `subscriptionStatus: "free"`.
- Pro unlock: C9T → `subscription.redeemTrialCode`; paid web → Stripe webhook/confirm; paid IAP → `subscription.verifyIap`.
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
| C9T / C9D / founding | `server/services/promo.ts`; `server/routers/subscription.ts` |
| Stripe checkout / portal | `server/routers/billing.ts`; `server/services/stripeBilling.ts`; `server/_core/stripe.ts` |
| Stripe webhook | `server/_core/stripeWebhook.ts` |
| Marketing copy | `kindcipe-site` (separate repo) + `marketing/src/i18n/ui.ts` |

## Change log
- 2026-10-12: Initial canonical spec (fixed "new kitchen always Pro" bug; aligned paywall + marketing).
- 2026-10-13: Pricing model → regular anchor (38/365) + limited-time IG promo code (30/288); platform-aware paywall redesign.
- 2026-10-22: Trial-first C9T + first-100 founding members; founding price is permanent while continuously subscribed; web-only payments; native free-only until IAP/Play Billing.
