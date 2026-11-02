# APP4 Production Verify

> Scope: `git log origin/main..HEAD` = **43 commits** (2026-10-30). Backend DB migration already applied; backend application code deploy status must be confirmed before running this checklist.
>
> This document does not change runtime behavior. Only docs + code self-check.

## 0. How to read this

- **Y** = changes the request sent to backend, or reads a new/changed response field. These need explicit production verification.
- **N** = UI / i18n / copy / docs / instrumentation only. Smoke test is enough.
- Test each item on the production build, signed in with a normal account, unless a test account / feature flag is stated.

## 1. Commit classification

### 1.1 Y — backend request/response contract

| Commit | Area | Backend delta |
|---|---|---|
| `6ad6c089` | Import / recipe editor | `importUser` payload: `sourceUrl`, `allowIncomplete`, `visibility`; edit-draft `sourceUrl` hydration |
| `86d8cb61` | Kitchen / family | `family.join` response supports `{ success, family }` and legacy `{ id }`; role / dissolve UI uses family mutations |
| `249908bf` | Import | Save-incomplete payload carries `image` + `description` |
| `a8b91f16` | Auth / family | `family.setActive` mutation; `X-Family-Id` sync; families list / stale family fallback |
| `f5df3bde` | Kitchen | `family.regenerateInviteCode` mutation |
| `62d3f756` | Import | Save-incomplete sends `image` (screenshot cover) and name fallback |
| `dd98fc7d` | Import | Save-incomplete sends preserved `sourceUrl`, `allowIncomplete`, `visibility`; platform detection |
| `0bcc485b` | Import | `aiRecipe.generateFromHint({ hint })` → expects `{ recipe }` |
| `4d0de173` | Import | `aiRecipe.generateFromImage({ storageKeys })` → expects `{ recipe }`; import saves original link |
| `9a09d716` | Recipe detail | `aiRecipe.fillSteps` with name/description/ingredients/steps → expects `{ steps, stepsEn/Fil/Id }` |
| `36e8781e` | Kitchen | `family.updateRole`, `family.transferOwnership`, `family.dissolve`, `family.regenerateInviteCode` UI |
| `9618bffc` | Import | AI-generated recipe save keeps `sourceUrl` |
| `c495155a` | AI Chef | Reads `served`, `requested`, `missingRoles`, `intent`, `sources`, `status`/safe-mode, `family.usage`, `aiRecipe.status` |
| `e6890189` | AI Chef | Sends `clientMessageId`; reads `status`, `quickReplies`, `replyText`, `operation` |
| `30b357ce` | AI Chef | Expects recipe `cardId` for append merge; falls back to name/officialId identity |
| `e0e5e085` | Home / recipes | Sends `sort=popular|newest|updated` |
| `758b1c59` | AI Chef | Sends `aiEntry` |
| `9c7ffef9` | AI Chef | `clientMessageId` per submit + reuse on retry |
| `d5ba7078` | Recipe editor / import | Sends `scenarios` on `createBlank`, `updateUser`, `importUser`; reads `scenarios` / `scenarioTagsUser` / `scenario_tags_user` |
| `b6edcc5a` | AI Chef | Reads `clarifyReason`, `served`, `quickReplies`, `alternatives`, `quota`; sends `aiEntry=tab_<scenario>` |

### 1.2 N — no backend contract change

- Docs: `a797d8eb`, `ae0b95b7`, `5b997cd6`, `936198ff`
- Sentry: `bf34d1da`, `05099313`, `b9af3c08`
- UI / i18n / copy / share / clipboard: `0afa2b7b`, `b7f484e6`, `8e7d1ee6`, `43b17ae7`, `2747c00c`, `40e4a051`, `65d405a4`, `5b89a1ed`, `74c323cb`, `734bc9b6`, `ca1c2b67`, `37df8275`, `b86e1015`, `b74cfec8`, `5928d606`
- Stripe client gate: `d35f1237` (web-only purchase; no backend request shape change)

## 2. Backend deploy order (required)

**Order: backend code first, app build second.**

1. DB migration (reported done): `scenario_tags_user`.
2. Backend code must accept / return:
   - `scenarios` on `recipes.createBlank`, `recipes.updateUser`, `recipes.importUser`; return it on `getById` / `getDraft` (or `scenarioTagsUser` / `scenario_tags_user`).
   - `clarifyReason`, `served`, `quickReplies`, `alternatives`, `quota` on `aiRecipe.chat` library path.
   - `aiEntry` values including `tab_quick`, `tab_healthy`, `tab_ricecooker`, `tab_kids`, `tab_guest`.
   - `clientMessageId` idempotency / conflict semantics.
   - `aiRecipe.generateFromHint`, `aiRecipe.generateFromImage`, `aiRecipe.fillSteps`.
   - `family.setActive`, `family.regenerateInviteCode`, role / transfer / dissolve mutations.
   - `recipes.search` `sort` support.
