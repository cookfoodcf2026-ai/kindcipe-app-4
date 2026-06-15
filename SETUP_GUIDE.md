# 🚀 Kindcipe App — 5分鐘快速設置指南

## 你需要準備

- ✅ Mac 電腦（已有 Node.js v26）
- ✅ iPhone（安裝 Expo Go App）
- ✅ Cursor 編輯器

---

## 步驟一：安裝 Expo Go

在 iPhone 上打開 App Store，搜尋 **「Expo Go」** 並安裝。

---

## 步驟二：解壓縮並安裝依賴

```bash
# 1. 解壓縮（假設放在桌面）
cd ~/Desktop/kindcipe-app

# 2. 安裝所有依賴（約需 3-5 分鐘）
npm install
```

---

## 步驟三：啟動 App

```bash
npx expo start
```

終端機會顯示一個 **QR Code**。

---

## 步驟四：在 iPhone 上打開

1. 打開 iPhone 的 **相機 App**
2. 對準終端機的 QR Code 掃描
3. 點擊「在 Expo Go 中打開」
4. 🎉 App 啟動！

> ⚠️ Mac 和 iPhone 必須在**同一個 WiFi**

---

## 遇到問題？

### 問題：「Unable to connect to Metro」
**解決**：在終端機按 `t` 鍵，切換到 Tunnel 模式

### 問題：登入後沒有跳轉
**解決**：這是正常的，OAuth 需要後端配合。目前可以先跳過登入，直接測試其他功能。

### 問題：食譜匯入失敗
**解決**：先用「貼上文字」方式測試，確認 AI 解析功能正常

---

## 開發提示

在 Cursor 中打開 `kindcipe-app` 文件夾，可以直接修改代碼，iPhone 上的 App 會**即時更新**（熱重載）。

主要文件：
- `app/import.tsx` — 食譜匯入頁面（最重要）
- `app/recipe/[id].tsx` — 食譜詳情頁面
- `app/(tabs)/index.tsx` — 首頁

---

*如有問題，可以截圖發給 AI 助手尋求幫助。*
