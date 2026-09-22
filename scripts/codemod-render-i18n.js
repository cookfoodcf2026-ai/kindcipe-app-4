/**
 * Codemod: wrap render-time display fields with t() so data-array Chinese labels
 * are translated at render (module-scope t() would freeze the language).
 *
 *   {item.label}        -> {t(item.label as any)}
 *   {opt.subtitle}      -> {t(opt.subtitle as any)}
 *   placeholder={x.desc}-> placeholder={t(x.desc as any)}
 *
 * Only touches files that already use t(). Usage: node scripts/codemod-render-i18n.js [--write]
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const WRITE = process.argv.includes("--write");
const DIRS = ["app", "src/components", "hooks"];
const EXCLUDE_DIRS = ["node_modules", "locales", "__tests__", "e2e", ".expo"];
const FIELD = "label|subLabel|subtitle|title|caption|placeholder|desc|message|hint|hintText|note|text";

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

// {expr.field}  →  {t(expr.field as any)}   (expr has no braces / no existing t()
const BRACE_RE = new RegExp(`\\{([^{}()]*\\.(?:${FIELD})\\b[^{}()]*)\\}`, "g");
// prop={expr.field} → prop={t(expr.field as any)}
const PROP_RE = new RegExp(`=\\{([^{}()]*\\.(?:${FIELD})\\b[^{}()]*)\\}`, "g");

let files = 0;
let count = 0;
for (const d of DIRS) {
  for (const file of walk(path.join(ROOT, d))) {
    let src = fs.readFileSync(file, "utf8");
    if (!/\bt\(/.test(src)) continue; // needs t() in scope
    const before = src;
    const wrap = (m, expr) => {
      if (/^\s*t\(/.test(expr) || expr.includes("t(")) return m;
      count++;
      return m.replace(expr, `t(${expr} as any)`);
    };
    src = src.replace(PROP_RE, wrap);
    src = src.replace(BRACE_RE, wrap);
    if (src === before) continue;
    files++;
    if (WRITE) fs.writeFileSync(file, src);
    console.log(`  ${path.relative(ROOT, file)}`);
  }
}
console.log(`\nfiles: ${files}, wraps: ${count}${WRITE ? "" : " (dry-run)"}`);
