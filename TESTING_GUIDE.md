# Kindcipe 測試執行指南

> 更新日期：2026-08-24  
> 適用版本：v11  
> 測試環境：macOS + Xcode + iOS Simulator

---

## 📋 測試階段

### 第一階段：P0 Smoke Test（必做）

**目的：** 快速確認 App 能否正常啟動、核心流程無致命問題。  
**預計時間：** 15-20 分鐘  
**場景：** 1-4（登入、生物辨識、AI Chef、食譜卡）

**執行指令：**
```bash
cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4
export E2E_EMAIL='你的測試帳戶'
export E2E_PASSWORD='你的測試密碼'
./scripts/run-p0-smoke.sh
```

**通過標準：**
- ✅ 4 個測試全部通過
- ✅ 無 crash
- ✅ 無 timeout

**失敗處理：**
1. 停止測試
2. 填寫 `BUG_REPORT_TEMPLATE.md`
3. 截圖 / 錄屏
4. 傳回分析

---

### 第二階段：P1 Core Test（強烈建議）

**目的：** 驗證核心功能完整性。  
**預計時間：** 30-45 分鐘  
**場景：** 5-10（餐單、購物清單、已買標記、家庭共享、雪櫃、冷啟動）

**執行指令：**
```bash
./scripts/run-p1-core.sh
```

**通過標準：**
- ✅ 6 個測試全部通過
- ✅ 資料正確同步
- ✅ UI 渲染正常

---

### 第三階段：完整 100 場景（可選）

**目的：** 全面回歸測試，適合上架前最終驗證。  
**預計時間：** 2-3 小時（自動化）

**執行指令：**
```bash
npm run e2e:test:ios
```

---

## 🛠️ 環境準備

### 1. 確認 Xcode 已安裝
```bash
xcodebuild -version
```

### 2. 啟動 iOS Simulator
```bash
xcrun simctl boot "iPhone 16"
open -a Simulator
```

### 3. 安裝依賴
```bash
npm ci --legacy-peer-deps --ignore-scripts
cd ios && pod install && cd ..
```

### 4. 準備測試帳戶
- 使用專用測試帳戶（唔好用你嘅真實帳戶）
- 唔好將密碼貼到對話或上傳到 repo
- 建議使用 `.env.local` 儲存：
  ```bash
  E2E_EMAIL=test@kindcipe.com
  E2E_PASSWORD=測試密碼
  ```

---

## 📊 記錄測試結果

填寫 `MAC_TEST_RECORD.md`：

```markdown
| ID | Scenario | Status | P0/P1 Found? | Notes |
|----|----------|--------|--------------|-------|
| 1  | Email Login | Pass | No | |
| 2  | Biometric | Pass | No | |
| 3  | AI Chef | Pass | No | 90s timeout OK |
| 4  | Recipe Card | Pass | No | |
```

---

## 🐛 回報 Bug

如發現 P0/P1 bug：

1. **即時停止測試**
2. **填寫 `BUG_REPORT_TEMPLATE.md`**
3. **附加證據：**
   - 截圖（Simulator: Cmd + S）
   - 錄屏（Simulator: File > Record Video）
   - Console log
4. **傳回分析**

---

## ✅ 測試完成後

### 如果全部通過：
- ✅ 填寫 `V11_PREFLIGHT.md`
- ✅ 準備交付 Manus
- ✅ 安排 App Store 審查

### 如果有失敗：
- 🔧 修復 bug
- 🔧 重新執行對應階段測試
- 🔧 更新版本號（v12）

---

## 📞 聯絡

如有疑問，請填寫 `BUG_REPORT_TEMPLATE.md` 並傳回。
