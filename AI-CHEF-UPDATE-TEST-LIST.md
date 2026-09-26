# AI Chef Update — Test List（Phase 1–3）

> Scope：`app/ai-chef.tsx`（+211 / −29）
> 環境：iOS / Android 真機優先；至少各測一次。

---

## A. 自動化前置

| # | 指令 | 預期 |
|---|---|---|
| A1 | `npx tsc --noEmit --project tsconfig.json` | 無 error |
| A2 | `node scripts/check-i18n-keys.js` | ✅ 830 keys |
| A3 | `node scripts/audit-i18n.js --strict` | ✅ no hardcoded CJK |
| A4 | `npm run check:env` | pass（如做 production build） |

手動回歸清單：
A5 hero「一鍵 3 餸 1 湯」、A6 五個 hotkey、A7 拍雪櫃、A8 雪櫃食材、A9 換卡、A10 收藏、A11 加入排餐、A12 加入購物清單。

---

## B. Phase 1（零回歸修正）

| # | 步驟 | 預期 |
|---|---|---|
| B1 | 出卡後撳「加入排餐」開 modal | 標題「加入排餐」正常顯示（唔再無 style／warn） |
| B2 | 睇 modal 內「用餐時間」「日期」「食材」「步驟」 | 全部正常字級（`m.label` style 生效） |
| B3 | 出一張含「鹽／油／糖／蒜」嘅食譜卡 | 「睇食材」有顯示呢啲單字食材，食材數目計埋 |
| B4 | 出卡後展開食材 | 唔會再少咗單字調味料 |
| B5 | AI 文字回覆含 bullet（`- 生抽 1 湯匙`） | 正常當 bullet render，唔會變食譜大標題 |
| B6 | 食譜卡 header（`食譜一：家常 —— 名稱`） | 正常 render 成大標題 |

---

## C. Phase 2（X 餸 Y 湯）

| # | 輸入 | 預期 |
|---|---|---|
| C1 | `我打一送一湯` | 出 **2 卡**（1 餸 + 1 湯）；label 正常；唔再出「送 湯」錯詞 |
| C2 | `一餸一湯` / `1餸1湯` / `1菜1湯` | 2 卡 |
| C3 | `兩餸一湯` / `2餸1湯` | **3 卡** |
| C4 | `三餸一湯` / `3餸1湯` | **4 卡** |
| C5 | `四餸`（無湯） | 4 卡（全部餸，無湯） |
| C6 | library 有足夠菜 | 卡片 badge = 食譜庫（唔係 AI），可換卡／收藏／排餐 |
| C7 | library 唔夠菜 | 自動 AI fallback，仍出夠數；有 bot 文字 |
| C8 | 卡數正確：撳「全部加入排餐」 | 正確 N 張一齊入排餐 |
| C9 | 承 C1 | 卡可撳入去／收藏／加購物清單，無 error |
| C10 | 連續打 `一餸一湯` 兩次 | 唔會出重複菜（去重生效） |

### C. 護欄（唔應該 intercept）
| # | 輸入 | 預期 |
|---|---|---|
| C11 | `我想飲湯` | 當自由對話（唔出固定卡數） |
| C12 | `一湯` | 自由對話（缺餸數唔 intercept） |
| C13 | `唔食豬肉，一湯` | 自由對話（有忌口詞） |
| C14 | `點煮一餸一湯` | 自由對話（疑問詞） |
| C15 | `食譜一餸一湯` | 自由對話（含「食譜」） |
| C16 | `今晚食咩` | 自由對話，行為同改動前一致 |

---

## D. Phase 3（狀態一致性）

| # | 步驟 | 預期 |
|---|---|---|
| D1 | 送出一句長 prompt，未回覆即切去另一個 session | 回覆寫入**原本** session，唔會出現喺新 session |
| D2 | 承 D1，返回原 session | 見到回覆完整；新 session 乾淨 |
| D3 | 現有 session 中途觸發 3餸1湯 skip meal（fallback AI） | 之前對話**仍保留**，唔會被清空 |
| D4 | 由 library 出卡 | badge 正確顯示「食譜庫」（source fallback 收窄後唔會誤標 AI） |
| D5 | library 出卡後收藏 | 可成功收藏，唔會重複建立 |
| D6 | 5 個 hotkey 出卡 | badge／行為同改動前一致 |

---

## E. Session / UI 回歸
| # | 步驟 | 預期 |
|---|---|---|
| E1 | 開新對話 / 刪對話 / 側邊欄搜尋 | 正常 |
| E2 | 鍵盤彈起 | 輸入欄唔遮對話 |
| E3 | 關閉再開 app | session 同訊息仍存在 |
| E4 | 送圖（雪櫃） | 認食材 → 出 library 卡，流程正常 |

---

## F. 已知未做（如計劃）
- Streaming / typewriter：已放棄。
- Phase 4（model 抽象 + eval）：後端 spec，見 `PHASE4-MODEL-ABSTRACTION-SPEC.md`。
