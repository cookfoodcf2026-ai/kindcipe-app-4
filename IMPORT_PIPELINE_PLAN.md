# 匯入解析管線計劃（IMPORT PIPELINE PLAN）

> 目標：學 Albo 架構，令 Kindcipe 匯入「穩定 + **唔會再 fail**」。
> 範圍：**只做香港用戶常用平台**（IG / YouTube / Facebook / Threads / TikTok / 小紅書 / 一般網頁）。
> **唔做**：嗶哩嗶哩、抖音、今日頭條（成本高、收益低）。

---

## 1. 問題現狀（實測）

| 平台 | 狀況 | 原因 |
|---|---|---|
| Instagram | ✅ 穩（有圖） | `api/v1/oembed` + clientThumbnail |
| YouTube | ✅ 穩 | 官方 oEmbed + 描述 |
| Facebook | ⚠️ 時好時壞 | 後端爬 og 被 Railway IP 封 |
| Threads | ❌ 一定 fail | `threads.net/oembed` 多數要登入 |
| TikTok | ❌ 一定 fail | `tiktok.com/oembed` 反爬 |
| 小紅書 | ❌ 一定 fail | 反爬強 + 要登入 |
| **IG caption 無字** | ❌ 匯入唔到 | 無文字可解析（只有圖） |

**根因總結**：**靠「後端爬蟲」= 被平台 IP 封鎖** → 時好時壞。Albo 穩定係因為佢有**統一後端解析管線 + 手機端協助**。

---

## 2. 目標架構：統一解析管線（Unified Resolve Pipeline）

```
Share Extension / 貼連結 / 剪貼板
        │  只傳 URL（唔做平台邏輯）
        ▼
後端  POST /recipes.resolve
        │
   ①  平台識別（單一 Registry：域名 → platformKey）
        │
   ②  策略鏈（逐個試，第一個成功即止）：
        a. 手機端 clientCaption / clientThumbnail（用戶裝置，住宅 IP，最穩）
        b. 官方 oEmbed（YT 穩；Threads/TikTok 視情況）
        c. JSON-LD（結構化數據）
        d. og: meta（title/description/image）
        e. 平台專用解析（IG /api/v1/oembed、FB crawler）
        f. 第三方 API（僅必要時，付費）
        │
   ③  統一輸出 { title, author, caption, image, platform }
        │
   ④  LLM → 食譜 JSON
```

### 設計原則（令佢「唔會再 fail」）
1. **單一 Registry**：一個 map 定義所有平台；加平台 = 加一行。
2. **策略鏈**：唔靠單一方法；前面失敗自動試下一層。
3. **手機端最優先**（a）：因為**用戶裝置 IP 唔會被平台封** → 呢層解決 FB/Threads/TikTok/小紅書 大部分問題。
4. **失敗可觀測**：每層 log + analytics（`import_resolve` 事件，帶 platform + 成功層）。
5. **前端零平台邏輯**：前端只傳 URL + clientCaption（現時已有 clientThumbnail）。

---

## 3. 手機端 Caption Pass-through（Phase A 核心）

**點解**：後端被 IG/FB/小紅書 封 IP，但**用戶手機**睇得到該頁面內容。

**做法**：
1. 前端（已有抓圖邏輯）擴展：抓頁面時**一併抽 `og:description` / `og:title` / JSON-LD** → 連 `clientThumbnail` 一齊傳後端。
2. 後端策略鏈最優先採用 `clientCaption`。
3. 純 JS 改動 → **可 OTA**（唔使 build）。

> 呢招係成本最低、回報最大：$0 成本，解決大部分「一定 fail」平台。

---

## 4. 平台測試矩陣（每平台必須通過）

| 平台 | 連結 | 成功條件 |
|---|---|---|
| IG Reel（有 caption） | 實例 | 出食譜 + 圖 |
| IG Reel（無 caption） | 實例 | 用 Vision 讀圖 → 出食譜 |
| YouTube | 實例 | 出食譜 + 圖 |
| Facebook Reel | 實例 | 出食譜 + 圖 |
| Threads | 實例 | 出食譜 |
| TikTok | 實例 | 出食譜 |
| 小紅書 | 實例 | 出文字（或提示貼文字） |
| 一般網頁食譜 | 實例 | 出食譜 + 圖 |

**IG 無 caption**：策略 = **Vision AI**（用封面圖推斷食材/步驟）→ 覆蓋「caption 無字」個案。

---

## 5. 成本表（第三方 API）

| 方案 | 月費 | 覆蓋 | 建議 |
|---|---|---|---|
| **免費（oEmbed + JSON-LD + og + 手機端）** | **US$0** | IG/YT/FB/一般網頁（手機端救大部分） | ✅ Phase A 先用 |
| RapidAPI（IG/TikTok scraper） | US$10–50 | IG/TikTok/XHS 較穩 | 只在手機端都唔得時 |
| Apify | US$5–50 起 | 多平台 | 暫不考慮 |
| 自架 scraper | 伺服器 + 人力 | 彈性 | 唔划算 |

**現時成本 = US$0**（純用 DashScope LLM quota + Railway）。

**利潤影響**：
- Pro = HK$30/月（≈US$3.8）。若每用戶 API 成本 US$0.5–2 → 食 13–50% 收入。
- **對策**：匯入當 **Pro 功能**（免費用戶限額）→ 成本由 Pro 收入 cover；免費用戶用免費層。

---

## 6. 匯入限額（Free vs Pro）

| | Free | Pro |
|---|---|---|
| 匯入次數 | 每月限額（如 20） | 300 / 無限 |
| 平台 | 基本（IG/YT/網頁） | 全部（含 FB/Threads/TikTok/XHS）|
| Vision 讀圖 | ❌/限 | ✅ |

→ 免費用戶試到「好用但有限」，自然想升級 Pro。

---

## 7. 分階段實作

### Phase A（先做；1–2 日；大部分 OTA + 少量後端）
1. 後端：**統一 platform registry + 策略鏈**（收攏現有 IG/FB/Threads/TikTok/XHS 邏輯）。
2. 前端：**clientCaption pass-through**（抓頁面時抽 og:description/title → 傳後端）。
3. 後端：優先採用 clientCaption；IG 無 caption → Vision。
4. 加 `import_resolve` analytics（platform + 成功層）。
5. 目標：**6 平台全部穩定**（靠手機端）。

### Phase B（需要時；+3–5 日）
6. 若仍有平台 fail → 落 **US$10–20/月** 付費 API（只該平台）。
7. 匯入限額（Free/Pro）。

### Phase C（延後；唔做）
- 嗶哩/抖音/頭條（成本高、收益低）。

---

## 8. 驗收標準
- [ ] IG（有/無 caption）、YouTube、FB、Threads、TikTok、小紅書、一般網頁 **全部成功**
- [ ] Share（熱啟/冷啟/未登入）穩定
- [ ] 匯入後**標籤自動簡選**（可即時儲存）
- [ ] PostHog 有 `import_resolve` 數據（platform + 成功層）

---

## 9. 關鍵風險
| 風險 | 對策 |
|---|---|
| 平台反爬升級 | 手機端 pass-through 做主力（IP 唔被封） |
| iOS SDK 升級 | 接受 share 要出 build（見 POST_LAUNCH_RUNBOOK） |
| 成本 | 先免費；匯入當 Pro 功能 cover 成本 |
