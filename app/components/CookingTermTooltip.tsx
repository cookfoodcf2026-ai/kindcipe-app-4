import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { COOKING_TERMS } from "@/lib/cookingTerms";

interface Props {
  visible: boolean;
  term: string;
  onClose: () => void;
}

export default function CookingTermTooltip({ visible, term, onClose }: Props) {
  const info = COOKING_TERMS[term];
  if (!visible || !info) return null;

  const LANG_LABELS: Record<string, string> = {
    en: "English",
    fil: "Filipino",
    id: "Bahasa",
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box}>
          <Text style={styles.term}>{term}</Text>
          <Text style={styles.desc}>{info.zh}</Text>
          <View style={styles.langSection}>
            {(["en", "fil", "id"] as const).map((lang) => (
              <View key={lang} style={styles.langRow}>
                <Text style={styles.langLabel}>{LANG_LABELS[lang]}</Text>
                <Text style={styles.langValue}>{info[lang]}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  term: {
    fontSize: 22,
    fontWeight: "900",
    color: "#013E77",
    marginBottom: 8,
  },
  desc: {
    fontSize: 15,
    color: "#1C1C1E",
    lineHeight: 22,
    marginBottom: 16,
  },
  langSection: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EBEBEB",
  },
  langRow: {
    flexDirection: "row",
    gap: 6,
  },
  langLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    width: 60,
  },
  langValue: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 20,
    flex: 1,
  },
});
