# Kindcipe 上架前執行計劃（逐步做）

> 搭配 `LAUNCH_GO_NOGO_CHECKLIST.md`（Go/No-Go 判定）使用。
> 目標：P0 全綠 → 提交 App Store。

---

## 階段 1：真機 Auth smoke test（先做）
**需要**：iPhone（TestFlight build）+ Android（APK）。

| 步驟 | 動作 | 完成標準 |
|---|---|---|
| 1.1 | iPhone：開 app 兩次 → 登出 → **Apple 登入** | 入返 admin、6 廚房 |
| 1.2 | iPhone：**Google 登入** | 同一帳號 |
| 1.3 | iPhone：**Email OTP 登入** | 同一帳號、收到碼 |
| 1.4 | Android：開兩次 → **Apple 登入** | 同一帳號（A2）|
| 1.5 | Android：**Google 登入** | 同一帳號 |

失敗 → cap 圖 + 話我（我查 `[identity.resolve]`）。

---

## 階段 2：Email OTP → 非 owner email
| 步驟 | 動作 | 完成標準 |
|---|---|---|
| 2.1 | 用另一個 email 登入 | 收到碼、成功 |
| 2.2 | 睇垃圾郵件 | 標記非垃圾 |

---

## 階段 3：核心功能真機 smoke test
| 步驟 | 動作 |
|---|---|
| 3.1 | IG 分享 → import |
| 3.2 | YouTube 分享 → import |
| 3.3 | Facebook 分享 → import |
| 3.4 | 貼連結匯入 |
| 3.5 | 多截圖匯入 |
| 3.6 | AI Chef 生成 3 餸 1 湯 |
| 3.7 | 排餐 → 購物清單 |
| 3.8 | 切 4 語言 UI |

失敗 → cap 圖 + 話我（判斷 JS/OTA 定 native/rebuild）。

---

## 階段 4：App Store 提交要件
| 步驟 | 動作 | 參考 |
|---|---|---|
| 4.1 | 截圖 6.9"（1290×2796）| `APP_STORE_SCREENSHOTS.md` |
| 4.2 | App Privacy 問卷 | `APP_PRIVACY_ANSWERS.md` |
| 4.3 | IAP 產品：月 HK$30 / 年 HK$288 | 見 §4.3 |
| 4.4 | Apple 協議 + 銀行/稅務 | 見 §4.4 |
| 4.5 | Small Business Program | 見 §4.5 |
| 4.6 | 年齡分級 | 見 §4.6 |

### 4.3 IAP 產品設定
- App Store Connect → Features → In-App Purchases
- Product ID 建議：`com.kindcipe.app.pro.monthly` / `com.kindcipe.app.pro.yearly`
- 類型：Auto-Renewable Subscription
- 價格：HK$30 / HK$288（early-bird）
- ⚠️ 需先完成 §4.4 協議，否則產品無法 submit。

### 4.4 Apple 協議 + 銀行/稅務
- App Store Connect → Business（Agreements, Tax, and Banking）
- 簽 Paid Apps Agreement → 填銀行 + 稅務資料
- 狀態要 Paid Apps = Active

### 4.5 Small Business Program
- App Store Connect → Business → Small Business Program
- 年營收 < US$1M → 佣金 15%（vs 30%）

### 4.6 年齡分級
- App Store Connect → App Information → Age Rating
- 內容：食譜/煮食，一般 4+ 或 9+

---

## 階段 5：認證設定凍結
| 步驟 | 動作 |
|---|---|
| 5.1 | 通知另一 session：停止改 production auth |
| 5.2 | 凍結值見 `LAUNCH_GO_NOGO_CHECKLIST.md` §0 |
| 5.3 | 任何改動後必須三種登入重測 |

---

## 階段 6：P1（可上架後補）
| 步驟 | 動作 |
|---|---|
| 6.1 | I18N-P1.5（難度/「適量」/日期）|
| 6.2 | AN0（`recipeEvents.track` / `logRedirect`）|
| 6.3 | 後端 Sentry |
| 6.4 | 清理測試帳號 / 舊 migration |

---

## 進度追蹤
- [ ] 階段 1 真機 auth
- [ ] 階段 2 OTP 非 owner
- [ ] 階段 3 核心功能
- [ ] 階段 4 App Store 要件
- [ ] 階段 5 凍結
- [ ] 階段 6 P1
