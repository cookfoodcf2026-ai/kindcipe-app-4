import * as Sentry from "@sentry/react-native";

export function initGlobalErrorHandler() {
  const defaultHandler =
    (ErrorUtils?.getGlobalHandler?.() as
      | ((error: unknown, isFatal?: boolean) => void)
      | undefined) ??
    ((error: unknown, isFatal?: boolean) => {
      console.error("Unhandled error:", error, "isFatal:", isFatal);
    });

  if (typeof ErrorUtils?.setGlobalHandler !== "function") return;

  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    try {
      if (!__DEV__) {
        Sentry.captureException(error);
      }
    } catch {
      // swallow — fall through to default handler
    }
    defaultHandler(error, isFatal);
  });
}
