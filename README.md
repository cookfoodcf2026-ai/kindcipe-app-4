# 和諧食譜 Kindcipe — 原生 App

React Native (Expo) 原生 App，連接現有後端 API。

---

## 快速開始（Mac）

### 前置需求

1. **Node.js**（已安裝 v26.0.0 ✅）
2. **Expo Go App**（在 iPhone 上安裝）
   - App Store 搜尋「Expo Go」並安裝
3. **Cursor**（已安裝 ✅）

---

### 第一步：下載並解壓縮

將 `kindcipe-app.zip` 解壓縮到你想要的目錄，例如：

```
/Users/你的名字/Projects/kindcipe-app/
```

---

### 第二步：安裝依賴

打開 Terminal（終端機），進入項目目錄：

```bash
cd /Users/你的名字/Projects/kindcipe-app
npm install
```

等待安裝完成（約 2-5 分鐘）。

---

### 第三步：啟動開發伺服器

```bash
npx expo start
```

你會看到一個 QR Code 出現在終端機中。

---

### 第四步：在 iPhone 上預覽

1. 打開 iPhone 上的 **Expo Go** App
2. 點擊「Scan QR Code」
3. 掃描終端機中的 QR Code
4. App 會自動載入到你的 iPhone！

> **注意**：你的 Mac 和 iPhone 必須連接到**同一個 WiFi 網絡**。

---

## 項目結構

```
kindcipe-app/
├── app/                    # 頁面（expo-router 文件路由）
│   ├── (tabs)/             # 底部 Tab 頁面
│   │   ├── _layout.tsx     # Tab 導航配置
│   │   ├── index.tsx       # 首頁
│   │   ├── recipes.tsx     # 食譜庫
│   │   ├── planner.tsx     # 排餐計劃
│   │   ├── shopping.tsx    # 購物清單
│   │   └── import-placeholder.tsx
│   ├── _layout.tsx         # 根佈局（tRPC Provider）
│   ├── login.tsx           # 登入頁面
│   ├── import.tsx          # 食譜匯入（核心功能）
│   ├── family.tsx          # 家庭管理
│   └── recipe/
│       └── [id].tsx        # 食譜詳情
├── lib/
│   ├── trpc.ts             # tRPC 客戶端配置
│   └── router-types.ts     # AppRouter 類型
├── hooks/
│   └── useAuth.ts          # 認證狀態管理
├── assets/                 # App 圖標和啟動畫面
├── app.json                # Expo 配置
├── package.json            # 依賴列表
└── tsconfig.json           # TypeScript 配置
```

---

## 連接後端類型（可選，獲得更好的代碼提示）

如果你想要完整的 TypeScript 類型安全，可以將後端和前端項目放在同一目錄：

```
/Users/你的名字/Projects/
├── cookfood/          ← 後端（Web App）
└── kindcipe-app/      ← 原生 App（本項目）
```

然後修改 `lib/router-types.ts`：

```typescript
// 將這行：
export type AppRouter = any;

// 改為：
export type { AppRouter } from "../../cookfood/server/routers";
```

---

## 主要功能

| 功能 | 描述 |
|------|------|
| **食譜匯入** | 貼上 Instagram/YouTube 連結，AI 自動解析食材和步驟 |
| **截圖上傳** | 對食譜截圖，AI 識別內容 |
| **食譜庫** | 2欄 Grid 顯示所有食譜，支援搜尋 |
| **食譜詳情** | 食材勾選、步驟導覽、計時器 |
| **烹飪模式** | 防螢幕熄滅，一步一步跟著做 |
| **排餐計劃** | 每週日曆，安排早午晚餐 |
| **購物清單** | 食材/用品分類，一鍵跳轉 HKTVmall |
| **家庭管理** | QR Code 邀請家人，共享食譜和清單 |

---

## 常見問題

### Q: 掃描 QR Code 後顯示「Network request failed」

**解決方法**：確保 Mac 和 iPhone 在同一 WiFi 網絡。如果仍有問題，在終端機按 `w` 鍵切換到 Tunnel 模式。

### Q: 登入後沒有反應

**解決方法**：登入功能需要後端支援 native app OAuth。目前版本使用 Web OAuth，登入後會自動跳轉回 App。

### Q: 食譜匯入失敗

**解決方法**：
1. 確保連結是完整的 URL（包含 https://）
2. 嘗試截圖上傳方式
3. 嘗試手動貼上食譜文字

---

## 技術棧

- **框架**：Expo ~51 + React Native 0.74.5
- **路由**：expo-router（文件路由）
- **API**：tRPC 11 + React Query 5
- **後端**：https://cookfoodapp-fcqnrmih.manus.space
- **認證**：expo-secure-store + Manus OAuth
- **相機**：expo-image-picker
- **剪貼板**：expo-clipboard
- **防熄滅**：expo-keep-awake

---

## 後續開發計劃

- [ ] iOS Share Extension（從 Instagram 直接分享到 App）
- [ ] 推送通知（排餐提醒、採購提醒）
- [ ] 離線模式（緩存食譜）
- [ ] 工人模式（簡化介面，大字體雙語）
- [ ] 提交到 App Store

---

*和諧食譜 Kindcipe — 讓家庭飲食更和諧*
