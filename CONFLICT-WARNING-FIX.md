# ✅ 衝突警告功能完成

## 🎯 修改目標

當今天同時有「外出」+「排餐」時，顯示警告提示用戶確認。

---

## 📝 修改內容

### 1. 衝突檢測邏輯

**文件：** `app/(tabs)/index.tsx:92-99`

**修改前：**
```typescript
// Check if today has eat-out
const isTodayEatOut = todayEatOut && todayMeals.some(
  (m: any) => m.mealType === "dinner" && m.status === "confirmed"
);
```

**修改後：**
```typescript
// Check if today has eat-out
const isTodayEatOut = todayEatOut && todayMeals.some(
  (m: any) => m.mealType === "dinner" && m.status === "confirmed"
);

// Check if today has BOTH eat-out AND dinner plan (conflict)
const todayDinnerPlan = todayMeals.find(
  (m: any) => m.mealType === "dinner" && m.status === "confirmed"
);
const hasConflict = todayEatOut && todayDinnerPlan;
```

---

### 2. 顯示邏輯調整

**文件：** `app/(tabs)/index.tsx:131-161`

**修改前：**
```typescript
{isTodayEatOut ? (
  // 只顯示外出
  <View style={s.dualCardRow}>
    <Ionicons name="restaurant-outline" size={12} color="#D97706" />
    <Text>外出用餐</Text>
    <View style={s.dateBadge}>
      <Text>今天</Text>
    </View>
  </View>
) : nextDinner ? (
  // 顯示排餐
  ...
)}
```

**修改後：**
```typescript
{hasConflict ? (
  // 顯示外出 + 排餐 + 警告
  <View style={s.dualCardContent}>
    <View style={s.dualCardRow}>
      <Ionicons name="restaurant-outline" size={12} color="#D97706" />
      <Text>外出用餐</Text>
      <View style={s.dateBadge}>
        <Text>今天</Text>
      </View>
    </View>
    <View style={s.dualCardRow}>
      <Ionicons name="alert-circle-outline" size={12} color="#DC2626" />
      <Text>{mealName(todayDinnerPlan)}</Text>
      <View style={s.conflictBadge}>
        <Text>需確認</Text>
      </View>
    </View>
  </View>
) : isTodayEatOut ? (
  // 只顯示外出
  ...
)}
```

---

### 3. 新增樣式

**文件：** `app/(tabs)/index.tsx:1274-1285`

```typescript
conflictBadge: {
  backgroundColor: "#FEE2E2",
  borderRadius: 6,
  paddingHorizontal: 6,
  paddingVertical: 2,
  marginLeft: 4,
},
conflictBadgeText: {
  fontSize: 10,
  fontWeight: "600",
  color: "#DC2626",
},
```

---

## 🎨 UI 效果

### 情況 1：只有外出
```
┌─────────────────────┐
│ 🌙 下次晚餐     >  │
├─────────────────────┤
│ 🍴 外出用餐 [今天] │
└─────────────────────┘
```

### 情況 2：只有排餐
```
┌─────────────────────┐
│ 🌙 下次晚餐     >  │
├─────────────────────┤
│ 🍴 蒜蓉菜心 [今天] │
└─────────────────────┘
```

### 情況 3：外出 + 排餐（衝突）✅
```
┌─────────────────────────┐
│ 🌙 下次晚餐       >    │
├─────────────────────────┤
│ 🍴 外出用餐 [今天]      │
│ ❗ 蒜蓉菜心 [需確認]    │
└─────────────────────────┘
```

---

## 📊 視覺設計細節

| 元素 | 圖標 | 顏色 | 樣式 |
|-----|------|------|------|
| **外出用餐** | 🍴 `restaurant-outline` | 橙色 `#D97706` | 日期標籤（黃色） |
| **排餐（衝突）** | ❗ `alert-circle-outline` | 紅色 `#DC2626` | 衝突標籤（淺紅） |
| **衝突標籤** | - | 紅色文字 `#DC2626` | 淺紅背景 `#FEE2E2` |

---

## ✅ 驗收標準

- [x] 檢測到今天同時有外出和排餐
- [x] 顯示兩行：外出（第一行）+ 排餐（第二行）
- [x] 排餐旁顯示紅色「需確認」標籤
- [x] 警告圖標（❗ `alert-circle-outline`）顯示在排餐前
- [x] 點擊卡片仍可跳轉到排餐頁面

---

## 🧪 測試場景

### 場景 1：今天只有外出
1. 設定今天為外出
2. 查看「下次晚餐」卡片
3. **預期：** 只显示「外出用餐 [今天]」

### 場景 2：今天只有排餐
1. 排入今天晚餐
2. 查看「下次晚餐」卡片
3. **預期：** 显示菜名 +「[今天]」

### 場景 3：今天外出 + 排餐（衝突）✅
1. 設定今天為外出
2. 排入今天晚餐（通過 API 或直接數據庫）
3. 查看「下次晚餐」卡片
4. **預期：**
   - 第一行：「🍴 外出用餐 [今天]」
   - 第二行：「❗ 菜名 [需確認]」

---

## ⚠️ 注意事項

### 後端行為
- 後端 `setEatOut` mutation 會自動清除當天排餐
- 但如果用戶通過其他方式（如直接 API 調用）同時創建外出和排餐
- 前端現在會正確顯示警告

### 用戶體驗
- 警告提示用戶檢查衝突
- 用戶可以點擊卡片進入排餐頁面解決衝突
- 不會自動刪除或修改數據

---

## 📈 改進建議（可選）

### 後續優化選項

1. **添加解決按鈕**
   ```
   ┌─────────────────────────┐
   │ 🍴 外出用餐 [今天]      │
   │ ❗ 蒜蓉菜心 [需確認]    │
   ├─────────────────────────┤
   │ [保留排餐] [取消排餐]   │
   └─────────────────────────┘
   ```

2. **長按解決衝突**
   - 長按衝突項目顯示選單
   - 選項：「保留排餐」、「取消排餐」

3. **自動提示**
   - 檢測到衝突時自動彈出 Alert
   - 「今天已設定外出，是否取消排餐？」

---

**修改完成！** 🎉
