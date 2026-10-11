import { enumT } from "@/lib/i18nEnums";

export function normalizeDisplayUnit(unit?: string): string {
  const u = String(unit ?? "").trim();
  if (!u) return "";
  return u;
}

export function formatIngredientDisplay(quantity?: string | number, unit?: string): string {
  const qty = String(quantity ?? "").trim();
  const normalizedUnit = normalizeDisplayUnit(unit);
  if (!qty && !normalizedUnit) return "";
  if (!qty) return enumT.unit(normalizedUnit);
  if (!normalizedUnit) return qty;
  // 適量/少許 → 本地化（"to taste"…）
  if (normalizedUnit === "適量" || normalizedUnit === "少許") return enumT.unit(normalizedUnit);
  return `${qty}${enumT.unit(normalizedUnit)}`;
}
