import i18n from "./i18n";
import { pickName, pickDescription, pickSteps } from "./bilingualCore";

// 按裝置語言回傳「主名 + 次名」，直接俾 UI 顯示。
// 核心邏輯喺 bilingualCore（可單元測試）；呢度只負責注入當前 i18n.language。
export function getBilingualName(
  name?: string | null,
  nameEn?: string | null,
  nameFil?: string | null,
  nameId?: string | null,
): { primary: string; secondary: string } {
  return pickName(i18n.language, name, nameEn, nameFil, nameId);
}

// 舊 helper：淨係次要名（部分地方用嚟顯示「中文大 + 目標語言細」）
export function getLocalizedSecondaryName(
  name?: string | null,
  nameEn?: string | null,
  nameFil?: string | null,
  nameId?: string | null,
): string {
  return pickName(i18n.language, name, nameEn, nameFil, nameId).secondary;
}

// 按裝置語言揀食譜簡介
export function getLocalizedDescription(
  description?: string | null,
  descriptionEn?: string | null,
  descriptionFil?: string | null,
  descriptionId?: string | null,
): string {
  return pickDescription(i18n.language, description, descriptionEn, descriptionFil, descriptionId);
}

// 按裝置語言揀步驟（做法）
export function getLocalizedSteps(
  steps?: string[] | null,
  stepsEn?: string[] | null,
  stepsFil?: string[] | null,
  stepsId?: string[] | null,
): string[] {
  return pickSteps(i18n.language, steps, stepsEn, stepsFil, stepsId);
}
