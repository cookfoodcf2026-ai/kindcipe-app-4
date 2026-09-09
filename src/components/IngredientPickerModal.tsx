import { useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet,
  Dimensions, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PlanDatePicker from "@/src/components/PlanDatePicker";
import { categorizeIngredient, isSeasoning } from "@/constants/ingredients";
import { DateUtil } from "@/src/lib/DateUtil";
import { formatIngredientDisplay } from "@/src/lib/ingredientDisplay";

const BRAND = "#013E77";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const BORDER = "#E5E7EB";

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

// 向舊名兼容；實際邏輯搬咗去 @/constants/ingredients
const detectCategory = categorizeIngredient;

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
  mealType?: string;  // 用餐時段：breakfast / lunch / dinner / snack
  fromMealPlanId?: number;
  ingredients: PickerIngredient[];
};

export type ConfirmedItem = {
  recipeId: string;
  recipeName: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  plannedDate?: string;  // 採買日（購物車歸類日期）
  mealDate?: string;     // 用餐日（排餐日，標籤顯示）
  fromMealPlanId?: number;
};

interface Props {
  visible: boolean;
  recipes: PickerRecipe[];
  title?: string;
  initialSelected?: Set<string>;
  loading?: boolean;
  
  // 新增：明確語意（優先使用）
  mealDate?: string;          // 用餐日（排餐日）
  defaultBuyDate?: string;    // 預設採買日（通常係用餐日前一日）
  
  // 保留：向後兼容（如果無 mealDate 就用 defaultDate）
  defaultDate?: string;       // @deprecated 但保留
  
  onDateChange?: (date: string) => void;
  showDateSelector?: boolean;
  maxDate?: string;
  /** #3: 已經喺購物清單嘅 key（`${r.id}::${idx}`）——顯示「已加入」、唔可以再勾 */
  alreadyAddedKeys?: Set<string>;
  onConfirm: (items: ConfirmedItem[]) => void;
  onSkip: () => void;
}

