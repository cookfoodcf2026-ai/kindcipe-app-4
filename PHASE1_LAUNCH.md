# Phase 1 — App Store + Google Play 上架計劃

## ✅ 已完成（code 側）

### 1.1 刪除帳戶（Apple 5.1.1(v) / Google Play 要求）
- **Backend**：`server/db.ts` 新增 `deleteUserAccount()`（處理所屬家庭：擁有人轉移／無其他人刪家庭、移除成員身份、刪用戶資料）；`server/routers.ts` 的 `auth` router 新增 `deleteAccount` mutation（`TRPCError` UNAUTHORIZED 檢查 + 清除 cookie）。
- **App**：`app/settings.tsx` 新增紅色「刪除帳戶」按鈕 → 強烈警告確認 → 呼叫 `trpc.auth.deleteAccount` → 清除本地 token/family + invalidate → 跳去 `/login`。

### 1.2 私隱政策
- 內容草稿：`privacy-policy/index.html`（已涵蓋：收集資料、用途、AI 生成（DashScope）、第三方（Sentry/Google/Apple/IAP）、資料保留、刪除帳戶、聯絡）。
- 部署指南：`privacy-policy/README.md`（GitHub Pages 最簡；或 `kindcipe.com/privacy` custom domain）。

### 1.6 Onboarding Redesign（Show, don't tell · Full-bleed 混合式）
- `app/onboarding.tsx`：
  - **4 個 slide carousel**，每個係**滿版 AI 圖做背景**（`assets/slide1-4.jpg`）+ **覆蓋標題/副標**（頂部半透明遮罩保可讀性）+ **底部浮動「一鍵生成」pill**（→ `/ai-chef` action: "daily"）+ 指示點。
  - **Slide 1**：食物 hero（今晚食咩？AI 一鍵搞定）。
  - **Slide 2 / 3**：**混合式**（AI 背景 + app 實際 UI mockup 覆蓋 —— 排餐格 / 買餸清單）→ 展示真產品。
  - **Slide 4**：家人溝通零時差。
  - 單一 CTA（一鍵生成）+ 細「跳過」。

### 1.7 新手操作提示（Hint Banner，方案 B）
- `src/components/HintBanner.tsx`：可關閉提示卡（✕ per-hint dismiss +「不再顯示新手提示」全局關）。
- 閉環 4 步放置：
  1. AI Chef：`ai_chef_meal`「今晚食咩？點擊下方輸入框…3 秒配好 3 餸 1 湯！」
  2. 排餐頁：`meal_plan_shop`「菜單已排好？點擊『生成買餸清單』…」
  3. 購物清單：`shopping_list`「一鍵導出雙語清單 Send 俾姐姐，或勾選已買！」
- **settings 開關**：「新手操作提示」Toggle（`getHintsDisabled`/`setHintsDisabled`）→ 一鍵開/關。
- **唔改 ai-chef 問卷本身**（用提示卡引導）。

### 1.8 語言 MVP（EN / FIL / ID）
- 令語言切換**真係 work**：核心屏用 `t()`。
- **已完成第一 slice**：`settings`（標題/分區/標籤）+ `onboarding`（hero）已用 `t()`；`locales/en/fil/id.json` 已填。
- **待續（下一批）**：首頁 TonightHeroCard、排餐、購物清單、設定其餘字串、onboarding 其餘步驟 —— 用 `t()` 包起 + 填 3 語言。
- **唔翻譯**：食譜標題/步驟內文（留返「之後 Phase」用「翻譯一次 + 快取」或 AI 直接出目標語言）。

### 1.9 登入頁重構（`app/login.tsx`）
- **Slogan**：「今晚食咩？一鍵配好三餸一湯，家人溝通零時差」（取代舊 tagline）。
- **Social Login First**：Apple / Google 登入掣移去**最頂**；分隔線「或使用電郵登入」；下方先係 Email/密碼。
- **移除「管理員」tab**：改做底部微型連結「**管理員通道**」。
- **Safe area**：SafeAreaView + content `paddingTop: 40`（足夠避開 Dynamic Island）。
- **Email OTP（6 位驗證碼）**：⚠️ **暫緩/之後 Phase**（要 backend send-OTP + verify 端點 + 電郵服務，工程大、touch 登入流程）。

