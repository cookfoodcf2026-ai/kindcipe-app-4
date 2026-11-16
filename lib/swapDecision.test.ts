import assert from "node:assert/strict";
import test from "node:test";
import {
  decideSwap,
  isAiSwapRequested,
  roleBlockedByAvoid,
  type SwapCardLike,
} from "./swapDecision";

type Card = SwapCardLike & { dishType?: string; recipeCategory?: string };

const card = (name: string, dishType: string, recipeCategory = ""): Card => ({
  name,
  dishType,
  recipeCategory,
});

const current = card("番茄炒蛋", "meat", "家常");

test("already-seen cards are never picked", () => {
  const decision = decideSwap({
    currentCard: current,
    seenNames: ["粟米肉粒", "薯仔炆雞"],
    response: { recipes: [card("粟米肉粒", "meat"), card("薯仔炆雞", "meat"), card("青椒炒肉", "meat")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "青椒炒肉");
});

test("cards already on screen are never picked", () => {
  const decision = decideSwap({
    currentCard: current,
    otherCardNames: ["蒜蓉炒菜", "白飯"],
    response: { recipes: [card("蒜蓉炒菜", "vegetable"), card("白飯", "carb"), card("蒸水蛋", "other")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "蒸水蛋");
});

test("prefers the same dishType before a similar/other category", () => {
  const decision = decideSwap({
    currentCard: current,
    response: { recipes: [card("清炒菜心", "vegetable"), card("梅菜扣肉", "meat")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "梅菜扣肉");
  assert.equal(decision.match, "same_dish_type");
});

test("accepts a similar category when no same-type candidate exists", () => {
  const decision = decideSwap({
    currentCard: card("老火例湯", "soup", "湯水"),
    response: { recipes: [card("炒青菜", "vegetable", "素菜"), card("栗子炆雞", "meat", "湯水")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "栗子炆雞");
  assert.equal(decision.match, "similar");
});

test("0 candidates returns the in-place panel, never an AI call", () => {
  const decision = decideSwap({
    currentCard: current,
    response: { status: "no_cards", recipes: [] },
  });
  assert.equal(decision.action, "panel");
  if (decision.action !== "panel") return;
  assert.ok(decision.reasons.includes("no_cards"));
  assert.ok(decision.reasons.includes("needs_relax"));
});

test("all candidates excluded still returns the panel with a reason", () => {
  const decision = decideSwap({
    currentCard: current,
    seenNames: ["粟米肉粒"],
    response: { recipes: [card("粟米肉粒", "meat")] },
  });
  assert.equal(decision.action, "panel");
  if (decision.action !== "panel") return;
  assert.ok(decision.reasons.includes("all_excluded"));
});

test("request failure returns the panel so the user can retry", () => {
  const decision = decideSwap({ currentCard: current, response: null });
  assert.equal(decision.action, "panel");
  if (decision.action !== "panel") return;
  assert.ok(decision.reasons.includes("request_failed"));
});

test("relaxRole stops preferring the original dishType but still excludes seen cards", () => {
  const decision = decideSwap({
    currentCard: card("老火例湯", "soup"),
    relaxRole: true,
    seenNames: ["冬瓜湯"],
    response: { recipes: [card("冬瓜湯", "soup"), card("炒時蔬", "vegetable")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "炒時蔬");
  assert.equal(decision.match, "similar");
});

test("role blocked by avoid does not prefer the avoided dishType", () => {
  assert.equal(roleBlockedByAvoid("seafood", ["海鮮"]), true);
  assert.equal(roleBlockedByAvoid("seafood", ["蝦"]), true);
  assert.equal(roleBlockedByAvoid("meat", ["海鮮"]), false);

  const decision = decideSwap({
    currentCard: card("清蒸魚", "seafood"),
    roleAllowed: !roleBlockedByAvoid("seafood", ["海鮮"]),
    response: { recipes: [card("清蒸魚", "seafood"), card("炒時蔬", "vegetable")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "炒時蔬");
});

test("isCandidateAllowed drops candidates whose dishType matches avoid", () => {
  const avoid = ["海鮮"];
  const decision = decideSwap({
    currentCard: card("清蒸魚", "seafood"),
    roleAllowed: false,
    isCandidateAllowed: (candidate) => !roleBlockedByAvoid(String(candidate.dishType), avoid),
    response: { recipes: [card("蒜蓉蒸蝦", "seafood"), card("炒時蔬", "vegetable")] },
  });
  assert.equal(decision.action, "swap");
  if (decision.action !== "swap") return;
  assert.equal(decision.candidate.name, "炒時蔬");
});

test("specific ingredient dislikes do not block the whole role", () => {
  assert.equal(roleBlockedByAvoid("meat", ["牛肉"]), false);
  assert.equal(roleBlockedByAvoid("seafood", ["三文魚"]), false);
});

test("decision never escalates to AI on its own", () => {
  const decisions = [
    decideSwap({ currentCard: current, response: { status: "no_cards", recipes: [] } }),
    decideSwap({ currentCard: current, response: null }),
    decideSwap({ currentCard: current, response: { recipes: [card("梅菜扣肉", "meat")] } }),
  ];
  for (const decision of decisions) {
    assert.notEqual(decision.action as string, "ai");
  }
  assert.equal(isAiSwapRequested({}), false);
  assert.equal(isAiSwapRequested({ userRequestedAi: false, aiCanGenerate: true }), false);
  assert.equal(isAiSwapRequested({ userRequestedAi: true, aiCanGenerate: false }), false);
  assert.equal(isAiSwapRequested({ userRequestedAi: true, aiCanGenerate: true }), true);
});
