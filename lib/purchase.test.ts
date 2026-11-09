import * as Iap from "expo-iap";
import { apiClient } from "./trpc";
import {
  PRODUCT_IDS,
  getProducts,
  purchaseSubscription,
  restorePurchases,
  type PurchaseResult,
} from "./purchase";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Linking: { openURL: jest.fn() },
}));

jest.mock("./platform", () => ({
  isWeb: false,
  getWebappUrl: () => "https://app.kindcipe.com",
}));

jest.mock("./analytics", () => ({
  track: jest.fn(),
  Events: { PurchaseStarted: "PurchaseStarted", PurchaseCompleted: "PurchaseCompleted" },
}));

jest.mock("./i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock("./trpc", () => ({
  apiClient: {
    subscription: {
      verifyIap: { mutate: jest.fn() },
    },
  },
}));

jest.mock("expo-iap", () => {
  const listeners: {
    updated: ((purchase: unknown) => void)[];
    error: ((error: unknown) => void)[];
  } = { updated: [], error: [] };
  return {
    __esModule: true,
    __listeners: listeners,
    ErrorCode: {
      UserCancelled: "user-cancelled",
      AlreadyOwned: "already-owned",
      Pending: "pending",
      DeferredPayment: "deferred-payment",
    },
    initConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(),
    requestPurchase: jest.fn(),
    purchaseUpdatedListener: jest.fn((listener: (purchase: unknown) => void) => {
      listeners.updated.push(listener);
      return { remove: jest.fn() };
    }),
    purchaseErrorListener: jest.fn((listener: (error: unknown) => void) => {
      listeners.error.push(listener);
      return { remove: jest.fn() };
    }),
    getAvailablePurchases: jest.fn(),
    restorePurchases: jest.fn(async () => undefined),
    finishTransaction: jest.fn(async () => undefined),
    getTransactionJwsIOS: jest.fn(async () => null),
  };
});

const iap = Iap as unknown as Record<string, jest.Mock>;
const listeners = (Iap as unknown as {
  __listeners: {
    updated: ((purchase: unknown) => void)[];
    error: ((error: unknown) => void)[];
  };
}).__listeners;
const verifyMutate = apiClient.subscription.verifyIap.mutate as jest.Mock;

const APP_ACCOUNT_TOKEN = "00000000-0000-4000-8000-000000000000";

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_IDS.MONTHLY,
    purchaseToken: "signed-jws",
    purchaseState: "purchased",
    transactionDate: Date.UTC(2026, 10, 9, 12, 0, 0),
    appAccountToken: APP_ACCOUNT_TOKEN,
    ...overrides,
  };
}

function firePurchase(purchase: ReturnType<typeof makePurchase>) {
  const listener = listeners.updated[listeners.updated.length - 1];
  expect(listener).toBeDefined();
  listener(purchase);
}

function fireError(error: Record<string, unknown>) {
  const listener = listeners.error[listeners.error.length - 1];
  expect(listener).toBeDefined();
  listener(error);
}

beforeEach(() => {
  listeners.updated.length = 0;
  listeners.error.length = 0;
  jest.clearAllMocks();
});

