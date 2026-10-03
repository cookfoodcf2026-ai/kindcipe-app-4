# 數據合規（DATA_COMPLIANCE）

> 支援上架（App Privacy / GDPR / 香港 PDPO）+ 未來第三方數據合作。
> 最後更新：2026-10-03

---

## 1. 你收集咩（依 code 事實）
| 類別 | 例子 | 儲存位置 |
|---|---|---|
| 帳號 | email、顯示名、role | 後端 DB |
| 內容 | 食譜、排餐、購物清單、AI 對話、相片 | 後端 DB / R2 |
| 識別 | 內部 user id | DB / PostHog |
| 用量 | 事件（view/import/plan/…）| PostHog + `recipe_events` |
| 診斷 | 錯誤堆疊 | Sentry |

## 2. 第三方處理者（DPA 需要）
| 服務 | 用途 | 地區 | 備註 |
|---|---|---|---|
| PostHog | 分析 | US (`us.i.posthog.com`) | 可自架。目前 SaaS |
| Sentry | 錯誤 | US | ⚠️ 後端未接（見 B1）|
| Apple / Google | 登入 | — | OAuth |
| Stripe | 付款 | US | web/Android |
| Resend | Email | US | OTP |
| Railway | Hosting | US | DB + API |
| Cloudflare R2 | 圖片 | — | 食譜圖 |

## 3. 合規要求

### 香港 PDPO
- ✅ 有私隱政策 URL
- ✅ 提供刪除帳戶
- ⬜ 明確講明收集目的 + 第三方

### GDPR（若日後有歐盟用戶）
- ⬜ 合法基礎（同意 / 履行合約）
- ✅ 資料可攜（self-merge + export）
- ✅ 刪除權（`deleteAccount`）
- ⬜ Consent / opt-out 記錄 ← **本次已加 toggle**
- ⬜ DPA（同 PostHog/Sentry/Stripe）

### Apple App Privacy
- 見 `APP_PRIVACY_ANSWERS.md`（已更新第三方處理者）

---

## 4. 已實作嘅用戶控制
| 控制 | 位置 |
|---|---|
| 刪除帳戶 | 設定 → 刪除帳戶（`deleteAccount`）|
| 合併帳號 | 設定 → 合併帳號 |
| **停用分析** | 設定 → 「分享匿名使用數據」toggle（`setAnalyticsOptOut`）|
| 登出 | 設定 → 登出 |

---

## 5. 隱私政策要加嘅段落（畀 webapp/site session 更新）
1. **收集資料類型**（上表 §1）
2. **用途**：提供服務、改善產品、防止濫用
3. **第三方**：PostHog、Sentry、Stripe、Apple/Google、Resend、Railway、R2
4. **用戶權利**：查閱、更正、刪除、停用分析
5. **資料保留**：帳號活躍期間 + 刪除後 30 日
6. **聯絡**：privacy@kindcipe.com

---

## 6. 第三方數據合作前置（未來）
- [ ] 完成 §3 合規
- [ ] 簽 DPA / Data Sharing Agreement
- [ ] 只共享**去識別 aggregate**（熱門食材/菜式/地區趨勢）
- [ ] 提供 opt-out 機制
- [ ] 記錄共享範圍（audit）

---

## 進度
- [x] 分析 opt-out toggle（app 內）
- [x] App Privacy 草稿更新第三方
- [ ] 隱私政策更新（site session）
- [ ] 後端 Sentry 接入（B1）
- [ ] DPA 草稿
