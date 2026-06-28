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

// 調味料/基本食材 - 預設唔勾選
const SEASONING_KEYWORDS = [
  "鹽", "糖", "油", "醬油", "生抽", "老抽", "豉油", "蠔油",
  "胡椒粉", "醋", "料酒", "米酒", "紹興酒", "雞粉", "味精",
  "生粉", "粟粉", "蒜蓉", "薑蓉", "蔥花",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "蔬菜": ["菜", "蔥", "薑", "蒜", "洋蔥", "蕃茄", "番茄", "薯仔", "紅蘿蔔", "蘿蔔", "青瓜", "南瓜", "冬瓜", "茄子", "椰菜", "生菜", "菠菜", "白菜", "豆", "芽", "菇", "木耳", "筍"],
  "肉類": ["雞", "豬", "牛", "羊", "肉", "排骨", "翼", "腿", "腩", "扒"],
  "海鮮": ["魚", "蝦", "蟹", "貝", "魷魚", "章魚", "帶子", "蠔", "蜆", "蛤"],
  "蛋奶": ["蛋", "奶", "芝士", "牛油"],
  "主食": ["米", "麵", "粉", "飯", "麵包", "餃子", "雲吞"],
  "調味料": SEASONING_KEYWORDS,
  "乾貨": ["乾", "臘", "鹹蛋", "皮蛋", "腐乳"],
};

const CATEGORY_EMOJI: Record<string, string> = {
  "蔬菜": "🥬",
  "肉類": "🥩",
  "海鮮": "🐟",
  "蛋奶": "🥚",
  "主食": "🍚",
  "調味料": "🧂",
  "乾貨": "📦",
  "飲品": "🥤",
  "其他": "📦",
};

const CATEGORY_ORDER = ["蔬菜", "肉類", "海鮮", "蛋奶", "主食", "乾貨", "飲品", "調味料", "其他"];

function detectCategory(name: string): string {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === "調味料") continue;
    for (const kw of keywords) {
      if (name.includes(kw)) return cat;
    }
  }
  for (const kw of SEASONING_KEYWORDS) {
    if (name.includes(kw)) return "調味料";
  }
  return "其他";
}

function isSeasoning(name: string): boolean {
  return SEASONING_KEYWORDS.some((kw) => name.includes(kw));
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

  // 將食材按類別分組
  const groupedIngredients = useMemo(() => {
    const groups: Record<string, Array<{ recipeId: string; recipeName: string; ing: PickerIngredient; idx: number; key: string }>> = {};
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        const cat = ing.category || detectCategory(ing.name);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ recipeId: r.id, recipeName: r.name, ing, idx, key: `${r.id}::${idx}` });
      });
    });
    return groups;
  }, [recipes]);

  const seasoningCount = useMemo(
    () => Object.entries(groupedIngredients).reduce((sum, [cat, items]) => cat === "調味料" ? sum + items.length : sum, 0),
    [groupedIngredients]
  );

  useEffect(() => {
    if (visible && recipes.length > 0) {
      if (initialSelected) {
        setSelected(new Set(initialSelected));
      } else {
        const def = new Set<string>();
        recipes.forEach((r) => {
          r.ingredients.forEach((ing, idx) => {
            if (!isSeasoning(ing.name)) {
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

  const selectAllMain = () => {
    const newSet = new Set<string>();
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        if (!isSeasoning(ing.name)) {
          newSet.add(`${r.id}::${idx}`);
        }
      });
    });
    setSelected(newSet);
  };

  const selectAll = () => {
    const newSet = new Set<string>();
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        newSet.add(`${r.id}::${idx}`);
      });
    });
    setSelected(newSet);
  };

  const deselectAll = () => {
    setSelected(new Set());
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
            category: ing.category || detectCategory(ing.name),
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

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(groupedIngredients);
    return cats.sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a);
      const idxB = CATEGORY_ORDER.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [groupedIngredients]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={[s.sheet, { height: "80%" }]}>
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

          <View style={s.quickActions}>
            <TouchableOpacity style={s.quickBtn} onPress={selectAllMain}>
              <Ionicons name="checkmark-done" size={14} color={BRAND} />
              <Text style={s.quickBtnText}>全選主要食材</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickBtn} onPress={selectAll}>
              <Ionicons name="checkmark" size={14} color={BRAND} />
              <Text style={s.quickBtnText}>全選</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickBtn} onPress={deselectAll}>
              <Ionicons name="close" size={14} color={SUB} />
              <Text style={[s.quickBtnText, { color: SUB }]}>取消</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {sortedCategories.map((cat) => {
              const items = groupedIngredients[cat] || [];
              const isSeasoningGroup = cat === "調味料";
              return (
                <View key={cat} style={[s.categoryGroup, isSeasoningGroup && s.seasoningGroup]}>
                  <View style={s.categoryHeader}>
                    <Text style={s.categoryEmoji}>{CATEGORY_EMOJI[cat] || "📦"}</Text>
                    <Text style={[s.categoryName, isSeasoningGroup && s.seasoningLabel]}>
                      {cat}
                    </Text>
                    <Text style={s.categoryCount}>{items.length}</Text>
                    {isSeasoningGroup && (
                      <Text style={s.seasoningHint}>（家中常備，預設不加入）</Text>
                    )}
                  </View>
                  {items.map(({ ing, key, recipeName }) => {
                    const isOn = selected.has(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={s.row}
                        onPress={() => toggle(key)}
                      >
                        <View style={[s.dot, isOn && s.dotActive]}>
                          {isOn && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={s.ingName} numberOfLines={1}>
                          {ing.name}
                        </Text>
                        <Text style={s.qty}>{ing.quantity} {ing.unit}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
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
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E8F0FE",
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: BRAND,
  },
  categoryGroup: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  seasoningGroup: {
    backgroundColor: "#FEF9C3",
    marginTop: 8,
    paddingTop: 10,
    paddingBottom: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 4,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
  },
  seasoningLabel: {
    color: "#92400E",
  },
  categoryCount: {
    fontSize: 11,
    color: SUB,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  seasoningHint: {
    fontSize: 11,
    color: "#92400E",
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
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
