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
      existing.addEventListener("error", () => reject(new Error("gis_load_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis_load_failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * Safari / iOS WebKit blocks the third-party cookies that Google's popup
 * sign-in needs, so the popup loads a blank accounts.google.com page. In those
 * browsers we must use a top-level redirect instead (OAuth 2.0 id_token flow).
 */
export function googleNeedsRedirectFlow(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iosWebKit = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR|FxiOS|GSA/.test(ua);
  return iosWebKit || isSafari;
}

/** Send the browser to Google, which comes back to /login#id_token=… */
export function startGoogleRedirectSignIn(): void {
  if (typeof window === "undefined") return;
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { window.sessionStorage.setItem("kindcipe_g_nonce", nonce); } catch { /* ignore */ }
  const params = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: `${window.location.origin}/login`,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
    state: "google",
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/** Read the id_token Google put in the URL fragment after the redirect. */
export function consumeGoogleRedirectIdToken(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  if (!hash.includes("id_token")) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const idToken = params.get("id_token");
  const error = params.get("error");
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch { /* ignore */ }
  if (error) return null;
  return idToken;
}

/**
 * Render Google's own button into a DOM node and resolve with an id_token.
 *
 * One Tap (`prompt()`) is silently suppressed in Safari / browsers that block
 * third-party cookies, and because react-native-web's Alert is a no-op the
 * failure looked like a dead button. The rendered button always opens the
 * account chooser popup, so it is the reliable path on web.
 */
export function renderGoogleSignInButton(
  host: HTMLElement,
  onCredential: (idToken: string) => void,
  onError?: (error: Error) => void,
): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  loadGoogleIdentityServices()
    .then(() => {
      const gis = window.google;
      if (!gis?.accounts?.id) throw new Error("gis_load_failed");
      host.innerHTML = "";
      host.setAttribute("data-gis-container", "1");
      gis.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        ux_mode: "popup",
        callback: (response: { credential?: string }) => {
          if (response?.credential) onCredential(response.credential);
          else onError?.(new Error("No Google credential"));
        },
      });
      gis.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        logo_alignment: "center",
        width: Math.max(220, Math.round(host.clientWidth || 280)),
      });
    })
    .catch((error: Error) => onError?.(error));
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
