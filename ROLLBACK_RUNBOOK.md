# Kindcipe — Rollback Runbook

> 最後更新：2026-10-21
> 目的：出事時 **5 分鐘內決定、30 分鐘內回滾**。
> 原則：**先止血，後查因**。唔好即場 debug production。

---

## 1. 何時要 rollback

| 觸發 | 嚴重度 | 第一個動作 |
|---|---|---|
| Crash-free < 99.5% / crash 暴增 | P0 | 關 flag / OTA rollback |
| 付款失敗 / 重複扣款 / Pro 錯誤 | P0 | 關付款入口 + 查 Stripe |
| 資料寫入錯誤 / 購物單錯亂 | P0 | 關 quickPlan + DB 檢查 |
| 登入 / 開 app 失敗 | P0 | Web rollback / OTA rollback |
| 新 UI 明顯走位 / 語言洩漏 | P1 | 關 `HOME_V2` |
| 效能明顯變差 | P1 | 關新功能 flag |
| 單一畫面 bug | P2 | forward fix（唔 rollback） |

---

## 2. 備份位置

| 項目 | 位置 |
|---|---|
| DB dump | `~/kindcipe-backup/pre-home-*.dump` + 雲端私人 folder |
| Code | git tag `pre-home-activation`（frontend + backend） |
| Web | Cloudflare deployment ID（部署時記錄） |
| OTA | EAS update group ID（每次 publish 記錄） |
| Native | EAS build number / TestFlight build |
| Secrets | 密碼管理器（唔好放 repo） |

**原則：每次重大部署前，先 dump + 記錄 ID。**

---

## 3. Rollback 矩陣

| 層 | 方法 | 時間 | 影響 |
|---|---|---|---|
| Feature flag | PostHog 關閉 / AsyncStorage override | < 1 分鐘 | 該功能即時消失 |
| OTA（JS） | republish 上一個 update group | 5–10 分鐘 | 用戶下次開 app 生效 |
| Web | `wrangler rollback` | 1–2 分鐘 | 即時 |
| Backend | 部署上一個 tag | 2–5 分鐘 | 即時 |
| Database | restore dump | 15–30 分鐘 | 會失去 backup 後寫入 |
| Native binary | **冇得降級** | — | 只能 forward fix |

---

## 4. 步驟

### 4.1 關閉 feature flag（最快）

1. PostHog → Feature Flags → `HOME_V2` / `QUICKPLAN` / `ONBOARDING_V2` → **Off**
2. 用戶重開 app 後生效
3. 如緊急：用 remote config / AsyncStorage override 強制 Legacy

> Flag 關閉後，即時回到 Legacy，**唔需要部署**。

### 4.2 OTA rollback

```bash
# 睇 production channel 最近 updates
npx eas update:list --channel production --limit 10

# 方法 A：republish 上一個 group（推薦）
npx eas update:republish --group <previous-group-id> --channel production

# 方法 B：如 CLI 支援
npx eas update:rollback --channel production
```

- 用戶需要**開 app 兩次**才完成下載
- 確認 runtimeVersion 一致

### 4.3 Web rollback

```bash
# 睇 deployments
npx wrangler deployments list

# 回滾
npx wrangler rollback <deployment-id>
```

- 確認 `content-type: application/javascript`
- 如 cache 問題：Cloudflare purge cache

### 4.4 Backend rollback

```bash
git checkout <previous-tag>
railway up --detach
curl https://<backend-domain>/health
```

- 確認 `/health` = ok
- 確認 DB 連線正常

### 4.5 Database restore（最後手段）

> ⚠️ 只喺資料損壞時使用；會失去 dump 之後嘅寫入。

1. **停止寫入**：暫停 backend（Railway → Service → Pause）或維護模式
2. **先備份現況**：
   ```bash
   DB_URL="$(railway variables -s Postgres --kv | sed -n 's/^DATABASE_PUBLIC_URL=//p')"
   pg_dump "$DB_URL" -Fc -f ~/kindcipe-backup/pre-restore-$(date +%F-%H%M).dump
   ```
3. **先 restore 去 scratch DB 驗證**：
   ```bash
   psql "$DB_URL" -c "CREATE DATABASE kindcipe_restore_check;"
   pg_restore --no-owner --no-privileges -d "$RESTORE_URL" ~/kindcipe-backup/pre-home.dump
   # 核對 counts
   psql "$DB_URL" -c "DROP DATABASE kindcipe_restore_check;"
   ```
4. **確認無誤才 restore 落 production**（停 backend 期間）
5. 重啟 backend → `/health` → 抽樣檢查
6. 記錄：restore 時間、dump 檔、失去嘅寫入範圍

### 4.6 付款止血

| 情況 | 動作 |
|---|---|
| Stripe webhook 壞 | Stripe Dashboard → 重送事件；必要時暫停 checkout |
| 重複扣款 | Stripe → Refund；停用該 price |
| IAP 驗證失敗 | 關 `IAP_LIVE`；iOS 隱藏購買 |
| Pro 錯誤開放 | `BETA_ALL_PAID=false`；檢查 `family.subscriptionStatus` |

---

## 5. Rollback 後驗證

- [ ] `/health` ok
- [ ] 登入成功
- [ ] 開 app 見到 Legacy / 正確版本
- [ ] 食譜列表載入
- [ ] 購物清單正常
- [ ] 付款狀態正確
- [ ] Sentry 冇新 crash 暴增
- [ ] 4 語言冇亂碼

---

## 6. 通訊模板

```
[Kindcipe 事故]
時間：HH:MM
影響：<功能 / 用戶範圍>
狀態：已止血 / 調查中
措施：已關閉 X / 已回滾至 <版本>
下一步：<時間> 更新
```

---

## 7. 事後

1. 寫 incident note（根因、時間線、影響、修復）
2. 加 regression test / flag / alert
3. 更新本 runbook
4. 如涉及資料：通知受影響用戶（如需要）

---

## 8. 禁止事項

- ❌ 唔好喺 production 即場改 code
- ❌ 唔好未備份就 restore
- ❌ 唔好一次過關所有 flag（分不清根因）
- ❌ 唔好喺未確認 runtimeVersion 就推 OTA
