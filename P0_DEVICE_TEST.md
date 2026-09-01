# P0 真機測試清單 - Kindcipe v11

**Build ID:** `9f25ed52-94ef-4397-b7bd-b29dc23e622f`  
**Build URL:** https://expo.dev/accounts/kindcipe/projects/kindcipe/builds/9f25ed52-94ef-4397-b7bd-b29dc23e622f  
**Bundle ID:** `com.kindcipe.app`  
**測試日期：** 2026-08-25  

---

## 📥 Step 1: 下載並安裝 IPA

### 方法 A: TestFlight（推薦）
1. EAS Build 完成後會自動上傳到 App Store Connect
2. 你會收到電郵通知
3. 喺 iPhone 打開 **TestFlight** app
4. 找到 **Kindcipe** 並安裝

### 方法 B: 直接安裝（需要 USB）
1. 喺 build URL 下載 `.ipa` 文件
2. 用 USB 連接 iPhone 到 Mac
3. 用 **Apple Configurator** 或 **Xcode** 安裝

---

## ✅ P0 測試清單

### Scenario #1: Email Login（核心 P0）

**測試步驟：**
1. 打開 Kindcipe app
2. 喺 Login 頁面輸入：
   - **Email:** `ui_test_20260825_100436@kindcipe.com`
   - **Password:** `UiTest1234!`
3. 點擊「登入」按鈕

**預期結果：**
- [ ] Login 頁面正常顯示，無白屏/crash
- [ ] 可以輸入 Email 同 Password
- [ ] 點擊登入後顯示 loading 狀態
- [ ] 成功進入首頁（見到「今晚食咗好？」）
- [ ] 無任何 error message 彈出

**實際結果：**
- [ ] 通過
- [ ] 失敗（請描述問題：___________________）

---

### Scenario #2: SecureStore Token Storage（安全 P0）

**測試步驟：**
1. 完成 Scenario #1 登入後
2. 完全關閉 App（由底部上滑，或者按 Home 兩次後上滑）
3. 等待 10 秒
4. 重新打開 App

**預期結果：**
- [ ] App 直接進入首頁，**唔使**重新登入
- [ ] 無 Login 頁面出現
- [ ] 仍然係同一個帳戶

**實際結果：**
- [ ] 通過
- [ ] 失敗（請描述問題：___________________）

**技術驗證（可選）：**
如果用 Xcode 連接真機，可以驗證 Keychain：
```bash
# 檢查 Keychain 是否有 token
# 需要越獄或者開發者工具
```

---

### Scenario #3: Logout（安全 P0）

**測試步驟：**
1. 喺首頁找到「設定」或者「帳戶」頁面
2. 點擊「登出」
3. 確認登出
4. 完全關閉 App
5. 重新打開 App

**預期結果：**
- [ ] 登出後返回 Login 頁面
- [ ] 重新打開 App 後，**需要**重新登入
- [ ] Token 已正確清除

**實際結果：**
- [ ] 通過
- [ ] 失敗（請描述問題：___________________）

---

### Scenario #4: Biometric Prompt（P1）

**測試步驟：**
1. 完成登入後，如果彈出 Biometric 提示
2. 選擇「Skip」或者「稍後設定」
3. 繼續使用 App

**預期結果：**
- [ ] Biometric prompt 正常顯示（或者無顯示，取決於設定）
- [ ] 選擇 Skip 後可以繼續使用 App
- [ ] 無死循環/crash

**實際結果：**
- [ ] 通過
- [ ] 失敗（請描述問題：___________________）

---

## 📋 P0 測試結果總結

| Scenario | 狀態 | 備註 |
|---|---|---|
| #1 Email Login | ⬜ 待測試 / ✅ 通過 / ❌ 失敗 | |
| #2 SecureStore | ⬜ 待測試 / ✅ 通過 / ❌ 失敗 | |
| #3 Logout | ⬜ 待測試 / ✅ 通過 / ❌ 失敗 | |
| #4 Biometric | ⬜ 待測試 / ✅ 通過 / ❌ 失敗 | |

**整體 P0 狀態：** ⬜ 全部通過 / ⬜ 有失敗項

---

## 🐛 問題回報格式

如果任何測試失敗，請用以下格式回報：

```markdown
### Bug ID: P0-001

**Severity:** P0（上架阻塞）

**Scenario:** #1 / #2 / #3 / #4

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:**


**Actual:**


**Device Info:**
- iPhone Model: 
- iOS Version: 
- App Build: 

**Evidence:**
- [ ] Screenshot attached
- [ ] Video attached
- [ ] Console log attached
```

---

## 📸 建議截圖位置

1. **Login 頁面** - 證明 UI 正常顯示
2. **首頁** - 證明登入成功（見到「今晚食咗好？」）
3. **任何 error message** - 如果有問題發生

---

## ⏭️ 下一步

完成 P0 測試後：

- ✅ **全部通過** → 繼續 P1/P2 修復
- ❌ **有失敗項** → 立即停止，回報 bug，修復後重新 build

---

**聯絡人：** Kindcipe Team  
**優先級：** 🔴 P0（上架前必須完成）
