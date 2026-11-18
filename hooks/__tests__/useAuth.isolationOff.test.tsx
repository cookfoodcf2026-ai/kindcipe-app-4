process.env["EXPO_PUBLIC_AUTH_401_LINK"] = "0";
process.env["EXPO_PUBLIC_ACCOUNT_CACHE_ISOLATION"] = "0";

import React from "react";
import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";

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
              queryFn: async () => ({ id: "u1", name: "Test" }),
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
  getItem: jest.fn(async (key: string) =>
    key === "kindcipe_active_family_id" ? "fam1" : null,
  ),
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

describe("useAuth — cache isolation flag OFF", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { queryClient } = require("@/lib/queryClient");
    queryClient.clear();
  });

  afterEach(() => {
    const { queryClient } = require("@/lib/queryClient");
    queryClient.clear();
  });

  it("family switch keeps cached queries (no cancel, no remove)", async () => {
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

    const cancelSpy = jest.spyOn(queryClient, "cancelQueries");
    try {
      await act(async () => {
        await latestAuth.switchFamily("fam2");
      });
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(queryClient.getQueryData([["auth", "me"], { type: "query" }])).toBeTruthy();
      expect(queryClient.getQueryData([["recipes", "list"], { type: "query" }])).toEqual([
        { id: "r1" },
      ]);
      expect(queryClient.getQueryData([["family", "get"], { type: "query" }])).toEqual({
        id: "fam1",
      });
    } finally {
      cancelSpy.mockRestore();
    }
  });
});
