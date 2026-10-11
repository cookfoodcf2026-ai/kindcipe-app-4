/**
 * i18n key completeness: every t("ns.key") used in the app must exist in all 4 locale files.
 * Usage: node scripts/check-i18n-keys.js   (exit 1 if missing)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["zh-TW", "en", "fil", "id"];
const DIRS = ["app", "src/components", "components", "hooks", "lib"];
const EXCLUDE_DIRS = ["node_modules", "locales", "__tests__", "e2e", ".expo"];

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

// collect static keys from t("...") / i18n.t("...") — includes ASCII keys AND CJK-literal keys.
// (Template-literal keys like t(`ns.${x}`) are dynamic and skipped.)
// Source escapes (\n \t \") are unescaped so they match the parsed JSON key at runtime.
const keys = new Set();
const tRe = /\b(?:i18n\.)?t\(\s*["']([^"'\n]+)["']/g;
const showRe = /\bshowToast\(\s*["']([^"'\n]+)["']/g;                 // toast message literal
const alertRe = /\bAlert\.alert\(\s*["']([^"'\n]+)["']/g;             // dialog title literal
const alertMsgRe = /\bAlert\.alert\(\s*["'][^"'\n]*["']\s*,\s*["']([^"'\n]+)["']/g; // dialog message literal
const unescape = (s) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "").replace(/\\"/g, '"').replace(/\\'/g, "'");
const enumRe = /enums\.(category|unit|difficulty|meal|weekday|month)\./g;
for (const d of DIRS) {
  for (const file of walk(path.join(ROOT, d))) {
    const src = fs.readFileSync(file, "utf8");
    let m;
    while ((m = tRe.exec(src))) keys.add(unescape(m[1]));
    while ((m = showRe.exec(src))) keys.add(unescape(m[1]));
    while ((m = alertRe.exec(src))) keys.add(unescape(m[1]));
    while ((m = alertMsgRe.exec(src))) keys.add(unescape(m[1]));
  }
}

function get(obj, dotted) {
  // Literal key wins (keys may contain dots, e.g. "上載圖片..."); else dotted traversal.
  if (Object.prototype.hasOwnProperty.call(obj, dotted)) return obj[dotted];
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const locales = {};
for (const l of LOCALES) locales[l] = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", l + ".json"), "utf8"));

const missing = [];
for (const k of keys) {
  for (const l of LOCALES) {
    if (get(locales[l], k) === undefined) missing.push(`${k}  → missing in ${l}`);
  }
}

if (missing.length) {
  console.error(`\n❌ i18n keys: ${missing.length} missing translation(s):\n`);
  missing.slice(0, 300).forEach((m) => console.error("  " + m));
  console.error("");
  process.exit(1);
}
console.log(`✅ i18n keys: ${keys.size} keys present in all ${LOCALES.length} locales.`);
