# 數據採集補齊計劃（Analytics / Third-party readiness）

> 目標：支援「有一定用量後，同第三方合作 + 數據驅動持續優化」。
> 最後更新：2026-10-03

---

## 背景問題（補做前）
| 問題 | 影響 |
|---|---|
| 前端從未 call `recipeEvents.track` | `recipe_events` 表全空，無熱門/排行為分析 |
| 前端從未 call `logRedirect` | `redirect_logs` 全空，無分享來源歸因 |
| 24 個 PostHog 事件只有 12 個 fire | 匯入/購買/留存係盲區 |
| 後端零可觀測性 | 錯誤盲區 |

---

## 階段 A：接線現有事件（本次完成）

| # | 項目 | 檔案 | 狀態 |
|---|---|---|---|
| A1 | `trackRecipeEvent()` helper + `logRedirect()` helper | `lib/analytics.ts` | ✅ |
| A2 | 食譜 view 事件（去重 per recipe）| `app/recipe/[id].tsx` | ✅ |
| A3 | 食譜 plan 事件 | `app/recipe/[id].tsx` | ✅ |
| A4 | `RecipeImported` | `app/import.tsx` | ✅ |
| A5 | `RecipeSaved`（create/update）| `app/recipe-editor.tsx` | ✅ |
| A6 | `KitchenCreated` / `KitchenJoined` | `app/kitchen-settings.tsx` | ✅ |
| A7 | `Logout` | `app/settings.tsx` | ✅ |
| A8 | `LanguageChanged` | `app/settings.tsx` | ✅ |
| A9 | `ShoppingItemChecked` | `app/(tabs)/shopping.tsx` | ✅ |
| A10 | `AiEditUsed`（偵測修改意圖）| `app/ai-chef.tsx` | ✅ |
| A11 | `SignupStarted` | `app/onboarding.tsx` | ✅ |
| A12 | `PurchaseStarted` / `PurchaseCompleted` | `lib/purchase.ts` | ✅ |
| A13 | `identifyUser` 帶非 PII traits（role/family_role/signup_at/language）| `app/_layout.tsx` | ✅ |
| A14 | 後端 `recipeEvents.track` 記錄 userId + familyId | `server/routers.ts` | ✅ |

### 事件覆蓋現況（24/24 定義，實際 fire）
| 已 fire | 說明 |
|---|---|
| LoginCompleted, Logout | ✅ |
| SignupStarted, OnboardingCompleted | ✅ |
| KitchenCreated, KitchenJoined | ✅ |
| RecipeImported, RecipeSaved | ✅ |
| AiRecipeGenerated, AiEditUsed | ✅ |
| MealPlanned, ShoppingListGenerated, ShoppingItemChecked | ✅ |
| PaywallViewed, PurchaseStarted, PurchaseCompleted, PromoRedeemed | ✅ |
| LanguageChanged | ✅ |
| ShareReceived/Consumed/Failed | ✅ |
| AccountLinkPromptShown/Clicked | ✅ |

> 註：`recipe_events`（view/plan/save/cook）同 `redirect_logs` 現已由前端接線，trending / 歸因有料。

---

## 階段 B：分析基建（未做）
| # | 項目 | 狀態 | 備註 |
|---|---|---|---|
| B1 | 後端 Sentry | ⬜ | 需裝 `@sentry/node` + DSN |
| B2 | PostHog funnel / retention dashboard | ⬜ | PostHog UI 設定（見下）|
| B3 | 後端 aggregate / 報表 endpoint | ⬜ | DAU、匯入成功率、熱門 |
| B4 | 數據匯出（CSV / BigQuery sync）| ⬜ | 第三方合作需要 |

### B2 PostHog Dashboard 建議（你自己喺 PostHog UI 建）
- **Funnel**：signup_started → onboarding_completed → recipe_imported → meal_planned → purchase_completed
- **Retention**：login_completed by week
- **Trends**：recipe_imported by share source、ai_recipe_generated vs ai_edit_used
- **Cohort**：by language / family_role

---

## 階段 C：合規（合作必備，未做）
| # | 項目 | 狀態 |
|---|---|---|
| C1 | 隱私政策寫明 analytics 用途 | ⬜ |
| C2 | App Privacy 問卷（已草稿，需加第三方共享）| ⚠️ |
| C3 | 用戶 consent / opt-out（GDPR/PDPO）| ⬜ |

---

## 同第三方合作所需（未來）
1. **Aggregate 數據**（去識別）：熱門食材、菜式類型、地區趨勢。
2. **Export 格式**：CSV / JSON / BigQuery。
3. **Attribution**：`redirect_logs` 已有 platform + keyword。
4. **Privacy compliance**：C1–C3 先完成。
5. **Data Processing Agreement** 草稿。

---

## 進度
- [x] 階段 A（事件接線）
- [ ] 階段 B（基建）
- [ ] 階段 C（合規）
