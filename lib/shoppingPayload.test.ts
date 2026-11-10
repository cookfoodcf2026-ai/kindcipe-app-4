import {
  applyPlannedDateToCachedItems,
  buildShoppingBatchPayload,
  withItemPlannedDate,
} from "./shoppingPayload";
import { buyDateForMeal } from "./shoppingDate";

const confirmedItems = [
  {
    recipeId: "user_1",
    recipeName: "番茄炒蛋",
    name: "番茄",
    quantity: "2",
    unit: "個",
    category: "蔬菜",
    plannedDate: "2026-11-09",
    fromMealPlanId: 42,
  },
  {
    recipeId: "user_1",
    recipeName: "番茄炒蛋",
    name: "雞蛋",
    quantity: "3",
    unit: "隻",
    category: "蛋奶",
    plannedDate: "2026-11-09",
    fromMealPlanId: 42,
  },
];

describe("buildShoppingBatchPayload", () => {
  it("sends the picked buy date, not the meal date", () => {
    const payload = buildShoppingBatchPayload({
      items: confirmedItems,
      pickedDate: "2026-11-10",
      mealDate: "2026-11-11",
      today: "2026-11-09",
      fromRecipeId: "user_1",
      fromRecipeName: "番茄炒蛋",
      fromMealPlanId: 42,
    });

    expect(payload.plannedDate).toBe("2026-11-10");
    expect(payload.plannedDate).not.toBe("2026-11-11");
    expect(payload.items.map((item) => item.plannedDate)).toEqual(["2026-11-10", "2026-11-10"]);
    expect(payload.items[0]).toMatchObject({
      name: "番茄",
      fromRecipeId: "user_1",
      fromRecipeName: "番茄炒蛋",
      fromMealPlanId: 42,
    });
    expect(payload.fromRecipeId).toBe("user_1");
    expect(payload.fromMealPlanId).toBe(42);
  });

  it("stamps the picked date on every item even when item dates differ", () => {
    const payload = buildShoppingBatchPayload({
      items: [
        { ...confirmedItems[0], plannedDate: "2026-11-07" },
        { ...confirmedItems[1], plannedDate: "2026-11-09" },
      ],
      pickedDate: "2026-11-08",
      mealDate: "2026-11-11",
      today: "2026-11-09",
    });

    expect(payload.items.map((item) => item.plannedDate)).toEqual(["2026-11-08", "2026-11-08"]);
  });

  it("falls back to buyDateForMeal when no date is picked and never to undefined", () => {
    const expected = buyDateForMeal("2026-11-11", "2026-11-09");
    const payload = buildShoppingBatchPayload({
      items: confirmedItems,
      pickedDate: null,
      mealDate: "2026-11-11",
      today: "2026-11-09",
    });

    expect(expected.ok && expected.date).toBe("2026-11-10");
    expect(payload.plannedDate).toBe("2026-11-10");
    expect(payload.plannedDate).toBeDefined();
    expect(payload.items.every((item) => item.plannedDate === "2026-11-10")).toBe(true);
  });

  it("falls back to today when neither a picked date nor a meal date exists", () => {
    const payload = buildShoppingBatchPayload({
      items: [{ name: "鹽", quantity: "1", unit: "茶匙", category: "調味料" }],
      pickedDate: undefined,
      mealDate: undefined,
      today: "2026-11-09",
    });

    expect(payload.plannedDate).toBe("2026-11-09");
    expect(payload.items[0].plannedDate).toBe("2026-11-09");
  });
});

describe("withItemPlannedDate", () => {
  it("adds the resolved date to every item", () => {
    const items = withItemPlannedDate([{ name: "番茄" }, { name: "雞蛋" }], "2026-11-08");
    expect(items.map((item) => item.plannedDate)).toEqual(["2026-11-08", "2026-11-08"]);
  });

  it("does not mutate the input items", () => {
    const input = [{ name: "番茄" }];
    const items = withItemPlannedDate(input, "2026-11-08");
    expect(items[0]).not.toBe(input[0]);
    expect(input[0]).not.toHaveProperty("plannedDate");
  });
});

describe("applyPlannedDateToCachedItems", () => {
  it("only updates cached rows whose names were confirmed", () => {
    const cache = [
      { id: "1", name: "番茄", plannedDate: "2026-11-11" },
      { id: "2", name: "牛肉", plannedDate: "2026-11-11" },
    ];

    const patched = applyPlannedDateToCachedItems(cache, ["番茄"], "2026-11-08");

    expect(patched?.[0].plannedDate).toBe("2026-11-08");
    expect(patched?.[1].plannedDate).toBe("2026-11-11");
  });

  it("returns the cache unchanged when there is no date or cache", () => {
    const cache = [{ id: "1", name: "番茄", plannedDate: "2026-11-11" }];
    expect(applyPlannedDateToCachedItems(cache, ["番茄"], undefined)).toEqual(cache);
    expect(applyPlannedDateToCachedItems(undefined, ["番茄"], "2026-11-08")).toBeUndefined();
  });
});
