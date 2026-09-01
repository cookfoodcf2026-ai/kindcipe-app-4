# 📋 Action Plan - Social Login & Email Verification

**創建日期：** 2025-08-27  
**優先級：** P2 (測試完成後執行)  
**狀態：** ⏸️ 暫緩

---

## 🎯 目標

在應用上架/真實用戶測試前，完成以下配置：

1. ✅ Google Sign-In 配置
2. ✅ Apple Sign-In 配置
3. ✅ Email Verification 流程

---

## 📝 執行清單

### 階段 1：Google Sign-In（15 分鐘）

**文件：** `app.json`

**步驟：**
```bash
# 1. 修改 app.json - 加 URL Scheme
# 位置：ios.infoPlist.CFBundleURLTypes

# 2. 重啟 Expo 並 rebuild
npx expo start -c
npx expo run:ios  # 需要用 Custom Dev Client
```

**配置內容：**
```json
"ios": {
  "bundleIdentifier": "com.kindcipe.app",
  "infoPlist": {
    "CFBundleURLTypes": [
      {
        "CFBundleURLSchemes": ["com.googleusercontent.apps.690207937492-epsg13ch62s93cmav0nkfieeeoq6r3db"]
      }
    ]
  }
}
```

**測試：**
- [ ] iOS 模擬器/真機測試
- [ ] Google 登入流程正常
- [ ] 登入後成功跳轉回 app

---

### 階段 2：Apple Sign-In（30 分鐘）

**前置條件：**
- Apple Developer Account
- Apple ID 配置 "Sign in with Apple"

**步驟：**
```bash
# 1. Apple Developer Console 配置
# - 創建 App ID
# - 啟用 "Sign in with Apple"
# - 創建 Services ID

# 2. 修改 app.json - 加 Associated Domains (可選)

# 3. Rebuild
npx expo run:ios
```

**後端已經配置：**
- ✅ `APPLE_BUNDLE_ID = "com.kindcipe.app"` (已喺 `server/auth.ts`)
- ✅ Apple token verification 已經實現

**測試：**
- [ ] Apple 登入流程正常
- [ ] 成功獲取 email
- [ ] 登入後成功創建/返回用戶

---

### 階段 3：Email Verification（1-2 小時）

**後端修改：** `server/routers.ts` + 新文件

**步驟：**
```bash
# 1. 安裝 email service (推薦 Resend / SendGrid)
npm install resend

# 2. 加 environment variables
# RESEND_API_KEY=xxx
# EMAIL_FROM=noreply@kindcipe.com

# 3. 修改 emailRegister router
# - 生成 verification token
# - 發送 verification email
# - 用戶狀態設為 unverified

# 4. 加 /verify-email endpoint
# - 驗證 token
# - 更新用戶狀態為 verified

# 5. 前端加 verification 頁面
# - /verify-email 頁面
# - 處理 verification link
```

**需要修改的文件：**
- [ ] `server/routers.ts` - 修改 `emailRegister` + 加 `verifyEmail`
- [ ] `server/auth.ts` - 加 token 生成函數
- [ ] `.env` - 加 email service 配置
- [ ] `app/verify-email.tsx` - 新頁面
- [ ] `app/login.tsx` - 提示用戶驗證 email

**測試：**
- [ ] 註冊後收到 verification email
- [ ] 點擊 link 成功驗證
- [ ] 未驗證用戶受限（可選）

---

## 🚦 執行時機

| 階段 | 時機 | 原因 |
|------|------|------|
| **階段 1 (Google)** | 功能測試完成後 | 改善用戶體驗 |
| **階段 2 (Apple)** | 準備 iOS 上架前 | iOS 審核要求（如有第三方登入） |
| **階段 3 (Verification)** | 真實用戶測試前 | 防止假帳號/濫用 |

---

## ✅ 完成條件

- [ ] Google Sign-In 正常運作
- [ ] Apple Sign-In 正常運作
- [ ] Email Verification 流程完整
- [ ] 所有登入方式都可以成功註冊/登入
- [ ] 用戶資料正確同步到後端

---

## 📌 注意事項

1. **Google Client ID** 已經配置好，唔使改
2. **Apple Developer Account** 需要提前準備
3. **Email Service** 建議用 Resend（簡單過 SendGrid）
4. **Testing** 需要真機/模擬器，Expo Go 唔支持 Social Login

---

## 🔗 相關文件

- `app.json` - Google/Apple 配置
- `server/auth.ts` - Social Auth 邏輯
- `server/routers.ts` - Email registration
- `app/login.tsx` - 登入頁面

---

**下次執行前：** 確認功能測試完成，準備真實用戶測試/上架
