import { categorizeIngredient } from "@/constants/ingredients";

export type SanitizableIngredient = {
  name?: unknown;
  nameEn?: unknown;
  nameFil?: unknown;
  nameId?: unknown;
  quantity?: unknown;
  unit?: unknown;
  category?: unknown;
};

export type SanitizedIngredient = {
  name: string;
  nameEn?: string;
  nameFil?: string;
  nameId?: string;
  quantity: string;
  unit: string;
  category: string;
};

const PLACEHOLDER_NAMES = new Set([
  "適量", "少許", "些許", "若干", "適宜", "適當", "隨意", "視乎口味", "依個人喜好",
  "各", "各適量", "每樣", "各樣", "各式各樣", "其他", "食材", "材料", "原料", "配料",
  "調味料", "醃料", "醬汁", "湯底", "湯料", "主料", "主材料", "餸料",
]);

const PREP_NOTES = new Set([
  "切片", "切絲", "切碎", "切段", "切粒", "切塊", "切件", "切條", "切丁", "切末", "切花",
  "去皮", "去核", "去籽", "去骨", "洗淨", "洗乾淨", "瀝乾", "瀝水", "備用", "打散", "拌勻",
  "過篩", "解凍", "浸泡", "泡發", "拍扁", "剁碎", "氽水", "汆水", "焯水", "飛水", "醃製",
  "醃好", "調味", "裝飾", "伴碟", "切", "洗", "剝", "刨", "壓", "搗",
]);

const UNITS = [
  "克", "千克", "公斤", "毫升", "公升", "升", "斤", "兩", "磅", "安士",
  "茶匙", "湯匙", "大匙", "小匙", "匙", "杯", "碗", "碟", "勺", "小撮", "撮",
  "個", "隻", "條", "片", "塊", "支", "根", "包", "盒", "罐", "粒", "顆", "瓣", "棵", "紮",
  "份", "副", "角", "串", "張", "朵", "束", "把", "粒", "球", "圈", "cm", "mm", "g", "kg", "ml", "l",
].sort((a, b) => b.length - a.length);

const UNIT_PATTERN = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const QTY_PATTERN = String.raw`(?:\d+(?:\.\d+)?(?:\s*[-~至到]\s*\d+(?:\.\d+)?)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)`;
const APPROX_PATTERN = String.raw`(?:約|大約|大概|近約|左右)\s*`;

const QTY_ONLY_RE = new RegExp(`^${APPROX_PATTERN}(${QTY_PATTERN})\\s*(${UNIT_PATTERN})?$`, "i");
const NAME_QTY_RE = new RegExp(`^(.+?)\\s+${APPROX_PATTERN}(${QTY_PATTERN})\\s*(${UNIT_PATTERN})?$`, "i");
const QTY_NAME_RE = new RegExp(`^${APPROX_PATTERN}(${QTY_PATTERN})\\s*(${UNIT_PATTERN})\\s*(.+)$`, "i");
const NAME_QTY_NO_SPACE_RE = new RegExp(`^(.+?)\\s*(${QTY_PATTERN})\\s*(${UNIT_PATTERN})$`, "i");
const SIMPLE_QTY_ONLY_RE = new RegExp(
  `^\\s*(?:約|大約|大概|近約|左右)?\\s*(?:\\d+(?:\\.\\d+)?(?:\\s*[-~至到]\\s*\\d+(?:\\.\\d+)?)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許)\\s*(?:${UNIT_PATTERN})?\\s*$`,
  "i",
);
const LEADING_QTY_RE = new RegExp(`^${APPROX_PATTERN}(${QTY_PATTERN})\\s*`, "i");

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/^[\s,，。．.!！？?、\-–—*•·]+|[\s,，。．.!！？?、\-–—*•·]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value: string): string =>
  value.replace(/\s+/g, "").replace(/[，,。．.、()（）【】\[\]《》]/g, "").trim();

const isPlaceholder = (name: string): boolean => {
  const n = normalizeKey(name);
  return PLACEHOLDER_NAMES.has(name) || PLACEHOLDER_NAMES.has(n);
};

