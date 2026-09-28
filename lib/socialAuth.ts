/**
 * Web social sign-in helpers.
 *
 * Native uses the Google/Apple SDKs (see app/login.tsx). Browsers use:
 *  - Google Identity Services (GIS) → returns an id_token which we POST to
 *    the backend's /api/auth/google (same endpoint the native app uses).
 *  - Apple via the backend's web OAuth redirect flow, which sets the httpOnly
 *    session cookie and bounces back to the app with ?apple=<status>.
 *
 * Required external config (documented in the repo docs):
 *  - Google Cloud Console → OAuth client (Web) → Authorized JavaScript origins
 *    must include the web app origin (e.g. https://app.kindcipe.com).
 *  - Backend ALLOWED_ORIGINS must include the web origin (redirect allowlist).
 *  - EXPO_PUBLIC_WEBAPP_URL / EXPO_PUBLIC_API_URL must be set.
 */
import { Platform } from "react-native";
import { BACKEND_URL } from "./trpc";

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  "690207937492-7hfs5hkksd5heo78kcfmq294f19rgp6d.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (Platform.OS !== "web") return Promise.reject(new Error("web only"));
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * Prompt Google sign-in on web and resolve with an id_token.
 * Falls back to rendering a one-tap button when the prompt is suppressed.
 */
export async function signInWithGoogleWeb(): Promise<string> {
  await loadGoogleIdentityServices();
  const gis = window.google;

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    gis.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      ux_mode: "popup",
      callback: (response: { credential?: string }) => {
        if (settled) return;
        settled = true;
        if (response?.credential) resolve(response.credential);
        else reject(new Error("No Google credential"));
      },
    });

    gis.accounts.id.prompt((notification: any) => {
      if (settled) return;
      const skipped = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
      if (skipped) {
        settled = true;
        reject(new Error("GOOGLE_PROMPT_UNAVAILABLE"));
      }
    });
  });
}

/** Kick off the backend-hosted Apple web OAuth redirect (full page navigation). */
export function startAppleWebLogin(returnUrl?: string): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const url = new URL(`${BACKEND_URL}/api/auth/apple/web/start`);
  if (returnUrl) url.searchParams.set("redirect", returnUrl);
  window.location.href = url.toString();
}

/** True when the browser is able to attempt social sign-in. */
export function isWebSocialLoginAvailable(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined";
}
