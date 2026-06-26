# Kindcipe - Complete Project Plan

> **Last updated:** Jun 26, 2026
> **Status:** Locked - Ready for execution

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Decisions](#2-key-decisions)
3. [Roadmap](#3-roadmap)
4. [Phase 1: Common Ingredients Library](#phase-1-common-ingredients-library)
5. [Phase 1.5: Critical Bug Fix](#phase-15-critical-bug-fix)
6. [Phase 2: Meal Plan Sync + Recipe Search](#phase-2-meal-plan-sync--recipe-search)
7. [Phase 2.5: Real-Time Sync Fix](#phase-25-real-time-sync-fix)
8. [Phase 3: UI Optimization + Design System](#phase-3-ui-optimization--design-system)
9. [Phase 4: Full App Visual Redesign](#phase-4-full-app-visual-redesign)
10. [Phase 5: Multi-Language + AI Translation](#phase-5-multi-language--ai-translation)
11. [Phase 6: Advanced Features](#phase-6-advanced-features)
12. [Critical Bugs Found](#12-critical-bugs-found)
13. [UI Redesign Guidelines](#13-ui-redesign-guidelines)
14. [Design System](#14-design-system)
15. [Database Schema Changes](#15-database-schema-changes)

---

## 1. Project Overview

**Kindcipe** is a Hong Kong family cooking app built with:
- **Frontend:** React Native 0.81 + Expo SDK ~54 + Expo Router 6 + tRPC v11 + TanStack Query
- **Backend:** Node.js + Express + tRPC v11 + Drizzle ORM + PostgreSQL
- **Hosting:** Railway (backend production)
- **Target users:** HK families, including domestic helpers (Filipino/Indonesian)

### Core Features
- Family kitchen sharing via invite code
- Recipe library (official + imported + custom + AI-generated)
- Meal planning with shopping list sync
- Shopping list with price comparison
- AI Chef assistant
- Pantry management (temporarily hidden)

---

## 2. Key Decisions

| Item | Decision | Rationale |
|------|----------|-----------|
| Colors | Navy `#013E77` + Copper `#F5A823` + Gray/Ivory only. No teal `#00BBA9`, no coral `#FF6B6B` | User preference - premium, clean look |
| Fonts | System fonts (no custom font loading) | Save app size, system CJK fonts are good enough |
| Home tab | Add new Home tab as landing page | Matches design mockup |
| Tab order | Home -> Recipe Library -> Planner -> Shopping -> Profile | User confirmed |
| Pantry | Temporarily hidden from UI | Not ready for public use |
| Restock | Temporarily hidden (related to pantry) | Same as above |
| Admin panel | Only visible to `user.role === "admin"` | Security |
| Logout | No warning alert, simple row at bottom of profile | Data is server-side, re-login restores everything |
| Execution order | Phase 1 -> 1.5 -> 2 -> 2.5 -> 3 -> 4 -> 5 -> 6 | Feature-first, UI last to minimize conflicts |
| Real-time sync | Polling + Push Notification (no SSE) | Simpler, mobile-friendly, self-healing |
| Multi-language | Phase 5 (after app is stable and ready for public) | Avoid re-translating UI on every change |
| User content translation | AI translation (Phase 5) | Helper writes Filipino, employer reads Chinese |
| Recipe search | Backend search + infinite scroll (supports 1000+ recipes) | Current client-side filter won't scale |
| Meal plan sync | Auto-add ingredients + post-edit in shopping list | Guarantees sync, user can remove unneeded items |
| `common_ingredient_id` | Only on `shopping_items`, not `pantry_items` | Pantry is hidden, reduce migration scope |
| Offline fallback | ~30 hardcoded common ingredients | Extreme edge case when cache is empty |
| UI rule | **Never reduce or delete existing functionality** | User mandate |
| Dead code removal | Grep confirm unused before deleting, requires approval | Safety |

---

## 3. Roadmap

| Phase | Name | Risk | Est. Duration |
|-------|------|------|---------------|
| **Phase 1** | Common Ingredients Library | Low (independent) | 1-2 weeks |
| **Phase 1.5** | Critical Bug Fix | Medium (security) | 1-2 weeks |
| **Phase 2** | Meal Plan Sync + Recipe Search | High (touches many screens) | 2-3 weeks |
| **Phase 2.5** | Real-Time Sync Fix | Medium | 1-2 weeks |
| **Phase 3** | UI Optimization + Design System | Low-Medium | 2-3 weeks |
| **Phase 4** | Full App Visual Redesign | Medium (scope management) | 4-8 weeks |
| **Phase 5** | Multi-Language + AI Translation | Medium | 3-4 weeks |
| **Phase 6** | Advanced Features | Low | Ongoing |

---

## Phase 1: Common Ingredients Library

### Goal
Expand common ingredient suggestions from 145 to ~500 items with backend storage and multi-language support.

### Scope

#### Backend
1. **New table: `common_ingredients`**
   - `id` (serial PK)
   - `categoryKey` (varchar 32) - e.g., `vegetables`, `fruits`
   - `defaultUnitKey` (varchar 32) - e.g., `piece`, `pack`
   - `nameYue` (varchar 128) - Cantonese/HK name
   - `nameZh` (varchar 128) - Traditional Chinese
   - `nameEn` (varchar 128) - English
   - `nameFil` (varchar 128) - Filipino (optional, placeholder for now)
   - `nameId` (varchar 128) - Indonesian (optional, placeholder for now)
   - `isActive` (boolean, default true)
   - `sortOrder` (integer, default 0)
   - `createdAt`, `updatedAt` (timestamps)

2. **New column: `shopping_items.common_ingredient_id`** (optional integer, no FK constraint)

3. **DB functions** (`server/db.ts`):
   - `getCommonIngredients()` - return all active items
   - `searchCommonIngredients(query, limit)` - ILIKE search across all language fields

4. **New router: `server/routers/commonIngredient.ts`**
   - `list` query (protectedProcedure) - returns all active ingredients for frontend cache
   - Response includes `lastModified` timestamp for cache invalidation

5. **Register in `server/routers.ts`:**
   ```ts
   commonIngredient: commonIngredientRouter
   ```

6. **Seed data:**
   - `drizzle/seeds/common-ingredients.json` - ~500 items
   - `scripts/seed-common-ingredients.ts` - idempotent insert script
   - Validate seed JSON before insertion

#### Frontend
1. **Replace `lib/commonIngredients.ts`:**
   - Remove hardcoded `COMMON_INGREDIENTS` array
   - Keep type definitions
   - Add local filter helper using cached data

2. **Update `app/(main)/shopping.tsx`:**
   - Use `trpc.commonIngredient.list.useQuery` with `staleTime: 24h` to cache full list
   - `nameSuggestions` filters from local cache (no per-keystroke API call)
   - On suggestion select: fill name/category/unit AND send `commonIngredientId`
   - Update `DEFAULT_CATEGORIES`, `CATEGORY_EMOJI`, `CATEGORY_COLORS` for new categories

3. **Offline fallback:**
   - Keep ~30 most common items hardcoded as fallback
   - Only used when cache is empty (first launch + no network)

4. **Search across languages:**
   - Local filter searches `nameYue` + `nameZh` + `nameEn` (+ `nameFil` + `nameId` if available)

#### Category System

| Key | zh-TW Label |
|-----|-------------|
| `vegetables` | 蔬菜 |
| `fruits` | 水果 |
| `meat` | 肉類 |
| `seafood` | 海鮮 |
| `dairy` | 蛋奶豆類 |
| `seasoning` | 調味料 |
| `dryGoods` | 乾貨 |
| `staple` | 主食 |
| `beverage` | 飲品 |
| `snacks` | 零食/甜品 |
| `household` | 日用品 |
| `cleaning` | 家居清潔 |
| `personal` | 個人護理 |
| `baby` | 嬰幼兒 |
| `pet` | 寵物用品 |
| `other` | 其他 |

#### Unit Keys
`piece`, `pack`, `bottle`, `can`, `box`, `catty`, `slice`, `bunch`, `pair`, `roll`, `cup`, `bag`, `clove`

#### Item Count Target (~500)

| Category | Count |
|----------|-------|
| vegetables | 60 |
| fruits | 40 |
| meat | 50 |
| seafood | 40 |
| dairy | 30 |
| seasoning | 45 |
| dryGoods | 50 |
| staple | 40 |
| beverage | 40 |
| snacks | 30 |
| household | 30 |
| cleaning | 25 |
| personal | 20 |
| baby | 15 |
| pet | 15 |
| **Total** | **~530** |

#### Data Quality Fixes
- Remove 2 empty `name` entries (seafood line 63, household line 169 in current file)
- Fix misclassified items (e.g., "雞蛋" currently in 蔬菜, should be dairy)
- Normalize units

#### Testing
- Migration succeeds
- Seed script inserts ~500 items
- Frontend add modal shows rich suggestions
- Selecting suggestion auto-fills name/category/unit
- `common_ingredient_id` saved to shopping item
- Offline fallback works when cache empty

#### Deployment
1. Test migration + seed locally first
2. Backup production DB
3. Deploy backend
4. Run `npm run db:push`
5. Run seed script
6. Deploy frontend

---

## Phase 1.5: Critical Bug Fix

### Goal
Fix security vulnerabilities and critical logic bugs before adding new features.

### Bug Fix List

#### 1. IDOR Security Fix (Critical)
**Problem:** All by-id mutations (shopping, mealPlan, pantry) don't verify the item belongs to `ctx.activeFamilyId`. Any authenticated user can modify any family's data by guessing IDs.

**Files:** `server/routers.ts` - `shopping.toggleBought`, `shopping.updateItem`, `shopping.approve`, `shopping.reject`, `shopping.delete`, `mealPlan.confirm`, `mealPlan.reject`, `mealPlan.delete`, `pantry.delete`, `pantry.toggleInStock`, `pantry.toggleLow`, `purchaseHistory.savePrice`

**Fix:** For every by-id mutation, fetch the row and verify `row.familyId === ctx.activeFamilyId` before acting. Use pattern from `customRecipe.ts` and `shopping.deleteMany`.

#### 2. Approval Logic Unification (Critical)
**Problem:** Shopping requires approval for helpers only; meal plan requires approval for members only. `approvalRequired` setting ignored by shopping.

**Files:** `server/routers.ts` - `shopping.add`, `shopping.addBatch`, `mealPlan.add`

**Fix:** Centralize: `needsApproval = (role === "helper" || role === "member") && familySettings.approvalRequired !== false`. Apply identically in all three.

#### 3. Owner Self-Removal Protection (Critical)
**Problem:** Owner can remove themselves or demote themselves, orphaning the family.

**Files:** `server/routers.ts` - `removeMember`, `updateMemberRole`

**Fix:**
- Reject when `input.userId === ctx.user.id` and target role is `owner`
- Add `transferOwnership` mutation (owner-only) that atomically swaps roles + updates `families.ownerId`
- Add `regenerateInviteCode` mutation (owner-only)

#### 4. Onboarding Loop Fix (High)
**Problem:** If user enters import flow from onboarding but cancels, onboarding flag is never set, causing a loop.

**Files:** `app/import.tsx`, `app/_layout.tsx`

**Fix:** Set onboarding-done flag when user enters import flow from onboarding (or set it in `guide` step unconditionally).

#### 5. No-Family Guard (High)
**Problem:** User with no family can reach main tabs; all queries error with no guided recovery.

**Files:** `app/_layout.tsx` AuthGuard

**Fix:** If logged-in + onboarded user has `families.length === 0`, route to `/family` or show full-screen "create or join kitchen" gate.

#### 6. savePrice / Undo History Leak (High)
**Problem:**
- `savePrice` records a `purchase_history` entry without a real purchase, inflating "常買商品" counts
- Undo (bought->active) does not delete the `purchase_history` row

**Files:** `server/routers.ts` - `shopping.savePrice`, `shopping.toggleBought`

**Fix:**
- `savePrice` should update `estimatedPrice`/`lastPrice` without inserting `purchase_history`
- On undo, delete most recent `purchase_history` row for that `shoppingItemId`

#### 7. Weekly Menu Role Check (Medium)
**Problem:** Uses platform admin (`user.role === "admin"`) instead of family owner/admin.

**Files:** `server/routers/weeklyMenu.ts`

**Fix:** Replace with `ctx.activeFamilyRole === "owner" || ctx.activeFamilyRole === "admin"`.

#### 8. Family Member Count (Medium)
**Problem:** `family.list` hardcodes `memberCount: 0`.

**Files:** `server/routers.ts` line 106

**Fix:** Compute actual count via `getFamilyMembers(f.family.id)`.

#### 9. Kitchen Settings isSelf Detection (Medium)
**Problem:** Compares member against family's `ownerId`, not current user's `id`.

**Files:** `app/kitchen-settings.tsx` line 194

**Fix:** `const isSelf = String(m.userId) === String(user?.id)` using `user` from `useAuth()`.

#### 10. switchFamily DB Sync (Medium)
**Problem:** `switchFamily` only writes AsyncStorage, never calls `family.setActive`. DB `isDefault` drifts.

**Files:** `hooks/useAuth.ts` `switchFamily`

**Fix:** Call `trpc.family.setActive.mutate({ familyId })` before AsyncStorage write.

#### 11. Family Members Unique Constraint (Medium)
**Problem:** No `UNIQUE(family_id, user_id)` on `family_members` table. Race condition on join creates duplicates.

**Fix:** Add unique constraint + use `ON CONFLICT DO NOTHING` in `addFamilyMember`.

#### 12. Removed Users Can Rejoin (Critical)
**Problem:** Invite codes never expire/rotate. Removed users can rejoin immediately.

**Fix:** Add `removedFamilyMembers` table (or banned flag). Reject `join` if user is on it. Add `regenerateInviteCode` mutation.

#### 13. `family.create` Multiple Default Families (Critical)
**Problem:** `addFamilyMember({ isDefault: true })` without clearing previous defaults.

**Files:** `server/routers.ts` lines 119-128

**Fix:** Call `setDefaultFamily(String(ctx.user.id), family.id)` before `addFamilyMember`.

#### 14. `updateMemberRole` / `removeMember` Cross-Family (Critical)
**Problem:** `input.familyId` not verified to equal `ctx.activeFamilyId`. Owner of family A can modify family B.

**Fix:** Require `input.familyId === ctx.activeFamilyId`.

#### 15. mealPlan.delete No Role Check (Critical)
**Problem:** Any member/helper can delete any meal plan.

**Files:** `server/routers.ts` lines 572-583

**Fix:** Add owner/admin role check, or allow proposer to delete own pending plan.

---

## Phase 2: Meal Plan Sync + Recipe Search

### Goal
Fix meal plan <-> shopping sync and scale recipe search to 1000+.

### 2A: Meal Plan Sync

#### Current Problem
All entry points use `autoAddIngredients: false` + manual IngredientPicker. This causes:
- Sync breaks if user skips/closes picker
- Delete/reject meal plan doesn't clean up shopping items properly
- confirm/reject don't update shopping items

#### Fix: Auto-Add + Post-Edit Model

**Backend changes (`server/routers.ts`):**
- `mealPlan.add`: Set `autoAddIngredients: true` by default
- `mealPlan.confirm`: If plan was pending, set associated shopping items to `active`
- `mealPlan.reject`: Delete associated unbought shopping items (same as delete)
- `mealPlan.delete`: Already removes unbought items by `recipeId + date` - verify this works

**Frontend changes (all entry points):**
- `app/recipe/[id].tsx`: Remove IngredientPickerModal from plan flow, use auto-add
- `app/(main)/planner.tsx`: Same
- `app/ai-chef.tsx`: Same, also fix batch date/mealType hardcode (B4)
- `app/(main)/index.tsx`: Same
- `app/weekly-menu.tsx`: Same

**Post-add UX:**
- Show toast: "已加入排餐，N 項食材已加入購物清單 [查看]"
- User can go to shopping list and swipe-remove unneeded items
- Optional: Show editable bottom sheet with pre-selected items (but items are already added even if sheet closed)

**AI Chef specific fixes:**
- Unify shopping picker (single vs batch use same exact-match logic)
- Fix duplicate save guard (hash by name + ingredients, not just URL)
- Fix `aiNextSteps` (extraction pass strips `---next-steps---`)
- Add date picker to 3餸1湯 batch flow

### 2B: Recipe Search

#### Current Problem
- Frontend loads 200 official + 200 user recipes, filters locally in `useMemo`
- Won't scale to 1000+ recipes
- Search is client-side scoring algorithm

#### Fix: Backend Search + Infinite Scroll

**Backend (`server/routers/recipes.ts`):**
- New procedure: `recipes.search`
  - Input: `{ query, category, tag, cookTimeMax, limit, offset }`
  - Searches across `official_recipes` + `custom_recipes` (family-scoped)
  - Uses ILIKE on name, description, tags, ingredient names
  - Add Postgres index: `CREATE INDEX ON official_recipes USING gin(to_tsvector('chinese', name))`
- Update `listOfficial` and `listUser` to support `search` parameter (already partially exists)

**Frontend (`app/(main)/index.tsx`):**
- Replace `useMemo` local filter with `useInfiniteQuery`
- Each page: 20 recipes
- Search input: debounce 300ms
- Scroll to bottom: auto-load next page
- Category/tag filter: passed to backend query
- Recipe library = official + imported + custom (combined search)

---

## Phase 2.5: Real-Time Sync Fix

### Goal
Make family members see each other's changes with minimal delay.

### Approach: Polling + Push Notification (No SSE)

#### Polling Changes

| Screen | Current | New |
|--------|---------|-----|
| Shopping (`shopping.list`) | 15s | 8s |
| Meal Plan (`mealPlan.listByDateRange`) | No polling | 8s |
| Family info (`family.get`) | No polling | 30s |
| Pantry | No polling | Hidden, skip |

#### Push Notification Fix

**Problem:** `usePushNotifications.ts` is a stub. Never calls `getExpoPushTokenAsync` or `family.registerPushToken`. All push notifications are no-ops.

**Fix:**
1. Implement `usePushNotifications` using `expo-notifications`
2. Call `getExpoPushTokenAsync` on app launch (after permission)
3. Call `trpc.family.registerPushToken.mutate({ token, platform })`
4. Re-register when `activeFamilyId` changes

**Push notification targets (fix existing logic):**

| Event | Push Who |
|-------|----------|
| Helper/Member adds meal plan (pending) | Owner/Admin only |
| Meal plan confirmed/updated | All family members |
| Shopping item proposed (pending) | Owner/Admin only |
| Shopping item approved/rejected | Proposer only (not all members) |

**Fix:** Use `getPushTokensByUserIds([item.proposedByUserId])` for approval notifications instead of `getPushTokensByFamily`.

#### User Notification Settings

Add to Settings page:
```
通知設定
[x] 排餐更新通知
[x] 購物提議通知
[x] 購物清單更新通知
同步頻率：[標準(8秒)] [省電(30秒)] [關閉]
```

#### AI Chef Streaming
- Wire `streamAIChefChat` (already exists in backend) to tRPC streaming procedure
- Frontend: token-by-token rendering instead of wait-for-full-response

---

## Phase 3: UI Optimization + Design System

### Goal
Fix specific UX issues + establish design system foundation.

### 3A: Specific UX Fixes

1. **Suggestion dropdown layout**
   - Add `ScrollView` or absolute positioning
   - Don't push form fields down when suggestions appear
   - Max height 200px with internal scroll

2. **Show "由誰加入" (who added)**
   - Display `proposedByName` on pending shopping items
   - Display `boughtByName` on bought items (already exists)

3. **AddBatch success toast**
   - Replace `Alert.alert` with toast: "N 項食材已加入購物清單"
   - Create shared `Toast` component

4. **Shopping bought list unification**
   - Merge footer + modal into single consistent view
   - Both support: undo (checkbox), delete, re-add ("再買"), price edit
   - Sort by `boughtAt` DESC (latest first)
   - Modal respects active filters
   - Fix category progress (include bought items in count)
   - Add link to `/purchase-history` from shopping page

5. **Android price input**
   - When marking bought on Android, show inline price input (not iOS-only `Alert.prompt`)
   - Allow editing price on already-bought items

6. **Shopping list clear bought**
   - Add selective clear (by category, older-than-X-days)
   - Add confirmation noting items remain in purchase history

### 3B: Design System

#### Color Tokens (update `constants/design.ts`)
```ts
Colors = {
  primary: '#013E77',       // 深海藍 - main color, buttons, headers
  primaryLight: '#1A5A9A',
  primaryMuted: 'rgba(1, 62, 119, 0.08)',
  accent: '#F5A823',        // 暖金橙 - CTA, highlights, pending status
  accentLight: '#FFBE4D',
  accentMuted: 'rgba(245, 168, 35, 0.12)',
  background: '#FAFAF8',    // 米白
  surface: '#FFFFFF',       // 卡片
  divider: '#F0F2F5',       // 淺灰
  textPrimary: '#333D4B',   // 深灰
  textSecondary: '#8A94A6', // 次要文字
  textTertiary: '#B0BAC9',
  border: '#EBEBEB',
  // Status colors (functional, not brand)
  statusActive: '#013E77',  // navy for active/待採購
  statusPending: '#F5A823', // copper for pending/待確認
  statusBought: '#8A94A6',  // gray for bought/已買
}
// NO teal, NO coral
```

#### Typography
- Use system fonts: `fontEn: 'System'`, `fontZh: 'System'`
- iOS: PingFang TC (system), Android: Noto Sans TC (system)
- No custom font loading

#### Shared UI Components (P0 first)

| Priority | Component | Used In |
|----------|-----------|---------|
| P0 | `Button` (primary/secondary/text) | Every screen |
| P0 | `Card` (with shadow, rounded) | Recipe cards, settings, modals |
| P0 | `Header` (back + title + actions) | All stack screens |
| P1 | `Input` / `SearchInput` | Search, login, settings |
| P1 | `Chip` / `Tag` | Categories, tags, status badges |
| P1 | `BottomSheet` | Modal shell unification |
| P2 | `EmptyState` | Empty lists |
| P2 | `LoadingState` | Loading spinners |
| P2 | `Badge` | Notification counts, status |
| P2 | `Toast` | Success/error feedback |

#### Dead Code Removal (grep confirm first)
- `app/styles/theme.ts` - broken font references
- `app/styles/typography.ts` - broken font references
- `app/styles/colors.ts` - duplicate of design.ts
- `app/components/Icon.tsx` - duplicate of `src/components/icons/index.tsx`
- `app/screens/RecipeDetailScreen.tsx` - unused duplicate of `app/recipe/[id].tsx`

### 3C: Other Fixes in This Phase
- Fix `kitchen-settings.tsx` admin UI vs backend role check mismatch
- Fix `family.tsx` invite code sharing for non-active families
- Fix `family.tsx` tap card doesn't switch family
- Add KitchenSwitcher to main tab headers
- Fix onboarding terminology (統一 "廚房" / "家庭")
- Remove dev "重置 App 資料" button from production
- Fix "忘記密碼" dead button (implement or remove)

---

## Phase 4: Full App Visual Redesign

### Goal
Apply design visual language to ALL screens + add Home tab + reorganize profile page. **Do not change any functionality.**

### Design Source
User provided a design mockup showing: login, home, recipe library, recipe detail, meal planner, shopping list. The mockup establishes the **visual language** (colors, cards, shadows, spacing, icons). Screens not in the mockup will follow the same design system.

### What to Adopt from Mockup
1. Visual language: colors, fonts, cards, shadows, icons
2. Advantages: hierarchy, whitespace, simplicity
3. New Home tab

### What NOT to Change
- Any functionality, logic, state, API calls
- Only swap StyleSheet / components, not business logic

### 4A: New Home Tab

**New file: `app/(main)/home.tsx`**

Content (based on mockup):
- Greeting: "晚安，[用戶名]" from `useAuth()`
- Notification badge
- Banner: "今晚食乜餸？" (links to today's meal plan or AI chef)
- Quick actions: Import recipe, Meal plan, Shopping list, AI chef
- Recent browsing recipes (from `recipeEvents.trending` or last viewed)

**Tab layout update (`app/(main)/_layout.tsx`):**
```
Tab order: Home -> Recipe Library -> Planner -> Shopping -> Profile
```

**Rename `more.tsx` to `profile.tsx`** (grep all navigations to `/(main)/more` first)

### 4B: Profile Page Reorganization

**Convert from 12-item colorful grid to grouped list:**

```
Profile
[Avatar] [Name] [Email]

--- 規劃工具 ---
AI 食譜助手          ->
晚餐推薦            ->

--- 食譜 ---
新增食譜            ->
分類管理            ->

--- 資料 ---
採購紀錄            ->
街市指南            ->

--- 設定 ---
家庭管理            ->
廚房設定            ->
設定                ->

--- 管理 (admin only) ---
管理員面板          ->

登出
```

- Hide: Pantry ("家中儲備"), Restock ("智能補貨")
- Admin panel: `user?.role === "admin"` only
- Logout: simple row, no warning alert, navy/gray style (not red)
- Icons: unified navy/copper style, no rainbow colors

### 4C: Screen Redesign (3 Batches)

#### Batch 1: Main flow (highest traffic)
- Home (new)
- Shopping (`shopping.tsx`)
- Recipe Library (`index.tsx`)
- Planner (`planner.tsx`)
- Profile (`profile.tsx`)

#### Batch 2: Common screens
- Login (`login.tsx`)
- Recipe Detail (`recipe/[id].tsx`)
- AI Chef (`ai-chef.tsx`)
- Import (`import.tsx`)
- Weekly Menu (`weekly-menu.tsx`)

#### Batch 3: Settings & secondary
- Settings (`settings.tsx`)
- Family Management (`family.tsx`)
- Kitchen Settings (`kitchen-settings.tsx`)
- Category Manager (`category-manager.tsx`)
- Markets (`markets.tsx`)
- Purchase History (`purchase-history.tsx`)
- Admin Panel (`admin.tsx`)
- Recipe Editor (`recipe-editor.tsx`)
- Onboarding (`onboarding.tsx`)
- Paywall Modal (`PaywallModal.tsx`)
- All shared modals

### 4D: Design Application Rules
- Replace local `BRAND = "#013E77"` constants with theme imports (one screen at a time)
- Replace inline styles with shared components where possible
- Unify modal/bottom sheet styling
- Add `KeyboardAvoidingView` to all input modals
- Standardize loading/empty/error states
- Do NOT mass-replace colors in one commit - do per screen

### 4E: Recipe Library Layout (match mockup)
- Search bar at top (unified `SearchInput` component)
- Category chips below (unified `Chip` component, navy/copper style)
- 2-column grid recipe cards (unified `RecipeCard` component)
- Recipe card: image/category placeholder + name + cook time + difficulty + favorite heart
- Backend search + infinite scroll (from Phase 2)

---

## Phase 5: Multi-Language + AI Translation

### Prerequisite
App is stable, all features working, ready for public release.

### 5A: UI Internationalization
- Move all hardcoded Chinese UI text to `locales/*.json`
- Use `useTranslation().t()` in all screens
- Fill locale files for: `zh-TW`, `en`, `fil`, `id`
- Add language selector in Settings
- Categories and units use i18n keys

### 5B: Common Ingredient Multi-Language
- Already stored in DB with `nameYue/Zh/En/Fil/Id` (Phase 1)
- API returns localized name based on user's `locale`
- Shopping items with `common_ingredient_id` display in viewer's language

### 5C: User Content AI Translation
- Backend `translate` procedure: `{ text, targetLang }` -> `{ translatedText }`
- Uses existing AI infrastructure (OpenAI / Google Translate)
- Translation cost: ~$0.001 per request

**Translation UI:**
- Shopping item not matching common ingredient: [翻譯] button next to item name
- Recipe notes: [翻譯] button below note
- Translation result cached (add `translatedName` / `translatedNote` column or temp cache)
- Can be premium feature

**Scenario:**
```
Helper (Filipino) types "Itlog"
  -> Suggestion: "雞蛋 (Egg)" [common ingredient match]
  -> Helper selects -> binds common_ingredient_id
  -> Employer views shopping list -> sees "雞蛋" (employer's language)
  -> Helper views -> sees "Itlog" or "Egg" (helper's language)

Helper types "Toyo" (not in common ingredients)
  -> No suggestion, stored as "Toyo"
  -> Employer sees "Toyo" with [翻譯] button
  -> Taps -> AI translates -> "豉油"
  -> Cached for next time
```

### 5D: AI Chef Multi-Language
- Make recipe parsing language-aware
- Update `EXTRACTION_PROMPT` and `SYSTEM_PROMPT` to support user's locale
- Frontend regex fallback: add English/Filipino patterns

---

## Phase 6: Advanced Features

### Potential Features (prioritized)

| Feature | Value | Effort |
|---------|-------|--------|
| Smart "今晚食乜" suggestions | Based on history + pantry + weather | Medium |
| Cooking mode (steps + timer + voice) | Hands-free cooking | Medium |
| Auto restock predictions | Based on purchase frequency | Medium |
| Purchase history spending summary | Weekly/monthly totals, date range filter | Low |
| Recipe rating after cooking | Better recommendations | Low |
| Weekly meal plan templates | One-tap fill week | Low |
| Share recipe to WhatsApp | Common HK family behavior | Low |
| Pantry import from bought items | Close shopping <-> pantry loop | Low |
| Family dietary profile | Persistent "唔食" list (pork/beef/seafood/nuts) | Low |
| Weather-aware suggestions | Hot day = light meals, cold day = soups | Low |
| Cost estimate per meal | Cross-reference priceWatch | Medium |
| Server-side AI conversation sync | Backup conversations across devices | Medium |

---

## 12. Critical Bugs Found

### Security (Critical)

| # | Bug | Location | Phase |
|---|-----|----------|-------|
| S1 | IDOR: any user can modify any family's data by guessing IDs | `routers.ts` all by-id mutations | 1.5 |
| S2 | `removeMember`/`updateMemberRole` accept arbitrary familyId | `routers.ts:170-188` | 1.5 |
| S3 | `mealPlan.delete` has no role check | `routers.ts:572-583` | 1.5 |
| S4 | AI Chef SSE endpoint unauthenticated | `server/index.ts:52-81` | 2.5 |
| S5 | Removed users can rejoin (invite code never expires) | `routers.ts:130-153` | 1.5 |

### Logic (Critical)

| # | Bug | Location | Phase |
|---|-----|----------|-------|
| L1 | Approval logic inconsistent between shopping and meal plan | `routers.ts` | 1.5 |
| L2 | Owner can self-remove, orphaning family | `routers.ts:182-188` | 1.5 |
| L3 | `family.create` creates multiple default families | `routers.ts:119-128` | 1.5 |
| L4 | No `UNIQUE(family_id, user_id)` -> duplicate membership on race | schema | 1.5 |
| L5 | `savePrice` records false purchase history | `routers.ts:709-735` | 1.5 |
| L6 | Undo bought doesn't delete purchase history | `routers.ts:357-381` | 1.5 |

### Sync (Critical)

| # | Bug | Location | Phase |
|---|-----|----------|-------|
| Y1 | `broadcastToFamily` is a no-op stub | `sseSync.ts` | 2.5 |
| Y2 | Push notifications never registered (stub) | `usePushNotifications.ts` | 2.5 |
| Y3 | Meal plan has no polling (no real-time sync) | `planner.tsx:96` | 2.5 |
| Y4 | `shopping.updateItem` has no broadcast call | `routers.ts:382-396` | 2.5 |
| Y5 | `pantryRouter` has no broadcast calls | `routers.ts:586-679` | 2.5 (pantry hidden) |

### UX (High)

| # | Bug | Location | Phase |
|---|-----|----------|-------|
| U1 | No-family user can reach main tabs, queries error | `_layout.tsx` | 1.5 |
| U2 | Onboarding import loop on cancel | `import.tsx` / `_layout.tsx` | 1.5 |
| U3 | Android can't input price after buying | `shopping.tsx:451-471` | 3 |
| U4 | Bought list: two inconsistent views | `shopping.tsx` | 3 |
| U5 | Bought list unsorted (latest not on top) | `shopping.tsx` | 3 |
| U6 | Category progress always shows 0/Y | `shopping.tsx:649,665` | 3 |
| U7 | `family.list` memberCount hardcoded 0 | `routers.ts:106` | 1.5 |
| U8 | KitchenSwitcher not on main tabs | `(main)/_layout.tsx` | 3 |
| U9 | `switchFamily` doesn't sync DB isDefault | `useAuth.ts` | 1.5 |
| U10 | `kitchen-settings.tsx` isSelf detection wrong | `kitchen-settings.tsx:194` | 1.5 |
| U11 | Onboarding "返回登入" actually logs out | `onboarding.tsx:127-132` | 4 |
| U12 | "忘記密碼" button has no handler | `login.tsx:284-288` | 3 |
| U13 | Dev "重置 App 資料" in production | `login.tsx:354` | 3 |
| U14 | Terminology: "廚房" vs "家庭" inconsistent | onboarding vs rest | 4 |
| U15 | Admin panel visible to all users | `more.tsx:103-110` | 4 |
| U16 | `weeklyMenu` role check uses platform admin | `weeklyMenu.ts` | 1.5 |

### AI Chef (Medium)

| # | Bug | Location | Phase |
|---|-----|----------|-------|
| A1 | Backend streaming exists but never wired | `aiRecipe.ts:616` | 2.5 |
| A2 | `aiNextSteps` silently broken by extraction | `ai-chef.tsx:125` / `aiRecipe.ts:420` | 2.5 |
| A3 | Duplicate AI recipe saves not guarded | `recipes.ts:1191` | 2 |
| A4 | Batch 3餸1湯 hardcodes today/dinner | `ai-chef.tsx:1020-1022` | 2 |
| A5 | Two different shopping picker logic | `ai-chef.tsx:1057` vs `IngredientPickerModal.tsx:12` | 2 |
| A6 | Images lost on reload (base64 stripped) | `ai-chef.tsx:619-621` | 4 |
| A7 | AI tool path bypasses approval gate | `aiRecipe.ts:226-276` | 1.5 |

---

## 13. UI Redesign Guidelines

### Core Rule
> **UI redesign must NOT reduce or delete any existing functionality.**

### Process
1. **Feature Inventory:** Before changing any screen, list all existing features
2. **Parallel Implementation:** Build new UI alongside old, switch after testing
3. **Feature Parity Checklist:** After redesign, verify every feature still works
4. **Dead Code Removal:** Grep confirm unused before deleting, requires approval

### Testing Per Screen
- All buttons, gestures, modals work
- Edge cases: empty state, loading, error, permission restrictions
- Backend interactions unchanged
- No functionality removed

### Documentation
- `AGENTS.md`: Short reference to UI rules
- `UI-REDESIGN-GUIDELINES.md`: Detailed operational rules

---

## 14. Design System

### Color Palette
```
Primary:    #013E77  (深海藍 - main brand color)
Accent:     #F5A823  (暖金橙 - CTA, highlights)
Background: #FAFAF8  (米白 - page background)
Surface:    #FFFFFF  (白色 - cards)
Divider:    #F0F2F5  (淺灰 - separators)
Text Primary:   #333D4B  (深灰)
Text Secondary: #8A94A6  (次要文字)

Status Active:  #013E77  (navy - 待採購)
Status Pending: #F5A823  (copper - 待確認)
Status Bought:  #8A94A6  (gray - 已買)

NO teal (#00BBA9)
NO coral (#FF6B6B)
```

### Typography
```
Font: System (iOS: PingFang TC, Android: Noto Sans TC)
Sizes: xs=11, sm=13, base=15, md=17, lg=19, xl=22, xxl=26, xxxl=32
Weights: regular=400, medium=500, semibold=600, bold=700
```

### Spacing (8pt grid)
```
xs=4, sm=8, md=12, base=16, lg=20, xl=24, xxl=32, xxxl=40
```

### Radius
```
sm=8, md=12, lg=16, xl=20, xxl=24, full=999
```

### Shadow
```
card:    { opacity: 0.07, radius: 8, elevation: 3 }
medium:  { opacity: 0.10, radius: 12, elevation: 6 }
strong:  { opacity: 0.12, radius: 20, elevation: 10 }
```

### Icon Style
- Line icons (Ionicons or custom SVG)
- Consistent stroke weight
- Navy or copper colored, not rainbow

### Logo
- PNG format only
- Brand: 和諧食譜 Kindcipe
- Tagline: 自己的食譜筆記 - 一家人的味道

---

## 15. Database Schema Changes

### Phase 1: New Table + Column

```sql
-- New table
CREATE TABLE common_ingredients (
  id SERIAL PRIMARY KEY,
  category_key VARCHAR(32) NOT NULL,
  default_unit_key VARCHAR(32),
  name_yue VARCHAR(128) NOT NULL,
  name_zh VARCHAR(128) NOT NULL,
  name_en VARCHAR(128) NOT NULL,
  name_fil VARCHAR(128),
  name_id VARCHAR(128),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- New column
ALTER TABLE shopping_items ADD COLUMN common_ingredient_id INTEGER;
```

### Phase 1.5: Constraints + Security Tables

```sql
-- Unique constraint on family_members
ALTER TABLE family_members ADD UNIQUE (family_id, user_id);

-- Removed members table (for invite code ban)
CREATE TABLE removed_family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  removed_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Phase 2: Recipe Search Index

```sql
CREATE INDEX idx_official_recipes_name_trgm ON official_recipes USING gin(to_tsvector('chinese', name));
CREATE INDEX idx_custom_recipes_name_trgm ON custom_recipes USING gin(to_tsvector('chinese', name));
```

---

## Execution Checklist

### Before Starting Any Phase
- [ ] Read this document completely
- [ ] Confirm current phase with user
- [ ] Create feature inventory for affected screens
- [ ] Plan branch: `git checkout -b phase-N`

### After Each Phase
- [ ] Test all affected screens manually
- [ ] Verify feature parity (nothing removed)
- [ ] Run typecheck: `npx tsc --noEmit`
- [ ] Commit with descriptive message
- [ ] Get user approval before next phase

### Backend Deployment
1. Test locally first
2. Backup production DB
3. Deploy backend to Railway
4. Run migrations: `npm run db:push`
5. Run seed scripts if needed
6. Verify production

### Frontend Deployment
1. Test on simulator (iOS + Android)
2. Test on physical device if possible
3. Verify all critical user flows
4. Build and submit

---

## File Reference

### Key Frontend Files
| File | Purpose | Lines |
|------|---------|-------|
| `app/(main)/shopping.tsx` | Shopping list + add modal | 2,439 |
| `app/ai-chef.tsx` | AI Chef chat | 1,887 |
| `app/recipe/[id].tsx` | Recipe detail | 1,841 |
| `app/import.tsx` | Recipe import | 1,671 |
| `app/(main)/planner.tsx` | Meal planner | 1,032 |
| `app/(main)/index.tsx` | Recipe library | 834 |
| `app/(main)/more.tsx` | More menu (-> profile) | 304 |
| `hooks/useAuth.ts` | Auth + family management | 108 |
| `lib/commonIngredients.ts` | Common ingredient list | 176 |
| `lib/trpc.ts` | tRPC client setup | 71 |
| `lib/i18n.ts` | i18n setup | 53 |
| `constants/design.ts` | Design tokens (underused) | 161 |

### Key Backend Files
| File | Purpose | Lines |
|------|---------|-------|
| `server/routers.ts` | Main tRPC router (shopping, mealPlan, pantry, family) | 911 |
| `server/db.ts` | All DB access functions | 991 |
| `drizzle/schema.ts` | DB schema | 322 |
| `server/routers/recipes.ts` | Recipe CRUD + search | ~1600 |
| `server/routers/aiRecipe.ts` | AI Chef backend | 662 |
| `server/routers/priceWatch.ts` | Price comparison | 204 |
| `server/_core/trpc.ts` | tRPC setup (protected/public/admin) | 45 |
| `server/_core/context.ts` | Request context (auth, family) | ~80 |
| `server/_core/sseSync.ts` | SSE stub (no-op) | 6 |
| `drizzle.config.ts` | Drizzle config | 11 |

---

_This document is the single source of truth for the Kindcipe project plan. All phases, decisions, and bug fixes are documented here. Any model or developer should read this before starting work._
