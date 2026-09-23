/**
 * IAP (In-App Purchase) helper — Beta build.
 *
 * `expo-in-app-purchases` is deprecated and not supported by Expo SDK 54
 * (it targets compileSdk 33 and breaks the Android Gradle build). The real
 * store integration will be added with `react-native-iap` together with
 * server-side receipt verification before the public release.
 *
 * This module keeps the same public API so the UI works unchanged; purchases
 * simply report that they are not available in this build yet.
 */
import { Linking, Platform } from "react-native";
import i18n from "./i18n";

export const PRODUCT_IDS = {
  MONTHLY: "kindcipe_monthly_30",
  YEARLY: "kindcipe_yearly_288",
} as const;

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

export async function getProducts(): Promise<Array<{ productId: ProductId; price: string }>> {
  return [];
}

export async function purchaseSubscription(_productId: ProductId): Promise<PurchaseResult> {
  return { success: false, error: i18n.t("error.iapUnavailable" as any) };
}

export async function manageSubscription(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
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
