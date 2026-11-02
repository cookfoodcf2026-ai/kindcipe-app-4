# Round 4 指示（唔准 commit 呢個檔）

只准喺 kindcipe-app-4 內工作，唔准讀 repo 以外路徑。唔准 push / deploy / 改 backend。

## 你上一輪個 test 唔收貨 — 原因

lib/deepLinkRedirect.test.ts 把你自己寫嘅 buggy 同 fixed 兩份邏輯抄入 test 檔互相對照，
而 app/_layout.tsx 完全冇 import 任何 shared decision function（grep 過 0 hit）。
即係 AuthGuard 真實邏輯再寫錯，個 test 一樣綠。呢個係假 gate，唔算防回歸。

## 要做

1. 把 AuthGuard 嘅 redirect 決定抽成一個 module：lib/authGuardRedirect.ts，pure function，
   input 用你 test 已經用嘅那些 flags。然後 app/_layout.tsx 真正 import 並使用佢。
   test 之後只准測呢個 module，唔准再喺 test 檔內另抄一份。
2. 加一條真 e2e（Playwright 或任何可重跑方式）：
   - 本地跑 npx expo export --platform web，serve dist
   - 冷開以下路徑：/recipe/<真實 id>、/settings、/login?next=%2Fshopping&utm_source=test、/nonexistent-xyz
   - 斷言 page.url() 嘅 pathname 冇被改成 /
   - /nonexistent 可以去 404 頁，但唔准靜靜變首頁
   - 要貼逐條實際輸出（pass/fail）
3. 檢查 app/login.tsx 新增嘅 returnTo 分支有冇同現有「已登入自動跳轉」邏輯造成雙重導航。
   如果有，講明你點避免。
4. 已登入用戶開 /login?utm_source=... 仍然會被 AuthGuard 跳去 /，utm 一樣會失。
   呢條要一齊處理，唔可以只修未登入路徑。
5. app/_layout.tsx 新加嘅 nextParam 係未使用變數，清走。

## 禁

- 唔准用 shell 執行含反引號或 $() 嘅字串（上一輪你咁做，zsh 直接爆 parse error，白做一輪）。
- 唔准用假 assertion、唔准只改 test、唔准抄一份實作落 test 檔。

## 完成只報

改咗邊幾個檔、e2e 逐條實際輸出、lint 同 tsc 有冇 error、第 4 點你點處理。
