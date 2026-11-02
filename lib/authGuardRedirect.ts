/**
 * Pure function that decides where AuthGuard should redirect.
 *
 * This module is the single source of truth for the auth redirect logic.
 * Tests should import this function directly — never duplicate the logic in test files.
 *
 * Returns a path string to redirect to, or undefined if no redirect is needed.
 */
export interface AuthGuardRedirectInput {
  isLoggedIn: boolean;
  onboardingDone: boolean;
  activeFamilyId: string | null | undefined;
  inLoginPage: boolean;
  inOnboarding: boolean;
  inForgotPassword: boolean;
  inResetPassword: boolean;
  inVerifyEmail: boolean;
  inTabsGroup: boolean;
  seg0: string;
}

export function authGuardRedirect(input: AuthGuardRedirectInput): string | undefined {
  const {
    isLoggedIn,
    onboardingDone,
    activeFamilyId,
    inLoginPage,
    inOnboarding,
    inForgotPassword,
    inResetPassword,
    inVerifyEmail,
    inTabsGroup,
    seg0,
  } = input;

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!isLoggedIn && !inLoginPage && !inForgotPassword && !inResetPassword && !inVerifyEmail) {
    if (seg0 === "admin") return "/login?mode=admin";
    // Preserve the current path so login can redirect back (deep link + query).
    return "/login";
  }

  // ── Logged in ─────────────────────────────────────────────────────────
  if (isLoggedIn) {
    // Password reset flows — stay put
    if (inForgotPassword || inResetPassword) return undefined;

    if (!onboardingDone) {
      // User has a kitchen but onboarding flag not yet set
      if (activeFamilyId) {
        // Only redirect from entry points, NOT deep links.
        // ⚠️ 唔包括 inOnboarding：用戶啱啱建立廚房就係喺 /onboarding，
        // 呢刻踢去 tabs 會令 guide + quick-plan 永遠唔會出現。
        if (inLoginPage || seg0 === "index") {
          return "/(tabs)";
        }
        // Deep links (recipe, settings, ai-chef, ...) and /import are preserved
        return undefined;
      }
      // No kitchen yet → go to onboarding
      if (!inOnboarding && (inLoginPage || inTabsGroup)) {
        return "/onboarding";
      }
    } else {
      // Completed onboarding → only redirect from auth/onboarding pages
      if (inLoginPage || inForgotPassword || inResetPassword || inOnboarding || inVerifyEmail || seg0 === "index") {
        return "/(tabs)";
      }
    }
  }

  return undefined;
}
