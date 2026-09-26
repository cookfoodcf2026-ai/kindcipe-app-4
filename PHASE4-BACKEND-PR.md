# Phase 4 — Backend PR Description（可貼去後端 repo）

> 用途：直接複製下面內容去後端 repo 開 PR。
> 相關前端 spec：`PHASE4-MODEL-ABSTRACTION-SPEC.md`（本 repo）

---

**Title:** `feat(ai): pluggable LLM provider + offline eval harness (default unchanged)`

## Summary

令 LLM 供應商／模型可以透過 env 切換，並加入離線 eval harness 用數據決定換唔換 model。

**預設零改動**：未設 env 時，`aiRecipe.chat` / `recipes.parse*` / 翻譯全部照用現有 **DashScope / Qwen3.7 Flash**，行為同成本完全不變。

## Motivation

- 供應商定價／版本變動頻繁（peak/off-peak、model 退役）。
- 需要低成本 A/B 新 model，而唔使改 code、唔使重 deploy 邏輯。
- 已知 DeepSeek V4.1 Flash 比 Qwen3.7 Flash **貴幾倍**，所以唔可以盲換；要用自有 dataset 量度質素先決定。

## Changes

### 1. Config（`server/config/ai.ts`）
- `AI_MODEL_TEXT`、`AI_MODEL_VISION`、`AI_PROVIDER_TEXT`、`AI_PROVIDER_VISION`
- 未設定 → default `qwen3.7-flash` / `dashscope`
- **開機驗證**：指定 model 缺 key 或 vision 不支援時 → fallback default + log error，不 crash
- **Vision 與 Text 分開**：換 text model 唔影響「拍雪櫃認食材」

### 2. Provider Adapter
- `ChatAdapter` 介面：`chat()` / `vision()`
- `DashScopeAdapter`：**現有實作原封不動**
- `OpenAICompatAdapter`：支援 `baseUrl` + `response_format: { type: "json_object" }`（DeepSeek 需 prompt 含 "json"）
- `aiRecipe.chat` 只依賴介面，唔直接 call SDK

### 3. Observability
- 每次 call log：`provider` / `model` / `usage` / `latency` / `jsonParseOk`

### 4. Eval Harness（`server/evals/`，dev-only，唔 ship）
- `cases.jsonl` golden set（廣東話口語、X餸Y湯、圖片認食材、library 搜尋、忌口、甜/湯分類）
- 一鍵比較 2+ model，輸出 metrics：JSON parse 成功率、`isValidRecipe` 通過率、卡數準確率、dishType 準確率、vision 命中率、p50/p95 latency、每次成本
- 判定準則：候選要**全部質量 metric ≥ Qwen 基準**先可灰度

### 5. Rollout
- Feature flag `AI_ROLLOUT`（0=全 Qwen，100=全候選）
- 5% → 觀察 24h → 異常即回 0
- 換 provider 前更新 privacy policy（現時明寫 DashScope/Qwen）

## Testing

- [ ] 未設 env：行為／成本同 main 一致（contract test）
- [ ] `AI_MODEL_TEXT=deepseek-flash`：text 切換成功，vision 仍 Qwen
- [ ] 缺 `DASHSCOPE_API_KEY` / 錯 model id：fallback default，不 crash
- [ ] `npm run eval -- --models qwen3.7-flash,deepseek-flash` 出到完整 metrics 表
- [ ] log 每個 call 有 provider/model/usage/latency/parse-result

## Rollback

- 設 `AI_ROLLOUT=0` 即時回 Qwen；adapter 保留 Qwen path，無需 revert code。

## Risk

| 風險 | 防護 |
|---|---|
| Config 讀錯 → 生產換錯 model | default fallback + 開機驗證 + flag |
| 抽象層改動影響 JSON 解析 | 只抽 model 選擇，唔改 parsing；contract test |
| 換 provider → 合規問題 | 灰度前更新 privacy policy |

## Notes

- 呢個 PR **唔會** 改任何預設行為；純粹加「可換」能力 + 量度工具。
- 實作前請先對官方定價頁確認（Qwen 因地區有別）。

---

## 建議 commit 拆分
1. `feat(ai): add PluggedLLM config with qwen default`
2. `refactor(ai): extract ChatAdapter, keep DashScope path`
3. `feat(ai): add OpenAI-compatible adapter`
4. `chore(ai): log provider/model/usage/latency`
5. `test(ai): add eval harness + golden set`
6. `feat(ai): rollout flag AI_ROLLOUT`
