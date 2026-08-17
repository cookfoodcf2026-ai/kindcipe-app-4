# AGENTS.md — Kindcipe App (Expo SDK 54)

## Validation commands

```bash
# TypeScript typecheck (no ESLint config present in project)
npx tsc --noEmit --project tsconfig.json

# Start dev server
npm start          # or: npx expo start

# Run on device/emulator
npm run ios        # npx expo run:ios
npm run android    # npx expo run:android
```

## Environment

- Expo SDK 54, React Native 0.81.5 (New Arch)
- React 19, expo-router 6, tRPC 11
- TypeScript path alias: `@/*` → project root (`.`)
- Backend: sibling repo at `/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-backend`

## Conventions

- No ESLint config → rely on `tsc --noEmit` for static checks.
- New UI components live in `src/components/`.
- Shared hooks live in `hooks/`.
- Shared lib (non-UI) lives in `lib/`.
