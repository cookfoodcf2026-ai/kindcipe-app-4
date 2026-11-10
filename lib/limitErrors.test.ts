import {
  formatLimitUsage,
  limitPaywallFeature,
  parsePlanError,
  summarizeMealPlanBatch,
} from "./limitErrors";

describe("parsePlanError", () => {
  it("maps a PRO_REQUIRED cause", () => {
    const err = {
      message: "PRO_REQUIRED: KOL recipes need Pro",
      data: { code: "FORBIDDEN", cause: { code: "PRO_REQUIRED", feature: "kol_plan" } },
    };

    expect(parsePlanError(err)).toEqual({ kind: "pro_required", feature: "kol_plan" });
  });

  it("maps a LIMIT_REACHED cause with feature, limit and used", () => {
    const err = {
      message: "LIMIT_REACHED: imports",
      data: {
        code: "FORBIDDEN",
        cause: { code: "LIMIT_REACHED", feature: "imports", limit: 5, used: 8 },
      },
    };

    const parsed = parsePlanError(err);
    expect(parsed).toEqual({
      kind: "limit_reached",
      feature: "imports",
      limit: 5,
      used: 8,
    });
    expect(formatLimitUsage(parsed)).toBe("8/5");
    expect(limitPaywallFeature(parsed)).toBe("import_limit");
  });

  it("reads cause from the legacy shape.data.cause position", () => {
    const err = {
      message: "nope",
      shape: {
        data: {
          code: "FORBIDDEN",
          cause: { code: "LIMIT_REACHED", feature: "custom_recipes", limit: 20, used: 20 },
        },
      },
    };

    expect(parsePlanError(err)).toMatchObject({
      kind: "limit_reached",
      feature: "custom_recipes",
      limit: 20,
      used: 20,
    });
    expect(limitPaywallFeature(parsePlanError(err))).toBe("recipe_limit");
  });

  it("falls back to the message prefix when no cause is present", () => {
    expect(parsePlanError({ message: "PRO_REQUIRED: kol plan" })).toEqual({
      kind: "pro_required",
      feature: "kol_plan",
    });
    expect(parsePlanError({ message: "LIMIT_REACHED: imports" }).kind).toBe("limit_reached");
  });

  it("returns other for unrelated errors", () => {
    expect(parsePlanError(new Error("network down"))).toEqual({ kind: "other" });
    expect(parsePlanError(null)).toEqual({ kind: "other" });
    expect(parsePlanError({ message: "FORBIDDEN" })).toEqual({ kind: "other" });
  });
});

describe("summarizeMealPlanBatch", () => {
  it("counts one pro_required item separately from added items", () => {
    const summary = summarizeMealPlanBatch(
      {
        count: 2,
        items: [
          { ok: true, skipped: false, newPlanId: 1, recipeId: "official_1" },
          { ok: false, skipped: true, reason: "pro_required" },
          { ok: true, skipped: false, newPlanId: 2, recipeId: "official_2" },
        ],
      },
      3,
    );

    expect(summary).toEqual({ added: 2, proRequired: 1, skipped: 1, total: 3 });
  });

  it("falls back to the server count when there is no item breakdown", () => {
    expect(summarizeMealPlanBatch({ count: 4 }, 4)).toEqual({
      added: 4,
      proRequired: 0,
      skipped: 0,
      total: 4,
    });
  });
});
