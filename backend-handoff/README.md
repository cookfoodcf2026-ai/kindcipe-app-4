# backend-handoff

呢個資料夾係**交後端**嘅工具骨架，唔屬前端 app bundle（已排除出 `tsconfig`，唔會影響前端 build / typecheck / CI gate）。

## 內容
- `backfill-recipe-classification.ts` — 一次性 backfill 舊食譜嘅 `recipeCategory` / `dishType` / `tags`（+ 湯種 tag）。

## 用法
1. Copy 去後端 repo，例如 `kindcipe-backend/scripts/backfill-recipe-classification.ts`。
2. 實作兩個 TODO adapter：
   - `RecipeStore`（DB/ORM：findBatch / update）
   - `LlmClient`（用現有 DashScope / Qwen client，`classify(prompt)` 回 parsed JSON）
3. 解除檔尾 `main()` 註解。
4. 先 dry-run：
   ```bash
   npx tsx scripts/backfill-recipe-classification.ts --dry-run --limit=20
   ```
5. 確認冇問題再寫入：
   ```bash
   npx tsx scripts/backfill-recipe-classification.ts --write --batch=5
   ```

## 相關 spec
- `RECIPE-CLASSIFICATION-SPEC.md`（分類/必填/backfill）
- `DISHTYPE-UNIFICATION-SPEC.md`（dishType canonical）