const isPrepNote = (name: string): boolean => {
  const n = normalizeKey(name);
  return PREP_NOTES.has(name) || PREP_NOTES.has(n);
};

export function isUsableIngredientName(name: string): boolean {
  const n = normalizeText(name);
  if (!n) return false;
  if (isPlaceholder(n) || isPrepNote(n)) return false;
  if (SIMPLE_QTY_ONLY_RE.test(n) || QTY_ONLY_RE.test(n)) return false;
  return true;
}

export function sanitizeIngredient(ing: SanitizableIngredient): SanitizedIngredient | null {
  const rawName = normalizeText(ing?.name);
  const rawQuantity = normalizeText(ing?.quantity);
  const rawUnit = normalizeText(ing?.unit);
  if (!rawName) return null;
  if (isPlaceholder(rawName) || isPrepNote(rawName)) return null;
  if (SIMPLE_QTY_ONLY_RE.test(rawName) || QTY_ONLY_RE.test(rawName)) return null;

  let name = rawName;
  let quantity = rawQuantity;
  let unit = rawUnit;

  const leadingQty = rawName.match(LEADING_QTY_RE);
  if (leadingQty) {
    const rest = rawName.slice(leadingQty[0].length).trim();
    const leadingUnit = UNITS.find((u) => rest.startsWith(u));
    const leadingName = leadingUnit ? rest.slice(leadingUnit.length).trim() : "";
    if (leadingUnit && leadingName) {
      quantity = quantity || normalizeText(leadingQty[1]);
      unit = unit || leadingUnit;
      name = leadingName;
    }
  }

  const nameQty = rawName.match(NAME_QTY_RE);
  if (nameQty) {
    name = normalizeText(nameQty[1]);
    quantity = quantity || normalizeText(nameQty[2]);
    unit = unit || normalizeText(nameQty[3]);
  } else {
    const qtyName = rawName.match(QTY_NAME_RE);
    if (qtyName) {
      quantity = quantity || normalizeText(qtyName[1]);
      unit = unit || normalizeText(qtyName[2]);
      name = normalizeText(qtyName[3]);
    } else {
      const nameQtyNoSpace = rawName.match(NAME_QTY_NO_SPACE_RE);
      if (nameQtyNoSpace) {
        name = normalizeText(nameQtyNoSpace[1]);
        quantity = quantity || normalizeText(nameQtyNoSpace[2]);
        unit = unit || normalizeText(nameQtyNoSpace[3]);
      }
    }
  }

  const simplePrefix = rawName.match(
    /^(?:約|大約|大概|近約|左右)?\s*(\d+(?:\.\d+)?(?:\s*[-~至到]\s*\d+(?:\.\d+)?)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾)\s*(隻|個|條|片|塊|支|根|包|盒|罐|粒|顆|瓣|棵|紮|份|副|角|串|張|朵|束|把|球|圈|杯|碗|碟|勺|茶匙|湯匙|大匙|小匙|匙|小撮|撮|克|千克|公斤|毫升|公升|升|斤|磅|安士|cm|mm|g|kg|ml|l)\s*(.+)$/i,
  );
  if (simplePrefix) {
    name = normalizeText(simplePrefix[3]);
    quantity = quantity || normalizeText(simplePrefix[1]);
    unit = unit || normalizeText(simplePrefix[2]);
  }

  if (!name || isPlaceholder(name) || isPrepNote(name)) return null;
  if (SIMPLE_QTY_ONLY_RE.test(name) || QTY_ONLY_RE.test(name)) return null;

  const category = normalizeText(ing?.category) || categorizeIngredient(name);
  return {
    name,
    nameEn: normalizeText(ing?.nameEn) || undefined,
    nameFil: normalizeText(ing?.nameFil) || undefined,
    nameId: normalizeText(ing?.nameId) || undefined,
    quantity,
    unit,
    category,
  };
}

export function sanitizeIngredients(ingredients: unknown): SanitizedIngredient[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((ing) => sanitizeIngredient((ing ?? {}) as SanitizableIngredient))
    .filter((ing): ing is SanitizedIngredient => !!ing);
}
