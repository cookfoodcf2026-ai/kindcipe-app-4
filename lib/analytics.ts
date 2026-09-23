import PostHog from "posthog-react-native";

/**
 * Product analytics (PostHog). Safe no-op when no key is configured, so the app
 * works in dev / before the key is set.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const analyticsEnabled = KEY.length > 0;

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
  } catch {
    client = null;
  }
  return client;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    client?.capture(event, properties as any);
  } catch {
    // never break the app for analytics
  }
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
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
  LanguageChanged: "language_changed",
} as const;
