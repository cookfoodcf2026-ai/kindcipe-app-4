#!/usr/bin/env node
/**
 * Post-install patch for nested dependencies that patch-package can't target.
 *
 * patch-package only patches top-level `node_modules/<pkg>`. `@expo/cli` is nested
 * under `node_modules/expo/node_modules/@expo/cli`, so we patch it here.
 *
 * Fix: Metro's `publicPath = '/assets/?unstable_path=.'` bakes `%2F` into asset URLs,
 * which RN 0.81 re-encodes to `%252F` for non-ASCII (CJK) filenames → double-encoding
 * → 404/ENOENT. Use the classic `/assets` publicPath instead.
 *
 * Idempotent + tolerant: if the file/line isn't found (e.g. Expo bumped the CLI),
 * it skips quietly so it can never break a build.
 */
const fs = require("fs");
const path = require("path");

const candidates = [
  "node_modules/expo/node_modules/@expo/cli/build/src/start/server/metro/instantiateMetro.js",
  "node_modules/@expo/cli/build/src/start/server/metro/instantiateMetro.js",
];

const OLD = "        config.transformer.publicPath = '/assets/?unstable_path=.';";
const NEW =
  "        // PATCH: use classic `/assets` (unstable_path double-encodes CJK filenames)\n" +
  "        config.transformer.publicPath = '/assets';";

let patched = 0;
for (const rel of candidates) {
  const file = path.join(__dirname, "..", rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes(NEW)) { patched++; continue; } // already applied
  if (!src.includes(OLD)) continue; // pattern changed → skip quietly
  src = src.replace(OLD, NEW);
  fs.writeFileSync(file, src);
  patched++;
  console.log(`[postinstall] patched ${rel}`);
}
if (patched === 0) {
  console.log("[postinstall] @expo/cli patch: nothing to do (skipped)");
}
