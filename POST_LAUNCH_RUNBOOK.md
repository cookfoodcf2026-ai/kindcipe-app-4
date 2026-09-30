# Kindcipe 上架後運行手冊（POST-LAUNCH RUNBOOK）

> 目的：上架後遇到問題，**快速判斷用 OTA 定 build**，避免拖延。
> 對象：任何負責發佈嘅人（release captain）。

---

## 0. 最重要的判斷表

| 改動類型 | 交付方式 | 生效時間 | 需 Apple 審批？ |
|---|---|---|---|
| JS / UI / 邏輯 / 翻譯 | **OTA**（`eas update --branch production`） | 幾分鐘（用戶開 app 兩次） | ❌ |
| 後端 / API | **`railway up`** | 幾分鐘 | ❌ |
| Native 模組 / `app.json` plugins / `+native-intent` | **新 build**（`eas build` → 上傳 ASC） | 1–3 日 | ✅ |
| Expo SDK / iOS 大升級 | **新 build** | 數日–數週 | ✅ |

**口訣**：改 **JS → OTA**；改 **native / plugin / SDK → build**。

---

## 1. 分享（Share）壞咗——最常見情境

### 症狀 A：分享後「頁面不存在」/ 冇反應 / 分析中途彈返主畫面
- **先當 JS 問題** → 90% 可以 **OTA 修**（我哋嘅導航邏輯全部喺 JS）。
- 步驟：
  1. 睇 PostHog：`share_received` / `share_consumed` / `share_failed` 邊個有出。
  2. 若 `share_received` 有、`share_consumed` 冇 → 導航／登入狀態問題 → **OTA 修**。
  3. 若連 `share_received` 都冇（分享根本入唔到 app）→ **native 層** → **要 build**。

### 症狀 B：deep link 完全入唔到 app（連開都唔開）
- **native 層** → 要 **新 build**。
- 緩衝：`+not-found` 兜底 + **剪貼板匯入**（見下）令用戶仍可完成操作。

### 後備入口（減低對 Share 的依賴）
- **複製連結 → 開 app → 自動偵測剪貼板** → 問「要唔要匯入」。呢個**係 OTA 可維護**。
- 只要呢個後備在，Share 壞 = **不便**，唔係 **不能用**。

---

## 2. 發佈流程（Release Captain SOP）

### A. OTA（JS 修正）
```bash
cd kindcipe-app-4
git status                     # 確認乾淨
npx tsc --noEmit --project tsconfig.json
git log --oneline -1           # 記低 commit
# 由乾淨 worktree 發佈（避免其他 session 未 commit 改動混入）
git worktree add --detach /tmp/ota HEAD
ln -s "$PWD/node_modules" /tmp/ota/node_modules && cp .env /tmp/ota/.env
cd /tmp/ota && npx eas-cli update --branch production --message "<說明>"
```
- 記低 **Update group ID**（可 rollback 用）。
- 用戶需**完全關 app → 開兩次**先收到。

### B. 後端
```bash
cd kindcipe-backend
git log --oneline -1
railway up --detach
# 驗證
curl -s https://kindcipe-backend-production.up.railway.app/health
```

### C. 新 build（native）
```bash
cd kindcipe-app-4
# bump app.json ios.buildNumber / android.versionCode +1
npx eas-cli build --platform ios --profile production --non-interactive
# 下載 .ipa → altool 上傳（EAS submit 隊列常塞）
curl -L -o /tmp/app.ipa "<artifact-url>"
xcrun altool --upload-app -f /tmp/app.ipa -t ios \
  --apiKey 56TU9932W8 --apiIssuer 4ff6caa9-b13b-40f0-8407-bc43317c7b33
# 等 VALID → 指派去 Internal Testers（見 §4）
```

---

## 3. Rollback

| 對象 | 做法 |
|---|---|
| OTA | EAS dashboard → Updates → 揀之前一個 good group → **Republish** |
| 後端 | Railway → Deployments → 上一個 → **Redeploy** |
| Build | ASC 停用該 build / 上傳新 build |

**每次發佈前記低**：commit、OTA group ID、後端 deployment ID。

---

## 4. TestFlight 指派（每次新 build 必做）

- Group **Internal Testers**（`07d84fc1-d382-49b3-82ab-c6157417a30b`）設定 `hasAccessToAllBuilds:false`
  → **每個新 build 都要手動指派**，否則 TestFlight 見唔到。
- 用 ASC API:
  ```
  POST /v1/betaGroups/{group}/relationships/builds
  body: { data: [{ type: "builds", id: "<asc-build-id>" }] }
  ```
- （長遠）可將 group 設 `hasAccessToAllBuilds:true` 免除逐次指派。

---

## 5. 上架後監控（睇咩）

| 指標 | 邊度 | 代表 |
|---|---|---|
| `share_received` vs `share_consumed` | PostHog | 分享入到 app 但冇被處理 = JS 導航問題 |
| `share_failed` | PostHog | 分享冇 payload / 例外 |
| crash | Sentry | native crash |
| `/health` | Railway | 後端生死 |
| LLM queue / p95 / 429 | Railway logs | AI 容量 |
| 429 rate | 後端 | AI 用量 / CGNAT |

---

## 6. 已知平台限制（唔係 bug）

- `expo-share-intent` 係第三方 native → **iOS/SDK 大升級可能要 rebuild**。
- iOS 每年約 1–2 次逼升 SDK → 預留時間，唔好等死線。
- 所以：**Share 有問題，多數要 build；但 90% 情況其實係 JS，可 OTA。**

---

## 7. 緊急聯絡 / 資產位置

| 資產 | 位置 |
|---|---|
| ASC API key | `~/.appstoreconnect/private_keys/AuthKey_56TU9932W8.p8` |
| ASC app id | `6815294638` |
| Bundle id | `com.kindcipe.app` |
| 後端 | `https://kindcipe-backend-production.up.railway.app` |
| 隱私/支援 URL | `https://kindcipe.com/privacy/` `https://kindcipe.com/support/` |
