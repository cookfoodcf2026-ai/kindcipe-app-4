# 匯入解析管線計劃（IMPORT PIPELINE PLAN）v2

> 目標：令 Kindcipe 匯入「穩定 + 唔會再 fail」，同時**唔破壞**現有正常功能。
> 範圍：香港用戶常用平台（IG / YouTube / Facebook / Threads / TikTok / 小紅書 / 一般網頁）。
> **唔做**：嗶哩嗶哩、抖音、今日頭條。

---

## 0. 核心洞察（v2 修正）

**v1 錯咗嘅假設**：以為「手機端抓 HTML caption」可以繞過平台封鎖。
→ 錯。平台對「非官方 client 抓 HTML」一律封，**住宅 IP 只對圖片 CDN 有效**（所以 clientThumbnail 得，但抓唔到 caption）。

**正確真相**：Albo 穩定係因為 **iOS Share Extension 已經由 OS 拎到 payload**：
- `shareIntent.text`（caption / 標題，OS 抽好）
- `shareIntent.webUrl`
- `shareIntent.files`（圖片，OS 抽好）

→ **分享入嚟嗰刻，OS 已提供內容，唔需要抓頁面。** 呢個先係穩定關鍵。

---

## 1. 兩條路徑設計（業界分法）

```
Path A: Share Extension（有 OS payload）—— 主力、最穩、US$0
   shareIntent.text / webUrl / files 直接用
   純連結冇 text → 落 Path B

Path B: 貼連結 / 剪貼板（冇 payload）—— 後端
   策略鏈：oEmbed → JSON-LD → og(metascraper) → 平台 adapter → （必要時第三方 API）
```

| 平台 | Path A（Share） | Path B（貼連結） |
|---|---|---|
| Instagram | ✅ OS 提供 caption+圖 | ⚠️ oEmbed/og（唔穩） |
| YouTube | ✅ | ✅ 官方 oEmbed |
| Facebook | ✅ OS 提供 | ⚠️ 時好時壞 |
| Threads | ✅ OS 提供 | ❌ |
| TikTok | ✅ OS 提供 | ❌ |
| 小紅書 | ✅ OS 提供 | ❌ |

> **你實測「Threads/TikTok/小紅書一定 fail」，好可能係用「貼連結」測（Path B）。**
> 用 Share（Path A），OS 已提供內容 → 多數得。**呢個係 Albo 穩定嘅真正原因。**

---

## 2. 目標架構：Provider Adapter（可插拔）

```
後端 ProviderRegistry
  ├─ interface Resolver { match(url), resolve(url, payload?) }
  ├─ instagramResolver
  ├─ youtubeResolver
  ├─ facebookResolver
  ├─ threadsResolver
  ├─ tiktokResolver
  ├─ xiaohongshuResolver
  └─ genericWebResolver（oEmbed → JSON-LD → og）
```
- **加平台 = 加一個 adapter**（唔改 core）。
- 每個 adapter 可**獨立開關（feature flag）** → 出事可單獨回退。
- 用成熟 library：**metascraper / @extractus**（開源、$0），唔自寫 regex。

---

## 3. 成本

| 項目 | 費用 | 備註 |
|---|---|---|
| Path A：Share payload | **US$0** | OS 提供 |
| Path B：oEmbed/JSON-LD/og | **US$0** | 純 HTTP |
| metascraper / @extractus | **US$0** | 開源 |
| Vision AI（IG 無 caption） | **token 成本** | DashScope Qwen-VL，約 US$1–5/1000 次 |
| LLM 解析 | **已存在** | 每次匯入本來就 call |
| Railway | **已存在** | 細流量 |
| 第三方 API | **US$0（暫不用）** | 只在 Path B 連免費層都 fail 先用 |

**總額外金錢成本 ≈ US$0**（唯一成本 = 開發時間）。

**成本 vs 利潤**：Pro HK$30/月；1 個 Pro 已 cover 數百次匯入。免費用戶限額、Pro 無限 → 成本由 Pro cover。

---

## 4. 對 App 嘅影響 / 回歸風險控制

### 原則：**加，唔改**（Add, don't rewrite）
- 現有成功路徑（IG oEmbed、YT oEmbed）**原封不動**。
- 新方法做成**後備層**：現有方法先試 → 失敗才落新方法。

| 風險 | 緩解 |
|---|---|
| 改核心 `parseRecipeFromUrl` 拖冧 IG/YT | **唔重寫**；只加策略鏈 |
| 新依賴（metascraper） | 後端 OTA 無關；先測 |
| Share native 改動 | 要 build；JS 部分可 OTA |
| Vision 多耗 token | 只 IG 無 caption 才用 |
| Prompt 改動影響輸出 | 唔改現有 prompt |

### 影響範圍
- **只影響**：`recipes.ts` URL 解析分支 + 前端 Share 處理。
- **唔影響**：登入、AI Chef、購物、排餐、翻譯、DB schema。

### 回退機制
- 後端：Railway 上一個 deployment redeploy。
- 前端：EAS republish 舊 update group。
- 每平台 feature flag 可單獨關。

---

## 5. 漸進執行（每步可獨立驗證／回退）

```
Step 0  錄 baseline（IMPORT_BASELINE_TEST.md）：IG/YT/FB 現況
Step 1  前端：Share Path A 優先用 shareIntent.text（IG/YT 唔變）→ OTA
Step 2  後端：加 metascraper 做 Path B 後備（現有 oEmbed 先試）→ railway up
Step 3  逐平台開 adapter（feature flag），一個一個驗
Step 4  加 analytics：分辨 Path A/B + 成功層 + 平台
Step 5  有問題 → 即 rollback 該平台
```

**任何一步出事，都唔會影響已正常嘅功能。**

---

## 6. 驗收 / 測試矩陣

| 平台 | 測試方式 | 成功條件 |
|---|---|---|
| IG（有 caption） | Share + 貼連結 | 出食譜 + 圖 |
| IG（無 caption） | Share（有圖） | Vision 出食譜 |
| YouTube | Share + 貼連結 | 出食譜 + 圖 |
| Facebook | Share + 貼連結 | 出食譜 + 圖 |
| Threads | **Share** | 出食譜 |
| TikTok | **Share** | 出食譜 |
| 小紅書 | **Share** | 出文字（或提示貼文字） |
| 一般網頁 | 貼連結 | 出食譜 + 圖 |

---

## 7. 關鍵風險（平台限制，非我哋 code）
- `expo-share-intent`（native）→ iOS/SDK 升級可能要 rebuild（見 POST_LAUNCH_RUNBOOK）。
- 平台反爬 → Path B 可能失效，但 **Path A（OS payload）不受影響** → 所以 Path A 係護城河。
