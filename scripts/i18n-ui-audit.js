const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "i18n-ui-baseline.json");
const DIRS = ["app", "src/components", "components", "hooks", "lib"];
const EXCLUDE_DIRS = new Set(["node_modules", "locales", "__tests__", "e2e", ".expo", "dist"]);
const SKIP_FILES = new Set([
  "lib/cookingTerms.ts",
  "lib/commonIngredients.ts",
  "lib/ingredientResolve.ts",
  "lib/i18nEnums.ts",
  "lib/taxonomy.ts",
  "lib/dishType.ts",
  "lib/price.ts",
  "app/admin.tsx",
  "lib/category-storage.ts",
]);
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const DATA_PROPS = new Set([
  "value", "key", "category", "categoryKey", "mealType", "mealTypeKey",
  "unit", "difficulty", "query", "tags", "keywords", "name", "id", "type",
  "code", "source", "sourceType", "role", "dishType", "recipeCategory", "city",
  "actionId", "labelKey", "testID", "nativeID", "route", "path", "href",
]);
const UI_PROPS = new Set([
  "label", "title", "subtitle", "subLabel", "caption", "placeholder", "desc",
  "description", "message", "hint", "hintText", "note", "confirmText", "cancelText",
  "actionText", "btnText", "buttonText", "emptyText", "actionLabel", "ctaText",
  "cta", "heading", "text", "alt", "accessibilityLabel", "accessibilityHint",
]);
const UI_ATTRS = new Set([
  "placeholder", "title", "accessibilityLabel", "accessibilityHint", "aria-label",
  "alt", "label",
]);
const TRANSLATION_CALLS = new Set(["t", "translate", "msg"]);
const DISPLAY_CALLS = new Set(["alert", "showToast", "toast"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function propName(node) {
  if (ts.isPropertyAssignment(node)) {
    if (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) return node.name.text;
  }
  return null;
}

function objectHasProps(node, names) {
  if (!ts.isObjectLiteralExpression(node)) return false;
  return node.properties.some((p) => ts.isPropertyAssignment(p) && names.includes(propName(p)));
}

function isInsideTranslationCall(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur)) {
      const callee = cur.expression;
      if (ts.isIdentifier(callee) && TRANSLATION_CALLS.has(callee.text)) return true;
      if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression;
        if (ts.isIdentifier(obj) && obj.text === "i18n" && TRANSLATION_CALLS.has(callee.name.text)) return true;
        if (ts.isIdentifier(obj) && obj.text === "enumT") return true;
      }
    }
  }
  return false;
}

function isInsideConsole(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
      const obj = cur.expression.expression;
      if (ts.isIdentifier(obj) && obj.text === "console") return true;
    }
  }
  return false;
}

function displayCallName(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
      const obj = cur.expression.expression;
      if (ts.isIdentifier(obj) && obj.text === "Alert" && cur.expression.name.text === "alert") return "Alert.alert";
      if (ts.isIdentifier(obj) && DISPLAY_CALLS.has(cur.expression.name.text)) return cur.expression.name.text;
    }
    if (ts.isCallExpression(cur) && ts.isIdentifier(cur.expression) && DISPLAY_CALLS.has(cur.expression.text)) {
      return cur.expression.text;
    }
  }
  return null;
}

function isDataValue(node) {
  let cur = node.parent;
  for (let depth = 0; cur && depth < 8; cur = cur.parent, depth++) {
    if (ts.isPropertyAssignment(cur)) {
      const name = propName(cur);
      if (!name) return false;
      if (DATA_PROPS.has(name)) return true;
      if (UI_PROPS.has(name)) {
        const obj = cur.parent;
        if (objectHasProps(obj, ["key", "id", "value", "category", "keywords", "icon", "iconName", "color", "bg", "group", "tint"])) return true;
      }
      return false;
    }
    if (ts.isArrayLiteralExpression(cur) || ts.isObjectLiteralExpression(cur) || ts.isParenthesizedExpression(cur)) continue;
    if (ts.isAsExpression(cur) || ts.isTypeAssertionExpression(cur)) continue;
    break;
  }
  return false;
}

function isInsideUiProperty(node) {
  let cur = node.parent;
  for (let depth = 0; cur && depth < 8; cur = cur.parent, depth++) {
    if (ts.isPropertyAssignment(cur)) {
      const name = propName(cur);
      return !!name && UI_PROPS.has(name);
    }
    if (ts.isArrayLiteralExpression(cur) || ts.isObjectLiteralExpression(cur) || ts.isParenthesizedExpression(cur)) continue;
    if (ts.isAsExpression(cur) || ts.isTypeAssertionExpression(cur)) continue;
    break;
  }
  return false;
}

