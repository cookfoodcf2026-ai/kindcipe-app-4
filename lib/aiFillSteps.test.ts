import { shouldOfferAiFillSteps } from "./aiFillSteps";

describe("AI fill-steps gate", () => {
  it("offers AI filling for a user recipe with one junk step", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: true,
        ingredientCount: 2,
        stepCount: 1,
      }),
    ).toBe(true);
  });

  it("offers AI filling for a user recipe with zero steps", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: true,
        ingredientCount: 3,
        stepCount: 0,
      }),
    ).toBe(true);
  });

  it("offers AI filling when the backend marks steps_incomplete", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: true,
        ingredientCount: 3,
        stepCount: 5,
        stepsIncomplete: true,
      }),
    ).toBe(true);
  });

  it("does not offer when there are no ingredients", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: true,
        ingredientCount: 0,
        stepCount: 1,
      }),
    ).toBe(false);
  });

  it("does not offer for non-user recipes", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: false,
        ingredientCount: 3,
        stepCount: 0,
      }),
    ).toBe(false);
  });

  it("does not offer once a user recipe has three steps", () => {
    expect(
      shouldOfferAiFillSteps({
        isUserRecipe: true,
        ingredientCount: 3,
        stepCount: 3,
        stepsIncomplete: false,
      }),
    ).toBe(false);
  });
});
