# Kindcipe — Home Revamp & Launch Plan

> 最後更新：2026-10-21
> 狀態：**Locked**（可以照此執行）
> 單一真相：本檔。其他 handoff／舊 plan 以此為準。

---

## 0. 版本命名（避免混淆）

| 名稱 | 意思 |
|---|---|
| **Legacy** | 現時線上 app（`app/(tabs)/index.tsx`） |
| **Launch** | 上架版本：Legacy UI + 付款 + 法律／商店資產 |
| **Post-launch** | 上線後以 OTA 推出嘅新 UX 與增強功能 |

**核心策略（已鎖定）：**

> **Launch 用 Legacy 上架；新 Home 及新 UX 全部用 OTA 推出。**
> UI 進度永遠唔會阻塞上架。

---

## 1. 目標

**核心 job：** 唔使煩食咩 → **1–2 日晚餐 + 買餸項目**。

**成功定義**
- 開 app → 見到菜單 ≤ 3 次點擊
- Onboarding 完成時已有計劃（Post-launch）
- 購物項目按日期清楚可見
- 新 UX 可即時 flag 回滾

---

## 2. 非目標

- 假數據（假評分／假 128k）
- 公開唯讀購物頁
- 雪櫃／pantry 功能
- A/B test（0 真實用戶）
- 第三方廣告（AdMob）
- Server-driven UI

---

## 3. 已鎖定決策

| 類別 | 決定 |
|---|---|
| 上架 UI | **Legacy**（Launch binary 不含 HomeV2） |
| 新 UX | Post-launch OTA，flag 控制 |
| 開發方式 | 隱藏 route `/home-v2`（`href: null`），**上線前唔碰 `index.tsx`** |
| 計劃單位 | 2 日 default／1 日 toggle |
| 餸菜 | **3 餸 1 湯**（模板 selector 留 Post-launch） |
| 開始日 | `[由今日開始] [由聽日開始]`（只決定 D1/D2） |
| 購物項目 | **跟每餐日期**（D1/D2）；唔強制同一日 |
| Shopping | 沿用日期卡；預設 `all`；重複行先接受，之後才分組 |
| 決策 | 零問題 → 預覽 → 確認 |
| 勾選 | 全選 default、最少 1 道、只寫已選 |
| 換菜 | 預覽右邊 `[換]`；確認後菜單詳情 |
| 衝突 | 第一版只提供 **取代（確認）／取消**；「保留」留後 |
| 份量 | Preview 可改、記住 |
| 禁忌 | **食材過濾**；素食改 slot |
| 角色 | 加入 default **member**；owner 可改 helper |
| 上限 | Free **2 人**；Pro／trial **4 人** |
| 提醒 | 第一版 local（flag）；之後 server push |
| 廣告 | 冇第三方廣告；**Pro 唔見升級 promo** |
| 分享 | 只喺 Kitchen Settings 邀請；Shopping 冇分享 |
| 付款 | **Web = Stripe**；Android = Play Billing；iOS = IAP |
| 獲客 | 有機：ASO + 文字分享 + 邀請 loop + landing CTA |

---

## 4. 用戶流程

### 新用戶（Legacy 上架版）
```
現有 onboarding → 現有 Home → 現有流程
```

### 新用戶（Post-launch 新 UX）
```
S1 建立廚房
→ S2（開始日／日數／禁忌，可 skip）
→ S3 真實菜單（全選）
→ ✅ 就咁煮 → Shopping tab（按日期）
→ Home 已有計劃
```

### 回訪
```
16:00 提醒 → Home Hero（今晚：XX ✓）
→ 睇菜單／睇買餸單／換一道 → 買餸 → 煮
```

### 加入廚房
```
Kitchen Settings → 邀請碼
→ 登入 → 加入（default member）
→ 睇 live 清單 → owner 可改 helper
→ 第 3 人 → Paywall（Pro 最多 4）
```

---

## 5. Mockups（Post-launch 新 UX）

### 5.1 Onboarding S1
```
┌───────────────────────────────┐
│            🍳 Kindcipe         │
│      唔使再煩「今晚食咩」        │
│   一次過排好 1–2 日晚餐 + 買餸單 │
│   ┌───────────────────────┐   │
│   │  ✨ 建立我嘅廚房        │   │
│   └───────────────────────┘   │
│        加入廚房 · 登入          │
└───────────────────────────────┘
```

