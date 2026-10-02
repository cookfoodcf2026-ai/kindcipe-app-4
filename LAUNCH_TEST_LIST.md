# Kindcipe 上架測試清單（LAUNCH TEST LIST）

> 對應 build 6 / OTA branch `production`。每次更新後：**完全關閉 app → 開兩次**。
> 結果：✅ 通過 / ❌ 失敗 / ⏭ 略過。失敗請記：裝置、步驟、預期、實際、截圖。

## P0-A 登入 / 登出（Blocker）
- [ ] iOS：Apple 原生登入
- [ ] iOS/Android：Google 登入
- [ ] Email OTP（使用電郵繼續 → 6 位碼）
- [ ] 同 email：Google 註冊 → Apple 登入 → **自動連結同一帳號**
- [ ] **登出（設定頁）** → 去登入頁，**唔會彈返入 app**
- [ ] **登出（更多頁）** → 同上
- [ ] kill app → 重開 → 仍然係登入頁
- [ ] Admin：`kindcipe://login?mode=admin` → 管理員登入

## P0-B 匯入（Blocker）
- [ ] IG reel → 真圖 + 標籤自動填
- [ ] YouTube / 小紅書 / **Facebook** / Threads 匯入
- [ ] 圖片匯入（截圖）
- [ ] 貼上文字匯入
- [ ] **標籤為空 → 擋儲存 + 彈「請填：常用標籤」**（唔會靜靜地存到）
- [ ] 分類 / 菜式類型 為空 → 擋儲存 + 提示
- [ ] 湯麵→主食；糖水→甜品；水→飲品；羅宋湯→湯水
- [ ] **「匯入食譜」篩選** → 見到 FB/IG 匯入嘅食譜（唔再空）

## P0-C Share（Blocker，需 native build）
- [ ] IG 撳紙飛機 → Kindcipe → **直入匯入頁 + 自動解析**
- [ ] **熱啟**（app 已喺背景）分享 → 一樣匯入
- [ ] **冷啟**（先 kill app）分享 → 一樣匯入
- [ ] **連續分享 ×2**（第 1 次完成後，再分享第 2 個連結）→ **第 2 次都要自動解析**（唔會只剩空白新增頁）
- [ ] **仍喺 /import 頁**時再分享 → 一樣自動解析（pending-intent queue）
- [ ] Safari 分享 URL → 匯入
- [ ] 分享**圖片** → 當截圖匯入
- [ ] 多張截圖（caption + 留言）→ 合併解析
- [ ] **任何情況都唔會見到「頁面不存在」**
- [ ] 未登入時分享 → 登入後自動匯入

## P0-D AI Chef（見 AI_CHEF_TEST_SCENARIOS.md，22 場景）
- [ ] 辛辣的3餸1湯 → 4 卡帶辣
- [ ] 問卷未答完撳「食譜庫」→ ≥4 卡
- [ ] 「換」保留 constraint
- [ ] 全部加入排餐

## P0-E 會員
- [ ] Free 廚房可邀 1 位（共 2 人）
- [ ] promo code 兌換 7 日 Pro
- [ ] **iOS 冇價錢區**（只顯示追蹤 IG + 優惠碼），冇「App Store 付款」字句

## P1-A 食譜庫 / 篩選 / 排序
- [ ] 搜尋 bar 下：**全部／我的／網紅（3 chips）**
- [ ] 「我的」→ 子篩選（全部／自建／匯入）
- [ ] 排序 icon → 熱門／最新新增／最近編輯／最快／最易
- [ ] 篩選 sheet：快捷 chips 已減少、有「隱藏 AI 生成」
- [ ] 「隱藏 AI 生成」開啟 → AI 卡消失

## P1-B 購物 / 排餐
- [ ] 食譜「加入購物清單」→ **水／冰水默認唔勾**
- [ ] 排餐 → 購物清單同步、份量縮放

## P1-C i18n
- [ ] 切 English 走主要流程（登入／匯入／AI Chef／購物／排餐）

## 提交前（App Store）
- [ ] Privacy `https://kindcipe.com/privacy/`、Support `https://kindcipe.com/support/`
- [ ] 截圖（6.9" 1290×2796）
- [ ] App Privacy 問卷
- [ ] IAP（如已接好）；否則 iOS 無售賣入口
