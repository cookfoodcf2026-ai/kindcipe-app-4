# Kindcipe App v10 — Manus Testing Release

## What Changed

- Cleaned `.env`, `.DS_Store`, and `._*` metadata
- Fixed the Detox biometric catch warning
- Added core testing guidance
- Added App Store compliance checklist
- Added Manus testing brief
- `npm run ci-gate` now passes on core files

## Important Notes

- This build is intended for **real user testing** with Manus.
- Use the core 10 scenarios first.
- If any P0/P1 appears, stop and report it immediately.

## Test Files

- `CORE_10_SCENARIOS.md`
- `APP_STORE_CHECKLIST.md`
- `MANUS_TESTING_BRIEF.md`

## Verification

```bash
npm run ci-gate
```

Expected:
- npm ci passes
- TypeScript passes
- ESLint passes with zero warnings on core files

## Next Step

Run the core 10 scenarios on Manus and collect bug reports before broadening to the full 100-scenario sweep.
