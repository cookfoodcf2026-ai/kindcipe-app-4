# ✅ 網紅食譜 Search Filter 實施完成

**實施日期**: 2026-08-28  
**狀態**: ✅ 完成  
**影響範圍**: 前端 + 後端

---

## 📋 實施咗咩

### 1. 後端改动（Backend）

#### ✅ 更新 `recipes.search` endpoint
- **文件**: `kindcipe-backend/server/routers/recipes.ts`
- **改动**:
  - 擴展 `source` enum 加入 `"kol"` 值
  - 加 KOL 過濾邏輯（篩選 `source_type IN ('kol', 'instagram', 'youtube', 'xiaohongshu', 'threads', 'tiktok')`）
  - 返回 `kolCount` 統計數據

**關鍵代碼**:
```typescript
// KOL 過濾邏輯
if (input.source === "kol") {
  shouldQueryCustom = true;
  customConditions.push(
    or(
      eq(customRecipes.sourceType, "kol"),
      eq(customRecipes.sourceType, "instagram"),
      eq(customRecipes.sourceType, "youtube"),
      eq(customRecipes.sourceType, "xiaohongshu"),
      eq(customRecipes.sourceType, "threads"),
      eq(customRecipes.sourceType, "tiktok")
    )
  );
}

// 返回 kolCount
return { recipes, total, officialCount, customCount, kolCount, nextCursor };
```

---

### 2. 前端改动（Frontend）

#### ✅ 更新 `useRecipeSearch` Hook
- **文件**: `hooks/useRecipeSearch.ts`
- **改动**:
  - 更新 `UseRecipeSearchOptions` 接口支持 `source = "kol"`
  - 新增 `kolCount` 返回值

#### ✅ 更新 `FilterModal` 組件
- **文件**: `src/components/FilterModal.tsx`
- **改动**:
  - 更新 `viewMode` 类型支持 `"kol"`
  - 新增 `kolCount` prop
  - 加「🌟 網紅食譜」篩選按鈕（喺「官方食譜」同「我的食譜」之間）

**視覺效果**:
```
食譜來源：
[全部食譜 100] [🍳 官方食譜 50] [🌟 網紅食譜 10] [📝 我的食譜 40]
```

#### ✅ 更新 Home Page
- **文件**: `app/(tabs)/index.tsx`
- **改动**:
  - 更新 `viewMode` 状态支持 `"kol"`
  - 加 KOL 過濾邏輯（`filteredRecipes`）
  - 更新 `filterSummary` 顯示「🌟 網紅食譜」
  - 传递 `kolCount` 到 FilterModal

---

## 🎯 用戶體驗流程

### 方法 1：Filter Modal（主要）
```
用戶打開 Home Page
    ↓
擰「篩選」按鈕（Filter 圖標）
    ↓
揀「🌟 網紅食譜」按鈕
    ↓
食譜列表淨係顯示 KOL 食譜
    ↓
可以繼續用其他篩選（菜式分類、烹調時間等）
```

### 方法 2：More Page 入口
```
用戶打開 More Page
    ↓
撳「🌟 網紅食譜」按鈕
    ↓
去到專門嘅 KOL 食譜列表頁（`/recipes?source=kol`）
    ↓
每個食譜都可以收藏
```

---

## 📊 KOL 食譜定義

而家系統中，KOL 食譜包括：
- `source_type = 'kol'`（手動標記）
- `source_type = 'instagram'`
- `source_type = 'youtube'`
- `source_type = 'xiaohongshu'`（小紅書）
- `source_type = 'threads'`
- `source_type = 'tiktok'`

**Admin 管理方法**:
1. 進入 Admin Page (`/admin`)
2. 撳個食譜右側嘅「標記 KOL」按鈕
3. 或者直接新增食譜時選「🌟 網紅食譜」Toggle

---

## 🔧 技術細節

### 數據流
```
FilterModal (Frontend)
    ↓ setViewMode("kol")
useRecipeSearch Hook
    ↓ source: "kol"
tRPC recipes.search (Backend)
    ↓
customConditions.push(source_type IN [...])
    ↓
DB Query (custom_recipes 表)
    ↓
返回 recipes + kolCount
    ↓
顯示喺食譜列表
```

### 性能優化
- ✅ 後端計算 `kolCount` 獨立統計
- ✅ 前端使用 `debouncedQuery` 減少不必要請求
- ✅ 支持 Infinite Scroll（分頁加載）
- ✅ 支持緩存（`staleTime: 30000`）

---

## ✅ 測試清單

### 必須測試
- [ ] 開 Filter Modal，睇到「🌟 網紅食譜」按鈕
- [ ] 撳「🌟 網紅食譜」，列表淨係顯示 KOL 食譜
- [ ] Filter 顯示正確嘅 KOL 數量
- [ ] KOL 食譜可以正常收藏
- [ ] 可以組合其他篩選條件（例如：KOL + 30 分鐘內）

### 建議測試
- [ ] 唔同來源嘅 KOL 食譜（IG / YouTube / 小紅書）
- [ ] Admin 標記新 KOL 食譜後，Filter 自動更新
- [ ] KOL 食譜數量變化時，count 正確更新
- [ ] 搜尋 + Filter 同時使用（例如：搜尋「雞」+ KOL 篩選）

---

## 🚨 已知限制

1. **KOL 內容填充**
   - 而家需要 Admin 手動標記
   - 建議未來加批量导入工具

2. **KOL 歸屬**
   - 收藏 KOL 食譜時會 Copy 數據
   - 原 KOL 食譜刪除後，用戶仍保留收藏版本

3. **計數邏輯**
   - `kolCount` 只包括未刪除嘅 KOL 食譜
   - 已收藏嘅 KOL 食譜唔會重複計算

---

## 📈 未來優化建議

### Phase 4（可選）
1. **KOL 專屬 Badge**
   - 喺食譜卡片顯示 KOL 作者頭像/名稱
   - 點擊可以睇呢個 KOL 嘅全部食譜

2. **KOL 關注系統**
   - 用戶可以 Follow 特定 KOL
   - KOL 出新食譜時 Push 通知

3. **KOL 排行榜**
   - 按瀏覽量/收藏量排序
   - 每週/每月 Top 10 KOL

4. **KOL 專屬 Filter**
   - 按平台篩選（只顯示 IG / 只顯示 YouTube）
   - 按 KOL 作者篩選

---

## 🎉 完成！

所有改动已經完成，可以開始測試。

**下一步**:
1. 測試 Filter Modal 嘅 KOL 篩選功能
2. 填充一啲 KOL 食譜內容（通过 Admin Page）
3. 收集用戶反饋
4. 根據反饋優化 KOL 體驗
