# Kindcipe — 上架前風險分析與行動計劃

> 產品經理 + App 生產視角，基於開發期間實際遇到嘅問題，預測上架後風險（按嚴重度排序）。

---

## P0 — 會燒錢 / 破壞信任（上架即刻見）

### 1. AI 成本冇上限（最大風險）
- **事實**：每餐 3餸1湯 = 並行 4 次 LLM call；hotkey / AI 生成 / 換 / 匯入分類全部 call LLM。用戶愈多，成本線性爆。
- **風險**：冇 quota / cap → 失控開支。
- **建議**：
  - per-family / per-day LLM quota
  - library-first（用 DB，唔 call LLM）做主力
  - 分類用平價 model
  - 批量處理

### 2. 生成慢 + 唔可靠
- **事實**：3餸1湯 15-30s；timeout 會缺卡（實際撞過「3 卡」bug）。
- **風險**：用戶等唔切流失；timeout 出唔齊餐。
- **建議**：
  - library-first 優先（即時），AI 只做後備
  - 樂觀 UI（先顯示 loading 卡）
  - 保證永遠 ≥4 卡

### 3. 分類準確度（任意 / 多語言用戶內容）
- **事實**：蠔油 bug；而家用 LLM-at-ingest。
- **風險**：LLM 都會錯；Instagram 匯入嘅亂名菜式。
- **建議**：
  - ingest 時 LLM classify（已做）
  - 用戶可改 dishType
  - regex 兜底

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
| P0-1 | AI 成本 quota | ✅ 已完成（對話 30/300、自訂 20、匯入 5/300；weekly menu AI 已 hidden）|
| P0-2 | library-first 穩定 4 卡 + 更快 | 進展中（3餸1湯 AI：maxRetries 1 + maxTokens 1600，rules 不變；library-first 已出 4 卡）|
| P0-3 | 分類準確度 | 部分（ingest LLM 已做，兜底未完善）|
| #4 | 內容填充 | ❌ 未做 |
| #5 | 去重 UX | ❌ 未做 |
| #6 | Scale infra | ❌ 未做 |
| #7 | Moderation / privacy | ❌ 未做 |
| #8 | 變現 / 廣告 UX | ❌ 未做 |
| #9 | Onboarding | ❌ 未做 |

