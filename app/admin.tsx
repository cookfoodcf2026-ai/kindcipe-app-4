import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Image,
  Platform, Dimensions,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BG = "#F8FAFC";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const SUB = "#64748B";
const HINT = "#94A3B8";
const BORDER = "#E2E8F0";
const DARK = "#0F172A";

const MEAL_TYPE_COLORS: Record<string, string> = {
  "主菜": "#B45309", "湯水": "#0891B2", "飯麵": "#7C3AED",
  "蔬菜/配菜": "#15803D", "前菜/小吃": "#16A34A",
  "甜品": "#DB2777", "飲品": "#0369A1",
};

const SUB_CAT_COLORS: Record<string, string> = {
  "⏱ 30分鐘出菜": "#E11D48", "電飯煲一煲熟": "#7C3AED",
  "高蛋白低脂": "#0891B2", "低卡料理": "#16A34A",
  "減脂餐": "#012D56", "家常菜": "#012D56",
  "🇭🇰 粵菜": "#012D56", "亞洲料理": "#0F766E",
};

function getMealType(recipe: any): string {
  const tags = (recipe.tags ?? []).map((t: string) => t.toLowerCase());
  const name = recipe.name.toLowerCase();
  const cat = recipe.recipeCategory ?? "";
  if (tags.some((t: string) => t.includes("飲品") || t.includes("drink")) || name.includes("奶茶") || name.includes("豆漿")) return "飲品";
  if (tags.some((t: string) => t.includes("湯水") || t.includes("soup") || t.includes("湯")) || name.includes("湯") || name.includes("羹")) return "湯水";
  if (tags.some((t: string) => t.includes("甜品") || t.includes("dessert")) || name.includes("糕") || name.includes("布丁")) return "甜品";
  if (tags.some((t: string) => t.includes("前菜") || t.includes("小吃") || t.includes("starter")) || name.includes("沙律") || name.includes("春卷")) return "前菜/小吃";
  if (cat === "carb" || tags.some((t: string) => t.includes("飯") || t.includes("麵") || t.includes("粉")) || name.includes("炒飯") || name.includes("意粉") || name.includes("拉麵")) return "飯麵";
  if (cat === "vegetable" || tags.some((t: string) => t.includes("蔬菜") || t.includes("素食")) || name.includes("清炒")) return "蔬菜/配菜";
  return "主菜";
}

function getSubCats(recipe: any): string[] {
  const subs: string[] = [];
  const tags = (recipe.tags ?? []).map((t: string) => t.toLowerCase());
  const name = recipe.name.toLowerCase();
  if (recipe.cookTime <= 30) subs.push("⏱ 30分鐘出菜");
  if (tags.some((t: string) => t.includes("電飯煲") || t.includes("炊飯")) || name.includes("電飯煲") || name.includes("炊飯")) subs.push("電飯煲一煲熟");
  if (tags.some((t: string) => t.includes("高蛋白") || t.includes("雞胸") || t.includes("低脂")) || name.includes("雞胸")) subs.push("高蛋白低脂");
  if (tags.some((t: string) => t.includes("低卡") || t.includes("沙律") || t.includes("輕食")) || name.includes("沙律") || name.includes("低卡")) subs.push("低卡料理");
  if (tags.some((t: string) => t.includes("減脂") || t.includes("瘦身"))) subs.push("減脂餐");
  if (tags.some((t: string) => t.includes("家常") || t.includes("home")) || recipe.cookTime <= 45) subs.push("家常菜");
  if (tags.some((t: string) => t.includes("粵") || t.includes("港式") || t.includes("廣東")) || name.includes("清蒸") || name.includes("煲湯") || name.includes("港式")) subs.push("🇭🇰 粵菜");
  return subs;
}

