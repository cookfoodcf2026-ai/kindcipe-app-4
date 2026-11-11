import { categorizeIngredient } from "@/constants/ingredients";

describe("categorizeIngredient", () => {
  it.each([
    ["chicken thigh", "肉類"],
    ["chicken breast", "肉類"],
    ["chicken wing", "肉類"],
    ["pork belly", "肉類"],
    ["pork ribs", "肉類"],
    ["beef", "肉類"],
    ["lamb", "肉類"],
    ["salmon", "海鮮"],
    ["prawn", "海鮮"],
    ["shrimp", "海鮮"],
    ["crab", "海鮮"],
    ["scallop", "海鮮"],
    ["oyster", "海鮮"],
    ["egg", "蛋奶"],
    ["milk", "蛋奶"],
    ["cheese", "蛋奶"],
    ["butter", "蛋奶"],
    ["garlic", "蔬菜"],
    ["onion", "蔬菜"],
    ["spring onion", "蔬菜"],
    ["tomato", "蔬菜"],
    ["broccoli", "蔬菜"],
    ["bok choy", "蔬菜"],
    ["carrot", "蔬菜"],
    ["potato", "蔬菜"],
    ["rice", "主食"],
    ["noodle", "主食"],
    ["vermicelli", "主食"],
    ["bread", "主食"],
    ["soy sauce", "調味料"],
    ["oyster sauce", "調味料"],
    ["salt", "調味料"],
    ["sugar", "調味料"],
    ["sesame oil", "調味料"],
  ])("categorises %s as %s", (name, category) => {
    expect(categorizeIngredient(name)).toBe(category);
  });

  it("is case-insensitive and handles plurals", () => {
    expect(categorizeIngredient("Chicken Thighs")).toBe("肉類");
    expect(categorizeIngredient("Prawns")).toBe("海鮮");
  });

  it.each([
    ["chicken of the woods", "肉類"],
    ["oyster mushroom", "海鮮"],
    ["eggplant", "蛋奶"],
    ["coconut milk", "蛋奶"],
    ["water chestnut", "海鮮"],
  ])("does not false-positive %s as %s", (name, wrongCategory) => {
    expect(categorizeIngredient(name)).not.toBe(wrongCategory);
  });

  it("keeps plain water out of the food categories", () => {
    expect(categorizeIngredient("water")).toBe("其他");
  });

  it("classifies fish sauce as seasoning rather than seafood", () => {
    expect(categorizeIngredient("fish sauce")).toBe("調味料");
  });

  it.each([
    ["雞胸", "肉類"],
    ["西蘭花", "蔬菜"],
    ["三文魚", "海鮮"],
    ["芝士", "蛋奶"],
    ["白飯", "主食"],
    ["生抽", "調味料"],
    ["蓮子", "乾貨"],
  ])("keeps Chinese classification for %s as %s", (name, category) => {
    expect(categorizeIngredient(name)).toBe(category);
  });

  it("returns 其他 for an unknown English name", () => {
    expect(categorizeIngredient("unicorn tears")).toBe("其他");
  });
});
