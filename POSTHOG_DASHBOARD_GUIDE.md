# PostHog Dashboard 設定指引（B2）

> 你嘅 PostHog project: key `phc_CQ7LWFNnq...`，host `https://us.i.posthog.com`。
> 登入 PostHog → 你嘅 project → 按以下建立 dashboard / insight。
> 前提：已喺 app 送出事件（本次已接線，需**開 app 兩次**等 OTA + 用一段時間先有數據）。

---

## 1. Funnel（核心轉化）
PostHog → **Insights → New → Funnel**
步驟（依序）：
1. `signup_started`
2. `onboarding_completed`
3. `recipe_imported`
4. `meal_planned`
5. `purchase_completed`

- Conversion window：14 days
- 用途：睇邊一步流失最多。

## 2. Retention（留存）
PostHog → **Insights → New → Retention**
- Cohort event：`login_completed`
- Returning event：`login_completed`
- Interval：Weekly
- 用途：DAU/WAU 留存曲線。

## 3. Trends（成長）
PostHog → **Insights → New → Trends**
| Insight | 事件 | 拆解 |
|---|---|---|
| 匯入量 | `recipe_imported` | Breakdown by `onboarding` |
| AI 使用 | `ai_recipe_generated` + `ai_edit_used` | 兩條線 |
| 分享健康 | `share_received` vs `share_failed` | 監控分享壞 |
| 付費 | `paywall_viewed` + `purchase_started` + `purchase_completed` | Funnel 或 lines |
| 語言分佈 | `language_changed` | Breakdown by `language` |
| 廚房成長 | `kitchen_created` + `kitchen_joined` | — |

## 4. Cohorts（分群）
PostHog → **People → Cohorts → New**
- **付費用戶**：`purchase_completed` within last 90 days
- **重度匯入者**：`recipe_imported` ≥ 10 times in 30 days
- **Apple relay 用戶**：`account_link_prompt_shown` with reason `apple_relay_only`

## 5. Recipe ranking（後端表，非 PostHog）
- `recipe_events` 表已可查；後端 `getTrendingRecipes(7)` 有計分：
  - view×1 + plan×5 + save×3 + cook×4
- 之後 B3 會出 endpoint 俾你／第三方查。

---

## 檢查
- [ ] Funnel 建好、見到數據
- [ ] Retention 建好
- [ ] Trends ×6
- [ ] Cohorts ×3
- [ ] （可選）設定 PostHog → Slack/email 告警（share_failed 突增）
