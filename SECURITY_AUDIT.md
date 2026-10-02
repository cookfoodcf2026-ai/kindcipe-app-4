# Kindcipe 安全審計與上架前 Sign-off（SECURITY_AUDIT）

> 建立：2026-10（QA & Security Lead 審查）
> 目標：記錄已修漏洞、未修風險、上架前必須通過嘅 gate。

---

## 1. 已修（本次）

| # | 漏洞 | 修法 | 位置 |
|---|---|---|---|
| S1 | **IDOR：R2 儲存 key 無 tenant 隔離** | 新上載 key 改 `recipe-screenshots/f<familyId>/<uuid>.<ext>`；`parseImage`/`deleteRecipeImage` 驗證 key 前綴屬自己家庭 | `recipes.ts` |
| S2 | **SSRF：伺服器抓用戶 URL 無防護** | 新增 `utils/safeUrl.ts`（`assertSafeUrl` / `safeFetch`）；阻擋非 http(s)、private/loopback/link-local、內部主機、DNS rebinding；redirect 逐跳驗證；body 大小上限 | `utils/safeUrl.ts`、`recipes.ts` |
| S3 | **配額繞過 + 成本濫用** | `recipes.importUser` 加 `assertFamilyQuota` + 成功後 `incrementImportUsage`（外部來源才計） | `recipes.ts` |
| S4 | **上載濫用** | `uploadRecipeImage` 只接受圖片 MIME + 專屬 rate limit（20/min/IP） | `recipes.ts`、`index.ts` |
| S5 | 小紅書短連結 | 同時處理 `xhslink.com` 同 `xhslink.cn`；解出嘅 URL 亦過 SSRF 驗證 | `recipes.ts` |

## 2. 已確認安全（無需改）
- CORS：allowlist，明確拒絕 `*`。
- Token：生產用 **SecureStore**（web/e2e 才 AsyncStorage）。
- OTP / 登入：有 brute-force 限流。
- 全域 + AI + parse rate limit 已存在。

## 3. 上架前仍需處理（Gates）

| Gate | 內容 | 狀態 |
|---|---|---|
| G1 | **依賴漏洞**：前端 14 high / 18 moderate；後端 5 high / 3 moderate → 修或記錄風險接受 | ⬜ |
| G2 | **全面 IDOR 審計**：逐個 tRPC endpoint 確認 `activeFamilyId` 過濾（getById、shopping、mealPlan、family、pantry…） | ⬜ |
| G3 | **監控告警**：設 PostHog key；Sentry alert（登入失敗暴增、429、SSRF 被擋） | ⬜ |
| G4 | **滲透自測**：越權讀、IDOR、SSRF、OTP 濫用、上載 DoS、Prompt injection | ⬜ |
| G5 | **合規**：PII 清單、刪帳號真刪、備份/還原演練 | ⬜ |
| G6 | `ci-gate` 全綠 | ⬜ |

## 4. 已知限制（非漏洞）
- Threads / TikTok / 小紅書 **copy-link** 靠伺服器抓 → 反爬會失敗（Path B 未做）。Share（Path A）不受影響。
- Prompt injection：抓落嘅頁面文字餵 LLM；已用結構化 JSON 輸出降低風險，未完全根治。

## 5. 簽核標準
> **可上架 = G1–G6 全綠 + 本次 S1–S5 已部署驗證。**
