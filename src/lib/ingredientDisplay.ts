import { enumT } from "@/lib/i18nEnums";

const EMPTY_MARKERS = new Set(["/", "-", "null", "undefined", "n/a"]);

const EM_DASH = "—";

function cleanValue(value?: string | number): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return EMPTY_MARKERS.has(raw.toLowerCase()) ? "" : raw;
}

export function normalizeDisplayUnit(unit?: string): string {
  return cleanValue(unit);
}

export function formatIngredientDisplay(
  quantity?: string | number,
  unit?: string,
  quantityStatus?: "exact" | "estimated" | string,
): string {
  const approx = String(quantityStatus ?? "") === "estimated";
  const body = formatIngredientBody(quantity, unit);
  return approx && body !== EM_DASH ? `≈ ${body}` : body;
}

function formatIngredientBody(quantity?: string | number, unit?: string): string {
  const qtyRaw = cleanValue(quantity);
  const unitRaw = cleanValue(unit);
  // 描述型量詞（適量/少許/适量…）落喺 quantity 或 unit → 一律本地化為單位字
  const DESC_RE = /^(適量|适量|少許|少许|少量|酌量|隨意|随意|適量調味|适量调味|少許調味|少许调味|適量即可|to taste|pinch)$/;
  if (qtyRaw && DESC_RE.test(qtyRaw) && !unitRaw) return enumT.qty(qtyRaw);
  if (unitRaw && DESC_RE.test(unitRaw)) return enumT.qty(unitRaw);
  const qty = qtyRaw ? enumT.qty(qtyRaw) : "";
  // 數量 > 1 → 用複數單位（英文 "3 blocks" 而唔係 "3 block"）；其他語言 fallback 單數
  const isPlural = (() => {
    const m = qtyRaw.match(/\d+(?:\.\d+)?/);
    if (!m) return false;
    return Number(m[0]) > 1;
  })();
  const unitOut = unitRaw ? (isPlural ? enumT.unitPlural(unitRaw) : enumT.unit(unitRaw)) : "";
  if (!qty && !unitOut) return EM_DASH;
  if (!qty) return unitOut;
  if (!unitOut) return qty;
  return `${qty} ${unitOut}`.trim();
}
