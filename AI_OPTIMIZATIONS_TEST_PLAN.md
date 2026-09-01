# AI Optimizations 測試計劃

## 已實施嘅優化

### 1. AI Chef 四重防護 (Four-Layer Protection) ✅
**位置：** `backend/server/routers/aiRecipe.ts` - `parseRecipeWithFallback()`

**防護層：**
- Layer 1: `extractJSON()` - 提取 JSON block
- Layer 2: `repairJSON()` - 修復無引號鍵名、截斷、未閉合括號
- Layer 3: Zod validation - 補 default values
- Layer 4: `parseRecipesFromText()` - 文本 parser 最終防線

**預期效果：**
- 白屏幕率：5% → <0.5%
- 食譜顯示成功率：85% → 98%+
- 開支：+5-15ms（用戶感覺唔到）

---

### 2. AI Edit repairJSON 防護 ✅
**位置：** `backend/server/routers/aiRecipe.ts` - `runAiEdit()`

**改動：**
```typescript
// 之前：
return aiEditOutputSchema.parse(extractJSON(parsedContent));

// 而家：
const extracted = extractJSON(parsedContent);
const repaired = repairJSON(JSON.stringify(extracted));
return aiEditOutputSchema.parse(JSON.parse(repaired));
```

**預期效果：**
- AI Edit JSON 解析失敗率降低 5-10%
- 開支：+2-5ms

---

### 3. AI Edit Differential Check ✅
**位置：** `backend/server/routers/aiRecipe.ts` - `validateEditDifferential()`

**檢查項目：**
1. **標題相似度** - 防止 completely change recipe name
2. **核心食材保留** - 防止蛋白質主材被換（雞→牛肉）
3. **步驟數量合理性** - 防止步驟少咗一半以上
4. **食材數量合理性** - 防止食材被大量刪除

**自動修復：**
- 如果標題差異 >70% → 恢復原標題
- Log warning 記錄所有 issues

**預期效果：**
- AI Edit 離譜修改率降低 80%+
- 開支：+5-10ms

---

### 4. AI Edit System Prompt 優化 ✅
**位置：** `backend/server/routers/aiRecipe.ts` - `runAiEdit()` system prompt

**新增內容：**
- ⚠️【重要原則 - 最小修改原則】
- ✅ 正確例子 vs ❌ 錯誤例子
- 明確指令：「只修改用戶明確要求嘅部分」

**預期效果：**
- AI 過度發揮率降低 60%+
- 用戶满意度提升

---

## 測試場景清單

### A. AI Chef 生成測試（四重防護）

| ID | 測試場景 | 輸入 | 預期 Layer | 預期結果 | 驗證方法 |
|----|---------|------|-----------|---------|---------|
| A1 | 正常食譜生成 | 「幫我整個豉油蒸雞食譜」 | 1 | 正常顯示食譜卡 | 有 1 個食譜，名稱正確 |
| A2 | 3 餸 1 湯 | 「今晚食咩」 | 1 或 4 | 顯示 4 個食譜 | 3 餸 + 1 湯 |
| A3 | 簡單食材 | 「有雞同菜可以煮咩」 | 1 或 2 | 顯示建議 | 有雞相關食譜 |
| A4 | 湯水要求 | 「我要個冬瓜薏米湯」 | 1 | 湯水食譜 + 有水 | 有 soupType/benefits |
| A5 | 自由對話 | 「少許鹽係幾多？」 | 4 | 純文字回覆 | 無食譜卡，有文字解釋 |
| A6 | 圖片 + 文字 | 上傳雪櫃相 + 「呢啲可以煮咩」 | 1 或 4 | 根據食材推薦 | 有相關食譜 |

**Backend Logs 驗證：**
```bash
# 正常情況
[AI Chef] Parse completed { layer: 1, duration: 8, recipes: 1 }

# JSON 修復情況
[AI Chef] Layer 2: JSON repaired { original: '{title: "蒸雞"...', repaired: '{"title": "蒸雞"...' }

# Text fallback
[AI Chef] Layer 4: JSON extraction failed, using text parser
[AI Chef] Text fallback completed { duration: 45, recipes: 2 }
```

