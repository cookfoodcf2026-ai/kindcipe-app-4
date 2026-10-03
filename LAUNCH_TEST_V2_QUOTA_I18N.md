# LAUNCH TEST V2 — Quota / Cost / i18n

> 對應 backend commit `8a5255b` / `5a29b56`（已 deploy）+ app commit `cdd34dc0` / `9a61d3e4`。
> 每次更新後：**完全關閉 app → 開兩次**（第一次下載、第二次生效）。
> 結果：✅ 通過 / ❌ 失敗 / ⏭ 略過。失敗請記：`優先級｜裝置｜步驟｜預期｜實際｜截圖`。
> 回報格式：`A4｜iPhone 15｜匯入一次連結｜預期 import_usage +1｜實際 +0｜<截圖>`

---

## 🔴 Q0｜部署前 Config（先做，否則測試無意義）
- [ ] **Q0-1** Railway `BETA_ALL_PAID` 現值（**先唔改**，見備註）
- [ ] **Q0-2** Railway `LLM_DAILY_TOKEN_BUDGET`（建議 0 = 不限，先觀察）
- [ ] **Q0-3** 後端 `SENTRY_DSN` 已設（Sentry 已收 first issue ✅）
- [ ] **Q0-4** App build 已含 `EXPO_PUBLIC_SENTRY_DSN`（如要前端 Sentry）

> ⚠️ **備註 1**：`BETA_ALL_PAID=false` 一改 → 全用戶即變免費額度並開始硬擋。
> 建議：**先 deploy 但唔改 flag**，確認「扣數有寫入 DB」+ Sentry 正常，**最後先改 false**。
> ⚠️ **備註 2**：TestFlight = production，`EXPO_PUBLIC_API_URL` bake 死 Railway → 只能用 production 驗證。

---

## 🔴 A｜Backend 配額（已 deploy）

### A1｜AI 硬擋（chat）
- [ ] 免費戶狂用 AI Chef → 到 `aiChatLimit`（20）被擋，**唔再燒 API**
- [ ] 被擋時前端彈 **paywall**（唔係普通錯誤）

### A2｜AI Edit 硬擋
- [ ] `recipe/[id]` AI 改食譜到額度 → 被擋

### A3｜Planner AI 硬擋
- [ ] 週餐 AI 生成到額度 → 被擋（Pro 亦會撞上限）

### A4｜匯入扣數（**BUG-3 修正後**）
- [ ] parse **成功**嘅 URL → DB `import_usage` +1、Settings 統計 +1
- [ ] parse **成功**嘅文字 → +1
- [ ] parse **成功**嘅圖片（真食譜截圖）→ +1
- [ ] parse **失敗**（非食譜圖 / 無內容）→ **唔扣** ✅（BUG-3）
- [ ] parseUrl 硬失敗（反爬/404）→ **唔扣** ✅

### A5｜唔重複扣
- [ ] parse 完再 import → **只算 1 次**（importUser 已移除重複扣）

### A6｜library 免費
- [ ] 額度用完 → AI Chef **食譜庫模式仍可用**

### A7｜budget 斷路器
- [ ] 設細 `LLM_DAILY_TOKEN_BUDGET` → 超標即 AI 停 + Sentry 告警
- [ ] 手動 trigger parse（不扣數）→ budget 只計真實 LLM token ✅（BUG-3 一致性）

### A8｜ISSUE-6（方案 D）——**AI 編輯只扣 1 次**
- [ ] 一次 AI 編輯（preview → save）→ AI 用量 **只 +1**（唔再 +2）
- [ ] preview 睇到嘅內容 == save 後食譜詳情（**所見即所存**）
- [ ] save 唔會再 call LLM（成本 log 只有 1 次 `[LLM cost]`）

---

## 🟠 B｜App i18n（需新 build）

- [ ] **B1 聚會 tab 語言**：切 en / fil / id 睇標題、模板卡、分類、食材、單位、Tips、Alerts、分享訊息
- [ ] **B2 分享訊息本體**：委派清單／WhatsApp 內文標籤跟分享語言（zh/en/id/ph）
- [ ] **B3 購物車本地化**：聚會食材加入購物車 → 購物 tab 切英文見到英文名
- [ ] **B4 其他 tab Alerts**：planner、shopping、kitchen-settings、pantry 等刪除／失敗標題跟語言
- [ ] **B5 Stack 標題**：分類管理、廚房設定、街市指南、家中儲備、智能補貨
- [ ] **B6 paywall**：quota 錯誤 → 彈 paywall（import / AI 兩處）
- [ ] **B7 usage 即時更新**：用完 AI／匯入 → Settings 使用統計即時反映
- [ ] **B8 Settings 用量行**：成員用量行跟語言（`settings.memberUsageBreak`）
- [ ] **B9 UnitPicker**：單位選擇分類標題跟語言
- [ ] **B10 攝影權限 Alert**：AI Chef 相機權限對話跟語言

---

## 🟡 C｜已知限制（唔算 bug）
- **BUG-5**：`llm.ts` budget 係 in-memory → **單 instance 有效**（已確認 Railway 單 instance）。多 replica 歸零，日後才需 Redis/DB。
- **Deferred**：backend `meteredLLM`（中央計費）、cart scheme B（`nameFil`/`nameId` 欄位 + migration）。
- **ISSUE-6 方案 D 係契約變更 → 需新 native build**（舊 build 唔相容新 `saveEditedRecipe`）。
- `api.kindcipe.com` 係半成品（Railway 加咗 domain 但 DNS 未生效）；唔影響上架，啟用時要同步 frontend/Apple/CORS。

---

## 提交前（App Store）
- [ ] Privacy / Support URL
- [ ] 截圖（6.9" 1290×2796）
- [ ] App Privacy 問卷
- [ ] IAP（如已接）；否則 iOS 無售賣入口
