/**
 * tRPC client — 連接 Kindcipe 後端 API
 * 後端地址：https://kindcipe-backend-production.up.railway.app
 *
 * 認證策略：Token-based 模式（React Native ）
 * - App 從 AsyncStorage 讀取 token
 * - 每個請求在 Authorization header 中附帶 token
 */
import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_TOKEN_KEY, FAMILY_ID_KEY, getAuthToken } from "./auth";
import type { AppRouter } from "./router-types";

// ─── 後端 API 地址 ───────────────────────────────────────
// 使用環境變數 EXPO_PUBLIC_API_URL（優先），預設指向 Railway 生產後端
// 開發時可在 .env 中設定為 ngrok 或其他測試網址
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://kindcipe-backend-production.up.railway.app";

// 開發環境警告（僅在 dev mode 顯示）
if (__DEV__) {
  if (API_BASE_URL.includes("ngrok") || API_BASE_URL.includes("localhost")) {
    console.warn("⚠️  開發環境網址，不應用於生產：" + API_BASE_URL);
  }
}

// 導出 BACKEND_URL 供其他檔案使用（確保 Google/Apple 登入用同一網址）
export const BACKEND_URL = API_BASE_URL;

/**
 * Convert a possibly-relative image URL (e.g. `/r2-storage/...`) into a full URL.
 * Absolute http(s) URLs are returned unchanged.
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

// ─── 請求逾時設定（毫秒）─────────────────────────────────
const REQUEST_TIMEOUT_MS = 90_000;

// ─── Lightweight offline detection (no native module) ─────────
// Deduplicated: reports offline once, clears on first success.
const listeners = new Set<(offline: boolean) => void>();
let _offline = false;
const OFFLINE_WINDOW_MS = 8_000;

export function isCurrentlyOffline() {
  return _offline;
}

export function onOfflineChange(cb: (offline: boolean) => void): () => void {
  listeners.add(cb);
  cb(_offline);
  return () => listeners.delete(cb);
}

function reportOffline(offline: boolean) {
  if (_offline === offline) return;
  _offline = offline;
  listeners.forEach((cb) => cb(offline));
}

/** Called by the tRPC fetch wrapper on success/failure. */
export function reportNetworkSuccess() {
  reportOffline(false);
}
export function reportNetworkFailure() {
  reportOffline(true);
  // Clear the flag shortly after so a single blip doesn't stick forever.
  setTimeout(() => reportOffline(false), OFFLINE_WINDOW_MS);
}

// ─── tRPC React hooks ────────────────────────────────────
export const trpc = createTRPCReact<AppRouter>( );

// ─── tRPC client factory (for React provider) ──────────
const makeClient = () => ({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/v1/trpc`,
      transformer: superjson,
      async fetch(url, options ) {
        const [token, familyId] = await Promise.all([
          getAuthToken(),
          AsyncStorage.getItem(FAMILY_ID_KEY),
        ]);
        const headers = {
          ...options?.headers,
        } as Record<string, string>;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        if (familyId) {
          headers["X-Family-Id"] = familyId;
        }

        // 使用 AbortController 實現逾時控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
            signal: controller.signal,
          });
          reportNetworkSuccess();
          return response;
        } catch (e) {
          reportNetworkFailure();
          throw e;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    }),
  ],
});

export function createTrpcClient() {
  return trpc.createClient(makeClient());
}

// ─── Direct API client (for non-hook calls) ────────────
export const apiClient = createTRPCClient<AppRouter>(makeClient());
