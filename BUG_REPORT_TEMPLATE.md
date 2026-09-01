# P0/P1 Bug Report Template

Use this template to report critical bugs found during iOS testing.

---

## Bug ID
`P0-001` or `P1-001`

## Severity
- [ ] **P0** — Crash / Data Loss / Login Broken / App Unusable
- [ ] **P1** — Core Feature Broken (AI/Recipe/Meal Plan/Shopping List)

## Scenario
Which scenario failed: `Scenario #___`

## Steps to Reproduce
1. 
2. 
3. 

## Expected Result


## Actual Result


## Environment
- **Device:** iOS Simulator / Physical Device
- **iOS Version:** 
- **App Build:** 
- **Backend:** (local/remote)

## Evidence
- [ ] Screenshot attached
- [ ] Video attached
- [ ] Console log attached

## Console Log (if any)
```
Paste relevant error messages here
```

## Workaround (if any)


## Reporter
- **Name:** 
- **Date:** 

---

## P0/P1 Definition Reference

### P0 — Critical (Ship Blocker)
- App crash on launch or during core flow
- Login/Signup completely broken
- Data loss or corruption
- Security vulnerability
- App stuck in loading state >30s

### P1 — High (Should Fix Before App Store)
- AI Chef not generating recipes
- Recipe card not rendering
- Meal Plan / Shopping List broken
- Family sync broken
- Biometric auth loop

### P2 — Medium (Can Ship With Known Issue)
- Minor UI misalignment
- Non-critical feature glitch
- Edge case not handled

### P3 — Low (Backlog)
- Cosmetic issue
- Enhancement suggestion
- Nice-to-have feature
