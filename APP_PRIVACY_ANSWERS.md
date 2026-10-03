# App Privacy 問卷答案草稿（App Store Connect）

> 依 app 實際情況填寫。App Store Connect → App Privacy → Data Types。
> **原則：誠實申報。** 漏報會導致審核被拒或被下架。

## 背景（依 code 事實）
- 登入方式：Apple / Google / Email OTP。
- 收集：帳號 email、顯示名、食譜、排餐、購物清單、相片（匯入截圖）、AI 對話。
- 相片：**上傳到你後端/R2**（唔係第三方）。
- Analytics：**PostHog**（`us.i.posthog.com`）；只傳**內部 user id**（唔傳 email/名）。
- Crash：**Sentry**。

---

## 逐項填法

### Data Linked to You（與你關聯）
| Data Type | 收集？ | Purpose | 備註 |
|---|---|---|---|
| **Contact Info → Email Address** | ✅ | App 功能、帳號管理 | OTP / 登入 |
| **Contact Info → Name** | ✅ | App 功能 | 顯示名 |
| **User Content → Photos or Videos** | ✅ | App 功能 | 食譜截圖 |
| **User Content → Other User Content** | ✅ | App 功能 | 食譜、排餐、購物清單、AI 對話 |
| **Identifiers → User ID** | ✅ | App 功能、分析 | 內部 id |
| **Usage Data → Product Interaction** | ✅ | 分析 | PostHog 事件 |
| **Diagnostics → Crash Data** | ✅ | App 功能 | Sentry |
| **Diagnostics → Performance Data** | ⚠️ 選 | App 功能 | Sentry（如啟用 tracing）|

### Data NOT Linked to You
| Data Type | 收集？ | 備註 |
|---|---|---|
| Analytics（去識別）| ⚠️ | 視你 PostHog 設定；你只傳 user id（建議列為「Linked」較穩）|

### 明確回答「不收集」
- ❌ **Location（精確/粗略）**
- ❌ **Health & Fitness**
- ❌ **Financial Info**（IAP 由 Apple 處理，你唔收卡號）
- ❌ **Contacts**
- ❌ **Browsing History**
- ❌ **Search History**（如你冇存搜尋詞）
- ❌ **Sensitive Info**
- ❌ **Audio Data**（你 audio transcription 已 deferred）

---

## 關鍵「是/否」問題
| 問題 | 答案 |
|---|---|
| 是否用資料**追蹤**用戶跨其他 app/網站？ | **否**（你冇做 ad tracking）|
| 是否用第三方 SDK？ | 是（PostHog、Sentry；Apple/Google 登入）|
| 資料是否加密傳輸？ | 是（HTTPS）|
| 用戶可否要求刪除資料？ | 是（app 內 `deleteAccount`）|
| 用戶可否停用分析？ | 是（設定 → 「分享匿名使用數據」toggle）|

## 第三方處理者（Third-party processors）
| 服務 | 用途 | 收到咩 |
|---|---|---|
| **PostHog** | 產品分析 | 內部 user id、事件、非 PII traits（role/語言）|
| **Sentry** | 錯誤追蹤 | 錯誤堆疊、裝置型號（不含 email/名）|
| **Apple / Google** | 登入 | OAuth 身份驗證 |
| **Stripe** | 付款（web/Android）| 付款 session（Apple IAP 另計）|
| **Resend** | Email OTP | email 地址 |
| **Railway / R2** | 後端 / 圖片儲存 | 帳號資料、食譜圖片 |

> 呢啲要喺**隱私政策**講清楚（見 `DATA_COMPLIANCE.md`）。

---

## 隱私政策 URL
`https://kindcipe.com/privacy/`（已 live）

## 檢查
- [ ] Email / Name / Photos / User Content / User ID / Usage / Diagnostics 已勾
- [ ] 追蹤 = 否
- [ ] 第三方 SDK 已申報
- [ ] 隱私政策 URL 正確
