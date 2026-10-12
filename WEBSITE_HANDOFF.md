# 網站 Handoff — kindcipe.com 喺邊度

> **重點：kindcipe.com 唔喺呢個 repo。**
> 呢個 repo（`kindcipe-app-4`）＝ **App**（native iOS/Android + webapp `app.kindcipe.com`）。
> 網站 `kindcipe.com` ＝ **另一個 repo**：**`cookfoodcf2026-ai/kindcipe-site`**。

---

## 1. 三個 surface 各自嘅 source

| 你見到嘅 | Repo / 資料夾 | 部署 |
|---|---|---|
| **kindcipe.com**（網站）| `cookfoodcf2026-ai/kindcipe-site`（本機 `~/Desktop/Kindcipe/manus/kindcipe-site`）| **Cloudflare** |
| **app.kindcipe.com**（webapp）| **呢個 repo**（`kindcipe-app-4`），Expo Web → `dist/` | Cloudflare Workers（`wrangler.jsonc` name `kindcipe-app`）|
| **iOS / Android app** | **呢個 repo**（`kindcipe-app-4`）| EAS build / OTA |

## 2. 唔好再喺呢個 repo 做網站

- 呢個 repo 曾經有 `marketing/`（Astro source）+ `docs/`（build 出嚟嘅 GitHub Pages 站）。
- 佢哋**唔係** live 嘅 kindcipe.com → 已移除 `marketing/`（避免兩個 source 打架）。
- `docs/` 亦係多餘，會喺 **app-4 GitHub Pages 關閉之後**先刪（見下）。

## 3. 要改 kindcipe.com → 去 `kindcipe-site`

```bash
cd ~/Desktop/Kindcipe/manus/kindcipe-site
git remote -v        # git@github.com:cookfoodcf2026-ai/kindcipe-site.git
npm run dev          # 本地預覽
npm run build        # prebuild 會由 backend 抓 recipes → src/data/recipes.json
```

- Astro 5 靜態站；`src/pages/`（index/features/pricing/faq/support/privacy/blog/recipes/dinner-ideas/for-helpers/import-recipes/meal-planning + `en/`）。
- 定價 canonical：`TIER_SPEC.md`（喺 `kindcipe-app-4`）。
- 部署：Cloudflare（方式待確認：Cloudflare Pages 連 repo 自動 build？定 `wrangler deploy`？）。

## 4. 待辦（`kindcipe-site`）

- [ ] 移除 HKTVmall／導購字眼（保留格價、低調）— index/features/pricing/faq + `en/*` + blog 05/08/09。
- [ ] 刪「同 Cookpad 有咩分別？」FAQ（zh + en）。
- [ ] 刪「App 即將上架 / waitlist」（index/pricing zh+en）。
- [ ] CTA → `app.kindcipe.com/login?utm_source=kindcipe-site`。
- [ ] Pricing 對齊 `TIER_SPEC.md`（留意：`kindcipe-site` 現時免費「1 成員／AI 30」同 TIER_SPEC「2 成員／AI 20」有衝突）。

## 5. app-4 清理狀態

- [x] **a1**：移除 `marketing/`；revert `.githooks/pre-commit`（唔再 rebuild docs）；清 `.gitignore`／`package.json` 嘅 marketing 項目。
- [ ] **a2**（待辦）：喺 GitHub 關閉 `kindcipe-app-4` 嘅 **GitHub Pages** 之後，先 `git rm -r docs`。
- **保留**：Phase 1（webapp noindex、email 移出 URL）＋ R3 死代碼清理（屬 app 側，唔關網站）。

## 6. 注意
- 兩個 repo 唔同 source，**改錯 repo 唔會影響 live**。
- 同一時間只有一個 session 改同一個 repo。
