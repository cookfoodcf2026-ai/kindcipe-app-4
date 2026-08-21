const fs = require("fs");

const src = fs.readFileSync(process.argv[2] || "app/recipe/[id].tsx", "utf8");

// Extract: 'name': require('@/assets/recipes/file.png'),
const re = /'([^']+)'\s*:\s*require\('@\/assets\/recipes\/([^']+)'\)/g;
const map = {};
let m;
while ((m = re.exec(src)) !== null) {
  map[m[1]] = m[2];
}

console.log("extracted count:", Object.keys(map).length);

// Verify all files exist
const base = "assets/recipes";
const missing = Object.entries(map).filter(([, f]) => !fs.existsSync(`${base}/${f}`));
console.log("missing files:", missing.length);

// Verify all assets are covered
const allAssets = fs.readdirSync(base).filter((f) => f.endsWith(".png"));
const mappedFiles = new Set(Object.values(map));
const unmapped = allAssets.filter((f) => !mappedFiles.has(f));
console.log("total assets:", allAssets.length, "| mapped:", mappedFiles.size, "| unmapped:", unmapped.length);

if (unmapped.length > 0) console.log("unmapped assets (first 20):", unmapped.slice(0, 20));

// Write JSON map: name -> filename
const out = process.argv[3] || "scripts/recipe-image-map.json";
fs.writeFileSync(out, JSON.stringify(map, null, 2));
console.log("written:", out);