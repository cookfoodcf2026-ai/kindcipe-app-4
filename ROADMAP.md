# Kindcipe — 上架路線圖（Phase Roadmap）

> 剩餘工作分組。已完成嘅放最頂，未做嘅按優先次序排。

---

## ✅ 已完成（本輪開發 session）
- **AI 生成核心修復**
  - 保證 4 卡（1 湯 + 菜 + 肉 + 海鮮/蛋白質 各一），唔再跌去 1 卡 / 食譜庫 fallback。
  - 速度（並行 2 候選/類型 + `pickDiverseMeal` 一輪揀，~13-20s）。
  - 唔死機（`Promise.allSettled` 一個 slot 死唔拖冧成餐 + LLM 非 JSON 乾淨 error + 友善提示）。
  - source 跟 button（AI → AI 卡、食譜庫 → 食譜庫卡）。
  - 湯水 / 餸菜唔重複、有新意（每個 slot 見晒「出過嘅菜/湯」+ 撞重複 retry）。
  - hero card 開獨立新 session（唔連去舊對話）。
  - client timeout 45s → 90s + 友善超時提示。
- **API 開通按量付費**（DashScope `qwen3.7-flash`，$0.03 輸入 / $0.13 輸出 每百萬 token），AI 已恢復正常。
- **P0-1 AI 成本 quota**：對話 30（免費）/300（付費）次/月、自訂 20、匯入 5/300；`llmUsed` 先扣。

---

## 🔴 Phase 1 — 上架（最緊要，正式分發）
- [ ] **EAS Build**（iOS + Android build、上傳 App Store Connect / Play Console）
- [ ] **商店資料**：截圖、描述、分類、關鍵字、icon
- [ ] **IAP 設定**：`kindcipe_monthly_30` / `kindcipe_yearly_288` + App Store Connect product
- [ ] **Apple 小企業計劃**（年收入 < US$1M → 抽成 30% → 15%，慳一半）
- [ ] **私隱政策 + 合規**（AI 食譜內容、數據收集、App Privacy label）
- [ ] **上架前 gate**：`check-env`、`ci-gate`、`npm run build` 通過

---

## 🟠 Phase 2 — 成本控制（公開後防失控）
- [ ] **下調免費額度**：AI 30 次/月 對公開 app 可能太闊（1000 用戶 = 大量成本）
- [ ] **每月成本預警**（百煉控制台消費預警 + Railway 用量）
- [ ] 免費額度「用完 → paywall」轉化漏斗檢討

---

## 🟡 Phase 3 — 內容填充（令 app 唔空泛）
- [ ] Seed 更多官方食譜（而家 314 條偏薄）
- [ ] 補靚圖（AI / 自訂食譜好多 placeholder）

---

## 🟢 Phase 4 — 去重 UX + Scale
- [ ] Per-recipe「唔好再推」+ 較短 seen window（而家 7 日 / 40 條）
- [ ] `aiChefSeenRecipes` 無限增長 → cleanup job + index
- [ ] 自訂食譜 >1000 永遠唔出 → adaptive pool limit

---

## 🔵 Phase 5 — 打磨 / 合規
- [ ] **分類準確度收尾**（P0-3：用戶可改 dishType、regex 兜底 verify）
- [ ] **Moderation / privacy**：匯入 / 公開食譜審核、family scoping 防跨家庭洩漏
- [ ] **變現 / 廣告 UX**：AdSlot + Pro paywall（唔好太 intrusive）
- [ ] **Onboarding**：新用戶冇自訂食譜 → 感覺 generic；3餸1湯 4 步問卷流失

---

## 🔗 閉環 + Tiny Habits（BJ Fogg × Instagram）— 習慣養成

**閉環（撳下一撳）**：AI出餐 → 加入排餐 → 生成清單 → 買餸 → 再買
（功能已存在，重點係「習慣化」UX，唔係新起功能）

**Fogg Behavior Model 對應**：
- **Prompt**：黃昏提醒 / hero card
- **Tiny**：一撳「今晚食咩」= hero card ✅（Phase 1）
- **Variable reward**：每日新鮮餐單建議
- **Investment**：加入排餐 / 再買 / streak

### Phase 2 — 錨點 + 閉環「一撳接一撳」
- [x] **加入購物清單 →「去買餸」CTA**（4 入口一致：AI chat / 食譜詳情 / 首頁 / 聚會買餸單；**持久化底部確認卡** `ShoppingAddConfirm`：唔自動消失，撳「去買餸」跳 shopping tab 或「關閉」）
- [x] **每日提醒（黃昏提示）**（settings 可自訂時間 + 重複：每日/指定星期幾；expo-notifications；撳通知跳 home tab hero card；時間用打字輸入 HH:MM（零 native 依賴）+ 星期幾一至日全顯示）
- [x] 加入排餐 → 生成清單（已連好，唔郁）
- [x] 排餐 → shopping 清單自動帶入（已連好，唔郁）

### Phase 3 — 慶祝 + 回訪（Instagram 式）
- [ ] streak / 每日「已計劃 / 已煮」徽章（Celebrate）
- [ ] 個人化（按屋企人食開）→ 內容啱先會日日返
- [ ] 每日新鮮（已修湯 / 餸重複）
- [ ] 分享今晚餐單（社交 validation）

---

## ⚡ 效能優化（導航「撳一下」即見）
- [x] **A：Revert 錯用/可疑改動**（getById `placeholderData` 已還原、blurhash 已還原、`family.get` 已還原返基線）—— 消除「比唔改仲慢」嘅 regression
- [x] **B：購物車分類卡 memoize（local-state）**（每個分類卡自己 `useState(true)` 管收放 → toggle 只 re-render 張卡自己，唔再等成個 screen 重算，箭咀即時反應；淨係 `shopping.tsx`）
- [x] **C：食譜詳情 prefetch**（`index.tsx` 列表背景預載頭 12 個 `getById`）—— 撳食譜落去即刻見，唔再第一次空白 3 秒（已驗證 OK）
- [ ] **D：backend keep-alive**（暫唔郁 —— `/health` 量度 ~0.2s 已 warm，非 cold start；3 秒係 getById 網絡 fetch，已由 C 解決）

---

## 建議優先次序（上架前必做）
1. **Phase 1（上架）** —— 唔做就冇法正式分發。
2. **Phase 2（成本控制）** —— 公開後即刻要，防燒錢。
3. **Phase 3-5** —— 上架後逐步打磨。

---

## 成本參考（業務）
- 一次 AI 3餸1湯 ≈ **HK$0.02**（~12 次 LLM call，每次輸出 ~1,500 token）。
- 付費月費 HK$30 / 年費 HK$288；LLM 每月 300 次都只係 ~HK$6 → **LLM 毛利 ~80%**。
- 真正減項：Apple/Google IAP 抽成（30%，小企業計劃 15%）、固定基建（Railway + Postgres + 圖片儲存）。