### 5.2 Onboarding S2
```
┌───────────────────────────────┐
│  ‹                    [跳過]   │
│  幾時開始？                     │
│   [由今日 ✓] [由聽日]           │
│  計劃幾多日？  [1 日] [2 日 ✓]  │
│  有咩唔食？（可跳過）            │
│   [素食] [唔食牛] [唔食海鮮] [唔辣]│
│   今晚＋聽晚 · 3 餸 1 湯        │
│   ┌───────────────────────┐   │
│   │  ✨ 幫我計劃           │   │
│   └───────────────────────┘   │
└───────────────────────────────┘
```
> 跳過 = 用預設（今日、2 日、無禁忌）**照樣生成**。

### 5.3 Preview
```
┌───────────────────────────────┐
│ ‹  你嘅 2 日菜單   [全選] [換一組]│
│ 4 人份 ▾ · 3 餸 1 湯 · 由今日開始│
│                               │
│ 今晚 · 5/18        [全選 ☑]    │
│ ☑ [圖] 豉汁蒸排骨        [換]  │
│ ☑ [圖] 蒜蓉炒菜心        [換]  │
│ ☐ [圖] 番茄炒蛋          [換]  │
│ ☑ [圖] 冬瓜薏米湯        [換]  │
│                               │
│ 聽晚 · 5/19        [全選 ☑]    │
│ ☑ [圖] …（4 道）              │
│                               │
│ 🛒 已選 7 道 · 17 樣            │
│    今日 9 / 聽日 8              │
│ ┌───────────────────────────┐ │
│ │ ✅ 加入已選（7 道）         │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```
- 每行：`☑ | 56px 圖 | 名 + 時間/人數 | [換]`
- 全選時 CTA = `✅ 全部加入（8 道）`
- 0 道 → CTA 停用

### 5.4 Home — 新用戶
```
┌───────────────────────────────┐
│ 早晨，Mavis ☀️          (M) 👑 │
│ ┌───────────────────────────┐ │
│ │  今晚＋聽晚食咩好？         │ │
│ │  [由今日][由聽日] [1日][2日✓]│ │
│ │  ┌─────────────────────┐  │ │
│ │  │  ✨ 即刻幫我計劃      │  │ │
│ │  └─────────────────────┘  │ │
│ └───────────────────────────┘ │
│  ⚡快手  🥗清淡  🍲一鍋  ⭐新手 │
│ 為你推薦              查看全部 ›│
│ ┌────┐┌────┐┌────┐ →         │
│ ── 探索 ─────────────────────  │
│ [🔍 搜尋食譜、食材、菜系]   [☰] │
│ 首頁   計劃   購物(3)   更多    │
└───────────────────────────────┘
```

### 5.5 Home — 已有計劃
```
┌───────────────────────────────┐
│ 早晨，Mavis ☀️          (M) 👑 │
│ ┌───────────────────────────┐ │
│ │ 今晚：豉汁蒸排骨 ✓          │ │
│ │ 聽晚：已排好                │ │
│ │ 🛒 17 樣未買（今日 9 / 聽日 8）│ │
│ │ [睇菜單]        [睇買餸單]  │ │
│ └───────────────────────────┘ │
│ [今晚 4/4 ✓]  [🛒 0/17]        │
│ 為你推薦              查看全部 ›│
└───────────────────────────────┘
```
> Hero **冇**「換一道」；換菜只喺菜單詳情／預覽。

### 5.6 Shopping（按日期）
```
┌───────────────────────────────┐
│ 購物清單            [歷史] [+] │
│ [今日] [聽日] [本週]            │
│ ── 今日 · 5/18 ──  9 樣        │
│ ☐ 豬肉            500g         │
│ ☐ 菜心            1 斤         │
│ ☐ 蔥              2 棵         │
│ ── 聽日 · 5/19 ──  8 樣        │
│ ☐ 番茄            4 個         │
│ 首頁   計劃   購物(17)  更多    │
└───────────────────────────────┘
```
> 第一版接受同名重複行；之後才做合併＋展開。

### 5.7 AI Chef（Post-launch）
```
┌───────────────────────────────┐
│ ‹  AI 煮飯助手      [歷史] [+] │
│ ┌───────────────────────────┐ │
│ │ 你嘅 2 日計劃              │ │
│ │ [換一道] [加湯] [睇買餸單]  │ │
│ └───────────────────────────┘ │
│  [ 聽晚想食魚，唔要辣…  ]  ➤  │
│ 換一道餸 · 清雪櫃 · 煮法 · 替代 │
└───────────────────────────────┘
```

### 5.8 提醒
```
┌───────────────────────────────┐
│  Kindcipe                     │
│  聽晚＋後晚有 17 樣未買          │
│  幫你排好晒，去買餸？            │
│                         而家 › │
└───────────────────────────────┘
```

