# Expo 依賴管理 Skill

## 適用場景
- 安裝新 npm 包
- 更新現有依賴
- Metro 啟動錯誤排查
- 依賴樹衝突修復

## 核心規則

### 1. 安裝新依賴前（必須執行）
```bash
# 備份 package-lock.json
cp package-lock.json package-lock.json.backup

# 檢查依賴衝突
npm audit

# 使用精確版本安裝（避免 ^ 或 ~ 自動升級）
npm install --save-exact <package>
```

### 2. 安裝後驗證（必須執行）
```bash
# 清除 Metro 緩存啟動
npx expo start -c

# 確認 app 可正常啟動（掃描 QR Code 或啟動模擬器）

# 如果失敗，立即恢復備份
cp package-lock.json.backup package-lock.json
rm -rf node_modules && npm install
```

### 3. 修復流程（Metro 錯誤時）

**警告信號：**
- `fs.readdir is not a function`
- `DependencyGraph.js` 錯誤
- Metro Bundler 無法啟動
- `Cannot read properties of undefined (reading 'get')`

**修復步驟：**
```bash
# 1. 恢復備份 package-lock.json
cp package-lock.json.backup package-lock.json

# 2. 刪除 node_modules 並重新安裝
rm -rf node_modules && npm install

# 3. 清除 Metro 緩存啟動
npx expo start -c
```

### 4. Git 提交規範
```bash
# package.json + package-lock.json 必須一齊提交
git add package.json package-lock.json
git commit -m "deps: add <package-name>"

# 切勿手動改 package-lock.json
# 讓 npm 自動管理
```

## 預防措施

### 每次啟動前
```bash
npx expo start -c
```

### 每週一次
```bash
watchman watch-del-all
```

### 每月一次
```bash
rm -rf node_modules && npm install
```

## 何時要停手並問

當出現以下情況，先停手，唔好繼續自動改依賴：
- `package.json` 同 `package-lock.json` 明顯唔一致
- `npm install` 後改動咗大量 package，而你唔係刻意升級
- Metro 由一個錯誤變成另一個完全唔同嘅錯誤
- 需要改 `metro.config.js`、`app.config.js`、`expo` 相關底層設定
- 需要從完整 zip backup 還原整個 project

處理原則：
- 先匯報變更
- 先問 user 是否接受依賴變動
- 唔好默默覆蓋 lockfile 或手動改 node_modules

## 依賴版本管理

### 推薦做法
| 場景 | 命令 | 說明 |
|------|------|------|
| 安裝生產依賴 | `npm install --save-exact <package>` | 鎖定精確版本 |
| 安裝開發依賴 | `npm install --save-dev --save-exact <package>` | 鎖定精確版本 |
| 更新依賴 | `npm update --no-save` 先測試 | 唔好直接更新 |

### 避免做法
| 錯誤做法 | 問題 |
|----------|------|
| `npm install <package>` | 可能安裝 ^ 或 ~ 版本，導致自動升級 |
| `npm update` | 可能破壞依賴樹 |
| 手動改 package-lock.json | 可能引入版本衝突 |

## 參考案例

### 2026-08-26 Metro 依賴樹錯誤修復
**問題：** Metro 啟動失敗，錯誤信息 `fs.readdir is not a function`
**根因：** node_modules 依賴樹不一致
**解決方案：**
1. 恢復 8/21 備份 package-lock.json
2. rm -rf node_modules && npm install
3. npx expo start -c

**教訓：** 安裝新依賴前必須備份 package-lock.json

## 團隊協作規範

如果有多個 agent/開發者：
1. 拉取代碼後必須執行 `npm install`
2. 安裝依賴後立即提交 package.json + package-lock.json
3. 唔好手動改 package-lock.json
4. 定期同步 lock file 避免分歧

## 備份檔案規範

- `package-lock.json.backup` 只作本機救援用途
- 唔好提交 backup file 入 git
- 如果需要保留多個備份，改用 repo 外位置或明確命名並加入 ignore 規則
