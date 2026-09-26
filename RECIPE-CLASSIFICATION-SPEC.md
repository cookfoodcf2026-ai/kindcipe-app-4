# 食譜分類（recipeCategory / dishType / tags）— Backend Spec

> 狀態：**Backend-only spec**（此 repo 只有前端）
> 目標：令食譜有**正確、無誤導**嘅菜系、菜式類型、標籤；匯入由 AI 自動分類；缺漏一律 server 擋。

---

## 1. 背景 / 問題

- **parse 唔回分類**：`parsedRecipe` 合約（前端已加 `recipeCategory/dishType/tags?`）目前後端**冇回**，前端唯有靜默 fallback（已移除）。
- **舊英文分類**：舊官方食譜 `recipeCategory` 存咗 `poultry / pork / beef / seafood / vegetable / egg / carb / mixed`——呢啲係「食材分類」**唔係菜系**，造成誤導資料。
- **AI 生成冇 dishType**：3 餸 1 湯／換卡抽錯。
- 前端已改做「必填 + 唔亂猜」，但**正確值只能靠後端**。

## 2. Canonical 值

### 2.1 菜系（recipeCategory）
`中菜 / 西餐 / 日式 / 韓式 / 東南亞 / 港式 / 台式 / 泰式 / 印度 / 甜品 / 飲品 / 其他`

### 2.2 菜式類型（dishType）
`meat / seafood / vegetable / soup / carb / appetizer / dessert / drink / other`
（詳見 `DISHTYPE-UNIFICATION-SPEC.md`）

### 2.3 標籤（tags）
自由字串陣列，**最少 1 個**。

## 3. API 契約

### 3.1 Parse endpoints 回傳加欄位
`recipes.parseUrl` / `parseText` / `parseImage` 回傳：
```
recipeCategory?: string   // canonical 菜系
dishType?: string         // canonical key
tags?: string[]
```
由 LLM 分析產生；唔確定時可省略（前端會要求用戶揀）。

### 3.2 AI 生成
`aiRecipe.chat`（mode `ai`）每個食譜必出 `dishType`（建議埋 `recipeCategory`、`tags`）。

### 3.3 寫入 mutations
`importUser` / `updateUser` / `createBlank` / `adminCreateOfficial` / `adminUpdateOfficial` 接受 `recipeCategory` + `dishType` + `tags`。

### 3.4 讀取
`listOfficial` / `listUser` / `listKol` / `search` / `getById` / `aiRecipe.chat.recipes[]` 回傳上述欄位。

## 4. Server-side 強制
- `importUser` / `updateUser` / `createBlank` / `adminCreateOfficial`：
  - `recipeCategory` 必須屬 canonical 菜系
  - `dishType` 必須屬 canonical key
  - `tags` 最少 1 個
  - 缺 → `BAD_REQUEST`，訊息清楚（前端已做本地驗證 + 一次過提示，後端做第二道防線）。
- `adminUpdateOfficial`：唔可以清走 `dishType`；未傳時保留原值。

## 5. Backfill（現有資料）
一次性 script：
1. 掃所有 recipes（official / user / kol）。
2. 用 LLM 重新分類：
   - `recipeCategory`（正確菜系）
   - `dishType`（canonical key）
   - `tags`（補齊，最少 1 個）
3. 特別處理舊英文值（`poultry/pork/.../mixed`）→ 分類去正確菜系（**唔好一律當中菜**）。
4. Log 統計：各值分佈、仍 fallback `other` 嘅數量（人工覆核）。

> 順序：**先 backfill，後 enforce**。

## 6. 前端已配合（本 repo）
- `lib/taxonomy.ts`：canonical 菜系 + `normalizeCuisine()`（舊英文值 → null，唔誤導）+ `SUGGESTED_TAGS`。
- `lib/dishType.ts`：canonical dishType + normalize。
- 匯入 / 自訂 / admin：分類、菜式類型、標籤（≥1）**必填**；缺漏**一次過 Alert**；移除靜默預設。
- 舊英文分類值 → 前端顯示「未揀」狀態逼用戶揀，直到後端 backfill 修正。
- AI 生成：目前前端用 `getDishType()` 兜底；**後端一旦回傳 dishType，前端可移除兜底**。

## 7. 驗收
- [ ] 三個 parse endpoint 有回 `recipeCategory/dishType/tags`。
- [ ] AI 生成食譜 100% 有 dishType。
- [ ] 缺任一必填 → server `BAD_REQUEST`。
- [ ] 舊英文分類 backfill 後變成正確菜系（非大量「其他」）。
- [ ] 讀取 API 全回傳上述欄位。
- [ ] 卡顯示／3 餸 1 湯／換卡分類正確。
