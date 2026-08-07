# 🔧 設定外出功能修復計劃

## 📋 問題總結

### 當前問題
1. **權限限制過嚴**：只有 owner/admin 可以設定外出，成員無法使用
2. **錯誤處理不完善**：刪除排餐失敗時可能影響外出設定
3. **用戶體驗差**：顯示「設定外出失敗」但無具體原因
4. **類型不匹配**：`setByUserId` 期望 text 但 `ctx.user.id` 可能是數字

### 根本原因
**文件：** `kindcipe-backend/server/routers/weeklyMenu.ts:679-681`

當前代碼嚴格限制只有 owner/admin 可以設定外出，這導致普通成員無法使用此功能。

---

## ✅ 修復目標

1. **所有家庭成員都可以設定外出**（owner/admin/member）
2. **設定外出操作永遠成功**（即使刪除排餐失敗）
3. **改進錯誤處理**（記錄日誌但不阻擋用戶）
4. **前端友好提示**（清晰的成功/警告信息）

---

## 📝 實施步驟

### 階段 1：後端修復（核心）⭐

#### 修改 1.1：移除權限限制

**文件：** `kindcipe-backend/server/routers/weeklyMenu.ts`
**位置：** 第 679-681 行

**修改前：**
```typescript
if (ctx.activeFamilyRole !== "owner" && ctx.activeFamilyRole !== "admin") {
  throw new TRPCError({ code: "FORBIDDEN", message: "Only family owner or admin can modify the weekly menu" });
}
if (!ctx.activeFamilyId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active family" });
```

**修改後：**
```typescript
// 只檢查是否有 active family，不限制角色
// 所有家庭成員（owner/admin/member）都可以設定外出
if (!ctx.activeFamilyId) {
  throw new TRPCError({ code: "BAD_REQUEST", message: "請先加入家庭廚房" });
}
```

**理由：**
- 設定外出是日常操作，不應限制權限
- 保持與其他成員操作的一致性
- 符合用戶直覺

---

#### 修改 1.2：改進刪除排餐的錯誤處理

**文件：** `kindcipe-backend/server/routers/weeklyMenu.ts`
**位置：** 第 692-706 行

**修改前：**
```typescript
if (input.eatOut) {
  try {
    await db.delete(mealPlans).where(...);
  } catch (e) {
    console.error("Failed to delete meal plans when setting eatOut:", e);
    // Continue with eatOut setting, don't block
  }
}
```

**修改後：**
```typescript
if (input.eatOut) {
  try {
    await db.delete(mealPlans).where(
      and(
        eq(mealPlans.familyId, ctx.activeFamilyId),
        eq(mealPlans.date, dateStr),
        eq(mealPlans.mealType, "dinner")
      )
    );
  } catch (e) {
    // 記錄詳細錯誤日誌，但不阻擋外出設定
    console.error("[setEatOut] Failed to delete meal plans:", {
      error: e,
      familyId: ctx.activeFamilyId,
      date: dateStr,
    });
    // 繼續設定外出，不拋出錯誤
  }
}
```

**理由：**
- 詳細的錯誤日誌幫助調試
- 刪除排餐失敗不影響外出設定
- 確保功能可用性優先

---

#### 修改 1.3：改進 Upsert 操作的錯誤處理

**文件：** `kindcipe-backend/server/routers/weeklyMenu.ts`
**位置：** 第 708-745 行

**修改前：**
```typescript
// Upsert: delete existing row for this day, then insert new one with eatOut flag
await db.delete(weeklyMenu).where(...);
await db.insert(weeklyMenu).values({...});
return { success: true };
```

**修改後：**
```typescript
try {
  // 使用事務確保原子性
  await db.transaction(async (tx) => {
    await tx.delete(weeklyMenu).where(
      and(
        eq(weeklyMenu.weekStart, input.weekStart),
        eq(weeklyMenu.dayOfWeek, input.dayOfWeek),
        eq(weeklyMenu.familyId, ctx.activeFamilyId)
      )
    );

    await tx.insert(weeklyMenu).values({
      familyId: ctx.activeFamilyId,
      weekStart: input.weekStart,
      dayOfWeek: input.dayOfWeek,
      meatId: null,
      meatName: null,
      meatImage: null,
      meatCookTime: null,
      seafoodId: null,
      seafoodName: null,
      seafoodImage: null,
      seafoodCookTime: null,
      vegId: null,
      vegName: null,
      vegImage: null,
      vegCookTime: null,
      soupId: null,
      soupName: null,
      soupImage: null,
      soupCookTime: null,
      eatOut: input.eatOut,
      sponsorName: null,
      sponsorUrl: null,
      sponsorLogoUrl: null,
      setByUserId: String(ctx.user.id), // 確保類型為 text
    });
  });

  return { success: true };
} catch (e) {
  // 記錄錯誤但盡量不拋出
  console.error("[setEatOut] Failed to upsert weekly menu:", {
    error: e,
    familyId: ctx.activeFamilyId,
    weekStart: input.weekStart,
    dayOfWeek: input.dayOfWeek,
  });
  
  // 嘗試直接插入（忽略重複）
  try {
    await db.insert(weeklyMenu).values({
      familyId: ctx.activeFamilyId,
      weekStart: input.weekStart,
      dayOfWeek: input.dayOfWeek,
      meatId: null,
      meatName: null,
      meatImage: null,
      meatCookTime: null,
      seafoodId: null,
      seafoodName: null,
      seafoodImage: null,
      seafoodCookTime: null,
      vegId: null,
      vegName: null,
      vegImage: null,
      vegCookTime: null,
      soupId: null,
      soupName: null,
      soupImage: null,
      soupCookTime: null,
      eatOut: input.eatOut,
      sponsorName: null,
      sponsorUrl: null,
      sponsorLogoUrl: null,
      setByUserId: String(ctx.user.id),
    }).onConflictDoUpdate({
      target: [weeklyMenu.weekStart, weeklyMenu.dayOfWeek, weeklyMenu.familyId],
      set: { eatOut: input.eatOut, updatedAt: new Date() },
    });
    
    return { success: true, warning: "外出已設定，但部分操作可能需要重試" };
  } catch (retryError) {
    // 最終失敗，拋出錯誤
    console.error("[setEatOut] Final upsert failed:", retryError);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "設定外出失敗，請稍後再試",
    });
  }
}
```

