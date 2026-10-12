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

| | Monthly | Yearly |
|---|---|---|
| Early bird (current) | HK$30 | HK$288 |
| Regular (later) | HK$38 | HK$365 |

- App Store / Play product IDs remain `kindcipe_monthly_30` / `kindcipe_yearly_288` (do **not** rename — IDs are permanent).
- Early bird is the price shown in-app + marketing until further notice.

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
| Marketing copy | `marketing/src/i18n/ui.ts` `pricing.*` |

## Change log
- 2026-10-12: Initial canonical spec (fixed "new kitchen always Pro" bug; aligned paywall + marketing).
