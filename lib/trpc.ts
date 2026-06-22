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
export const API_BASE_URL = "https://kindcipe-backend-production.up.railway.app";

// ─── tRPC React hooks ────────────────────────────────────
export const trpc = createTRPCReact<AppRouter>( );

// ─── tRPC client factory (for React provider) ──────────
const makeClient = () => ({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
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
        return fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

export function createTrpcClient() {
  return trpc.createClient(makeClient());
}

// ─── Direct API client (for non-hook calls) ────────────
export const apiClient = createTRPCClient<AppRouter>(makeClient());
