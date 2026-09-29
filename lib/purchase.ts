/**
 * Subscription purchase helper (universal build).
 *
 * Channel by platform:
 *  - Web / Android → Stripe Checkout (see backend billing router). Opening the
 *    URL navigates the browser / in-app browser to Stripe.
 *  - iOS → Apple In-App Purchase. NOTE: `expo-in-app-purchases` is deprecated
 *    on SDK 54 and not bundled, so iOS currently reports "unavailable" until
 *    react-native-iap + server receipt verification land (see docs).
 *
 * App Store guideline 3.1.1: iOS must use IAP for digital goods, so we NEVER
 * expose the Stripe path on iOS.
 */
import { Linking, Platform } from "react-native";
import i18n from "./i18n";
import { trpc } from "./trpc";
import { isWeb } from "./platform";

export const PRODUCT_IDS = {
  MONTHLY: "kindcipe_monthly_30",
  YEARLY: "kindcipe_yearly_288",
} as const;

/** Apple IAP only applies to native iOS builds. */
export const isIapSupported = Platform.OS === "ios";

/** Stripe applies to web (and Android, where permitted). Never iOS. */
export const isStripeSupported = Platform.OS === "web" || Platform.OS === "android";

/**
 * iOS in-app purchase is NOT wired yet (react-native-iap not bundled).
 * App Store guidelines require IAP for digital goods — so until R2 lands we must
 * NOT show any price/purchase UI on iOS (a dead "buy" button = 2.1 rejection).
 * Flip to true once react-native-iap + receipt verification ship.
 */
const IAP_LIVE = false;

/**
 * Whether this platform can actually complete a purchase right now.
 * iOS → false until IAP_LIVE. Web/Android → true (Stripe).
 * Use this (not isIapSupported/isStripeSupported) to decide whether to show price CTAs.
 */
export const canPurchaseHere =
  isStripeSupported || (Platform.OS === "ios" && IAP_LIVE);

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export const SUBSCRIPTION_TYPE: Record<ProductId, "monthly" | "yearly"> = {
  [PRODUCT_IDS.MONTHLY]: "monthly",
  [PRODUCT_IDS.YEARLY]: "yearly",
};

export type PurchaseResult =
  | { success: true; purchase: { productId: string; transactionReceipt?: string } }
  | { success: false; error: string; cancelled?: boolean };

export async function initIAP(): Promise<void> {
  // No-op in the Beta build (store SDK not bundled yet).
}

export async function getProducts(): Promise<{ productId: ProductId; price: string }[]> {
  return [];
}

/**
 * Start a purchase. On web/Android this opens Stripe Checkout (full-page
 * redirect on web, in-app browser on native-android). On iOS it attempts IAP.
 */
export async function purchaseSubscription(productId: ProductId): Promise<PurchaseResult> {
  const plan = SUBSCRIPTION_TYPE[productId];

  if (isStripeSupported) {
    try {
      const returnUrl =
        isWeb && typeof window !== "undefined" ? window.location.origin : undefined;
      const { url } = await trpc.billing.createCheckoutSession.mutate({
        plan,
        returnUrl,
      });
      if (!url) {
        return { success: false, error: i18n.t("error.purchaseFailed" as any) };
      }
      await Linking.openURL(url);
      // Stripe handles the payment; the webhook (or confirmCheckout on return)
      // activates Pro. Caller should refresh subscription state after redirect.
      return { success: true, purchase: { productId } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg || i18n.t("error.purchaseFailed" as any) };
    }
  }

  // iOS: Apple IAP (not yet wired in this build).
  return { success: false, error: i18n.t("error.iapUnavailable" as any) };
}

export async function manageSubscription(): Promise<void> {
  try {
    if (isStripeSupported) {
      // Prefer the Stripe Billing Portal when a customer exists; otherwise fall
      // back to the pricing page.
      try {
        const { url } = await trpc.billing.createPortalSession.mutate();
        if (url) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        /* no customer yet → fall through */
      }
      const fallback =
        process.env.EXPO_PUBLIC_ACCOUNT_URL ??
        process.env.EXPO_PUBLIC_PRICING_URL ??
        process.env.EXPO_PUBLIC_STORE_URL ??
        "https://kindcipe.com/pricing";
      await Linking.openURL(fallback);
    } else if (Platform.OS === "ios") {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } else {
      await Linking.openURL("https://play.google.com/store/account/subscriptions");
    }
  } catch {
    /* ignore */
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return { success: false, error: i18n.t("error.iapUnavailable" as any) };
}

/**
 * After a Stripe checkout redirect back to the app, confirm the session and
 * activate Pro without waiting for the webhook.
 */
export async function confirmStripeCheckout(sessionId: string): Promise<boolean> {
  try {
    const res = await trpc.billing.confirmCheckout.mutate({ sessionId });
    return res.status === "active";
  } catch {
    return false;
  }
}
