import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ToastType = "success" | "error" | "info";

type ToastAction = { label: string; onPress: () => void };

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide?: () => void;
  duration?: number;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; visible: boolean; message: string; type: ToastType; duration: number; action?: ToastAction }>({
    id: 0,
    visible: false,
    message: "",
    type: "success",
    duration: 3000,
  });

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success", duration = 3000, action?: ToastAction) => {
    setToast(prev => ({
      id: prev.id + 1,
      visible: true,
      message,
      type,
      duration,
      action,
    }));
  }, []);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        key={toast.id}
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        action={toast.action}
        onHide={hideToast}
      />
    </ToastContext.Provider>
  );
}

export default function Toast({ visible, message, type = "success", onHide, duration = 3000, action }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, message, duration, onHide, opacity, translateY]);

  if (!visible) return null;

  const bgColor = type === "success" ? "#16A34A" : type === "error" ? "#DC2626" : "#013E77";
  const icon = type === "success" ? "checkmark-circle" : type === "error" ? "alert-circle" : "information-circle";

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.toast, { backgroundColor: bgColor }]}>
        <View style={styles.row}>
          <Ionicons name={icon} size={16} color="#fff" />
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </View>
        {action ? (
          <Pressable
            onPress={() => { action.onPress(); onHide?.(); }}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Text style={styles.actionTxt}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
  },
  message: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  actionBtn: {
    alignSelf: "center",
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#fff",
    minWidth: 96,
    alignItems: "center",
  },
  actionTxt: {
    color: "#013E77",
    fontSize: 18,
    fontWeight: "800",
  },
});
