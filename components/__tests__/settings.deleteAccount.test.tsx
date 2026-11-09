import { Alert } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";

const mockDeleteState: { onError?: (error: unknown) => void; mutate: jest.Mock; isPending: boolean } = {
  mutate: jest.fn(),
  isPending: false,
};

const mockTranslations: Record<string, string> = {
  "刪除失敗": "Failed to delete",
  "settings.deleteAccountConflict":
    'Your account was not deleted because the subscription could not be cancelled. Tap "Delete account" again to retry.',
  "settings.deleteAccount": "Delete account",
  "settings.title": "Settings",
};

const mockT = (key: string) => mockTranslations[key] ?? key;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock("@/lib/i18n", () => ({
  __esModule: true,
  default: {
    language: "en",
    t: mockT,
    changeLanguage: jest.fn(),
  },
}));

const mockNoopMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isPending: false,
});

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      invalidate: jest.fn(),
      auth: { me: { invalidate: jest.fn() }, identities: { invalidate: jest.fn() } },
      family: { subscription: { invalidate: jest.fn() }, usage: { invalidate: jest.fn() } },
      billing: { previewCheckout: { invalidate: jest.fn() } },
    }),
    auth: {
      deleteAccount: {
        useMutation: (options: { onError: (error: unknown) => void }) => {
          mockDeleteState.onError = options.onError;
          return mockDeleteState;
        },
      },
      updateProfile: { useMutation: () => mockNoopMutation() },
      identities: { useQuery: () => ({ data: [] }) },
      linkGoogle: { useMutation: () => mockNoopMutation() },
      linkEmailStart: { useMutation: () => mockNoopMutation() },
      linkEmailVerify: { useMutation: () => mockNoopMutation() },
      mergeAccount: { useMutation: () => mockNoopMutation() },
    },
    family: {
      subscription: { useQuery: () => ({ data: undefined }) },
      usage: { useQuery: () => ({ data: undefined }) },
      usageHistoryByMember: { useQuery: () => ({ data: [] }) },
    },
    subscription: { redeemTrialCode: { useMutation: () => mockNoopMutation() } },
  },
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Test", email: "test@example.com", role: "user" },
    isAuthenticated: true,
    logout: jest.fn(),
    familyRole: "owner",
    activeFamily: { name: "Home" },
    activeFamilyId: 1,
    families: [{ name: "Home" }],
  }),
}));

jest.mock("@/lib/support", () => ({
  openSupport: jest.fn(),
  SUPPORT_URL: "https://kindcipe.com/support/",
}));

jest.mock("@/lib/legal", () => ({
  PRIVACY_URL: "https://kindcipe.com/privacy/",
  TERMS_URL: "https://kindcipe.com/terms/",
  openLegalPage: jest.fn(),
}));

jest.mock("@/lib/purchase", () => ({
  confirmStripeCheckout: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  isBiometricAvailable: jest.fn().mockResolvedValue(false),
  isBiometricEnabled: jest.fn().mockResolvedValue(false),
  setBiometricEnabled: jest.fn(),
  clearAuthToken: jest.fn(),
  FAMILY_ID_KEY: "kindcipe_family_id",
}));

jest.mock("@/lib/notifications", () => ({
  getMealReminderSetting: jest.fn().mockResolvedValue({
    enabled: false,
    hour: 17,
    minute: 0,
    weekdays: [],
  }),
  saveMealReminderSetting: jest.fn(),
  applyMealReminder: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/components/PaywallModal", () => () => null);
jest.mock("@/src/components/icons", () => ({ ChatBubbleIcon: () => null }));
jest.mock("@/src/components/HintBanner", () => ({
  getHintsDisabled: jest.fn().mockResolvedValue(false),
  setHintsDisabled: jest.fn(),
}));
jest.mock("@/lib/logo", () => ({ getAppLogo: jest.fn() }));
jest.mock("@/lib/featureFlags", () => ({ aiChefQuickPlanEnabled: false }));
jest.mock("@/app/styles/typography", () => ({
  typography: {
    h1: {},
    h3: {},
    caption: {},
    sectionLabel: {},
    label: {},
    body: {},
    button: {},
  },
}));
jest.mock("@/lib/platform", () => ({ isWeb: false }));
jest.mock("@/lib/socialAuth", () => ({ signInWithGoogleWeb: jest.fn() }));
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
  Events: { Logout: "Logout", LanguageChanged: "LanguageChanged" },
  loadAnalyticsOptOut: jest.fn().mockResolvedValue(false),
  setAnalyticsOptOut: jest.fn(),
}));
jest.mock("@/lib/i18nEnums", () => ({
  enumT: { weekday: (day: number) => String(day) },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import SettingsScreen from "../../app/settings";

describe("Settings — account deletion error", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteState.onError = undefined;
  });

  it("shows a localized retry message for a CONFLICT instead of the raw server string", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

    await render(<SettingsScreen />);

    await waitFor(() => expect(mockDeleteState.onError).toBeDefined());

    await act(async () => {
      mockDeleteState.onError?.({
        data: { code: "CONFLICT" },
        message: "未能取消訂閱，帳戶未刪除，請稍後再試。",
      });
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Failed to delete",
      mockTranslations["settings.deleteAccountConflict"]
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      "Failed to delete",
      "未能取消訂閱，帳戶未刪除，請稍後再試。"
    );
  });
});
