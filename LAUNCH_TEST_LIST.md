# Kindcipe 上架測試清單（LAUNCH TEST LIST）

> 對應 **iOS build 8**（含 Share nonce 修正）/ Android **preview** OTA。
> 每次更新後：**完全關閉 app → 開兩次**（第一次下載、第二次生效）。
> 結果：✅ 通過 / ❌ 失敗 / ⏭ 略過。失敗請記：`優先級｜裝置｜步驟｜預期｜實際｜截圖`。

---

## 🔴 P0-A｜Share（最關鍵）
- [ ] **正常開 app**（撳 icon，唔經分享）→ **直入主頁，唔會閃 import 頁**
- [ ] **冷啟**：先 kill app → IG 分享 → **自動開 app + 自動匯入分析**
- [ ] **熱啟**：app 喺背景 → IG 分享 → 一樣自動匯入
- [ ] **連續分享 ×3–5 次**（IG/FB 混合）→ **每次都成功**（nonce 修正核心）
- [ ] **仍喺 import 頁**時再分享 → 一樣自動匯入
- [ ] Safari 分享 URL → 匯入
- [ ] 分享**圖片** → 當截圖匯入
- [ ] 未登入時分享 → 登入後自動匯入
- [ ] **任何情況都唔會見「頁面不存在」**

## 🔴 P0-B｜匯入（平台）
- [ ] **IG Reel（有 caption）** → 出食譜 + 真圖 + 標籤
- [ ] **IG Reel（無 caption，只有圖）** → Vision 讀圖出食譜
- [ ] **YouTube** → 出食譜 + 圖
- [ ] **Facebook Reel**（copy link 或分享）→ 出食譜
- [ ] **Threads**（`threads.com/@.../post/...` 連結）→ **應成功**
- [ ] **小紅書**（`xhslink.cn` 連結）→ 短連結已修；**可能仍反爬失敗**（預期內）
- [ ] **TikTok** → 可能失敗（反爬，Path B 未做）
- [ ] 一般網頁食譜連結 → 匯入

## 🔴 P0-C｜匯入（表單）
- [ ] **標籤自動簡選**：匯入後 Tags 欄有字 **＋ Common tags 有 chip 亮起（可多個）**
- [ ] **無標籤** → **擋儲存** + 提示「請填：常用標籤」
- [ ] **菜式類型／分類** 缺 → **擋儲存** + 提示
- [ ] 份量／時間輸入 `abc` → 擋 + 提示
- [ ] **多張截圖**（相簿揀 2–3 張）→ 合併解析
- [ ] 貼上文字匯入

## 🔴 P0-D｜登入 / 登出
- [ ] iOS：Apple 原生登入
- [ ] iOS/Android：Google 登入
- [ ] Email OTP（使用電郵繼續 → 6 位碼）
- [ ] 同 email：Google 註冊 → Apple 登入 → **自動連結同一帳號**
- [ ] **登出（設定頁）** → 去登入頁，**唔會彈返入 app**
- [ ] **登出（更多頁）** → 同上
- [ ] kill app → 重開 → 仍然係登入頁
- [ ] Admin：`kindcipe://login?mode=admin` → 管理員登入

## 🔴 P0-E｜AI Chef（見 `AI_CHEF_TEST_SCENARIOS.md`，22 場景）
- [ ] 打「**辛辣的3餸1湯**」→ **4 卡帶辣**、尊重需求
- [ ] 問卷未答完撳「食譜庫」→ **≥4 卡**
- [ ] 「換」保留 constraint
- [ ] 「全部加入排餐」→ 入 planner + shopping

## 🔴 P0-F｜會員
- [ ] Free 廚房可邀 1 位（共 2 人）；第 3 人被擋 + 升級提示
- [ ] promo code 兌換 7 日 Pro
- [ ] **iOS 冇價錢區**（只顯示追蹤 IG + 優惠碼），冇「App Store 付款」字句

---

## 🟠 P1-A｜食譜庫 / 篩選 / 排序
- [ ] 搜尋 bar 下：**全部／我的／網紅（3 chips）**
- [ ] 「我的」→ 子篩選（全部／自建／匯入）
- [ ] 排序 icon → 熱門／最新新增／最近編輯／最快／最易
- [ ] 篩選 sheet：快捷 chips 已減、有「隱藏 AI 生成」
- [ ] 「匯入食譜」filter → 見到 FB/IG 匯入嘅食譜
- [ ] 湯麵→主食；糖水→甜品；水→飲品；羅宋湯→湯水

## 🟠 P1-B｜購物 / 排餐
- [ ] 食譜「加入購物清單」→ **水／冰水默認唔勾**
- [ ] 排餐 → 購物清單同步、份量縮放

## 🟠 P1-C｜會員 / 付款（補充）
- [ ] 匯入達上限 → paywall
- [ ] AI 對話達上限 → paywall

## 🟡 P2｜i18n（已知未修，記錄用）
- [ ] 切 English 走主要流程 → 記錄邊度仍有中文（排餐菜名、購物項、食材名、AI 回覆）
- [ ] 切 Filipino / Indonesian → 同上

## 🟡 P2｜其他
- [ ] App icon 清晰、離線 banner、推送提醒、Face ID、刪除帳戶

---

## 已知限制（唔算 bug，唔使報）
- 小紅書 / TikTok **copy-link** 反爬可能失敗（Path B 未做）。
- fil/id 部分內容仍英文/中文（i18n 資料層未修）。
- 冷啟分享可能短暫空白 1–2 秒先解析（未加 loading）。
- 正常開 app 唔應閃 import 頁；若仍閃 → 報 bug。

## 回報格式
`P0-C｜iPhone 15｜匯入 IG｜預期有標籤 chip｜實際空白｜<截圖>`

## 提交前（App Store）
- [ ] Privacy `https://kindcipe.com/privacy/`、Support `https://kindcipe.com/support/`
- [ ] 截圖（6.9" 1290×2796）
- [ ] App Privacy 問卷
- [ ] IAP（如已接好）；否則 iOS 無售賣入口