### 1.5 7 日 Pro 試用碼系統（防濫用 + 谷 Social Followers）

#### 背景
- 新用戶註冊**已經自動送 7 日 Pro**（`initFamilyTrial`，per-user `trialCount`，且**每帳號最多建立 1 個廚房** → 已防「同帳號多 kitchen 蹭」）。
- 試用碼係**額外／受控派發**渠道，用嚟俾 Beta 測試員 / Social followers 攞 7 日 Pro。

#### 防濫用規則（關鍵）
- **Pro／試用係「廚房（family）」層級**，唔係 per-user。家庭成員（太太／先生／工人）共享同一 kitchen → **限 `familyId`**。
- `promoCodeRedemptions` 對 **`familyId` 唯一** → **每個 kitchen 淨係 redeem 一次 promo（任何 code）**，唔可以 code1+code2 疊 14 日。
- Redeem 時 kitchen 必須係 **`free`／`expired`**；若已 `active`（付費）或 `trial`（自動試用中）→ **拒**（唔疊加，唔會 7+7=14 日）。
- 每個 code：`active`、未過期、`usedCount < maxUses`。
- **Residual（記錄、留待之後）**：多帳號／多裝置、刪帳號重註冊、join 多 kitchen 重置 quota —— 需**裝置指紋**或 **AI quota 改 per-user** 先完全防。

#### Backend 設計
- `drizzle/schema.ts` 新增：
  - `promoCodes`：`code`（唯一）、`plan`（`"trial7"`）、`maxUses`、`usedCount`、`active`、`expiresAt`。
  - `promoCodeRedemptions`：`code`、**`familyId`（唯一）**、`userId`、`redeemedAt`。
- `server/db.ts`：`createPromoCode()`、`getPromoCode()`、`markPromoCodeUsed()`、`hasPromoRedeemed(familyId)`、`recordPromoRedemption()`、`grantFamilyTrial(familyId)`（set trial 7 日 + maxMembers 6）。
- `server/routers/subscription.ts`：新增 **`redeemTrialCode`** mutation，按上面規則驗證 → 授 7 日 Pro → 記錄 redemption + `usedCount+1`。

#### App 設計
- `app/settings.tsx`（或 Paywall）加「**輸入試用碼**」欄位 + 掣 → 呼叫 `trpc.subscription.redeemTrialCode` → 成功顯示「已啟用 7 日 Pro」／失敗顯示原因（已用／已啟用／無效）。

#### 派 code 方式（谷 Social Followers）
- **模式 A（推薦）：單一共用 code** —— 生成一個 code（例 `KINDCIPE-HK`，`maxUses=500`）放喺 IG caption／FB post／小紅書／YouTube／**link-in-bio** → followers 下載 Beta → 入 code → 7 日 Pro。一個 post 就派晒、可追蹤、天然谷 followers。
- **模式 B：每人單次 code** —— 生成 N 個單次 code，透過 DM／表單逐個派（適合「限量抽獎」：「頭 100 個 DM 我攞 code」）。
- 兩個模式都可以有：一個共用 code 谷曝光 + 限量單次 code 造急迫感。
- 生成方式：**script／SQL**（`INSERT INTO promoCodes ...`），webapp 未整所以唔使網頁管理。

#### 多平台增長策略（兩層漏斗，唔好淨做 IG）

**漏斗：曝光/互動（頂部）→ 轉化（底部）**
- **曝光＋互動引擎**：**Threads**（易爆光、易互動、低成本、IG 跨post）→ 引起興趣。
- **轉化引擎**：**IG + Facebook**（留言 → 自動DM → 驗證 Follow → 派獨有 code → App 兌換 7 日 Pro）。
- **漏斗**：Threads／小紅書 種草 → 導去 IG/FB 做 follow-gate + code → App → 7 日 Pro → 訂閱。

| 平台 | 角色 | 做法 | code-gate 自動化？ |
|---|---|---|---|
| **Threads** | ⭐ 曝光＋互動 | 每日家庭煮食話題/問答（「今晚煮咩好」「點慳買餸」）；IG 跨post | ❌（無 comment-to-DM）|
| **Instagram** | ⭐ 轉化引擎 | 靚食物相/reels；留言→DM→驗證 Follow→派 code | ✅ ManyChat |
| **Facebook** | 第二轉化 | 家庭群組、社群、平廣告；留言→DM→code | ✅ ManyChat（同工具）|
| **小紅書** | 內容觸達 | 貼食譜、種草（純內容）| ❌ |
| **WhatsApp** | 家庭分享/病毒 | app 內 share 餐單/買餸清單 → 家人擴散 | — |
| **YouTube** | 後期長內容/權威 | 煮食教學 | ❌ |

