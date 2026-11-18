/**
 * Session-expiry signal shared by the tRPC link, AuthProvider and screens.
 *
 * The link layer only *reports* a definitive 401/UNAUTHORIZED. It never logs
 * out and never clears storage/cache — AuthProvider flips authStatus to
 * "unauthenticated" and the existing AuthGuard redirects to /login?next=...
 *
 * Everything is behind EXPO_PUBLIC_AUTH_401_LINK (default OFF). When OFF the
 * link only writes a `[auth401]` baseline log line; it never emits an event and
 * screens keep today's behaviour exactly.
 */
import { isUnauthorizedError } from "./authStatus";

export type SessionExpiredInfo = { source: string; error?: unknown };

/** Static access so Expo/Metro can inline the value at build time. */
export const AUTH_401_LINK_ENABLED =
  process.env.EXPO_PUBLIC_AUTH_401_LINK === "1" ||
  process.env.EXPO_PUBLIC_AUTH_401_LINK === "true";

/** AI Chef spinner watchdog. Must stay <= SESSION_LATCH_TTL_MS. */
export const CHEF_WATCHDOG_MS = 20_000;

/**
 * How long a session-expiry latch stays armed without another definitive 401.
 * Kept just above the 20s chef watchdog so a latched screen never outlives the
 * signal that put it there.
 */
export const SESSION_LATCH_TTL_MS = 30_000;

type Listener = (info: SessionExpiredInfo) => void;

const listeners = new Set<Listener>();
const aliveListeners = new Set<() => void>();
let emitted = false;
let emittedAt = 0;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Notified when the latch clears (success response, family switch or TTL). */
export function subscribeSessionAlive(cb: () => void): () => void {
  aliveListeners.add(cb);
  return () => {
    aliveListeners.delete(cb);
  };
}

/** Deduplicated: a burst of 401s in the same session emits exactly one event. */
export function emitSessionExpired(info: SessionExpiredInfo): boolean {
  if (hasSessionExpired()) return false;
  emitted = true;
  emittedAt = Date.now();
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => clearSessionExpired(), SESSION_LATCH_TTL_MS);
  (expiryTimer as { unref?: () => void }).unref?.();
  listeners.forEach((cb) => {
    try {
      cb(info);
    } catch {
      /* a broken listener must not stop the others */
    }
  });
  return true;
}

/** Called after a fresh successful auth.me (i.e. a new valid session). */
export function resetSessionExpired(): void {
  emitted = false;
  emittedAt = 0;
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

/** Any non-401 success (or TTL/family change) proves the session is alive. */
export function clearSessionExpired(): void {
  const wasLatched = emitted;
  resetSessionExpired();
  if (!wasLatched) return;
  aliveListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a broken listener must not stop the others */
    }
  });
}

export function hasSessionExpired(): boolean {
  if (!emitted) return false;
  if (Date.now() - emittedAt >= SESSION_LATCH_TTL_MS) {
    resetSessionExpired();
    return false;
  }
  return true;
}

/**
 * Identity that the latch is bound to. A family switch is NOT a token change,
 * so the family id must be part of the key — otherwise a stale latch from
 * family A would leak into family B.
 */
export type SessionIdentity = {
  userId?: string | number | null;
  familyId?: string | number | null;
  token?: string | null;
};

export function sessionLatchKey(identity: SessionIdentity): string {
  return [
    identity.userId ?? "",
    identity.familyId ?? "",
    identity.token ?? "",
  ].join(":");
}

let latchKey: string | null = null;

/**
 * Bind the latch to an identity. Returns true when the identity actually
 * changed (in which case any armed latch has been cleared).
 */
export function setSessionLatchKey(next: string | null): boolean {
  if (next === latchKey) return false;
  latchKey = next;
  const wasLatched = emitted;
  resetSessionExpired();
  return wasLatched;
}

export function getSessionLatchKey(): string | null {
  return latchKey;
}

/**
 * True when any node of a tRPC (batched) payload is a definitive auth
 * rejection: HTTP 401 or `data.code === "UNAUTHORIZED"`.
 */
export function payloadHasUnauthorized(payload: unknown, depth = 0): boolean {
  if (payload == null || depth > 6) return false;
  if (isUnauthorizedError(payload)) return true;
  if (Array.isArray(payload)) {
    return payload.some((item) => payloadHasUnauthorized(item, depth + 1));
  }
  if (typeof payload !== "object") return false;
  return Object.values(payload as Record<string, unknown>).some((value) =>
    payloadHasUnauthorized(value, depth + 1),
  );
}

/**
 * Report a failure to AuthProvider. Only definitive auth rejections emit, and
 * the emitter dedupes. Returns true when this call was the one that emitted.
 */
export function reportAuthFailure(errorOrPayload: unknown, source: string): boolean {
  if (!payloadHasUnauthorized(errorOrPayload)) return false;
  return emitSessionExpired({ source, error: errorOrPayload });
}

/**
 * Link-level entry point. Always writes the baseline log (flag ON or OFF);
 * only emits the session-expired event when the flag is ON. Any successful,
 * non-401 response clears the latch immediately.
 *
 * Returns true when this call emitted the session-expired event.
 */
export function handleHttpResponse(
  status: number,
  payload: unknown,
  path: string,
  source: string,
): boolean {
  const is401 = status === 401;
  const unauthorized = is401 || payloadHasUnauthorized(payload);
  if (unauthorized) {
    console.warn(
      `[auth401] path=${path} code=UNAUTHORIZED flag=${AUTH_401_LINK_ENABLED ? "on" : "off"}`,
    );
    if (!AUTH_401_LINK_ENABLED) return false;
    const definitive = is401
      ? { data: { code: "UNAUTHORIZED", httpStatus: 401 } }
      : payload;
    return reportAuthFailure(definitive, source);
  }
  if (status < 400) {
    clearSessionExpired();
  }
  return false;
}

export type ChefFailureAction = "login" | "retry" | "none";

/**
 * Screen-level classification for the AI Chef loading state.
 * - definitive 401 → login prompt (session really ended)
 * - abort/timeout/network → retry UI, never logout
 */
export function decideChefFailureAction(
  error: unknown,
  opts: { watchdogExpired?: boolean } = {},
): ChefFailureAction {
  if (opts.watchdogExpired) return "login";
  if (!error) return "none";
  return isUnauthorizedError(error) ? "login" : "retry";
}

export interface ChefFailureUi {
  stopSpinner: boolean;
  showLoginPrompt: boolean;
}

export function chefFailureUi(action: ChefFailureAction): ChefFailureUi {
  return { stopSpinner: action !== "none", showLoginPrompt: action === "login" };
}
