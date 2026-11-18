/**
 * Prints `EXPO_PUBLIC_BUILD_STAMP` for `npm run build:web`:
 *   "<short commit> flag=on|off"
 *
 * Exits 1 on an illegal flag value, so a bad build never reaches deploy.
 */
import { execSync } from "node:child_process";
import {
  AUTH_401_LINK_ENABLED,
  AUTH_401_LINK_RAW,
  auth401LinkConfigError,
} from "../lib/flags";

const error = auth401LinkConfigError(AUTH_401_LINK_RAW);
if (error) {
  console.error(`[build-stamp] ${error}`);
  process.exit(1);
}

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* not a git checkout (e.g. CI tarball) */
}

console.log(`${commit} ${AUTH_401_LINK_ENABLED ? "flag=on" : "flag=off"}`);