function BarChart({ data, colorMap }: { data: { label: string; count: number }[]; colorMap: Record<string, string> }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <View style={{ gap: 8 } as any}>
      {data.map(d => {
        const pct = Math.max((d.count / max) * 100, d.count > 0 ? 10 : 0);
        return (
          <View key={d.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 } as any}>
            <Text style={{ width: 100, fontSize: 11, fontWeight: "600", color: "#374151", textAlign: "right" as any }} numberOfLines={1}>
              {d.label}
            </Text>
            <View style={{ flex: 1, backgroundColor: "#F1F5F9", borderRadius: 6, height: 20, overflow: "hidden" } as any}>
              <View style={{
                height: "100%" as any, borderRadius: 6,
                backgroundColor: colorMap[d.label] || BRAND,
                width: `${pct}%` as any,
                alignItems: "flex-start", justifyContent: "center", paddingLeft: 6,
              }}>
                {d.count > 0 && (
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>{d.count}</Text>
                )}
              </View>
            </View>
            <Text style={{ width: 28, fontSize: 11, color: HINT, textAlign: "right" as any }}>
              {total > 0 ? Math.round((d.count / total) * 100) : 0}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"recipes" | "analytics" | "pending">("recipes");
  const [searchQ, setSearchQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: officialRecipesList = [] } = trpc.recipes.listOfficial.useQuery({ limit: 500 });
  const { data: pendingList = [] } = trpc.recipes.adminListPending.useQuery(undefined, { enabled: unlocked });

  const createOfficialM = trpc.recipes.adminCreateOfficial.useMutation({
    onSuccess: () => { utils.recipes.listOfficial.invalidate(); setShowForm(false); Alert.alert("已新增官方食譜"); },
    onError: (e) => Alert.alert("新增失敗", e.message),
  });
  const updateOfficialM = trpc.recipes.adminUpdateOfficial.useMutation({
    onSuccess: () => { utils.recipes.listOfficial.invalidate(); setShowForm(false); Alert.alert("已更新食譜"); },
    onError: (e) => Alert.alert("更新失敗", e.message),
  });
  const deleteOfficialM = trpc.recipes.deleteOfficial.useMutation({
    onSuccess: () => { utils.recipes.listOfficial.invalidate(); setDeleteConfirm(null); Alert.alert("已刪除"); },
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });
  const approveM = trpc.recipes.adminApprove.useMutation({
    onSuccess: () => { utils.recipes.adminListPending.invalidate(); utils.recipes.listOfficial.invalidate(); Alert.alert("已批准公開"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });
  const rejectM = trpc.recipes.adminReject.useMutation({
    onSuccess: () => { utils.recipes.adminListPending.invalidate(); Alert.alert("已拒絕申請"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return officialRecipesList;
    const q = searchQ.toLowerCase();
    return officialRecipesList.filter((r: any) => r.name.toLowerCase().includes(q) || (r.nameEn ?? "").toLowerCase().includes(q));
  }, [officialRecipesList, searchQ]);

  const mealTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    officialRecipesList.forEach((r: any) => {
      const t = getMealType(r);
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [officialRecipesList]);

  const subCatData = useMemo(() => {
    const counts: Record<string, number> = {};
    officialRecipesList.forEach((r: any) => {
      getSubCats(r).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [officialRecipesList]);

  const [form, setForm] = useState({
    name: "", nameEn: "", description: "", image: "",
    cookTime: "20", servings: "2", difficulty: "簡單",
    recipeCategory: "其他", tags: "", reelAuthor: "", reelUrl: "", estimatedCost: "60",
  });

  const handlePinSubmit = () => {
    if (pin === "8888") {
      setUnlocked(true);
    } else {
      Alert.alert("PIN 碼錯誤");
      setPin("");
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert("請輸入菜名"); return; }
    if (!form.image.trim()) { Alert.alert("請輸入圖片網址"); return; }
    const payload = {
      name: form.name,
      nameEn: form.nameEn || undefined,
      description: form.description || undefined,
      image: form.image || undefined,
      cookTime: Number(form.cookTime),
      servings: Number(form.servings),
      difficulty: form.difficulty as "簡單" | "中等" | "困難",
      recipeCategory: form.recipeCategory,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      sourceAuthor: form.reelAuthor || undefined,
      sourceUrl: form.reelUrl || undefined,
    };
    createOfficialM.mutate(payload);
  };

  if (!unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <View style={{ backgroundColor: "#1E293B", borderRadius: 20, padding: 36, width: "100%" as any, maxWidth: 340, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: BRAND, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="server" size={26} color="#fff" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#F1F5F9", marginBottom: 4 }}>管理員面板</Text>
          <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 28 }}>Admin Dashboard · 請輸入 PIN 碼</Text>
          <TextInput
            style={{ width: "100%" as any, backgroundColor: DARK, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, color: "#F1F5F9", fontSize: 16, letterSpacing: 6, textAlign: "center" as any, marginBottom: 16 }}
            value={pin}
            onChangeText={setPin}
            placeholder="輸入 PIN 碼"
            placeholderTextColor="#64748B"
            secureTextEntry
            maxLength={8}
            returnKeyType="done"
            onSubmitEditing={handlePinSubmit}
          />
          <TouchableOpacity style={{ width: "100%" as any, backgroundColor: BRAND, paddingVertical: 12, borderRadius: 12, alignItems: "center" }} onPress={handlePinSubmit}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>進入管理面板</Text>
          </TouchableOpacity>
        </View>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Admin Dashboard",
          headerStyle: { backgroundColor: DARK },
          headerTintColor: "#F1F5F9",
          headerTitleStyle: { fontWeight: "800" },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <Ionicons name="chevron-back" size={24} color="#F1F5F9" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: BG }}>
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: DARK }}>
          {[
            { label: "食譜總數", value: officialRecipesList.length, icon: "book-outline" as const },
            { label: "待審核", value: pendingList.length, icon: "time-outline" as const },
          ].map(stat => (
            <View key={stat.label} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Ionicons name={stat.icon} size={14} color={BRAND} />
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#F1F5F9", lineHeight: 16 }}>{stat.value}</Text>
              <Text style={{ fontSize: 10, color: "#64748B", marginLeft: 4 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          {([
            { id: "recipes", label: "食譜管理", icon: "book-outline" },
            { id: "analytics", label: "數據分析", icon: "bar-chart-outline" },
            { id: "pending", label: "審核", icon: "checkmark-circle-outline" },
          ] as const).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 2.5, borderBottomColor: isActive ? BRAND : "transparent" }}
                onPress={() => setActiveTab(tab.id as "recipes" | "analytics" | "pending")}
              >
                <Ionicons name={tab.icon as any} size={15} color={isActive ? BRAND : SUB} />
                <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? BRAND : SUB }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
          {activeTab === "recipes" && (
            <>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "center" }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, padding: 10, fontSize: 14, color: TEXT }}
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder="搜尋食譜名稱..."
                  placeholderTextColor={HINT}
                />
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                  onPress={() => {
                    setForm({ name: "", nameEn: "", description: "", image: "", cookTime: "20", servings: "2", difficulty: "簡單", recipeCategory: "其他", tags: "", reelAuthor: "", reelUrl: "", estimatedCost: "60" });
                    setShowForm(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>新增</Text>
                </TouchableOpacity>
              </View>

              <Modal visible={showForm} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                  <ScrollView style={{ backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "85%" as any }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>新增食譜</Text>
                      <TouchableOpacity onPress={() => setShowForm(false)}>
                        <Ionicons name="close" size={22} color={TEXT} />
                      </TouchableOpacity>
                    </View>
                    <FF label="菜名" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="清蒸石斑魚" />
                    <FF label="菜名(英)" value={form.nameEn} onChange={v => setForm(p => ({ ...p, nameEn: v }))} placeholder="Steamed Grouper" />
                    <FF label="圖片網址" value={form.image} onChange={v => setForm(p => ({ ...p, image: v }))} placeholder="https://..." />
                    <FF label="描述" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="簡短介紹..." multiline />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}><FF label="烹調時間(分)" value={form.cookTime} onChange={v => setForm(p => ({ ...p, cookTime: v }))} keyboardType="numeric" /></View>
                      <View style={{ flex: 1 }}><FF label="份量(人)" value={form.servings} onChange={v => setForm(p => ({ ...p, servings: v }))} keyboardType="numeric" /></View>
                    </View>
                    <FS label="難度" value={form.difficulty} onChange={v => setForm(p => ({ ...p, difficulty: v }))} options={["簡單", "中等", "困難"]} />
                    <FS label="分類" value={form.recipeCategory} onChange={v => setForm(p => ({ ...p, recipeCategory: v }))} options={[["中菜", "中菜"], ["西餐", "西餐"], ["日式", "日式"], ["韓式", "韓式"], ["東南亞", "東南亞"], ["甜品", "甜品"], ["飲品", "飲品"], ["其他", "其他"]]} />
                    <FF label="標籤(逗號分隔)" value={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} placeholder="廣東, 家常, 快手" />
                    <FF label="IG 來源" value={form.reelAuthor} onChange={v => setForm(p => ({ ...p, reelAuthor: v }))} placeholder="@kiuu922" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>預算(HK$)</Text>
                    <TextInput
                      style={{ backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 10, fontSize: 14, color: TEXT, marginBottom: 12 }}
                      value={form.estimatedCost}
                      onChangeText={v => setForm(p => ({ ...p, estimatedCost: v }))}
                      keyboardType="numeric"
                      placeholderTextColor={HINT}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 8, opacity: (createOfficialM.isPending || updateOfficialM.isPending) ? 0.6 : 1 }}
                      onPress={handleSave}
                      disabled={createOfficialM.isPending || updateOfficialM.isPending}
                    >
                      {createOfficialM.isPending || updateOfficialM.isPending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>保存食譜</Text>
                      )}
                    </TouchableOpacity>
                    <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
                  </ScrollView>
                </View>
              </Modal>

              {filtered.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <Ionicons name="search-outline" size={36} color={HINT} />
                  <Text style={{ fontSize: 14, color: HINT, fontWeight: "600", marginTop: 8 }}>找不到符合的食譜</Text>
                </View>
              ) : (
                filtered.map((recipe: any, idx: number) => (
                  <View key={recipe.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: BORDER }}>
                    <Text style={{ width: 24, fontSize: 12, color: HINT, fontWeight: "600", textAlign: "center" as any }}>{idx + 1}</Text>
                    {recipe.image ? (
                      <Image source={{ uri: recipe.image }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "#F1F5F9" }} />
                    ) : (
                      <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="restaurant-outline" size={20} color={HINT} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{recipe.name}</Text>
                      <Text style={{ fontSize: 11, color: SUB, marginTop: 2 }}>⏱ {recipe.cookTime}分 · {recipe.servings}人 · {getMealType(recipe)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {deleteConfirm === recipe.id ? (
                        <>
                          <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#EF4444", borderRadius: 8 }} onPress={() => deleteOfficialM.mutate({ id: Number(recipe.id) })}>
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>確認刪除</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#F1F5F9", borderRadius: 8 }} onPress={() => setDeleteConfirm(null)}>
                            <Text style={{ color: SUB, fontSize: 12 }}>取消</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity style={{ padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8 }} onPress={() => setDeleteConfirm(recipe.id)}>
                          <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === "analytics" && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Ionicons name="restaurant-outline" size={16} color={BRAND} />
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>菜式類型分佈</Text>
                </View>
                <BarChart data={mealTypeData} colorMap={MEAL_TYPE_COLORS} />
              </View>
              <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Ionicons name="pricetags-outline" size={16} color="#7C3AED" />
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>細分類分佈</Text>
                </View>
                <BarChart data={subCatData} colorMap={SUB_CAT_COLORS} />
              </View>
              <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Ionicons name="trending-up-outline" size={16} color="#16A34A" />
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>總覽統計</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 } as any}>
                  {[
                    { label: "食譜總數", value: officialRecipesList.length, color: BRAND, icon: "restaurant-outline" as const },
                    { label: "平均烹調時間", value: `${Math.round(officialRecipesList.reduce((s: number, r: any) => s + r.cookTime, 0) / Math.max(officialRecipesList.length, 1))} 分`, color: "#0891B2", icon: "time-outline" as const },
                    { label: "30分鐘內食譜", value: officialRecipesList.filter((r: any) => r.cookTime <= 30).length, color: "#E11D48", icon: "flash-outline" as const },
                  ].map(stat => (
                    <View key={stat.label} style={{ width: (SW - 72) / 2, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: stat.color + "20" }}>
                      <Ionicons name={stat.icon} size={20} color={stat.color} />
                      <Text style={{ fontSize: 18, fontWeight: "800", color: stat.color, lineHeight: 22 }}>{stat.value}</Text>
                      <Text style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              </View>
            )}

          {/* ── Category Migration Tool ────────────────────────────── */}
          {activeTab === "analytics" && (
            <View style={{ gap: 16, paddingBottom: 40 }}>
              <MigrateCategoriesCard recipes={officialRecipesList} />
            </View>
          )}

          {activeTab === "pending" && (
            <>
              {pendingList.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <Ionicons name="book-outline" size={40} color={HINT} />
                  <Text style={{ fontSize: 14, color: HINT, fontWeight: "600", marginTop: 8 }}>暫無待審核的食譜</Text>
                </View>
              ) : (
                pendingList.map((recipe: any) => (
                  <View key={recipe.id} style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: BORDER }}>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>{recipe.name}</Text>
                        {recipe.description && <Text style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{recipe.description}</Text>}
                      </View>
                      <View style={{ backgroundColor: "#EEF4FB", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#C5D9F0" }}>
                        <Text style={{ fontSize: 10, color: BRAND, fontWeight: "700" }}>待審核</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 } as any}>
                      {recipe.cookTime ? <Text style={{ fontSize: 11, color: SUB }}>⏱ {recipe.cookTime}分</Text> : null}
                      {recipe.servings ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 } as any}><Ionicons name="people-outline" size={11} color={SUB} /><Text style={{ fontSize: 11, color: SUB }}> {recipe.servings}人</Text></View> : null}
                      {recipe.difficulty ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 } as any}><Ionicons name="restaurant-outline" size={11} color={SUB} /><Text style={{ fontSize: 11, color: SUB }}> {recipe.difficulty}</Text></View> : null}
                    </View>
                    {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
                      <Text style={{ fontSize: 11, color: SUB, lineHeight: 18 }}>
                        食材：{(recipe.ingredients as any[]).slice(0, 6).map((i: any) => i.name).join("、")}
                        {recipe.ingredients.length > 6 ? ` 等 ${recipe.ingredients.length} 項` : ""}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 } as any}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#fff" }}
                        onPress={() => rejectM.mutate({ id: recipe.id })}
                        disabled={rejectM.isPending || approveM.isPending}
                      >
                        <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>拒絕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: "#22C55E" }}
                        onPress={() => approveM.mutate({ id: recipe.id })}
                        disabled={approveM.isPending || rejectM.isPending}
                      >
                        {approveM.isPending ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>批准公開</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ── Recipe name → cuisine mapping for migration ────────────────────
const RECIPE_CUISINE_MAP: Record<string, string> = {
  "清蒸石斑魚": "中菜", "番茄炒蛋": "中菜", "豉汁蒸排骨": "中菜",
  "薑蔥炒蟹": "中菜", "白切雞": "中菜", "乾炒牛河": "中菜",
  "揚州炒飯": "中菜", "蒜蓉炒菜心": "中菜", "豉椒炒蜆": "中菜",
  "梅菜扣肉": "中菜", "薑蔥豬潤": "中菜", "西蘭花炒牛肉": "中菜",
  "可樂雞翼": "中菜", "涼瓜炒牛肉": "中菜", "蒸水蛋": "中菜",
  "番茄牛腩湯米粉": "中菜", "冬瓜排骨湯": "中菜", "麻婆豆腐": "中菜",
  "腐乳通菜": "中菜", "蒸豆腐肉餅": "中菜", "番茄薯仔燉牛腩": "中菜",
  "港式滑蛋蝦仁炒飯": "中菜", "粟米紅蘿蔔豬骨湯": "中菜",
  "蓮藕花生豬骨湯": "中菜", "西洋菜陳腎豬骨湯": "中菜",
  "冬瓜薏米排骨湯": "中菜", "蕃茄薯仔豬骨湯": "中菜",
  "粉葛赤小豆去濕湯": "中菜", "霸王花豬肺湯": "中菜",
  "木瓜雪耳花生湯": "中菜", "淮山杞子豬展湯": "中菜",
  "節瓜粉絲肉片湯": "中菜", "蒜香白酒海鮮意粉": "西餐",
  "日式親子丼": "日式", "韓式辣炒年糕": "韓式",
  "泰式香葉肉碎煎蛋飯": "東南亞",
  "椰汁西米露": "甜品", "蕃薯薑糖水": "甜品",
  "綠豆沙": "甜品", "紅豆沙": "甜品",
  "芋頭西米露": "甜品", "杏仁糊": "甜品",
};

const OLD_CATEGORIES = new Set(["poultry", "pork", "beef", "seafood", "vegetable", "egg", "carb", "mixed"]);

function MigrateCategoriesCard({ recipes }: { recipes: any[] }) {
  const [migrating, setMigrating] = useState(false);
  const utils = trpc.useUtils();
  const updateM = trpc.recipes.adminUpdateOfficial.useMutation();

  const pendingRecipes = useMemo(
    () => recipes.filter((r: any) => OLD_CATEGORIES.has(r.recipeCategory)),
    [recipes]
  );

  const handleMigrate = async () => {
    if (pendingRecipes.length === 0) { Alert.alert("沒有需要遷移的食譜"); return; }
    setMigrating(true);
    let ok = 0, fail = 0;
    for (const r of pendingRecipes) {
      const cuisine = RECIPE_CUISINE_MAP[r.name] || "中菜";
      try {
        await updateM.mutateAsync({
          id: Number(r.id),
          name: r.name,
          cookTime: r.cookTime ?? 20,
          servings: r.servings ?? 2,
          difficulty: r.difficulty ?? "中等",
          recipeCategory: cuisine,
          tags: r.tags ?? [],
          description: r.description ?? "",
          image: r.image ?? "",
        });
        ok++;
      } catch { fail++; }
    }
    setMigrating(false);
    utils.recipes.listOfficial.invalidate();
    Alert.alert(`遷移完成：${ok} 個成功，${fail} 個失敗`);
  };

  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Ionicons name="git-branch-outline" size={16} color="#7C3AED" />
        <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>分類遷移工具</Text>
      </View>
      <Text style={{ fontSize: 12, color: SUB, lineHeight: 18, marginBottom: 12 }}>
        將舊分類（家禽/豬肉/牛肉…）轉換為菜系分類（中菜/西餐/日式…）。
        尚有 {pendingRecipes.length} 個食譜使用舊分類。
      </Text>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: migrating ? "#D1D5DB" : "#7C3AED" }}
        onPress={handleMigrate}
        disabled={migrating || pendingRecipes.length === 0}
      >
        {migrating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="flash-outline" size={16} color="#fff" />
        )}
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
          {migrating ? "遷移中…" : pendingRecipes.length > 0 ? `遷移 ${pendingRecipes.length} 個食譜` : "全部已遷移"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function FF({ label, value, onChange, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, padding: 10, fontSize: 14, color: TEXT, ...(multiline ? { height: 72, textAlignVertical: "top" as any } : {}) }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={HINT}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function FS({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] | [string, string][] }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 5 }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 } as any}>
        {options.map(opt => {
          const optValue = Array.isArray(opt) ? opt[0] : opt;
          const optLabel = Array.isArray(opt) ? opt[1] : opt;
          const isActive = value === optValue;
          return (
            <TouchableOpacity
              key={optValue}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: isActive ? BRAND : "#F1F5F9", borderWidth: 1, borderColor: isActive ? BRAND : BORDER }}
              onPress={() => onChange(optValue)}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: isActive ? "#fff" : SUB }}>{optLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
