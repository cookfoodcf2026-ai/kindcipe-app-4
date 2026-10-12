# 🚀 Kindcipe 公眾上架 Checklist

> 標記：👤 = 你（人手）· 🤖 = 工程 · ⏱ = 需時
> 「Go / No-Go」：任何 🔴 未清 → **No-Go**。
> 定價單一真相：**`TIER_SPEC.md`**（早鳥 HK$30/月、HK$288/年；正價 HK$38/月、HK$365/年）。

---

## 🔴 階段 0 — 收錢（最緊急）

### Stripe 切 Live（**只 Web** — iOS 用 IAP、Android 用 Play Billing）
- [ ] 👤 去 Stripe Dashboard → **切換到 Live mode**（右上角 Test/Live toggle）
- [ ] 👤 Live 建 **Product + Price**：月費 HK$30、年費 HK$288（早鳥價；正價 HK$38 / HK$365，見 `TIER_SPEC.md`）→ 攞 **live price IDs**（`price_...`）
- [ ] 👤 Live 攞 **`sk_live_...`** secret key
- [ ] 👤 Live 加 **Webhook endpoint**（見下方逐步）→ 攞 **`whsec_...`**
- [ ] 👤 Live 開 **Customer Portal**（Settings → Billing → Customer portal）
- [ ] 👤 改 Railway env（見下方）
- [ ] 🤖 驗證 `billing.status` → `configured: true`；webhook 收 `200`
- [ ] 👤 用**真卡**試一單 → 確認家庭變 Pro → 退款測試單

### iOS — Apple IAP（唯一合法方式；App Store 3.1.1）
- [ ] 🤖 裝 `react-native-iap`（`npm install --save-exact`）+ 需要 **EAS dev build**（唔可以 Expo Go）
- [ ] 🤖 `lib/purchase.ts`：`initIAP` / `getProducts` / `purchaseSubscription`（攞 **signed transaction JWS**）→ `subscription.verifyIap`；`IAP_LIVE = true`
- [ ] 🤖 `restorePurchases()` → `getAvailablePurchases()` → verifyIap
- [ ] 👤 App Store Connect → **Subscriptions** → 建月/年產品（product ID：`kindcipe_monthly_30` / `kindcipe_yearly_288`）→ **提交審批**
- [ ] 👤 填 IAP 本地化（價格、描述）
- [ ] 👤 Sandbox 帳號測試（購買 / 恢復 / 取消）
- [ ] 🤖 後端已支援 Apple JWS 驗證（`_core/appleIap.ts`）✅；confirm `APPLE_BUNDLE_ID=com.kindcipe.app`

### Android — Google Play Billing（**取代 Stripe**）
- [ ] 🤖 裝 `react-native-iap`；`lib/purchase.ts` 將 `isStripeSupported` 改為**只 `web`**（移除 `android`）；Android 走 Play Billing（攞 `purchaseToken`）
- [ ] 🤖 後端**新增** `_core/googlePlayIap.ts`：用 Google Play Developer API 驗 `purchaseToken`（service account JSON）
- [ ] 🤖 擴充 `subscription.verifyIap` 支援 Play（`transactionId = play_<hash>`）+ **acknowledge 購買**（3 日內唔 acknowledge 會被退款）
- [ ] 🤖 `VALID_PRODUCTS` 加 Play product IDs（例如 `kindcipe_monthly` / `kindcipe_yearly`）
- [ ] 👤 Play Console → 建訂閱產品 + 上傳 service account 權限 + 內部測試
- [ ] 👤 Railway env：`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`、`GOOGLE_PLAY_PACKAGE_NAME=com.kindcipe.app`
- [ ] ⚠️ 確認**移除 Android 嘅 Stripe**（否則違反 Google Play 政策）

### ⚠️ 關鍵 flag
- [x] 👤 Railway **`BETA_ALL_PAID=false`** ← ✅ 已設（2026-10-12）；唔改 = 所有人免費 Pro，收唔到錢

---

## 🟠 階段 1 — 商店審批必備

