/**
 * Synchronous in-memory store for the ?next redirect target.
 * Written by login.tsx during render; read by AuthGuard's useEffect.
 * This avoids the AsyncStorage race condition (effects run in parent→child order
 * but AsyncStorage writes are async).
 */
let _next: string | null = null;
export function setLoginNext(v: string | null) { _next = v; }
export function getLoginNext(): string | null { return _next; }
