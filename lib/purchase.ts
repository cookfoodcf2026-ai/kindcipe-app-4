/**
 * Subscription purchase helper (universal build).
 *
 * Channel by platform:
 *  - Web → Stripe Checkout (see backend billing router).
 *  - iOS → Apple In-App Purchase via expo-iap + server-side JWS verification.
 *  - Android → Google Play Billing. Stripe is NOT permitted for digital
 *    subscriptions on Android, so we never expose the Stripe path there.
 *
 * App Store guideline 3.1.1 / Google Play payments policy: native stores
 * require their own billing for digital goods.
 */
import { Alert, Linking, Platform } from "react-native";
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  getTransactionJwsIOS,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restoreStorePurchases,
  type Product,
  type Purchase,
} from "expo-iap";
import i18n from "./i18n";
import { apiClient } from "./trpc";
import { getWebappUrl, isWeb } from "./platform";
import { track, Events } from "./analytics";

export const PRODUCT_IDS = {
  MONTHLY: "kindcipe_pro_monthly",
  YEARLY: "kindcipe_pro_yearly",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

const KNOWN_PRODUCT_IDS = new Set<string>(Object.values(PRODUCT_IDS));

/** Apple IAP only applies to native iOS builds. */
export const isIapSupported = Platform.OS === "ios";

/** Google Play Billing only applies to native Android builds. */
export const isPlayBillingSupported = Platform.OS === "android";

/** Stripe applies to web only. Never iOS (3.1.1) or Android (Play policy). */
export const isStripeSupported = isWeb;

/**
 * Apple IAP stays dark until the App Store Connect products exist. Read from
 * config so an environment can enable it without an app-code change:
 *   EXPO_PUBLIC_IAP_ENABLED=1
 */
function readFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export const IAP_LIVE = readFlag(process.env.EXPO_PUBLIC_IAP_ENABLED);

/**
 * Native store billing is NOT live by default. Store policies require native
 * billing for digital goods — so until both receipt-verification paths ship we
 * must NOT show a dead "buy" button.
 */
const PLAY_BILLING_LIVE = false; // Android / Google Play

/**
 * Whether this platform can actually complete a purchase right now.
 * Web → Stripe. iOS/Android → only when their store billing flag is on.
 * Use this (not the *Supported flags) to decide whether to show price CTAs.
 */
export const canPurchaseHere =
  isStripeSupported ||
  (Platform.OS === "ios" && IAP_LIVE) ||
  (Platform.OS === "android" && PLAY_BILLING_LIVE);

export const SUBSCRIPTION_TYPE: Record<ProductId, "monthly" | "yearly"> = {
  [PRODUCT_IDS.MONTHLY]: "monthly",
  [PRODUCT_IDS.YEARLY]: "yearly",
};

export type StoreProduct = {
  productId: ProductId;
  price: string;
};

export type PurchaseResult =
  | {
      success: true;
      purchase: {
        productId: string;
        transactionReceipt?: string;
        expiresAt?: string | null;
      };
    }
  | {
      success: false;
      error: string;
      cancelled?: boolean;
      pending?: boolean;
      alreadyOwned?: boolean;
    };

type VerifyIapResponse = {
  status?: "active" | "trial" | "expired" | string;
  plan?: "monthly" | "yearly" | string;
  expiresAt?: string | null;
};

/** Connect once per process. Safe to call on every launch; never throws. */
let connectionPromise: Promise<boolean> | null = null;

export function initIAP(): Promise<void> {
  if (!isIapSupported) return Promise.resolve();
  if (!connectionPromise) {
    connectionPromise = initConnection()
      .then(() => true)
      .catch(() => {
        // Allow a later retry (e.g. transient StoreKit failure at launch).
        connectionPromise = null;
        return false;
      });
  }
  return connectionPromise.then(() => undefined);
}

/**
 * Return StoreKit subscriptions mapped to our two product ids, with the
 * localized App Store price. Returns [] whenever StoreKit is unavailable —
 * no crash, no throw.
 */
export async function getProducts(): Promise<StoreProduct[]> {
  if (!isIapSupported) return [];
  try {
    await initIAP();
    const products = (await fetchProducts({
      skus: Object.values(PRODUCT_IDS),
      type: "subs",
    })) as Product[];
    if (!Array.isArray(products)) return [];
    const byId = new Map<string, StoreProduct>();
    for (const product of products) {
      if (!product || !KNOWN_PRODUCT_IDS.has(product.id)) continue;
      byId.set(product.id, {
        productId: product.id as ProductId,
        price: product.displayPrice,
      });
    }
    return Object.values(PRODUCT_IDS)
      .map((id) => byId.get(id))
      .filter((product): product is StoreProduct => product != null);
  } catch {
    return [];
  }
}

/** RFC 4122 v4 token. StoreKit binds the purchase to this value. */
export function createAppAccountToken(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

type IapAttempt =
  | { kind: "purchase"; purchase: Purchase }
  | { kind: "cancelled" }
  | { kind: "pending" }
  | { kind: "already-owned" }
  | { kind: "error"; error: string };

let purchaseInFlight = false;

function requestStorePurchase(productId: ProductId, appAccountToken: string): Promise<IapAttempt> {
  return new Promise((resolve) => {
    let settled = false;
    let updatedSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    const cleanup = () => {
      try {
        updatedSub?.remove();
      } catch {
        /* noop */
      }
      try {
        errorSub?.remove();
      } catch {
        /* noop */
      }
    };

    const settle = (attempt: IapAttempt) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(attempt);
    };

    updatedSub = purchaseUpdatedListener((purchase) => {
      if (!purchase || purchase.productId !== productId) return;
      if (purchase.purchaseState === "pending") {
        settle({ kind: "pending" });
        return;
      }
      settle({ kind: "purchase", purchase });
    });

    errorSub = purchaseErrorListener((error) => {
      if (error?.productId && error.productId !== productId) return;
      if (error?.code === ErrorCode.UserCancelled) {
        settle({ kind: "cancelled" });
        return;
      }
      if (error?.code === ErrorCode.AlreadyOwned) {
        settle({ kind: "already-owned" });
        return;
      }
      if (error?.code === ErrorCode.Pending || error?.code === ErrorCode.DeferredPayment) {
        settle({ kind: "pending" });
        return;
      }
      settle({ kind: "error", error: error?.message || i18n.t("error.purchaseFailed" as any) });
    });

    requestPurchase({
      request: {
        apple: {
          sku: productId,
          appAccountToken,
          andDangerouslyFinishTransactionAutomatically: false,
        },
      },
      type: "subs",
    }).catch((error: unknown) => {
      settle({
        kind: "error",
        error: error instanceof Error ? error.message : i18n.t("error.purchaseFailed" as any),
      });
    });
  });
}

async function receiptFor(purchase: Purchase): Promise<string | null> {
  // iOS unified purchase token is the StoreKit 2 signed transaction (JWS).
  if (purchase.purchaseToken) return purchase.purchaseToken;
  try {
    return (await getTransactionJwsIOS(purchase.productId)) ?? null;
  } catch {
    return null;
  }
}

function purchaseAppAccountToken(purchase: Purchase): string | null {
  return "appAccountToken" in purchase ? purchase.appAccountToken ?? null : null;
}

async function verifyWithServer(
  purchase: Purchase,
  appAccountToken?: string | null
): Promise<{ response: VerifyIapResponse; receipt: string }> {
  const receipt = await receiptFor(purchase);
  if (!receipt) {
    throw new Error(i18n.t("error.purchaseFailed" as any));
  }
  const transactionDate = new Date(purchase.transactionDate || Date.now()).toISOString();
  const response = (await apiClient.subscription.verifyIap.mutate({
    receipt,
    productId: purchase.productId,
    transactionDate,
    appAccountToken: appAccountToken ?? purchaseAppAccountToken(purchase),
  })) as VerifyIapResponse;
  return { response, receipt };
}

function isActive(response: VerifyIapResponse | undefined): boolean {
  const status = response?.status;
  return status === "active" || status === "trial";
}

async function finish(purchase: Purchase): Promise<void> {
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch {
    // Entitlement is already server-confirmed; a finish failure only replays
    // the transaction on the next launch, where restore can clear it.
  }
}

async function verifyPurchase(
  purchase: Purchase,
  appAccountToken?: string | null
): Promise<PurchaseResult> {
  const { response, receipt } = await verifyWithServer(purchase, appAccountToken);
  if (!isActive(response)) {
    return { success: false, error: i18n.t("error.purchaseFailed" as any) };
  }
  await finish(purchase);
  return {
    success: true,
    purchase: {
      productId: purchase.productId,
      transactionReceipt: receipt,
      expiresAt: response.expiresAt ?? null,
    },
  };
}

/**
 * Start a purchase. On web this opens Stripe Checkout. On iOS this runs the
 * StoreKit purchase, then activates Pro only after the backend confirms the
 * signed transaction.
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

  if (!isIapSupported) {
    return { success: false, error: i18n.t("error.iapUnavailable" as any) };
  }

  if (purchaseInFlight) {
    return { success: false, error: i18n.t("error.purchaseInProgress" as any) };
  }

  const appAccountToken = createAppAccountToken();
  purchaseInFlight = true;
  try {
    await initIAP();
    const attempt = await requestStorePurchase(productId, appAccountToken);

    if (attempt.kind === "cancelled") {
      return { success: false, error: "cancelled", cancelled: true };
    }
    if (attempt.kind === "pending") {
      return {
        success: false,
        error: i18n.t("error.purchaseInProgress" as any),
        pending: true,
      };
    }
    if (attempt.kind === "already-owned") {
      const recovered = await restorePurchases();
      if (recovered.success) return recovered;
      // StoreKit says it is owned but no matching active transaction exists.
      return {
        success: false,
        error: i18n.t("error.restoreFailed" as any),
        alreadyOwned: true,
      };
    }
    if (attempt.kind === "error") {
      return { success: false, error: attempt.error };
    }

    try {
      return await verifyPurchase(attempt.purchase, appAccountToken);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : i18n.t("error.purchaseFailed" as any),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : i18n.t("error.purchaseFailed" as any),
    };
  } finally {
    purchaseInFlight = false;
  }
}

export async function manageSubscription(
  provider?: "stripe" | "apple" | "google" | null
): Promise<void> {
  try {
    // App Store 3.1.1: iOS must never open the Stripe billing portal. Only
    // Apple-billed subscribers get the App Store management page; everyone
    // else gets a neutral message with no external link.
    if (Platform.OS === "android") {
      // Google Play policy: never open Stripe; keep all Android paths neutral.
      Alert.alert(
        i18n.t("paywall.manageNotAvailableTitle" as any),
        i18n.t("paywall.manageNotAvailableBodyAndroid" as any)
      );
      return;
    }
    if (Platform.OS === "ios") {
      if (provider === "apple") {
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
      } else {
        Alert.alert(
          i18n.t("paywall.manageNotAvailableTitle" as any),
          i18n.t("paywall.manageNotAvailableBody" as any)
        );
      }
      return;
    }

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
    if (provider === "apple") {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } else if (provider === "google") {
      await Linking.openURL("https://play.google.com/store/account/subscriptions");
    } else {
      await Linking.openURL(`${getWebappUrl()}/settings`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Restore purchases after a reinstall or on a second device: sync with the
 * store, then verify every owned subscription against the backend. Success is
 * reported only when the server confirms an active entitlement.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isIapSupported) {
    return { success: false, error: i18n.t("error.iapUnavailable" as any) };
  }

  try {
    await initIAP();
    try {
      await restoreStorePurchases();
    } catch {
      // Sync is best-effort; getAvailablePurchases still reports entitlements.
    }

    const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    const owned = (Array.isArray(purchases) ? purchases : []).filter((purchase) =>
      KNOWN_PRODUCT_IDS.has(purchase.productId)
    );
    if (owned.length === 0) {
      return { success: false, error: i18n.t("error.restoreFailed" as any) };
    }

    let lastError = i18n.t("error.restoreFailed" as any);
    for (const purchase of owned) {
      try {
        const result = await verifyPurchase(purchase, purchaseAppAccountToken(purchase));
        if (result.success) return result;
        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }
    return { success: false, error: lastError };
  } catch {
    return { success: false, error: i18n.t("error.restoreFailed" as any) };
  }
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
