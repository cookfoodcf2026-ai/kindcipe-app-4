# Kindcipe 優化路線圖

> 整合「全端架構 + PM/UX + 代碼審查」三條軌。目標：**收口不該外洩嘅資料**、**令 `kindcipe.com` 成為可被 Google/Bing 同 AI 助手發現嘅入口**、**清除技術債**。

## 目標架構

| 網域 | 角色 | 技術 |
|---|---|---|
| `kindcipe.com` | 公開 SEO/GEO 入口 + 食譜頁 + CTA | 新建 Astro source（`marketing/`）→ build 出 `docs/`（GitHub Pages）|
| `app.kindcipe.com` | 產品（登入後使用）+ 公開 welcome/signup | Expo SPA（維持），新增匿名 welcome |
| Railway backend | 資料 + AI | 新增公開食譜 export endpoint（handoff）|

### 已定決策
- 發現策略：**SEO + GEO 兩者都要**（開放 Google/Bing，保留 AI bot allow-list）。
- 公開食譜內容：**放 `kindcipe.com` 行銷站**；`app.kindcipe.com` 維持登入牆 + noindex。
- Recipe URL：**中文名 + 英文/拼音 slug 並存**，舊 URL 301。
- 匿名開分享嘅 user/AI 食譜連結：**要登入先睇**（最安全）。
- 執行次序：**Phase 1 + Phase 2 先行**，Track R 並行。

---

## Phase 1 — 資料收口（app repo）

- [x] **1.1 `.env` 停止追蹤**：`.gitignore` 加 `.env`；`git rm --cached .env`（檔案保留喺磁碟）。
- [x] **1.2 移除寫死測試憑證**：三個 scripts 改為必須由環境變數提供；`TESTING_STATUS.md`、`TESTING_GUIDE.md` 清走真實帳號。
- [x] **1.3 app 子網域真正 noindex**：`public/_headers` 加 `X-Robots-Tag: noindex, nofollow`；新增 `public/robots.txt`。
- [x] **1.4 Email 移出 URL**：新增 `lib/pending-verification.ts`（in-memory）；`app/login.tsx` 唔再傳 `?email=`；`app/verify-email.tsx` 改讀 in-memory。
- [ ] **1.5 PostHog key 改 build-time**（**deferred**）：`eas.json` 需先設 EAS secret，否則會斷 analytics；且 key 本身要嵌入 client bundle，移除唔會減少曝光，屬低回報。
- [ ] **1.6 型別配合**（**deferred，待後端**）：`lib/router-types.ts:184-191` `FamilyMember.user` 移除 `email`/`avatar`。

### Backend handoff（另 repo）
- [ ] IDOR 全端審計（`SECURITY_AUDIT.md` G2）：`recipes.getById`、shopping、mealPlan、pantry、family 全部要有 `activeFamilyId` 過濾。
- [ ] Admin endpoint 後端 role gate（`app/admin.tsx` 只係 client 檢查）。
- [ ] `family.get/list` 欄位裁剪，唔回 `email`/`avatar`。
- [ ] user/AI 食譜改不可枚舉 slug（配合分享連結）。
- [ ] `recipeEvents.track` / `shopping.logRedirect` 輸入驗證（防歸因污染）。

---

## Phase 2 — ~~重建 marketing source pipeline~~（**已移至 `kindcipe-site`**）

> ⚠️ **更正**：kindcipe.com 嘅真正 source 係**另一個 repo** `cookfoodcf2026-ai/kindcipe-site`（Cloudflare），**唔係**呢個 repo 嘅 `docs/`。
> 呢個 repo 曾建嘅 `marketing/` + `docs/` 係多餘，已移除 `marketing/`（`docs/` 待 app-4 GitHub Pages 關閉後再刪）。詳見 `WEBSITE_HANDOFF.md`。
> 以下 Phase 2/3/4/6 嘅網站工作**應喺 `kindcipe-site` 做**。

- [x] **2.1 Astro 骨架**：`marketing/`（astro@5、`@astrojs/sitemap`）；`outDir: ../docs`（可用 `MARKETING_OUT_DIR` override 做安全驗證）。
  - ⚠️ 環境係 **Node 20**，Astro 6 要 Node ≥22.12，所以**鎖 Astro 5.18.2**。
- [ ] **2.2 內容遷移**（**進行中**）：
  - ✅ 已建 `Layout.astro` + i18n + 首頁（zh/en）；共用 Layout 自動修好 **EN nav 指錯**、**語言 toggle 自指**、加返 **hreflang**。
  - ✅ **Batch 1：Features 頁**（`features.astro` + `en/features.astro` + `FeatureGrid.astro`）＋全站 CTA。
  - ✅ **Batch 2：pricing / faq / support / privacy**（zh/en）＋元件（`PricingTable` / `FaqList`）＋設計系統樣式。
  - ✅ **Batch 3：Blog 重寫** 10 篇 × zh/en（content collection，重用舊 slug）＋ 首頁「Follow @kindcipe.app」IG 卡。
  - ✅ **Batch 4：Recipes** 20 條 × zh/en（content collection + `Recipe` JSON-LD）＋舊中文 URL 301 → 英文/拼音 slug。
  - ✅ **HKTVmall／導購字眼全清**（marketing + live docs）；格價功能保留但唔作賣點。
  - ✅ **已發佈**：`marketing/.publish` → build 寫入 `docs/`（116 個 HTML：76 頁 + 40 重定向）。
  - **網站定位**：功能展示 + 單一 CTA 導去 webapp 登入。**基本設計系統已落，進階 UX/UI polish 延後。**
