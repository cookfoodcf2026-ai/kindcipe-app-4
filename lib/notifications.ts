import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "./i18n";

const isSimulator = __DEV__ && Platform.OS === "ios";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return false;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "預設通知",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    return true;
  } catch (err) {
    if (isSimulator) {
      console.warn("Notification permission failed (simulator - expected):", err);
      return false;
    }
    console.error("Notification permission error:", err);
    return false;
  }
}

export async function scheduleMealNotification(mealName: string, mealTime: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t("notif.mealUpdated" as any),
      body: i18n.t("notif.mealAdded" as any, { name: mealName, time: mealTime }),
      sound: true,
    },
    trigger: null,
  });
}

export async function scheduleShoppingNotification(itemName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t("notif.shoppingUpdated" as any),
      body: i18n.t("notif.itemAdded" as any, { name: itemName }),
      sound: true,
    },
    trigger: null,
  });
}

// ─── Meal reminder (self-set time + frequency) ───────────────────────────────

export type MealReminderSetting = {
  enabled: boolean;
  hour: number;
  minute: number;
  // empty array = every day; otherwise JS weekday numbers 0-6 (0=Sunday)
  weekdays: number[];
};

const REMINDER_KEY = "@kindcipe:meal-reminder";

export const DEFAULT_MEAL_REMINDER: MealReminderSetting = {
  enabled: false,
  hour: 17,
  minute: 0,
  weekdays: [],
};

export async function getMealReminderSetting(): Promise<MealReminderSetting> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_KEY);
    if (!raw) return { ...DEFAULT_MEAL_REMINDER };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      hour: typeof parsed.hour === "number" ? parsed.hour : DEFAULT_MEAL_REMINDER.hour,
      minute: typeof parsed.minute === "number" ? parsed.minute : DEFAULT_MEAL_REMINDER.minute,
      weekdays: Array.isArray(parsed.weekdays) ? parsed.weekdays.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
    };
  } catch {
    return { ...DEFAULT_MEAL_REMINDER };
  }
}

export async function saveMealReminderSetting(setting: MealReminderSetting): Promise<void> {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(setting));
}

// Applies a reminder setting: requests permission when enabling, then reschedules.
export async function applyMealReminder(setting: MealReminderSetting): Promise<boolean> {
  if (setting.enabled) {
    const ok = await requestNotificationPermission();
    if (!ok) return false;
  }
  // Only the repeating reminder is scheduled in this app; safe to clear all scheduled.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (setting.enabled) {
    await scheduleMealReminder(setting);
  }
  return true;
}

async function scheduleMealReminder(setting: MealReminderSetting) {
  const content: Notifications.NotificationContentInput = {
    title: i18n.t("notif.mealReminderTitle" as any),
    body: i18n.t("notif.mealReminderBody" as any),
    sound: true,
    data: { route: "/(tabs)/index" },
  };

  if (setting.weekdays.length === 0) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: setting.hour,
        minute: setting.minute,
      },
    });
    return;
  }

  // One weekly trigger per selected weekday (expo weekday: 1=Sun ... 7=Sat)
  for (const jsDay of setting.weekdays) {
    const weekday = jsDay + 1;
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: setting.hour,
        minute: setting.minute,
      },
    });
  }
}
