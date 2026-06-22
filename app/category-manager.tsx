import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  loadCustomCategories, saveCustomCategories,
  CategoryDef, DEFAULT_CATEGORIES, validateCategory,
} from "@/lib/category-storage";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const BORDER = "#E5E7EB";

export default function CategoryManagerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDef[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("restaurant-outline");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomCategories().then(c => {
      setCategories(c);
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await saveCustomCategories(categories);
    setSaving(false);
    Alert.alert("已儲存", "分類設定已更新");
  }, [categories]);

  const handleReset = useCallback(() => {
    Alert.alert("重設分類", "還原為預設分類設定？", [
      { text: "取消", style: "cancel" },
      {
        text: "重設", style: "destructive",
        onPress: async () => {
          setCategories(DEFAULT_CATEGORIES);
          await saveCustomCategories(DEFAULT_CATEGORIES);
          Alert.alert("已重設");
        },
      },
    ]);
  }, []);

  const handleAdd = useCallback(() => {
    const err = validateCategory(newLabel, newEmoji);
    if (err) { Alert.alert(err); return; }
    const key = newLabel.trim();
    if (categories.some(c => c.key === key)) {
      Alert.alert("分類已存在");
      return;
    }
    setCategories(prev => [...prev, { key, label: newLabel.trim(), emoji: newEmoji.trim() }]);
    setShowAdd(false);
    setNewLabel("");
    setNewEmoji("restaurant-outline");
  }, [newLabel, newEmoji, categories]);

  const handleDelete = useCallback((key: string) => {
    if (key === "其他") { Alert.alert("無法刪除「其他」分類"); return; }
    Alert.alert("刪除分類", `確定刪除「${key}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除", style: "destructive",
        onPress: () => setCategories(prev => prev.filter(c => c.key !== key)),
      },
    ]);
  }, []);

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setCategories(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((idx: number) => {
    setCategories(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG }}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: "分類管理",
          headerStyle: { backgroundColor: CARD },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "700", color: TEXT },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <Ionicons name="chevron-back" size={24} color={TEXT} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {/* Hint */}
        <View style={{ backgroundColor: "#EEF4FB", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#C5D9F0" }}>
          <Text style={{ fontSize: 13, color: BRAND, lineHeight: 19 }}>
            分類排序會反映在首頁的分類欄。長按拖曳排序（暫支持上下移動按鈕）。
          </Text>
        </View>

        {/* Category list */}
        {categories.map((cat, idx) => (
          <View key={cat.key} style={s_cat.row}>
            <View style={s_cat.moveCol}>
              <TouchableOpacity onPress={() => moveUp(idx)} disabled={idx === 0}>
                <Ionicons name="chevron-up" size={18} color={idx === 0 ? "#D1D5DB" : SUB} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveDown(idx)} disabled={idx >= categories.length - 1}>
                <Ionicons name="chevron-down" size={18} color={idx >= categories.length - 1 ? "#D1D5DB" : SUB} />
              </TouchableOpacity>
            </View>
            {cat.emoji && cat.emoji.includes("-") ? (
              <Ionicons name={cat.emoji as any} size={22} color={TEXT} />
            ) : (
              <Text style={s_cat.emoji}>{cat.emoji}</Text>
            )}
            <Text style={s_cat.label}>{cat.label}</Text>
            <View style={{ flex: 1 }} />
            {cat.key !== "其他" && (
              <TouchableOpacity onPress={() => handleDelete(cat.key)} style={s_cat.delBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add form */}
        {showAdd ? (
          <View style={s_cat.addForm}>
            <Text style={s_cat.addFormTitle}>新增分類</Text>
            <TextInput
              style={s_cat.input}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="分類名稱（如：烘焙）"
              placeholderTextColor={SUB}
              returnKeyType="next"
            />
            <TextInput
              style={s_cat.input}
              value={newEmoji}
              onChangeText={setNewEmoji}
              placeholder="圖標名稱（如：restaurant-outline）"
              placeholderTextColor={SUB}
              returnKeyType="done"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center" }}
                onPress={() => setShowAdd(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: SUB }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: BRAND, alignItems: "center" }}
                onPress={handleAdd}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s_cat.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add-circle-outline" size={20} color={BRAND} />
            <Text style={s_cat.addBtnText}>新增分類</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" }}
            onPress={handleReset}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: SUB }}>重設預設</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: BRAND, alignItems: "center" }}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>儲存</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
      </ScrollView>
    </View>
  );
}

const s_cat = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  moveCol: {
    alignItems: "center",
    gap: 2,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: 15, fontWeight: "700", color: TEXT },
  delBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  addForm: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    marginTop: 8,
  },
  addFormTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: TEXT,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BRAND + "40",
    borderStyle: "dashed",
    marginTop: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: "600", color: BRAND },
});
