# Kindcipe — 上架前風險分析與行動計劃

> 產品經理 + App 生產視角，基於開發期間實際遇到嘅問題，預測上架後風險（按嚴重度排序）。

---

## P0 — 會燒錢 / 破壞信任（上架即刻見）

### 1. AI 成本冇上限（最大風險）—— ✅ 已完成
- **Quota 已存在**：AI 對話 **30（免費）/ 300（付費）次/月**；自訂食譜 20/月（付費無限）；匯入 5/300 次/月。
- **扣法（已確認）**：`aiRecipe.chat` 只喺 **`llmUsed = true`（真係用咗 AI）先扣**，每 request 扣 1 次（媒體圖計 2）。
  - 純 library 命中 → 唔扣。
  - AI 生成 3餸1湯 → 扣 1 次。
  - library 夾雜 AI 補缺 → 扣 1 次（用幾多 AI 扣幾多，合理）。
- **weekly menu AI**：已 hidden（`SHOW_EXPERIMENTAL_AI = false`），暫唔係 user-facing。

### 2. 生成慢 + 唔可靠 —— 進展中
- **事實**：3餸1湯 15-30s；timeout 會缺卡（實際撞過「3 卡」bug）。
- **風險**：用戶等唔切流失；timeout 出唔齊餐。
- **進展**：
  - ✅ library-first 優先（即時，~1-2s），AI 只做後備。
  - ✅ 保證 ≥4 卡（no-steps filter + 兜底）。
  - ✅ AI 加速：`maxRetries 1` + `maxTokens 1600`（~30s → ~15-25s）。
  - ✅ model 確認係快嘅 `qwen3.7-flash`；15-25s 係 LLM 生成完整食譜嘅合理上限。
  - ⏳ 樂觀 UI（先顯示 loading 卡）未做。

### 3. 分類準確度（任意 / 多語言用戶內容）—— 進展中
- **事實**：蠔油 bug；而家用 LLM-at-ingest。
- **風險**：LLM 都會錯；Instagram 匯入嘅亂名菜式。
- **進展**：
  - ✅ ingest 時 LLM classify（匯入/自訂/AI save 自動判 dishType + 儲存）。
  - ✅ 已 backfill 218 條（177 custom + 41 official）。
  - ✅ 修正 veg 誤判（菜名含蔬菜字優先過蛋白 tag）。
  - ✅ AI 去重：fuzzy（threshold 0.6）+ 更大排除名單 + 近似提示；菜位嚴格真蔬菜（清淡、唔配肉、重試一次）。
  - ⏳ 用戶可改 dishType（recipe-editor 已有）；regex 兜底已存在。

---

## P1 — 會降低體驗

### 4. 內容 / 資料唔夠
- 314 條官方食譜，對「食譜庫 app」嚟講偏薄；AI / 自訂食譜好多冇靚圖（placeholder）。
- **風險**：感覺空泛。
- **建議**：seed 多啲官方食譜 + 圖；激勵 UGC。

### 5. 去重 UX
- 7 日 seen window 會阻用戶「返睇」鍾意嗰道菜。
- **建議**：per-recipe「唔好再推」+ 較短 window。

### 6. Scale infra
- `aiChefSeenRecipes` 每家庭無限增長；memory map；自訂食譜 >1000 永遠唔出。
- **建議**：cleanup job + index；adaptive pool limit。

---

## P2 — 打磨

### 7. Moderation / Privacy
- 匯入 / 公開食譜要審核；family scoping 測試（唔好跨家庭洩漏）。

### 8. 變現 / 廣告 UX
- AI Chef 個 AdSlot + Pro paywall —— 太 intrusive 會破壞「智能廚師」感覺。

### 9. Onboarding
- 新用戶冇自訂食譜，全官方 → 感覺 generic；3餸1湯 4 步問卷有流失風險。

---

## 建議優先次序（上架前最值得做嘅 Top 3）
1. ~~**AI 成本 quota**~~ ✅ **已完成**（對話 30/300、自訂 20、匯入 5/300；weekly menu AI 已 hidden）
2. **library-first 穩定返 4 卡 + 更快**（防流失 / 缺卡）—— 進展中（AI 生成已減 retry + maxTokens 加速）
3. **內容填充**（官方食譜 + 圖，令 app 唔空泛）

---

## 未做清單
| 項 | 內容 | 狀態 |
|---|---|---|
| P0-1 | AI 成本 quota | ✅ 已完成（對話 30/300、自訂 20、匯入 5/300；扣法已確認：llmUsed 先扣，每 request 1 次；weekly menu AI 已 hidden）|
| P0-2 | library-first 穩定 4 卡 + 更快 | ✅ 已完成（library-first 出 4 卡；AI：maxRetries 1 + maxTokens 1800；meal 生成 2 候選/類型並行 + pickDiverseMeal 任何時候都行（湯+菜+肉+海鮮各一），缺類型由 backfill 補；generateOneType soft（新鮮優先，揀唔到都保底出卡）→ 保證 4 卡唔會跌去 1 卡/食譜庫；source 跟 button：AI→AI 卡、食譜庫→食譜庫卡；client timeout 45s→90s + 友善超時提示；Promise.allSettled 一個 slot 死唔拖冧成餐 + LLM 非 JSON 乾淨 error + 友善提示）|
| P0-3 | 分類準確度 | 進展中（ingest LLM 已做 + backfill 218；fuzzy 去重 0.6 + 菜位嚴格真蔬菜；AI meal 每個 slot 見晒「出過嘅菜/湯」+ 撞重複 retry 出新 → 湯水同餸都唔重複、有新意）|
| #4 | 內容填充 | ❌ 未做 |
| #5 | 去重 UX | ❌ 未做 |
| #6 | Scale infra | ❌ 未做 |
| #7 | Moderation / privacy | ❌ 未做 |
| #8 | 變現 / 廣告 UX | ❌ 未做 |
| #9 | Onboarding | ❌ 未做 |

