import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
}

export async function scheduleMealNotification(mealName: string, mealTime: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📅 餐單已更新",
      body: `「${mealName}」已加入 ${mealTime} 的餐單`,
      sound: true,
    },
    trigger: null,
  });
}

export async function scheduleShoppingNotification(itemName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🛒 購物清單已更新",
      body: `「${itemName}」已加入購物清單`,
      sound: true,
    },
    trigger: null,
  });
}
