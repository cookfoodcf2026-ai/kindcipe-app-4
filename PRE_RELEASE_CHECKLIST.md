# Pre-Release Checklist

## Backend
- [ ] `RESEND_API_KEY` configured
- [ ] `RESEND_FROM_EMAIL` verified
- [ ] `DATABASE_URL` configured
- [ ] `JWT_SECRET` configured
- [ ] Migration `0015_password_reset_flow.sql` applied
- [ ] Backend redeployed successfully

## App
- [ ] `EXPO_PUBLIC_API_URL` points to production backend
- [ ] `EXPO_PUBLIC_SENTRY_DSN` set if used
- [ ] App rebuilt / OTA updated

## Password Reset
- [ ] `忘記密碼` screen opens from login
- [ ] Reset email is received
- [ ] `kindcipe://reset-password?...` link opens the app
- [ ] New password can be saved
- [ ] Old session is invalidated after password change
- [ ] New password can log in successfully

## Admin
- [ ] Admin account can log in via `/login?mode=admin`
- [ ] `/admin` route is accessible only to admin users
