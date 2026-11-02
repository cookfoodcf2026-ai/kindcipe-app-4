/**
 * Subscription purchase helper (universal build).
 *
 * Channel by platform:
 *  - Web → Stripe Checkout (see backend billing router).
 *  - iOS → Apple In-App Purchase. NOTE: `expo-in-app-purchases` is deprecated
 *    on SDK 54 and not bundled, so iOS currently reports "unavailable" until
 *    react-native-iap + server receipt verification land (see docs).
 *  - Android → Google Play Billing. Stripe is NOT permitted for digital
 *    subscriptions on Android, so we never expose the Stripe path there.
 *
 * App Store guideline 3.1.1 / Google Play payments policy: native stores
 * require their own billing for digital goods.
 */
import { Linking, Platform } from "react-native";
import i18n from "./i18n";
import { apiClient } from "./trpc";
import { getWebappUrl, isWeb } from "./platform";
import { track, Events } from "./analytics";

export const PRODUCT_IDS = {
  MONTHLY: "kindcipe_monthly_30",
  YEARLY: "kindcipe_yearly_288",
} as const;

/** Apple IAP only applies to native iOS builds. */
export const isIapSupported = Platform.OS === "ios";

/** Google Play Billing only applies to native Android builds. */
export const isPlayBillingSupported = Platform.OS === "android";

/** Stripe applies to web only. Never iOS (3.1.1) or Android (Play policy). */
export const isStripeSupported = isWeb;

/**
 * Native store billing is NOT wired yet (react-native-iap not bundled).
 * Store policies require native billing for digital goods — so until both
 * receipt-verification paths ship we must NOT show a dead "buy" button.
 * Flip the matching flag once react-native-iap + verification land.
 */
const IAP_LIVE = false; // iOS / App Store
const PLAY_BILLING_LIVE = false; // Android / Google Play

/**
 * Whether this platform can actually complete a purchase right now.
 * Web → Stripe. iOS/Android → false until their store billing is live.
 * Use this (not the *Supported flags) to decide whether to show price CTAs.
 */
export const canPurchaseHere =
  isStripeSupported ||
  (Platform.OS === "ios" && IAP_LIVE) ||
  (Platform.OS === "android" && PLAY_BILLING_LIVE);

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
 * Start a purchase. On web this opens Stripe Checkout. On native this is a
 * no-op until Apple IAP / Google Play Billing are wired.
 */
export async function purchaseSubscription(productId: ProductId): Promise<PurchaseResult> {
  const plan = SUBSCRIPTION_TYPE[productId];

  if (isStripeSupported) {
    let step = "init";
    try {
      step = "track";
      try {
        track(Events.PurchaseStarted, { productId, plan, platform: Platform.OS });
      } catch {
        /* analytics 唔可以阻住付款 */
      }
      step = "returnUrl";
      const returnUrl =
        isWeb && typeof window !== "undefined" ? window.location.origin : undefined;
      step = "mutate";
      const { url } = await apiClient.billing.createCheckoutSession.mutate({
        plan,
        returnUrl,
      });
      if (!url) {
        return { success: false, error: i18n.t("error.purchaseFailed" as any) };
      }
      step = "redirect";
      // Web：直接跳轉（expo Linking 喺 web 有時冇 openURL → "e[] is not a function"）
      if (isWeb && typeof window !== "undefined") {
        window.location.assign(url);
      } else {
        await Linking.openURL(url);
      }
      // Stripe handles the payment; the webhook (or confirmCheckout on return)
      // activates Pro. Caller should refresh subscription state after redirect.
      return { success: true, purchase: { productId } };
    } catch (e) {
      const msg = `[${step}] ${e instanceof Error ? e.message : String(e)}`;
      return { success: false, error: msg || i18n.t("error.purchaseFailed" as any) };
    }
  }

  // iOS (Apple IAP) / Android (Play Billing): not wired in this build.
  return { success: false, error: i18n.t("error.iapUnavailable" as any) };
}

export async function manageSubscription(
  provider?: "stripe" | "apple" | "google" | null
): Promise<void> {
  try {
    if (provider === "stripe" || (!provider && isStripeSupported)) {
      try {
        const { url } = await apiClient.billing.createPortalSession.mutate();
        if (url) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        /* fall back to the web account page */
      }
      await Linking.openURL(`${getWebappUrl()}/settings`);
      return;
    }
    if (provider === "apple" || Platform.OS === "ios") {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } else if (provider === "google" || Platform.OS === "android") {
      await Linking.openURL("https://play.google.com/store/account/subscriptions");
    } else {
      await Linking.openURL(`${getWebappUrl()}/settings`);
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
export type StripeConfirmStatus = "active" | "trial" | "pending" | "error";

export async function confirmStripeCheckout(sessionId: string): Promise<StripeConfirmStatus> {
  try {
    const res = await apiClient.billing.confirmCheckout.mutate({ sessionId });
    if (res.status === "active" || res.status === "trial") {
      track(Events.PurchaseCompleted, { via: "stripe", sessionId, status: res.status });
      return res.status;
    }
    return "pending";
  } catch {
    return "error";
  }
}