- [x] **2.3 Build 掛鈎**：root `package.json` 加 `marketing:dev` / `marketing:build`；`.githooks/pre-commit` 加 `marketing/**` 觸發，**以 `marketing/.publish` 為閘**（避免未遷移完就 wipe 咗 docs/）。
- [x] **2.4 SEO 資產**：`og-default.png`（暫用 logo，待出正式 1200×630）、`hreflang`、canonical、sitemap、`robots.txt`（SEO+GEO 開放）、`llms.txt`。

---

## Phase 3 — CTA 改 webapp + 內容更新

- [x] 全站 CTA → `https://app.kindcipe.com/login?utm_source=kindcipe-site`（`ctaUrl()` 統一，2026-10 改為直去 `/login`，跳過 welcome）。
- [ ] 刪除所有「App 即將上架 / coming soon / waitlist」（ZH + EN）。
- [ ] blog「下載」變真連結；pricing 文案更新；移除未驗證數據；修正 privacy 嘅 IAP 描述。

---

## Phase 4 — Recipe 生成 pipeline（SEO/GEO 核心）

- [ ] Backend handoff：`recipes.exportPublic`（official/KOL、真實食材/步驟、slug、cuisine、tags、圖）。
- [ ] Build 時抓取 → 生成 `/recipes/<slug>/` + `Recipe`/`HowTo` JSON-LD + webapp CTA + 相關食譜。
- [ ] 中文名 + 英文/拼音 slug 並存，舊 URL 301；由 40 條擴至全部公開食譜。
- [ ] 更新 sitemap + `llms.txt`。

---

## Phase 5 — Webapp 匿名 welcome/signup（**deferred**）

- 已決定 CTA 直接去 `/login`，**跳過 welcome**（0 影響 native app）。如日後想要更好匿名體驗先做：
  - [ ] 新增 `app/welcome.tsx`（公開）：價值主張 + 「今晚食咩」示範 + 開始使用/登入。
  - [ ] 改 `AuthGuard` allowlist（`app/_layout.tsx:446-464`）加入 `welcome`。
  - [ ] CTA 落點 = welcome → signup → onboarding。

---

## Phase 6 — SEO/GEO 開放

- [ ] `docs/robots.txt`：`User-agent: *` → `Allow: /`（保留 AI bot allow-list）。
- [ ] 提交 Google Search Console / Bing；驗證 structured data。

---

## Track R — 重構審計（並行，唔阻 Phase 1/2）

實測：42,208 行 / 105 檔；`as any` **884**、`: any` **375**、`(trpc as any)` **18**；ci-gate 只 lint 8/105 檔；測試檔 6 個。

- [ ] **R1 型別安全債**（高）：補齊 `lib/router-types.ts` contract → 拆 `as any`/`(trpc as any)`（同 Phase 1 安全綁埋）。
- [ ] **R2 巨型檔案拆分**（高風險，需先有測試）：`ai-chef.tsx` 4265、`planner.tsx` 3645、`recipe/[id].tsx` 2791、`index.tsx` 2662、`shopping.tsx` 2444。
- [x] **R3 死代碼移除**（低風險）：`lib/platform.ts` `buildRecipeDeepLink`；`app/coming-soon.tsx` + `app/(tabs)/more.tsx` `goToComingSoon`；`locales/*.json` `kitchenClass*`；`hooks/ai-chef/{useChatSessions,useMealPlanFlow,useImageUpload,useChatMutation,index}`。
- [ ] **R4 重複邏輯**（中）：`POPULAR_CHIPS`/`TOP_TAGS` 喺 `(tabs)/index.tsx` 同 `recipes.tsx` 重複；搜尋列/歷史/source chips/`FilterModal` 抽 `useRecipeDiscovery` + 共用組件。
- [ ] **R5 命名混淆**（低）：`docs/` 係網站輸出；`EXPO_PUBLIC_STORE_URL` 指行銷站；`getWebappUrl()` fallback 去 `STORE_URL`。
- [ ] **R6 Lint/CI 覆蓋**（中）：ci-gate 擴大至 `app/ lib/ hooks/ src/ components/` 全量 `--max-warnings=0`。
- [ ] **R7 測試覆蓋**（中，R2 前置）：補 `lib/` 純邏輯測試。
- [ ] **R8 `console.*` 清理**（低）：64 個 → `lib/logger`，production strip。

### 建議次序
```
Phase 1 (資料)  ─┬─ R1 型別/contract（同安全綁埋）
                 ├─ R3 死代碼 + R5 正名 + R8 log（低風險即做）
                 └─ R6 lint 擴大
Phase 2 (網站)  ─── 平行進行
R7 補測試 ─→ R2 拆巨型檔 ─→ R4 抽重複
```

## 驗證
- `npx tsc --noEmit --project tsconfig.json`
- `npm run ci-gate`
- `git grep` 確認冇殘留憑證
- `npm run marketing:build`（Phase 2 起）
