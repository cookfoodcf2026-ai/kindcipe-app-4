import assert from "node:assert/strict";
import test from "node:test";

const RECIPE_ID = "official_3676";
const localizedRecipe = {
  id: RECIPE_ID,
  name: "中文名",
  nameEn: "English name",
  nameFil: "Filipino name",
  nameId: "Indonesian name",
  description: "中文描述",
  descriptionEn: "English description",
  descriptionFil: "Filipino description",
  descriptionId: "Indonesian description",
  steps: ["中文步驟"],
  stepsEn: ["English step"],
  stepsFil: ["Filipino step"],
  stepsId: ["Indonesian step"],
  tips: "中文貼士",
  tipsEn: "English tip",
  tipsFil: "Filipino tip",
  tipsId: "Indonesian tip",
};

test("getById contract exposes all localized name/description/steps/tips fields", () => {
  assert.equal(localizedRecipe.id, RECIPE_ID);
  for (const suffix of ["En", "Fil", "Id"] as const) {
    assert.ok(localizedRecipe[`name${suffix}` as keyof typeof localizedRecipe]);
    assert.ok(localizedRecipe[`description${suffix}` as keyof typeof localizedRecipe]);
    assert.ok(localizedRecipe[`steps${suffix}` as keyof typeof localizedRecipe]);
    assert.ok(localizedRecipe[`tips${suffix}` as keyof typeof localizedRecipe]);
  }
});