### 5.9 桌面（同一結構）
```
┌──────────┬──────────────────────────────────┐
│ Kindcipe │  早晨，Mavis ☀️            (M)   │
│ ▸ 首頁   │  ┌────────────────────────────┐  │
│   計劃   │  │ Hero（max 1100）            │  │
│   購物   │  └────────────────────────────┘  │
│   更多   │  為你推薦（4 卡）／grid（4 欄）   │
└──────────┴──────────────────────────────────┘
```

---

## 6. Logic Rules

1. **由今日／聽日開始** 只決定 D1/D2；購物項目跟每餐日期
2. 18:00 後 default「由聽日開始」
3. 衝突：第一版只提供「取代（確認）／取消」
4. 份量可改、記住
5. 禁忌用**食材**過濾；素食改 slot；素湯檢查食材
6. 加入 default member；owner 可改 helper
7. Free 2／Pro 4；第 3 人 → Paywall
8. 提醒只喺「未計劃或未買齊」時發；deep link 去 Shopping **all**
9. Swap 按 slot、排除現有＋14 日＋禁忌
10. Dry-run 同 commit 同一函式
11. 手動項目唔同步；誤撳 Undo
12. 勾選只寫已選；0 道停用
13. 日期一律 HK 時區
14. Shopping 冇分享；邀請只喺 Kitchen Settings
15. 同名食材：第一版接受重複；之後按 name+unit 分組

---

## 7. 技術設計

### 7.1 Backend `quickPlan`
| Procedure | 行為 |
|---|---|
| `suggest` | 回傳 8 道（每餐日期）+ 摘要 + 衝突；不寫入 |
| `swap` | 按 date + slot 換 |
| `accept` | 只寫已選；每道用自己日期；transaction；幂等 |

- 重用：`officialRecipes`、`getRecipeIngredients`、`addShoppingItems`
- 幂等 key：`(familyId, date, mealType, recipeId)` + `clientRequestId`
- 角色：owner/helper confirmed；member pending（**mealPlan 同 shopping 一致**）
- ⚠️ 現時 `shopping.add` 對 member + helper 都要審批，`mealPlan.add` 只對 member → 要統一

### 7.2 購物
- 每個食譜每個食材一行（保留 provenance：`fromMealPlanId` / `fromRecipeId`）
- 第一版：按日期顯示，接受重複行
- Post-launch：同名同單位顯示層分組 + 展開 + 部分已買 `1/3`
- 換菜同步：更新 plan → 刪舊 `fromMealPlanId` 行 → 加新行（有已買先確認）

### 7.3 飲食過濾
- 用食材名 + alias，不用單字 substring
- 例：`牛` 要排除 `牛油`、`牛油果`；保留 `牛肉/牛腩/牛丸`
- 素食：排除肉／海鮮／肉湯底；slot = 菜 + 豆腐/蛋 + 菜 + 素湯
- 食譜不足 → 明確提示 + fallback（減一道／換 slot）

### 7.4 提醒
- 第一版：local notification，**具名 ID**，唔用 `cancelAllScheduledNotificationsAsync()`
- Post-launch：server push（cron + push tokens + `lastSentAt`）
- 設定存 `families.settings` JSONB → `updateFamilySettings` 必須 **merge**，唔可以覆蓋

### 7.5 付款平台政策（重要）
| 平台 | 合法方式 | 備註 |
|---|---|---|
| Web | Stripe | 現有 `billing` router 已實作 |
| Android | **Google Play Billing** | 數位訂閱必須用 Play Billing；**唔可以**用 Stripe |
| iOS | **Apple IAP** | Guideline 3.1.1 |

**Launch 建議：**
- **Web 收錢（Stripe）優先**
- Android：可先免費上架（隱藏購買），或完成 Play Billing 才收錢
- iOS：完成 IAP 後才上架

> ⚠️ 現時 `lib/purchase.ts` 仍將 Android 當 Stripe → 上架前必須處理，否則有 Play 政策風險。

---

## 8. 開發架構（Post-launch OTA）

```
app/(tabs)/home-v2.tsx        ← 隱藏 route（href: null）
src/screens/HomeV2.tsx        ← 新首頁
src/screens/HomeLegacy.tsx    ← Legacy 搬遷（OTA 時才做）
```

- 上線前：**唔碰 `app/(tabs)/index.tsx`**
- Post-launch OTA：
  1. `git mv app/(tabs)/index.tsx src/screens/HomeLegacy.tsx`（純搬遷）
  2. `index.tsx` 變成 ~10 行 flag switch
  3. `HomeV2` 用 **lazy import + ErrorBoundary**
  4. 第一版用 `libraryOnly` 重用 Legacy 搜尋／篩選／grid
  5. Flag 預設 off → 內部 → 10% → 100%
