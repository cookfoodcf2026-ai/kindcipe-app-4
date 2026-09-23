# Kindcipe — 上架前 Master Plan

> 建立日期：2026-09-23
> 目標：上架 App Store + Google Play，用戶體驗最好，幾千至一萬用戶都頂得住。

---

## 📊 現況快照（審查結果）

| 項目 | 現況 |
|---|---|
| 用戶 | 53 users / 42 families |
| DB | 16 MB（Postgres 17.6，Supabase Sydney `ap-southeast-2`）|
| 字典 | 1,221 項（common_ingredients）|
| 官方食譜 | 314 · 自訂 180 · 採購 661 · 排餐 612 |
| Backend | Railway **SFO（三藩市）** · **replicas: 1** |
| i18n | 791 keys × 4 locales；`audit-i18n --strict` **PASS**（但唔掃 `lib/`）|
| Sentry | 已接（`tracesSampleRate 0.1`）|
| Push | 已接（local 通知：餐單/清單更新 + 飯點提醒）|
| Repo | App `.git` **862 MB**（node_modules 由第一個 commit 就在）|

### 🔴 已發現嘅關鍵問題
1. **架構延遲**：Backend（SFO）↔ DB（Sydney）→ **每次查詢 ~170–200ms**；一個請求 ~1–1.5 秒。
2. **IAP 冇 server-side 驗證** → 假收據可開通免費 Pro。
3. **`lib/` 唔喺 i18n audit 範圍** → 135 行硬編中文（通知、FaceID、購買錯誤）。
4. **`meal_plans` / `shopping_items` 冇索引** → 全表掃描（上架後瓶頸）。
5. **冇 API rate limiting** · **冇 cache** · body limit 50MB。
6. **冇離線偵測** · **冇 Support URL / 客服入口** · **冇 App 評分提示** · **冇 Analytics**。
7. **無障礙弱**（4 個檔案有 `accessibilityLabel`）· **skeleton 少** · **haptics 少**。

---

## Phase 0 — 即刻做（唔需 credential／唔需外部決定）

### 0A. i18n 缺口修補
- [ ] `lib/notifications.ts`：通知標題/內容改 `t()`（4 語言 key）
- [ ] `lib/auth.ts`：FaceID 提示（解鎖 Kindcipe）
- [ ] `lib/purchase.ts`：購買錯誤訊息
- [ ] `lib/shopping-templates.ts`：確認 name/description 已雙語
- [ ] **擴 `scripts/audit-i18n.js` 掃 `lib/`** → 目標 0 hits

### 0B. 用戶體驗補完
- [ ] **離線偵測**（`@react-native-community/netinfo`）+ 全局離線 banner + 友善錯誤
- [ ] **隱藏「廚房學堂」**（移除 `app/(tabs)/more.tsx` 嘅 coming-soon entry）
- [ ] **Support URL**：`docs/support/index.html`（GitHub Pages）+ app 內「聯絡我們／意見」入口
- [ ] **App 評分提示**（`expo-store-review`）→ 用夠 N 次後彈

### 0C. Backend 容量 + 安全（Phase 1）
- [ ] **B6a 索引**：`meal_plans(family_id, date)`、`shopping_items(family_id, status)`、`recipe_events(family_id, created_at)`
- [ ] **B6b Rate limiting**：`express-rate-limit`（per-user + per-IP；AI endpoint 更嚴）
- [ ] **B6c AI 併發 semaphore**（保護 DashScope QPS，例如同時 8）
- [ ] **B6d In-memory cache**：字典（1,221）+ 官方食譜（314），TTL 10 分鐘
- [ ] **B6e DB pool** `max: 10 → 20`
- [ ] **B6f body limit** `50mb → 10mb`
- [ ] **B7 清 `ALLOWED_ORIGINS`**（改空值 + 註解；現時 `*` 係字面值，實際已鎖死）

**驗證**：FE + BE typecheck 0 errors · `check-i18n-keys` pass · `audit-i18n --strict` pass · `ci-gate`

---

## Phase 1 — 需你決定／credential

### 1A. 🚀 搬區（用戶體驗最關鍵）
| 選項 | 做法 | HK 延遲 | 你要做 |
|---|---|---|---|
| **(a) 建議** | Supabase → **Singapore** + Railway → **Singapore** | **~30–50 ms** | 開新 Supabase project（Singapore）|
| (b) 簡單版 | Railway → **Sydney**（同 DB 同區）| ~150 ms | 只需改 Railway region |
| (c) 唔搬 | — | ~1–1.5 s | — |

- DB 只 16MB → dump/restore 幾分鐘；舊 project 保留做備份
- ⚠️ 執行時要驗證 Railway 有冇 Singapore region（dashboard）

### 1B. Analytics
- **PostHog**（1M events/月免費，建議）或先用 **Sentry**（已裝）
- Funnel：註冊 → 建立廚房 → 首次 AI 生成 → 排餐 → 生成買餸清單 → 付費

### 1C. IAP server-side 驗證
- Apple：ASC → Integrations → **In-App Purchase Key**（`.p8` + Key ID + Issuer ID）
- Google：Play Console service account JSON
- 寫驗證邏輯 + sandbox 測試

---

## Phase 2 — 上架前收尾
- [ ] **2A** `git rm -r --cached node_modules` → commit（止血；歷史仍 862MB）
- [ ] **2B** push 兩個 repo → **驗證 Pages**（privacy + support URL 200）
- [ ] **2C** App Store 截圖（你 capture）+ metadata 出稿（我出）
- [ ] **2D** `eas login` → **Beta build**（TestFlight / Play internal）

---

## Phase 3 — 上架後首兩週（體驗／增長）
- [ ] 無障礙（`accessibilityLabel` / `accessibilityRole`）
- [ ] Skeleton loading（主要列表）
- [ ] Haptics 質感（按鈕／成功動作）
- [ ] Referral 邀請獎勵（家庭 app 靠口碑）
- [ ] Aha 引導（Day 1：完成首次「3 餸 1 湯 + 匯出英文採購單」）
- [ ] 試用轉化 Push（Day 3 習慣 / Day 5 倒數）
- [ ] Supabase 備份確認
- [ ] Railway 監控／告警
- [ ] （按需）Railway replicas / Redis / AI async queue

---

## 🎯 開工前確認（待填）
1. **搬區**：⬜ (a) Singapore　⬜ (b) Sydney　⬜ (c) 唔搬
2. **Analytics**：⬜ PostHog　⬜ Sentry
3. **IAP**：ASC app record 幾時開？____
4. **次序**：⬜ Phase 0 → push → Phase 1 → Beta　⬜ 先搬區

---

## ⚠️ 風險備註
- **`git filter-repo` 清歷史**（縮 862MB）：改寫所有 commit SHA、需 force-push、要先 `git clone --mirror` 備份 → **建議上架穩定後先做**。
- **CORS**：`ALLOWED_ORIGINS=*` 係字面值（非 wildcard）→ 真實 browser origin 已被拒；native app 冇 `Origin` → 已安全。
- **10k 併發**：AI 生成係硬瓶頸（DashScope QPS + 成本）→ 靠 rate limit + semaphore + 月配額，唔係加機器。
