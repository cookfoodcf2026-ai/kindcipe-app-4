# P0 Quick Checklist

## Before testing
- Confirm Build URL: `9f25ed52-94ef-4397-b7bd-b29dc23e622f`
- Install latest IPA or TestFlight build
- Use test account:
  - Email: `ui_test_20260825_100436@kindcipe.com`
  - Password: `UiTest1234!`

## Scenario 1: Email Login
- Open app
- Wait for Login screen
- Enter email/password
- Tap `Login`
- Expect: loading state, then home screen

## Scenario 2: Cold Relaunch
- Force close app
- Reopen app
- Expect: stay logged in

## Scenario 3: Logout
- Logout from app
- Force close and reopen
- Expect: back to Login screen

## Stop conditions
- Crash
- White screen
- Login blocked
- Token not persisted on relaunch
- Any secure storage or auth error

## Report back
- Pass/Fail for each scenario
- Screenshot of login and home
- Any console or device error
