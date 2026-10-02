# Kindcipe 競品分析（COMPETITOR ANALYSIS）

> 唯一競品總覽。整合自 `Kindcipe_商業模式分析與定價策略.md`（Honeydew / Mr. Cook）
> 及最新查證（ReciMe / Albo）。詳細商業模式見：`Kindcipe_商業模式分析與定價策略.md`。
> 匯入策略深入見：`IMPORT_PIPELINE_PLAN.md`。
> 最後更新：2026-09（定價為 App Store 各地區區間，實際以 App 內為準）。

---

## 一、對手總覽

| 項目 | **Mr. Cook** | **Honeydew (EatList)** | **ReciMe** | **Albo** | **Kindcipe** |
|---|---|---|---|---|---|
| 開發者 | Jan Poth（德國 1 人） | Red Honey LLC（美國 3–5 人） | ReciMe（團隊） | The Feel Good Project Ltd | 你 |
| 市場 | 全球（英文） | 全球（英文） | 全球（英文/多語） | 全球（英文） | **香港（粵語）** |
| 月費 | US$3.99 | US$6.99 | ~US$5–7 | US$4.99–6.99 | **HK$30（≈US$3.8）** |
| 年費 | US$29.99 | US$39.99 | US$39.99–59.99 | US$29.99–59.99 | **HK$288（≈US$37）** |
| 免費限額 | 15 食譜 / 3 AI / 3 掃描 | 有限 | **5 匯入/星期** | 有限 | 匯入 20/月 + AI 20/月 |
| 試用 | — | — | 7 日（**要信用卡**） | — | IG 免費碼（**唔要卡**） |
| 核心差異化 | SEO + 免費工具 | Instacart 導購分潤 | Smart Import（caption→audio→原網站） | 收藏地圖 + Siri | **香港家庭廚房協作** |

---

## 二、功能矩陣

| 功能 | Mr. Cook | Honeydew | ReciMe | Albo | **Kindcipe** |
|---|---|---|---|---|---|
| IG 匯入 | ✅ | ✅ | ✅ | ✅ | ✅ |
| TikTok 匯入 | 部分 | ✅ | ✅ | ✅ | ⚠️ |
| Facebook 匯入 | — | ✅ | ✅ | ✅ | ⚠️ |
| YouTube 匯入 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pinterest 匯入 | — | ✅ | ✅ | — | ❌ |
| 小紅書匯入 | — | — | — | — | ⚠️（香港重要）|
| 截圖匯入 | ✅ | ✅ | ✅（可多張） | ✅ | ⚠️（單張） |
| 其他 App 匯入 | — | — | ✅（Notion/Notes/Paprika…） | — | ❌ |
| Chrome Extension | ✅ | ✅ | ✅ | — | ❌（規劃中） |
| Web app | ✅ | ✅ | ✅ | — | ✅ |
| 餐單規劃 | ✅ | ✅ | ✅ | ✅（行程） | ✅ |
| 購物清單 | ✅ | ✅ | ✅（按貨架分類） | ✅ | ✅（+街市格價） |
| 營養計算 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 雲端同步 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 家庭共享 | — | ✅（6 人） | — | — | ✅（角色+審批） |
| **工人姐姐角色** | ❌ | ❌ | ❌ | ❌ | ✅ **獨有** |
| **粵語 AI** | ❌ | ❌ | ❌ | ❌ | ✅ **獨有** |
| **街市/超市格價** | ❌ | ❌ | ❌ | ❌ | ✅ **獨有** |

---

## 三、匯入策略深入（ReciMe 係標杆）

### ReciMe Smart Import — 三層策略
1. **caption（首選）**：影片文案有食譜就用。
2. **audio（caption 冇時）**：**轉錄影片語音**。
3. **原網站**：搵到原始食譜網頁就由嗰度匯入。
- 另支援：**多張截圖**、其他 App（Notion/Notes/Paprika）匯入、Chrome Extension。
- 限制（同所有對手一樣）：**私密/需登入內容做唔到**。

