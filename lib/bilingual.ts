import i18n from "./i18n";

// 按裝置語言回傳「主名 + 次名」，直接俾 UI 顯示：
//   zh-TW → 主=中文，次=英文
//   en    → 主=英文，次=（無）
//   fil   → 主=英文（冇就菲/中），次=菲律賓文
//   id    → 主=英文（冇就印尼/中），次=印尼文
// 次名同主名一樣 / 空 → 唔回傳（上層唔顯示）。
export function getBilingualName(
  name?: string | null,
  nameEn?: string | null,
  nameFil?: string | null,
  nameId?: string | null,
): { primary: string; secondary: string } {
  const zh = String(name ?? "").trim();
  const en = String(nameEn ?? "").trim();
  const fil = String(nameFil ?? "").trim();
  const id = String(nameId ?? "").trim();
  const lang = i18n.language;

  if (lang === "fil") {
    const primary = en || fil || zh;
    const secondary = primary !== fil ? fil : "";
    return { primary, secondary: secondary && secondary !== primary ? secondary : "" };
  }
  if (lang === "id") {
    const primary = en || id || zh;
    const secondary = primary !== id ? id : "";
    return { primary, secondary: secondary && secondary !== primary ? secondary : "" };
  }
  if (lang === "en") {
    return { primary: en || zh, secondary: "" };
  }
  // 中文（zh-TW / 其他）
  return { primary: zh, secondary: en };
}

// 舊 helper：淨係次要名（部分地方用嚟顯示「中文大 + 目標語言細」）
export function getLocalizedSecondaryName(
  name?: string | null,
  nameEn?: string | null,
  nameFil?: string | null,
  nameId?: string | null,
): string {
  const lang = i18n.language;
  const pick = lang === "id" ? nameId : lang === "fil" ? nameFil : nameEn;
  const secondary = pick || nameEn || "";
  if (!secondary) return "";
  return String(secondary).trim();
}

// 按裝置語言揀食譜簡介：FIL→菲、ID→印尼、en→英文、zh→中文；fallback 鏈
export function getLocalizedDescription(
  description?: string | null,
  descriptionEn?: string | null,
  descriptionFil?: string | null,
  descriptionId?: string | null,
): string {
  const zh = String(description ?? "").trim();
  const en = String(descriptionEn ?? "").trim();
  const fil = String(descriptionFil ?? "").trim();
  const id = String(descriptionId ?? "").trim();
  const lang = i18n.language;
  if (lang === "fil") return fil || en || zh;
  if (lang === "id") return id || en || zh;
  if (lang === "en") return en || zh;
  return zh;
}

// 按裝置語言揀步驟（做法）：FIL→菲步驟、ID→印尼、en→英文、zh→中文；fallback 鏈
// 防禦：只接受 array（避免 DB 未 parse 嘅 JSON 字串導致 .map 爆）
export function getLocalizedSteps(
  steps?: string[] | null,
  stepsEn?: string[] | null,
  stepsFil?: string[] | null,
  stepsId?: string[] | null,
): string[] {
  const arr = (v: any): string[] | undefined => (Array.isArray(v) ? v : undefined);
  const lang = i18n.language;
  let pick: string[] | undefined;
  if (lang === "fil") pick = arr(stepsFil)?.length ? arr(stepsFil) : arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else if (lang === "id") pick = arr(stepsId)?.length ? arr(stepsId) : arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else if (lang === "en") pick = arr(stepsEn)?.length ? arr(stepsEn) : arr(steps);
  else pick = arr(steps);
  return pick ?? arr(steps) ?? [];
}
