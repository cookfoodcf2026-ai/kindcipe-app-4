export type TipFields = {
  tips?: string | null;
  housewifeTips?: string | null;
  tipsEn?: string | null;
  tips_en?: string | null;
  tipsFil?: string | null;
  tips_fil?: string | null;
  tipsId?: string | null;
  tips_id?: string | null;
};

export type LocalizedTip = {
  text: string;
  isOriginal: boolean;
};

const clean = (value?: string | null): string => String(value ?? "").trim();

export function getLocalizedTip(lang: string | undefined, recipe?: TipFields | null): LocalizedTip {
  const source = clean(recipe?.tips ?? recipe?.housewifeTips);
  const en = clean(recipe?.tipsEn ?? recipe?.tips_en);
  const fil = clean(recipe?.tipsFil ?? recipe?.tips_fil);
  const id = clean(recipe?.tipsId ?? recipe?.tips_id);
  const normalized = String(lang ?? "").toLowerCase();
  const base = normalized.startsWith("fil")
    ? "fil"
    : normalized.startsWith("id")
      ? "id"
      : normalized.startsWith("en")
        ? "en"
        : "zh";

  if (base === "zh") return { text: source, isOriginal: false };
  if (base === "en") return en ? { text: en, isOriginal: false } : { text: source, isOriginal: !!source };
  if (base === "fil") {
    if (fil) return { text: fil, isOriginal: false };
    if (en) return { text: en, isOriginal: false };
    return { text: source, isOriginal: !!source };
  }
  if (id) return { text: id, isOriginal: false };
  if (en) return { text: en, isOriginal: false };
  return { text: source, isOriginal: !!source };
}
