# 🚀 Kindcipe 公眾上架 Checklist

> 標記：👤 = 你（人手）· 🤖 = 工程 · ⏱ = 需時
> 「Go / No-Go」：任何 🔴 未清 → **No-Go**。
> 定價單一真相：**`TIER_SPEC.md`**（早鳥 HK$30/月、HK$288/年；正價 HK$38/月、HK$365/年）。
> 2026 改版詳情：**`HOME_REVAMP_PLAN.md`**；回滾：**`ROLLBACK_RUNBOOK.md`**。

---

## 🔒 2026 改版 — Launch Gate 新增（先做）

> 策略：**Launch 用 Legacy；新 UX 用上線後 OTA。**
> 上線前**唔碰 `app/(tabs)/index.tsx`**。

### P-1 備份（改任何 code 前）
- [ ] 兩個 repo tag `pre-home-activation` + push
- [ ] 新鮮 DB dump（用 `DATABASE_PUBLIC_URL`）
- [ ] `pg_restore -l` 驗證 dump
- [ ] Scratch DB restore + counts 核對
- [ ] 本機 + 雲端備份
- [ ] 記錄 Cloudflare deployment ID / OTA group / EAS build
- [ ] Web rollback 演練

### CI（PR gate）
- [ ] `.github/workflows/ci.yml`
- [ ] PR：`tsc --noEmit` + `npm run ci-gate`
- [ ] 手動 / 每晚：Detox smoke

### OTA Code Signing（**必須喺 Launch build 前**）
- [ ] 產生 code signing key/cert
- [ ] `app.json` 加 `updates.codeSigningCertificate` / `codeSigningMetadata`
- [ ] 證書存密碼管理器
- [ ] 原因：public key 會 embed 喺 binary；Launch build 冇做，之後 OTA 簽名唔會被驗證

### Staged Rollout
- [ ] Play：5% → 20% → 50% → 100%（每階段 24–48 小時）
- [ ] App Store：Phased Release（7 日）
- [ ] OTA / Flag：內部 → 10% → 50% → 100%

### Release Health Gate
- [ ] Sentry release + dist
- [ ] Source map 上載
- [ ] Crash-free ≥ 99.5% 才擴量
- [ ] Alert：error rate 突升 / 新 issue

### 平台付款政策（重要）
- [ ] Web = Stripe
- [ ] Android = **Google Play Billing**（唔可以用 Stripe）
- [ ] iOS = Apple IAP
- [x] ✅ 已移除 Android Stripe（`lib/purchase.ts` 只限 web，2026-10-21）
- [ ] **Launch 暫時 native 免費 only**：iOS/Android 不顯示購買 CTA；C9T 試用碼仍可兌換，付款 CTA 開 web（待 IAP/Play Billing 接通）

---

## 🔴 階段 0 — 收錢（最緊急）

### Stripe 切 Live（**只 Web** — iOS 用 IAP、Android 用 Play Billing）
- [ ] 👤 去 Stripe Dashboard → **切換到 Live mode**（右上角 Test/Live toggle）
- [ ] 👤 Live 建 **Product `Kindcipe Pro` + 4 個 recurring Price**：
  - 正價月費 HK$38 → `STRIPE_PRICE_MONTHLY`
  - 正價年費 HK$365 → `STRIPE_PRICE_YEARLY`
  - 創始月費 HK$30 → `STRIPE_PRICE_MONTHLY_PROMO`
  - 創始年費 HK$288 → `STRIPE_PRICE_YEARLY_PROMO`
- [ ] 👤 Live 攞 **`sk_live_...`** secret key
- [ ] 👤 Live 加 **Webhook endpoint**（見下方逐步）→ 攞 **`whsec_...`**
- [ ] 👤 Live 開 **Customer Portal**（Settings → Billing → Customer portal）
- [ ] 👤 改 Railway env（見下方）
- [ ] 🤖 跑 `npm run db:migrate` 套用 pending migrations（**先做 DB backup**；唔好用 `db:push`，manual 0032–0042 未入 drizzle journal）
- [ ] 🤖 驗證 `billing.status` → `configured: true`、`promoEnabled: true`；webhook 收 `200`
- [ ] 👤 用**真卡**試一單 HK$30（創始）→ 確認家庭變 Pro / `price_tier=founding` → 退款測試單
- [ ] 👤 試 C9T trial → 7 日 Pro → claim window → 轉 Stripe trial（HK$0 today）

