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

const APPLE_SERVICES_ID =
  process.env.EXPO_PUBLIC_APPLE_SERVICES_ID ?? "com.kindcipe.web";

declare global {
  interface Window {
    AppleID?: any;
  }
}

let appleJsLoadPromise: Promise<void> | null = null;

function loadAppleIdentityServices(): Promise<void> {
  if (Platform.OS !== "web") return Promise.reject(new Error("web only"));
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.AppleID?.auth) return Promise.resolve();
  if (appleJsLoadPromise) return appleJsLoadPromise;

  appleJsLoadPromise = new Promise<void>((resolve, reject) => {
    const src =
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Apple JS load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Apple JS load failed"));
    document.head.appendChild(script);
  });
  return appleJsLoadPromise;
}

/**
 * Prompt Sign in with Apple on web using the Apple JS SDK (popup) and resolve
 * with the id_token.
 *
 * Unlike the OAuth redirect flow, the token comes back through the popup's
 * postMessage and is then POSTed to the backend (same shape as Google), so there
 * is no httpOnly cookie or URL-fragment dependency — which expo-router on web
 * otherwise mangles (it builds `pathname + hash` then appends the query, turning
 * `?apple=success#token=…` into a URL whose search is empty).
 */
export async function signInWithAppleWeb(): Promise<{ idToken: string; name?: string }> {
  await loadAppleIdentityServices();
  const AppleID = window.AppleID;
  if (!AppleID?.auth) throw new Error("Apple JS unavailable");

  AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: "name email",
    redirectURI: typeof window !== "undefined" ? window.location.origin : undefined,
    usePopup: true,
  });

  const res = await AppleID.auth.signIn();
  const idToken: string | undefined = res?.authorization?.id_token;
  if (!idToken) throw new Error("No Apple id_token");

  const u = res?.user;
  const name = u?.name
    ? [u.name.firstName, u.name.lastName].filter(Boolean).join(" ")
    : undefined;
  return { idToken, name };
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