### Albo
- 定位「萬用收藏庫」（連結/影片/食譜/景點/電影），**地圖標記** + **Siri 捷徑**。
- 支援 IG/TikTok/FB/小紅書等 **Share Extension** 匯入。

### Kindcipe 現況 + 計劃（見 `IMPORT_PIPELINE_PLAN.md`）
- **兩條路徑**：Path A（Share 用 OS payload，最穩、$0）＋ Path B（後端 oEmbed/JSON-LD/metascraper）。
- **可借鏡 ReciMe**：多張截圖（$0，建議做）；**音訊轉錄暫緩**（取得音訊有 anti-bot 死症，成本 US$6–20/月）。

---

## 四、定價策略對照

| | Honeydew | Mr. Cook | ReciMe | Albo | **Kindcipe** |
|---|---|---|---|---|---|
| 月費 | US$6.99 | US$3.99 | ~US$5–7 | US$4.99–6.99 | HK$30（早鳥） |
| 年費 | US$39.99 | US$29.99 | US$39.99–59.99 | US$29.99–59.99 | HK$288 |
| 免費限額 | 有限 | 15 食譜 | **5/週** | 有限 | 匯入 20/月 + AI 20/月 |
| 試用 | — | — | 7 日（要卡） | — | IG 碼（唔要卡）|

**洞察**：
- Kindcipe **月費偏低**（US$3.8 vs 市場 US$5–7）→ 現為**早鳥優惠**，日後回復正價 HK$38–48（老用戶保留早鳥價，Apple 規則，計入收入模型）。
- **免費限額策略（已定案）**：**唔跟 ReciMe 5/週**。改為「**限制增值功能（AI）多過入口（匯入）**」：
  - 匯入 **20/月**（入口要寬，10 太少）
  - AI 對話 **20/月**（增值核心，5/10 太少、30 太鬆）
  - 成員 2
- **ReciMe 要信用卡先試用** → 大量「亂收費」負評；Kindcipe **唔要卡（IG 免費碼）係好感度優勢**。

---

## 五、Kindcipe 護城河（對手冇）
1. **香港本地化**：惠康/百佳/HKTVmall、街市分類、時令食材、天氣整合。
2. **家庭角色 + 審批**：Owner/Admin/Member/**工人姐姐**（對手只做個人）。
3. **粵語 AI 助理**：Cantonese + 繁中（對手全英文）。
4. **多語言**：繁中/EN/Filipino/Indonesian → 外傭市場。
5. **本地導購**：HKTVmall（vs 對手接美國 Instacart）。

> 詳見 `Kindcipe_商業模式分析與定價策略.md` §四。

---

## 六、可借鏡清單（+ 風險）

| 優先 | 借鏡 | 成本 | 風險 | 建議 |
|---|---|---|---|---|
| 1 | Share Path A（OS payload caption） | $0 | 低 | 做 |
| 2 | **多張截圖匯入**（ReciMe） | $0 | 低 | **做（已定案）** |
| 3 | 匯入限額維持 20/月、AI 收緊至 20/月 | $0 | 低 | **做（已定案）** |
| 4 | 後端 metascraper（Path B 後備） | $0 | 中 | 做 |
| 5 | 影片音訊轉錄（ReciMe） | US$6–20/月 | **高**（取音訊難） | **暫緩（已定案）** |
| 6 | Chrome Extension / 其他 App 匯入 | 中 | 中 | 上架後 |

---

## 七、資料來源
- ReciMe：官網 / Help Center（Smart Import、Import from IG/TikTok/Screenshots）/ App Store（US$39.99–59.99/年、5 匯入/週、7 日試用）。
- Albo：App Store（US$29.99–59.99/年、US$4.99–6.99/月、Hoarder/Pro 分檔）。
- Honeydew / Mr. Cook：`Kindcipe_商業模式分析與定價策略.md`（既有分析）。
