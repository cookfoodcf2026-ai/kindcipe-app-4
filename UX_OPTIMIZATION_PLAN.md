# UX Optimization Plan — Search, Category & Core Loop

> Status: agreed direction, phased implementation. Owner: engineering.
> Supersedes ad-hoc notes; pairs with `LAUNCH_TEST_LIST.md` / `COPY_AUDIT.md`.
> Hidden-by-design screens (pantry / restock / category-manager / coming-soon /
> onboarding-import / `SHOW_EXPERIMENTAL_AI`) are **intentionally hidden** — NOT in scope.

## 1. Objective
Post-launch, users of all 4 languages (zh-TW / en / fil / id) can:
- **find** recipes (by text in any language, by cuisine, by source),
- **plan** and **generate shopping** with minimal friction,
without hitting Chinese-only leaks or dead search results.

## 2. Core loop today (friction)
`find recipe → open → add to plan → generate shopping → shop`
- Search is **monolingual** (backend only searches Chinese columns) → fil/id/en queries return nothing.
- Category filter chips (8) **≠** real recipe categories (12 canonical) → some cuisines unfilterable.
- Shopping is generated **only at add-to-plan time**; no bulk "generate from this week's plan".
- `recipe cards` quick-plan ("加入排餐" on card) is disabled — kept as-is pending user feedback.

## 3. Confirmed decisions
- **Custom-first** ordering for AI Chef library search (done in P5).
- **Bug ≠ preference**: correctness bugs (search, category, i18n) are fixed now; UX preferences (quick-plan, IA merge, shopping bulk-generate) wait for real user feedback.
- Keep quick-plan **status quo** (hidden) until feedback.
- Long-term:收敛 search into a single module so it can be upgraded to a real index later.

## 4. Workstreams

### S-A — Bilingual recipe search (BUG) — backend
`server/routers/recipes.ts` `search` (~:2062)
- Add `name_en / name_fil / name_id` to the keyword `ilike` conditions (currently only
  `name / description / ingredients / tags`).
- **AND first; OR retry only when AND returns 0** (avoid one untranslated token zeroing results).
- Guard: Chinese queries must produce **identical** results (a Chinese token won't match latin columns).

### S-A2 — Multilingual stopwords — backend
- Extend the query cleaner with en/fil/id **function words** (word-boundary safe) so residual
  filler doesn't become a mandatory AND term. (Mirrors `aiRecipe.ts cleanFoodQuery`.)

### S-E1 — Unify category taxonomy (BUG) — frontend
- `src/components/FilterModal.tsx` + `app/(tabs)/index.tsx` + `app/recipes.tsx`:
  category chips must use the **canonical set** (`lib/taxonomy.ts CUISINE_OPTIONS`, 12) instead of
  `lib/category-storage.ts DEFAULT_CATEGORIES` (8).
- Keep a fallback to user custom categories if stored (don't break legacy).
- Provide emoji for the extra 4 (港式 / 台式 / 泰式 / 印度).

### S-E2 — Backfill legacy `recipeCategory` (BUG, optional but recommended) — backend/DB
- Old official recipes may store **English ingredient-category** values
  (`poultry/pork/beef/seafood/vegetable/egg/carb/mixed`) in `recipeCategory`.
- Backfill → canonical cuisine via `scripts/backfill-recipe-classification.ts` (verify it covers this).

### S-E3 — Search matches cuisine — backend
- Add `recipeCategory` to the keyword OR conditions so typing “日式 / Japanese / Hapon” finds it.

### S-E4 — Surface cuisine chips — frontend UX
- Move the cuisine chips out of the filter sheet to a **prominent horizontal row** under the search bar.

### S-E5 — Category manager alignment (deferred)
- Since `category-manager` is hidden, the filter uses canonical directly. If re-enabled later,
  reconcile custom categories with canonical.

### S-C — Search polish — frontend
- Placeholder mentions available languages; add a helpful **empty state** (try other language /
  clear filters / see popular).

## 5. Search bar — UI/behavior draft
```
┌───────────────────────────────────────────────┐
│  🔍  搵食譜、菜系、食材（中／英／菲／印尼）      ✕ │
└───────────────────────────────────────────────┘
  [全部] [我的] [網紅] [熱門]
  ── 菜系 ─────────────────────────────────────
  [全部] [中菜] [西餐] [日式] [韓式] [東南亞] [港式]
  [台式] [泰式] [印度] [甜品] [飲品] [其他]
  ── 已選：日式  #快手菜  ✕ ────────────────────
  [食譜卡] [食譜卡] ...
```
| Input | Before | After |
|---|---|---|
| `日式` | may miss | matches `recipeCategory` → all Japanese |
| `Japanese` / `Hapon` | 0 | matches bilingual columns |
| `Tomato` | 0 | matches `name_en` |
| `番茄` | OK | **unchanged** |

## 6. Compatibility with sources (匯入 / 自訂 / 網紅 / 官方)
`recipes.search` source routing is **independent** of keyword matching:
`all→official+custom`, `official→official`, `user→custom`, `kol→custom(sourceType=kol)`, `hot→official+custom(public)`.
Frontend "我的" sub-filter uses `sourceType`. **S-A/S-E do not touch this** → all sources keep working.

## 7. AI Chef cards — impact
- AI Chef uses a **separate path**: `aiRecipe.chat` → `processAIChefChat` → `execSearchRecipes`
  (already improved in P5: bilingual + custom-first + localized tags/ingredients).
- The recipe-tab changes (S-A/S-E) do **not** affect AI Chef cards.

## 8. Risk guardrails
- Chinese query results must be **byte-for-byte unchanged** (add regression tests).
- OR-retry only when AND returns 0 (foreign/extended queries).
- Category chips: keep custom-category fallback.
- No destructive DB changes; everything OTA/deploy rollback-able.
- Watch query p95 (more `ilike` columns → consider trigram index if needed).

## 9. Test plan
- zh: `清淡` / `湯` / category chips → identical results as before (regression).
- fil: `manok` / `magaan healthy` → hits; no AI charge; no Chinese.
- en: `Japanese` / `Tomato` → hits.
- All source tabs: 全部/官方/我的/網紅/熱門 still correct; 我的 sub (全部/自建/匯入) correct.
- Cuisine chip 日式/港式 → returns matching recipes.

## 10. Broader UX roadmap (feedback-gated)
| # | Item | Type |
|---|---|---|
| 1 | ~~Shopping bulk "generate from plan"~~ | feature (feedback) |
| 2 | quick-plan on card | preference (feedback, status quo) |
| 3 | Merge duplicate recipe browser (`(tabs)/index.tsx` vs `recipes.tsx`) | IA |
| 4 | Simplify filter model + centralize configs | IA |
| 5 | Unify headers/back + labeled `+` icons | consistency |
| 6 | Onboarding time-to-value | feature (feedback) |
| 7 | P6 i18n: push/email (per-user locale) + backend errors (`lang` param, fallback) + dates (`Intl`) | i18n |

## 11. Long-term upgrade path (industry standard)
- **Search**: replace `ilike` module with **Postgres FTS / Typesense** (language analyzers + BM25
  ranking). Keep the single `search` module boundary so the UI doesn't change.
- **Errors**: converge to **stable error codes + client catalog** (or `Accept-Language`).
- **i18n**: drop Chinese-as-key, adopt ICU MessageFormat, add glossary / TMS.
- **Notifications**: store per-user locale; render from a server-side i18n catalog.
