/**
 * Extract hardcoded CJK UI strings flagged by scripts/audit-i18n.js and add
 * them to locales as natural-language keys (zh-TW identity + en/fil/id via LLM).
 *
 * Usage:
 *   node scripts/i18n-extract-cjk.js            # dry-run: list + count
 *   node scripts/i18n-extract-cjk.js --commit   # translate + write locales
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const COMMIT = process.argv.includes("--commit");
const LOCALES = ["zh-TW", "en", "fil", "id"];

// 1. collect unique CJK strings from the audit's flagged lines only
const audit = execSync("node scripts/audit-i18n.js 2>&1 || true", { cwd: ROOT, encoding: "utf8", shell: "/bin/bash" });
const strings = new Set();
for (const line of audit.split("\n")) {
  if (!/^\s+\S+\.tsx?:\d+:/.test(line)) continue;
  for (const m of line.matchAll(/"([^"\n]*[\u3400-\u9FFF\uF900-\uFAFF][^"\n]*)"/g)) {
    const s = m[1].trim();
    if (s && s.length <= 60) strings.add(s);
  }
}

const list = [...strings].sort();
console.log(`unique CJK strings: ${list.length}`);

// 2. drop ones already present as keys in locales
const localeData = {};
for (const l of LOCALES) localeData[l] = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8"));
const flatHas = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const todo = list.filter((s) => !flatHas(localeData["zh-TW"], s));
console.log(`need adding: ${todo.length}`);

if (!COMMIT) {
  todo.forEach((s) => console.log("  " + s));
  console.log("\nDRY-RUN. Re-run with --commit to translate + write.");
  process.exit(0);
}

// 3. translate via DashScope (batch)
const API_KEY = process.env.DASHSCOPE_API_KEY || "";
const BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const MODEL = "qwen3.7-flash";
const BATCH = 25;

async function translateBatch(items) {
  const prompt = `Translate each short Chinese UI label into (1) English, (2) Filipino, (3) Indonesian.
Keep them short (they are buttons/chips/labels). Return ONLY a JSON array:
[{"zh":"全部食譜","en":"All Recipes","fil":"Lahat ng Recipe","id":"Semua Resep"}, ...]
Items:
${items.map((s, i) => `${i}. ${s}`).join("\n")}`;
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 4000, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("no array");
  const arr = JSON.parse(m[0]);
  const out = {};
  for (const r of arr) if (r.zh && r.en) out[r.zh] = { en: r.en, fil: r.fil || r.en, id: r.id || r.en };
  return out;
}

(async () => {
  const map = {};
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      const out = await translateBatch(batch);
      Object.assign(map, out);
      console.log(`  batch ${i / BATCH + 1}: ${Object.keys(out).length}/${batch.length}`);
    } catch (e) {
      console.warn(`  batch ${i / BATCH + 1} FAILED: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  for (const s of todo) {
    const tr = map[s] || { en: s, fil: s, id: s };
    localeData["zh-TW"][s] = s;
    localeData["en"][s] = tr.en;
    localeData["fil"][s] = tr.fil;
    localeData["id"][s] = tr.id;
  }
  for (const l of LOCALES) {
    fs.writeFileSync(path.join(ROOT, "locales", `${l}.json`), JSON.stringify(localeData[l], null, 2) + "\n");
  }
  console.log(`\nDONE. added ${todo.length} keys to all 4 locales.`);
})();
