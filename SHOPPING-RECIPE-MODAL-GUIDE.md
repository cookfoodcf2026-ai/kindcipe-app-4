# 🛒 購物清單食譜跳轉功能 - 實施指南

## ✅ 後端已完成

### 已實施嘅 API

1. **`trpc.shopping.listWithRecipeInfo`** (Query)
   - 返回按食譜分組嘅購物清單數據
   - 包含每個食譜嘅所有排餐資訊（日期、餐次、已加入狀態）

2. **`trpc.shopping.addIngredientsForMealPlans`** (Mutation)
   - 輸入：`{ mealPlanIds: number[] }`
   - 將指定排餐嘅食材加入購物車

3. **`getShoppingItemsWithRecipeInfo`** (db.ts)
   - 核心數據查詢函數

4. **`getRecipeIngredients`** (db.ts)
   - 從食譜獲取食材列表

---

## 📝 前端實施步驟

### 步驟 1：修改數據查詢

**文件：** `app/(tabs)/shopping.tsx`

**修改前：**
```typescript
const { data: shoppingItems = [] } = trpc.shopping.list.useQuery(undefined, {
  staleTime: 30000,
  refetchInterval: 15000,
});
```

**修改後：**
```typescript
const { data: recipeGroups = [] } = trpc.shopping.listWithRecipeInfo.useQuery(undefined, {
  staleTime: 30000,
  refetchInterval: 15000,
});
```

---

### 步驟 2：新增 State

```typescript
const [showRecipeModal, setShowRecipeModal] = useState(false);
const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
const [selectedMealPlanIds, setSelectedMealPlanIds] = useState<number[]>([]);

const addIngredientsM = trpc.shopping.addIngredientsForMealPlans.useMutation({
  onSuccess: () => {
    setShowRecipeModal(false);
    setToast({
      visible: true,
      message: `已加入 ${selectedMealPlanIds.length} 個餐次`,
      type: "success",
    });
    utils.shopping.listWithRecipeInfo.invalidate();
  },
  onError: (e) => {
    setToast({
      visible: true,
      message: `加入失敗：${e.message}`,
      type: "error",
    });
  },
});
```

---

### 步驟 3：修改購物清單渲染

**修改前：**
```typescript
{shoppingItems.map((item: any) => (
  <ShoppingItemRow key={item.id} item={item} />
))}
```

**修改後：**
```typescript
{recipeGroups.map((recipeGroup: any) => (
  <View key={recipeGroup.recipeId} style={styles.recipeSection}>
    {/* 食譜標題（可點擊） */}
    <TouchableOpacity
      style={styles.recipeHeader}
      onPress={() => {
        setSelectedRecipe(recipeGroup);
        setSelectedMealPlanIds([]);
        setShowRecipeModal(true);
      }}
    >
      <View style={styles.recipeHeaderLeft}>
        <Ionicons name="restaurant-outline" size={16} color="#6B7280" />
        <Text style={styles.recipeName}>{recipeGroup.recipeName}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
    
    {/* 購物項目列表 */}
    {recipeGroup.shoppingItems.map((item: any) => (
      <ShoppingItemRow key={item.id} item={item} />
    ))}
  </View>
))}
```

---

### 步驟 4：新增樣式

```typescript
const styles = StyleSheet.create({
  // ... existing styles
  
  recipeSection: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  recipeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  recipeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  
  // Modal styles
  modalContent: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  summarySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  mealPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  mealPlanRowDisabled: {
    opacity: 0.5,
  },
  mealPlanText: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    marginLeft: 12,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    padding: 20,
    backgroundColor: "#fff",
  },
  footerSummary: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center",
  },
  footerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  addBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
});
```

---

### 步驟 5：新增 Modal

