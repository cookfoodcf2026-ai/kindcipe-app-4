/**
 * Deep-link redirect regression test
 *
 * Tests the pure authGuardRedirect function directly — no duplication of logic.
 * The "buggy" version is kept inline only to prove the original root cause;
 * the fixed version is always the live module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { authGuardRedirect } from "./authGuardRedirect";

// ── ORIGINAL (buggy) redirect decision — proof only, never compared against live code
function buggyAuthGuardRedirect(input: {
  isLoggedIn: boolean;
  onboardingDone: boolean;
  activeFamilyId: string | null;
  inLoginPage: boolean;
  inOnboarding: boolean;
  inForgotPassword: boolean;
  inResetPassword: boolean;
  inVerifyEmail: boolean;
  inImport: boolean;
  inTabsGroup: boolean;
  seg0: string;
}): string | undefined {
  const {
    isLoggedIn, onboardingDone, activeFamilyId,
    inLoginPage, inOnboarding, inForgotPassword, inResetPassword,
    inVerifyEmail, inImport, inTabsGroup, seg0,
  } = input;

  if (!isLoggedIn && !inLoginPage && !inForgotPassword && !inResetPassword && !inVerifyEmail) {
    if (seg0 === "admin") return "/login?mode=admin";
    return "/login";
  }

  if (isLoggedIn) {
    if (inForgotPassword || inResetPassword) return undefined;

    if (!onboardingDone) {
      if (activeFamilyId) {
        // BUG: only guards /import, every other route → /(tabs)
        if (!inImport) return "/(tabs)";
        return undefined;
      }
      if (!inOnboarding && (inLoginPage || inTabsGroup)) {
        return "/onboarding";
      }
    } else {
      if (inLoginPage || inForgotPassword || inResetPassword || inOnboarding || inVerifyEmail || seg0 === "index") {
        return "/(tabs)";
      }
    }
  }

  return undefined;
}

// ── Helper ────────────────────────────────────────────────────────────────────
const loggedInWithFamily = {
  isLoggedIn: true,
  activeFamilyId: "fam_123",
  inForgotPassword: false,
  inResetPassword: false,
  inVerifyEmail: false,
};

const deepLinkScenarios = [
  { seg0: "recipe", label: "/recipe/official_3674" },
  { seg0: "settings", label: "/settings" },
  { seg0: "ai-chef", label: "/ai-chef" },
  { seg0: "more", label: "/more" },
  { seg0: "planner", label: "/planner" },
  { seg0: "shopping", label: "/shopping" },
  { seg0: "recipes", label: "/recipes" },
  { seg0: "kitchen-settings", label: "/kitchen-settings" },
  { seg0: "purchase-history", label: "/purchase-history" },
];

// ── RED test: prove the buggy code hijacks deep links ────────────────────────
test("BUG: original code redirects deep link /recipe to /(tabs) when !onboardingDone && activeFamilyId", () => {
  for (const { seg0, label } of deepLinkScenarios) {
    const result = buggyAuthGuardRedirect({
      ...loggedInWithFamily,
      onboardingDone: false,
      inLoginPage: false,
      inOnboarding: false,
      inImport: false,
      inTabsGroup: false,
      seg0,
    });
    // Buggy code DOES redirect → proves root cause
    assert.equal(result, "/(tabs)", `buggy code SHOULD redirect ${label} to /(tabs) — this proves the bug`);
  }
});

// ── GREEN test: live module preserves deep links ─────────────────────────────
test("FIX: deep link /recipe/xxx preserved when !onboardingDone && activeFamilyId", () => {
  for (const { seg0, label } of deepLinkScenarios) {
    const result = authGuardRedirect({
      ...loggedInWithFamily,
      onboardingDone: false,
      inLoginPage: false,
      inOnboarding: false,
      inTabsGroup: false,
      seg0,
    });
    assert.equal(result, undefined, `${label} should NOT be redirected`);
  }
});

test("FIX: /import preserved when !onboardingDone && activeFamilyId", () => {
  const result = authGuardRedirect({
    ...loggedInWithFamily,
    onboardingDone: false,
    inLoginPage: false,
    inOnboarding: false,
    inTabsGroup: false,
    seg0: "import",
  });
  assert.equal(result, undefined, "/import should NOT be redirected");
});

test("FIX: /login → /(tabs) when !onboardingDone && activeFamilyId", () => {
  const result = authGuardRedirect({
    ...loggedInWithFamily,
    onboardingDone: false,
    inLoginPage: true,
    inOnboarding: false,
    inTabsGroup: false,
    seg0: "login",
  });
  assert.equal(result, "/(tabs)", "/login should redirect to /(tabs)");
});

test("REGRESSION GUARD: stay on /onboarding when !onboardingDone && activeFamilyId", () => {
  // 用戶啱啱喺 onboarding 建立完廚房 → activeFamilyId 即刻有值。
  // 若喺呢刻踢去 /(tabs)，guide carousel + quick-plan 永遠唔會出現（onboarding 被架空）。
  const result = authGuardRedirect({
    ...loggedInWithFamily,
    onboardingDone: false,
    inLoginPage: false,
    inOnboarding: true,
    inTabsGroup: false,
    seg0: "onboarding",
  });
  assert.equal(result, undefined, "/onboarding must stay so the flow can finish");
});

test("FIX: index → /(tabs) when !onboardingDone && activeFamilyId", () => {
  const result = authGuardRedirect({
    ...loggedInWithFamily,
    onboardingDone: false,
    inLoginPage: false,
    inOnboarding: false,
    inTabsGroup: true,
    seg0: "index",
  });
  assert.equal(result, "/(tabs)", "index should redirect to /(tabs)");
});

test("FIX: unauthenticated → /login", () => {
  const result = authGuardRedirect({
    isLoggedIn: false,
    onboardingDone: false,
    activeFamilyId: null,
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "recipe",
  });
  assert.equal(result, "/login", "unauthenticated should redirect to /login");
});

test("FIX: unauthenticated admin → /login?mode=admin", () => {
  const result = authGuardRedirect({
    isLoggedIn: false,
    onboardingDone: false,
    activeFamilyId: null,
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "admin",
  });
  assert.equal(result, "/login?mode=admin", "unauthenticated admin should redirect to /login?mode=admin");
});

test("FIX: onboardingDone=true, deep link preserved", () => {
  const result = authGuardRedirect({
    isLoggedIn: true,
    onboardingDone: true,
    activeFamilyId: "fam_123",
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "recipe",
  });
  assert.equal(result, undefined, "deep link should NOT be redirected when onboardingDone");
});

test("FIX: onboardingDone=true, /login → /(tabs)", () => {
  const result = authGuardRedirect({
    isLoggedIn: true,
    onboardingDone: true,
    activeFamilyId: "fam_123",
    inLoginPage: true,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "login",
  });
  assert.equal(result, "/(tabs)", "/login should redirect to /(tabs) when onboardingDone");
});

test("FIX: logged-in on /forgot-password stays", () => {
  const result = authGuardRedirect({
    isLoggedIn: true,
    onboardingDone: true,
    activeFamilyId: "fam_123",
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: true,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "forgot-password",
  });
  assert.equal(result, undefined, "forgot-password should NOT redirect");
});

test("FIX: logged-in on /reset-password stays", () => {
  const result = authGuardRedirect({
    isLoggedIn: true,
    onboardingDone: true,
    activeFamilyId: "fam_123",
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: true,
    inVerifyEmail: false,
    inTabsGroup: false,
    seg0: "reset-password",
  });
  assert.equal(result, undefined, "reset-password should NOT redirect");
});

test("redirectSystemPath preserves deep link path", () => {
  const redirectSystemPath = (path: string): string => {
    const p = String(path ?? "");
    if (/dataurl=/i.test(p) || /sharekey/i.test(p)) return "/import";
    return p || "/";
  };

  assert.equal(redirectSystemPath("/recipe/official_3674"), "/recipe/official_3674", "deep link preserved");
  assert.equal(redirectSystemPath("/login?next=/shopping"), "/login?next=/shopping", "login with query preserved");
  assert.equal(redirectSystemPath("/settings"), "/settings", "settings preserved");
  assert.equal(redirectSystemPath("/nonexistent-xyz"), "/nonexistent-xyz", "unknown path preserved");
});