### iOS — Apple IAP（唯一合法方式；App Store 3.1.1）
- [ ] 🤖 裝 `react-native-iap`（`npm install --save-exact`）+ 需要 **EAS dev build**（唔可以 Expo Go）
- [ ] 🤖 `lib/purchase.ts`：`initIAP` / `getProducts` / `purchaseSubscription`（攞 **signed transaction JWS**）→ `subscription.verifyIap`；`IAP_LIVE = true`
- [ ] 🤖 `restorePurchases()` → `getAvailablePurchases()` → verifyIap
- [ ] 👤 App Store Connect → **Subscriptions** → 建月/年產品（product ID：`kindcipe_monthly_30` / `kindcipe_yearly_288`；價格 HK$38 / HK$365）→ **提交審批**
- [ ] 👤 填 IAP 本地化（價格、描述）
- [ ] 👤 Sandbox 帳號測試（購買 / 恢復 / 取消）
- [ ] 🤖 後端已支援 Apple JWS 驗證（`_core/appleIap.ts`）✅；confirm `APPLE_BUNDLE_ID=com.kindcipe.app`

### Android — Google Play Billing（**取代 Stripe**）
- [x] 🤖 `lib/purchase.ts`：`isStripeSupported` 改為**只 `web`**（已移除 `android`，2026-10-21）
- [ ] 🤖 裝 `react-native-iap`；Android 走 Play Billing（攞 `purchaseToken`）
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

- [x] 🤖 前端 Sentry DSN（`EXPO_PUBLIC_SENTRY_DSN`）— ✅ 已設；source map 待下次 EAS build
- [ ] 👤 **Uptime 監控**（`/health` + webapp）+ 告警
- [ ] 👤 **Railway Postgres 備份 + 試 restore**（見 P-1；Supabase 只作 fallback）
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

### 2. 建 Product + 4 個 Price（Live）
- **Products** → **Add product**
  - 名：`Kindcipe Pro`
  - 建四個 **recurring price**：
    - 正價月費：HK$38 / month → `STRIPE_PRICE_MONTHLY`
    - 正價年費：HK$365 / year → `STRIPE_PRICE_YEARLY`
    - 創始月費：HK$30 / month → `STRIPE_PRICE_MONTHLY_PROMO`
    - 創始年費：HK$288 / year → `STRIPE_PRICE_YEARLY_PROMO`
- ⚠️ Live 同 Test 嘅 price ID **唔同**，要重新攞。
- ⚠️ 唔好用 Coupon / Promotion Code 做創始價；創始價係獨立 recurring price，永久保留俾連續訂閱嘅首 100 個家庭。

### 3. 攞 Live Secret Key
- **Developers → API keys**
- 複製 **Secret key**：`sk_live_...`（**唔好** commit / 貼落 chat）

### 4. 加 Live Webhook
- **Developers → Webhooks → Add endpoint**
- Endpoint URL：
  ```
  https://kindcipe-backend-production.up.railway.app/api/stripe/webhook
  ```
- 監聽事件（**必須**）：
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
- 建立後 → 複製 **Signing secret**：`whsec_...`

### 5. 開 Customer Portal（Live）
- **Settings → Billing → Customer portal → Activate**
- 否則 app 內「管理訂閱」掣會壞（`createPortalSession` 會失敗）

### 6. 更新 Railway env
- Railway → `kindcipe-backend` → **Variables**，改：
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_PRICE_MONTHLY=price_...（正價 38）
  STRIPE_PRICE_YEARLY=price_...（正價 365）
  STRIPE_PRICE_MONTHLY_PROMO=price_...（創始 30）
  STRIPE_PRICE_YEARLY_PROMO=price_...（創始 288）
  STRIPE_WEBHOOK_SECRET=whsec_...（Live）
  STRIPE_SUCCESS_URL=https://app.kindcipe.com/settings?billing=success
  STRIPE_CANCEL_URL=https://app.kindcipe.com/settings?billing=cancel
  EARLYBIRD_PROMO_ACTIVE=true
  EARLYBIRD_CAP=100
  EARLYBIRD_WINDOW_DAYS=7
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
- Web → 升級 → Stripe Checkout → 用**真卡**付 HK$30（創始）
- 確認：
  - 家庭 `isPaid` / Pro 生效
  - `stripe_subscriptions` 有 `status: active`、`price_tier: founding`
  - `earlybird_redemptions` 由 `reserved` → `paid`
  - Stripe Dashboard → Payments 見到交易
