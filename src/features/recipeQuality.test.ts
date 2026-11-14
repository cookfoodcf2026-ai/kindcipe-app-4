import assert from "node:assert/strict";
import test from "node:test";
import {
  decidePhotoRecipe,
  hasRenderableRecipeShape,
  isAcceptedRecipeShape,
  isStrictRecipeShape,
} from "./recipeQuality";

const recipe = (overrides: Record<string, unknown> = {}) => ({
  name: "番茄炒蛋",
  source: "ai",
  ingredients: [{ name: "番茄" }, { name: "雞蛋" }],
  steps: ["切番茄", "打蛋", "炒熟", "上碟", "完成"],
  ...overrides,
});

test("quality.ok true accepts a 3-step main and stamps _serverQualified", () => {
  const decision = decidePhotoRecipe(
    recipe({ steps: ["切番茄", "打蛋", "炒熟"] }),
    { ok: true, steps: 3, minSteps: 3 },
  );
  assert.equal(decision.accepted, true);
  if (!decision.accepted) return;
  assert.equal(decision.recipe._serverQualified, true);
  assert.equal(isAcceptedRecipeShape(decision.recipe), true);
});

test("quality.ok false rejects even a complete 5-step recipe", () => {
  const decision = decidePhotoRecipe(recipe(), { ok: false, steps: 3, minSteps: 5 });
  assert.equal(decision.accepted, false);
  if (decision.accepted) return;
  assert.equal(decision.reason, "quality_rejected");
  assert.equal(decision.steps, 3);
  assert.equal(decision.minSteps, 5);
});

test("no quality falls back to the legacy strict step floor", () => {
  const threeSteps = decidePhotoRecipe(recipe({ steps: ["一", "二", "三"] }), undefined);
  assert.equal(threeSteps.accepted, false);
  if (!threeSteps.accepted) assert.equal(threeSteps.reason, "legacy_rejected");

  const fiveSteps = decidePhotoRecipe(recipe(), null);
  assert.equal(fiveSteps.accepted, true);
});

test("legacy fallback still allows 4-step soup/dessert but not 3-step", () => {
  const soup = recipe({ name: "番茄湯", steps: ["一", "二", "三", "四"] });
  assert.equal(isStrictRecipeShape(soup), true);
  assert.equal(isStrictRecipeShape(recipe({ name: "番茄湯", steps: ["一", "二", "三"] })), false);
});

test("server-qualified recipes still need a renderable shape", () => {
  assert.equal(hasRenderableRecipeShape(recipe({ ingredients: [] })), false);
  assert.equal(hasRenderableRecipeShape(recipe({ steps: [] })), false);
  assert.equal(hasRenderableRecipeShape(recipe({ name: "" })), false);
  assert.equal(hasRenderableRecipeShape(recipe({ name: "未命名食譜" })), false);

  const decision = decidePhotoRecipe(recipe({ ingredients: [] }), { ok: true });
  assert.equal(decision.accepted, false);
  if (!decision.accepted) assert.equal(decision.reason, "malformed_recipe");
});

test("chat cards without the marker keep the strict 5/4-step rule", () => {
  const chatCard = { ...recipe({ steps: ["一", "二", "三"] }), _serverQualified: undefined };
  assert.equal(chatCard._serverQualified, undefined);
  assert.equal(isAcceptedRecipeShape(chatCard), false);
  assert.equal(isAcceptedRecipeShape({ ...chatCard, _serverQualified: true }), true);
});
