# ✅ KOL 網紅食譜 + 收藏系統實施完成

**實施日期**: 2026-08-28  
**狀態**: ✅ 完成  
**影響範圍**: 零風險、加碼式改动（Additive-only）

---

## 📋 實施咗咩

### 1. 後端改动（Backend）

#### ✅ Schema 更新
- **文件**: `kindcipe-backend/drizzle/schema.ts`
- **改动**:
  - 新增 `user_recipe_collections` 表（收藏關係表）
  - 擴展 `source_type` enum 加入 `"kol"` 值

#### ✅ tRPC Endpoints 新增
- **文件**: `kindcipe-backend/server/routers/recipes.ts`
- **新增 endpoints**:
  - `recipes.toggleCollection` - 切換收藏狀態
  - `recipes.listCollections` - 撈用戶收藏咗嘅食譜
  - `recipes.listKol` - 撈全部 KOL 食譜（source_type = kol/instagram/youtube/等）

#### ✅ Migration
- **文件**: `drizzle/migrations/0014_tiny_tombstone.sql`
- **內容**:
  ```sql
  ALTER TYPE "public"."source_type" ADD VALUE 'kol';
  CREATE TABLE "user_recipe_collections" (...);
  CREATE UNIQUE INDEX "user_recipe_collections_user_recipe_unique" (...);
  CREATE INDEX "user_recipe_collections_user_idx" (...);
  ```

---

### 2. 前端改动（Frontend）

#### ✅ 新增組件
- **文件**: `kindcipe-app-4/src/components/CollectionButton.tsx`
- **功能**: 
  - 收藏/取消收藏按鈕
  - 自動顯示收藏狀態（實心/空心書籤）
  - Loading 狀態處理
  - 錯誤處理

#### ✅ 新增頁面
- **文件**: `kindcipe-app-4/app/recipes.tsx`
- **功能**:
  - 支援 `source` 參數（official / kol / user）
  - 顯示對應分類嘅食譜列表
  - 每個食譜卡片顯示收藏按鈕
  - Refresh Control 支持
  - 空狀態處理

#### ✅ 修改 More Page
- **文件**: `kindcipe-app-4/app/(tabs)/more.tsx`
- **改动**:
  - 啟用「網紅食譜」按鈕（之前係 `goToComingSoon`）
  - 更新 `goToRecipes` 函數支持 `"kol"` 參數
  - 導航到 `/recipes?source=kol`

#### ✅ 修改食譜詳情頁
- **文件**: `kindcipe-app-4/app/recipe/[id].tsx`
- **改动**:
  - 加入 `CollectionButton` 組件
  - 喺 Hero Image 區域顯示收藏按鈕（Back 按鈕隔離）
  - 自動判斷食譜類型（official / custom）

---

## 🎯 用戶體驗流程

### 收藏食譜
```
用戶打開食譜詳情頁
    ↓
按右上角「書籤」按鈕
    ↓
後端記錄收藏關係（user_recipe_collections 表）
    ↓
按鈕變成實心書籤（已收藏狀態）
```

### 查看網紅食譜
```
More Page → 按「🌟 網紅食譜」
    ↓
去到 /recipes?source=kol
    ↓
顯示全部 KOL 食譜（source_type = kol/instagram/youtube/等）
    ↓
每個食譜卡片都有收藏按鈕
```

### 查看收藏咗嘅食譜
```
而家嘅收藏咗嘅食譜會同時出現喺：
1. 「網紅食譜」頁面（因為佢本身係 KOL 食譜）
2. 「我的食譜」頁面（因為用戶收藏咗佢）
```

**注意**: 而家「我的食譜」主要顯示用戶自己創建/匯入嘅食譜。收藏咗嘅 KOL 食譜會通過 `listCollections` endpoint 撈取，可以之後考慮喺「我的食譜」加個 Tab 專門顯示收藏。

---

## 📊 數據結構

### `user_recipe_collections` 表
| Column | Type | Description |
|---|---|---|
| `id` | serial | 主鍵 |
| `user_id` | text | 用戶 ID |
| `recipe_id` | varchar(64) | 食譜 ID（可以係 official 或 custom） |
| `recipe_type` | varchar(16) | 食譜類型（"official" 或 "custom"） |
| `created_at` | timestamp | 收藏時間 |

**Unique Constraint**: `(user_id, recipe_id, recipe_type)` - 確保一個用戶對同一個食譜只有一條收藏記錄

---

## ✅ 測試清單

