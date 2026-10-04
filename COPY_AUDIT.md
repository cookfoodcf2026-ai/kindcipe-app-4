# COPY_AUDIT.md — Tier-1 User-Facing Copy Review

> 資深代碼審查角度：**準確性優先、刪除保守**。
> 分類：
> - **【準】** 與系統實際行為不符（最高優先）
> - **【刪】** 不需要存在（有明確理由先刪）
> - **【改】** 只係語氣／口語化
> - **【OK】** 合理，保留
>
> 本檔只審 **Tier-1（上架關鍵）**：login / onboarding / settings / kitchen / paywall / merge-link 相關。
> 每項改動都要 **4 locale 同步**，否則 `check-i18n-keys.js` fail。

---

## 🔴 【準】準確性問題（必須修，會誤導用戶）

### C-1｜`auth.dataFollowsLogin`（登入頁說明）— 同時係【準】【刪】
- zh-TW：`資料會跟住你嘅 Apple／Google 帳號，換機用同一個登入即可搵返。`
- **問題 1（準確性）**：只提 Apple／Google，**漏咗「使用電郵繼續」（OTP）**。同頁有 3 個登入方式，用戶會以為 email 登入唔保資料。
- **問題 2（精簡）**：登入頁塞技術說明 = 摩擦。主流 app（Apple / Notion / Duolingo）登入頁只有 logo + 標語 + 按鈕 + 法律聲明。
- **建議**：**【刪】** `app/login.tsx:396` 整行 + 4 locale 刪 key。
- **刪除安全理由**：資訊本身非法律必需；核心訊息（跨裝置）已由 onboarding／settings 承載；底下已有 `privacyAgree` 法律聲明。
- **若你想保留**（替代方案）：改為涵蓋三種登入 —— 見附錄 A。

### C-2｜`settings.linkHint`（登入方式頁腳）
- zh-TW：`用同一個 Apple／Google 帳號登入，任何手機都搵返同一帳戶同資料。`
- **問題（準確性）**：同樣只提 Apple／Google，漏 email OTP。
- **建議**：**【改】** → `用同一個 Apple／Google／電郵帳號登入，任何手機都可取回同一帳戶同資料。`

### C-3｜`settings.onlyOneKitchen` 用詞
- zh-TW：`你而家只屬於一個廚房 · {{role}}`
- **問題**：「只屬於」語感奇怪（似限制），實際係狀態描述。
- **建議**：**【改】** → `你目前屬於 1 個廚房 · {{role}}`

---

## 🟠 【改】語氣／口語化（專業化）

> 原則：zh-TW 目前混用大量廣東話口語。**上架面向公眾**，建議 UI 主要文案用**書面繁體中文**（港台通用）；過度口語會顯得唔專業。

### C-4｜`settings.kitchenQuota` — 夾雜英文 "quota"
- zh-TW：`成個廚房共享同一個 quota`
- **問題**：中英夾雜。且 `quota` 對普通用戶唔直白。
- **建議**：**【改】** → `整個廚房共用同一個使用額度`

### C-5｜`settings.mergeHint` 過長 + 口語
- zh-TW：`如果你有兩個帳號（例如之前用 Apple 隱藏電郵開咗一個），可以喺度用另一個登入方式證明擁有權，將佢嘅食譜、排餐、購物清單全部搬入呢個帳號。`
- **問題**：40+ 字、一句到底；「喺度」「開咗」「佢嘅」口語。
- **建議**：**【改】**（拆兩句，書面）→ `如果你有兩個帳號（例如先前用 Apple「隱藏我的電郵」建立），可用另一個登入方式證明擁有權，將該帳號的食譜、排餐與購物清單全部移入目前帳號。`

### C-6｜`settings.mergeTitle` / CTA 統一
- `mergeTitle` = `合併帳號`（OK）；`mergeCta` = `合併另一個帳號`（OK）。保留。

### C-7｜`kitchen.dangerHint`
- zh-TW：`如要離開，請先喺成員列表轉讓主人權限。`
- **問題**：「喺」口語。「主人權限」→ 一般叫「擁有權」或「管理權」。
- **建議**：**【改】** → `離開前，請先在成員列表轉移擁有權。`

### C-8｜`settings.promoDone` placeholder bug — **【準】確認係 bug**
- zh-TW：`已啟用 7 日免費試用（至 {date}）`；en：`...（until {date}）`
- **確認**：`lib/i18n.ts:52` 只用 `escapeValue:false`，**冇自訂 prefix/suffix** → i18next 預設 `{{ }}`。所以 `{date}` **唔會插值**，用戶會見到字面 `{date}`。
- 使用點：`app/settings.tsx:269` `t("settings.promoDone", { date: ... })`。
- **建議**：**【改・準】** 4 locale 全部 `{date}` → `{{date}}`。

