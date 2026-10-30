export type ImportIngredient = {
  id?: string;
  name: string;
  nameEn?: string;
  quantity?: string;
  unit?: string;
};

const NAME_ALIASES: Record<string, string> = {
  "大番薯": "番薯",
  "甜薯": "番薯",
  "番薯": "番薯",
  "紅薯": "番薯",
  "红薯": "番薯",
  "地瓜": "番薯",
  "蕃薯": "番薯",
};

const SUMMARY_RE = /(?:配料|配菜|裝飾|点缀|點綴|toppings?|garnish|assorted)/i;
const SUMMARY_QTY_RE = /^(?:適量|适量|少許|少许|少量|酌量|隨意|随意|to taste|as needed)$/i;

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s，。、；：！？,.;:!?（）()「」『』\-—…]/g, "");
}

function normEn(value: unknown): string {
  return norm(value).replace(/s$/, "");
}

function canonicalZh(name: string): string {
  const key = norm(name);
  return NAME_ALIASES[key] ?? String(name ?? "").trim();
}

export function ingredientKeys(ingredient: ImportIngredient): string[] {
  const keys = new Set<string>();
  const en = normEn(ingredient.nameEn);
  if (en) keys.add(`en:${en}`);
  const zh = canonicalZh(ingredient.name);
  if (zh) keys.add(`zh:${norm(zh)}`);
  return [...keys];
}

export function isIngredientSummary(ingredient: ImportIngredient): boolean {
  const name = String(ingredient.name ?? "").trim();
  const quantity = String(ingredient.quantity ?? "").trim();
  return SUMMARY_RE.test(name) && SUMMARY_QTY_RE.test(quantity);
}

function matches(a: ImportIngredient, b: ImportIngredient): boolean {
  const aKeys = ingredientKeys(a);
  return aKeys.some((key) => ingredientKeys(b).includes(key));
}

/**
 * Caption parse is the source of truth. Supplement/OCR ingredients are appended
 * only when no canonical key matches; quantities are never summed.
 */
export function mergeImportedIngredients(
  current: ImportIngredient[],
  incoming: ImportIngredient[],
  log: (message: string, detail: Record<string, unknown>) => void = console.log,
): ImportIngredient[] {
  const merged = current.map((ing) => ({ ...ing }));
  for (const next of incoming) {
    if (isIngredientSummary(next) && merged.filter((ing) => !isIngredientSummary(ing)).length >= 2) {
      log("ingredient_summary_dropped", { name: next.name, quantity: next.quantity, remaining: merged.length });
      continue;
    }
    const hit = merged.find((ing) => matches(ing, next));
    if (!hit) {
      merged.push({ ...next, id: next.id || `ing_m${Date.now()}_${merged.length}` });
      continue;
    }
    if (!hit.quantity && next.quantity) hit.quantity = next.quantity;
    if (!hit.unit && next.unit) hit.unit = next.unit;
    if (!hit.nameEn && next.nameEn) hit.nameEn = next.nameEn;
    // 保留 caption 版名稱（唔改寫用戶見到嘅字），canonical 只用嚟做 match key。
  }
  return merged;
}
