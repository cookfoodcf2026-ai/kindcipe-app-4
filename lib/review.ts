import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";

const OPENS_KEY = "kindcipe_app_opens";
const REVIEWED_KEY = "kindcipe_review_requested";
const MIN_OPENS = 5;

/**
 * Ask for an App Store / Play review after the user has opened the app a few
 * times. The OS decides whether the prompt is actually shown (and it is
 * rate-limited by the platform), so this is safe to call often.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(REVIEWED_KEY);
    if (already === "true") return;

    const raw = await AsyncStorage.getItem(OPENS_KEY);
    const opens = (Number(raw) || 0) + 1;
    await AsyncStorage.setItem(OPENS_KEY, String(opens));
    if (opens < MIN_OPENS) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    if (Platform.OS === "ios") {
      // Give the UI a moment to settle before prompting.
      await new Promise((r) => setTimeout(r, 1500));
    }
    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEWED_KEY, "true");
  } catch {
    // Never let the review prompt break the app.
  }
}
