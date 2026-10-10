import PostHog from "posthog-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

/**
 * Product analytics (PostHog). Safe no-op when no key is configured, so the app
 * works in dev / before the key is set.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const analyticsEnabled = KEY.length > 0;

const OPT_OUT_KEY = "kindcipe_analytics_optout";

/** User opt-out (privacy). Default = enabled. Mirrored to a module var for speed. */
let optedOut = false;

export function isAnalyticsOptedOut(): boolean {
  return optedOut;
}

export async function setAnalyticsOptOut(value: boolean): Promise<void> {
  optedOut = value;
  try {
    await AsyncStorage.setItem(OPT_OUT_KEY, value ? "1" : "0");
  } catch {
    /* noop */
  }
  if (value) {
    try {
      client?.optOut();
    } catch {
      /* noop */
    }
  } else {
    try {
      client?.optIn();
    } catch {
      /* noop */
    }
  }
}

/** Load the persisted opt-out preference (call once at app start). */
export async function loadAnalyticsOptOut(): Promise<boolean> {
  try {
    optedOut = (await AsyncStorage.getItem(OPT_OUT_KEY)) === "1";
  } catch {
    optedOut = false;
  }
  return optedOut;
}

const CONSENT_KEY = "kindcipe_analytics_consent";

/** 首啟同意卡是否已處理過（預設未處理 = false）。 */
export async function hasAnsweredAnalyticsConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markAnalyticsConsentAnswered(): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* noop */
  }
}

let client: PostHog | null = null;

export function initAnalytics(): PostHog | null {
  if (!analyticsEnabled) return null;
  if (client) return client;
  try {
    client = new PostHog(KEY, {
      host: HOST,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
    });
    if (optedOut) client.optOut();
  } catch {
    client = null;
  }
  return client;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (optedOut) return;
  try {
    client?.capture(event, properties as any);
  } catch {
    // never break the app for analytics
  }
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (optedOut) return;
  try {
    client?.identify(userId, properties as any);
  } catch {
    /* noop */
  }
}

export function setUserProperties(properties: Record<string, unknown>): void {
  try {
    client?.capture("$set", properties as any);
  } catch {
    /* noop */
  }
}

export function resetAnalytics(): void {
  try {
    client?.reset();
  } catch {
    /* noop */
  }
}

/**
 * Recipe interaction tracking → backend `recipe_events` table (powers
 * trending / ranking). Fire-and-forget: never blocks UI, never throws.
 */
export type RecipeEventType = "view" | "plan" | "save" | "cook";

export function trackRecipeEvent(
  recipeId: string,
  recipeName: string,
  eventType: RecipeEventType,
): void {
  if (!recipeId || !recipeName) return;
  try {
    (trpc as any).recipeEvents?.track?.mutate?.({ recipeId, recipeName, eventType });
  } catch {
    /* analytics must never break the app */
  }
}

/**
 * Redirect attribution → backend `redirect_logs` table. Used when the user is
 * sent out to a creator's platform (IG / YouTube / …) so we can attribute
 * partner traffic. Fire-and-forget.
 */
export function logRedirect(platform: string, keyword?: string): void {
  if (!platform) return;
  try {
    (trpc as any).shopping?.logRedirect?.mutate?.({ platform, keyword });
  } catch {
    /* noop */
  }
}

/** Canonical event names used across the app. */
export const Events = {
  SignupStarted: "signup_started",
  LoginCompleted: "login_completed",
  Logout: "logout",
  KitchenCreated: "kitchen_created",
  KitchenJoined: "kitchen_joined",
  OnboardingCompleted: "onboarding_completed",
  AiRecipeGenerated: "ai_recipe_generated",
  AiEditUsed: "ai_edit_used",
  RecipeImported: "recipe_imported",
  RecipeSaved: "recipe_saved",
  MealPlanned: "meal_planned",
  ShoppingListGenerated: "shopping_list_generated",
  ShoppingItemChecked: "shopping_item_checked",
  PaywallViewed: "paywall_viewed",
  PurchaseStarted: "purchase_started",
  PurchaseCompleted: "purchase_completed",
  PromoRedeemed: "promo_redeemed",
  LanguageChanged: "language_changed",
  // Share / 匯入診斷（上架後監控分享有冇壞）
  ShareReceived: "share_received",
  ShareConsumed: "share_consumed",
  ShareFailed: "share_failed",
  // Account portability (防止換機遺失資料)
  AccountLinkPromptShown: "account_link_prompt_shown",
  AccountLinkPromptClicked: "account_link_prompt_clicked",
} as const;
