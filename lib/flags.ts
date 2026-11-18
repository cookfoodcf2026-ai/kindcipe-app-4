/**
 * Single source of truth for build-time `EXPO_PUBLIC_*` flags.
 *
 * Keep the `process.env.EXPO_PUBLIC_*` read in this file only: Metro inlines
 * the value here, and every other module imports the resolved constant. That
 * makes a grep for the flag name return exactly one hit, so "which value did
 * this build actually get?" is answerable.
 *
 * Only the literal string "1" turns the auth-401 link ON. "" , "0",
 * undefined and any other value are OFF — `Boolean("0") === true` is the trap
 * this resolver exists to avoid.
 */

const RAW_AUTH_401_LINK: string | undefined =
  process.env.EXPO_PUBLIC_AUTH_401_LINK;

export const AUTH_401_LINK_RAW = RAW_AUTH_401_LINK;

export function parseAuth401LinkFlag(raw: string | undefined): boolean {
  return raw === "1";
}

/** null = legal value; string = build-time configuration error. */
export function auth401LinkConfigError(
  raw: string | undefined,
): string | null {
  if (raw === undefined || raw === "" || raw === "0" || raw === "1") {
    return null;
  }
  return `EXPO_PUBLIC_AUTH_401_LINK must be "1" (on) or "0"/""/unset (off); got "${raw}"`;
}

export const AUTH_401_LINK_ENABLED = parseAuth401LinkFlag(RAW_AUTH_401_LINK);