3. Deploy app build.

If app ships first: `scenarios` saves can fail if backend schema is strict; AI CTA silently falls back (safe); `generateFrom*` / `fillSteps` / new family actions show errors.

## 3. Production verification runbook

### 3.1 Scenario tags — `d5ba7078` (highest risk)

**A. Custom recipe create**
1. Recipes → Add recipe → fill name / ingredients / steps.
2. Set cook time 20 → expect `快煮/Quick` chip preselected.
3. Change dish type to vegetable → expect `健康/Healthy` suggested.
4. Tap `兒童/Kids`; tap `快煮` again to deselect.
5. Save → open the saved recipe → Edit.
- Expected: selected scenarios persist; payload contains `scenarios:["kids"]` (or current selection).
- Failure: save error / scenarios disappear after reopen / chips reset to system suggestion after manual change.

**B. Import**
1. Import a URL/text recipe.
2. Preview → check `幫你分好類：<dishType>` + `建議場景：` chips.
3. Change chips, save.
- Expected: `importUser` payload contains `scenarios`; reopened recipe keeps selection.
- Failure: chips absent, cannot change, save error, or reopen loses selection.

**C. Empty selection**
1. Custom recipe → deselect all scenario chips → save.
- Expected: payload `scenarios: []`; backend uses system derivation, app does not force a suggestion back.
- Failure: chips re-select themselves after leaving/reopening.

### 3.2 AI Chef — library miss CTA — `b6edcc5a`

1. AI Chef → scenario card (`快煮 / 健康 / 電飯煲 / 小朋友 / 宴客`) on an empty library.
2. Expected message: `呢個場景庫存暫時未有合適食譜。要我用 AI 即場設計嗎？（1 credit）`.
3. Expected chips:
   - `AI 生成` → sends `mode=ai`, `aiEntry=tab_<scenario>`.
   - `睇最接近` → only when backend returns non-empty `alternatives`; shows closest cards.
   - If backend returns `quickReplies`, those actionIds/labels are rendered first (`ai_generate`, `closest_library`, `import_recipe`).
4. Quota exhausted / `quota.nearLimit`:
   - AI chip must be grey, disabled, and show `今個月 AI 額度用完`.
5. Failure:
   - Only old `無食譜` appears → backend did not return `clarifyReason=library_miss|lib_search_fail` with `served=0`.
   - AI chip still active when quota says near/exhausted.
   - `睇最接近` visible but no alternatives / empty card list.
   - `import_recipe` does not open Import.
   - `aiEntry` in network payload is `quick_reply` instead of `tab_<scenario>`.

### 3.3 AI Chef — `clientMessageId` / retry — `e6890189`, `9c7ffef9`

1. AI Chef → press `AI 生成` once → note request `clientMessageId` (`cm_...`).
2. Press `AI 生成` again (new submit) → expect a different `clientMessageId`.
3. Force a transient failure (airplane mode / kill network after send), then retry the same request.
- Expected: retry reuses the failed request's `clientMessageId`; no `CONFLICT` ("content mismatch") on a genuine retry.
4. Switch from `食譜庫` to `AI 生成` (payload changes: `mode`, `excludeNames`) → expect different IDs, no conflict.
- Failure: same ID across different payloads; conflict toast; retry burns multiple credits.

### 3.4 AI Chef — contract / quick replies / append / telemetry

- `e6890189`: backend `status=clarify|no_cards` → app shows contract text + `quickReplies`; no raw JSON leaks.
- `758b1c59`: `aiEntry` present on AI calls (`ai_tab`, `quick_reply`, `toast_fallback`, `ai_fallback`, `swap_ai`, `meal_ai`).
- `30b357ce`: with existing cards, ask "再加一個" → old cards stay; same `cardId` is not duplicated; legacy cards without `cardId` still merge by name/official id.
- `c495155a`: result cards show library/AI labels; usage banner near 80%; safe mode banner if backend returns `safe_mode` / `library_only`; `sources` counts not stuck at 0.

### 3.5 AI Chef — prompt visibility — `5928d606`

1. Press AI generate in a meal context (3餸1湯 / structured prompt).
- Expected: no `請為我設計今晚...` internal prompt appears in visible chat; only friendly user text (`3 餸 1 湯（4人）` / `AI 生成食譜`).
- Failure: internal prompt flashes or stays in visible messages.

### 3.6 Import / recipe AI helpers

