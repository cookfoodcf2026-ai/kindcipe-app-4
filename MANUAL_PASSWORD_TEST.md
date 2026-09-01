# Manual Password Test

1. Open `login` and tap `忘記密碼？`
2. Submit a real email address
3. Confirm the reset email arrives
4. Open the `kindcipe://reset-password?token=...` link on device
5. Set a new password and confirm you can log in with it

## Also verify
- `設定` > `改密碼` works for logged-in users
- Old session is invalid after password change
- Admin login still works after password changes