### 必須測試
- [ ] More Page 按「網紅食譜」按鈕，成功跳轉到食譜列表
- [ ] 網紅食譜列表正確顯示 KOL 食譜
- [ ] 食譜詳情頁按收藏按鈕，成功切換收藏狀態
- [ ] 已收藏嘅食譜喺列表中顯示實心書籤
- [ ] 未收藏嘅食譜喺列表中顯示空心書籤
- [ ] 收藏狀態刷新後保持一致
- [ ] 無網絡時收藏操作有錯誤提示

### 建議測試
- [ ] 同一個食譜重複按收藏按鈕（toggle 功能）
- [ ] 唔同來源嘅 KOL 食譜（IG / YouTube / 小紅書）
- [ ] 官方食譜都可以收藏
- [ ] 用戶自建食譜都可以收藏
- [ ] 收藏咗嘅食譜可以喺「我的食譜」通過 `listCollections` 撈到

---

## 🚀 後續優化建議

### Phase 4（可選）
1. **「我的食譜」分 Tab**
   - Tab 1: 自建食譜
   - Tab 2: 收藏食譜
   - 文件：`app/recipes.tsx` 或新建 `app/my-recipes.tsx`

2. **KOL 食譜篩選**
   - 按 KOL 作者篩選
   - 按平台篩選（IG / YouTube / 小紅書）
   - 按熱門程度排序

3. **收藏管理**
   - 批量取消收藏
   - 收藏時間排序
   - 收藏筆記功能

4. **視覺優化**
   - 收藏按鈕動畫效果
   - 已收藏 Badge 顯示喺食譜卡片
   - 收藏數量統計

---

## 🔧 技術細節

### 零風險設計
- ✅ 無改动現有表結構（只加新表）
- ✅ 無修改現有 endpoints（只加新 endpoints）
- ✅ 無破壞現有 UI（只加新頁面/按鈕）
- ✅ 所有改动係 Additive-only
- ✅ 可以隨時回滾（刪咗新表/ endpoints 就得）

### 性能優化
- ✅ `listKol` 限制最大 100 條記錄
- ✅ 支持 offset 分頁
- ✅ 使用 `staleTime` 減少不必要嘅請求
- ✅ 收藏按鈕本地狀態 + 異步更新

---

## 📞 需要用戶提供嘅嘢

### 內容填充（Phase 5）
1. **KOL 食譜清單**
   - 邊啲食譜應該標記為 `source_type = 'kol'`？
   - 有冇心水 KOL 作者（例如 @daydaycook）？

2. **Featured 食譜**（可選）
   - 邊啲 KOL 食譜應該放喺 Home Page Featured Carousel？
   - 需不需要加 `featured_rank` / `featured_category` 字段？

---

## 🔧 Admin 管理 KOL 食譜

### 使用方法
1. 登入 Admin 帳號
2. 進入 **Admin Page**（`/admin`）
3. 喺「官方食譜」列表入面，每個食譜都有 **「標記 KOL」按鈕**
4. 撳一下就可以將個食譜標記為 KOL 食譜
5. 再撳一下就變返做普通官方食譜

### 視覺提示
- **已標記 KOL**：黃色背景 + 「KOL」字 + 星標 Badge（⭐ 網紅食譜）
- **未標記**：灰色背景 + 「標記 KOL」字

### 技術細節
- **按鈕位置**：每個食譜卡片右側（刪除按鈕隔離）
- **後端更新**：調用 `adminUpdateOfficial` endpoint，設置 `sourceType = 'kol'`

### SQL 示例（批量標記）
```sql
-- 批量標記多個食譜為 KOL
UPDATE official_recipes SET
  source_type = 'kol',
  source_author = '@daydaycook'
WHERE id IN (1, 2, 3, 4, 5);

-- 查詢所有 KOL 食譜
SELECT id, name, source_author, source_type
FROM official_recipes
WHERE source_type = 'kol'
ORDER BY created_at DESC;
```

### SQL 示例（手動新增 KOL 食譜）
```sql
-- 或者直接 Insert 新嘅 KOL 食譜
INSERT INTO official_recipes (
  imported_by_user_id, name, description,
  thumbnail_url, cook_time, servings, difficulty,
  recipe_category, ingredients, steps, tags,
  source_type, source_author, is_active
) VALUES (
  'user_123', 'KOL 紅燒肉', '由 @daydaycook 分享',
  'https://...', 45, 4, '中等',
  'main', '[]', '[]', '["豬肉", "家常菜"]',
  'kol', '@daydaycook', true
);
```

---

## 🎉 完成！

所有改动已經完成，可以開始測試。如果有任何問題或者需要優化，隨時通知我！

**下一步建議**:
1. 測試收藏功能
2. 填充 KOL 食譜內容
3. 收集用戶反饋
4. 根據反饋優化 Phase 4 功能
