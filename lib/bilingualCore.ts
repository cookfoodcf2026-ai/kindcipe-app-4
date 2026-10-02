/**
 * Pure bilingual/localization pick logic (no i18n import → unit-testable).
 *
 * Fallback chain per language:
 *   zh → zh (secondary: en)
 *   en → en || zh
 *   fil → fil || en || zh (secondary: en)
 *   id  → id  || en || zh (secondary: en)
 *
 * 修正：fil/id 之前係 `en || fil || zh` → 菲/印用戶永遠見到英文。而家目標語言優先。
 */

export function pickName(
  lang: string,
  name?: string | null,
  nameEn?: string | null,
  nameFil?: string | null,
  nameId?: string | null,
): { primary: string; secondary: string } {
  const zh = String(name ?? "").trim();
  const en = String(nameEn ?? "").trim();
  const fil = String(nameFil ?? "").trim();
  const id = String(nameId ?? "").trim();

  const dedup = (primary: string, secondary: string) =>
    secondary && secondary !== primary ? secondary : "";

  if (lang === "fil") return { primary: fil || en || zh, secondary: dedup(fil || en || zh, fil ? en : "") };
  if (lang === "id") return { primary: id || en || zh, secondary: dedup(id || en || zh, id ? en : "") };
  if (lang === "en") return { primary: en || zh, secondary: "" };
  return { primary: zh, secondary: dedup(zh, en) };
}

export function pickDescription(
  lang: string,
  description?: string | null,
  descriptionEn?: string | null,
  descriptionFil?: string | null,
  descriptionId?: string | null,
): string {
  const zh = String(description ?? "").trim();
  const en = String(descriptionEn ?? "").trim();
  const fil = String(descriptionFil ?? "").trim();
  const id = String(descriptionId ?? "").trim();
  if (lang === "fil") return fil || en || zh;
  if (lang === "id") return id || en || zh;
  if (lang === "en") return en || zh;
  return zh;
}

export function pickSteps(
  lang: string,
  steps?: string[] | null,
  stepsEn?: string[] | null,
  stepsFil?: string[] | null,
  stepsId?: string[] | null,
): string[] {
  const arr = (v: any): string[] | undefined => (Array.isArray(v) ? v : undefined);
  let pick: string[] | undefined;
  if (lang === "fil") pick = arr(stepsFil)?.length ? arr(stepsFil) : arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else if (lang === "id") pick = arr(stepsId)?.length ? arr(stepsId) : arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else if (lang === "en") pick = arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else pick = arr(steps);
  return pick ?? arr(steps) ?? [];
}
