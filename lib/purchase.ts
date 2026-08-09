/**
 * IAP (In-App Purchase) Helper
 * 處理 App Store / Google Play 訂閱購買 + Receipt 驗證
 */
import * as IAP from 'expo-in-app-purchases';
import { trpc } from './trpc';

// Product IDs (需要喺 App Store Connect / Google Play Console 開)
export const PRODUCT_IDS = {
  MONTHLY: 'kindcipe_monthly_30',      // HK$30 / 月
  YEARLY: 'kindcipe_yearly_288',       // HK$288 / 年
} as const;

export type ProductId = keyof typeof PRODUCT_IDS;

// 訂閱類型映射
export const SUBSCRIPTION_TYPE: Record<ProductId, 'monthly' | 'yearly'> = {
  kindcipe_monthly_30: 'monthly',
  kindcipe_yearly_288: 'yearly',
};

/**
 * 初始化 IAP（App 啟動時調用）
 */
export async function initIAP() {
  try {
    await IAP.setPurchaseListener(async ({ purchase }) => {
      console.log('[IAP] Purchase event:', purchase);
      
      // 驗證 Receipt
      await verifyReceipt(purchase);
    });

    // 查詢未完成的購買（例如 App 崩潰後重啟）
    const purchases = await IAP.getAvailablePurchasesAsync();
    if (purchases?.length) {
      console.log('[IAP] Found pending purchases:', purchases.length);
      for (const purchase of purchases) {
        await verifyReceipt(purchase);
      }
    }
  } catch (error) {
    console.error('[IAP] Init failed:', error);
  }
}

/**
 * 獲取可購買的產品列表
 */
export async function getProducts() {
  try {
    const products = await IAP.getProductsAsync(Object.values(PRODUCT_IDS));
    return products;
  } catch (error) {
    console.error('[IAP] getProducts failed:', error);
    return [];
  }
}

/**
 * 購買訂閱
 */
export async function purchaseSubscription(productId: ProductId) {
  try {
    console.log('[IAP] Purchasing:', productId);
    const purchase = await IAP.requestPurchaseAsync(productId);
    console.log('[IAP] Purchase successful:', purchase);
    await verifyReceipt(purchase);
    return { success: true, purchase };
  } catch (error: any) {
    if (error.code === 'E_USER_CANCELLED') {
      console.log('[IAP] User cancelled');
      return { success: false, error: 'cancelled' };
    }
    console.error('[IAP] Purchase failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 驗證 Receipt（傳去後端檢查）
 */
async function verifyReceipt(purchase: IAP.Purchase) {
  try {
    const receipt = purchase.transactionReceipt;
    if (!receipt) {
      console.error('[IAP] No receipt found');
      return;
    }

    // 傳去後端驗證
    const result = await trpc.subscription.verifyIap.mutate({
      receipt,
      productId: purchase.productId,
      transactionDate: purchase.transactionDate?.toISOString(),
    });

    console.log('[IAP] Receipt verified:', result);
    
    // 完成購買流程（只限 iOS）
    if (purchase.acknowledged !== true) {
      await IAP.finishTransactionAsync({ purchase, isConsumed: false });
    }
  } catch (error) {
    console.error('[IAP] verifyReceipt failed:', error);
    throw error;
  }
}

/**
 * 管理訂閱（跳去 App Store / Play Store 訂閱頁面）
 */
export async function manageSubscription() {
  try {
    await IAP.showManageSubscriptionsAsync();
  } catch (error) {
    console.error('[IAP] manageSubscription failed:', error);
    throw error;
  }
}

/**
 * 恢復購買（例如轉機後）
 */
export async function restorePurchases() {
  try {
    await IAP.restorePurchasesAsync();
    console.log('[IAP] Restore completed');
    return { success: true };
  } catch (error) {
    console.error('[IAP] restorePurchases failed:', error);
    return { success: false, error: error };
  }
}