**理由：**
- 事務確保數據一致性
- 重試機制提高成功率
- 類型轉換避免數據庫錯誤

---

### 階段 2：前端優化（用戶體驗）

#### 修改 2.1：改進錯誤提示

**文件：** `kindcipe-app-4/app/(tabs)/planner.tsx`
**位置：** 第 269-274 行

**修改前：**
```typescript
onError: (err, variables, context) => {
  if (context?.previousData) {
    utils.weeklyMenu.getWeek.setData({ weekStart: startDate }, context.previousData);
  }
  setToast({ visible: true, message: `設定外出失敗`, type: "error" });
},
```

**修改後：**
```typescript
onError: (err, variables, context) => {
  if (context?.previousData) {
    utils.weeklyMenu.getWeek.setData({ weekStart: startDate }, context.previousData);
  }
  
  // 根據錯誤類型顯示不同提示
  let message = "設定外出失敗";
  if (err.message?.includes("請先加入家庭廚房")) {
    message = "請先加入家庭廚房才能設定外出";
  } else if (err.message?.includes("稍後再試")) {
    message = "設定外出失敗，請稍後再試";
  } else if (err.data?.code === "FORBIDDEN") {
    message = "權限不足，請聯繫管理員";
  }
  
  setToast({ visible: true, message, type: "error" });
},
```

**理由：**
- 清晰的錯誤信息幫助用戶理解問題
- 提供具體的解決建議

---

#### 修改 2.2：成功提示優化

**文件：** `kindcipe-app-4/app/(tabs)/planner.tsx`
**位置：** 第 230-232 行

**修改前：**
```typescript
onSuccess: () => {
  Alert.alert("已設定");
},
```

**修改後：**
```typescript
onSuccess: (result) => {
  if (result.warning) {
    // 有部分警告，顯示完整信息
    Alert.alert("外出設定成功", result.warning, [{ text: "知道了" }]);
  } else {
    // 完全成功
    setToast({ visible: true, message: "已設定外出", type: "success" });
  }
},
```

**理由：**
- 區分完全成功和部分成功
- Toast 比 Alert 更輕量，不干擾用戶

---

## 📊 修改文件清單

| 文件 | 修改內容 | 預估行數 | 優先級 |
|-----|---------|---------|-------|
| `kindcipe-backend/server/routers/weeklyMenu.ts` | 移除權限限制 + 改進錯誤處理 | 679-745 行 | ⭐⭐⭐ 高 |
| `kindcipe-app-4/app/(tabs)/planner.tsx` | 改進錯誤提示 + 成功提示 | 230-274 行 | ⭐⭐ 中 |

---

## 🧪 測試計劃

### 測試場景 1：Owner 設定外出
- [ ] 設定今天為外出 → 成功
- [ ] 設定明天為外出 → 成功
- [ ] 取消外出 → 成功

### 測試場景 2：Member 設定外出
- [ ] 以成員身份登入
- [ ] 設定今天為外出 → 成功（權限修復後）

### 測試場景 3：外出 + 排餐衝突
- [ ] 今天已有排餐，設定外出
- [ ] 預期：排餐被自動清除，外出設定成功
- [ ] 前端顯示：「外出用餐 [今天]」

### 測試場景 4：數據庫異常
- [ ] 模擬數據庫連接失敗
- [ ] 預期：顯示友好錯誤信息，不崩潰

---

## ⚠️ 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|-----|-------|------|---------|
| 權限放寬導致濫用 | 低 | 低 | 外出設定影響有限，可隨時修改 |
| 事務失敗導致數據不一致 | 低 | 中 | 重試機制 + 錯誤日誌 |
| 類型轉換錯誤 | 中 | 低 | 明確使用 `String(ctx.user.id)` |

---

## ✅ 驗收標準

- [ ] Owner 可以設定外出
- [ ] Admin 可以設定外出
- [ ] Member 可以設定外出
- [ ] 設定外出時自動清除當天排餐
- [ ] 刪除排餐失敗不影響外出設定
- [ ] 錯誤信息清晰友好
- [ ] 成功提示適時顯示
- [ ] 前端顯示正確（外出 + 衝突警告）

---

## 🚀 實施順序

1. **先修復後端**（本文件內容）
   - 修改 `routers/weeklyMenu.ts`
   - 重啟後端服務
   - 測試後端 API

2. **再修復前端**
   - 修改 `planner.tsx`
   - 重新啟動前端
   - 測試用戶體驗

3. **完整測試**
   - 測試所有場景
   - 記錄測試結果
   - 修復發現的問題

---

**計劃制定完成！** 請審批後進入實施階段。
