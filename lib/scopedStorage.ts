/**
 * Family-scoped AsyncStorage helper.
 *
 * Only per-family data may be prefixed. Device/app-level state (auth token,
 * biometrics, language, analytics consent, onboarding flag) MUST keep using
 * plain AsyncStorage — it has to be readable before login and must survive
 * account/family switches.
 *
 * Key shape: `${userId}:${familyId}:${baseKey}` (flag OFF → baseKey untouched).
 *
 * Migration: when the scoped key is missing, read the legacy base key, move it
 * to the scoped key once, then delete the legacy key. A migration-owner marker
 * stops a second family/user from adopting the same legacy blob (which would
 * leak family A data into family B). Migration failure never throws: the
 * legacy key is kept and the read still returns the legacy value.
 */
import { ACCOUNT_CACHE_ISOLATION_ENABLED } from "./flags";

export type StorageScope = { userId: string; familyId: string };

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove?(keys: string[]): Promise<void>;
};

/** Device-level marker: which identity already migrated a legacy key. */
const MIGRATION_OWNERS_KEY = "@kindcipe:scope-migration-owners";

let activeScope: StorageScope | null = null;

function normalizeScope(scope: StorageScope | null): StorageScope | null {
  if (!scope) return null;
  const userId = String(scope.userId ?? "");
  const familyId = String(scope.familyId ?? "");
  if (!userId || !familyId) return null;
  return { userId, familyId };
}

export function setStorageScope(scope: StorageScope | null): void {
  activeScope = normalizeScope(scope);
}

export function getStorageScope(): StorageScope | null {
  return activeScope;
}

export function clearStorageScope(): void {
  activeScope = null;
}

export function scopePrefix(scope: StorageScope | null): string {
  return scope ? `${scope.userId}:${scope.familyId}:` : "";
}

export function scopedKey(
  baseKey: string,
  scope: StorageScope | null = activeScope,
): string {
  const normalized = normalizeScope(scope);
  return normalized ? `${scopePrefix(normalized)}${baseKey}` : baseKey;
}

function defaultStorage(): StorageLike {
  // Loaded lazily so unit tests can inject a fake storage and run under Node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@react-native-async-storage/async-storage");
  return (mod?.default ?? mod) as StorageLike;
}

export type ScopedStorage = {
  getItem(baseKey: string): Promise<string | null>;
  setItem(baseKey: string, value: string): Promise<void>;
  removeItem(baseKey: string): Promise<void>;
  removeItems(baseKeys: string[]): Promise<void>;
};

export function createScopedStorage(opts: {
  enabled: boolean;
  getScope: () => StorageScope | null;
  storage?: StorageLike;
}): ScopedStorage {
  let resolved: StorageLike | null = null;
  const storage = (): StorageLike => {
    if (opts.storage) return opts.storage;
    if (!resolved) resolved = defaultStorage();
    return resolved;
  };

  function scopeForRead(): StorageScope | null {
    return opts.enabled ? normalizeScope(opts.getScope()) : null;
  }

  async function readOwners(): Promise<Record<string, string>> {
    try {
      const raw = await storage().getItem(MIGRATION_OWNERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Claim the one-time legacy migration for this identity. */
  async function claimLegacy(
    baseKey: string,
    scope: StorageScope,
  ): Promise<boolean> {
    const owner = scopePrefix(scope).slice(0, -1);
    const owners = await readOwners();
    const existing = owners[baseKey];
    if (existing && existing !== owner) return false;
    if (existing === owner) return true;
    try {
      await storage().setItem(
        MIGRATION_OWNERS_KEY,
        JSON.stringify({ ...owners, [baseKey]: owner }),
      );
      return true;
    } catch (error) {
      console.error("[scopedStorage] migration owner write failed", baseKey, error);
      // Best effort: without a marker we cannot prove the legacy key belongs
      // to another identity, so keep the documented fallback.
      return true;
    }
  }

  async function getItem(baseKey: string): Promise<string | null> {
    const scope = scopeForRead();
    if (!scope) return storage().getItem(baseKey);

    const key = scopedKey(baseKey, scope);
    try {
      const next = await storage().getItem(key);
      if (next !== null) return next;
    } catch (error) {
      console.error("[scopedStorage] scoped read failed", baseKey, error);
    }

    let legacy: string | null = null;
    try {
      legacy = await storage().getItem(baseKey);
    } catch (error) {
      console.error("[scopedStorage] legacy read failed", baseKey, error);
      return null;
    }
    if (legacy === null) return null;

    if (!(await claimLegacy(baseKey, scope))) return null;

    try {
      await storage().setItem(key, legacy);
      await storage().removeItem(baseKey);
    } catch (error) {
      // Keep the legacy key (and still return its value) when moving fails.
      console.error(
        "[scopedStorage] migration failed; keeping legacy key",
        baseKey,
        error,
      );
    }
    return legacy;
  }

  async function setItem(baseKey: string, value: string): Promise<void> {
    const scope = scopeForRead();
    await storage().setItem(scopedKey(baseKey, scope), value);
  }

  async function removeItem(baseKey: string): Promise<void> {
    const scope = scopeForRead();
    await storage().removeItem(scopedKey(baseKey, scope));
  }

  async function removeItems(baseKeys: string[]): Promise<void> {
    const scope = scopeForRead();
    const keys = baseKeys.map((baseKey) => scopedKey(baseKey, scope));
    const s = storage();
    if (typeof s.multiRemove === "function") {
      await s.multiRemove(keys);
      return;
    }
    for (const key of keys) {
      await s.removeItem(key);
    }
  }

  return { getItem, setItem, removeItem, removeItems };
}

/** Production instance: flag-gated, scope set by AuthProvider. */
export const familyStorage: ScopedStorage = createScopedStorage({
  enabled: ACCOUNT_CACHE_ISOLATION_ENABLED,
  getScope: getStorageScope,
});
