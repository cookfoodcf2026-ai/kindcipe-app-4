import assert from "node:assert/strict";
import test from "node:test";
import { cardIdentity, mergeAppendedCards } from "./appendCards";

test("append dedupes same cardId", () => {
  const prev = [{ cardId: "official_1", name: "A" }];
  const next = [{ cardId: "official_1", name: "A" }, { cardId: "official_2", name: "B" }];
  assert.deepEqual(mergeAppendedCards(prev, next), [
    { cardId: "official_1", name: "A" },
    { cardId: "official_2", name: "B" },
  ]);
});

test("append keeps legacy official identity without cardId", () => {
  const prev = [{ name: "A", officialId: 1 }];
  const next = [{ name: "A", officialId: 1 }, { name: "B", officialId: 2 }];
  assert.deepEqual(mergeAppendedCards(prev, next), [
    { name: "A", officialId: 1 },
    { name: "B", officialId: 2 },
  ]);
});

test("append empty next keeps previous array", () => {
  const prev = [{ cardId: "official_1", name: "A" }];
  assert.equal(mergeAppendedCards(prev, []), prev);
});

test("append same name different cardId keeps both", () => {
  const prev = [{ cardId: "official_1", name: "Same" }];
  const next = [{ cardId: "official_2", name: "Same" }];
  assert.equal(mergeAppendedCards(prev, next).length, 2);
});

test("append without stable id marks identityFallback", () => {
  const prev: Array<{ name: string; _identityFallback?: boolean }> = [];
  const next: Array<{ name: string; _identityFallback?: boolean }> = [{ name: "AI card" }];
  const out = mergeAppendedCards(prev, next);
  assert.equal(out[0]._identityFallback, true);
  assert.equal(cardIdentity(out[0]), "name:ai card");
});
