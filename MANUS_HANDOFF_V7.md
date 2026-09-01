# Kindcipe App v7 — Production Release

## Delivery Summary

**Version:** v7 (Production-Ready Release)  
**Date:** 2026-08-24  
**Package:** `Kindcipe-for-Manus-v7.tar.gz` (581KB)

---

## v7 Production Fixes

### 1. Security & Cleanup ✅

**v6 Issue:** `.env` file accidentally included, macOS metadata files present  
**v7 Fix:**

- ✅ `.env` removed (only `.env.example` included)
- ✅ `.DS_Store` macOS metadata files excluded
- ✅ `._*` macOS metadata files excluded
- ✅ ESLint warning fixed (`catch (e)` → `catch (_e)`)

### 2. Standalone TypeScript ✅

**v6 Issue:** `lib/router-types.ts` depended on sibling `../kindcipe-backend` repo  
**v7 Fix:**

- ✅ Complete API contract types defined in `lib/router-types.ts`
- ✅ `tsconfig.json` removed backend path aliases
- ✅ Frontend can now typecheck independently
- ✅ No external sibling repo required for `tsc --noEmit`

### 3. CI Gate Script ✅

**New:** `scripts/ci-gate.sh` for automated release validation:

```bash
npm run ci-gate
```

Runs:
1. `npm ci --legacy-peer-deps --ignore-scripts`
2. `npx tsc --noEmit --project tsconfig.json`
3. `npx eslint` (all key files)

### 4. Delivery Format ✅

- ✅ Full directory structure preserved (`app/`, `lib/`, `src/`, `e2e/`)
- ✅ `package-lock.json` (npm ci compatible)
- ✅ `tsconfig.json` (standalone, no backend dependency)
- ✅ `detox.config.js` (Detox E2E config)
- ✅ `e2e/jest.config.js` (Jest E2E config)

---

## Detox E2E Test Fixes

### beforeEach Order (FIXED)

**v5 Issue:** `reloadReactNative()` called before `launchApp()`  
**v7 Fix:**

```javascript
beforeEach(async () => {
  await device.launchApp({ newInstance: true, delete: true });
  await device.reloadReactNative();
});
```

### Biometric Prompt Handling (FIXED)

**v5 Issue:** Unconditional 5-second wait causes test failure  
**v7 Fix:** Optional handling with ESLint-compliant catch:

```javascript
try {
  await waitFor(element(by.id('biometric-skip')))
    .toBeVisible()
    .withTimeout(2000);
  await element(by.id('biometric-skip')).tap();
} catch (_e) {
  // Biometric prompt may not appear depending on simulator settings
}
```

---

## Package Contents

### Core Files

```
./package.json
./package-lock.json
./tsconfig.json
./detox.config.js
./.detoxrc.js
./app.json
./eas.json
./eslint.config.js
./metro.config.js
./babel.config.js
./scripts/ci-gate.sh
```

### Source Directories

```
./app/              # Expo Router screens
./lib/              # Shared utilities (trpc, router-types, etc.)
./src/              # Components & lib
./e2e/              # Detox E2E tests
./hooks/            # React hooks
./constants/        # App constants
./locales/          # i18n translations
./assets/           # Icons & logo (recipe images excluded)
./data/             # Static data
```

### Excluded (Can be regenerated)

- `node_modules/` — Install via `npm ci`
- `.git/` — Git history
- `ios/` — Native iOS code (run `npx expo run:ios` to regenerate)
- `ios/build/` — Build artifacts
- `ios/Pods/` — CocoaPods dependencies
- `assets/recipes/` — Recipe images (588MB, excluded for package size)
- `.expo/` — Expo cache
- `dist/` — Build output

---

## Verification Commands

### Quick CI Gate

```bash
# Extract package
mkdir -p kindcipe-v7
tar -xzf Kindcipe-for-Manus-v7.tar.gz -C kindcipe-v7
cd kindcipe-v7

# Run all CI gates
npm run ci-gate
```

### Manual Verification