- 完成後 **退款** 測試單（Stripe Dashboard → 該 payment → Refund）
- 另外試 C9T：兌換 → trial → claim window → Stripe trial（今日 HK$0）→ 到期自動扣款

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

# 🎁 創始會員 + C9T 試用

> 定價：**正價 HK$38/月 · HK$365/年**；**創始 HK$30/月 · HK$288/年**，首 100 個 held 家庭（`reserved + paid`）。
> 創始價用**獨立 recurring price**，唔用 Coupon；連續訂閱期間永久保留。取消後再訂 = 正價。

### Stripe（👤）
- [ ] 建 4 個 recurring price（正價 38/365、創始 30/288），填入 Railway env（見上）
- [ ] **唔好**再建舊文件提過嘅 EARLY_M / EARLY_Y Coupon；`STRIPE_COUPON_*` 已移除
- [ ] 確認 Customer Portal 可以取消 / 更新付款方式

### 後端 / env（🤖 + 👤）
- [x] ✅ `billing.previewCheckout` 由 server 決定 regular/founding 價、trial_end、charge today
- [x] ✅ `billing.createCheckoutSession` 只信 server；client 不能傳 price / promo code
- [x] ✅ `earlybird_redemptions` 追蹤 `reserved / paid / released`，容量 100
- [x] ✅ C9T 兌換 transaction + advisory lock；任何家庭成員可兌換
- [x] ✅ 自動 C9D 綁定家庭；client 唔會見到 / 不能提交
- [ ] 👤 Railway env：4 個 price IDs、`EARLYBIRD_PROMO_ACTIVE=true`、`EARLYBIRD_CAP=100`、`EARLYBIRD_WINDOW_DAYS=7`
- [x] ✅ `0041_earlybird_billing.sql` 已 apply（2026-10-21）
- [ ] 👤 Railway 憑證輪換後，先備份 DB，再跑 `npm run db:migrate`（`0042_billing_webhook_ordering.sql`）
- [x] ✅ 已產生首批 100 個 C9T（`~/kindcipe-promo/c9t-2026-10-21.csv`；如 DB 曾被存取，發放前重新產生）
- [ ] 🤖 7 日後用 `npm run promo:codes -- reconcile` 睇 held / paid，再決定補碼（總 held 上限 100）

### 規則（實作）
| 情境 | 結果 |
|---|---|
| C9T 兌換 | 7 日 Pro trial、免卡、不自動扣款 |
| 試用完 + 7 日內，剩餘 ≥48h | Stripe trial 到試用完結；今日 HK$0；創始價 |
| 試用完 + 7 日內，剩餘 <48h / 已完 | 即時收 HK$30 或 HK$288（清楚顯示） |
| 過咗 trialEnd + 7 日 | 正價 HK$38 / HK$365 |
| 100 個 held 滿 | 新客只能正價；已 trial 客 claim window 內仍可搶最後名額 |
| 創始客取消 | slot 永遠計 paid；再訂 = 正價 |
| 創始 trial 取消（未付款） | slot 釋放 |
| 任何家庭成員 | 可兌換 / 可 checkout |
| 管理 / 取消 | 只有 owner/admin |

# 📈 未來加價 Playbook

> 核心：**Stripe price 不可改** → 加價 = **建新 price**；現有訂閱**預設保留舊價**（grandfather）。

