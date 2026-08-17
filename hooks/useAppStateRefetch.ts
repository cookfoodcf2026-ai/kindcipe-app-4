import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useAppStateRefetch(refetch: () => void) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);
}
