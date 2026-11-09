/**
 * Canonical legal pages.
 *
 * The live pages are kindcipe.com/privacy and kindcipe.com/terms (see the
 * owner-confirmed effective dates in .briefs/legal_2026-11-09.md). Env vars
 * stay available for preview builds; production falls back to the live site.
 */
import * as WebBrowser from "expo-web-browser";

export const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://kindcipe.com/privacy/";

export const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_URL ?? "https://kindcipe.com/terms/";

/** Open a legal page in the in-app browser (SFSafariViewController / Chrome Custom Tab). */
export function openLegalPage(url: string): void {
  void WebBrowser.openBrowserAsync(url, {
    toolbarColor: "#183B56",
    controlsColor: "#ffffff",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  }).catch(() => {
    /* no browser / bad URL — nothing else to do */
  });
}
