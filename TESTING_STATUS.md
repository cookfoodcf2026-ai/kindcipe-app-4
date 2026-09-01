# Kindcipe v11 測試狀態報告

**日期：** 2026-08-24  
**狀態：** ⚠️ 需要用戶在 Mac 度執行

---

## ✅ 已完成嘅工作

### 1. TypeScript 檢查
- ✅ **通過** - 無類型錯誤

### 2. 測試文件準備
- ✅ `e2e/p0-smoke.test.js` - P0 煙霧測試（場景 1-4）
- ✅ `e2e/p1-core.test.js` - P1 核心測試（場景 5-10）
- ✅ `scripts/run-p0-smoke.sh` - P0 測試執行腳本
- ✅ `scripts/run-p1-core.sh` - P1 測試執行腳本
- ✅ `scripts/fix-and-build.sh` - 修復 build 問題腳本

### 3. 測試文檔
- ✅ `MAC_TEST_RECORD.md` - 測試結果記錄表
- ✅ `BUG_REPORT_TEMPLATE.md` - P0/P1 Bug 回報模板
- ✅ `V11_PREFLIGHT.md` - v11 交付前檢查清單
- ✅ `TESTING_GUIDE.md` - 完整測試指南

---

## ❌ 遇到嘅問題

### macOS Resource Fork 問題

**錯誤訊息：**
```
libwebp.framework: resource fork, Finder information, or similar detritus not allowed
libdav1d.framework: resource fork, Finder information, or similar detritus not allowed
```

**原因：** 呢個係 macOS/CocoaPods 嘅已知問題，當 CocoaPods 下載嘅 framework 包含 macOS metadata（._* 文件）時會發生。

**影響：** 無法喺呢個環境成功 build iOS app 進行 E2E 測試。

---

## 🔧 解決方案

### 喺你 Mac 度執行呢個腳本：

```bash
cd /Users/mavisng/Desktop/Kindcipe/manus/kindcipe-app-4
./scripts/fix-and-build.sh
```

呢個腳本會：
1. 清理所有 macOS metadata 文件
2. 清除擴展屬性
3. 清理 build 目錄
4. 重新安裝 CocoaPods
5. 嘗試 build 同運行測試

### 或者手動執行：

```bash
# 1. 清理
find . -name "._*" -delete
find . -name ".DS_Store" -delete
xattr -cr . 2>/dev/null || true
rm -rf ios/build

# 2. 重新安裝 Pods
cd ios && pod deintegrate && pod install && cd ..

# 3. 設定測試帳戶
export E2E_EMAIL='test29@gmail.com'
export E2E_PASSWORD='12345678'

# 4. Build 同測試
npm run e2e:build:ios
npm run e2e:test:ios -- e2e/p0-smoke.test.js
```

---

## 📊 測試場景

### P0 Smoke Test（必做）
| ID | 場景 | 描述 |
|----|------|------|
| 1 | Email Login | 電郵登入 |
| 2 | Biometric Prompt | 生物辨識解鎖 |
| 3 | AI Chef Generation | AI Chef 生成食譜 |
| 4 | Recipe Card Render | 食譜卡渲染 |

### P1 Core Test（強烈建議）
| ID | 場景 | 描述 |
|----|------|------|
| 5 | Add to Meal Plan | 加入餐單 |
| 6 | Add to Shopping List | 加入購物清單 |
| 7 | Toggle Bought | 標記已買 |
| 8 | Family Create/Join | 家庭共享 |
| 9 | Pantry Add | 雪櫃食材 |
| 10 | Cold Relaunch / Deep Link | 冷啟動 |

---

## 📋 下一步

1. **喺 Mac 度執行** `./scripts/fix-and-build.sh`
2. **等待 build 完成**（約 5-10 分鐘）
3. **查看測試結果**
4. **填寫** `MAC_TEST_RECORD.md`
5. **如有 bug，填寫** `BUG_REPORT_TEMPLATE.md`

---

## 🎯 預期結果

- **P0 測試：** 4 個場景全部通過
- **P1 測試：** 6 個場景全部通過
- **總時間：** 約 30-45 分鐘

---

## 📞 支援

如有問題，請參考：
- `TESTING_GUIDE.md` - 詳細測試指南
- `BUG_REPORT_TEMPLATE.md` - Bug 回報格式
