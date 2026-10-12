# 網站 Handoff — kindcipe.com（已完成清單 + 待 push）

> 對象：接手 kindcipe.com（行銷站）嘅 session。
> 技術：`marketing/`（Astro source）→ build 出 `docs/` → GitHub Pages 發佈 `kindcipe.com`。
> 狀態日期：2026-10-12。

---

## 0. 一句總結

- **網站（kindcipe.com）已完成並大部分已 push 上 `origin/main`**（features / blog / recipes / IG 卡 / 清 HKTVmall / 刪 Cookpad FAQ）。
- **但「正確定價」仲未 push** —— `docs/pricing` 喺 live 仍然係舊（錯）內容。定價修正喺本機未推嘅 commit `0575201f`。
- **本地領先 `origin/main` 2 個 commit**，要 push 先令定價生效。

---

## 1. 已交付（網站功能）

| 區塊 | 內容 | 狀態 |
|---|---|---|
| Home | Hero「今晚食咩？AI 一鍵搞掂」+ IG 卡（@kindcipe.app）| ✅ 已 push |
| Features | 6 功能卡（AI 匯入／排餐／買餸清單／工人模式／家庭共享／烹飪模式）| ✅ 已 push |
| Pricing | 免費 / Pro 兩卡 + 年費註腳 | ⚠️ 結構已 push，**數字未更新** |
| FAQ | 3 條（已刪「同 Cookpad 有咩分別？」）| ✅ 已 push |
| Support | 聯絡 + 5 條 FAQ + 私隱連結 | ✅ 已 push |
| Privacy | 完整私隱政策（zh/en）| ✅ 已 push |
| Blog | 10 篇 × zh/en 重寫（重用舊 slug，無 404）| ✅ 已 push |
| Recipes | 20 條 × zh/en + `Recipe` JSON-LD + 舊中文 URL 301 | ✅ 已 push |
| SEO | canonical / hreflang / sitemap / robots（開放 Google+Bing+AI）/ og-default.png | ✅ 已 push |
| CTA | 全站 → `app.kindcipe.com/login?utm_source=kindcipe-site` | ✅ 已 push |
| 清理 | 全站 0 個 HKTVmall／導購／格價／Cookpad | ✅ 已 push |

- 產出：**116 個 HTML**（76 頁 + 40 個 301 重定向頁）。
- `marketing/` source：100 個檔案（Astro 5.18.2；環境 Node 20 → 唔可升 Astro 6）。

---

## 2. ⚠️ 待 push（本地領先 origin/main 2 個 commit）

```
0575201f  tier: align Free/Pro (paywall, language+screenshot gates, marketing, docs, TIER_SPEC)
dcecf746  i18n: close error-message leaks (map purchase/trial/admin/account errors; ...)
```

- `0575201f` **包含網站正確定價**（對齊 `TIER_SPEC.md`）＋ app 語言／截圖 gate。
- 未 push → **live `kindcipe.com/pricing` 仍顯示舊錯數字**（成員 6 人、無限匯入…）。

**驗證（現時 origin/main 嘅 pricing 係錯嘅）：**
```bash
git show origin/main:docs/pricing/index.html | grep -oE '<li>[^<]*</li>'
# → 廚房成員最多 6 人 / 無限食譜匯入 …（舊）
```

**要 push：**
```bash
git pull --rebase origin main   # 先同步
git push origin main            # 推 2 個 commit
```
> GitHub Pages 會自動重建 `kindcipe.com`（1–3 分鐘）。

---

## 3. 正確定價（`TIER_SPEC.md` canonical）

| Feature | Free | Pro |
|---|---|---|
| 廚房成員 | 2（你+1）| 4 |
| 食譜匯入 | 20/月 | 300/月 |
| 自訂食譜 | 20/月 | 無限 |
| AI 對話 | 20/月 | 300/月 |
| 語言 | 中文 + 英文 | 中/英/菲/印尼 |
| 截圖/相機匯入 | ❌ | ✅ |

- 價：**HK$30/月、HK$288/年**（早鳥；正價 HK$38/365）。
- `TIER_SPEC.md` 係唯一真相；如有衝突，以佢為準。

---

## 4. 發佈機制（重要）

- `kindcipe.com` = **GitHub Pages 從 `main` 分支 `docs/`** 發佈（`docs/CNAME` + `docs/.nojekyll`）。
- **`git push` → 自動重建網站**。唔需要 wrangler／EAS。
- Source 係 `marketing/`；`docs/` 係 build 產物（已 commit）。
- Build：`npm run marketing:build`（`outDir: ../docs`）。
  - 安全驗證（唔覆蓋 docs）：`MARKETING_OUT_DIR=dist npm --prefix marketing run build`。
- `.githooks/pre-commit`：改 `marketing/**` 且存在 `marketing/.publish` 時會自動 rebuild `docs/`（**已啟用 `.publish`**）。

---

## 5. 驗證清單（push 後逐項 check）

- [ ] `kindcipe.com/` 新 Hero + IG 卡
- [ ] nav 功能/定價/部落格/食譜/常見問題 全部通
- [ ] 語言切換 中↔英 正確
- [ ] CTA → `app.kindcipe.com/login?utm_source=kindcipe-site`
- [ ] `/pricing/` 顯示 **新數字**（成員 2/4、匯入 20/300、AI 20/300、語言 中英/中英菲印）
- [ ] `/faq/` 3 條、無 Cookpad
- [ ] `/blog/` 10 篇 + 內文正常
- [ ] `/recipes/tomato-scrambled-eggs/` 有食材/步驟 + `Recipe` schema
- [ ] `/recipes/番茄炒蛋/` 301 → 英文 slug
- [ ] `/robots.txt` = `Allow: /`；`/sitemap-index.xml` 76 URL
- [ ] 全站無 HKTVmall／導購／格價／Cookpad

---

## 6. 注意 / 未做

- **未做（可選）**：網站進階 UX/UI polish（動效、正式視覺）；正式 1200×630 `og-default.png`（現用 logo 暫代）；IG 自動 feed（Cloudflare Worker proxy，帳號係 Business/Creator）；提交 GSC/Bing。
- **`dist/` churn**：工作區有未 commit 嘅 `dist/`（app.kindcipe.com webapp bundle，另一 session 重建）→ **唔關網站**，push 前唔好誤 add。
- **兩 session 交錯**：同一條 `main`，另一 session 一路 commit i18n/app。規則：**同一時間只有一個 session commit**；push 前 `git pull --rebase`。
- **未追蹤**：`CONTENT_BANK.md`、`LAUNCH_CHECKLIST.md`、`SOCIAL_MEDIA_STRATEGIST.md`（非網站產物）。
- **Phase 4**：recipes 內容源日後可換 backend export（現為靜態 content collection）。

---

## 7. 相關檔案

| 用途 | 路徑 |
|---|---|
| Astro source | `marketing/src/`（pages / components / content / i18n / styles）|
| Build 輸出（GitHub Pages）| `docs/` |
| 定價 canonical | `TIER_SPEC.md` |
| 路線圖 | `ROADMAP-OPTIMIZATION.md` |
| Build 指令 | `package.json` → `marketing:dev` / `marketing:build` |
| 發佈掛鈎 | `.githooks/pre-commit`、`marketing/.publish` |
