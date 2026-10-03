# Kindcipe 上架前 Go / No-Go Checklist

> 目的：上架（App Store 提交）前，逐項確認 P0 全綠。
> 最後更新：2026-10-03
> 狀態：**NO-GO**（尚有多個 P0 未清）

---

## 0. 認證設定凍結（Freeze）— 防止再次漂移

**背景**：開發 webapp 期間曾改動 production Apple 認證設定（Services ID、Sign-in key），導致後端與 Apple 不一致。
**規則：上架前唔好再改呢啲 production 認證值。** 如要改，必須同步 Apple Console + Railway，並重測。

| 鍵 | 凍結值 | 位置 |
|---|---|---|
| `APPLE_SERVICES_ID` | `com.kindcipe.web` | Railway |
| `APPLE_KEY_ID` | `52GZ5Z59P5`（Apple Web Key）| Railway + Apple |
| `APPLE_TEAM_ID` | `WGBN9GJ4TL` | Railway + Apple |
| `APPLE_WEB_REDIRECT_URI` | `https://kindcipe-backend-production.up.railway.app/api/auth/apple/callback` | Railway + Apple Services ID |
| Apple Web Domain | `kindcipe-backend-production.up.railway.app` | Apple Services ID |
| Primary App ID | `com.kindcipe.app`（group 咗 Services ID）| Apple |
| `ALLOWED_ORIGINS` | `https://kindcipe.com,https://app.kindcipe.com` | Railway |
| `COOKIE_DOMAIN` | `.kindcipe.com` | Railway |
| iOS bundle | `com.kindcipe.app` | app.json |
| runtimeVersion | `1.0.0` | app.json |

| 後端 commit | `d9afa13` |
| 前端 commit | `be51029b` |

> ⚠️ 若另一 session 改咗上述任何值 → 上架前**必須重測 Apple / Google / Email 三種登入**。

---

## 1. Auth（登入）— P0

| # | 項目 | 狀態 | 備註 |
|---|---|---|---|
| A-1 | Email OTP 真收信 + 登入 | ✅ | 2026-10-03 收到碼並登入成功 |
| A-2 | Apple web/Android OAuth（`/web/start` → callback）| ✅ | `apple=success`；CORS 已修 |
| A-3 | Apple relay 偵測（`is_private_email` + `private.icloud.com`）| ✅ | 已部署 + 11/11 測試 |
| A-4 | 自助合併帳號 `auth.mergeAccount` | ✅ | 已部署 + 邏輯實測 |
| A-5 | Apple relay 軟提示 | ✅ | OTA `4934bdc8` |
| A-6 | 真機：iOS Apple 登入 | ⬜ | **未測** |
| A-7 | 真機：Android Apple 掣登入 | ⬜ | **未測** |
| A-8 | 真機：iOS ↔ Android 同一帳號（A2 `sub` 一致）| ⬜ | **未測** |
| A-9 | 真機：Google 登入 | ⬜ | 未測 |
| A-10 | App 內帳號刪除（Apple 要求）| ✅ | `deleteAccount` 存在 |
| A-11 | Email OTP 送到**非 Resend owner** email | ⬜ | 之前只用 owner email 驗證 |

---

## 2. 核心功能 smoke test — P0

| # | 項目 | 狀態 |
|---|---|---|
| F-1 | Share（IG/YT）→ import 成功 | ⬜ 真機 |
| F-2 | Share（FB） | ⬜ 真機（3x OK 記錄）|
| F-3 | 匯入：連結解析 | ⬜ |
| F-4 | 匯入：多截圖 | ⬜ |
| F-5 | AI Chef 生成食譜 | ⬜ |
| F-6 | 排餐 / 購物清單 | ⬜ |
| F-7 | 換廚房 / 家庭成員 | ⬜ |
| F-8 | i18n：4 語言顯示正常（zh/en/fil/id）| ⬜ 真機 |

---

## 3. App Store 提交要件 — P0

| # | 項目 | 狀態 | 備註 |
|---|---|---|---|
| S-1 | Metadata（zh-Hant + en-US）| ✅ | `eas metadata:push` |
| S-2 | Privacy URL | ✅ | `https://kindcipe.com/privacy/` |
| S-3 | Support URL | ✅ | `https://kindcipe.com/support/` |
| S-4 | 截圖 6.9"（1290×2796）| ⬜ | **未做** |
| S-5 | App Privacy 問卷 | ⬜ | **未做** |
| S-6 | IAP 產品設定 + Apple 協議/銀行 | ⬜ | **未做** |
| S-7 | Apple Small Business Program | ⬜ | 未做 |
| S-8 | App 圖示 / buildNumber 遞增 | ✅ | buildNumber 8 |
| S-9 | 年齡分級 | ⬜ | 未做 |

---

## 4. 可靠性 / 監控 — P1

| # | 項目 | 狀態 |
|---|---|---|
| R-1 | 前端 Sentry | ✅ |
| R-2 | 後端 Sentry | ⬜ 冇 |
| R-3 | `/health` | ✅ |
| R-4 | Apple 登入 log（`[identity.resolve]`）| ✅ |
| R-5 | PostHog 事件覆蓋 | ⚠️ 薄（11 個）|
| R-6 | `recipeEvents.track` / `logRedirect` 接線 | ⬜ 前端未 call |

---

## 5. 資料衛生（唔阻塞功能）— P1

| # | 項目 | 狀態 |
|---|---|---|
| D-1 | Production 有大量測試帳號（mavis2–17、test28–51…）| ⚠️ 待清理/隔離 |
| D-2 | 舊 migration 0003/0008/0012 log FAILED（pre-existing）| ⚠️ 待 reconcile |

---

## 6. 已知平台限制（唔係 bug）

- `expo-share-intent` 第三方 native patch（綁 5.1.1）→ iOS/SDK 升級要 rebuild。
- Threads / TikTok / XHS copy-link 可能因 anti-bot 失敗。
- DashScope 冇 image-gen → AI 圖片 fallback 不可用。
- EAS 免費層 build/submit 隊列擠塞 → 用 `altool` 後備。

---

## Go / No-Go 判定

**目前 = 🔴 NO-GO**

必須清（P0）：
1. A-6 ~ A-10（真機 auth 測試）
2. A-11（非 owner email OTP）
3. F-1 ~ F-8（核心功能 smoke test）
4. S-4 ~ S-7、S-9（App Store 要件）

P0 全綠後 → 🟢 GO → 提交 App Store。

---

## 建議執行次序

1. **真機 smoke test**（iOS + Android）：auth ×3、share、import、AI Chef。
2. **非 owner email** 測 OTP。
3. **凍結認證設定**（本文件 §0）— 通知另一 session 停止改 production auth。
4. **App Store 要件**：截圖 → App Privacy → IAP → 協議。
5. P1：後端 Sentry、i18n-P1.5、AN0/PRICE、資料衛生。