---

### B. AI Edit 修改測試（Differential Check）

| ID | 測試場景 | 原食譜 | 修改要求 | 預期結果 | 驗證方法 |
|----|---------|--------|---------|---------|---------|
| B1 | 改辣啲 | 豉油蒸雞 | 「改辣啲」 | 加辣椒，主材不變 | 仍然係「雞」食譜 |
| B2 | 走蔥 | 蔥油雞 | 「走蔥」 | 移除蔥，保留其他 | 仍然係「蔥油雞」變體 |
| B3 | 減份量 | 4 人飯煲雞 | 「減一半份量」 | 食材 x0.5，步驟不變 | 步驟數量相近 |
| B4 | 替換食材 | 宮保雞丁 | 「雞轉蝦」 | 雞→蝦，其他不變 | 菜名可能變「宮保蝦球」 |
| B5 | 加調味 | 清蒸魚 | 「加多啲豉油」 | 只改豉油份量 | 其他食材不變 |
| B6 | 極端測試 | 麻婆豆腐 | 「改成蒸魚」 | 應該被 Differential Check 擋住 | Log 有 warning，名稱被恢復 |

**Backend Logs 驗證：**
```bash
# 正常修改
[AI Edit] Completed { duration: 3500, recipes: 1 }

# 過度修改被檢測
[AI Edit] ⚠️ Over-edit detected {
  issues: [
    "Title changed significantly: \"麻婆豆腐\" → \"清蒸魚\" (similarity: 0.1)",
    "Core protein ingredients removed: 豆腐"
  ],
  originalRecipe: "麻婆豆腐",
  editPrompt: "改成蒸魚"
}
[AI Edit] Auto-fixed: restored original recipe name
```

---

### C. AI Chef Freeform 澄清流程測試

| ID | 測試場景 | 輸入 | 預期行為 | 驗證方法 |
|----|---------|------|---------|---------|
| C1 | 夠資訊直接出 | 「想整晚餐，有雞同菜」 | 直接出食譜，唔問 | 無追問，直接顯示 |
| C2 | 差少少問 1 題 | 「想整個清淡晚餐」 | 問 1 題（幾多人食？） | 只問 1 條問題 |
| C3 | 太空泛轉 hotkey | 「今晚食咩？」 | 引導揀 hotkey | 顯示快捷方向提示 |
| C4 | 有衝突先澄清 | 「要快手但又要老火湯」 | 問清楚衝突位 | 問「快手定慢火先？」 |
| C5 | 叫你幫佢決定 | 「你幫我決定」 | 用預設值出 | 直接出方案 |

---

### D. Chat Bubble 文字選取測試

| ID | 測試場景 | 預期行為 | 驗證方法 |
|----|---------|---------|---------|
| D1 | 長按普通 AI 回覆 | 可以 highlight + 複製全文 | iOS 原生選單出現 |
| D2 | 長按用戶自己訊息 | 可以 highlight + 複製 | iOS 原生選單出現 |
| D3 | 複製食譜卡 | 每個 block 有「複製」button | Button 正常顯示 |
| D4 | 長按食譜卡內容 | 可以複製單一段落 | 原生選單 + block button 都喺度 |

---

## 測試步驟

### 1. 啟動 Backend
```bash
cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-backend
npm run dev
```

**驗證：**
- [ ] Backend 成功啟動
- [ Console 有 "[AI Chef]" logs 顯示]
- [ ] 無 TypeScript error

### 2. 啟動 Frontend
```bash
cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4
npm start
```

**驗證：**
- [ ] App 成功載入
- [ ] AI Chef 頁面正常顯示
- [ ] 無 console error

### 3. 執行 AI Chef 測試（A 系列）
1. 打開 AI Chef
2. 按順序測試 A1-A6
3. 每個場景記錄：
   - [ ] Backend logs 顯示嘅 layer
   - [ ] 顯示嘅食譜數量
   - [ ] 有無錯誤/白屏幕
   - [ ] 反應時間（主觀感受）