### 業界做法
| # | 模式 | 舊客加價 | 流失 | 法律 | 例子 |
|---|------|:---:|:---:|:---:|------|
| 1 | **Grandfather**（新客加、舊客保留）| ❌ | 極低 | 無 | 大量 SaaS |
| 2 | **通知式加價** | ✅ | 中 | 要通知 | Netflix / Spotify |
| 3 | 加**新 tier**（唔加舊 plan）| ❌ | 低 | 無 | Netflix Premium |
| 4 | Legacy Plan（舊客專屬）| ❌ | 低 | 無 | 多數 SaaS |
| 5 | 年度調整（T&C indexation）| ✅ | 低 | T&C 要寫 | 保險 / B2B |
| 6 | 加價 + 加功能（value-based）| ✅ | 中低 | 要通知 | 幾乎全部 |

### 加價 Runbook
- [ ] 👤 建新 price（加價後）→ 改 Railway env `STRIPE_PRICE_*` → **新客即用新價**
- [ ] 👤 舊客保留舊價（grandfather）→ **零 migrate**（最穩）
- [ ] （想舊客都加）提前 **60 天 email 通知** → 腳本 migrate（`subscriptions.update`）
- [ ] 🤖 更新 `lib/pricing.ts`（App 顯示新正價）
- [ ] 🤖（可選）`LAUNCH_CHECKLIST.md` 記錄新舊價對照

### 法律 / 平台
- 一般消費者法（US FTC / EU / HK）：提前 **30–60 天**通知 + 可取消
- **Apple / Google IAP**：有自己嘅加價同意流程（Apple 加價要客 opt-in）
- **Stripe（Web）**：**冇** consent flow → **你自己通知**

> 一句總結：**「新客即加、舊客慢加、永遠提前通知、永遠加功能合理化」**。
> 靜靜雞加價 = 大量退款 + 負評 + 違法。

---

# 📊 Go / No-Go

| 條件 | 現況 |
|------|:---:|
| `BETA_ALL_PAID=false` | ✅ 已 |
| `0041_earlybird_billing.sql` 已 apply | ✅ 已 |
| `0042_billing_webhook_ordering.sql` 已 apply | 🔴 未（等 Railway 憑證輪換） |
| Stripe `sk_live` + 4 個 Live price | 🔴 未 |
| **iOS IAP 接通**（前端 + 審批） | 🔴 未（`IAP_LIVE=false`）|
| **Android Play Billing 接通** | 🔴 未（後端 Play 驗證未做）|
| 服務條款 | 🔴 冇 |
| 私隱政策 | ✅ 有 |
| 帳戶刪除 | ✅ 有 |
| 前端 Sentry | ✅ 已設（source map 待 build） |
| DB 備份 | 🟡 P-1 待做 |
| OTA code signing | 🔴 未（Launch build 前必須） |
| CI PR gate | 🔴 未 |
| Staged rollout | 🔴 未設定 |
| 2FA（關鍵帳戶） | ❓ |

---

## 🖥️ Web（app.kindcipe.com）— 特別注意
- **部署係手動**：`npm run build:web` → `npx wrangler@4.86.0 deploy`（Worker `kindcipe-app`）。**push 唔會自動部署**（如需自動，喺 Cloudflare 接 Git build）。
- **SPA fallback 陷阱**：缺失 asset 會回 `index.html` 且被 `immutable` 快取 → 部署後**驗** `content-type: application/javascript`，唔對就 purge cache。
- **`Alert.alert` 喺 web 係 no-op** → 已加 `lib/webAlertShim.ts`（web 映射 window.confirm/alert）。
- **外部連結**（IG／帳戶）走 `app.json extra`（`instagramUrl` / `accountUrl`）。
- **Paywall 平台感知**：web 顯示方案 + server quote + Stripe CTA；native 暫時只顯示 C9T 試用碼 + 開 web 的 CTA（無 native 購買）。
- Web 直接訂閱需要 **Stripe Live**（見階段 0）。
- **C9T 試用碼**：IG DM 只發 `C9T-XXXXXXXX`；C9D 由 server 自動發出並綁定家庭，client 永遠唔會見到。Paywall 只接受 C9T。
- **唔再用 Stripe Promotion Code / Coupon**。創始價係獨立 recurring price；`billing.previewCheckout` 回傳 server 計算嘅 tier / amount / chargeToday / trialEnd。
- **Paywall 版面**：響應式（桌面兩欄）；trial active 顯示狀態，Stripe trial 顯示「管理訂閱」。
