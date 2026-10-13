/**
 * Web Alert shim.
 *
 * react-native-web ships `Alert.alert` as a no-op (`static alert() {}`), so every
 * `Alert.alert(...)` in the app silently does nothing on web. This shim (web only)
 * maps the RN Alert API onto the browser's native alert/confirm so confirmations,
 * errors and prompts keep working. Side-effect import — see app/_layout.tsx.
 *
 * Limitation: browsers only support a boolean confirm, so with 2+ buttons we map
 * the browser OK to the primary (non-cancel) button and Cancel to the cancel one.
 */
import { Alert, Platform } from "react-native";

type WebAlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: "default" | "cancel" | "destructive";
};

if (Platform.OS === "web" && typeof window !== "undefined") {
  const impl = (title?: string, message?: string, buttons?: WebAlertButton[]) => {
    const body = [title, message].filter(Boolean).join("\n\n");
    const list: WebAlertButton[] = Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: "OK" }];

    if (list.length === 1) {
      try { window.alert(body); } catch { /* ignore */ }
      list[0]?.onPress?.();
      return;
    }

    const cancelBtn = list.find((b) => b.style === "cancel");
    const primary = list.find((b) => b.style !== "cancel") ?? list[list.length - 1];
    let ok = false;
    try {
      ok = window.confirm(body + (primary?.text ? `\n\n[${primary.text}]` : ""));
    } catch {
      ok = false;
    }
    if (ok) primary?.onPress?.();
    else cancelBtn?.onPress?.();
  };

  (Alert as unknown as { alert: typeof impl }).alert = impl;
}

export {};
