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

## 3. Apple Web 登入（可選，後補）
後端設：
```
APPLE_SERVICES_ID=<Services ID>
APPLE_TEAM_ID=<Team ID>
APPLE_KEY_ID=<Key ID>
APPLE_PRIVATE_KEY=<.p8>
APPLE_WEB_REDIRECT_URI=https://api.kindcipe.com/api/auth/apple/callback
```
App 端 `.env` 設 `EXPO_PUBLIC_ENABLE_APPLE_WEB=1`（已設）。

## 4. 建置 webapp
```bash
cd kindcipe-app-4
npm run build:web      # 產出 dist/
```
> `EXPO_PUBLIC_*` 係 build-time 注入；改 `.env` 後必須重新 build。

## 5. 部署（Cloudflare Pages）
- 連 repo：`kindcipe-app-4`
- Build command：`npm run build:web`
- Output directory：`dist`
- 綁 domain：`app.kindcipe.com`
- `public/_headers` 已備 cache/security headers
- **唔可以有 `public/_redirects`** —— `/* /index.html 200` 會被 Cloudflare 判為無限循環而令 deploy 失敗。SPA fallback 由 `wrangler.jsonc` 嘅 `assets.not_found_handling: "single-page-application"` 處理。

## 6. 驗證
- [ ] `curl https://api.kindcipe.com/health` → 200
- [ ] 開 `https://app.kindcipe.com` → login 頁
- [ ] Google 登入成功（彈窗 + 回 app）
- [ ] 桌面寬度 → 左側側欄；窄 → 底部 tabs
- [ ] 匯入 / 排餐 / 購物 / 雪櫃 / AI Chef 正常
- [ ] AI Chef 對話：手機傾完，web 開到同一對話（雲端同步）
- [ ] 分享食譜連結 → 開到 `/recipes/<名>/` 公開頁

## 7. 已知限制
- Live sync 用 polling（15–60s），非秒級
- IAP 在 web 隱藏（只顯示帳戶管理連結）
- 推送通知 web 未支援
