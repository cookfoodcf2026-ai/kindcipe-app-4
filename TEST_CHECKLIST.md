# Kindcipe — 完整測試清單 (Test Checklist)

> 最後更新：對應 iOS build **5** / OTA branch `production`。
> **每次 OTA 後：完全關閉 app，再開兩次**（第一次下載、第二次生效）。

## 前置
- [ ] iOS：TestFlight 裝 **1.0.0 (5)**，App icon 已變大清晰
- [ ] Android：裝最新 **preview APK**（見下方「Android 下載」）
- [ ] 準備帳號：Apple、Google、Email（**同一個 email** 最好，測自動連結）
- [ ] 後端已部署（Railway `kindcipe-backend` production）

### Android 下載
1. 用 Android 機開 EAS build 頁 / 或電腦開 build 連結拎安裝 QR。
2. 或 `npx eas-cli@latest build:list --platform android --limit 5` 取 `applicationArchiveUrl`（.apk）下載，再傳去手機安裝（允許「未知來源」）。
3. 安裝後開啟，確認版本 **1.0.0 (5)**。

---

## A. 登入 / 帳號
- [ ] 登入頁只有 **Apple / Google / Email OTP**（無 email 密碼表單）
- [ ] iOS：Apple 原生登入成功
- [ ] iOS/Android：Google 登入成功
- [ ] **Email OTP**：撳「使用電郵繼續」→ 收 6 位碼 → 驗證 → 登入
- [ ] 登出 → 再登入 → 資料仍在
- [ ] 生物認證（Face ID）提示 / 解鎖
- [ ] 設定頁刪除帳號流程正常
- [ ] **Admin（你）**：瀏覽器開 `kindcipe://login?mode=admin` → email 管理員登入 → 入到 Admin panel

## B. 帳號連結 / 跨 provider
- [ ] 設定頁「登入方式」顯示已連結（Apple/Google/Email）
- [ ] 同 email：先 Google 註冊 → 再 Apple 登入 → **自動連結同一帳號**（資料在）
- [ ] **Android**：登入頁撳 **Apple（Web）** → 完成 → 返 app 已登入
- [ ] iPhone(Apple) ↔ Android(Apple) → 同一帳號、資料一致
- [ ] Apple「Hide My Email」帳號 → 用 **Email OTP** 可搵返資料

## C. Onboarding
- [ ] 新帳號 → 建廚房 / 加入廚房（QR / 邀請碼）
- [ ] 舊戶口（已完成）→ 直入 tabs
- [ ] 未完成 onboarding 中途離開再入 → 狀態正確

## D. 匯入 + 分類自動填
- [ ] IG reel 匯入 → 自動填 **菜系 / 菜式類型 / 標籤**
- [ ] **湯麵** → 飯麵/主食（唔係湯水）
- [ ] `湯圓`/`糖水`→甜品；`薏米水`/`檸檬茶`→飲品；`羅宋湯`/`煲湯`→湯水
- [ ] `laksa`/`ramen`/`냉면` → 主食
- [ ] YouTube / 小紅書 / **Facebook Reel** 匯入
- [ ] 圖片匯入、貼上文字匯入
- [ ] 必填缺漏 → 一次過列出 + 擋住儲存
- [ ] 重複食譜提示 / 外出衝突提示

## E. Share Extension（需 native build 4/5）
- [ ] Safari 分享 URL → 直入 App 匯入
- [ ] IG 複製連結 → 返 App 自動偵測
- [ ] 分享**圖片** → 當截圖匯入
- [ ] **未登入時分享** → 登入後自動匯入（唔流失）
- [ ] 分享清單見到 Kindcipe（可能要「更多 → Edit」開啟）

## F. 剪貼板自動偵測
- [ ] 複製 IG/YouTube 連結 → 開 app → 彈「偵測到食譜連結」
- [ ] 同一連結 24 小時內唔會重複彈

## G. AI Chef
- [ ] 問卷 → 出 3餸1湯（4 卡）
- [ ] 講「一送一湯」→ 出 **2 卡**
- [ ] 湯種跟時間（quick 滾湯 / normal 煲湯 / leisure 老火湯）
- [ ] 份量調整 → 食材數量同步
- [ ] 換食譜 / 重新生成
- [ ] 多輪對話唔會 session 錯亂
- [ ] **AI 食譜唔會自動入庫**（除非收藏 / 加排餐 / 加購物）

## H. 食譜 tab / 我的食譜
- [ ] 排序：熱門 / 時間 / 難度
- [ ] 篩選：菜系 / 標籤 / 熱門 chips / 食材類別
- [ ] **隱藏 AI 生成** toggle（記住設定，重開仍在）
- [ ] **清除 AI 食譜**（我的食譜內）
- [ ] 草稿唔喺清單顯示；由「新增食譜」續寫

## I. 食譜詳情
- [ ] 編輯 / 刪除（自訂 + 官方）
- [ ] 分享**文字**（有齊食材步驟）
- [ ] 複製連結（copy `kindcipe.com/recipe/<id>`；網站未上線 → 開唔到屬預期）
- [ ] 加入排餐 / 加入購物清單
- [ ] 單位換算 / 份量

## J. 排餐 (Planner)
- [ ] 加餐 / 確認 / 拒絕 / 刪除
- [ ] 購物日期同步
- [ ] 外出衝突提示
- [ ] 改日期、清空某日

## K. 購物清單
- [ ] 加入 / 編輯 / 刪除
- [ ] 確認 / 拒絕 / 全確認 / 全拒絕
- [ ] 價格記錄 / 購買記錄 / 移到今日
- [ ] 庫存入庫 (pantry)

## L. 會員 / Free 2 人
- [ ] Free 廚房可邀 **1 位**（共 2 人）正常共用
- [ ] 第 3 人被擋 + 升級 / 追 IG 提示
- [ ] **promo code** 兌換 7 日 Pro
- [ ] 設定頁「追蹤 IG 攞 7 日 Pro」掣（需設 `EXPO_PUBLIC_INSTAGRAM_URL`）

## M. 翻譯 (i18n)
- [ ] 切換 **en / zh-TW / fil / id**
- [ ] 主要流程（匯入、AI Chef、購物、排餐、設定、登入）**唔殘留中文**
- [ ] 錯誤 Alert 跟語言

## N. Build / 基本
- [ ] App icon 已放大、清晰（build 5）
- [ ] 冷啟正常、無 crash

## O. 回歸核心
- [ ] 登入守衛（未登入自動去 login）
- [ ] 離線 banner / 重連
- [ ] 推送提醒 (meal reminder)

---

## 已知限制（非 bug）
- `kindcipe.com` 網站未部署 → 複製連結開唔到（屬預期）。
- Android Apple 登入需 `EXPO_PUBLIC_ENABLE_APPLE_WEB=1`（build profile 已設）。
- 跨 provider（Apple↔Google）**同 email 會自動連結**；Apple「Hide My Email」例外，用 Email OTP。
