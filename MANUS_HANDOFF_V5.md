# Kindcipe for Manus v5

## 已完成
- tRPC router type 已改為直接 export backend `AppRouter`。
- `eslint.config.js` 已加入 `e2e/**/*.js` globals。
- `e2e/ai-chef.smoke.test.js` 已對齊 Manus v4 流程，移除 `try/catch`。
- `app/(tabs)/index.tsx`、`app/(tabs)/planner.tsx`、`app/pantry.tsx`、`app/shopping-templates.tsx` 已統一成功提示。
- `app/recipe/[id].tsx` 與 `src/components/RecipeCard.tsx` 的 `expo-image` 型別問題已修。
- `tsc --noEmit --project tsconfig.json` 已通過。
- `npx eslint` 對已改動檔案已通過。

## 交付重點檔案
- `eslint.config.js`
- `lib/router-types.ts`
- `lib/trpc.ts`
- `e2e/ai-chef.smoke.test.js`
- `e2e/jest.config.js`
- `app/(tabs)/index.tsx`
- `app/(tabs)/planner.tsx`
- `app/pantry.tsx`
- `app/shopping-templates.tsx`
- `app/recipe/[id].tsx`
- `src/components/RecipeCard.tsx`
- `src/components/Toast.tsx`

## 備註
- repo 內仍有一些非核心檔案改動與本機產物，打 zip 前可只收上面清單。
- 不建議包含 `node_modules/`、`.expo/`、`dist/`、`.DS_Store`。
