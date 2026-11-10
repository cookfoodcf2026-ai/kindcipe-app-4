/**
 * Pure auth-state derivation.
 *
 * The app must never treat a single failed `auth.me` call as proof that the
 * session is invalid: a network blip, a 5xx or an aborted request leaves the
 * user in "unknown" — not logged out. Only a definitive 401/UNAUTHORIZED (or
 * the absence of any token) is "unauthenticated".
 */
export type AuthStatus = "authenticated" | "unauthenticated" | "unknown";

export const MAX_AUTH_ME_RETRIES = 2;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getNested(error: unknown, path: string[]): unknown {
  let current: unknown = error;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function getErrorCode(error: unknown): string | undefined {
  const code =
    getNested(error, ["data", "code"]) ??
    getNested(error, ["shape", "data", "code"]) ??
    getNested(error, ["code"]);
  return typeof code === "string" ? code : undefined;
}

function getHttpStatus(error: unknown): number | undefined {
  const status =
    getNested(error, ["data", "httpStatus"]) ??
    getNested(error, ["shape", "data", "httpStatus"]) ??
    getNested(error, ["status"]) ??
    getNested(error, ["response", "status"]);
  return typeof status === "number" ? status : undefined;
}

function getErrorMessage(error: unknown): string {
  const message = getNested(error, ["message"]);
  return typeof message === "string" ? message : "";
}

/** Definitive session rejection: tRPC UNAUTHORIZED or HTTP 401. */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  if (getErrorCode(error) === "UNAUTHORIZED") return true;
  if (getHttpStatus(error) === 401) return true;
  return /\bUNAUTHORIZED\b|\b401\b/i.test(getErrorMessage(error));
}

/**
 * Network / 5xx / abort / timeout failures are transient. Anything that is not
 * a definitive auth rejection is also treated as transient on purpose: it is
 * safer to keep the session than to silently log the user out.
 */
export function isTransientAuthError(error: unknown): boolean {
  if (!error) return true;
  if (isUnauthorizedError(error)) return false;

  const status = getHttpStatus(error);
  if (status !== undefined) return status >= 500;

  const name = getNested(error, ["name"]);
  if (name === "AbortError" || name === "TimeoutError") return true;

  const message = getErrorMessage(error);
  if (/abort|timeout|timed out|network|fetch failed|failed to fetch|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return true;
  }

  // Unknown, non-auth failure (e.g. a thrown TypeError from the fetch layer).
  return true;
}

/**
 * React Query calls this with failureCount starting at 0. Allowing failureCount
 * 0 and 1 means two retries (three attempts total) before settling.
 */
export function shouldRetryAuthMe(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_AUTH_ME_RETRIES && isTransientAuthError(error);
}

export function authMeRetryDelay(failureCount: number): number {
  return Math.min(500 * 2 ** Math.max(0, failureCount), 4000);
}

export interface DeriveAuthStatusInput {
  hasToken: boolean | null;
  data: unknown;
  error: unknown;
  /** True while the token read or the auth.me request is still in flight. */
  isLoading?: boolean;
}

export function deriveAuthStatus({
  hasToken,
  data,
  error,
  isLoading = false,
}: DeriveAuthStatusInput): AuthStatus {
  if (data != null) return "authenticated";
  if (isLoading) return "unknown";
  if (error != null) {
    // Only a definitive rejection may log the user out. Any transient/unknown
    // failure — even when the cached "has token" flag is stale or false — is
    // not proof the session ended.
    return isUnauthorizedError(error) ? "unauthenticated" : "unknown";
  }
  if (hasToken === false) return "unauthenticated";
  // Token present (or its state is still unknown) + no definitive 401 → unknown.
  return "unknown";
}