function arrayIsDataByUsage(node, sf) {
  let cur = node.parent;
  while (cur && !ts.isArrayLiteralExpression(cur)) {
    if (ts.isPropertyAssignment(cur) || ts.isVariableDeclaration(cur) || ts.isCallExpression(cur)) break;
    cur = cur.parent;
  }
  if (!cur || !ts.isArrayLiteralExpression(cur)) return false;
  const parent = cur.parent;
  if (!ts.isCallExpression(parent) || !ts.isPropertyAccessExpression(parent.expression)) return false;
  const method = parent.expression.name.text;
  if (method === "includes") return true;
  if (method !== "map") return false;
  const callbackText = parent.arguments[0] ? parent.arguments[0].getText(sf) : "";
  return /(?:^|[^A-Za-z0-9_])t\s*\(|enumT\./.test(callbackText);
}

function isInsideJsxExpression(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isJsxExpression(cur)) return true;
    if (ts.isJsxAttribute(cur)) return false;
  }
  return false;
}

function stringText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function shouldCountString(node, sf) {
  if (isInsideTranslationCall(node) || isInsideConsole(node) || isDataValue(node)) return false;
  if (arrayIsDataByUsage(node, sf)) return false;
  if (displayCallName(node)) return true;
  if (isInsideUiProperty(node)) return true;
  if (isInsideJsxExpression(node)) return true;
  return false;
}

function auditFile(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (SKIP_FILES.has(rel) || /\.test\.(ts|tsx)$/.test(rel)) return [];
  const source = fs.readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const hits = [];
  const seen = new Set();
  const add = (node, text, kindLabel) => {
    const start = node.getStart(sf);
    const key = `${start}:${kindLabel}`;
    if (seen.has(key)) return;
    seen.add(key);
    const pos = sf.getLineAndCharacterOfPosition(start);
    hits.push({ file: rel, line: pos.line + 1, text: String(text).replace(/\s+/g, " ").trim(), kind: kindLabel });
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf);
      if (CJK.test(text) && text.trim()) add(node, text, "jsx-text");
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      if (UI_ATTRS.has(name) && CJK.test(node.initializer.text) && !isInsideTranslationCall(node)) {
        add(node, node.initializer.text, "jsx-attr");
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // JSX attribute strings are handled above to avoid double counting.
      if (!(node.parent && ts.isJsxAttribute(node.parent))) {
        const text = stringText(node);
        if (text && CJK.test(text) && shouldCountString(node, sf)) add(node, text, "string");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function collect() {
  const hits = [];
  for (const dir of DIRS) for (const file of walk(path.join(ROOT, dir))) hits.push(...auditFile(file));
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function baselineFrom(hits) {
  const counts = {};
  for (const hit of hits) {
    const key = `${hit.file}|${hit.kind}|${hit.text}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalHits: hits.length,
    totalLines: new Set(hits.map((h) => `${h.file}:${h.line}`)).size,
    counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function printStats(hits) {
  const uniqueLines = new Set(hits.map((h) => `${h.file}:${h.line}`)).size;
  console.log(`UI i18n hits: ${hits.length} hits, ${uniqueLines} lines, ${new Set(hits.map((h) => h.file)).size} files`);
  const byFile = new Map();
  for (const hit of hits) byFile.set(hit.file, (byFile.get(hit.file) || 0) + 1);
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${count.toString().padStart(3)}  ${file}`);
  }
}

function checkBaseline(hits) {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error("Missing scripts/i18n-ui-baseline.json");
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const current = baselineFrom(hits).counts;
  const added = [];
  for (const [key, count] of Object.entries(current)) {
    const before = baseline.counts[key] || 0;
    if (count > before) added.push({ key, before, after: count });
  }
  if (added.length) {
    console.error(`New hardcoded UI CJK: ${added.length} key(s)`);
    for (const item of added.slice(0, 100)) console.error(`  +${item.after - item.before}  ${item.key}`);
    process.exit(1);
  }
  console.log("UI i18n baseline check passed (no new hardcoded UI CJK).");
}

const hits = collect();
const write = process.argv.includes("--write-baseline");
const check = process.argv.includes("--check");
if (write) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baselineFrom(hits), null, 2) + "\n");
  printStats(hits);
  console.log(`Wrote ${path.relative(ROOT, BASELINE_PATH)}`);
} else {
  printStats(hits);
  if (check) checkBaseline(hits);
  else if (hits.length) {
    for (const hit of hits.slice(0, 400)) console.log(`  ${hit.file}:${hit.line}: ${hit.text}`);
  }
}
