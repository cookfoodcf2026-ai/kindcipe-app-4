import {
  buildDraftIdSet,
  buildDraftOnlyList,
  draftBannerAction,
  rawRecipeId,
  selectRecipesForMineSub,
} from "./draftRecipes";

const drafts = [
  { id: 11, name: "Draft 11", isDraft: true, tags: [] },
  { id: "22", name: "Draft 22", isDraft: true, tags: [] },
  { id: "user_33", name: "Draft 33", isDraft: true, tags: [] },
];

const mixedRecipes = [
  { id: "user_11", name: "Draft 11", isDraft: true },
  { id: "user_22", name: "Draft 22", isDraft: true },
  { id: "user_33", name: "Draft 33", isDraft: true },
  { id: "user_44", name: "Finished 44", isDraft: false },
  { id: "user_55", name: "Finished 55", isDraft: false },
  { id: "official_66", name: "Official 66" },
];

describe("Home unfinished banner filter", () => {
  it("shows only draft ids and the visible count equals the banner count after pressing the banner", () => {
    const bannerCount = drafts.length;
    const action = draftBannerAction(bannerCount);
    const visible = selectRecipesForMineSub(action.mineSub, drafts, mixedRecipes);

    expect(action.applyDraftFilter).toBe(true);
    expect(visible).toHaveLength(bannerCount);

    const visibleIds = new Set(visible.map((recipe) => rawRecipeId(recipe.id)));
    const draftIds = buildDraftIdSet(drafts);
    expect(visibleIds).toEqual(draftIds);
    expect(visible.every((recipe) => recipe.isDraft === true)).toBe(true);
  });

  it("does not apply the filter and returns the normal list when there are zero drafts", () => {
    const action = draftBannerAction(0);
    const visible = selectRecipesForMineSub(action.mineSub, [], mixedRecipes);

    expect(action.applyDraftFilter).toBe(false);
    expect(action.mineSub).toBe("all");
    expect(visible).toEqual(mixedRecipes);
  });

  it("keeps every draft in the list even if the search page is missing some of them", () => {
    const visible = buildDraftOnlyList(drafts);

    expect(visible.map((recipe) => recipe.id)).toEqual([
      "user_11",
      "user_22",
      "user_33",
    ]);
    expect(visible.every((recipe) => recipe.isDraft)).toBe(true);
    expect(visible.every((recipe) => recipe.source === "custom")).toBe(true);
  });
});
