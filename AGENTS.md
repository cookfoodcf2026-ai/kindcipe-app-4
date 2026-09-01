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
- iOS / Android native runs: `npm run ios`, `npm run android`
- Typecheck: `npx tsc --noEmit --project tsconfig.json`
- Repo gate: `npm run ci-gate` (`npm ci --legacy-peer-deps --ignore-scripts` -> typecheck -> eslint on the fixed file list in `scripts/ci-gate.sh`)
- Env check: `npm run check:env`
- Detox iOS: `npm run e2e:build:ios` then `npm run e2e:test:ios`

## Dependency Rules
- Install packages with `npm install --save-exact <package>`.
- Back up `package-lock.json` before installing.
- Commit `package.json` and `package-lock.json` together.
- Never edit `package-lock.json` by hand.