export default function IngredientPickerModal({
  visible, recipes, title, initialSelected, loading = false, 
  mealDate, defaultBuyDate, defaultDate, onDateChange, showDateSelector = true, maxDate, alreadyAddedKeys, onConfirm, onSkip,
}: Props) {
  const today = DateUtil.todayISO();
  
  // 向後兼容計算：如果無 mealDate 就用 defaultDate
  const effectiveMealDate = mealDate || defaultDate;
  
  // 採買日優先順序：defaultBuyDate -> (如果有 mealDate 則取前一日) -> defaultDate
  const effectiveBuyDate = defaultBuyDate || (mealDate ? DateUtil.getDayBefore(mealDate) : defaultDate);
  
  // 修改：允許選擇過去日期（如果 maxDate 存在，表示係排餐日，可以選前一日）
  const normalizedDefaultDate = useMemo(() => {
    if (!effectiveBuyDate) return today;
    // 如果有 maxDate（排餐日），優先使用 effectiveBuyDate（即使係過去）
    if (maxDate && effectiveBuyDate <= maxDate) {
      return effectiveBuyDate;
    }
    // 如果 effectiveBuyDate 係未來，就用 effectiveBuyDate
    if (effectiveBuyDate >= today) {
      return effectiveBuyDate;
    }
    // 否則用 today
    return today;
  }, [effectiveBuyDate, maxDate, today]);
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 修復 1: 直接綁定 normalizedDefaultDate
  const [date, setDate] = useState(normalizedDefaultDate || effectiveBuyDate || today);
  
  // 修復 2: useEffect 確保 visible 為 true 時，第一時間校正 date
  useEffect(() => {
    if (visible && normalizedDefaultDate) {
      console.log("[IngredientPickerModal] Correcting date:", {
        from: date,
        to: normalizedDefaultDate,
      });
      setDate(normalizedDefaultDate);
    }
  }, [visible, normalizedDefaultDate]);
  
  // 診斷日誌
  useEffect(() => {
    if (visible) {
      console.log("[IngredientPickerModal] Props:", {
        mealDate,
        defaultBuyDate,
        defaultDate,
        effectiveMealDate,
        effectiveBuyDate,
        maxDate,
        today,
        normalizedDefaultDate,
        date,
        visible,
      });
    }
  }, [mealDate, defaultBuyDate, defaultDate, effectiveMealDate, effectiveBuyDate, maxDate, today, normalizedDefaultDate, date, visible]);

  // 將食材按類別分組
  const groupedIngredients = useMemo(() => {
    const groups: Record<string, Array<{ recipeId: string; recipeName: string; ing: PickerIngredient; idx: number; key: string }>> = {};
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        const cat = ing.category || detectCategory(ing.name);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ recipeId: r.id, recipeName: r.name, ing, idx, key: `${r.id}::${idx}::${date}` });  // ← 加日期入 key
      });
    });
    return groups;
  }, [recipes, date]);

  const seasoningCount = useMemo(
    () => Object.entries(groupedIngredients).reduce((sum, [cat, items]) => cat === "調味料" ? sum + items.length : sum, 0),
    [groupedIngredients]
  );

  const initializedRef = useRef(false);

  useEffect(() => {
    if (visible && recipes.length > 0 && !initializedRef.current) {
      setDate(normalizedDefaultDate);
      if (initialSelected) {
        setSelected(new Set(initialSelected));
      } else {
        const def = new Set<string>();
        recipes.forEach((r) => {
          r.ingredients.forEach((ing, idx) => {
            const key = `${r.id}::${idx}::${normalizedDefaultDate}`;
            if (alreadyAddedKeys?.has(key)) return;
            // 調味料預設唔勾選（用返現有 isSeasoning 邏輯）
            if (!isSeasoning(ing.name)) {
              def.add(key);
            }
          });
        });
        setSelected(def);
      }
      initializedRef.current = true;
    }
    if (!visible) {
      initializedRef.current = false;
    }
  }, [visible, initialSelected, normalizedDefaultDate, alreadyAddedKeys]);

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
        const key = `${r.id}::${idx}::${date}`;
        if (alreadyAddedKeys?.has(key)) return;
        if (!isSeasoning(ing.name)) {
          newSet.add(key);
        }
      });
    });
    setSelected(newSet);
  };

  const selectAll = () => {
    const newSet = new Set<string>();
    recipes.forEach((r) => {
      r.ingredients.forEach((ing, idx) => {
        const key = `${r.id}::${idx}::${date}`;
        if (alreadyAddedKeys?.has(key)) return;
        newSet.add(key);
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
        const key = `${r.id}::${idx}::${date}`;  // ← 加日期入 key（唔同日子 = 唔同 key）
        if (alreadyAddedKeys?.has(key)) return;
        if (selected.has(key)) {
          items.push({
            recipeId: r.id,
            recipeName: r.name,
            name: ing.name,
            quantity: String(ing.quantity ?? ""),
            unit: ing.unit || "",
            category: ing.category || detectCategory(ing.name),
            plannedDate: date,  // ← 用戶揀嘅採買日（購物車歸類日期）
            mealDate: effectiveMealDate,  // ← 排餐日（標籤，不可變）
            fromMealPlanId: r.fromMealPlanId,
          });
        }
      });
    });
    return items;
  }, [recipes, selected, date, effectiveMealDate, alreadyAddedKeys]);

  const totalIngredients = useMemo(
    () => recipes.reduce((sum, r) => sum + r.ingredients.length, 0),
    [recipes],
  );

  const multiRecipe = recipes.length > 1;
  const modalTitle = title || (multiRecipe
    ? `加入食材到購物清單（${recipes.length} 個食譜）`
    : "加入食材到購物清單");

  // 日期標籤 Helper：解析食譜嘅日期同餐別
  const formatMealPlanDateBadge = useMemo(() => {
    const dates = recipes.filter(r => r.date).map(r => r.date!).sort();
    const mealTypes = [...new Set(recipes.filter(r => r.mealType).map(r => r.mealType!))];
    
    if (dates.length === 0) return null;
    
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const sameDate = minDate === maxDate;
    
    const formatDate = (iso: string) => {
      const d = new Date(iso + "T12:00:00");
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekday = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][d.getDay()];
      return `${month}/${day} (${weekday})`;
    };
    
    const formatMealType = (type: string) => {
      const map: Record<string, string> = {
        breakfast: "早餐",
        lunch: "午餐",
        dinner: "晚餐",
        snack: "小食",
      };
      return map[type] || type;
    };
    
    if (sameDate && mealTypes.length === 1) {
      return `📅 ${formatDate(minDate)} ${formatMealType(mealTypes[0])}`;
    }
    
    if (sameDate && mealTypes.length > 1) {
      return `📅 ${formatDate(minDate)} ${mealTypes.map(formatMealType).join("、")}`;
    }
    
    return `📅 ${formatDate(minDate)} ~ ${formatDate(maxDate)}`;
  }, [recipes]);

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
              {formatMealPlanDateBadge && (
                <View style={s.dateBadge}>
                  <Text style={s.dateBadgeText}>{formatMealPlanDateBadge}</Text>
                </View>
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

          {showDateSelector && (
            <View style={s.dateSection}>
              <Ionicons name="calendar-outline" size={16} color={BRAND} />
              <Text style={s.dateLabel}>購物日期：</Text>
              <PlanDatePicker 
                value={date}
                onChange={(newDate) => {
                  console.log("[PlanDatePicker] Date changed:", {
                    oldValue: date,
                    newValue: newDate,
                  });
                  setDate(newDate);
                  onDateChange?.(newDate);
                }}
                showShortcuts={true}
                maxDate={maxDate}
                // minDate={today}  // 移除 minDate 限制，允許選擇過去日期
              />
            </View>
          )}
          {maxDate && date && date > maxDate && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 16 }}>
              <Ionicons name="warning" size={14} color="#DC2626" />
              <Text style={{ fontSize: 12, color: "#DC2626", fontWeight: "600" }}>
                ⚠️ 購買日期（{date}）晚於排餐日期（{maxDate}）
              </Text>
            </View>
          )}

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
                      <Text style={s.seasoningHint}>（家中常備，可按需要取消）</Text>
                    )}
                  </View>
                  {items.map(({ ing, key, recipeName }) => {
                    const isOn = selected.has(key);
                    const isAdded = alreadyAddedKeys?.has(key) ?? false;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[s.row, isAdded && s.rowAdded]}
                        onPress={() => { if (!isAdded) toggle(key); }}
                        activeOpacity={isAdded ? 1 : 0.7}
                      >
                        <View style={[s.dot, isOn && s.dotActive]}>
                          {isOn && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={[s.ingName, isAdded && s.ingNameAdded]} numberOfLines={1}>
                          {ing.name}
                        </Text>
                        {isAdded ? (
                          <Text style={s.addedTag}>已加入</Text>
                        ) : (
                          <Text style={s.qty}>{formatIngredientDisplay(ing.quantity, ing.unit)}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.confirmBtn, (confirmItems.length === 0 || loading) && s.confirmBtnDisabled]}
              onPress={() => {
                if (maxDate && date > maxDate) {
                  Alert.alert(
                    "日期無效",
                    `購買日期（${date}）不能遲於排餐日期（${maxDate}）`,
                    [{ text: "確定" }]
                  );
                  return;
                }
                onConfirm(confirmItems);
              }}
              disabled={confirmItems.length === 0 || loading}
            >
              {loading ? (
                <Ionicons name="hourglass-outline" size={14} color={SUB} />
              ) : (
                <Ionicons name="cart-outline" size={14} color={confirmItems.length > 0 ? "#fff" : SUB} />
              )}
              <Text style={[s.confirmTxt, (confirmItems.length === 0 || loading) && s.confirmTxtDisabled]}>
                {loading
                  ? "加入中..."
                  : confirmItems.length > 0
                  ? `加入 ${confirmItems.length} 項食材`
                  : alreadyAddedKeys && alreadyAddedKeys.size > 0
                  ? "全部已加入購物清單"
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
  dateBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dateBadgeText: {
    fontSize: 12,
    color: "#013E77",
    fontWeight: "500",
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
  dateSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dateLabel: {
    fontSize: 13,
    color: SUB,
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
  rowAdded: {
    opacity: 0.55,
  },
  ingNameAdded: {
    textDecorationLine: "line-through",
    color: SUB,
  },
  addedTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
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
