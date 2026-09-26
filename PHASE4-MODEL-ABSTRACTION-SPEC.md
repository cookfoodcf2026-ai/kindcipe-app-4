# Phase 4 — LLM Model Abstraction + Eval Harness (Backend Spec)

> 狀態：**Backend-only spec**（此 repo 只有前端，無法實作）
> 目標：令 LLM 供應商／模型可以透過 config 切換，並用自有 eval set 以數據決定是否換 model。
> 預設 **唔會** 改變現狀：生產繼續用 Qwen（DashScope），成本／行為不變。

---

## 1. 背景

- 現時 `aiRecipe.chat`、`recipes.parse*`、翻譯等由後端呼叫 **DashScope / Qwen**（見 privacy policy）。
- 供應商定價／版本變動頻繁（peak/off-peak、model 退役），需要低成本試新 model 而唔改 code。
- 已知參考定價（2026-09，僅供參考，落決定前對官方頁）：
  - Qwen3.7 Flash：input ~$0.03 / output ~$0.13 per 1M
  - DeepSeek V4.1 Flash：input $0.15–0.30 / output $0.60–1.20 per 1M（off-peak/peak）
  - → 換 DeepSeek **唔會** 降成本。

## 2. 設計原則

1. **Default = 現狀**：`AI_MODEL` 未設定時，回落到現用 Qwen model id。
2. **零回歸**：Qwen 路徑嘅 request/response 格式、prompt、JSON 解析**完全不變**。
3. **Vision 與 Text 分開設定**：換 text model 時唔可以影響「拍雪櫃認食材」嘅 vision 流程。
4. **可觀測**：每次 call log model id + token usage + latency + parse 成功／失敗。
5. **可回滾**：feature flag 一撳即回 Qwen。

## 3. Config 介面

```ts
// server/config/ai.ts
interface AIModelConfig {
  provider: "dashscope" | "deepseek" | "openai-compatible";
  model: string;            // e.g. "qwen3.7-flash" | "deepseek-flash"
  baseUrl?: string;         // override for OpenAI-compatible endpoints
  apiKeyEnv: string;        // e.g. "DASHSCOPE_API_KEY"
  supportsVision: boolean;
  thinkingEnabled?: boolean; // DeepSeek: 預設 true，短回覆建議 false
  maxOutputTokens?: number;
}

const DEFAULTS = {
  text:   { provider: "dashscope", model: "qwen3.7-flash", apiKeyEnv: "DASHSCOPE_API_KEY", supportsVision: true },
  vision: { provider: "dashscope", model: "qwen3.7-flash", apiKeyEnv: "DASHSCOPE_API_KEY", supportsVision: true },
};
```

Env：
- `AI_MODEL_TEXT`（default `qwen3.7-flash`）
- `AI_MODEL_VISION`（default `qwen3.7-flash`）
- `AI_PROVIDER_TEXT` / `AI_PROVIDER_VISION`（default `dashscope`）

**開機驗證**：若指定 model 缺 api key 或不支援 vision（但 vision 路徑需要），立即 fallback 落 default 並 log error，**唔可以 crash**。

## 4. Provider Adapter

```ts
interface ChatAdapter {
  chat(req: {
    messages: { role: "system" | "user" | "assistant"; content: unknown }[];
    mode: "chat" | "ai" | "library";
    json?: boolean;
    maxTokens?: number;
  }): Promise<{ content: string; usage?: TokenUsage; raw?: unknown }>;
  vision(req: { messages: ...; imageUrl: string }): Promise<{ content: string }>;
}
```

- `DashScopeAdapter`：**保留現有實作原封不動**。
- `OpenAICompatAdapter`：處理 `baseUrl` + `response_format: { type: "json_object" }`（DeepSeek 需要 prompt 內含 "json" 字樣）。
- `aiRecipe.chat` 只依賴 `ChatAdapter` 介面，唔直接 call SDK。

## 5. Eval Harness（dev-only script）

**位置**：`server/evals/`（唔 ship 落 app，零生產成本）。

**Golden set**（`evals/cases.jsonl`），每條：
```json
{ "id": "hk-001", "input": "一送一湯", "mode": "ai", "expect": { "type": "recipe", "expectedCount": 2 } }
{ "id": "hk-002", "input": "整3餸1湯", "mode": "ai", "expect": { "type": "recipe", "expectedCount": 4 } }
{ "id": "can-001", "input": "琴日買咗芥蘭同排骨，可以煮咩", "mode": "chat", "expect": { "type": "text" } }
{ "id": "img-001", "input": "<fridge.jpg>", "mode": "vision", "expect": { "type": "ingredients", "minMatches": 3 } }
{ "id": "soup-001", "input": "煲咩老火湯好", "mode": "library", "expect": { "dishType": "soup" } }
```
建議覆蓋：廣東話口語、X餸Y湯、圖片認食材、library 搜尋、忌口、甜/湯分類。

**Metrics（每個 model 跑同一 set）**：
| Metric | 計法 | 目標 |
|---|---|---|
| JSON parse 成功率 | valid JSON / total | 越高越好 |
| `isValidRecipe` 通過率 | 通過卡數 / 回傳卡數 | ≥ 現用 Qwen 基準 |
| 卡數準確率 | 實際卡數 == expectedCount | ≥ 現用 |
| dishType 準確率 | 分類正確 / total | ≥ 現用 |
| 廣東話質素 | 人工 1–5 分抽樣 | ≥ 現用 |
| Vision 命中率 | 認到正確食材 / 期望 | ≥ 現用 |
| p50 / p95 latency | ms | 唔可明顯差過現用 |
| 每次生成成本 | token × 定價 | 記錄，非硬性 |

**判定**：候選 model 要 **全部質量 metric ≥ Qwen 基準**，且成本／latency 可接受，先可灰度。

## 6. 灰度與回滾

1. Feature flag `AI_ROLLOUT`（0 = 全 Qwen，100 = 全候選）。
2. 先 5% family → 觀察 24h（error rate、parse fail、用戶重試）。
3. 異常即 flag=0。
4. 切換 provider 前必須更新 privacy policy（現時明寫 DashScope/Qwen）並通知用戶。

## 7. 驗收條件

- [ ] 未設 env 時，行為／成本與現狀完全一致。
- [ ] 設 `AI_MODEL_TEXT=deepseek-flash` 後，text 路徑切換成功，vision 仍用 Qwen。
- [ ] 缺 key／錯 config 時 fallback 落 default，唔 crash。
- [ ] eval script 可一鍵比較 2+ model 並輸出上述 metrics 表。
- [ ] 每次 call log provider/model/usage/latency/parse-result。
- [ ] privacy policy 已更新（如需換 provider）。

## 8. 成本估算（落實 eval 時）

- 跑一次 eval：50 case × ~4k tokens × 2 model ≈ 40 萬 tokens → **約 $0.01–0.10**。
- 1000 case 級數都係 **幾蚊**；屬開發測試成本，唔影響生產。