describe("purchaseSubscription", () => {
  it("activates Pro only after the server verifies the signed transaction", async () => {
    verifyMutate.mockResolvedValue({
      status: "active",
      plan: "monthly",
      expiresAt: "2026-12-09T12:00:00.000Z",
    });
    iap.requestPurchase.mockImplementation(async (args: any) => {
      const token = args.request.apple.appAccountToken;
      firePurchase(makePurchase({ appAccountToken: token }));
      return null;
    });

    const result: PurchaseResult = await purchaseSubscription(PRODUCT_IDS.MONTHLY);

    expect(result.success).toBe(true);
    expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
    const request = iap.requestPurchase.mock.calls[0][0];
    expect(request.type).toBe("subs");
    expect(request.request.apple.sku).toBe(PRODUCT_IDS.MONTHLY);
    expect(request.request.apple.appAccountToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    expect(verifyMutate).toHaveBeenCalledTimes(1);
    const verifyInput = verifyMutate.mock.calls[0][0];
    expect(verifyInput).toEqual({
      receipt: "signed-jws",
      productId: PRODUCT_IDS.MONTHLY,
      transactionDate: new Date(Date.UTC(2026, 10, 9, 12, 0, 0)).toISOString(),
      appAccountToken: request.request.apple.appAccountToken,
    });
    expect(iap.finishTransaction).toHaveBeenCalledWith({
      purchase: expect.objectContaining({ purchaseToken: "signed-jws" }),
      isConsumable: false,
    });
  });

  it("surfaces a server rejection and does not finish the transaction", async () => {
    verifyMutate.mockRejectedValue(new Error("購買憑證驗證失敗"));
    iap.requestPurchase.mockImplementation(async () => {
      firePurchase(makePurchase());
      return null;
    });

    const result = await purchaseSubscription(PRODUCT_IDS.MONTHLY);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("購買憑證驗證失敗");
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it("reports a user cancellation without calling the server", async () => {
    iap.requestPurchase.mockImplementation(async () => {
      fireError({ code: "user-cancelled", message: "cancelled" });
      return null;
    });

    const result = await purchaseSubscription(PRODUCT_IDS.MONTHLY);

    expect(result).toMatchObject({ success: false, cancelled: true, error: "cancelled" });
    expect(verifyMutate).not.toHaveBeenCalled();
  });

  it("treats pending/deferred purchases as pending, not success", async () => {
    iap.requestPurchase.mockImplementation(async () => {
      fireError({ code: "deferred-payment", message: "awaiting approval" });
      return null;
    });

    const result = await purchaseSubscription(PRODUCT_IDS.MONTHLY);

    expect(result).toMatchObject({ success: false, pending: true });
    expect(result.success).toBe(false);
    expect(verifyMutate).not.toHaveBeenCalled();
  });
});

describe("restorePurchases", () => {
  it("restores one valid purchase by verifying it with the backend", async () => {
    iap.getAvailablePurchases.mockResolvedValue([
      makePurchase({ productId: PRODUCT_IDS.YEARLY }),
    ]);
    verifyMutate.mockResolvedValue({
      status: "active",
      plan: "yearly",
      expiresAt: "2027-11-09T12:00:00.000Z",
    });

    const result = await restorePurchases();

    expect(result.success).toBe(true);
    expect(iap.restorePurchases).toHaveBeenCalledTimes(1);
    expect(verifyMutate).toHaveBeenCalledTimes(1);
    expect(verifyMutate.mock.calls[0][0]).toMatchObject({
      productId: PRODUCT_IDS.YEARLY,
      receipt: "signed-jws",
      appAccountToken: APP_ACCOUNT_TOKEN,
    });
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns a restore error when the store has no purchases", async () => {
    iap.getAvailablePurchases.mockResolvedValue([]);

    const result = await restorePurchases();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("error.restoreFailed");
    expect(verifyMutate).not.toHaveBeenCalled();
  });

  it("does not report success when the server returns an expired entitlement", async () => {
    iap.getAvailablePurchases.mockResolvedValue([makePurchase()]);
    verifyMutate.mockResolvedValue({
      status: "expired",
      plan: "monthly",
      expiresAt: null,
    });

    const result = await restorePurchases();

    expect(result.success).toBe(false);
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });
});

describe("getProducts", () => {
  it("returns an empty array when StoreKit is unavailable", async () => {
    iap.fetchProducts.mockRejectedValue(new Error("store unavailable"));

    await expect(getProducts()).resolves.toEqual([]);
  });

  it("maps StoreKit subscriptions with the localized price", async () => {
    iap.fetchProducts.mockResolvedValue([
      { id: PRODUCT_IDS.MONTHLY, displayPrice: "HK$38.00" },
      { id: PRODUCT_IDS.YEARLY, displayPrice: "HK$388.00" },
      { id: "someone_elses_product", displayPrice: "HK$1.00" },
    ]);

    await expect(getProducts()).resolves.toEqual([
      { productId: PRODUCT_IDS.MONTHLY, price: "HK$38.00" },
      { productId: PRODUCT_IDS.YEARLY, price: "HK$388.00" },
    ]);
  });
});
