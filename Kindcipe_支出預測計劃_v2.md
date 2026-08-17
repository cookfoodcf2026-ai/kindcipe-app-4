# Kindcipe 支出預測計劃 v2

> 後端 repo：`/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-backend`
>
> 前端 repo：`/Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4`
>
> 兩個 repo 獨立。

## 核心定義

- 1 個廚房 = 1 份訂閱
- quota 係 family-level pool，不是 per-user
- 收入預測分母係廚房數，不是用戶數
- 家庭成員共享同一個 quota、同一筆訂閱費
- 「廚房」與「household」統一視作同一個產品單位

## 現 code 校正

### 已確認

- `family.subscription` 已存在
- `getFamilySubscription(familyId)` 係 family-level
- `importUsage` 已經以 `familyId` 記錄
- `aiRecipe.chat` 已有 quota check
- `weeklyMenu.aiSuggest` 免費版走規則式，不會打 LLM；付費版先用 LLM

### 仍需修正

- `recipes.ts` 的 `parseUrl`
- `recipes.ts` 的 `parseText`
- `recipes.ts` 的 `parseImage`

以上三個入口目前會先打 LLM，quota check 擺錯位，係真正成本漏洞。

## 定價定案

| 層級 | 價格 | 匯入上限 | AI 對話 | 週餐單 | Enforcement |
|---|---:|---:|---|---|---|
| 免費 | HK$0 | 20/月 | ❌ 封 | 視產品策略 | parse 前 hard cap |
| 月費 | HK$30 | 200/月（fair usage） | ✅ | ✅ | soft cap，只記錄與提示 |
| 年費 | HK$288 | 300/月（fair usage） | ✅ | ✅ | soft cap，只記錄與提示 |

## 月支出模型

```text
月總支出 = 固定成本 + 免費層成本 + 付費層成本
```

### 固定成本

- Railway
- Supabase
- R2
- Apple Developer fee 攤分

### 變動成本

- Qwen LLM
- RapidAPI Instagram scraper
- YouTube Data API v3

## 成本估算

### 免費層

```text
免費層成本 = 免費廚房數 × min(人均匯入, 20) × 單次 parse 成本
```

### 付費層

```text
付費層成本 = 付費廚房數 × fair usage 估算 × 單次成本
```

> weekly menu 免費版係規則式，不計 LLM 成本。

## 三情境

假設付費廚房人均 AI 3 次/日、週餐單 2 次/月。

| 情境 | 免費廚房 | 付費廚房 | 月收入（扣 Apple 15%） | 月支出 | Margin |
|---|---:|---:|---:|---:|---:|
| 保守 | 0 | 0 | HK$0 | HK$457 | - |
| 目標 | 1,800 | 200 | HK$5,100 | HK$4,761 | +7.1% |
| 樂觀 | 8,500 | 1,500 | HK$38,250 | HK$29,034 | +31.8% |

## Break-even

- 固定成本約 HK$457/月
- 只要約 19 個付費廚房，第一個月已可 cover 固定成本
- 早期最重要目標不是 200 廚房，而是先跑到 break-even

## Launch 前要做的工程

### P0

1. `recipes.ts` 三個 parse 入口加 quota check
2. 免費 import cap 改為 20
3. `app/ai-chef.tsx` 做 subscription gating
4. Weekly Menu 入口做一致的升級提示

### P1

1. 加 `llm_usage_logs`
2. 每次 LLM call 寫 log
3. 用真實 usage 重算 margin

## 驗證標準

- 免費戶 `parseUrl` 第 21 次 → 403
- 免費戶 `parseText` → 403
- 免費戶 `parseImage` → 403
- 免費戶開 app 見到 AI 廚師升級畫面
- `weeklyMenu.aiSuggest` 免費版不產生 LLM cost

## 結論

- 真正漏洞只有 parse 入口 quota 擺錯位
- `aiRecipe.chat` 已有防護
- `weeklyMenu.aiSuggest` 免費版唔燒 LLM
- family-level quota 方向正確，毋須改做 user-level
- 封好 parse 入口後，成本先會可控
