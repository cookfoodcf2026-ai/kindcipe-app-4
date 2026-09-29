# Stripe 付費設定（Web / Android）

> iOS 保留 Apple IAP（App Store 3.1.1）；本文件只講 Stripe（web + Android）。

## 架構
```
Web / Android ── tRPC billing.createCheckoutSession ──→ Stripe Checkout
                → 用戶付款 → /api/stripe/webhook → activateFamilySubscription()
                → 返回 app.kindcipe.com/settings?billing=success → confirmCheckout()
iOS App ──────── Apple IAP（subscription.verifyIap）────→ 同一個 subscription 表
```

兩種渠道最後都叫 `activateFamilySubscription()`，所以 **Pro 狀態 App 同 Web 統一**。

## 1. 開 Stripe / 建價格
1. https://dashboard.stripe.com → 建立帳戶
2. **測試模式**（右上 Test mode 開關）先做
3. Products → **Add product**（做兩次）：
   | 產品 | 價格 | 類型 |
   |------|------|------|
   | Kindcipe 月費 | **HK$30.00** | Recurring / Monthly |
   | Kindcipe 年費 | **HK$288.00** | Recurring / Yearly |
4. 每個價格複製 **Price ID**（`price_...`）

## 2. Railway 環境變數
```
STRIPE_SECRET_KEY=sk_test_...或 sk_live_...
STRIPE_PRICE_MONTHLY=price_...（月費）
STRIPE_PRICE_YEARLY=price_...（年費）
STRIPE_SUCCESS_URL=https://app.kindcipe.com/settings?billing=success
STRIPE_CANCEL_URL=https://app.kindcipe.com/settings?billing=cancel
```

## 3. Webhook
1. Stripe → Developers → **Webhooks** → Add endpoint
2. URL：`https://kindcipe-backend-production.up.railway.app/api/stripe/webhook`
3. Events 揀：
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. 複製 **Signing secret**（`whsec_...`）→ Railway `STRIPE_WEBHOOK_SECRET`

## 4. 驗證
- [ ] Railway `billing.status` 回 `configured: true`（登入後）
- [ ] Webapp 撳「升級」→ Stripe Checkout 開到
- [ ] 用測試卡 `4242 4242 4242 4242`（任何未來日期 / CVC）付款
- [ ] 返回 `settings?billing=success` → 顯示「付款成功」+ Pro 生效
- [ ] Stripe Dashboard 見到付款 + webhook 200

## 5. 轉正式（Live）
- Stripe 切換 **Live mode** → 重新建產品/價格 + 新 webhook
- 更新 Railway env 用 `sk_live_` / 新 `price_` / 新 `whsec_`

## ⚠️ iOS 合規
- iOS app **唔會顯示** Stripe（`isStripeSupported` = web/android only）
- 唔可以喺 iOS 內寫「去網頁付款更平」（會被 App Review 拒）
- iOS 付費要用 Apple IAP；`react-native-iap` 整合為後續工作
