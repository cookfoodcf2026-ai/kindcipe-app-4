# Kindcipe — 完整測試清單 (Test Checklist)

> 對應 iOS build **5**（提交版將為 **build 6**）/ OTA branch `production`。
> **每次 OTA 後：完全關閉 app，再開兩次**（第一次下載、第二次生效）。
> 結果欄：✅ 通過 / ❌ 失敗 / ⏭ 略過；失敗請註明裝置 + 步驟 + 截圖。

## 前置
- [ ] iOS：TestFlight 裝最新 build（5，或提交版 6）
- [ ] Android：裝最新 preview APK（見下）
- [ ] 帳號：Apple、Google、Email（**同一個 email** 測自動連結）
- [ ] 後端 production 在線（Railway `kindcipe-backend`）

### Android 下載
- EAS build 頁（完成後）：`npx eas-cli build:list --platform android --limit 1 --json` → `applicationArchiveUrl`（.apk）
- 傳去手機安裝（允許「未知來源」）；確認版本 **1.0.0 (5/6)**

---

## P0（上架必要，必須全部通過）

### A. 登入 / 帳號（P0）
- [ ] 登入頁只有 Apple / Google / Email（無 email 密碼表單）
- [ ] iOS：Apple 原生登入成功
- [ ] iOS/Android：Google 登入成功
- [ ] **Email OTP**：「使用電郵繼續」→ 收 6 位碼 → 登入
- [ ] 登出 → 再登入 → 資料仍在
- [ ] 設定頁刪除帳號流程正常
- [ ] **Admin（你）**：瀏覽器開 `kindcipe://login?mode=admin` → email 管理員登入 → Admin panel

### B. 帳號連結 / 跨 provider（P0）
- [ ] 設定頁「登入方式」顯示已連結（Apple/Google/Email）
- [ ] 同 email：先 Google 註冊 → 再 Apple 登入 → **自動連結同一帳號**（資料在）
- [ ] **Android**：Apple（Web）登入 → 返 app 已登入
- [ ] iPhone(Apple) ↔ Android(Apple) → 同一帳號、資料一致
- [ ] Apple「Hide My Email」帳號 → Email OTP 可搵返資料

### C. Onboarding（P0）
- [ ] 新帳號 → 建廚房 / 加入廚房（QR / 邀請碼）
- [ ] 舊戶口（已完成）→ 直入 tabs

### D. 匯入 + 分類（P0）
- [ ] IG reel 匯入 → 自動填 菜系 / 菜式類型 / 標籤
- [ ] **湯麵** → 飯麵/主食；`湯圓/糖水`→甜品；`薏米水/檸檬茶`→飲品；`羅宋湯/煲湯`→湯水
- [ ] `laksa/ramen/냉면` → 主食
- [ ] **圖片 fallback 預期**：reel 應顯示**真圖**；若真係抓唔到 → **中性佔位**（**唔會**再出隨機分類圖）
- [ ] 兩條測試 reel：`DddAcCMFDtH`、`DdtYSpCBjfb` → 真圖
- [ ] **hashtag → tags**：匯入 IG 後標籤含 hashtag；AI Chef 打相關字可命中
- [ ] YouTube / 小紅書 / **Facebook Reel** 匯入
- [ ] 圖片匯入、貼上文字匯入
- [ ] 必填缺漏 → 一次過列出 + 擋住儲存

### E. Share Extension（P0，需 native build）
- [ ] IG 撳紙飛機 → 分享清單 → Kindcipe → **直入匯入頁並自動開始解析**（**唔再「頁面不存在」，亦唔使再撳解析**）
- [ ] **熱啟**（app 已喺背景／已登入）分享 → **一樣自動匯入**（呢個係之前壞咗嘅情況）
- [ ] Safari 分享 URL → 直入匯入 + 自動解析
- [ ] 分享**圖片** → 當截圖匯入
- [ ] **未登入時分享** → 登入後自動匯入
- [ ] 分享清單要「更多 → Edit」先見到 Kindcipe（記住）

### F. AI Chef（P0）
- [ ] 問卷 → 出 3餸1湯（4 卡）
- [ ] 「一送一湯」→ 出 **2 卡**
- [ ] 湯種跟時間（quick 滾湯 / normal 煲湯 / leisure 老火湯）
- [ ] **AI 食譜唔會自動入庫**（除非收藏 / 加排餐 / 加購物）
- [ ] 多輪對話唔會 session 錯亂

### G. 核心功能（P0）
- [ ] 食譜列表、食譜詳情（編輯/刪除）
- [ ] 排餐：加/確認/拒絕/刪除、購物日期同步、外出衝突
- [ ] 購物清單：加/編輯/刪除、確認/拒絕、價格、購買記錄
- [ ] 登入守衛（未登入自動去 login）
- [ ] 冷啟無 crash

### H. 會員（P0）
- [ ] Free 廚房可邀 **1 位**（共 2 人）正常共用
- [ ] 第 3 人被擋 + 升級 / 追 IG 提示
- [ ] **promo code** 兌換 7 日 Pro

### I. 翻譯（P0）
- [ ] 切 **en** 走一次主要流程（登入 / 匯入 / AI Chef / 購物 / 排餐 / 設定）→ 無中文殘留

---

## P1（重要，可緊隨）

### J. 食譜 tab / 我的食譜
- [ ] 排序（熱門/時間/難度）、篩選（菜系/標籤/chips/食材類別）
- [ ] **隱藏 AI 生成** toggle（記住設定）
- [ ] **清除 AI 食譜**
- [ ] 複製連結（`kindcipe.com/recipe/<id>`；站係舊版 → 可能係通用頁，屬已知）

### K. Share / 剪貼板
- [ ] 複製 IG/YouTube 連結 → 開 app → 彈偵測；同連結 24h 唔重複彈

### L. Build / 外觀
- [ ] App icon 已放大、清晰
- [ ] 離線 banner / 重連
- [ ] 推送提醒 (meal reminder)
- [ ] 生物認證（Face ID）

### M. Android 專屬
- [ ] Android Apple Web 登入
- [ ] Android share（如果 build 有 intent filter）

---

## 已知限制（非 bug）
- `kindcipe.com` 已上線；但**舊版**：`/recipe/<id>` 可能唔係真食譜頁（**post-launch 改善**）。
- 圖片抓唔到時 → **中性佔位**（唔會誤導）；AI 出圖暫未啟用（DashScope 無圖像模型）。
- 跨 provider 同 email 會**自動連結**；Apple「Hide My Email」例外 → 用 Email OTP。
- Android Apple 登入需 `EXPO_PUBLIC_ENABLE_APPLE_WEB=1`（build profile 已設）。

---

## 提交前（App Store）
- [ ] Privacy URL：`https://kindcipe.com/privacy/`
- [ ] Support URL：`https://kindcipe.com/support/`
- [ ] IAP：`kindcipe_monthly_30`（HK$30/月）、`kindcipe_yearly_288`（HK$288/年）
- [ ] 截圖（6.9" 1290×2796）
- [ ] App Privacy 問卷
- [ ] 登入測試帳號可用
