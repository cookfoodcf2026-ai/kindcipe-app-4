# 📘 Kindcipe 再啟動 — 完整 Action Plan

**最後更新**：2026-08-18  
**狀態**：Plan Mode 完成，準備執行  
**Domain**：未買（用戶人手）  
**GA4/Brevo**：未開（用戶人手）

---

## 🎯 戰略決定（已鎖定）

| 範疇 | 決定 |
|---|---|
| **Domain** | Cloudflare Registrar 買 `kindcipe.com`（~US$10-12/年，Free plan，開 privacy + auto-renew） |
| **Web 策略** | Phase 1 靜態目錄（10-20 KOL profile 頁），唔好而家起 UGC platform |
| **App 策略** | Baseline 上架優先（release audit → 執漏 → TestFlight） |
| **定價** | HK$30/月 + HK$288/年，工人版隨主帳號（唔另收費） |
| **廣告** | 付費用戶 = 唔睇廣告，而家預留 `subscriptionTier` 字段 |
| **API** | 加 version prefix `/api/v1/trpc`（防 breaking change） |
| **KOL** | 手動 curated 起步（唔使 KOL permission，用公開 IG link + embed） |
| **執行順序** | Phase 0（baseline）→ Phase 1（KOL 目錄）→ 驗證 → Phase 2/3 |

---

## 📋 Phase 0：Baseline（2-4 週）

### T0.1 買 Domain（人手，用戶）
- **做法**：dash.cloudflare.com → Add site → Free plan → Domain Registration → 買 `kindcipe.com`
- **驗收**：`dig kindcipe.com NS` 見到 Cloudflare NS
- **阻塞**：T0.2/T0.6 正式上線要靠呢個

### T0.2 部署 `kindcipe-site`（opencode 執行）
- **做法**：
  1. GitHub 開公開 repo `kindcipe-site`
  2. Push 現有 code（commit `3c2cdc0`）
  3. Cloudflare Pages 連接 repo → Deploy
  4. 綁 domain `kindcipe.com` + `www`（等 T0.1 完成）
- **驗收**：`curl -I https://kindcipe.com` → 200；robots/llms/sitemap 200
- **文件**：`/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-site/`

### T0.3 加 GA4 script（opencode 執行）
- **做法**：`BaseLayout.astro` 加 Measurement ID script
- **要用户提供**：GA4 Measurement ID（`G-XXXXXXX`）
- **驗收**：GA4 DebugView 見到 page_view

### T0.4 加 Brevo waitlist 表單（opencode 執行）
- **做法**：首頁/定價頁嵌入 Brevo form
- **要用户提供**：Brevo account（開 free account → 攞 form embed code）
- **驗收**：提交 → Brevo 見聯絡人
- **注意**：Domain verify（TXT/SPF）要用戶人手喺 Cloudflare DNS 加

### T0.5 定價統一（opencode 執行）
- **文件**：
  - `MARKETING_GUIDE.md`（L117/130/221）
  - `Kindcipe_商業模式分析與定價策略.md`（L14/15/124/132/142/146-149/155-158/162/180/204-205）
- **改動**：
  - HK$28 → HK$30
  - HK$38 → HK$30
  - 「工人加購 +HK$18/月」→「工人版隨主帳號，唔另收費」
- **驗收**：`grep "HK$28/月\|HK$38/月"` 零輸出（價格文案）

### T0.6 Railway custom domain `api.kindcipe.com`（opencode 執行 + 人手）
- **做法**：
  1. Railway Dashboard → Add custom domain（人手）
  2. `lib/trpc.ts:20` 預設改 `https://api.kindcipe.com`
  3. Railway env `ALLOWED_ORIGINS` 加 `kindcipe.com/www/app`
- **驗收**：`curl https://api.kindcipe.com/health` → 200
- **回滾**：舊 Railway URL 留 ≥30 日；`.env` 照用 `EXPO_PUBLIC_API_URL` override

### T0.7 README:154 修正（opencode 執行）
- **改動**：
  - `https://cookfoodapp-fcqnrmih.manus.space` → `https://kindcipe-backend-production.up.railway.app`
  - 順手修正 Expo 51 → 54，RN 0.74.5 → 0.81.5
- **驗收**：grep 無 manus.space

### T0.8 API versioning（opencode 執行）
- **改動**：
  - 後端：`server/index.ts` 加 `/api/v1/trpc` route
  - App：`lib/trpc.ts:20` 改 `${API_BASE_URL}/api/v1/trpc`
- **驗收**：App 照用，`curl /api/v1/trpc` 通

### T0.9 後端加 `subscriptionTier` 字段（opencode 執行）
- **改動**：
  - DB schema：`users` 表加 `subscriptionTier` enum（`free`|`premium`|`trial`|`null`）
  - 預設值：`free`
- **用途**：將來廣告邏輯判斷（premium = 唔睇廣告）
- **驗收**：Migration 成功，舊用戶 = `free`

