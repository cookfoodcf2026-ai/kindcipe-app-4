import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createScopedStorage,
  scopedKey,
  type StorageScope,
} from "./scopedStorage";

type Fake = {
  data: Map<string, string>;
  writes: string[];
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
};

function fakeStorage(
  initial: Record<string, string> = {},
  opts: { failWrites?: (key: string) => boolean } = {},
): Fake {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    data,
    writes,
    async getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    async setItem(key, value) {
      if (opts.failWrites?.(key)) throw new Error(`write failed: ${key}`);
      writes.push(`set:${key}`);
      data.set(key, value);
    },
    async removeItem(key) {
      writes.push(`remove:${key}`);
      data.delete(key);
    },
    async multiRemove(keys) {
      for (const key of keys) data.delete(key);
    },
  };
}

const A: StorageScope = { userId: "7", familyId: "100" };
const B: StorageScope = { userId: "7", familyId: "200" };
const BASE = "@kindcipe:saved-shopping-lists";

test("flag OFF: base key is used verbatim (no prefix, no migration)", async () => {
  const storage = fakeStorage({ [BASE]: "legacy" });
  const scoped = createScopedStorage({ enabled: false, getScope: () => A, storage });
  assert.equal(await scoped.getItem(BASE), "legacy");
  await scoped.setItem(BASE, "next");
  assert.equal(storage.data.get(BASE), "next");
  assert.equal(storage.data.has(scopedKey(BASE, A)), false);
  assert.equal(storage.writes.some((w) => w.includes(":100:")), false);
});

test("new key write/read uses `${userId}:${familyId}:` prefix", async () => {
  const storage = fakeStorage();
  const scoped = createScopedStorage({ enabled: true, getScope: () => A, storage });
  await scoped.setItem(BASE, "v1");
  assert.equal(storage.data.get(`${A.userId}:${A.familyId}:${BASE}`), "v1");
  assert.equal(await scoped.getItem(BASE), "v1");
});

test("migration: legacy-only read moves once, deletes legacy, then reads new key", async () => {
  const storage = fakeStorage({ [BASE]: "legacy-payload" });
  const scoped = createScopedStorage({ enabled: true, getScope: () => A, storage });

  assert.equal(await scoped.getItem(BASE), "legacy-payload");
  const nextKey = `${A.userId}:${A.familyId}:${BASE}`;
  assert.equal(storage.data.get(nextKey), "legacy-payload");
  assert.equal(storage.data.has(BASE), false);

  storage.writes.length = 0;
  assert.equal(await scoped.getItem(BASE), "legacy-payload");
  assert.equal(storage.writes.some((w) => w === "set:" + BASE), false);
});

test("migration failure keeps the legacy key and still returns its value", async () => {
  const storage = fakeStorage(
    { [BASE]: "legacy-payload" },
    { failWrites: (key) => key === `${A.userId}:${A.familyId}:${BASE}` },
  );
  const scoped = createScopedStorage({ enabled: true, getScope: () => A, storage });

  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(await scoped.getItem(BASE), "legacy-payload");
  } finally {
    console.error = originalError;
  }
  assert.equal(storage.data.get(BASE), "legacy-payload");
  assert.ok(errors.length >= 1);
});

test("legacy blob already claimed by family A is not adopted by family B", async () => {
  const storage = fakeStorage({
    [BASE]: "family-a-secret",
    ["@kindcipe:scope-migration-owners"]: JSON.stringify({ [BASE]: "7:100" }),
  });
  const scopedB = createScopedStorage({ enabled: true, getScope: () => B, storage });

  assert.equal(await scopedB.getItem(BASE), null);
  assert.equal(storage.data.get(BASE), "family-a-secret");
  assert.equal(storage.data.has(`${B.userId}:${B.familyId}:${BASE}`), false);
});

test("device-level modules never import the scoped storage wrapper", () => {
  const files = [
    "lib/auth.ts",
    "lib/i18n.ts",
    "lib/analytics.ts",
    "app/onboarding.tsx",
    "app/import.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.equal(
      /from\s+["'][^"']*scopedStorage["']/.test(source),
      false,
      `${file} must keep AsyncStorage (device-level)`,
    );
  }
});

test("device-level helpers keep their literal keys unprefixed", () => {
  const token = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8");
  const language = readFileSync(join(process.cwd(), "lib/i18n.ts"), "utf8");
  const consent = readFileSync(join(process.cwd(), "lib/analytics.ts"), "utf8");
  const onboarding = readFileSync(join(process.cwd(), "app/onboarding.tsx"), "utf8");

  assert.match(token, /kindcipe_auth_token/);
  assert.match(token, /kindcipe_biometric_enabled/);
  assert.match(language, /kindcipe_language/);
  assert.match(consent, /kindcipe_analytics_consent/);
  assert.match(onboarding, /kindcipe_onboarding_done_/);
});
