export type RecipeQuality = {
  ok?: boolean;
  steps?: number;
  minSteps?: number;
  reasons?: unknown;
} | null | undefined;

export type RecipeShape = {
  name?: string;
  ingredients?: unknown[] | null;
  steps?: unknown[] | null;
  source?: string;
  tags?: string[];
  dishType?: string;
  recipeCategory?: string;
  _serverQualified?: boolean;
};

export type PhotoRecipeFailure = "quality_rejected" | "malformed_recipe" | "legacy_rejected";

export type PhotoRecipeDecision<R extends RecipeShape> =
  | { accepted: true; recipe: R & { _serverQualified: true } }
  | { accepted: false; reason: PhotoRecipeFailure; steps: number; minSteps: number };

const isDessertRecipe = (r: RecipeShape): boolean => {
  const tags = (r.tags ?? []).join(" ");
  const name = `${r.name ?? ""} ${r.dishType ?? ""} ${r.recipeCategory ?? ""}`;
  return /甜品|甜點|甜点|糖水|西米露|布甸|布丁|啫喱|慕斯|雪糕|蛋糕|蛋撻|曲奇|奶凍|糕點|dessert|sweet|pudding|cake/i.test(`${name} ${tags}`);
};

const isSoupRecipe = (r: RecipeShape): boolean => {
  const tags = (r.tags ?? []).join(" ");
  const name = `${r.name ?? ""} ${r.dishType ?? ""} ${r.recipeCategory ?? ""}`;
  return /湯|羹|soup|broth|bisque|chowder|consomm[eé]/i.test(`${name} ${tags}`);
};

// Render safety only: whatever the server qualified must still be renderable.
export function hasRenderableRecipeShape(r: RecipeShape | null | undefined): boolean {
  if (!r) return false;
  const name = String(r.name ?? "").trim();
  if (!name || name === "未命名食譜" || name.length < 2 || name.length > 50) return false;
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) return false;
  if (!Array.isArray(r.steps) || r.steps.length === 0) return false;
  return true;
}

// Legacy strict validation used by chat AI cards and unqualified library cards.
// AI mains need 5 steps, soups/desserts 4, plus at least 2 ingredients.
export function isStrictRecipeShape(r: RecipeShape | null | undefined): boolean {
  if (!r) return false;
  const name = String(r.name ?? "").trim();
  if (!name || name === "未命名食譜" || name.length < 2 || name.length > 50) return false;
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) return false;
  if (!Array.isArray(r.steps) || r.steps.length === 0) return false;
  if (r.source === "ai") {
    const minSteps = isDessertRecipe(r) || isSoupRecipe(r) ? 4 : 5;
    if (r.steps.length < minSteps || r.ingredients.length < 2) return false;
  }
  return true;
}

// Cards stamped by the server-qualified photo path bypass the chat-AI step floor,
// but must still keep their renderable shape.
export function isAcceptedRecipeShape(r: RecipeShape | null | undefined): boolean {
  if (r?._serverQualified) return hasRenderableRecipeShape(r);
  return isStrictRecipeShape(r);
}

export function decidePhotoRecipe<R extends RecipeShape>(
  recipe: R,
  quality: RecipeQuality,
): PhotoRecipeDecision<R> {
  const rawSteps = Array.isArray(recipe?.steps) ? recipe.steps.length : 0;
  const hasQuality = !!quality && typeof quality === "object";
  if (hasQuality) {
    const steps = typeof quality.steps === "number" ? quality.steps : rawSteps;
    const minSteps = typeof quality.minSteps === "number"
      ? quality.minSteps
      : isDessertRecipe(recipe) || isSoupRecipe(recipe) ? 4 : 5;
    if (quality.ok !== true) {
      return { accepted: false, reason: "quality_rejected", steps, minSteps };
    }
    if (!hasRenderableRecipeShape(recipe)) {
      return { accepted: false, reason: "malformed_recipe", steps, minSteps };
    }
    return { accepted: true, recipe: { ...recipe, _serverQualified: true } };
  }
  if (!isStrictRecipeShape(recipe)) {
    return { accepted: false, reason: "legacy_rejected", steps: rawSteps, minSteps: 0 };
  }
  return { accepted: true, recipe: { ...recipe, _serverQualified: true } };
}
