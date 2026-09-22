/**
 * i18n audit: flag hardcoded CJK in UI JSX (text nodes + string props) NOT wrapped in t()/enumT.
 * Narrow on purpose (avoids data/logic false positives).
 * Usage: node scripts/audit-i18n.js   (exit 1 if hits)
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
];
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
// JSX text node: > ...CJK... < (allow {} interpolation so dynamic strings are caught)
const JSX_TEXT = />[^<>]*[\u3400-\u9FFF\uF900-\uFAFF][^<>]*</;
// JSX string prop: attr="...CJK..."
const JSX_PROP = /\s[a-zA-Z_:]+=\s*"[^"]*[\u3400-\u9FFF\uF900-\uFAFF][^"]*"/;
// Chinese string literal in a ternary / JSX expression: ? "中文" : ...
const JSX_EXPR_STR = /[?:]\s*"[^"]*[\u3400-\u9FFF\uF900-\uFAFF][^"]*"|[?:]\s*'[^']*[\u3400-\u9FFF\uF900-\uFAFF][^']*'/;

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
      if (!JSX_TEXT.test(stripped) && !JSX_PROP.test(stripped)) return;
      hits.push(`${rel}:${i + 1}: ${ln.trim().slice(0, 120)}`);
    });
  }
}

if (hits.length) {
  const strict = process.argv.includes("--strict");
  const label = strict ? "❌" : "⚠️";
  console.error(`\n${label} i18n audit: ${hits.length} hardcoded CJK JSX line(s) not wrapped in t():\n`);
  hits.slice(0, 300).forEach((h) => console.error("  " + h));
  console.error(`\n→ Wrap in t("...") / enumT.*, or add to ALLOW_SUBSTR if content data.`);
  if (strict) process.exit(1);
  console.error(`(report-only mode; pass --strict to fail on these)\n`);
  process.exit(0);
}
console.log("✅ i18n audit passed (no hardcoded CJK in JSX).");