### C-9｜`settings.promoDoneShort` — 使用點已確認
- `promoDoneShort` 只在 `res.expiresAt` 為空時用（`settings.tsx:269`）。**兩者皆在用，保留。**

---

## 🟡 【準】其餘準確性待確認（需程式碼追蹤）

### C-10｜`paywall` / quota 錯誤訊息
- 上架後 quota 硬擋會彈 paywall。相關 key（**非** paywall group）：
  - `error.recipeLimit` = `免費版每月最多建立 20 條自訂食譜，升級家庭版可無限建立。`
  - `error.quota` = `已達到使用上限，請稍後再試或升級。`
  - `adSlot.upgradeTitle` = `升級 Pro，解鎖更多 AI 排餐`
  - `adSlot.upgradeSubtitle` = `IG 追蹤免費兌換 7 日試用`
- **風險**：`error.recipeLimit` **寫死 20**，同後端 `maxCustomRecipesPerMonth`／方案可能不同步。
- **建議**：**【改・準】** 數字改為插值 / 由後端訊息驅動，避免寫死。**待你決定是否今次處理。**

### C-11｜`auth.disclaimer` / `auth.tagline` 死 key — **【刪】確認**
- grep 全 app：`auth.disclaimer` **無任何 call site**（只有 `aiChef.disclaimer`、`recipe.disclaimer` 在用）。
- `auth.tagline` 亦**無 call site**（login 只用 `auth.slogan`）。
- **建議**：**【刪】** 兩個 key × 4 locale。login 法律聲明由 `auth.privacyAgree` 承載。

### C-12｜`error.recipeLimit` 寫死「20」— 見 C-10
- **建議**：同 C-10 一併處理。

---

## 🟢 【OK】保留（已恰當）

| Key | 值 | 備註 |
|---|---|---|
| `auth.slogan` / `auth.tagline` | 今晚食咩？一鍵配好三餸一湯，家人溝通零時差 | 兩 key 內容相同，可考慮合併（低優先） |
| `auth.appName` | 和諧食譜 Kindcipe | OK |
| `onboarding.heroTitle` | 告別 每日煩惱 「今晚食咩？」 | 空格排版怪（「告別 每日煩惱」），可微調 → `告別每日煩惱：「今晚食咩？」` |
| `kitchen.approvalSub` | 開啟後，成員新增的排餐和食材需經管理員確認… | 書面、清晰，OK |
| `settings.role_*` | 廚房主人／管理員／幫手／家庭成員 | OK |

---

## 不建議刪除（雖似冗長，但屬信任/法律/必要說明）
- `auth.disclaimer`（法律）— 若保留則**修正**而非刪。
- `aiChef.disclaimer` = `AI 助手由 AI 生成內容，可能會出錯…`（合規必需，保留）。
- `kitchen.approvalSub`（功能說明，保留）。
- 刪除帳戶警告（法律，保留）。

---

## 附錄 A — 若 C-1 選擇保留（替代寫法，涵蓋三種登入）

| Locale | 建議 |
|---|---|
| zh-TW | `你嘅資料會同帳號綁定。喺新裝置用同一個 Apple／Google／電郵登入，即可取回所有資料。` |
| en | `Your data is linked to your account. Sign in with the same Apple, Google or email account on a new device to restore everything.` |
| fil | `Naka-link ang data mo sa iyong account. Mag-sign in gamit ang parehong Apple, Google o email account sa bagong device para ibalik ang lahat.` |
| id | `Data Anda tertaut ke akun Anda. Masuk dengan akun Apple, Google, atau email yang sama di perangkat baru untuk memulihkan semuanya.` |

---

## 執行清單（待你批准）

| # | Key / 位置 | 動作 | 優先 |
|---|---|---|---|
| C-1 | `auth.dataFollowsLogin` + `login.tsx:396` | 【刪】 | 高 |
| C-2 | `settings.linkHint` | 【改】加 email | 高 |
| C-8 | `settings.promoDone` | 【改・準】`{date}`→`{{date}}`（4 locale） | 高（bug） |
| C-11 | `auth.disclaimer` + `auth.tagline` | 【刪】死 key（4 locale） | 高 |
| C-3 | `settings.onlyOneKitchen` | 【改】`你目前屬於 1 個廚房 · {{role}}` | 中 |
| C-4 | `settings.kitchenQuota` | 【改】去英文 quota | 中 |
| C-5 | `settings.mergeHint` | 【改】書面化拆句 | 中 |
| C-7 | `kitchen.dangerHint` | 【改】書面化 | 中 |
| C-10/C-12 | `error.recipeLimit` 寫死 20 | 【改・準】插值化 | 中（需你決定） |

> C-9（promoDoneShort）已確認在用，保留。C-11 已確認死 key。