```typescript
<Modal
  visible={showRecipeModal}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowRecipeModal(false)}
>
  <View style={styles.modalContent}>
    {/* Header */}
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{selectedRecipe?.recipeName}</Text>
      <TouchableOpacity onPress={() => setShowRecipeModal(false)}>
        <Ionicons name="close" size={24} color="#1A1A1A" />
      </TouchableOpacity>
    </View>
    
    {/* Content */}
    <ScrollView style={styles.modalScroll}>
      {/* Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryText}>
          已加入：{selectedRecipe?.mealPlans.filter(mp => mp.hasShoppingItem).length} 次
        </Text>
        <Text style={styles.summaryText}>
          未加入：{selectedRecipe?.mealPlans.filter(mp => !mp.hasShoppingItem).length} 次
        </Text>
      </View>
      
      {/* Meal plans list */}
      {selectedRecipe?.mealPlans.map((mp: any) => (
        <TouchableOpacity
          key={mp.mealPlanId}
          style={[
            styles.mealPlanRow,
            mp.hasShoppingItem && styles.mealPlanRowDisabled,
          ]}
          onPress={() => !mp.hasShoppingItem && toggleMealPlan(mp.mealPlanId)}
          disabled={mp.hasShoppingItem}
        >
          <Ionicons
            name={
              mp.hasShoppingItem
                ? "checkbox"
                : selectedMealPlanIds.includes(mp.mealPlanId)
                ? "checkbox"
                : "square-outline"
            }
            size={20}
            color={mp.hasShoppingItem ? "#10B981" : "#1A1A1A"}
          />
          <Text style={styles.mealPlanText}>
            {formatDate(mp.date)} {getMealTypeLabel(mp.mealType)}
          </Text>
          {mp.hasShoppingItem && (
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
    
    {/* Footer */}
    <View style={styles.modalFooter}>
      <Text style={styles.footerSummary}>
        總計：已加入 {selectedRecipe?.mealPlans.filter(mp => mp.hasShoppingItem).length} 次，
        未加入 {selectedRecipe?.mealPlans.filter(mp => !mp.hasShoppingItem).length} 次
      </Text>
      <View style={styles.footerButtons}>
        <TouchableOpacity
          style={[styles.addBtn, { opacity: selectedMealPlanIds.length > 0 ? 1 : 0.5 }]}
          onPress={handleAddSelected}
          disabled={selectedMealPlanIds.length === 0}
        >
          <Text style={styles.addBtnText}>
            ✓ 加入已勾選 ({selectedMealPlanIds.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => setShowRecipeModal(false)}
        >
          <Text style={styles.cancelBtnText}>❌ 取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

---

### 步驟 6：輔助函數

```typescript
// 格式化日期（例如：2026-08-06 → 8 月 6 日）
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 餐次標籤
function getMealTypeLabel(mealType: string): string {
  const labels: Record<string, string> = {
    breakfast: "早餐",
    lunch: "午餐",
    dinner: "晚餐",
    snack: "小食",
  };
  return labels[mealType] || mealType;
}

// 切換餐次選擇
function toggleMealPlan(mealPlanId: number) {
  setSelectedMealPlanIds(prev =>
    prev.includes(mealPlanId)
      ? prev.filter(id => id !== mealPlanId)
      : [...prev, mealPlanId]
  );
}

// 加入已勾選
function handleAddSelected() {
  if (selectedMealPlanIds.length === 0) return;
  
  addIngredientsM.mutate({
    mealPlanIds: selectedMealPlanIds,
  });
}
```

---

## 🧪 測試場景

### 場景 1：點擊食譜彈出 Modal
1. 打開購物清單
2. 點擊食譜名（例如「蒜蓉菜心」）
3. **預期：** 彈出 Modal，顯示所有日子 + 餐次

### 場景 2：顯示已加入/未加入狀態
1. Modal 顯示多個餐次
2. **預期：**
   - 已加入嘅餐次：顯示 ✅ 並 disabled（灰色）
   - 未加入嘅餐次：可勾選

### 場景 3：加入購物車
1. 勾選 1 個或多個未加入嘅餐次
2. 撳「✓ 加入已勾選」
3. **預期：**
   - Toast 顯示「已加入 X 個餐次」
   - Modal 關閉
   - 購物車更新

---

## ⚠️ 注意事項

1. **食譜 ID 格式：**
   - `official_123`：官方食譜
   - `user_456`：自定義食譜

2. **性能優化：**
   - 如果食譜好多日子，考慮使用 `FlatList` 代替 `map`
   - Modal 打開時自動 refresh 一次數據

3. **錯誤處理：**
   - 如果食譜冇食材數據，顯示提示
   - 如果加入失敗，顯示錯誤信息

---

**完成！** 🎉
