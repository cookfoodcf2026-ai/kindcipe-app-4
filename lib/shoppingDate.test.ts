import assert from "node:assert/strict";
import test from "node:test";
import { buyDateForMeal } from "./shoppingDate";

test("future meal buys the day before", () => {
  assert.deepEqual(buyDateForMeal("2026-11-10", "2026-11-06"), {
    ok: true,
    date: "2026-11-09",
    manual: false,
  });
});

test("meal today buys today", () => {
  assert.deepEqual(buyDateForMeal("2026-11-06", "2026-11-06"), {
    ok: true,
    date: "2026-11-06",
    manual: false,
  });
});

test("past meal is blocked", () => {
  assert.deepEqual(buyDateForMeal("2026-11-04", "2026-11-06"), {
    ok: false,
    reason: "meal_past",
  });
});

test("no meal keeps manual mode", () => {
  assert.deepEqual(buyDateForMeal(null, "2026-11-06"), {
    ok: true,
    date: "2026-11-06",
    manual: true,
  });
});
