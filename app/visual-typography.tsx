import { ScrollView, StyleSheet, Text, View } from "react-native";
import { typography } from "@/app/styles/typography";

/**
 * Auth-free visual fixture for typography regression.
 * It intentionally renders representative text from Home, More, Settings and
 * RecipeCard using the same tokens as the real screens.
 */
export default function VisualTypographyScreen() {
  if (!__DEV__ && process.env.EXPO_PUBLIC_VISUAL_TEST !== "1") return null;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View testID="visual-home" style={styles.block}>
        <View style={styles.homeHeader}>
          <Text style={[typography.h2, styles.homeTitle]}>Kindcipe</Text>
          <Text style={[typography.caption, styles.muted]}>Good morning, mavis</Text>
        </View>
        <Text style={[typography.display, styles.homeHero]}>Plan dinner for me</Text>
        <Text style={[typography.bodySmall, styles.bodyStrong]}>One-tap AI: 3 dishes + 1 soup</Text>
        <Text style={[typography.button, styles.button]}>Help me plan</Text>
      </View>

      <View testID="visual-more" style={styles.block}>
        <Text testID="visual-more-title" style={[typography.h1, styles.dark]}>More</Text>
        <Text style={[typography.body, styles.muted]}>Hi mavis, what are we cooking today?</Text>
        <Text style={[typography.h3, styles.section]}>Recipes</Text>
        <Text style={[typography.body, styles.dark]}>Official Recipes</Text>
        <Text style={[typography.bodySmall, styles.muted]}>Browse curated recipes</Text>
      </View>

      <View testID="visual-settings" style={styles.block}>
        <Text style={[typography.h3, styles.dark]}>Settings</Text>
        <Text style={[typography.label, styles.dark]}>Account</Text>
        <Text style={[typography.caption, styles.muted]}>Language & region</Text>
        <Text style={[typography.button, styles.button]}>Save changes</Text>
      </View>

      <View testID="visual-recipe" style={styles.block}>
        <Text style={[typography.cardTitle, styles.dark]}>Black Pepper Beef Tenderloin</Text>
        <Text style={[typography.meta, styles.muted]}>30 min · 4 servings</Text>
        <Text style={[typography.bodySmall, styles.bodyStrong]}>A quick weeknight stir-fry.</Text>
        <Text style={[typography.button, styles.smallButton]}>Add to meal plan</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF8EF" },
  content: { padding: 16, gap: 20 },
  block: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 6 },
  homeHeader: { gap: 2, marginBottom: 6 },
  homeTitle: { color: "#183B56" },
  homeHero: { color: "#183B56", letterSpacing: -0.5 },
  dark: { color: "#1A1A1A" },
  muted: { color: "#6B7280" },
  bodyStrong: { color: "#183B56", fontWeight: "700" },
  section: { color: "#1A1A1A", marginTop: 8 },
  button: { color: "#FFFFFF", backgroundColor: "#F47B3A", alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, overflow: "hidden" },
  smallButton: { color: "#FFFFFF", backgroundColor: "#183B56", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, overflow: "hidden" },
});
