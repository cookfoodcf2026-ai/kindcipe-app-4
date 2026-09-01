import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ToastType = "success" | "error" | "info";

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide?: () => void;
  duration?: number;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
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
  const [toast, setToast] = useState<{ id: number; visible: boolean; message: string; type: ToastType; duration: number }>({
    id: 0,
    visible: false,
    message: "",
    type: "success",
    duration: 3000,
  });

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success", duration = 3000) => {
    setToast(prev => ({
      id: prev.id + 1,
      visible: true,
      message,
      type,
      duration,
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
        onHide={hideToast}
      />
    </ToastContext.Provider>
  );
}

export default function Toast({ visible, message, type = "success", onHide, duration = 3000 }: ToastProps) {
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
        <Ionicons name={icon} size={16} color="#fff" />
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
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
    pointerEvents: "none",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
});
