/**
 * Codemod: replace raw error `.message` access with friendlyError(var) so users
 * never see technical messages. Adds the import when needed.
 *
 * Usage: node scripts/codemod-friendly-error.js [--write]
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const WRITE = process.argv.includes("--write");
const DIRS = ["app", "src/components", "hooks"];
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

const VAR = "(?:e|err|error|e2|err2|error2|ex|ex2)";
const RE = new RegExp(`\\b(${VAR})\\??\\.message\\b`, "g");
const IMPORT_LINE = 'import { friendlyError } from "@/lib/errors";';

let changedFiles = 0;
let replacements = 0;
const files = [];
for (const d of DIRS) files.push(...walk(path.join(ROOT, d)));

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  src = src.replace(RE, (_m, v) => {
    replacements++;
    return `friendlyError(${v})`;
  });
  if (src === before) continue;
  // add import if missing
  if (!src.includes('from "@/lib/errors"')) {
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i;
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, IMPORT_LINE);
    else lines.unshift(IMPORT_LINE);
    src = lines.join("\n");
  }
  changedFiles++;
  if (WRITE) fs.writeFileSync(file, src);
  console.log(`  ${path.relative(ROOT, file)}`);
}

console.log(`\nfiles changed: ${changedFiles}, replacements: ${replacements}${WRITE ? "" : " (dry-run)"}`);
