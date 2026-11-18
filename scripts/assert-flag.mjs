/**
 * Verifies the exported web bundle really carries the flag state we think it does.
 *
 * Usage: node scripts/assert-flag.mjs "$EXPO_PUBLIC_AUTH_401_LINK"
 *   ""/unset/"0" -> expect flag=off    "1" -> expect flag=on
 *
 * The build stamp is the only source of the literal marker, so the bundle must
 * contain exactly one `flag=on|off`. 0 or >=2 matches means the artifact is not
 * trustworthy (stale dist, double injection, unminified ternary) -> exit 1.
 */
import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2];
const VALID = [undefined, "", "0", "1"];
if (!VALID.includes(raw)) {
  console.error(
    `[assert-flag] illegal EXPO_PUBLIC_AUTH_401_LINK="${raw}" (allowed: "1", "0", "" or unset)`,
  );
  process.exit(1);
}
const expected = raw === "1" ? "flag=on" : "flag=off";

const dir = path.resolve("dist/_expo/static/js/web");
if (!fs.existsSync(dir)) {
  console.error(`[assert-flag] missing ${dir}`);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error(`[assert-flag] no .js bundle in ${dir}`);
  process.exit(1);
}

const matches = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(dir, file), "utf8");
  for (const match of source.matchAll(/flag=(on|off)/g)) {
    matches.push({ file, value: match[0] });
  }
}

if (matches.length !== 1) {
  console.error(
    `[assert-flag] expected exactly 1 marker, found ${matches.length}: ${JSON.stringify(matches)}`,
  );
  process.exit(1);
}

const found = matches[0];
if (found.value !== expected) {
  console.error(
    `[assert-flag] bundle says ${found.value} in ${found.file}, env expects ${expected}`,
  );
  process.exit(1);
}

console.log(`[assert-flag] ok ${expected} (${found.file})`);