### T1.0 Release readiness audit（opencode 執行）
- **盤點清單**：
  - [ ] **隱私政策 + 服務條款（Privacy Policy / Terms of Service）**：App Store 上架硬性要求，用標準 template（`https://www.privacypolicies.com` 等）即刻生成，早啲交比 App Review
  - [ ] **ASO assets**：截圖（每個支援語言至少 6.5" + 5.5"）、icon、description、keywords — 第一次上架最常被彈嘅位，要早準備
  - [ ] **IAP 產品提前開**：`kindcipe_monthly_30` / `kindcipe_yearly_288` 一有 account 就喺 App Store Connect 開，Apple 審查產品都要時間
  - [ ] **而家測試中嘅 bug 修復列做 release-blocker**：食譜圖離線 cache、購物車同步（batchAlreadyAdded）、AI Chef library-first + 食材顯示 + steps 防呆 — 全部當 release-blocking，未 fix 完唔好上架
  - [ ] Privacy manifest（iOS 17 硬性）
  - [ ] ATT usage description（如果唔追蹤可 skip）
  - [ ] `__DEV__` 殘留（例如 `login.tsx:351` 重置鈕）
  - [ ] Google OAuth production（`webClientId` 確認）
  - [ ] Apple Sign In（App Store Connect 配置）
  - [ ] TestFlight build（EAS config）
  - [ ] App Store Connect IAP 產品（`kindcipe_monthly_30/yearly_288` 要開）
  - [ ] 後端 `ALLOWED_ORIGINS` production
- **交付**：Checklist + 估期

### T1.1-1.6 Release 執漏（跟 T1.0 checklist 順序做）
- **順序**：Privacy → ATT → __DEV__ → OAuth → TestFlight → IAP → 提交

### T3.4 Web App 連結分享激活（Post-Launch）

**時機：** Web App (`kindcipe-site`) 部署完成後先激活

**文件：** `app/recipe/[id].tsx`

**步驟：**
1. 已預留按鈕代碼（使用 `EXPO_PUBLIC_WEBAPP_URL` 環境變數）
2. 修改 `.env` 加 `EXPO_PUBLIC_WEBAPP_URL=https://kindcipe.com`
3. 重新啟動 Expo：`npx expo start -c`

**驗收：**
- [ ] 擰「連結」按鈕 → 複製 `https://kindcipe.com/recipe/123`
- [ ] 貼到瀏覽器 → 開到對應食譜頁
- [ ] 分享按鈕喺 Recipe Detail 頁面頂部顯示（金色連結 icon）

> **注意：** 呢個功能已經預留喺 `app/recipe/[id].tsx`（1016-1026 行），但係因為 Web App 仲未部署，所以而家複製嘅連結會係 `https://kindcipe.com/recipe/xxx`。等 Static Site 上線後，先改 `.env` 然後重新啟動 App。

> ### 🙋 人手 item 越早開越好（唔使等 code，即刻可以做，並行唔阻塞）
> 1. **買 domain**（T0.1）→ 解鎖 T0.2/T0.6
> 2. **開 GA4 account** → 攞 Measurement ID（T0.3）
> 3. **開 Brevo account** → 攞 form embed code（T0.4）
> 4. **App Store Connect 資料**：Icon、截圖（ASO）、IAP 產品（T1.0）— Apple 審查全部要時間，越早交越好
> 5. **KOL 清單**（P1.1）→ 預備 Phase 1 內容
> **原則**：opencode 做 code 嘅時候，你同步做以上人手 item，等 code 做晒就唔使再等。

---

## 📋 Phase 1：KOL 目錄（+2 週，唔改 code）

### P1.1 揀 10-20 個 HK 煮食 IG KOL（用戶提供）
- **例子**：@daydaycook, @點 CookGuide, @cooking.themian, @foodieblog.hk...
- **驗收**：清單鎖定

### P1.2 手動寫 KOL profile 頁（opencode 執行）
- **結構**：`content/kol/@handle.md`
- **內容**：Handle、簡介、IG link、signature dishes（2-3 道）
- **驗收**：10-20 個 profile 頁

### P1.3 每個 KOL 2-3 道招牌菜（opencode 執行）
- **結構**：`content/kol/@handle/菜式名.md`
- **內容**：原創短描述（LLM 輔助）+ IG embed + 出處
- **驗收**：20-60 個 dish 頁

### P1.4 每道菜「複製 IG 連結」按鈕（opencode 執行）
- **做法**：靜態站加按鈕 → 複製原始 IG URL
- **CTA**：「用 Kindcipe 儲存呢個食譜」
- **驗收**：一撳複製到 IG link

### P1.5 GSC/Bing IndexNow 提交 sitemap（用戶人手 + opencode）
- **做法**：
  1. 開 Google Search Console（加 `kindcipe.com`）
  2. 開 Bing Webmaster Tools
  3. 提交 sitemap（`https://kindcipe.com/sitemap-index.xml`）
- **驗收**：兩邊見 sitemap indexed

---

## 📋 Phase 2：公開食譜庫（驗證後先做）

### P2.1 後端加 `public_recipes` table（opencode 執行）
- **Schema**：同現有 `recipes` 差唔多，加 `creator_handle` 字段
- **驗收**：Migration 成功

