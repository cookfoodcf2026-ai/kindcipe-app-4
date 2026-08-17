import { Text, ColorValue } from "react-native";

export type StepPart = { text: string; isTerm: boolean };

export function computeStepParts(text: string, terms: readonly string[]): StepPart[] {
  if (!text) return [{ text: "", isTerm: false }];
  const parts: StepPart[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let matched = false;
    for (const term of terms) {
      const idx = remaining.indexOf(term);
      if (idx >= 0) {
        if (idx > 0) parts.push({ text: remaining.slice(0, idx), isTerm: false });
        parts.push({ text: term, isTerm: true });
        remaining = remaining.slice(idx + term.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      parts.push({ text: remaining, isTerm: false });
      break;
    }
  }
  return parts;
}

export function renderStepParts(
  parts: StepPart[],
  onTermPress: ((term: string) => void) | undefined,
  termColor: ColorValue = "#013E77"
) {
  return (
    <Text>
      {parts.map((p, i) =>
        p.isTerm ? (
          <Text
            key={i}
            style={[
              { color: termColor, fontWeight: "700" },
              onTermPress ? { textDecorationLine: "underline" } : {},
            ]}
            onPress={onTermPress ? () => onTermPress(p.text) : undefined}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}
