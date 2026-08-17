# Kindcipe 上架前最終風險清單

> 更新日期：2026-08-14
> 方法：純代碼靜態 review（`app/_layout.tsx`、`lib/trpc.ts`、`hooks/`、AI Chef、planner/shopping/index/recipe/import/recipe-editor）
> 未做實機壓測。逐項狀態以「✅ 已修／🔶 待實機驗證／🟢 可接受風險」標記。

---

## 1. ✅ 已修（已確認落 code）

| 項目 | 內容 | 位置 |
|---|---|---|
| Crash 監控 | Sentry init（prod only）、ErrorBoundary、CrashScreen、`ErrorUtils.setGlobalHandler` | `app/_layout.tsx`、`src/components/ErrorBoundary.tsx`、`src/components/CrashScreen.tsx`、`lib/global-error-handler.ts` |
| tRPC timeout | Query 15s / Mutation 30s，按 HTTP method 分派 | `lib/trpc.ts` |
| Splash 接管 | `preventAutoHideAsync` + `hideAsync`（`!showLoading` 時） | `app/_layout.tsx` |
| Query cache | `gcTime` 10 分鐘、`refetchOnWindowFocus:false`、`refetchOnReconnect:true`、背景不輪詢（全域 default） | `app/_layout.tsx` |
| AI Chef 大圖 | base64 → 真 URL（`uploadRecipeImage`），`MAX_IMAGES_PER_SESSION=3`，`uploadingRef` race guard，persist 保留 URL | `app/ai-chef.tsx` |
| 步驟高亮 | `computeStepParts` / `renderStepParts` 抽出 + memo | `lib/highlight-step.tsx`、`app/recipe/[id].tsx` |
| 圖片壓縮 | 迭代上限 5 次 + 空 base64 即 throw | `lib/image-utils.ts` |
| 步驟圖上傳 | sequential → `Promise.all` 並行（順序由 index 保留） | `app/recipe-editor.tsx`、`app/import.tsx` |

### 本次 review 額外修補

| 項目 | 內容 | 位置 |
|---|---|---|
| Biometric bootstrap hang | biometric effect 例外時原先唔會 `setBiometricChecked(true)` → 卡 loading；已補 `finally` 兜底 | `app/_layout.tsx` biometric effect |
| Conflict alert 流程 | planner/index `addMealM` 衝突 alert 原先 non-blocking，按「取消」仍會繼續開 picker；已改 `await` 用戶選擇，取消即停 | `app/(tabs)/planner.tsx`、`app/(tabs)/index.tsx` |
| `fromMealPlanId` 缺失 | `handleConfirmMeal` 建立嘅 `pendingConfirmRecipe` 原先冇帶 `fromMealPlanId`，confirm 後再加嘅食材唔受 meal 刪除/改期 cascade；已補 | `app/(tabs)/planner.tsx` |
| 殘留 debug log | `[Planner] addMealM onSuccess, refetching...` 已刪 | `app/(tabs)/planner.tsx` |
| 格式 | `_layout.tsx` trailing whitespace 已清 | `app/_layout.tsx` |

---

## 2. ⚠️ Kilo 報告同實際 repo 嘅出入（已修正）

Kilo 結尾話「All five PRs implemented」，但 **PR-3 輪詢降頻實際未完全兌現**。已對齊：

| 位置 | Kilo 宣稱 | 實際（未改前） | 已改為 |
|---|---|---|---|
| `app/(tabs)/shopping.tsx` | 3s → 8s + 背景關 | **3s、冇背景 flag** | 8s + `refetchIntervalInBackground:false` |
| `app/(tabs)/index.tsx`（首頁 shopping.list） | 30s | **5s、冇背景 flag** | 30s + 背景關 |
| `app/(tabs)/index.tsx` PendingActionsCard（mealPlan.list / shopping.list） | 30s | **5s** | 30s |
| `app/(tabs)/planner.tsx`（shopping.list） | 60s | **8s** | 30s |
| `hooks/usePendingCounts.ts` | 60s | 30s | 30s（保留，合理） |

> 結論：背景輪詢已由全域 default 關閉；前景輪詢已降到 8–30s。自己裝置寫入仍靠 `utils.*.invalidate()` 即時反映，不受影響。

---

## 3. 🔶 待實機驗證（靜態無法確認）

1. **冷啟動白閃**：`_layout.tsx` 首 render 即 render children（非 null-first），`preventAutoHideAsync` 可能已太遲。**必測**：冷啟動有無白屏閃爍；若有 → 放棄接管 splash，改用現有 loading overlay。
2. **Sentry 真機 event**：`enabled: !__DEV__`，必須用 Release build 驗證 event 到達 dashboard（DSN 未設時唔會發）。
3. **AI Chef 3 圖流程**：先 `uploadRecipeImage` 再 `chat`；reload session 圖片仍能由 URL 顯示。
4. **Timeout 手感**：airplane mode 下 query ≤15s、mutation ≤30s 出錯。
5. **舊 cache session**：舊 data-URI session 仍可 render（Kilo 設計為向後兼容）。
6. **低端機長時間**：iPhone SE2 / Android 中階，5 tabs 滑動無 `JS thread busy`；AI Chef 連發圖 memory 唔持續上升。

---

## 4. 🟢 可接受風險（不需要上線前修）

| 項目 | 原因 |
|---|---|
| `Linking.openURL` 無 `canOpenURL` | 極少 user 無相應 app；失敗僅靜默 |
| 剪貼簿提示時機 | 已有 24h dedup，且僅 tabs 頁觸發 |
| 通知權限 request 時機 | 用戶可拒絕，不阻塞 |
| `expo-in-app-purchases` deprecated | 目前 stub；未來上 IAP 再處理 |
| AI Chef AsyncStorage 寫入 | 每次 session 更新會 `setItem`，資料量細（URL 已剝離 base64） |
| FlatList 未優化 | 資料量細，暫不影響 |
| Backend repo 耦合（`lib/router-types.ts` 指 sibling 路徑） | 同 workspace，上線唔受影響；拆倉前再處理 |

---

## 5. Go / No-Go 建議

- **可 submit review**：✅（前提：本清單「待實機驗證」第 1、2 項有條件先做）
- **強烈建議 submit 前完成**：
  1. Release build 冷啟動一次 → 確認無白閃。
  2. Release build 手動觸發一個 error → 確認 Sentry dashboard 收到 event（否則 crash 監控形同虛設）。
- **上線後頭 7 天**：監控 Sentry fatal rate（目標 <0.5% sessions）同 mutation timeout error rate（目標 <2%）。

---

## 6. 下一步（可選）

- [ ] Release build + TestFlight 內測 1 天
- [ ] 確認 DSN 已填入 `EXPO_PUBLIC_SENTRY_DSN`
- [ ] 冷啟動白閃實機確認
- [ ] Sentry event 上報確認
