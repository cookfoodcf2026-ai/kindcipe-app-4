process.env["EXPO_PUBLIC_AUTH_401_LINK"] = "1";

import React from "react";
import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";

const mockMeCalls = { count: 0, aborted: 0 };

const mockNoopMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
  reset: jest.fn(),
});

jest.mock("@/lib/trpc", () => {
  const { useQuery } = require("@tanstack/react-query");
  return {
    trpc: {
      useUtils: () => ({
        invalidate: jest.fn(),
        auth: { me: { invalidate: jest.fn() } },
      }),
      auth: {
        me: {
          useQuery: (_input: unknown, opts: any = {}) =>
            useQuery({
              queryKey: [["auth", "me"], { type: "query" }],
              ...opts,
              retry: false,
              queryFn: ({ signal }: any) =>
                new Promise((resolve, reject) => {
                  mockMeCalls.count += 1;
                  const timer = setTimeout(() => resolve({ id: "u1", name: "Test" }), 800);
                  signal?.addEventListener("abort", () => {
                    clearTimeout(timer);
                    mockMeCalls.aborted += 1;
                    reject(new Error("AbortError"));
                  });
                }),
            }),
        },
        logout: { useMutation: mockNoopMutation },
      },
      family: {
        list: { useQuery: () => ({ data: [{ id: "fam1", role: "owner" }] }) },
        get: { useQuery: () => ({ data: undefined }) },
        setActive: { useMutation: mockNoopMutation },
      },
    },
  };
});

jest.mock("@/lib/auth", () => ({
  FAMILY_ID_KEY: "kindcipe_active_family_id",
  getAuthTokenState: async () => ({ token: "test-token", error: null }),
}));

jest.mock("@/lib/hardLogout", () => ({ resetAuthState: jest.fn() }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => {
    if (key === "kindcipe_active_family_id") await new Promise((r) => setTimeout(r, 5));
    return key === "kindcipe_active_family_id" ? "fam1" : null;
  }),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

let latestAuth: any = null;

function Probe() {
  const { useAuth } = require("@/hooks/useAuth");
  const auth = useAuth();
  latestAuth = auth;
  return <Text testID="status">{`${auth.authStatus}|${auth.isLoading}`}</Text>;
}

describe("useAuth — cold start with slow auth.me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMeCalls.count = 0;
    mockMeCalls.aborted = 0;
    const { queryClient } = require("@/lib/queryClient");
    queryClient.clear();
  });

  afterEach(() => {
    const { queryClient } = require("@/lib/queryClient");
    queryClient.clear();
  });

  it("finishes loading without cancelling the single auth.me request", async () => {
    const { AuthProvider } = require("@/hooks/useAuth");
    const { queryClient } = require("@/lib/queryClient");
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(
      () => expect(view.getByTestId("status").props.children).toBe("authenticated|false"),
      { timeout: 3000 },
    );

    expect(mockMeCalls.count).toBe(1);
    expect(mockMeCalls.aborted).toBe(0);
    expect(latestAuth.authStatus).toBe("authenticated");
  });

  it("keeps auth.me when switching family but drops family-scoped data", async () => {
    const { AuthProvider } = require("@/hooks/useAuth");
    const { queryClient } = require("@/lib/queryClient");
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(
      () => expect(view.getByTestId("status").props.children).toBe("authenticated|false"),
      { timeout: 3000 },
    );

    queryClient.setQueryData([["recipes", "list"], { type: "query" }], [{ id: "r1" }]);
    queryClient.setQueryData([["family", "get"], { type: "query" }], { id: "fam1" });

    await act(async () => {
      await latestAuth.switchFamily("fam2");
    });

    expect(queryClient.getQueryData([["auth", "me"], { type: "query" }])).toBeTruthy();
    expect(queryClient.getQueryData([["recipes", "list"], { type: "query" }])).toBeUndefined();
    expect(queryClient.getQueryData([["family", "get"], { type: "query" }])).toBeUndefined();
    expect(mockMeCalls.aborted).toBe(0);
  });
});
