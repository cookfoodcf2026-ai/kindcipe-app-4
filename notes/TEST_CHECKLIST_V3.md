# Kindcipe — 綜合測試清單（最新）

> 準備：完全關 app → 開兩次（食齊 OTA）。Web 直接開 app.kindcipe.com。
> 回報格式：`項目｜語言｜預期｜實際｜截圖`。⭐ = 重點風險。

## 0. 準備
- [ ] 一條 IG / FB / Threads / YouTube link；一張食譜截圖（有字）；一張食物相（冇字）；一段食譜文字。
- [ ] 確認 Railway `Postgres` region = **Southeast Asia**；Supabase **未刪**（fallback）。

## A. 基建 / 速度（⭐）
- [ ] 開 app：**唔應再白屏 10 秒**（應 ~1–3 秒內入到）。
- [ ] 食譜庫卡片：**明顯快**（之前 10 秒 → 應 ~1 秒）。
- [ ] 後台 `listOfficial` 應 < 0.2s（實測 0.07–0.15s）。
- [ ] Health `{"status":"ok"}`。

## B. 匯入（link / 文字 / 相）
- [ ] ⭐ 網站（有 JSON-LD）→ 食材/步驟**準確**、快。
- [ ] ⭐ IG / FB / Threads：有 caption 照抽；**冇完整內容 → 失敗而唔係老作**。
- [ ] 文字貼上 → 抽到 4 語言。
- [ ] 食譜截圖（**有文字**）→ 如實抽取；**成功後保留 link**。
- [ ] 食物相（**冇字**）→ 不應亂作（應走失敗／AI 選項）。
- [ ] 失敗頁 4 掣：📷上載相片 / ✨AI生成 / 先儲存 / 更多選項。

## C. 失敗頁 / AI 生成（⭐）
- [ ] AI 掣 → **先彈 confirm**（講明 AI 創作）→ 撳「AI 生成」先生。
- [ ] 有食物相 → **睇相生成**；冇相 → 文字 hint（**自動預填 OCR 名／caption**）。
- [ ] 生成中 → **全屏 loading**（唔似 hang）。
- [ ] 生成食譜 → **合理啲**（唔好明顯亂煮）；**標示 AI**；**有 link**（如原本有）。
- [ ] 詳情材料：**唔應見「,unit」**。

## D. AI 補齊
- [ ] 完整食譜（有步驟）→ **唔見**「✨ 補齊做法」。
- [ ] 冇步驟食譜 → 見掣 → 撳 → **成功補齊**（唔再 500）＋ tag「AI 建議」。

## E. 食譜詳情
- [ ] 右上 **✏️ 編輯**（user 食譜）。
- [ ] 「內容未完整 / 待補充」badge。
- [ ] 冇食材撳「加入購物」→ **明確提示**（唔靜默）。
- [ ] 「觀看教學影片」有原 link（link 匯入）。

## F. Share（⭐）
- [ ] 分享文字**尾有 link**。
- [ ] **冇 `400ml ml`**（單位重複）。
- [ ] Tags **冇 `x4e0a` 亂碼**。
- [ ] 「複製連結」正常。

## G. Kitchen Settings（⭐）
- [ ] 撳**成員行** → bottom sheet **由底部彈出 + 深色 backdrop**（唔再壓頁面）。
- [ ] 轉換主人／改角色／移除 → **要 confirm**。
- [ ] 邀請碼：複製／分享／重新產生（owner）。
- [ ] 解散 → 最底「進階」＋輸入廚房名確認。
- [ ] 只剩 **1 個廚房**。

## H. 非中文零中文（⭐）
- [ ] en / fil / id：**全程零中文**（食譜、購物、pantry、planner、picker、toast、kitchen）。
- [ ] Tags / 分類 / 單位 / 難度全部本地化。
- [ ] 換語言：問候語即時跟住變。

## I. 配額
- [ ] 設定 → 用量：匯入 / AI 數目正確。
- [ ] 失敗 parse **唔扣**；成功儲存先扣。

## J. Sentry（前端）
- [ ] 如 app 有 error → Sentry project `kindcipe-app` 見到。
- [ ] Stack trace 未 symbolicate（要下次 native build 上載 source map）。

## K. 資料（唯讀核對）
- [ ] users 60 / families 1 / members 2 / custom 73 / official 314 / shopping 70 / plans 195 / common_ingredients 1223。

## L. 已知限制 / 下一步
- [ ] Supabase 保留幾日（fallback）→ 冇事才退。
- [ ] 清 detached volumes：`postgres-volume-x0O0`、`postgres-volume-7Idp`（Dashboard → Volumes）。
- [ ] 付款 blocker：Stripe Live + Apple IAP（我做 IAP 實作 + 新 build + source map）。
