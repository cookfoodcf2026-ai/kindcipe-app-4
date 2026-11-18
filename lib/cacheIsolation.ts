/**
 * Identity-switch query-cache isolation.
 *
 * Extracted from AuthProvider so the ordering (cancel → clear/remove) is
 * unit-testable without rendering React. Controlled by its own flag
 * (EXPO_PUBLIC_ACCOUNT_CACHE_ISOLATION); the 401 link flag stays untouched.
 */

export type IdentitySnapshot = { userId: string; familyId: string };

export type IdentityChange = "none" | "account" | "family";

/** Paths that describe the session itself, not one family's data. */
const SESSION_QUERY_PATHS = new Set(["auth.me", "family.list"]);

/** tRPC v11 query keys are `[pathArray, { input, type }]`. */
export function queryPath(key: readonly unknown[]): string {
  const head = key[0];
  if (!Array.isArray(head)) return "";
  return head.map(String).join(".");
}

/**
 * Family-scoped = any cached query that is not the session baseline.
 * Kept conservative: an unknown key shape is treated as family-scoped so a
 * family switch never leaks family A data into family B.
 */
export function isFamilyScopedQuery(key: readonly unknown[]): boolean {
  return !SESSION_QUERY_PATHS.has(queryPath(key));
}

/**
 * Classify an identity change.
 * - account: both ids are non-empty and differ → wipe everything (incl. auth.me)
 * - family: same account, different family → drop family data only
 * - none: no previous identity, or nothing relevant changed
 */
export function identityChange(
  previous: IdentitySnapshot | null,
  next: IdentitySnapshot,
): IdentityChange {
  if (!previous) return "none";
  if (previous.userId === next.userId && previous.familyId === next.familyId) {
    return "none";
  }
  // Cold start / logout: one side is incomplete. This is NOT a switch between
  // two known identities, so never cancel/clear — cancelling here aborts the
  // in-flight auth.me while the family id is still hydrating from storage.
  // hardLogout owns the logout wipe separately.
  if (
    previous.userId === "" ||
    previous.familyId === "" ||
    next.userId === "" ||
    next.familyId === ""
  ) {
    return "none";
  }
  if (previous.userId !== next.userId) return "account";
  if (previous.familyId !== next.familyId) return "family";
  return "none";
}

export type CacheClient = {
  cancelQueries?: () => Promise<void>;
  clear: () => void;
  removeQueries: (opts: {
    predicate: (query: { queryKey: readonly unknown[] }) => boolean;
  }) => void;
};

/**
 * Apply isolation for an identity change.
 *
 * MUST await cancelQueries() first: without awaiting, in-flight requests keep
 * writing into the cache for up to their timeout (90s), defeating the wipe.
 */
export async function applyIdentityCacheIsolation(
  client: CacheClient,
  previous: IdentitySnapshot | null,
  next: IdentitySnapshot,
  opts: { enabled: boolean },
): Promise<IdentityChange> {
  const change = identityChange(previous, next);
  if (!opts.enabled || change === "none") return "none";

  if (typeof client.cancelQueries === "function") {
    await client.cancelQueries();
  }

  if (change === "account") {
    // New account: drop everything, including auth.me / family.list.
    client.clear();
  } else {
    // Family switch: never clear auth.me / family.list (clearing auth.me
    // cancels the in-flight request on cold start). Drop only family data.
    client.removeQueries({
      predicate: (query) => isFamilyScopedQuery(query.queryKey),
    });
  }

  return change;
}
