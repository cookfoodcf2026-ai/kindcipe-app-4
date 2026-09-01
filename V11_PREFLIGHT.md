# v11 Final Preflight Checklist

> Use this before delivering v11 to Manus for Mac testing.
> Last updated: 2026-08-24

---

## Code & Build
- [ ] `npx tsc --noEmit` passes
- [ ] `npm ci` succeeds (clean install)
- [ ] No `._*` metadata files in `src/` or `app/`
- [ ] `.env` not committed (only `.env.example`)
- [ ] `app.config.ts` has correct `scheme`, `bundleIdentifier`, `version`

---

## Static Checks (Already Done in v10)
- [ ] 10 core scenarios: code/selector alignment verified
- [ ] No P0/P1 issues found in static review
- [ ] CI gate passed (tsc + typecheck)

---

## Mac Test Readiness
- [ ] `MAC_TEST_RECORD.md` included in delivery
- [ ] `BUG_REPORT_TEMPLATE.md` included in delivery
- [ ] Test account credentials ready
- [ ] Backend endpoint confirmed (local or staging)
- [ ] iOS Simulator version confirmed (iOS 17/18)

---

## Packaging
- [ ] Metadata cleaned: `find . -name '._*' -delete`
- [ ] Zip created from clean directory
- [ ] Zip tested: extract → `npm ci` → `npx tsc --noEmit` passes
- [ ] Build number incremented (v11)

---

## Delivery
- [ ] Delivery note sent to Manus
- [ ] Expected turnaround time confirmed
- [ ] Bug report channel confirmed (Slack/Email/GitHub)

---

## Post-Test Actions
- [ ] Collect test records
- [ ] Triage any P0/P1 bugs
- [ ] Plan v12 fixes if needed

---

## Notes
- Delivery method: _______________
- Backend repo: `/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-backend`
- Test account: _______________