### 法律頁
- [ ] 👤 寫 **服務條款** → `kindcipe.com/terms/`
- [ ] 👤 核對 **私隱政策** `kindcipe.com/privacy/` 對齊實際收集（Apple/Google/email、AI、analytics、Stripe、push）
- [ ] 👤 核對 **支援頁** `kindcipe.com/support/`

### App Store Connect / Play Console
- [ ] 👤 **App Privacy 問卷**（Apple）
- [ ] 👤 **Data Safety**（Google Play）
- [ ] 👤 **Age rating** 問卷
- [ ] 👤 **Screenshots** + **App 預覽**
- [ ] 👤 **描述 / 關鍵字 / 類別**
- [ ] ✅ **Export compliance**（`ITSAppUsesNonExemptEncryption=false`）
- [ ] ✅ **Account deletion**（in-app）
- [ ] ✅ **Sign in with Apple**

---

## 🟠 階段 2 — 監控 / 營運

- [ ] 🤖 設 **前端 Sentry DSN**（`EXPO_PUBLIC_SENTRY_DSN`，現時空白）
- [ ] 👤 **Uptime 監控**（`/health` + webapp）+ 告警
- [ ] 👤 Supabase **PITR 備份** + 試 restore
- [ ] 👤 **Resend domain 驗證**：`kindcipe.com` SPF / DKIM / DMARC
- [ ] 👤 **Push 憑證**：APNs key + FCM
- [ ] 🤖 **DB migrations 入 CI**
- [ ] 👤 **Stripe / Railway / Cloudflare / Apple 帳戶開 2FA**

---

## 🟡 階段 3 — 安全加固

- [ ] 🤖 **CSP**（Cloudflare `_headers`）
- [ ] 🤖 Backend `app.disable("x-powered-by")`
- [ ] 👤 Cloudflare **HSTS**
- [ ] 🤖 **Session 撤銷 + 縮短 token**（1 年 → 7 天 + refresh）
- [ ] 🤖 **`mergeAccounts` 清 source email** + `getUserByEmail` 加 ORDER BY
- [ ] 🤖 清 orphan `8bc8505d` 嘅 email
- [ ] 🤖 移除 `verifySession` 嘅 `name` 非空檢查
- [ ] 🤖 **依賴漏洞**（57 個）逐個檢視（要驗 native build）
- [ ] 🤖 **AI 成本持久化**（`llm_usage` 表 + per-user cap）

---

## 🟡 階段 4 — 合規

- [ ] 🤖 **GDPR 資料匯出**（`auth.exportData`）
- [ ] 🤖 **Cookie consent**（web banner）
- [ ] ✅ Analytics consent
- [ ] 🤖 **AI 內容 disclaimer**
- [ ] 👤 **資料保留政策**文件

---

## 🟢 階段 5 — 工程衛生

- [ ] 🤖 **`dist/` 搬去 CI build**
- [ ] 🤖 統一部署路徑（Live == Cloudflare；`kindcipe.com` = `kindcipe-site`，`app.kindcipe.com` = 呢個 repo）
- [ ] 🤖 pre-commit hook 可移植性（`prepare` script）
- [ ] 🤖 API `health` 加深度檢查（DB ping）

---

## 🟢 階段 6 — 上線前 QA

- [ ] 👤 **iOS 真機**：登入（Apple/Google/email）、AI Chef、匯入、分享、IAP
- [ ] 👤 **Android 真機**：同上 + Stripe
- [ ] 👤 **Web**（Safari/Chrome，手機+桌面）：Apple/Google 登入、Stripe
- [ ] 👤 **多語言**（zh-TW/en/fil/id）
- [ ] 👤 **離線 / 弱網**
- [ ] 👤 **新用戶 onboarding** 全流程
- [ ] 👤 **付款 → Pro 生效 → 取消 → 失效** 全流程
- [ ] 🤖 Detox E2E 綠

---

# 💳 Stripe 切 Live — Step by Step

> 目標：由 `sk_test`（測試）切去 `sk_live`（真實收款）。
> 後端整合：`server/_core/stripe.ts`、`server/routers/billing.ts`、`server/_core/stripeWebhook.ts`