- 穩定一版後才抽出 `RecipeLibrarySection`，再刪 `HomeLegacy`

**Flag：** PostHog（需入 EAS env）；離線 fallback = Legacy。

---

## 9. 階段

### 上線前（Launch）
| Phase | 內容 | 日 |
|---|---|---|
| **P-1** | 備份 + restore 演練 + tags | 0.5 |
| **L1** | 小修正（空 `#`、meta、tab 改名、Pro promo gate）**唔碰 index.tsx** | 0.5 |
| **L2** | Web Stripe Live + 測試；Android 付款決策 | 0.5–1 |
| **L3** | Privacy／Terms／截圖／OTA signing／build／提交 | 3.5–4.5 |
| **Launch** | Legacy（Web；Android 免費或 Play Billing） | — |

### 上線後（Post-launch）
| Phase | 內容 | 日 |
|---|---|---|
| **O1** | CI（GitHub Actions）+ visual regression | 1–1.5 |
| **O2** | Component 拆分（零行為改動） | 1.5–2 |
| **O3** | Flag 生命週期 + runbook | 0.5 |
| **O4** | Sentry release health + rollout gate | 0.5 |
| **O5** | HomeV2 + Onboarding 3 屏 | 4–5 |
| **O6** | Shopping 分組 + 模板 + 飲食過濾 | 3–4 |
| **O7** | Server push + AI Chef | 2.5–3.5 |
| **O8** | Android Play Billing | 2–3 |
| **O9** | iOS IAP + build + 上架 | 4–6 |

**目標：** Web 上線約 4 週；新 UX 上線後 2–4 週。

---

## 10. 驗收

### P-1
- [ ] 兩個 repo tag 並已 push
- [ ] 新鮮 DB dump，`pg_restore -l` 可讀
- [ ] Scratch DB restore 成功，counts 一致
- [ ] 本機 + 雲端備份
- [ ] Web rollback 演練成功

### Launch
- [ ] `BETA_ALL_PAID=false`
- [ ] Stripe Live 成功／取消／portal
- [ ] Privacy／Terms URL 統一且可訪問
- [ ] Pro 用戶零升級 promo
- [ ] OTA code signing 已入 build
- [ ] CI PR gate 綠
- [ ] Staged rollout 設定
- [ ] Sentry release health gate

### Post-launch（新 UX）
- [ ] 開 app → 見菜單 ≤ 3 次點擊
- [ ] Onboarding 完成已有 2 日菜單
- [ ] 18:30 → default 由聽日開始
- [ ] 勾選只寫已選；0 道停用
- [ ] 購物項目分 D1／D2；all view 見到兩日
- [ ] Home 進度跨兩日合計
- [ ] 換菜自動同步；有已買先確認
- [ ] 素食／唔食牛／海鮮／辣食材過濾生效
- [ ] 4 語言零中文；原有 11 e2e 全綠
- [ ] Flag 可即時關閉回 Legacy
- [ ] Legacy 穩定一版後才刪

---

## 11. 風險 / Rollback

| 風險 | 對策 |
|---|---|
| Launch 被 UI 阻塞 | Launch binary 不含 HomeV2 |
| HomeV2 回歸 | flag + Legacy 保留 |
| 寫入錯誤 | transaction + 幂等 + dry-run |
| 提醒互相清除 | 具名 ID；禁用 `cancelAll` |
| Settings 被覆蓋 | `updateFamilySettings` merge |
| 飲食過濾誤殺 | alias 清單 + 測試 |
| i18n 漂移 | `audit-i18n --strict` |
| Android 用 Stripe | 改用 Play Billing 或隱藏購買 |
| OTA 未簽名 | Launch build 前配置 code signing |
| 壞版擴散 | staged rollout + crash-free gate |

詳細步驟見 `ROLLBACK_RUNBOOK.md`。

---

## 12. 業界紀律（低成本、高回報）

1. **CI PR gate**：`tsc` + `ci-gate` + smoke e2e
2. **Staged rollout**：Play 5%→20%→50%→100%；App Store Phased Release
3. **Sentry release health**：crash-free ≥ 99.5% 才擴量
4. **OTA code signing**：必須喺 Launch build 前完成
5. **Flag 生命週期**：owner + 到期日；Legacy 一版後刪
6. **Backend 兼容**：只做加法；舊 app 仍可用

---

## 13. 外部依賴（你嘅動作）

