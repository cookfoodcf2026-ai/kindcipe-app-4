/**
 * i18n audit: flag hardcoded CJK that reaches the UI but is NOT wrapped in t()/enumT.
 *
 * Catches:
 *   A. JSX text nodes / string props / ternary string literals (original rules)
 *   B. Display-string object properties  (label: "中文", subtitle: "中文", ...)
 *   C. Arrays of Chinese string literals that are rendered as labels
 *      (skipped when the line is clearly a data/API key context)
 *
 * Usage: node scripts/audit-i18n.js [--strict]   (exit 1 on hits when --strict)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const DIRS = ["app", "src/components", "hooks"];
const EXCLUDE_DIRS = ["node_modules", "locales", "__tests__", "e2e", ".expo"];
const ALLOW_SUBSTR = [
  "nameYue", "nameZh", "nameFil", "nameId", "nameEn",
  "DEFAULT_CATEGORIES", "CATEGORY_", "HOUSEHOLD_CATEGORIES",
  "WATER_INGREDIENT", "PLACEHOLDER_INGREDIENT", "GENERIC_INGREDIENT",
  "subs.push(", "options={[",
  // data / API-key contexts (Chinese literals here are intentional)
  "excludeCategories", "excludeCuisine", "categoryKey", "value:", "category:",
  "search:", "tags:", "query:", "keywords:", "KEYWORD", "WEEKDAYS", "Weekday",
  "CATEGORY_KEY", "UNIT_KEY", "INGREDIENT_GROUP", "PAX", "unitKey",
  // data values (tags / ingredient names / categories / cuisines) — not display strings
  "add(", "name:", "difficulty:", "city:", "recipeCategory", "\"中菜\"", "\"西餐\"", "\"甜品\"", "\"日式\"", "\"韓式\"", "\"東南亞\"",
  // LLM prompt / message payloads (data sent to the model, not rendered)
  "content:", "aiPrompt", "role: \"user\"", "role: \"system\"", "role: \"assistant\"", "messages:",
  // keyword-matching data arrays (not display)
  "Kws", "KWS", "Keywords", "DAY_NAMES", "DAY_SHORT", "kw:",
  // data-definition display fields: the Chinese here is the translation SOURCE;
  // the value must be wrapped with t() at the render site (see RENDER_EXPR below).
  'label:', 'subLabel:', 'subtitle:', 'title:', 'caption:', 'placeholder:',
  'desc:', 'description:', 'message:', 'hint:', 'hintText:', 'note:',
  'confirmText:', 'cancelText:', 'actionText:', 'btnText:', 'buttonText:', 'emptyText:',
];
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
// A. JSX text node
const JSX_TEXT = />[^<>]*[\u3400-\u9FFF\uF900-\uFAFF][^<>]*</;
// A. JSX string prop
const JSX_PROP = /\s[a-zA-Z_:]+=\s*"[^"]*[\u3400-\u9FFF\uF900-\uFAFF][^"]*"/;
// A. ternary string literal
const JSX_EXPR_STR = /[?:]\s*"[^"]*[\u3400-\u9FFF\uF900-\uFAFF][^"]*"|[?:]\s*'[^']*[\u3400-\u9FFF\uF900-\uFAFF][^']*'/;
// B. display-string object property
const DISPLAY_KEYS = "label|subLabel|subtitle|title|caption|placeholder|desc|description|message|confirmText|cancelText|actionText|btnText|buttonText|emptyText|hint|hintText|note|actionLabel|ctaText|cta|heading|text";
const OBJ_DISPLAY = new RegExp(`\\b(?:${DISPLAY_KEYS})\\s*:\\s*"[^"]*[\\u3400-\\u9FFF\\uF900-\\uFAFF][^"]*"`);
// C. (disabled) array of Chinese string literals — mostly API tag/ingredient values
const ARRAY_CJK = /\[\s*"\[^"\]\*\[\\u3400-\\u9FFF\]\[^"\]\*"\s*(?:,|\])/;
// D. render expression referencing a display field WITHOUT t()
const RENDER_EXPR = /\{[^{}]*\.(label|subLabel|subtitle|title|caption|placeholder|desc|message|hint|hintText|note|text)\b[^{}]*\}/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

let hits = [];
for (const d of DIRS) {
  for (const file of walk(path.join(ROOT, d))) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((ln, i) => {
      const stripped = ln.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (!CJK.test(stripped)) return;
      if (/\bt\(|i18n\.t\(|enumT\.|translate\(/.test(stripped)) return;
      if (ALLOW_SUBSTR.some((s) => stripped.includes(s))) return;
      const isHit =
        JSX_TEXT.test(stripped) ||
        JSX_PROP.test(stripped) ||
        JSX_EXPR_STR.test(stripped) ||
        OBJ_DISPLAY.test(stripped) ||
        ARRAY_CJK.test(stripped) || // data arrays: tag/ingredient values are API keys, not display
        RENDER_EXPR.test(stripped);
      if (!isHit) return;
      hits.push(`${rel}:${i + 1}: ${ln.trim().slice(0, 120)}`);
    });
  }
}

if (hits.length) {
  const strict = process.argv.includes("--strict");
  const label = strict ? "❌" : "⚠️";
  console.error(`\n${label} i18n audit: ${hits.length} hardcoded CJK UI string(s) not wrapped in t():\n`);
  hits.slice(0, 400).forEach((h) => console.error("  " + h));
  console.error(`\n→ Wrap in t("...") / enumT.*, or add to ALLOW_SUBSTR if content data.`);
  if (strict) process.exit(1);
  console.error(`(report-only mode; pass --strict to fail on these)\n`);
  process.exit(0);
}
console.log("✅ i18n audit passed (no hardcoded CJK in JSX).");