**唔好平均用力**：初期集中 **IG + Facebook（code-gate）+ Threads（曝光）+ 小紅書（內容）**；WhatsApp 靠 app 內分享做病毒；其他等有流量先加。

#### 谷 Social Followers 玩法（follow-gate）
1. **Follow-to-unlock**：「Follow @kindcipe + 用呢個 code」→ 7 日 Pro（包裝做「免費試用碼」，避免 Apple 視為強制社交行為）。
2. **Link-in-bio**：TestFlight（Beta）連結 + 共用 code → 一鍵安裝 + 兌換。
3. **限量／急迫**：「首批 300 個，額滿即止」。
4. **QR code** 印喺 post／story。
5. **內容鉤子**：3餸1湯 AI、慳錢格價 → 吸引家庭用戶。
- ⚠️ **Beta 先行**：Followers 要裝 **TestFlight（iOS）／Play internal（Android）** 先用到 → 要先生成 Beta build（見 Step 3）。

#### 派 code 自動化（留言 → DM → 驗證 → 獨有 code）
- **IG/FB（ManyChat）**：留言觸發 → 自動DM「多謝留言，Follow @kindcipe 攞 7 日 Pro」→ **驗證 Follow**（ManyChat 內建）→ 由 Google Sheet **每個 contact 派一個唔同 code**。
- 你 backend 生成**大量單次 code**（`maxUses=1`）→ 匯出 CSV/Google Sheet 俾 ManyChat。
- 每個留言者收到**獨有 code**；App 兌換（per-kitchen 防濫用）。

---

## 📋 待執行（你操作）

### 1.3 Support URL
- 預備一個聯絡 URL（如 `https://kindcipe.com/support` 或 mailto `support@kindcipe.com`），填入 ASC + Play。

