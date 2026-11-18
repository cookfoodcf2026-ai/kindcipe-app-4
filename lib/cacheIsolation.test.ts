import assert from "node:assert/strict";
import test from "node:test";
import {
  applyIdentityCacheIsolation,
  identityChange,
  isFamilyScopedQuery,
  type CacheClient,
  type IdentitySnapshot,
} from "./cacheIsolation";

const A: IdentitySnapshot = { userId: "u1", familyId: "fam1" };

function fakeClient(order: string[] = []) {
  const removed: string[][] = [];
  let resolveCancel: (() => void) | null = null;
  const client: CacheClient & { removed: string[][]; order: string[]; release(): void } = {
    removed,
    order,
    cancelQueries: async () => {
      order.push("cancel:start");
      await new Promise<void>((resolve) => {
        resolveCancel = resolve;
      });
      order.push("cancel:end");
    },
    clear: () => {
      order.push("clear");
    },
    removeQueries: ({ predicate }) => {
      order.push("remove");
      for (const key of [
        [["auth", "me"], { type: "query" }],
        [["family", "list"], { type: "query" }],
        [["recipes", "list"], { type: "query" }],
        [["family", "get"], { type: "query" }],
      ]) {
        if (predicate({ queryKey: key })) removed.push(key as unknown as string[]);
      }
    },
    release: () => resolveCancel?.(),
  };
  return client;
}

test("flag OFF: no cancel, no clear, no remove (today's behaviour)", async () => {
  const client = fakeClient();
  const change = await applyIdentityCacheIsolation(
    client,
    A,
    { userId: "u2", familyId: "fam1" },
    { enabled: false },
  );
  assert.equal(change, "none");
  assert.deepEqual(client.order, []);
});

test("real account switch awaits cancelQueries before clear()", async () => {
  const client = fakeClient();
  const pending = applyIdentityCacheIsolation(
    client,
    A,
    { userId: "u2", familyId: "fam1" },
    { enabled: true },
  );

  assert.deepEqual(client.order, ["cancel:start"]);
  client.release();
  const change = await pending;

  assert.equal(change, "account");
  assert.deepEqual(client.order, ["cancel:start", "cancel:end", "clear"]);
});

test("family switch removes family queries but preserves auth.me / family.list", async () => {
  const client = fakeClient();
  const pending = applyIdentityCacheIsolation(
    client,
    A,
    { userId: "u1", familyId: "fam2" },
    { enabled: true },
  );
  client.release();
  const change = await pending;

  assert.equal(change, "family");
  assert.deepEqual(client.order, ["cancel:start", "cancel:end", "remove"]);
  assert.deepEqual(
    client.removed.map((key) => (key[0] as unknown as string[]).join(".")),
    ["recipes.list", "family.get"],
  );
});

test("query classifier keeps the session baseline unscoped", () => {
  assert.equal(isFamilyScopedQuery([["auth", "me"], { type: "query" }]), false);
  assert.equal(isFamilyScopedQuery([["family", "list"], { type: "query" }]), false);
  assert.equal(isFamilyScopedQuery([["family", "get"], { type: "query" }]), true);
  assert.equal(isFamilyScopedQuery([["recipes", "list"], { type: "query" }]), true);
  assert.equal(isFamilyScopedQuery(["odd"]), true);
});

test("identityChange: same identity, cold start and logout paths never wipe", () => {
  assert.equal(identityChange(null, A), "none");
  assert.equal(identityChange(A, A), "none");
  assert.equal(identityChange(A, { userId: "", familyId: "fam1" }), "none");
  assert.equal(identityChange(A, { userId: "", familyId: "" }), "none");
  assert.equal(identityChange(A, { userId: "u1", familyId: "" }), "none");
  // Cold-start hydration (empty → known) must not cancel auth.me.
  assert.equal(identityChange({ userId: "", familyId: "" }, A), "none");
  assert.equal(
    identityChange(A, { userId: "u2", familyId: "fam1" }),
    "account",
  );
});
