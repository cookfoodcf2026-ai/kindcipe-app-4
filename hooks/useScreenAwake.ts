import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCallback, useId, useRef } from "react";
import { Platform } from "react-native";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

function getWakeLockApi(): WakeLockApi | null {
  if (typeof navigator === "undefined") return null;
  const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  return wakeLock && typeof wakeLock.request === "function" ? wakeLock : null;
}

function releaseWakeLock(lock: WakeLockSentinelLike | null) {
  if (!lock) return;
  try {
    void lock.release().catch(() => undefined);
  } catch {
    return;
  }
}

function useNativeScreenAwake() {
  const tag = useId();
  const runId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const activeTag = `${tag}-${runId.current++}`;
      let cancelled = false;
      let activated = false;

      void activateKeepAwakeAsync(activeTag)
        .then(() => {
          activated = true;
          if (cancelled) return deactivateKeepAwake(activeTag);
          return undefined;
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
        if (activated) {
          void deactivateKeepAwake(activeTag).catch(() => undefined);
        }
      };
    }, [tag]),
  );
}

function useWebScreenAwake() {
  useFocusEffect(
    useCallback(() => {
      if (typeof document === "undefined") return;
      const wakeLock = getWakeLockApi();
      if (!wakeLock) return;

      let disposed = false;
      let acquiring = false;
      let sentinel: WakeLockSentinelLike | null = null;
      let detachRelease: (() => void) | null = null;

      const clearSentinel = () => {
        detachRelease?.();
        detachRelease = null;
        sentinel = null;
      };

      const release = () => {
        const lock = sentinel;
        clearSentinel();
        releaseWakeLock(lock);
      };

      const acquire = () => {
        if (disposed || acquiring || sentinel || document.visibilityState !== "visible") {
          return;
        }

        acquiring = true;
        let request: Promise<WakeLockSentinelLike>;
        try {
          request = wakeLock.request("screen");
        } catch {
          acquiring = false;
          return;
        }

        void request
          .then((lock) => {
            acquiring = false;
            if (disposed || document.visibilityState !== "visible") {
              releaseWakeLock(lock);
              return;
            }

            const handleRelease = () => {
              if (sentinel === lock) clearSentinel();
            };
            lock.addEventListener?.("release", handleRelease);
            detachRelease = lock.removeEventListener
              ? () => lock.removeEventListener?.("release", handleRelease)
              : null;
            sentinel = lock;
          })
          .catch(() => {
            acquiring = false;
          });
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          acquire();
          return;
        }
        release();
      };

      document.addEventListener("touchend", acquire, { passive: true });
      document.addEventListener("click", acquire);
      document.addEventListener("keydown", acquire);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      acquire();

      return () => {
        disposed = true;
        document.removeEventListener("touchend", acquire);
        document.removeEventListener("click", acquire);
        document.removeEventListener("keydown", acquire);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        release();
      };
    }, []),
  );
}

export const useScreenAwake =
  Platform.OS === "web" ? useWebScreenAwake : useNativeScreenAwake;

export default useScreenAwake;
