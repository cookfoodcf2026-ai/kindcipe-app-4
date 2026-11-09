/**
 * Gate for the "✨ 補齊做法（AI 建議）" action.
 *
 * A recipe needs AI filling when it has ingredients but its steps are missing
 * OR too few to be a usable recipe (1–2 junk steps are a known import case).
 * `steps_incomplete` lets the backend flag recipes that need review even when
 * they already carry three or more steps.
 */
export const AI_FILL_STEPS_MIN_COUNT = 3;

export type AiFillStepsGateInput = {
  isUserRecipe: boolean;
  ingredientCount: number;
  stepCount: number;
  stepsIncomplete?: boolean;
};

export function shouldOfferAiFillSteps({
  isUserRecipe,
  ingredientCount,
  stepCount,
  stepsIncomplete,
}: AiFillStepsGateInput): boolean {
  if (!isUserRecipe) return false;
  if (ingredientCount <= 0) return false;
  if (stepsIncomplete === true) return true;
  return stepCount < AI_FILL_STEPS_MIN_COUNT;
}