## 前置條件
- Stripe 帳戶已完成 **業務驗證（KYC）**，可以切 Live（Dashboard 右上角可切 Test ↔ Live）
- 有一個**真實銀行戶口**（收款用）

## 步驟

### 1. 切到 Live mode
- 登入 `dashboard.stripe.com`
- 右上角 **Test mode** toggle → **關閉**（即進入 Live）

### 2. 建 Product + Price（Live）
- **Products** → **Add product**
  - 名：`Kindcipe Pro`
  - 建兩個 **recurring price**：
    - 月費：HK$30 / month → **記低 `price_...`**
    - 年費：HK$288 / year → **記低 `price_...`**
- ⚠️ Live 同 Test 嘅 price ID **唔同**，要重新攞。

### 3. 攞 Live Secret Key
- **Developers → API keys**
- 複製 **Secret key**：`sk_live_...`（**唔好** commit / 貼落 chat）

### 4. 加 Live Webhook
- **Developers → Webhooks → Add endpoint**
- Endpoint URL：
  ```
  https://kindcipe-backend-production.up.railway.app/api/stripe/webhook
  ```
- 監聽事件（**必須**呢三個）：
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- 建立後 → 複製 **Signing secret**：`whsec_...`

### 5. 開 Customer Portal（Live）
- **Settings → Billing → Customer portal → Activate**
- 否則 app 內「管理訂閱」掣會壞（`createPortalSession` 會失敗）

### 6. 更新 Railway env
- Railway → `kindcipe-backend` → **Variables**，改：
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_PRICE_MONTHLY=price_...（Live 月）
  STRIPE_PRICE_YEARLY=price_...（Live 年）
  STRIPE_WEBHOOK_SECRET=whsec_...（Live）
  STRIPE_SUCCESS_URL=https://app.kindcipe.com/settings?billing=success
  STRIPE_CANCEL_URL=https://app.kindcipe.com/settings?billing=cancel
  BETA_ALL_PAID=false
  ```
- 儲存 → Railway 會自動重新部署

### 7. 驗證
```bash
# 1. health
curl https://kindcipe-backend-production.up.railway.app/health

# 2. webhook 存在（Stripe 會 POST，亂 send 應回 400 = secret 生效）
curl -X POST https://kindcipe-backend-production.up.railway.app/api/stripe/webhook -d '{}'
```
- App 內：`billing.status` 應回 `configured: true`

### 8. 真卡測試
- Web/Android → 升級 → Stripe Checkout → 用**真卡**付 HK$30
- 確認：
  - 家庭 `isPaid` / Pro 生效
  - `stripe_subscriptions` 有 `status: active`
  - Stripe Dashboard → Payments 見到交易
- 完成後 **退款** 測試單（Stripe Dashboard → 該 payment → Refund）

### 9. 取消流程測試
- App → 設定 → 管理訂閱 → Stripe Portal → 取消
- 確認 webhook `customer.subscription.deleted` → Pro 失效

## ⚠️ 注意
- **Live 同 Test 完全獨立**：customer / price / webhook secret 都唔共用
- `BETA_ALL_PAID=false` 前，所有人當 Pro，睇唔到升級掣
- iOS **唔用 Stripe**（用 Apple IAP，App Store 3.1.1）；Stripe 只保留 **Web**
- Android 由 Stripe **改為 Google Play Billing**（Play 政策要求，同 Apple 一樣）
- `stripe_subscriptions` 表會記 `pending` → webhook 後轉 `active`

---

# 📊 Go / No-Go

| 條件 | 現況 |
|------|:---:|
| `BETA_ALL_PAID=false` | ✅ 已 |
| Stripe `sk_live`（Web） | 🔴 未 |
| **iOS IAP 接通**（前端 + 審批） | 🔴 未（`IAP_LIVE=false`）|
| **Android Play Billing 接通** | 🔴 未（後端 Play 驗證未做）|
| 服務條款 | 🔴 冇 |
| 私隱政策 | ✅ 有 |
| 帳戶刪除 | ✅ 有 |
| 前端 Sentry | 🔴 空白 |
| DB 備份 | ❓ |
| 2FA（關鍵帳戶） | ❓ |