### 1.4 Apple Small Business Program（15% 佣金）
1. 用 Apple Developer 帳號登入 [App Store Connect](https://appstoreconnect.apple.com)。
2. **Agreements, Tax, and Banking** → 簽署 **Paid Applications Agreement**（未簽要先簽）。
3. 搵 **Small Business Program** → **Enroll** → 確認符合資格（團隊 <100 人、年收入 < US$1,000,000）。
4. 提交 → Apple 審批（幾日）→ 生效後 IAP 佣金 **30% → 15%**。
5. 維持條件：年收入 < US$1M；超咗會被剔出。
6. Google Play 對小型開發者預設 15%（< US$1M 交易），一般唔使特別申請。

### 2. Store Console — EAS Credentials + IAP 產品（你手動，計費地區：**香港 HKD**）

#### 2a. EAS Credentials（build 用）
```bash
npm install -g eas-cli
eas login
eas credentials --platform ios     # Apple Distribution 證書 + Store provisioning（EAS 自動）
eas credentials --platform android # 生成/上傳 keystore（記住密碼，Play 用同一把）
```
> 或直接 `eas build --platform ios --profile production`，第一次會互動式幫你 config credentials。
> 已有 `eas.json`（iOS production Release、Android app-bundle）。

#### 2b. iOS — 開 App record（未開先開）
- ASC → **My Apps → +** → 揀 Bundle ID `com.kindcipe.app`；冇就 **New App**（Bundle ID 用 `com.kindcipe.app`、SKU 自訂）。
- 確認 App record 已創立（My Apps 見到佢）。

#### 2c. iOS — 開訂閱（Subscription）
- App → **Features → In-App Purchases & Subscriptions** → **+ Subscription**。
- 建 **Subscription Group**（「Kindcipe Pro」）→ 加兩個 auto-renewable：
  - `kindcipe_monthly_30`：HK$30／月
  - `kindcipe_yearly_288`：HK$288／年
- 每個填：顯示名、描述、訂閱期、**價錢（HK）**、地域（香港）、review note（測試帳號/登入方式）、截圖。
- 設做 **available / cleared for sale**。

#### 2d. iOS — App Privacy + 帳務
- **App Privacy**：填 nutrition labels（收集：ID、相片、購買、崩潰日誌 — 照 `privacy-policy/index.html`）。
- **Agreements, Tax, and Banking**：簽 Paid Applications Agreement + 填稅務／銀行（收 IAP 錢）。
- **Merchant ID / 內購金鑰**：訂閱驗證需要 App Store **In-App Purchase Key**（ASC → Users and Access → Integrations → In-App Purchase）→ 記低 Key ID 同 `.p8` 檔，填落 backend（`APPLE_IAP_KEY` / `APPLE_IAP_KEY_ID` / `APPLE_IAP_ISSUER_ID`）供 server-side receipt verify。

#### 2e. Android — Play Console
- 開 App（package `com.kindcipe.app`）→ **Monetize → Products → In-app products**。
- 加兩個 subscription：`kindcipe_monthly_30`（HK$30）＋ `kindcipe_yearly_288`（HK$288），設 base plan + price（HK）+ region + **Active**。
- **Data safety** form + **帳戶刪除 link**（指向 app 內刪除帳戶或支援頁）。

---

## 💰 定價／賺錢策略（已定）

### 核心：唔靠加價，靠「轉化 + 留住」+「慳成本」
- **定價**：維持 **HK$30／月 + HK$288／年**；唔亂加價（香港市場價敏感）。
- **年費主推（Anchoring）** ⭐：年費卡顯示刪除線 `HK$360`（30×12）+「立省 20%｜≈HK$24/月」+「**80% 僱主選擇**」置中放大（Paywall 已實作）。年費 = 鎖 12 個月、流失低 → **LTV 最高**。
- **優化 7 日試用 → 轉化**：見下「試用轉化 Phase」。
- **降低免費額度（Phase 2）**：免費 30 AI/月太慷慨 → **正式上架降到 ~10-15 AI/月**（Beta 保留寬鬆），谷付費壓力。
- **Apple SBP（15%）** + 將來 **Web／Stripe（0% 佣金）** → 慳成本。
- （進階）高一檔「家庭 Pro+」Upsell —— 後期。

### 家庭防共享規範（**正式上架先做**，Beta 保持 6/唔 gate）
- 每個 Pro 家庭上限 **4 位成員**（僱主+配偶+工人+1）；上限太高會變「拼房共享」→ 蝕轉化。
- **包裝**：唔好寫「上限 4/4」冷冰冰，改做溫馨頭銜框（👑僱主／➕邀請配偶／➕邀請姐姐／➕邀請家人）。
- **逃生門**：滿員想加人 → 「聯繫客服免費申請加額」→ 唔錯殺真大家庭，亦係 Phase 2「Family Max／企業版」Upsell 伏線。
- ⚠️ 逃生門要真係有人覆，否則真 5 人家庭會被卡。

### 試用轉化 Phase（之後做）
- **Day 1（Aha）**：輸入 code 後引導完成「第一次 3餸1湯 AI + 導出英文採購單」（價值實現）。
- **Day 3（習慣）**：Push「今晚試下 15 分鐘快手菜？AI 已配好」。
- **Day 5（倒數）**：Push「7 日試用剩 48 小時，升級年費享早鳥優惠」。
- （需要 onboarding flow + 排程 Push；另立 Phase。）

---

### 3. Build / Submit（我整 code 側）

### 3. Build / Submit（我整 code 側）
- EAS credentials 檢查 → `npm run check:env` + `npm run ci-gate` + `npx tsc --noEmit` → `eas build --platform ios --profile production`（+ Android app-bundle）→ **TestFlight 內測** → `eas submit`。
- **Beta 用 `preview` profile**（`distribution: "internal"`）→ TestFlight Internal → External Beta。

### 4. Metadata（我出稿，你畀截圖）
- App 名／副題／描述（中文）／關鍵字／分類／年齡分級／Release notes。
- 你提供各尺寸截圖（iOS 6.9"／6.5"／5.5"、Android）。

---

## 審查風險檢查（Review）
- AI Chef 要返可用結果；無 debug／placeholder；登入 flow OK；首次啟動唔 crash。
- 審查帳號能睇到訂閱頁 + sandbox 能買。
