import { useState, useRef } from "react";

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  return {
    expoPushToken,
    notificationPermission,
    notificationListener,
    responseListener,
  };
}