# 私隱政策部署指南（GitHub Pages）

將私隱政策發佈到網上，供 App Store / Google Play 審查及用戶瀏覽。

## 方法一：GitHub Pages（最快，免費）

1. 建立一個新 GitHub repo（例如 `privacy`，Public）。
2. 上傳本資料夾嘅檔案：`index.html`（內容已起草好）。
3. Repo 設定 → **Pages** → Source 揀 `Deploy from a branch` → branch 揀 `main` → `/ (root)` → Save。
4. 幾分鐘後，政策會喺：`https://<你的用戶名>.github.io/privacy/`
   （或者直接用 repo 名：`https://<你的用戶名>.github.io/<repo名>/`）
5. 將呢個 URL 填落：
   - **App Store Connect** → App 頁面 → 「Privacy Policy URL」。
   - **Google Play Console** → Data safety → Privacy policy URL。
   - **App 內**：`app/settings.tsx` 嘅私隱政策連結（改用呢個 URL）。

## 方法二：用你嘅 domain（`kindcipe.com/privacy`）

1. 將上面 `index.html` 放上你嘅網站 hosting（例如 Vercel / Cloudflare Pages / 你現有伺服器）。
2. 指 `kindcipe.com/privacy` 去嗰頁。
3. 如果 host 喺 GitHub Pages，可以加 **Custom domain**（Pages 設定 → Custom domain → 填 `kindcipe.com`），再喺你 DNS 加 `CNAME` 指去 `你的用戶名.github.io`，同埋喺 repo 加一個 `CNAME` 檔內容係 `kindcipe.com`。
   - 唔同子路徑（`/privacy`）一般要你嘅 host 做 route；最簡單係直接用 `https://kindcipe.com/privacy` 指去一個靜態頁，或改用 `https://<你的用戶名>.github.io/privacy/`。

## 審查需要

Apple / Google 只要求一個 **live 而且穩定** 嘅 URL，唔一定要 `kindcipe.com`。用 GitHub Pages URL 已經足夠。

## 記得更新

發佈後，請確認以下三處一致：
- App Store Connect「Privacy Policy URL」
- Google Play「Data safety」私隱政策 URL
- `app/settings.tsx` 內嘅私隱政策連結（目前係 `https://kindcipe.com/privacy`）