### P2.2 tRPC endpoint `public.listRecipes`（opencode 執行）
- **輸入**：filter by creator/dish/category
- **驗收**：App call 到

### P2.3 App 加 browse UI（opencode 執行）
- **做法**：新 tab「發現」或 Home 加 section
- **驗收**：用戶可以 browse 公開食譜

### P2.4 法律審查（用戶人手）
- **要問律師**：轉載食譜（配料 + 步驟）嘅版權風險
- **建議**：只寫原創描述 + 連結返去 IG（Phase 1 做法最安全）

---

## 📋 Phase 3：廣告網絡（有流量後）

### P3.1 加 Google AdMob SDK（opencode 執行）
- **做法**：`expo-ads-admob` 或手動加 SDK
- **驗收**：Banner 顯示到

### P3.2 食譜列表 `renderAd`（opencode 執行）
- **做法**：FlatList 每 5 個食譜插 1 個廣告
- **驗收**：廣告顯示正常

### P3.3 Rewarded ads（opencode 執行）
- **做法**：睇廣告解鎖功能（例如截圖匯入）
- **驗收**：睇完廣告 → 功能解鎖

---

## 🔑 關鍵文件路徑

| 文件 | 路徑 |
|---|---|
| **App** | `/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4/` |
| **Backend** | `/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-backend/` |
| **Site** | `/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-site/` |
| **定價文件** | `MARKETING_GUIDE.md`, `Kindcipe_商業模式分析與定價策略.md` |
| **tRPC client** | `lib/trpc.ts`（改 API URL + version） |
| **Paywall** | `components/PaywallModal.tsx`（加 hideAds logic） |
| **Home 頁** | `app/(tabs)/index.tsx`（預留 ad render 位） |
| **Site layout** | `kindcipe-site/src/layouts/BaseLayout.astro`（加 GA4） |

---

## 🚧 依賴關係圖

```
T0.1 (買 domain) ──┬── T0.2 (部署 site)
                   └── T0.6 (api.kindcipe.com)

T0.3 (GA4) ── 等用戶開 account
T0.4 (Brevo) ── 等用戶開 account + domain verify

T1.0 (audit) ── T1.1-1.6 (執漏)

P1.1 (KOL 清單) ── P1.2-1.4 (目錄頁)

Phase 0 完成 ── Phase 1 開始
Phase 1 驗證有流量 ── Phase 2 開始
Phase 2 有規模 ── Phase 3 開始
```

---

## ✅ 第一個 Command（Exit Plan Mode 後）

```bash
# 1. Check domain 買咗未
dig kindcipe.com NS

# 2. 如果買咗 → 開始 T0.2 部署
cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-site
git remote add origin git@github.com:<user>/kindcipe-site.git
git push -u origin main

# 3. 如果未買 → 先做 T0.5/T0.7/T0.8/T0.9（唔靠 domain）
```

---

## 📞 用戶要提供嘅嘢（4 樣）

1. **Domain 買咗未**（而家未買）
2. **GA4 Measurement ID**（開咗 account 先有）
3. **Brevo account email**（開咗 account 先有）
4. **10-20 個 HK 煮食 IG KOL 清單**（例如 @daydaycook 之類）

---

## 📝 Decisions Log

| 日期 | 決定 | 原因 |
|---|---|---|
| 2026-08-18 | 放棄 travel KOL map webapp | 紅海市場，用戶冇 KOL 人脈冷啟動 |
| 2026-08-18 | 放棄外傭續約工具 | 政府已網上化（GovHK，HK$230，8 星期前） |
| 2026-08-18 | 放棄簿記/AI 收據工具 | Accrobo/SnapTax/BookSaiDSo 已有人做 |
| 2026-08-18 | 專注返 Kindcipe | 核心產品 + 已有 backend + app feature complete |
| 2026-08-18 | KOL platform 分 Phase 1/2/3 | 唔好阻塞 baseline，最低成本驗證 |
| 2026-08-18 | 廣告策略：付費 = 唔睇廣告 | IAP 訂閱動力，同訂閱模式共存 |
| 2026-08-18 | API versioning `/api/v1/trpc` | 防 breaking change，保護已上架用戶 |
| 2026-08-18 | 定價統一 HK$30/288，工人隨主帳號 | 簡化定價，貼近家庭訂閱架構 |
| 2026-08-19 | T0.9 改為唔加 subscriptionTier 字段 | subscription 已喺 family 層級（getFamilySubscription.isPaid），避免重複數據衝突 |
| 2026-08-19 | kindcipe.com 已買（Cloudflare Registrar） | DNS 已指向 yichun/dell.ns.cloudflare.com |
| 2026-08-19 | 後端 tRPC 掛 /api/v1/trpc（保留 /api/trpc） | 新 app 用 versioned，舊 app backward compat |
| 2026-08-19 | settings.tsx privacy URL → kindcipe.com/privacy | 清走 manus.space 殘留 |

---

**Save 咗呢個 Plan，你可以隨時開始執行。**
