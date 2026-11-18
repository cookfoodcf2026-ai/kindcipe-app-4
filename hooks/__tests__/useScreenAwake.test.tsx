/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react-native";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

import {
  useNativeScreenAwake,
  useWebScreenAwake,
} from "../useScreenAwake";

type Visibility = "visible" | "hidden";

type WakeLockSentinelMock = {
  release: jest.Mock<Promise<void>, []>;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

let visibility: Visibility = "visible";
let sentinel: WakeLockSentinelMock;
let request: jest.Mock;

function flush() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  visibility = "visible";
  sentinel = {
    release: jest.fn(() => Promise.resolve()),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  request = jest.fn(() => Promise.resolve(sentinel));

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => visibility !== "visible",
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });

  (activateKeepAwakeAsync as jest.Mock).mockResolvedValue(undefined);
  (deactivateKeepAwake as jest.Mock).mockResolvedValue(undefined);
});

it("does not request a wake lock while the document is hidden", async () => {
  visibility = "hidden";

  const { unmount } = await renderHook(() => useWebScreenAwake());
  await flush();

  expect(request).not.toHaveBeenCalled();
  await unmount();
});

it("swallows a rejected request and retries after returning to foreground", async () => {
  request.mockRejectedValueOnce(new Error("NotAllowedError: Document is hidden"));
  const onUnhandled = jest.fn();
  process.on("unhandledRejection", onUnhandled);

  const { unmount } = await renderHook(() => useWebScreenAwake());
  await flush();

  expect(request).toHaveBeenCalledTimes(1);
  expect(onUnhandled).not.toHaveBeenCalled();

  visibility = "hidden";
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  visibility = "visible";
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await flush();

  expect(request).toHaveBeenCalledTimes(2);
  expect(onUnhandled).not.toHaveBeenCalled();
  expect(sentinel.addEventListener).toHaveBeenCalledWith(
    "release",
    expect.any(Function),
  );

  process.removeListener("unhandledRejection", onUnhandled);
  await unmount();
});

it("swallows native keep-awake activation failures", async () => {
  (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(
    new Error("Document is hidden"),
  );
  const onUnhandled = jest.fn();
  process.on("unhandledRejection", onUnhandled);

  const { unmount } = await renderHook(() => useNativeScreenAwake());
  await flush();

  expect(onUnhandled).not.toHaveBeenCalled();
  expect(deactivateKeepAwake).not.toHaveBeenCalled();

  process.removeListener("unhandledRejection", onUnhandled);
  await unmount();
});
