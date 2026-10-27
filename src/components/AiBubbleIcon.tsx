import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { canva } from "@/app/styles/colors";

type Props = {
  size?: number;
};

export default function AiBubbleIcon({ size = 26 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path
          d="M7 3h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-7l-6 5v-5H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"
          fill={canva.brown}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.labelWrap]}>
        <Text style={[styles.label, { fontSize: size * 0.3 }]}>AI</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  labelWrap: { alignItems: "center", justifyContent: "center", paddingBottom: 4 },
  label: { color: canva.bg, fontWeight: "900", letterSpacing: 0.4 },
});
