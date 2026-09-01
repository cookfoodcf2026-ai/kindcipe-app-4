# Kindcipe App v6-clean — Manus Handoff

## Delivery Summary

**Version:** v6-clean (Security & Cleanup Release)  
**Date:** 2026-08-24  
**Package:** `Kindcipe-for-Manus-v6-clean.tar.gz` (586KB)

---

## v6-clean Fixes

### 1. Security & Cleanup (NEW)

**v6 Issue:** `.env` file accidentally included, macOS `._*` metadata files present  
**v6-clean Fix:**

- ✅ `.env` removed (only `.env.example` included)
- ✅ `._*` macOS metadata files excluded
- ✅ ESLint warning fixed (`catch (e)` → `catch (_e)`)

### 2. Delivery Format (RESOLVED)

**v5 Issue:** Flat file structure, missing critical config files  
**v6 Fix:** Full directory structure preserved with all essential files:

- ✅ `package-lock.json` (npm ci compatible)
- ✅ `tsconfig.json` (TypeScript config)
- ✅ `detox.config.js` (Detox E2E config)
- ✅ `app/`, `lib/`, `src/`, `e2e/` directories intact
- ✅ `e2e/jest.config.js` (Jest E2E config)

### 3. Detox E2E Test Fixes

#### beforeEach Order (FIXED)

**v5 Issue:** `reloadReactNative()` called before `launchApp()`  
**v6 Fix:** Corrected order in `e2e/ai-chef.smoke.test.js`:

```javascript
beforeEach(async () => {
  await device.launchApp({ newInstance: true, delete: true });
  await device.reloadReactNative();
});
```

#### Biometric Prompt Handling (FIXED)

**v5 Issue:** Unconditional 5-second wait causes test failure if prompt doesn't appear  
**v6 Fix:** Optional handling with try-catch (ESLint-compliant):

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
./assets/           # Icons & logo (recipe images excluded for size)
./data/             # Static data
```

### Excluded (Can be regenerated)

- `node_modules/` — Install via `npm ci`
- `.git/` — Git history
- `ios/` — Native iOS code (run `npx expo run:ios` to regenerate)
- `ios/build/` — Build artifacts
- `ios/Pods/` — CocoaPods dependencies (run `pod install` in ios/)
- `assets/recipes/` — Recipe images (588MB, excluded for package size)
- `.expo/` — Expo cache
- `dist/` — Build output
- Documentation files (funding applications, business plans, etc.)

---

## Verification Commands

Run these in order to verify the package:

```bash
# 1. Extract package (files extract to current directory, no subdirectory)
mkdir -p kindcipe-v6
tar -xzf Kindcipe-for-Manus-v6-clean.tar.gz -C kindcipe-v6
cd kindcipe-v6

# 2. Install dependencies
npm ci --legacy-peer-deps --ignore-scripts

# 3. TypeScript check
npx tsc --noEmit --project tsconfig.json

# 4. ESLint check (selected files)
npx eslint \
  'app/(tabs)/index.tsx' \
  'app/(tabs)/planner.tsx' \
  app/pantry.tsx \
  app/shopping-templates.tsx \
  'app/recipe/[id].tsx' \
  src/components/RecipeCard.tsx \
  src/components/Toast.tsx \
  e2e/ai-chef.smoke.test.js

# 5. Detox E2E (macOS with Xcode required)
cd ios && pod install && cd ..
npm run e2e:build:ios
E2E_EMAIL='test@example.com' E2E_PASSWORD='password' npm run e2e:test:ios
```

---

## Backend Dependency

**tRPC Router Types:** `lib/router-types.ts` exports types from sibling backend repo:

```typescript
export type { AppRouter } from "../../kindcipe-backend/server/routers";
```

To fully verify TypeScript types, the backend repo must be available at:
`../kindcipe-backend/`

Alternatively, mock the types for standalone frontend verification.

---

## Known Limitations

1. **Recipe Images:** `assets/recipes/` excluded (588MB). Can be regenerated via AI or downloaded from production.

2. **iOS Native Code:** `ios/` folder excluded. Regenerate with:
   ```bash
   npx expo run:ios
   ```

3. **Backend Types:** Full TypeScript verification requires backend sibling repo.

4. **E2E Testing:** Requires macOS with Xcode and iOS Simulator.

---

## File Structure

```
kindcipe-app-4/
├── app/                  # Expo Router screens
│   ├── (tabs)/          # Tab navigator screens
│   ├── recipe/          # Dynamic recipe routes
│   ├── _layout.tsx      # Root layout
│   ├── ai-chef.tsx      # AI Chef screen
│   ├── pantry.tsx       # Pantry management
│   └── ...
├── lib/                  # Shared utilities
│   ├── trpc.ts          # tRPC client
│   ├── router-types.ts  # Backend router types
│   └── ...
├── src/                  # Components & lib
│   ├── components/      # Shared UI components
│   └── lib/             # Shared utilities
├── e2e/                  # Detox E2E tests
│   ├── ai-chef.smoke.test.js
│   └── jest.config.js
├── hooks/                # React hooks
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

## Next Steps for Manus

1. **Extract & Install**
   ```bash
   mkdir -p kindcipe-v6
   tar -xzf Kindcipe-for-Manus-v6-clean.tar.gz -C kindcipe-v6
   cd kindcipe-v6
   npm ci --legacy-peer-deps --ignore-scripts
   ```

2. **TypeScript Verification**
   ```bash
   npx tsc --noEmit
   ```

3. **ESLint Verification**
   ```bash
   npx eslint 'app/(tabs)/index.tsx' 'app/(tabs)/planner.tsx' app/pantry.tsx app/shopping-templates.tsx 'app/recipe/[id].tsx' src/components/RecipeCard.tsx src/components/Toast.tsx e2e/ai-chef.smoke.test.js
   ```

4. **E2E Testing** (macOS only)
   ```bash
   npm run e2e:build:ios
   E2E_EMAIL='...' E2E_PASSWORD='...' npm run e2e:test:ios
   ```

---

## Contact

For questions or issues with this delivery, refer to the AGENTS.md file for validation commands and project structure.
