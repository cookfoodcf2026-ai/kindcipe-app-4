# ✅ 卡片點擊優化完成

## 🎯 修改目標

1. **限制顯示數量**：最多顯示 4 項
2. **整個卡片可點擊**：點擊卡片任意位置直接跳轉
3. **簡化交互**：卡片作為單一按鈕

---

## 📝 修改內容

### 1. 下次晚餐卡片

**文件：** `app/(tabs)/index.tsx:70-163`

**修改前：**
- 只有右上角「排餐 >」鏈接可點擊
- 空狀態時有單獨的 TouchableOpacity

**修改後：**
- 整個卡片使用 `TouchableOpacity` 包裹
- 點擊任意位置 → 跳轉到「排餐」頁面
- 右上角改為箭頭圖標 `chevron-forward`

```typescript
<TouchableOpacity
  style={s.dualCardWrapper}
  onPress={() => router.push("/(tabs)/planner" as any)}
  activeOpacity={0.7}
>
  <View style={s.dualCardHeader}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name="moon-outline" size={16} color={BRAND} />
      <Text style={s.dualCardTitle}>下次晚餐</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={BRAND} />
  </View>
  {/* 內容 */}
</TouchableOpacity>
```

---

### 2. 購物清單卡片

**文件：** `app/(tabs)/index.tsx:166-247`

**修改前：**
- 只有右上角「清單 >」鏈接可點擊
- 每個購物項目有單獨的 `TouchableOpacity`
- 空狀態有單獨的 TouchableOpacity

**修改後：**
- 整個卡片使用 `TouchableOpacity` 包裹
- 點擊任意位置 → 跳轉到「購物清單」頁面
- 移除內部項目的 `TouchableOpacity`（讓點擊穿透）
- 右上角改為箭頭圖標 `chevron-forward`
- **限制最多顯示 4 項**（使用 `.slice(0, 4)`）

```typescript
// 限制最多 4 項
const itemsToShow = useMemo(() => {
  return itemsIn14Days.slice(0, 4);
}, [itemsIn14Days]);

return (
  <TouchableOpacity
    style={s.dualCardWrapper}
    onPress={() => router.push("/(tabs)/shopping" as any)}
    activeOpacity={0.7}
  >
    <View style={s.dualCardHeader}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="cart-outline" size={16} color={BRAND} />
        <Text style={s.dualCardTitle}>購物清單</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={BRAND} />
    </View>
    {/* 內容 - 移除內部 TouchableOpacity */}
  </TouchableOpacity>
);
```

---

### 3. 父組件調整

**文件：** `app/(tabs)/index.tsx:682-692`

**修改前：**
```typescript
<View style={s.dualCardContainer}>
  <View style={s.dualCardWrapper}>
    <TonightMenuCardCompact ... />
  </View>
  <View style={s.dualCardWrapper}>
    <ShoppingListPreview ... />
  </View>
</View>
```

**修改後：**
```typescript
<View style={s.dualCardContainer}>
  <TonightMenuCardCompact ... />
  <ShoppingListPreview ... />
</View>
```

**原因：** 卡片組件內部已經自帶 `dualCardWrapper` 樣式，不需要雙重包裝。

---

## 📊 修改統計

| 項目 | 修改前 | 修改後 |
|-----|-------|-------|
| **下次晚餐卡片** | 只有鏈接可點擊 | 整個卡片可點擊 |
| **購物清單卡片** | 只有鏈接 + 單項可點擊 | 整個卡片可點擊 |
| **顯示數量限制** | 無限制 | 最多 4 項 |
| **右上角圖標** | 「排餐 >」文字鏈接 | 箭頭圖標 `chevron-forward` |
| **Touch 組件數量** | 3-5 個 | 2 個（每個卡片 1 個） |

---

## 🎨 UI 變化

### 下次晚餐卡片
```
┌─────────────────────────┐
│ 🌙 下次晚餐       >    │ ← 整個區域可點擊
├─────────────────────────┤
│ 🍴 蒜蓉菜心 [今天]      │
└─────────────────────────┘
```

### 購物清單卡片
```
┌─────────────────────────┐
│ 🛒 購物清單       >    │ ← 整個區域可點擊
├─────────────────────────┤
│ · 雞蛋 [今天]           │
│ · 排骨                  │
│ · 牛肉                  │
│ · 火鍋料                │
└─────────────────────────┘
```

---

## ✅ 優點

| 優點 | 說明 |
|-----|------|
| **更大觸控區域** | 整個卡片都可點擊，更容易點到 |
| **操作簡單** | 直覺：點卡片 = 跳轉到對應頁面 |
| **一致體驗** | 不會有點得到/點不到的區域 |
| **代碼簡化** | 移除多個內部 TouchableOpacity |
| **視覺清晰** | 箭頭圖標比文字鏈接更直觀 |

---

## ⚠️ 注意事項

### 失去的功能
- ❌ 無法直接點擊購物項目進行快速操作
- ❌ 無法長按單個項目顯示編輯選單

### 建議的後續優化
如果需要保留快速操作功能，可以：
1. 添加長按功能到外層 `TouchableOpacity`
2. 在長按時顯示操作選單（編輯/刪除）
3. 或者添加右滑刪除手勢

---

## 🧪 測試建議

1. **點擊測試**
   - [ ] 點擊下次晚餐卡片任意位置 → 跳轉到排餐頁面
   - [ ] 點擊購物清單卡片任意位置 → 跳轉到購物清單頁面

2. **顯示數量測試**
   - [ ] 購物清單超過 4 項 → 只顯示前 4 項
   - [ ] 購物清單少於 4 項 → 顯示所有項目

3. **視覺測試**
   - [ ] 右上角箭頭圖標顯示正常
   - [ ] 點擊時有透明度變化（activeOpacity）

---

**修改完成！** 🎉
