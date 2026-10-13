/**
 * Cross-platform share: native Share sheet; web Web Share API when available,
 * otherwise copy to clipboard (react-native-web's Share is a no-op / unsupported
 * on many desktop browsers).
 */
import { Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";

export async function shareOrCopy(message: string, title?: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        await nav.share({ text: message, title });
        return;
      }
      await Clipboard.setStringAsync(message);
      return;
    }
    await Share.share({ message, title });
  } catch {
    try { await Clipboard.setStringAsync(message); } catch { /* ignore */ }
  }
}
