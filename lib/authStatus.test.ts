import {
  deriveAuthStatus,
  isUnauthorizedError,
  shouldRetryAuthMe,
} from "./authStatus";
import { authGuardRedirect, type AuthGuardRedirectInput } from "./authGuardRedirect";

function transientError(): Error {
  return new TypeError("Network request failed");
}

function unauthorizedError(): Error & { data: { code: string; httpStatus: number } } {
  const error = new Error("Unauthorized") as Error & {
    data: { code: string; httpStatus: number };
  };
  error.data = { code: "UNAUTHORIZED", httpStatus: 401 };
  return error;
}

function redirectInput(overrides: Partial<AuthGuardRedirectInput> = {}): AuthGuardRedirectInput {
  return {
    onboardingDone: true,
    activeFamilyId: "1",
    inLoginPage: false,
    inOnboarding: false,
    inForgotPassword: false,
    inResetPassword: false,
    inVerifyEmail: false,
    inTabsGroup: true,
    seg0: "(tabs)",
    ...overrides,
  };
}

describe("auth status derivation", () => {
  it("keeps a token holder in unknown after three consecutive transient failures and does not redirect", () => {
    let status = "unknown" as ReturnType<typeof deriveAuthStatus>;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      status = deriveAuthStatus({
        hasToken: true,
        data: null,
        error: transientError(),
        isLoading: false,
      });
      expect(status).toBe("unknown");
    }

    expect(authGuardRedirect(redirectInput({ authStatus: status }))).toBeUndefined();
  });

  it("treats a token plus 401/UNAUTHORIZED as unauthenticated", () => {
    const error = unauthorizedError();
    expect(isUnauthorizedError(error)).toBe(true);
    expect(
      deriveAuthStatus({ hasToken: true, data: null, error, isLoading: false }),
    ).toBe("unauthenticated");
  });

  it("treats no token as unauthenticated", () => {
    expect(
      deriveAuthStatus({ hasToken: false, data: null, error: null, isLoading: false }),
    ).toBe("unauthenticated");
  });

  it("treats a resolved auth.me as authenticated", () => {
    expect(
      deriveAuthStatus({
        hasToken: true,
        data: { id: 1, name: "Test" },
        error: null,
        isLoading: false,
      }),
    ).toBe("authenticated");
  });

  it("stays unknown while the token/auth call is still loading", () => {
    expect(
      deriveAuthStatus({ hasToken: null, data: null, error: null, isLoading: true }),
    ).toBe("unknown");
  });
});

describe("auth.me retry policy", () => {
  it("allows exactly two retries for transient failures", () => {
    expect(shouldRetryAuthMe(0, transientError())).toBe(true);
    expect(shouldRetryAuthMe(1, transientError())).toBe(true);
    expect(shouldRetryAuthMe(2, transientError())).toBe(false);
  });

  it("never retries a 401", () => {
    expect(shouldRetryAuthMe(0, unauthorizedError())).toBe(false);
    expect(shouldRetryAuthMe(1, unauthorizedError())).toBe(false);
  });
});

describe("authGuardRedirect unknown handling", () => {
  it("returns undefined for unknown on every route", () => {
    const routes = ["(tabs)", "login", "onboarding", "recipe/1", "admin", "index"];
    for (const seg0 of routes) {
      expect(
        authGuardRedirect(
          redirectInput({
            authStatus: "unknown",
            seg0,
            inLoginPage: seg0 === "login",
            inOnboarding: seg0 === "onboarding",
            inTabsGroup: seg0 === "(tabs)",
          }),
        ),
      ).toBeUndefined();
    }
  });

  it("still redirects unauthenticated users on protected routes", () => {
    expect(authGuardRedirect(redirectInput({ authStatus: "unauthenticated" }))).toBe("/login");
  });
});