### 4. 執行 AI Edit 測試（B 系列）
1. 去食譜庫揀一個已有食譜
2. 按順序測試 B1-B6
3. 每個場景記錄：
   - [ ] Backend logs 有無 warning
   - [ ] 修改結果是否合理
   - [ ] 有無 auto-fix 發生

### 5. 執行 Freeform 測試（C 系列）
1. 新開一個 AI Chef session
2. 按順序測試 C1-C5
3. 記錄：
   - [ ] 追問數量（應該最多 1 題）
   - [ ] 有無引導 hotkey
   - [ ] 回應是否合理

### 6. 執行 Chat Bubble 測試（D 系列）
1. 喺 AI Chef 介面
2. 測試 D1-D4
3. 記錄：
   - [ ] 長按是否出現選取 handle
   - [ ] 複製 button 是否正常
   - [ ] 選取顏色是否可見

---

## Backend Logs 關鍵字搜尋

測試時可以用呢啲關鍵字 filter logs：

```bash
# AI Chef 四重防護
grep "[AI Chef] Parse completed" backend.log
grep "[AI Chef] Layer" backend.log

# AI Edit Differential Check
grep "[AI Edit] Over-edit detected" backend.log
grep "[AI Edit] Auto-fixed" backend.log

# JSON 修復
grep "[AI Chef] Layer 2: JSON repaired" backend.log
```

---

## 成功標準

| 指標 | 現狀 | 目標 | 驗證方法 |
|------|------|------|---------|
| AI Chef 白屏幕率 | ~5% | <0.5% | 測試 20 次，失敗<1 次 |
| 食譜顯示成功率 | ~85% | >98% | 測試 50 次，成功>49 次 |
| AI Edit 離譜修改率 | ~15% | <3% | 測試 20 次，離譜<1 次 |
| 平均响应時間 | 3-5 秒 | 3-5 秒 | 唔應該明顯變慢 |
| Chat bubble 選取 | ❌ 有時失效 | ✅ 每次都成功 | 測試 10 次，成功 10 次 |

---

## 已知問題同排解

### 問題 1: Backend logs 見唔到 "[AI Chef]"
**可能原因：** Log level 設定問題
**解決：** 檢查 `console.log` 是否被 suppress，或用 `console.warn` 測試

### 問題 2: AI Edit 修改後仍然離譜
**可能原因：** LLM 唔跟 prompt 指令
**解決：** 
1. 檢查 logs 有無 Differential Check warning
2. 如果成成發生，加強 auto-fix 邏輯
3. 或者考慮加用戶確認步驟

### 問題 3: Chat bubble 選取仍然失效
**可能原因：** iOS 版本/React Native 限制
**解決：** 
1. 確認 `selectionColor` 有生效
2. 檢查 bubble 外層有無 Touchable 阻住
3. 或者需要改做 TextInput (editable={false})

### 問題 4: AI Chef 明顯變慢 (>7 秒)
**可能原因：** 四重防護開支过大
**解決：** 
1. 檢查 logs 入面嘅 duration
2. 如果 Layer 4 成日被調用，表示 LLM 輸出格式有問題
3. 優化 LLM prompt 減少 JSON 錯誤

---

## 測試完成後 Action Items

### 如果測試通過（成功率 >95%）
- [ ] 準備部署生產環境
- [ ] Monitor production logs 一週
- [ ] 收集用戶反饋

### 如果測試失敗（成功率 <90%）
- [ ] 記錄所有失敗案例
- [ ] 分析 failure pattern（邊個 layer 最常失敗）
- [ ] 針對性優化（例如加強 Layer 2 repair 能力）

### 如果想進一步優化
- [ ] 加 LLM Cache 減少重複調用
- [ ] 壓縮 prompt tokens 減少 LLM 時間
- [ ] 並行調用 searchRecipes + LLM

---

## 聯絡同反饋

測試期間如有任何問題，請記錄：
1. 測試場景 ID（例如 A3、B5）
2. Backend logs 完整輸出
3. Frontend 截圖（如有白屏幕）
4. 重現步驟

---

**最後更新：** 2026-08-31
**版本：** v1.0 (AI Optimizations Release)
