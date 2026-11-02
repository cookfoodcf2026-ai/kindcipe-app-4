# AGENTS.md — Kindcipe App

## What Matters
- Expo Router app; `app/_layout.tsx` is the real entrypoint and owns auth, onboarding, splash, and app-wide providers.
- Route screens live under `app/`; reusable UI lives in `src/components/`; app-local helpers live in `app/components/`; shared logic lives in `lib/`; hooks live in `hooks/`; utilities live in `src/lib/`.
- `@/*` maps to the repo root, not `src/`.
- `lib/trpc.ts` is the API client; it sends `Authorization: Bearer <token>` and `X-Family-Id` from AsyncStorage and defaults to the Railway backend unless `EXPO_PUBLIC_API_URL` is set.
- `.env.example` is the canonical env template. If `.env` changes, restart Metro with `npx expo start --clear`.
- `scripts/check-env.ts` must pass before production builds; it fails when `EXPO_PUBLIC_API_URL` looks like localhost or ngrok.

## Commands
- Dev server: `npm start` or `npx expo start`
- Web dev server: `npm run web`; static web build: `npm run build:web` (outputs `dist/`)
- iOS / Android native runs: `npm run ios`, `npm run android`
- Typecheck: `npx tsc --noEmit --project tsconfig.json`
- Repo gate: `npm run ci-gate` (`npm ci --legacy-peer-deps --ignore-scripts` -> typecheck -> eslint on the fixed file list in `scripts/ci-gate.sh`)
- Env check: `npm run check:env`
- Detox iOS: `npm run e2e:build:ios` then `npm run e2e:test:ios`

## Universal App (Native + Web)
- This is a **universal Expo app**: the same codebase ships iOS, Android and Web (`app.json` web bundler `metro`, output `single`). `npm run build:web` bundles the whole app for the browser.
- Platform branching lives in `lib/platform.ts` (`isWeb`, `getWebappUrl`), not scattered `Platform.OS` checks. `hooks/useBreakpoint.ts` drives responsive layout.
- `app/(tabs)/_layout.tsx` renders a **desktop sidebar** (>=1024px, web) or **bottom tabs** (mobile/native). Screens under `(tabs)/` render in both via `<Slot/>`.
- Web has no SecureStore/biometrics/IAP: `lib/auth.ts`, `lib/purchase.ts` already no-op them on web. Web login uses `lib/socialAuth.ts` (Google Identity Services + backend Apple web OAuth) and relies on the httpOnly session cookie.
- Backend must list web origins in `ALLOWED_ORIGINS` and (to share the cookie across subdomains) set `COOKIE_DOMAIN=.kindcipe.com`. CORS uses `credentials:true`.
- `public/_headers` + `public/_redirects` are for Cloudflare Pages static hosting (SPA fallback).

## Dependency Rules
- Install packages with `npm install --save-exact <package>`.
- Back up `package-lock.json` before installing.
- Commit `package.json` and `package-lock.json` together.
- Never edit `package-lock.json` by hand.

## 改動前必做：回歸影響分析（Regression Impact Analysis）

任何改動開工前，先答齊四條，並在交付時寫一段「影響分析」：

1. **touch 邊啲現有功能**：具體到 screen／endpoint（登入、deep link、匯入、AI Chef、扣 credit、付款、我的食譜）。
2. **有咩現有行為會改變**：預設答案係「有」，要主動證否。特別查：`null`／空陣列、舊 client 冇送新參數、flag OFF、cache 命中舊版、語言／時區、排序改變。
3. **最壞情況 + 點退**：rollback 方法（關 flag／revert／上一個 deployment）＋ 用戶會見到咩。
4. **驗證方式**：新 test **＋** 相關舊 test 全跑；UI 改動要逐個受影響 screen 睇。

未寫呢段嘅改動，一律當未完成。

## Repo 鎖（防止兩個 agent 撞）
改任何檔之前，先認領 repo 鎖：

```bash
LOCK=~/.hermes/scripts/kindcipe-lock.sh
$LOCK status
$LOCK claim <repo> <agent> "<做咩>"
# …改嘢、驗、push、deploy…
$LOCK release <repo> <agent>
```

- `<repo>`：kindcipe-backend / kindcipe-app-4 / kindcipe-site
- 鎖 90 分鐘自動過期；未 release 就離開，下一個 agent 會等或接手
- **同一時間一個 repo 只准一條線**；另一個 agent 想改就要等
- 狀態一律寫入 `~/Desktop/Kindcipe/manus/QUEUE.md`，唔好喺唔同 tab 各寫一份
