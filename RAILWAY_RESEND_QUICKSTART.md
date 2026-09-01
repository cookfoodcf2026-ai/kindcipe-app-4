# Quick Start

## Railway
Backend env:

```env
DATABASE_URL=...
JWT_SECRET=...
APP_ID=kindcipe
ALLOWED_ORIGINS=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Kindcipe <verified@yourdomain.com>
```

Run the backend migration so `password_reset_tokens` exists.

## Resend
- Verify sender domain
- Copy verified sender into `RESEND_FROM_EMAIL`
- Paste API key into `RESEND_API_KEY`

## Expo / EAS
```env
EXPO_PUBLIC_API_URL=https://kindcipe-backend-production.up.railway.app
```

If you use Sentry in release builds, also set `EXPO_PUBLIC_SENTRY_DSN`.

## Password Reset Test
1. Tap `忘記密碼`
2. Request reset email
3. Open `kindcipe://reset-password?token=...`
4. Set new password
5. Re-login with new password