- Stripe Live keys／price／webhook／portal
- Privacy／Terms／Support 頁上線
- App Store / Play Console 資產與問卷
- Apple 合約／稅務／銀行（iOS IAP）
- Google Play service account（Android）
- EAS env：PostHog、Sentry

---

## 14. 假設

- Railway Postgres（Singapore）為正式 DB；Supabase 只作 fallback
- 現有 60 users / 1 family 為測試資料
- `expo-notifications` 已在 binary
- HomeV2 不需要新 native module
- OTA runtimeVersion 保持 `appVersion`

---

## 15. V1.1 — HomeV2 + Onboarding（上線後 OTA）

> **已鎖定：Launch 之後才做。** 不用 5 人 usability test；改用 dogfooding + analytics + flag 擴量。

### 15.1 範圍

**做（V1.1 Core）**
- HomeV2：Hero（由今日／聽日、1／2 日）→ 一撳
- Preview：8 道、全選、右邊 `[換]`、份量、每日數量
- Backend `quickPlan`：suggest／swap／accept
- Onboarding 3 屏（S3 重用 Preview）
- 購物項目跟每餐日期；accept 後跳 Shopping
- 小修正：空 `#`、meta、tab 名、Pro promo gate
- Flag：`HOME_V2`／`QUICKPLAN`／`ONBOARDING_V2`（預設 off）

**留 V1.2+**
- Shopping 同名合併＋展開
- 4 個餸菜模板
- 完整飲食過濾（V1.1 只做基本四項）
- Server push（V1.1 先用 local + flag）
- AI Chef Refine
- `?code=` 邀請連結
- iOS IAP／Android Play Billing

### 15.2 次序（Walking Skeleton）

| # | 工作 | 日 |
|---|---|---|
| 1 | CI + visual baseline | 1–1.5 |
| 2 | Backend `quickPlan` + 整合測試 | 2 |
| 3 | 搬 Legacy + flag switch + hidden route + `libraryOnly` | 1–1.5 |
| 4 | HomeV2 上半部（Hero → 一撳） | 2 |
| 5 | Preview（勾選／換／份量） | 1.5 |
| 6 | Onboarding 3 屏 + 失敗狀態 | 1.5 |
| 7 | 驗證（4 語言／角色／RWD／parity） | 2 |

**合計：10–11.5 日**

> **唔係先做 Onboarding。** Onboarding 依賴 Preview + quickPlan，所以放最後。

### 15.3 Backend

- `suggest`：8 道（D1/D2）+ 摘要 + 衝突；不寫入
- `swap`：按 `date + slot`；排除現有＋14 日＋禁忌
- `accept`：只寫已選；每道用自己日期；transaction；幂等
- 角色：owner/helper confirmed；member pending（meal + shopping 一致）
- 冪等 key：`(familyId, date, mealType, recipeId)` + `clientRequestId`
- 時區：HK date helper
- 衝突：第一版只提供「取代（確認）／取消」
- 飲食：食材 alias；素食改 slot
- Prefs：`families.settings.quickPlanPrefs`；`updateFamilySettings` 必須 merge

### 15.4 Analytics（代替 5 人測試）

`home_v2_exposed`、`quickplan_started`、`quickplan_generated`（duration）、`quickplan_swapped`（slot）、`quickplan_accepted`（selected count／days）、`quickplan_abandoned`、`onboarding_completed`、`time_to_first_plan`、`shopping_opened_from_plan`

**Rollout gates**
| 指標 | 行動 |
|---|---|
| abandon > 40% | 停擴量，修正 |
| swap > 50% | 檢查食譜質素／slot |
| time-to-first-plan > 60s | 檢查效能／流程 |
| crash-free < 99.5% | flag off |

### 15.5 驗收

- [ ] 開 app → 見菜單 ≤ 3 次點擊
- [ ] Onboarding 完成已有 2 日菜單
- [ ] 18:30 → default 由聽日開始
- [ ] 勾選只寫已選；0 道停用
- [ ] 購物分 D1／D2；all view 見到兩日
- [ ] Home 進度跨兩日合計
- [ ] 換菜自動同步；有已買先確認
- [ ] 素食／唔食牛／海鮮／辣食材過濾
- [ ] 4 語言零中文；原有 11 e2e 全綠
- [ ] Flag 可即時回 Legacy
- [ ] Legacy 穩定一版後才刪
- [ ] Parity checklist 逐項簽核

### 15.6 Rollout

```
OTA（flag off）→ 內部 dogfooding → 10% → 50% → 100%
```

- 每階段 24–48 小時
- crash-free / abandon 指標達標才擴量
- 有問題：flag off 或 republish 上一個 OTA
