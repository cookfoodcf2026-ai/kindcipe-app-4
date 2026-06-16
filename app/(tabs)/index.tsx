import { View, Text, StyleSheet } from "react-native";

export default function RecipesTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的食譜</Text>
      <Text style={styles.subtitle}>你的食譜庫</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#013E77",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
});
