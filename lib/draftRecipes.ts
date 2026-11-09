export type MineSubFilter = "all" | "manual" | "imported" | "draft";

export function rawRecipeId(id: unknown): string {
  return String(id ?? "").replace(/^user_/, "");
}

export function buildDraftIdSet(drafts: readonly any[]): Set<string> {
  const ids = new Set<string>();
  drafts.forEach((draft) => {
    const id = rawRecipeId(draft?.id);
    if (id) ids.add(id);
  });
  return ids;
}

/**
 * The Home banner counts drafts from `recipes.listUser`. Build the exact same
 * list for the "mine / unfinished" view so the number on the banner and the
 * number of visible cards cannot disagree.
 */
export function buildDraftOnlyList(drafts: readonly any[]): any[] {
  return drafts
    .map((draft) => {
      const id = rawRecipeId(draft?.id);
      if (!id) return null;
      return {
        ...draft,
        id: `user_${id}`,
        source: draft?.source ?? "custom",
        isDraft: true,
      };
    })
    .filter((recipe): recipe is any => recipe !== null);
}

export function selectRecipesForMineSub(
  mineSub: MineSubFilter,
  drafts: readonly any[],
  recipes: readonly any[],
): any[] {
  return mineSub === "draft" ? buildDraftOnlyList(drafts) : [...recipes];
}

/** A zero-draft banner is hidden, so the filter must not be applied. */
export function draftBannerAction(draftCount: number): {
  mineSub: MineSubFilter;
  applyDraftFilter: boolean;
} {
  return draftCount > 0
    ? { mineSub: "draft", applyDraftFilter: true }
    : { mineSub: "all", applyDraftFilter: false };
}
