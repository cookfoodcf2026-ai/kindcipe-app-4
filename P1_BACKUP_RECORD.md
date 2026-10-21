# P-1 Backup & Rollback Record

> 開始：2026-10-21
> 狀態：**✅ P-1 全部完成（除雲端備份待手動上傳）**

## 1. Code tags

| Repo | Tag | Commit |
|---|---|---|
| `kindcipe-app-4` | `pre-home-activation` | `a797d8eb` (docs: lock home revamp plan…) |
| `kindcipe-backend` | `pre-home-activation` | 已 push（HEAD） |

- [x] Tags created
- [x] Tags pushed to origin

## 2. Database

| 項目 | 狀態 |
|---|---|
| `pg_dump` | ✅ `~/kindcipe-backup/pre-home-2026-10-21.dump`（874 KB, 72 tables, TOC 720） |
| `pg_restore -l` 驗證 | ✅ 可讀，格式 CUSTOM / gzip |
| Scratch DB restore | ✅ `kindcipe_restore_check` restore exit=0, errors=0, 33 tables |
| Counts 核對 | ✅ 全部吻合（見下） |
| 本機備份 | ✅ 已存在 |
| 雲端備份 | ⏳ 未做（rclone 未安裝；建議手動上傳 iCloud/Dropbox） |
| Scratch DB | ✅ 已 drop |

**Counts（source = restored）：**

| table | count |
|---|---|
| users | 60 |
| families | 1 |
| family_members | 2 |
| official_recipes | 314 |
| custom_recipes | 74 |
| meal_plans | 195 |
| common_ingredients | 1223 |
| shopping_items | 70 |
| user_identities | 63 |
| ai_chef_seen_recipes | 30 |

**Root cause 記錄：** `railway variables` 長期回 `Problem processing request`。
原因：Postgres service 嘅 `DATABASE_PUBLIC_URL` 引用 `RAILWAY_TCP_PROXY_DOMAIN/PORT`，但 **TCP proxy 未開** → resolver render 失敗。
臨時解法：`serviceDomainCreate`（targetPort 5432）令 Railway 生成 TCP proxy 變數 → resolver 恢復 → dump。
**事後已還原**：`serviceDomainDelete` 移除臨時 domain，`RAILWAY_TCP_PROXY_*` 已消失（public 存取已收回）。

## 3. Platform state（已記錄）

| 項目 | 值 |
|---|---|
| Cloudflare deployment ID | `de39068a-e589-4fdd-89e1-02249893ff2f` |
| Cloudflare version ID | `39313002-9699-4965-9452-f7e05d69fcf9` |
| Cloudflare created | 2026-10-17T10:17:29Z |
| EAS iOS build #9 | `f6896705-9422-4b53-b619-8c3d6e97e0cf` |
| EAS build commit | `123da87ae56b4f284130934ba88e830a1ac13648` |
| EAS runtimeVersion | `1.0.0` |
| EAS production update group | `50cb61db-9e94-4bd0-9c12-4aadb7d1ff05` |
| **OTA code signing** | **N/A（未配置）** |

## 4. Web rollback

- [x] 演練 ✅
  - rollback → `f7985dfa-f862-43b4-9ec4-9a9a341d5754@100%`（驗證成功）
  - restore → `39313002-9699-4965-9452-f7e05d69fcf9@100%`（= 最新，驗證成功）
- 最新 deployment：`de39068a-e589-4fdd-89e1-02249893ff2f`
- 指令：`npx --yes wrangler@4.86.0 versions deploy <version-id>@100% -y`

## 5. 下一步

1. 雲端備份（手動上傳 `~/kindcipe-backup/pre-home-2026-10-21.dump`）
2. → L1 小修正 → L2 Stripe Live → L3 資產/簽名/build
