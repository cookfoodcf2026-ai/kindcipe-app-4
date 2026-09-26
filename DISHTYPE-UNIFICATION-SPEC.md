# dishType 統一 + Backfill — Backend Spec

> 狀態：**Backend-only spec**（此 repo 只有前端，無法實作）
> 目標：令「菜式類型（dishType）」有單一權威值、官方食譜全部有值、新增／編輯強制填寫，並讓 AI 生成食譜都帶值。

---

## 1. 背景 / 問題

- 前端有 **3 套唔一致** 嘅分類：
  - `recipe-editor`：主菜/海鮮/蔬菜/湯水/甜品/飲品（存**中文**，缺 飯麵、前菜、其他）
  - `admin.getMealType`：主菜/湯水/飯麵/蔬菜/前菜小吃/甜品/飲品（缺 海鮮）
  - `ai-chef`：meat/seafood/vegetable/soup/dessert/drink/other（**英文**，缺 carb/appetizer）
- admin「菜式類型分佈」**唔用 stored dishType**，自己用菜名/tags 推斷 → 反映 stored 值唔可靠。
- 分類遷移工具只處理 cuisine，**冇帶 dishType** → 有機會清走。
- 後果：3餸1湯／換卡／按類型出卡時抽錯或抽唔到（例：要求「湯」出「椒鹽九吐魚」）。

## 2. Canonical 定義（唯一權威）

**儲存值用英文 key**：

| key | 中文 | 說明 |
|---|---|---|
| `meat` | 肉類主菜 | 豬/牛/雞/羊/鴨/鵝 |
| `seafood` | 海鮮/蛋白 | 魚/蝦/蟹/貝/豆腐蛋 |
| `vegetable` | 蔬菜/小炒 | 菜/瓜/菇/豆 |
| `soup` | 湯水 | 老火湯/滾湯/羹 |
| `carb` | 飯麵/主食 | 飯/麵/粉/粥/包 |
| `appetizer` | 前菜/小食 | 沙律/涼拌/小食 |
| `dessert` | 甜品 | 糖水/糕點 |
| `drink` | 飲品 | 茶飲/果汁/涼茶 |
| `other` | 其他 | 未分類 |

舊中文值（`主菜`/`海鮮`/`蔬菜`/`湯水`/`甜品`/`飲品`）一律 map 去上面 key。

## 3. API 契約

所有會寫入食譜嘅 mutation 加 `dishType`（canonical key）：
- `recipes.importUser`
- `recipes.updateUser`
- `recipes.createBlank`
- `recipes.adminCreateOfficial`
- `recipes.adminUpdateOfficial`

所有讀取食譜嘅 output（`listOfficial` / `listUser` / `search` / `getById` / `aiRecipe.chat.recipes[]`）**必須回傳 `dishType`**。

> 前端契約檔 `lib/router-types.ts` 已加 `dishType?: string`（Import/Update/CreateOfficial）。

## 4. Server-side 強制

- `importUser` / `updateUser` / `createBlank` / `adminCreateOfficial`：**dishType 必填**，缺 → 回 `BAD_REQUEST` 帶清楚訊息「請選擇菜式類型」。
- `aiRecipe.chat`（mode `ai`）：LLM system prompt 要求逐個食譜輸出 `dishType`（九選一）；後端 responsible 去 normalize（未知 → `other`）。
- `adminUpdateOfficial`：唔可以清走 dishType；未傳時保留原值。

## 5. Backfill（現有資料）

一次性 migration script：
1. 掃所有 recipes（official / user / kol），`dishType` 空或唔屬九 key → 用 LLM classify（或 name-based fallback）。
2. 寫入 canonical key。
3. log 統計：每個 key 幾多條、仍然 fallback `other` 幾多條（人工覆核）。

建議順序：**先 backfill，後 enforce**，避免 admin 一改舊食譜就被擋。

## 6. 遷移工具修正

`MigrateCategoriesCard`（前端）已改為**帶埋 `r.dishType`**；後端 `adminUpdateOfficial` 需接受並保留。

## 7. 驗收

- [ ] 新匯入／編輯食譜，冇 dishType 一律被 server 擋。
- [ ] AI 生成食譜 100% 有 dishType（canonical key）。
- [ ] 官方食譜 backfill 後，`dishType` 分佈合理（非大量 `other`）。
- [ ] `aiRecipe.chat` library mode 依 dishType 抽「湯/肉/海鮮/菜/飯麵」正確。
- [ ] list/search/getById 回傳 dishType。
- [ ] 舊餐單／已排餐冇壞（dishType 只影響生成/分類，唔影響顯示）。

## 8. 前端已配合（本 repo）

- `lib/dishType.ts`：canonical keys + `normalizeDishType()` + `inferDishTypeKeyFromName()`。
- import / editor / admin 加 dishType selector，**空 → 唔准 save**。
- `ai-chef.ensureSaved` 用 `getDishType()` 自動兜底（永不空）。
- i18n：`enums.dishType.*`（zh-TW/en/fil/id）。