```bash
# 1. Install dependencies
npm ci --legacy-peer-deps --ignore-scripts

# 2. TypeScript check (standalone, no backend required)
npx tsc --noEmit --project tsconfig.json

# 3. ESLint check (zero warnings expected)
npx eslint \
  'app/(tabs)/index.tsx' \
  'app/(tabs)/planner.tsx' \
  'app/(tabs)/shopping.tsx' \
  app/pantry.tsx \
  app/shopping-templates.tsx \
  app/restock.tsx \
  app/purchase-history.tsx \
  'app/recipe/[id].tsx' \
  app/ai-chef.tsx \
  app/login.tsx \
  src/components/RecipeCard.tsx \
  src/components/Toast.tsx \
  e2e/ai-chef.smoke.test.js

# 4. Detox E2E (macOS with Xcode required)
cd ios && pod install && cd ..
npm run e2e:build:ios
E2E_EMAIL='test@example.com' E2E_PASSWORD='password' npm run e2e:test:ios
```

---

## API Contract Types

**v7 Key Change:** `lib/router-types.ts` now contains complete API contract definitions:

```typescript
// No longer depends on sibling backend repo
export type { AppRouter } from "./router-types";

// All router types defined locally:
// - AuthRouter, UsersRouter, RecipesRouter
// - MealPlansRouter, ShoppingListsRouter, PantryRouter
// - PurchasesRouter, AiChefRouter
```

**For Production:** Consider publishing these types as a shared `@kindcipe/contracts` package or generating them from backend schema via CI.

---

## Known Limitations

1. **Recipe Images:** `assets/recipes/` excluded (588MB). Can be regenerated via AI or downloaded from production.

2. **iOS Native Code:** `ios/` folder excluded. Regenerate with:
   ```bash
   npx expo run:ios
   ```

3. **E2E Testing:** Requires macOS with Xcode and iOS Simulator. Test account credentials needed for login flow.

4. **Backend Runtime:** App requires a running backend API for full functionality. See `.env.example` for configuration.

---

## File Structure

```
kindcipe-v7/
├── app/                  # Expo Router screens
│   ├── (tabs)/          # Tab navigator screens
│   ├── recipe/          # Dynamic recipe routes
│   ├── _layout.tsx      # Root layout
│   ├── ai-chef.tsx      # AI Chef screen
│   ├── pantry.tsx       # Pantry management
│   └── ...
├── lib/                  # Shared utilities
│   ├── trpc.ts          # tRPC client
│   ├── router-types.ts  # API contract types (standalone)
│   └── ...
├── src/                  # Components & lib
│   ├── components/      # Shared UI components
│   └── lib/             # Shared utilities
├── e2e/                  # Detox E2E tests
│   ├── ai-chef.smoke.test.js
│   └── jest.config.js
├── hooks/                # React hooks
├── scripts/              # CI & build scripts
│   └── ci-gate.sh       # Release validation script
├── assets/               # Static assets
│   ├── icons/           # SVG icons
│   └── *.png            # App icons & splash
├── package.json
├── package-lock.json
├── tsconfig.json
├── detox.config.js
└── ...
```

---

## Production Checklist

Before deploying to production:

- [ ] Run `npm run ci-gate` (must pass with zero errors/warnings)
- [ ] Verify no `.env` or secrets in package
- [ ] Verify no `.DS_Store` or `._*` metadata in package
- [ ] Run Detox E2E on macOS with test account
- [ ] Review `npm audit` for critical vulnerabilities
- [ ] Configure backend API endpoint in `.env`
- [ ] Set up error tracking (Sentry)
- [ ] Configure app signing & provisioning profiles
- [ ] Test TestFlight build on real devices
- [ ] Prepare App Store metadata & screenshots

---

## Next Steps for Manus

1. **Extract & Verify**
   ```bash
   mkdir -p kindcipe-v7
   tar -xzf Kindcipe-for-Manus-v7.tar.gz -C kindcipe-v7
   cd kindcipe-v7
   npm run ci-gate
   ```

2. **TypeScript Verification**
   ```bash
   npx tsc --noEmit
   # Should pass without backend sibling repo
   ```

3. **ESLint Verification**
   ```bash
   npx eslint 'app/(tabs)/index.tsx' 'app/(tabs)/planner.tsx' app/pantry.tsx app/shopping-templates.tsx 'app/recipe/[id].tsx' src/components/RecipeCard.tsx src/components/Toast.tsx e2e/ai-chef.smoke.test.js
   # Expected: 0 errors, 0 warnings
   ```

4. **E2E Testing** (macOS only)
   ```bash
   npm run e2e:build:ios
   E2E_EMAIL='...' E2E_PASSWORD='...' npm run e2e:test:ios
   ```

---

## Contact

For questions or issues with this delivery, refer to the `AGENTS.md` file for validation commands and project structure.

**Release Status:** ✅ Production-Ready (pending E2E verification on macOS)