- `0bcc485b`: Import failure → `AI 生成` from hint → expects recipe preview/save, not raw error.
- `4d0de173`: Import failure with screenshot → generates recipe from image (`generateFromImage`); screenshot save keeps original `sourceUrl`.
- `9a09d716` / `65d405a4`: user recipe with missing steps → `✨ 補齊做法`; complete recipe does not show button; after fill, steps persist.
- `6ad6c089`, `249908bf`, `62d3f756`, `dd98fc7d`, `9618bffc`: incomplete import saves `image`, `description`, `sourceUrl`, `allowIncomplete`, `visibility:"private"`; no `待補充` recipe loses its link/cover.

### 3.7 Home / search — `e0e5e085`

1. Home → 我的食譜 → sort `最新新增`.
- Expected: request has `sort=newest`; list order matches newest.
2. Switch to popular / updated.
- Expected: backend sorts accordingly; client-side cookTime/difficulty sorting still works.
- Failure: `sort` ignored (always popular) or request error.

### 3.8 Kitchen / family / auth

- `86d8cb61`: join with invite code → accepts both `{family:{id}}` and `{id}`; new member lands in joined kitchen.
- `36e8781e` / `f5df3bde`: role change, transfer ownership, dissolve (type kitchen name), regenerate invite code → success + old invite code invalid.
- `a8b91f16`: switch kitchen → `family.setActive` fires, `X-Family-Id` updates, all screens reload with new kitchen; deleted/stale family falls back to first family.
- Failure: joined kitchen not selected; role unchanged; dissolve silently no-op; old invite code still works; headers stuck on old family.

### 3.9 Stripe — `d35f1237`

- Web: subscription purchase still works.
- iOS/Android: Stripe purchase entry must not appear.
- Failure: native shows Stripe flow (store policy risk).

## 4. Self-check: dependencies on undeployed backend behavior

| App commit | Required backend behavior | If backend missing |
|---|---|---|
| `d5ba7078` | Accept `scenarios` on 3 mutations; return it on read | Strict schema → save fails; permissive schema → chips lost |
| `b6edcc5a` | `clarifyReason`, `served`, `quickReplies`, `alternatives`, `quota`; accept `aiEntry=tab_*` | CTA not shown (fallback old toast); or AI entry telemetry rejected/ignored |
| `e6890189`, `9c7ffef9` | `clientMessageId` accepted / idempotent | Field ignored → retry not idempotent; strict schema → AI call fails |
| `758b1c59` | `aiEntry` accepted | Telemetry missing; strict enum → AI call fails |
| `c495155a` | `sources`, `requested`, `missingRoles`, `intent`, `status`; `aiRecipe.status` | Labels/counts wrong or hidden; no crash |
| `30b357ce` | `cardId` in recipes | Falls back to name/officialId; possible duplicate merge only |
| `e0e5e085` | `sort` on recipe search | Sort ignored / wrong order |
| `0bcc485b` | `aiRecipe.generateFromHint` | Button errors |
| `4d0de173` | `aiRecipe.generateFromImage` | Button errors; screenshot AI path dead |
| `9a09d716` | `aiRecipe.fillSteps` | Button errors |
| `86d8cb61` | `family.join` returns `{family}` or `{id}` | Code supports both; if neither, join not selected |
| `a8b91f16` | `family.setActive` | Switch UI changes but backend active family stale |
| `f5df3bde`, `36e8781e` | regenerate invite / role / transfer / dissolve endpoints | Actions error / no-op |
| `62d3f756`, `dd98fc7d`, `249908bf`, `6ad6c089`, `4d0de173`, `9618bffc` | `importUser` accepts `image`, `description`, `sourceUrl`, `allowIncomplete`, `visibility` | Save-incomplete fails or drops fields |

## 5. Biggest risk

**`d5ba7078` (scenarios) is the biggest risk.**
It adds `scenarios` to every `createBlank` / `updateUser` / `importUser` payload. If backend production code is not yet deployed and validates strictly, **all custom recipe saves and imports can fail**, not just a degraded UX. All other new AI-contract fields have client-side fallbacks or only hide new UI.

## 6. Code self-check references

- `app/ai-chef.tsx:655` `isQuotaBlocked`
- `app/ai-chef.tsx:2073` `AiEntry` including `tab_*`
- `app/ai-chef.tsx:2538-2561` library-miss condition / quickReplies / alternatives
- `app/ai-chef.tsx:3829-3856` `ai_generate` / `closest_library` / `import_recipe`
- `app/ai-chef.tsx:4952-4961` quota-disabled AI chip
- `app/recipe-editor.tsx:515` / `612` `scenarios` payload
- `app/import.tsx:1320` `scenarios` payload
- `lib/scenarioTags.ts:15` / `31` normalization + suggestions
- `hooks/useAuth.ts` `family.setActive` sync
- `app/import.tsx` `generateFromHint` / `generateFromImage`
- `app/recipe/[id].tsx` `fillSteps`

## 7. Typo corrections

None. No runtime code changes in this task.
