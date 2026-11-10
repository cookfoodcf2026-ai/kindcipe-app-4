import { resetAuthState } from "./hardLogout";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { removeItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("./auth", () => ({
  clearAuthToken: jest.fn(),
  FAMILY_ID_KEY: "kindcipe_active_family_id",
}));
jest.mock("./queryClient", () => ({
  queryClient: { clear: jest.fn() },
}));

describe("hardLogout / resetAuthState", () => {
  it("clears the token, family id and the whole query cache", async () => {
    const clearToken = jest.fn().mockResolvedValue(undefined);
    const removeFamilyId = jest.fn().mockResolvedValue(undefined);
    const clearQueryCache = jest.fn();

    await resetAuthState({ clearToken, removeFamilyId, clearQueryCache });

    expect(clearToken).toHaveBeenCalledTimes(1);
    expect(removeFamilyId).toHaveBeenCalledTimes(1);
    expect(clearQueryCache).toHaveBeenCalledTimes(1);
  });

  it("still clears the query cache when token storage throws", async () => {
    const clearToken = jest.fn().mockRejectedValue(new Error("secure store unavailable"));
    const removeFamilyId = jest.fn().mockResolvedValue(undefined);
    const clearQueryCache = jest.fn();

    await expect(
      resetAuthState({ clearToken, removeFamilyId, clearQueryCache }),
    ).resolves.toBeUndefined();

    expect(clearQueryCache).toHaveBeenCalledTimes(1);
  });
});
