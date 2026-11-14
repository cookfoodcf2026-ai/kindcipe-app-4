import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as purchase from "../../lib/purchase";
import PaywallModal from "../PaywallModal";

const mockPlatform = { isIOS: true, isWeb: false };
const mockPurchaseFlags = { isStripeSupported: false, canPurchaseHere: true };
const mockTranslations: Record<string, string> = {
  "paywall.faq3q": "Is payment secure?",
  "paywall.faq3a": "Yes — payments are processed securely by Stripe.",
  "paywall.faq3aNative": "Yes — payments are processed securely by the App Store or Google Play.",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => mockTranslations[key] ?? key }),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { instagramUrl: "" } } },
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
  Events: { PaywallViewed: "PaywallViewed", PromoRedeemed: "PromoRedeemed" },
}));

jest.mock("@/lib/errors", () => ({
  friendlyError: (error: { message?: string }) => error?.message ?? "error",
}));

jest.mock("@/lib/legal", () => ({
  PRIVACY_URL: "https://kindcipe.com/privacy/",
  TERMS_URL: "https://kindcipe.com/terms/",
  openLegalPage: jest.fn(),
}));

jest.mock("@/lib/platform", () => ({
  getWebappUrl: () => "https://app.kindcipe.com",
  get isIOS() {
    return mockPlatform.isIOS;
  },
  get isWeb() {
    return mockPlatform.isWeb;
  },
}));

jest.mock("../../lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      family: {
        subscription: { invalidate: jest.fn() },
        usage: { invalidate: jest.fn() },
        me: { invalidate: jest.fn() },
      },
      billing: { previewCheckout: { invalidate: jest.fn() } },
      auth: { me: { invalidate: jest.fn() } },
    }),
    family: {
      subscription: { useQuery: () => ({ data: undefined, isError: false }) },
    },
    billing: {
      previewCheckout: {
        useQuery: () => ({ data: undefined, isError: false, error: null }),
      },
    },
    subscription: {
      redeemTrialCode: { useMutation: () => ({ mutate: jest.fn() }) },
    },
  },
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ familyRole: "owner", switchFamily: jest.fn() }),
}));

jest.mock("../../hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({ isDesktop: false }),
}));

jest.mock("../../lib/purchase", () => ({
  PRODUCT_IDS: {
    MONTHLY: "kindcipe_pro_monthly",
    YEARLY: "kindcipe_pro_yearly",
  },
  getProducts: jest.fn(),
  purchaseSubscription: jest.fn(),
  restorePurchases: jest.fn(),
  manageSubscription: jest.fn(),
  get isStripeSupported() {
    return mockPurchaseFlags.isStripeSupported;
  },
  get canPurchaseHere() {
    return mockPurchaseFlags.canPurchaseHere;
  },
}));

const mockGetProducts = purchase.getProducts as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.isIOS = true;
  mockPlatform.isWeb = false;
  mockPurchaseFlags.isStripeSupported = false;
  mockPurchaseFlags.canPurchaseHere = true;
});

describe("PaywallModal FAQ platform wording", () => {
  it("does not show Stripe wording in the native FAQ", async () => {
    mockGetProducts.mockResolvedValue([]);

    const { getByText, queryByText } = await render(
      <PaywallModal visible onClose={jest.fn()} />
    );

    fireEvent.press(getByText("Is payment secure?"));

    await waitFor(() =>
      expect(queryByText(mockTranslations["paywall.faq3aNative"])).not.toBeNull()
    );
    expect(queryByText(/Stripe/)).toBeNull();
  });

  it("keeps the Stripe FAQ on web", async () => {
    mockPlatform.isIOS = false;
    mockPlatform.isWeb = true;
    mockPurchaseFlags.isStripeSupported = true;
    mockGetProducts.mockResolvedValue([]);

    const { getAllByText, getByText, queryByText } = await render(
      <PaywallModal visible onClose={jest.fn()} />
    );

    fireEvent.press(getByText("Is payment secure?"));

    await waitFor(() => expect(queryByText(mockTranslations["paywall.faq3a"])).not.toBeNull());
    expect(getAllByText(/Stripe/).length).toBeGreaterThan(0);
    expect(queryByText(mockTranslations["paywall.faq3aNative"])).toBeNull();
  });
});

describe("PaywallModal StoreKit gating", () => {
  it("does not render any web purchase CTA on iOS when getProducts returns empty", async () => {
    mockGetProducts.mockResolvedValue([]);

    const { queryByText } = await render(<PaywallModal visible onClose={jest.fn()} />);

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());

    expect(queryByText("paywall.subscribeWithPrice")).toBeNull();
    expect(queryByText("paywall.startTrialCta")).toBeNull();
    expect(queryByText("paywall.webOnlyCta")).toBeNull();
    expect(queryByText("paywall.unavailableNative")).not.toBeNull();
  });

  it("renders the StoreKit display price instead of the lib/pricing.ts fallback", async () => {
    mockGetProducts.mockResolvedValue([
      { productId: "kindcipe_pro_monthly", price: "HK$48.00" },
      { productId: "kindcipe_pro_yearly", price: "HK$428.00" },
    ]);

    const { queryByText, getAllByText } = await render(
      <PaywallModal visible onClose={jest.fn()} />
    );

    await waitFor(() => expect(queryByText("HK$48.00")).not.toBeNull());

    expect(getAllByText("HK$428.00").length).toBeGreaterThan(0);
    expect(queryByText("HK$38")).toBeNull();
    expect(queryByText("HK$388")).toBeNull();
    expect(queryByText("paywall.webOnlyCta")).toBeNull();
    expect(queryByText("paywall.appleChargeNote")).not.toBeNull();
  });
});
