export function normalizeDisplayUnit(unit?: string): string {
  const u = String(unit ?? "").trim();
  if (!u) return "";
  return u;
}

export function formatIngredientDisplay(quantity?: string | number, unit?: string): string {
  const qty = String(quantity ?? "").trim();
  const normalizedUnit = normalizeDisplayUnit(unit);
  if (!qty && !normalizedUnit) return "";
  if (!qty) return normalizedUnit;
  if (!normalizedUnit || normalizedUnit === "適量") return qty;
  return `${qty}${normalizedUnit}`;
}
