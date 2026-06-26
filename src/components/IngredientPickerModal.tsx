import { useState, useMemo, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet,
  Dimensions, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BRAND = "#013E77";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const BORDER = "#E5E7EB";
const ALWAYS_UNCHECKED = new Set([
  "水", "熱水", "凍水", "滾水",
  "鹽",
  "糖", "冰糖", "砂糖", "紅糖",
  "油", "食用油", "植物油", "橄油", "花生油",
  "生抽", "老抽", "醬油", "豉油",
  "蠔油",
  "胡椒粉", "黑胡椒粉", "白胡椒粉",
  "醋", "米醋", "陳醋",
  "料酒", "米酒", "紹興酒",
  "雞粉", "味精",
  "生粉", "粟粉",
]);

function shouldUncheck(ing: PickerIngredient): boolean {
  return ALWAYS_UNCHECKED.has(ing.name);
}

export type PickerIngredient = {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
};

export type PickerRecipe = {
  id: string;
  name: string;
  date?: string;
  ingredients: PickerIngredient[];
};

export type ConfirmedItem = {
  recipeId: string;
  recipeName: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  plannedDate?: string;
};

interface Props {
  visible: boolean;
  recipes: PickerRecipe[];
  title?: string;
  initialSelected?: Set<string>;
  onConfirm: (items: ConfirmedItem[]) => void;
  onSkip: () => void;
}

export default function IngredientPickerModal({
  visible, recipes, title, initialSelected, onConfirm, onSkip,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && recipes.length > 0) {
      if (initialSelected) {
        setSelected(new Set(initialSelected));
      } else {
        const def = new Set<string>();
        recipes.forEach((r) => {
          r.ingredients.forEach((ing, idx) => {
            if (!shouldUncheck(ing)) {
              def.add(`${r.id}::${idx}`);
            }
          });
        });
        setSelected(def);
      }
    }
  }, [visible, recipes, initialSelected]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirmItems = useMemo(() => {
    const items: ConfirmedItem[] = [];
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        if (selected.has(`${r.id}::${idx}`)) {
          items.push({
            recipeId: r.id,
            recipeName: r.name,
            name: ing.name,
            quantity: String(ing.quantity ?? ""),
            unit: ing.unit || "",
            category: ing.category || "食材",
            plannedDate: r.date,
          });
        }
      });
    });
    return items;
  }, [recipes, selected]);

  const totalIngredients = useMemo(
    () => recipes.reduce((sum, r) => sum + r.ingredients.length, 0),
    [recipes],
  );

  const multiRecipe = recipes.length > 1;
  const modalTitle = title || (multiRecipe
    ? `加入食材到購物清單（${recipes.length} 個食譜）`
    : "加入食材到購物清單");

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={[s.sheet, { height: "75%" }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{modalTitle}</Text>
              {multiRecipe && (
                <Text style={s.subTitle}>
                  {recipes.map((r) => r.name).join("、")}
                </Text>
              )}
              {!multiRecipe && recipes.length === 1 && (
                <Text style={s.subTitle}>{recipes[0].name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onSkip}>
              <Ionicons name="close-outline" size={20} color={SUB} />
            </TouchableOpacity>
          </View>

          <View style={s.hintRow}>
            <Ionicons name="information-circle-outline" size={12} color={SUB} />
            <Text style={s.hintTxt}>調味料預設不勾選</Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {recipes.map((r) => (
              <View key={r.id} style={s.recipeGroup}>
                {multiRecipe && (
                  <Text style={s.recipeGroupName}>{r.name}</Text>
                )}
                {r.ingredients.map((ing, idx) => {
                  const key = `${r.id}::${idx}`;
                  const isOn = selected.has(key);
                  const isSeasoningItem = shouldUncheck(ing);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.row, idx < r.ingredients.length - 1 && s.rowBorder]}
                      onPress={() => toggle(key)}
                    >
                      <View style={[s.dot, isOn && s.dotActive]}>
                        {isOn && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={[s.ingName, isSeasoningItem && s.seasoningName]} numberOfLines={1}>
                        {ing.name}
                      </Text>
                      <Text style={s.qty}>{ing.quantity} {ing.unit}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.confirmBtn, confirmItems.length === 0 && s.confirmBtnDisabled]}
              onPress={() => onConfirm(confirmItems)}
              disabled={confirmItems.length === 0}
            >
              <Ionicons name="cart-outline" size={14} color={confirmItems.length > 0 ? "#fff" : SUB} />
              <Text style={[s.confirmTxt, confirmItems.length === 0 && s.confirmTxtDisabled]}>
                {confirmItems.length > 0
                  ? `加入 ${confirmItems.length} 項食材`
                  : `跳過（共 ${totalIngredients} 項）`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={onSkip}>
              <Text style={s.skipTxt}>跳過，不加入購物清單</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  subTitle: {
    fontSize: 12,
    color: SUB,
    marginTop: 2,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
  },
  hintTxt: {
    fontSize: 11,
    color: SUB,
  },
  recipeGroup: {
    paddingHorizontal: 16,
  },
  recipeGroupName: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActive: {
    backgroundColor: BRAND,
  },
  ingName: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    minWidth: 0,
  },
  seasoningName: {
    color: SUB,
  },
  qty: {
    fontSize: 12,
    color: SUB,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: BRAND,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnDisabled: {
    backgroundColor: "#F3F4F6",
  },
  confirmTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  confirmTxtDisabled: {
    color: SUB,
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  skipTxt: {
    fontSize: 13,
    color: SUB,
  },
});
