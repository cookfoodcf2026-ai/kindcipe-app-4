/**
 * IAP (In-App Purchase) Helper
 * 處理 App Store / Google Play 訂閱購買 + Receipt 驗證
 */
import * as IAP from "expo-in-app-purchases";
import { Linking, Platform } from "react-native";
import { apiClient } from "./trpc";

// Product IDs (需要喺 App Store Connect / Google Play Console 開)
export const PRODUCT_IDS = {
  MONTHLY: "kindcipe_monthly_30", // HK$30 / 月
  YEARLY: "kindcipe_yearly_288", // HK$288 / 年
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

// 訂閱類型映射
export const SUBSCRIPTION_TYPE: Record<ProductId, "monthly" | "yearly"> = {
  [PRODUCT_IDS.MONTHLY]: "monthly",
  [PRODUCT_IDS.YEARLY]: "yearly",
};

type PurchaseResult =
  | { success: true; purchase: IAP.InAppPurchase }
  | { success: false; error: string };

type PendingPurchase = {
  productId: ProductId;
  resolve: (result: PurchaseResult) => void;
};

let isConnected = false;
let connectPromise: Promise<void> | null = null;
let listenerInstalled = false;
let pendingPurchase: PendingPurchase | null = null;

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "購買失敗，請重試";
}

async function verifyReceipt(purchase: IAP.InAppPurchase) {
  const receipt = purchase.transactionReceipt ?? purchase.purchaseToken ?? "";
  if (!receipt) {
    throw new Error("找不到購買憑證");
  }

  const result = await apiClient.subscription.verifyIap.mutate({
    receipt,
    productId: purchase.productId,
    transactionDate: new Date(purchase.purchaseTime).toISOString(),
    purchaseToken: purchase.purchaseToken ?? null,
  });

  if (!purchase.acknowledged) {
    await IAP.finishTransactionAsync(purchase, false);
  }

  return result;
}

async function processPurchaseResponse(response: IAP.IAPQueryResponse<IAP.InAppPurchase>) {
  const purchases = response.results ?? [];

  if (response.responseCode === IAP.IAPResponseCode.USER_CANCELED) {
    pendingPurchase?.resolve({ success: false, error: "cancelled" });
    pendingPurchase = null;
    return;
  }

  if (response.responseCode === IAP.IAPResponseCode.DEFERRED) {
    pendingPurchase?.resolve({ success: false, error: "deferred" });
    pendingPurchase = null;
    return;
  }

  if (response.responseCode === IAP.IAPResponseCode.ERROR) {
    pendingPurchase?.resolve({ success: false, error: "購買失敗，請重試" });
    pendingPurchase = null;
    return;
  }

  if (response.responseCode !== IAP.IAPResponseCode.OK) return;

  const currentPending = pendingPurchase;
  let matchedPurchase: IAP.InAppPurchase | null = null;

  for (const purchase of purchases) {
    if (purchase.purchaseState !== IAP.InAppPurchaseState.PURCHASED && purchase.purchaseState !== IAP.InAppPurchaseState.RESTORED) {
      continue;
    }

    if (currentPending && purchase.productId === currentPending.productId && !matchedPurchase) {
      matchedPurchase = purchase;
    }

    try {
      await verifyReceipt(purchase);
    } catch (error) {
      console.error("[IAP] verifyReceipt failed:", error);
      if (currentPending && purchase.productId === currentPending.productId) {
        pendingPurchase?.resolve({ success: false, error: formatError(error) });
        pendingPurchase = null;
        return;
      }
    }
  }

  if (currentPending && matchedPurchase) {
    currentPending.resolve({ success: true, purchase: matchedPurchase });
    pendingPurchase = null;
  }
}

function installPurchaseListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  IAP.setPurchaseListener((response) => {
    void processPurchaseResponse(response);
  });
}

function isAlreadyConnectedError(error: unknown) {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // iOS reload/Fast Refresh 時 native 仲連緊，connectAsync 會報「Already connected」
  return msg.includes("already connected") || msg.includes("already connected to app store");
}

async function ensureConnected() {
  if (isConnected) return;
  if (!connectPromise) {
    connectPromise = (async () => {
      if (!listenerInstalled) installPurchaseListener();
      try {
        await IAP.connectAsync();
      } catch (error) {
        // reload 後 native 已連線 — 當作已連線成功，唔好當成 fatal error
        if (!isAlreadyConnectedError(error)) throw error;
      }
      isConnected = true;
    })().finally(() => {
      connectPromise = null;
    });
  }
  await connectPromise;
}

/**
 * 初始化 IAP（App 啟動時調用）
 */
export async function initIAP() {
  try {
    await ensureConnected();
  } catch (error) {
    console.error("[IAP] Init failed:", error);
  }
}

/**
 * 獲取可購買的產品列表
 */
export async function getProducts() {
  try {
    await ensureConnected();
    const { responseCode, results } = await IAP.getProductsAsync(Object.values(PRODUCT_IDS));
    return responseCode === IAP.IAPResponseCode.OK ? results ?? [] : [];
  } catch (error) {
    console.error("[IAP] getProducts failed:", error);
    return [];
  }
}

/**
 * 購買訂閱
 */
export async function purchaseSubscription(productId: ProductId): Promise<PurchaseResult> {
  try {
    await ensureConnected();

    if (pendingPurchase) {
      return { success: false, error: "已有進行中的購買，請稍後再試" };
    }

    return await new Promise<PurchaseResult>(async (resolve) => {
      pendingPurchase = { productId, resolve };

      try {
        await IAP.purchaseItemAsync(productId);
      } catch (error) {
        if (pendingPurchase?.productId === productId) {
          pendingPurchase = null;
        }
        resolve({ success: false, error: formatError(error) });
      }
    });
  } catch (error) {
    console.error("[IAP] Purchase failed:", error);
    return { success: false, error: formatError(error) };
  }
}

/**
 * 管理訂閱（跳去 App Store / Play Store 訂閱頁面）
 */
export async function manageSubscription() {
  const url = Platform.select({
    ios: "itms-apps://apps.apple.com/account/subscriptions",
    android: "https://play.google.com/store/account/subscriptions",
    default: "https://play.google.com/store/account/subscriptions",
  });

  if (!url) return;
  await Linking.openURL(url);
}

/**
 * 恢復購買（例如轉機後）
 */
export async function restorePurchases() {
  try {
    await ensureConnected();
    const response = await IAP.getPurchaseHistoryAsync({ useGooglePlayCache: false });
    if (response.responseCode !== IAP.IAPResponseCode.OK) {
      return { success: false, error: "恢復購買失敗，請重試" };
    }

    for (const purchase of response.results ?? []) {
      if (purchase.purchaseState !== IAP.InAppPurchaseState.PURCHASED && purchase.purchaseState !== IAP.InAppPurchaseState.RESTORED) {
        continue;
      }

      try {
        await verifyReceipt(purchase);
      } catch (error) {
        console.error("[IAP] restorePurchases verify failed:", error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[IAP] restorePurchases failed:", error);
    return { success: false, error: formatError(error) };
  }
}
