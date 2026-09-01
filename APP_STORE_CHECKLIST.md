# App Store Compliance Checklist

## Build and Stability
- App launches cleanly on fresh install
- No crash on login, logout, AI Chef, shopping, meal plan, pantry
- No infinite loading state
- All critical actions complete within reasonable timeout

## Privacy and Data
- `Privacy Policy` URL is live
- Data collection and sharing are documented
- Any analytics / crash reporting is disclosed
- Secrets are not shipped in `.env`

## Sign-in Rules
- If third-party sign-in exists, Apple Sign In requirements are reviewed
- Login/logout flows are consistent
- Password reset flow works

## UI / Content
- No broken layout on iPhone sizes
- No placeholder text in production screens
- All text is localized or intentionally English
- Error messages are user-friendly

## E2E / Device Behavior
- Biometric prompt does not block users
- Deep links resolve correctly
- App survives background/foreground transitions
- App works after cold restart

## Store Assets
- Correct app name, icon, screenshots, description
- Version and build number updated
- Release notes are ready

## Review Risks
- Missing privacy disclosures
- Broken login flow
- Crash on first launch
- AI Chef returns unusable or empty result
- Any screen with obvious placeholder or debug output
