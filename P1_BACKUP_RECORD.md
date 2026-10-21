# P-1 Backup & Rollback Record

> 開始：2026-10-21
> 狀態：**進行中 — DB dump 被 Railway token 過期阻擋**

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
| `DATABASE_PUBLIC_URL` | 存在（Railway Postgres service） |
| `pg_dump` | ⏳ 未完成 — Railway token 過期 |
| `pg_restore -l` 驗證 | ⏳ |
| Scratch DB restore + counts | ⏳ |
| 本機備份 | ⏳ `~/kindcipe-backup/`（已建立，未有 dump） |
| 雲端備份 | ⏳ 手動上傳（rclone 未安裝） |

**Blocker：** Railway CLI token 約 2026-10-21 08:19 UTC 過期。
`railway variables` / `railway connect` 回 `Problem processing request`。
**解法：** 喺 terminal 跑 `railway login`（瀏覽器），完成後重試。

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

- [ ] 演練（rollback → 確認 → 回復最新）
- 最新 deployment：`de39068a-e589-4fdd-89e1-02249893ff2f`

## 5. 下一步

1. 用戶完成 `railway login`
2. 重試 `pg_dump`（用 `DATABASE_PUBLIC_URL`）
3. Scratch DB restore + counts
4. 雲端備份
5. Web rollback 演練
6. 更新本記錄為 **完成**
