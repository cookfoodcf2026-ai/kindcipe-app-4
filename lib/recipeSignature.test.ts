import { ingredientsSignature } from "./recipeSignature";

describe("ingredientsSignature", () => {
  it("differs when the same-named recipe has different ingredients", () => {
    expect(ingredientsSignature(["番茄", "雞蛋"])).not.toBe(
      ingredientsSignature(["番茄", "豆腐"])
    );
  });

  it("is order-insensitive and ignores spacing/case", () => {
    expect(ingredientsSignature(["番茄", "雞蛋"])).toBe(
      ingredientsSignature([" 雞蛋 ", "番茄"])
    );
    expect(ingredientsSignature(["Tomato", "Egg"])).toBe(
      ingredientsSignature(["egg", " tomato "])
    );
  });
});
