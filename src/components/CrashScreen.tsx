import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type CrashScreenProps = {
  onRestart?: () => void;
};

export function CrashScreen({ onRestart }: CrashScreenProps) {
  const router = useRouter();

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
    } else {
      router.replace("/" as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="warning-outline" size={48} color="#E66837" />
        <Text style={styles.title}>發生錯誤</Text>
        <Text style={styles.message}>
          App 遇到未預期的問題，這已回報給開發者。您可以重新整理頁面或重新啟動 App。
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleRestart}>
          <Text style={styles.buttonText}>重新開始</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  card: {
    alignItems: "center",
    gap: 16,
    maxWidth: 320,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#013E77",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
