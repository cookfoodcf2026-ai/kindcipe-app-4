import { normalizeIngredientCandidates } from "./ingredientResolve";

export type IngredientL10n = { en?: string; fil?: string; id?: string };

const normalize = (s: string) => String(s ?? "").replace(/\s+/g, "").replace(/[，,。．.、()（）【】\[\]《》]/g, "").trim();

/**
 * Build a bilingual lookup over the common-ingredient dictionary.
 * Resolution order: exact (candidates) → substring (shortest match).
 */
export function buildIngredientLookup(list: any[]) {
  const byEn = new Map<string, IngredientL10n>();
  const byName = new Map<string, IngredientL10n>();
  for (const ing of list ?? []) {
    const rec: IngredientL10n = { en: ing?.nameEn ?? undefined, fil: ing?.nameFil ?? undefined, id: ing?.nameId ?? undefined };
    if (ing?.nameEn) byEn.set(String(ing.nameEn).toLowerCase(), rec);
    if (ing?.nameZh) byName.set(normalize(ing.nameZh), rec);
    if (ing?.nameYue) byName.set(normalize(ing.nameYue), rec);
  }
  const byNameSorted = [...byName.entries()].sort((a, b) => b[0].length - a[0].length);

  const resolveByChinese = (q: string): IngredientL10n | undefined => {
    if (!q) return undefined;
    // 1) normalised candidates (handles prefixes / parens / splits / qualifiers)
    for (const cand of normalizeIngredientCandidates(q)) {
      const hit = byName.get(normalize(cand));
      if (hit) return hit;
    }
    // 2) substring fallback (shortest containing key wins)
    const nq = normalize(q);
    let best: IngredientL10n | undefined;
    let bestLen = Infinity;
    for (const [k, rec] of byNameSorted) {
      if (k.length < 2) continue;
      if (nq.includes(k) || k.includes(nq)) {
        if (k.length < bestLen) {
          best = rec;
          bestLen = k.length;
        }
      }
    }
    return best;
  };

  const resolveByEn = (q: string): IngredientL10n | undefined => (q ? byEn.get(String(q).toLowerCase()) : undefined);

  /** Resolve using a stored item (name + optional nameEn). */
  const resolveItem = (name: string, nameEn?: string | null): IngredientL10n | undefined =>
    (nameEn ? resolveByEn(nameEn) : undefined) || resolveByChinese(name);

  return { resolveByEn, resolveByChinese, resolveItem };
}

export type IngredientLookup = ReturnType<typeof buildIngredientLookup>;
