# Webapp 部署清單（app.kindcipe.com）

> 只包含 webapp（Expo Web）。App 端（iOS/Android）行為不受影響。

## 架構

```
app.kindcipe.com  → Expo Web (SPA, noindex)  ─┐
                                               ├→ 同一個 backend API
kindcipe.com      → Astro (GEO/SEO)       ────┘
```

## 1. Backend 環境變數（Railway）— ✅ 已完成
```
ALLOWED_ORIGINS=https://kindcipe.com,https://app.kindcipe.com
COOKIE_DOMAIN=.kindcipe.com
```

- `ALLOWED_ORIGINS`：容許嘅 web origin（CORS）。**不可設為 `*`** —— 後端會過濾 `*` 變成空集合，令所有 web 請求 500（且 cookie 模式本身唔容許 `*`）。必須逐一列出，逗號分隔、含 `https://`、結尾無 `/`。
- `COOKIE_DOMAIN`：令 `api.kindcipe.com` 派嘅 session cookie 可被 `app.kindcipe.com` 讀取（開頭 `.`）。

**已驗證（2026-09-29）：**
- `OPTIONS` preflight（`Origin: https://kindcipe.com` / `https://app.kindcipe.com`）→ **204/200**，回 `access-control-allow-origin` + `allow-credentials: true`
- 非白名單 origin（如 `https://evil.com`）→ 仍被擋（500）
- Native（無 Origin header）→ 200，App 不受影響

## 2. Google Cloud Console
OAuth client（Web）→ Authorized JavaScript origins 加：
```
https://app.kindcipe.com
```

## 3. Apple Web 登入
登入流程：web 撳 Apple → `GET /api/auth/apple/web/start`（302 去 Apple）→ Apple `form_post` 去
`APPLE_WEB_REDIRECT_URI` → 後端設 session cookie 並轉返 `app.kindcipe.com/login?apple=success`。

### 3a. Apple Developer（developer.apple.com）
1. **Team ID** → Membership 頁複製（10 字元）
2. **Services ID** → Certificates, Identifiers & Profiles → Identifiers →
   新 Identifier（Services IDs），例：`com.kindcipe.app.web`
   ・勾選 **Sign In with Apple** → Configure
   ・**Primary App ID** 揀 `com.kindcipe.app`
   ・**Domains and Subdomains**：`api.kindcipe.com`
      （若後端仍在 railway.app，填 `kindcipe-backend-production.up.railway.app`）
   ・**Return URLs**：`https://api.kindcipe.com/api/auth/apple/callback`
      （或 Railway 版：`https://kindcipe-backend-production.up.railway.app/api/auth/apple/callback`）
   ・Save
3. **Key** → Keys → 新 Key → 勾 **Sign In with Apple** → 下載 `.p8`（只可下載一次）
   ・記低 **Key ID**（10 字元）

### 3b. Railway env（backend）
```
APPLE_TEAM_ID=<Team ID>
APPLE_KEY_ID=<Key ID>
APPLE_SERVICES_ID=com.kindcipe.app.web
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_WEB_REDIRECT_URI=https://api.kindcipe.com/api/auth/apple/callback
```
> `APPLE_PRIVATE_KEY` 用 `.p8` 全文；Railway 可直接貼多行值。兩個 redirect URI
> （Apple Developer 設定 與 Railway env）**必須完全一致**。

### 3c. App 端
`.env` 設 `EXPO_PUBLIC_ENABLE_APPLE_WEB=1`（已設）。


## 4. 建置 webapp
```bash
cd kindcipe-app-4
npm run build:web      # 產出 dist/
```
> `EXPO_PUBLIC_*` 係 build-time 注入；改 `.env` 後必須重新 build。

## 5. 部署（Cloudflare Workers，已連 repo）
此 repo 連嘅係 **Cloudflare Workers**（`wrangler deploy`），唔係 Pages。
**重要限制：** Workers Builds **唔會**執行 `wrangler.jsonc` 嘅 `build.command`
（官方文檔明言），而 dashboard 嘅 **Build command 係唯讀（=None）**。
所以 deploy 前**冇 build 步驟** → 必須**將 `dist/` commit 入 repo**。

- Deploy command：`npx wrangler deploy`（唯讀，唔使改）
- `wrangler.jsonc`：`assets.directory=dist` + `not_found_handling=single-page-application`
- `dist/` 已 commit；改 web 後用附帶嘅 **pre-commit hook** 自動 rebuild：
  ```bash
  git config core.hooksPath .githooks   # 每個 clone 做一次
  ```
- **唔可以有 `public/_redirects`**（`/* /index.html 200` 會被判無限循環 → deploy 失敗）。
  SPA fallback 由 `wrangler.jsonc` 處理。

## 6. 驗證
- [ ] `https://app.kindcipe.com` → login 頁
- [ ] Google 登入成功
- [ ] 桌面寬度 → 左側側欄；窄 → 底部 tabs
- [ ] Onboarding：桌面可用箭咀／圓點切換投影片
- [ ] 匯入 / 排餐 / 購物 / 雪櫃 / AI Chef 正常
- [ ] AI Chef 對話：手機傾完，web 開到同一對話（雲端同步）
- [ ] 分享食譜連結 → 開到 `/recipes/<名>/` 公開頁

## 7. 已知限制
- Live sync 用 polling（15–60s），非秒級
- IAP 在 web 隱藏（只顯示帳戶管理連結）
- 推送通知 web 未支援
- Cloudflare deploy 靠 commit 嘅 `dist/`（見第 5 節）
