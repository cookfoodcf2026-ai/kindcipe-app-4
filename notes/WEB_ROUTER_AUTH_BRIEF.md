# Brief：Web 導流／Router／登入 Gate（Client）

草稿。OpenCode 有權改寫任何一條；有錯請直接指出。

## 背景
`kindcipe.com` 係 marketing 站（Cloudflare、內容頁 `/features/` `/pricing/` `/blog/` `/recipes/` `/dinner-ideas/` `/faq/`），主要任務係導流去 webapp。主 CTA 現時指向
`https://app.kindcipe.com/login?utm_source=kindcipe-site&utm_medium=home`。

車主已定咗產品規則（2026-10-31）：
1. 未登入睇唔到食譜內容（要迫登記），但保留一屏預覽。
2. 官方食譜 = 公開（marketing 資產、SEO、分享）。
3. 登入後要返到原本想去嘅頁（returnTo），唔係一律掉首頁。

## 問題 1：所有深層連結／refresh 都跌返首頁

實測（每條都係冷開新 tab，已登入狀態）：

| 路徑 | 結果 |
|---|---|
| `/more` `/ai-chef` `/settings` `/kitchen-settings` `/purchase-history` `/planner` `/shopping` `/recipes` `/recipe/official_3674` `/recipe/new` `/nonexistent-xyz` `/login?...` | 全部最終 `location.pathname === "/"` |

只有「用 UI 點過去」時 URL 才正確（例：撳食譜卡 → `/recipe/official_3674`）。

影響：
- 分享食譜 link 開到首頁；bookmark 無用；refresh 失位；錯 URL 無 404。
- marketing CTA 打嘅 `/login?utm_source=...` 一樣被摺成 `/`，**query 一齊被食掉** → attribution 斷。

已排除嘅假設（我驗過）：
- Cloudflare SPA fallback 正常：`/`、`/login`、`/recipe/official_3674`、`/more`、`/nonexistent-xyz` 全部回 200、1175 bytes（同一個 index.html）。
- `wrangler.jsonc` 已設 `assets.not_found_handling = "single-page-application"`。
- 路由檔案存在：`app/login.tsx`、`app/settings.tsx`、`app/ai-chef.tsx`、`app/kitchen-settings.tsx`、`app/purchase-history.tsx`、`app/(tabs)/more.tsx` 都在。

即係成因喺 client 端執行期，唔喺 CDN。以下兩處係我嘅**假設，未驗，請你確認或否證**：
- `app/+native-intent.tsx` 的 `redirectSystemPath()`：`return p || "/"` —— 若 web 冷啟時 `path` 係空，任何 deep link 會變 `/`。
- `app/_layout.tsx` AuthGuard（約 512–516 行）：已登入且 `seg0 === "index"` 時 `router.replace("/(tabs)")`。

## 問題 2：`/login` 唔保留 query，亦冇 `returnTo`

- CTA 帶 `?utm_source=kindcipe-site&utm_medium=home`，導流後 URL 只剩 `/`。
- 登入成功後一律去 `/(tabs)`，冇「登入完返去原本嗰頁」。

## 問題 3：未登入嘅內容可見性（產品規則，需 API 配合）

| 內容 | 未登入 | 已登入 |
|---|---|---|
| 官方食譜 | 全開 | 全開 |
| 網紅食譜 | 卡（菜名／相／時間／人數）＋一屏預覽 | 全開 |
| 我嘅／AI 生成／匯入 | 不可見 | 只本人／廚房 |

「一屏預覽」= 相、菜名、標籤、材料頭約 3 項、步驟數，撳「睇完整步驟／加入排餐／存起」才要求登入。

**硬性要求：gate 必須喺 server（tRPC procedure）層，唔可以只喺 UI 收埋。** 而家用 DevTools 直接打 API 應該攞到全文；如確認如此，屬安全問題，唔止 UX。

## 驗收（要你自己貼實際輸出）
1. 下列每條冷開新 tab，`location.pathname` 保持不變並渲染正確畫面：
   `/more` `/ai-chef` `/settings` `/kitchen-settings` `/purchase-history` `/planner` `/shopping` `/recipes` `/recipe/<真實 id>`
2. 未登入開 `/recipe/<官方 id>` → 睇得到完整食譜；開 `/recipe/<用戶 AI 生成 id>` → 睇到一屏預覽，撳「睇完整」出登入。
3. `/login?next=/shopping&utm_source=test` → 登入後落 `/shopping`，且 `utm_source` 仍然喺 URL 或已記入 analytics。
4. 未有登入時直接 curl API 拎一篇非官方食譜全文 → 應該 401／只回預覽欄位（唔准回全文）。
5. `npx tsc --noEmit` exit 0；client 測試（`npx tsx --test lib/*.test.ts`，若有）總數唔跌。
6. 改完要 `npx wrangler deploy` 才算上線；deploy 後 curl `https://app.kindcipe.com/` 嘅 `entry-<hash>.js` 要對得上本機 `dist/index.html`。

## 唔准做
- 唔准 push / deploy / 改 Railway 環境變數（deploy 由車主批）。
- 唔准改 credit 常數、AI Chef 收費邏輯。
- 唔准用「client 只遮住 UI」嘅方式交貨（驗收第 4 條會 fail）。
- 唔准改 `kindcipe.com`（另一個 repo/專案），本 brief 只做 `kindcipe-app-4`。

## 交貨只報四樣
改咗邊幾個檔（路徑）、根因一句（真正成因，唔係假設）、上面 6 條驗收嘅實際輸出、以及有冇改到 backend 需要（如有，寫明要邊個 procedure 由 protected 變 public）。
