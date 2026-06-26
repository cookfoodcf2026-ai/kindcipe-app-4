/**
 * 自訂食譜編輯器 — 新增 / 編輯 用戶自訂食譜
 */
import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";
import UnitPicker from "@/src/components/UnitPicker";
import { compressImage } from "@/lib/image-utils";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const HINT = "#B0BAC9";
const BORDER = "#E5D5C0";
const GREEN = "#4CAF50";
const ROSE = "#EF4444";

const DIFFICULTY_OPTIONS = ["簡單", "中等", "困難"];
const CATEGORY_OPTIONS = [
  { key: "中菜",   label: "中菜",   icon: "restaurant-outline" },
  { key: "西餐",   label: "西餐",   icon: "leaf-outline" },
  { key: "日式",   label: "日式",   icon: "fish-outline" },
  { key: "韓式",   label: "韓式",   icon: "flame-outline" },
  { key: "東南亞", label: "東南亞", icon: "restaurant-outline" },
  { key: "甜品",   label: "甜品",   icon: "star-outline" },
  { key: "飲品",   label: "飲品",   icon: "cafe-outline" },
  { key: "其他",   label: "其他",   icon: "grid-outline" },
] as const;

type Ingredient = { id: string; name: string; quantity: string; unit: string };
type Step = { id: number; instruction: string; duration: number; imageUri?: string | null; imageBase64?: string | null };

export default function RecipeEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const editingId = params.id ? parseInt(params.id) : null;
  const isEditing = !!editingId && !isNaN(editingId);
  const utils = trpc.useUtils();

  const [name, setName] = useState(params.name ?? "");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("4");
  const [prepTime, setPrepTime] = useState("15");
  const [cookTime, setCookTime] = useState("30");
  const [difficulty, setDifficulty] = useState("中等");
  const [category, setCategory] = useState("中菜");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: `ing_${Date.now()}`, name: "", quantity: "", unit: "克" },
  ]);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, instruction: "", duration: 0 },
  ]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing recipe if editing
  const recipeQ = trpc.recipes.getById.useQuery(
    { id: String(editingId ?? "") },
    { enabled: isEditing },
  );

  useEffect(() => {
    if (recipeQ.data && isEditing) {
      const r = recipeQ.data as any;
      setName(r.name ?? "");
      setDescription(r.description ?? "");
      setServings(String(r.servings ?? 4));
      setPrepTime(String(r.prepTime ?? 15));
      setCookTime(String(r.cookTime ?? 30));
      setDifficulty(r.difficulty ?? "中等");
      setCategory(r.recipeCategory ?? "中菜");
      setTags((r.tags || []).join(" "));
      if (r.image || r.thumbnailUrl) setImageUri(r.thumbnailUrl || r.image);
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
        setIngredients(r.ingredients.map((ing: any, i: number) => ({
          id: `ing_${i}`,
          name: ing.name ?? "",
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit ?? "克",
        })));
      }
      if (Array.isArray(r.steps) && r.steps.length > 0) {
        setSteps(r.steps.map((s: any, i: number) => ({
          id: i + 1,
          instruction: typeof s === "string" ? s : (s.instruction ?? s.description ?? ""),
          duration: s.duration ?? 0,
          imageUri: s.image || undefined,
          imageBase64: undefined,
        })));
      }
    }
  }, [recipeQ.data]);

  const createM = trpc.recipes.createBlank.useMutation({
    onSuccess: () => {
      utils.recipes.listUser.invalidate();
      router.back();
    },
    onError: (e) => { setIsSaving(false); Alert.alert("儲存失敗", e.message); },
  });
  const updateM = trpc.recipes.updateUser.useMutation({
    onSuccess: () => {
      utils.recipes.listUser.invalidate();
      utils.recipes.getById.invalidate({ id: String(editingId) });
      router.back();
    },
    onError: (e) => { setIsSaving(false); Alert.alert("更新失敗", e.message); },
  });

  const uploadImageM = trpc.recipes.uploadRecipeImage.useMutation();

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const compressed = await compressImage(result.assets[0].uri);
        setImageUri(compressed.uri);
        setImageBase64(compressed.base64);
      } catch {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
      }
    }
  };

  // Ingredient ops
  const addIngredient = () => setIngredients(prev => [
    ...prev, { id: `ing_${Date.now()}`, name: "", quantity: "", unit: "克" },
  ]);
  const updateIngredient = (idx: number, field: keyof Ingredient, val: string) =>
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing));
  const removeIngredient = (idx: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Step ops
  const addStep = () => setSteps(prev => [
    ...prev, { id: prev.length + 1, instruction: "", duration: 0, imageUri: undefined, imageBase64: undefined },
  ]);
  const updateStep = (idx: number, field: keyof Step, val: string | number) =>
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  const pickStepImage = async (idx: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const compressed = await compressImage(result.assets[0].uri);
        setSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: compressed.uri, imageBase64: compressed.base64,
        } : s));
      } catch {
        setSteps(prev => prev.map((s, i) => i === idx ? {
          ...s, imageUri: result.assets[0].uri, imageBase64: result.assets[0].base64,
        } : s));
      }
    }
  };
  const removeStepImage = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i === idx ? {
      ...s, imageUri: undefined, imageBase64: undefined,
    } : s));
  };
  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, id: i + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("請輸入食譜名稱"); return; }
    const validIngredients = ingredients.filter(i => i.name.trim());
    const validSteps = steps.filter(s => s.instruction.trim());
    if (validIngredients.length === 0) { Alert.alert("請至少輸入一種食材"); return; }
    if (validSteps.length === 0) { Alert.alert("請至少輸入一個步驟"); return; }

    setIsSaving(true);
    setSaveStep(0);
    const timer = setInterval(() => setSaveStep(prev => Math.min(prev + 1, 2)), 2500);
    saveTimerRef.current = timer;

    try {
      let imageUrl = imageUri || "";
      if (imageBase64) {
        setSaveStep(1);
        const up = await uploadImageM.mutateAsync({ base64: imageBase64, mimeType: "image/jpeg" });
        imageUrl = up.url;
      }

      // Upload step images
      const stepImages: (string | null)[] = [];
      for (const s of validSteps) {
        if (s.imageBase64) {
          try {
            const up = await uploadImageM.mutateAsync({ base64: s.imageBase64, mimeType: "image/jpeg" });
            stepImages.push(up.url);
          } catch { stepImages.push(null); }
        } else {
          stepImages.push(s.imageUri || null);
        }
      }
      setSaveStep(2);

      const recipeTags = tags.split(/[\s,，]+/).map(t => t.replace(/^#/, "").trim()).filter(t => t.length > 0);
      const recipeData = {
        name: name.trim(),
        description: description.trim(),
        image: imageUrl,
        thumbnailUrl: imageUrl,
        servings: parseInt(servings) || 4,
        cookTime: parseInt(cookTime) || 30,
        difficulty,
        recipeCategory: category,
        tags: recipeTags.length > 0 ? recipeTags : ["自訂"],
        ingredients: validIngredients.map(i => ({
          name: i.name, quantity: i.quantity, unit: i.unit, category: "食材",
        })),
        steps: validSteps.map((s, i) => ({
          instruction: s.instruction, duration: s.duration || 0,
          image: stepImages[i] || undefined,
        })),
      };

      clearInterval(timer);
      saveTimerRef.current = null;
      if (isEditing && editingId) {
        updateM.mutate({ ...recipeData, id: editingId } as any);
      } else {
        createM.mutate(recipeData as any);
      }
    } catch (e: any) {
      clearInterval(timer);
      saveTimerRef.current = null;
      setIsSaving(false);
      Alert.alert("儲存失敗", "圖片上傳失敗，請重試");
    }
  };

  const handleDiscard = () => {
    Alert.alert("放棄編輯？", "已輸入的內容將不會保存", [
      { text: "繼續編輯", style: "cancel" },
      { text: "放棄", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const validIngCount = ingredients.filter(i => i.name.trim()).length;
  const validStepCount = steps.filter(s => s.instruction.trim()).length;
  const isPending = createM.isPending || updateM.isPending || isSaving;

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? "編輯食譜" : "新增食譜 ✨",
          headerStyle: { backgroundColor: BG },
          headerTintColor: BRAND,
          headerTitleStyle: { fontWeight: "800", color: TEXT },
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} style={{ marginLeft: 4 }}>
              <Ionicons name="close" size={24} color={TEXT} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={st.root} showsVerticalScrollIndicator={false}>
        {/* Recipe Photo */}
        <TouchableOpacity style={st.card} onPress={pickImage} activeOpacity={0.85}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#FDF2F8" }]}>
              <Ionicons name="camera-outline" size={18} color="#DB2777" />
            </View>
            <Text style={st.cardTitle}>食譜相片</Text>
          </View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={st.recipeImage} />
          ) : (
            <View style={st.imagePH}>
              <Ionicons name="image-outline" size={48} color="#B0BAC9" />
              <Text style={st.imagePHTxt}>點擊上載食譜圖片</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Recipe Details */}
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#EEF4FB" }]}>
              <Ionicons name="document-text-outline" size={18} color={BRAND} />
            </View>
            <Text style={st.cardTitle}>食譜資訊</Text>
          </View>

          <Text style={st.label}>食譜名稱 *</Text>
          <TextInput style={st.input} value={name} onChangeText={setName}
            placeholder="例：媽媽的秘製紅燒肉" placeholderTextColor={HINT} />

          <Text style={st.label}>描述</Text>
          <TextInput style={[st.input, st.multi]} value={description} onChangeText={setDescription}
            placeholder="描述這道菜的特色..." placeholderTextColor={HINT} multiline numberOfLines={2} />

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>準備時間 (分鐘)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={prepTime}
                onChangeText={setPrepTime} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>烹飪時間 (分鐘)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={cookTime}
                onChangeText={setCookTime} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
          </View>

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>份量 (人份)</Text>
              <TextInput style={[st.input, { textAlign: "center" }]} value={servings}
                onChangeText={setServings} keyboardType="numeric" placeholderTextColor={HINT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>難度</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {DIFFICULTY_OPTIONS.map(d => (
                  <TouchableOpacity key={d}
                    style={[st.chip, st.chipFlex, difficulty === d && st.chipActive]}
                    onPress={() => setDifficulty(d)}>
                    <Text style={[st.chipTxt, difficulty === d && st.chipTxtActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={st.label}>分類</Text>
          <View style={st.catGrid}>
            {CATEGORY_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.key}
                style={[st.catChip, category === opt.key && st.catChipActive]}
                onPress={() => setCategory(opt.key)}>
                <Ionicons name={opt.icon as any} size={18} color={category === opt.key ? "#fff" : BRAND} />
                <Text style={[st.catLabel, category === opt.key && st.catLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[st.label, { marginTop: 12 }]}>標籤</Text>
          <TextInput style={st.input} value={tags} onChangeText={setTags}
            placeholder="例：家常菜 快手菜 雞肉" placeholderTextColor={HINT} />
        </View>

        {/* Ingredients */}
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="basket-outline" size={18} color={GREEN} />
            </View>
            <Text style={st.cardTitle}>食材清單 ({validIngCount} 項)</Text>
            <TouchableOpacity style={st.addBtn} onPress={addIngredient}>
              <Ionicons name="add" size={14} color={GREEN} />
              <Text style={st.addBtnTxt}>新增食材</Text>
            </TouchableOpacity>
          </View>

          <View style={st.ingHdr}>
            <Text style={[st.ingHdrTxt, { flex: 1 }]}>食材名稱</Text>
            <Text style={[st.ingHdrTxt, { width: 64, textAlign: "center" }]}>份量</Text>
            <Text style={[st.ingHdrTxt, { width: 64, textAlign: "center" }]}>單位</Text>
            <View style={{ width: 32 }} />
          </View>

          {ingredients.map((ing, idx) => (
            <View key={ing.id} style={st.ingRow}>
              <TextInput style={[st.ingInput, { flex: 1 }]} value={ing.name}
                onChangeText={v => updateIngredient(idx, "name", v)}
                placeholder="食材名稱" placeholderTextColor={HINT} />
              <TextInput style={[st.ingInput, { width: 64, textAlign: "center" }]} value={ing.quantity}
                onChangeText={v => updateIngredient(idx, "quantity", v)}
                placeholder="份量" placeholderTextColor={HINT} />
              <UnitPicker value={ing.unit} onChange={v => updateIngredient(idx, "unit", v)}
                style={{ width: 64, height: 40 }} />
              <TouchableOpacity style={[st.delBtn, ingredients.length <= 1 && st.delDisabled]}
                onPress={() => removeIngredient(idx)} disabled={ingredients.length <= 1}>
                <Ionicons name="close" size={14}
                  color={ingredients.length <= 1 ? HINT : ROSE} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Preparation Steps */}
        <View style={st.card}>
          <View style={st.cardRow}>
            <View style={[st.cardIcon, { backgroundColor: "#E8F0FA" }]}>
              <Ionicons name="list-outline" size={18} color={BRAND} />
            </View>
            <Text style={st.cardTitle}>烹飪步驟 ({validStepCount} 步)</Text>
            <TouchableOpacity style={[st.addBtn, { backgroundColor: "#E8F0FA" }]} onPress={addStep}>
              <Ionicons name="add" size={14} color={BRAND} />
              <Text style={[st.addBtnTxt, { color: BRAND }]}>新增步驟</Text>
            </TouchableOpacity>
          </View>

          {steps.map((step, idx) => (
            <View key={step.id} style={[st.stepBlock, idx < steps.length - 1 && st.stepBorder]}>
              <View style={st.stepNum}>
                <Text style={st.stepNumTxt}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput style={[st.ingInput, st.multi, { marginBottom: 6 }]} value={step.instruction}
                  onChangeText={v => updateStep(idx, "instruction", v)}
                  placeholder={`第 ${idx + 1} 步驟說明...`}
                  placeholderTextColor={HINT} multiline numberOfLines={2} />

                {/* Step image thumbnail */}
                {step.imageUri ? (
                  <View style={st.stepImageWrap}>
                    <Image source={{ uri: step.imageUri }} style={st.stepImage} />
                    <TouchableOpacity style={st.stepImageDel} onPress={() => removeStepImage(idx)}>
                      <Ionicons name="close-circle" size={22} color={ROSE} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 12, color: SUB }}>時間（分鐘）：</Text>
                  <TextInput style={[st.ingInput, { width: 64, textAlign: "center" }]}
                    value={String(step.duration || 0)}
                    onChangeText={v => updateStep(idx, "duration", parseInt(v) || 0)}
                    keyboardType="numeric" placeholderTextColor={HINT} />
                  <TouchableOpacity style={st.stepCameraBtn} onPress={() => pickStepImage(idx)}>
                    <Ionicons name="camera-outline" size={14} color={step.imageUri ? BRAND : SUB} />
                    <Text style={[st.stepCameraTxt, step.imageUri && { color: BRAND }]}>
                      {step.imageUri ? "已上載" : "教學圖片"}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={[st.delBtn, steps.length <= 1 && st.delDisabled]}
                    onPress={() => removeStep(idx)} disabled={steps.length <= 1}>
                    <Ionicons name="close" size={14}
                      color={steps.length <= 1 ? HINT : ROSE} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Save / Discard */}
        <View style={[st.actions, { marginBottom: Math.max(insets.bottom + 12, 44) }]}>
          <TouchableOpacity style={[st.saveBtn, isPending && { opacity: 0.6 }]}
            onPress={handleSave} disabled={isPending}>
            {isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={st.saveBtnTxt}>儲存食譜</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={st.discardBtn} onPress={handleDiscard}>
            <Text style={st.discardBtnTxt}>放棄</Text>
          </TouchableOpacity>
        </View>

        {/* Saving overlay */}
        <Modal visible={isSaving && !isPending} transparent animationType="fade">
          <View style={st.overlay}>
            <View style={st.overlayBox}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={st.overlayTitle}>儲存中</Text>
              <View style={st.overlaySteps}>
                {["驗證資料...", "上載圖片...", "儲存到食譜庫..."].map((s, i) => (
                  <View key={s} style={st.overlayStep}>
                    {i < saveStep ? (
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    ) : i === saveStep ? (
                      <ActivityIndicator size="small" color={BRAND} />
                    ) : (
                      <View style={st.overlayDot} />
                    )}
                    <Text style={[st.overlayStepTxt,
                      i < saveStep && { color: "#22C55E" },
                      i === saveStep && { color: BRAND, fontWeight: "700" },
                    ]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Cards
  card: {
    backgroundColor: "#FFFFFF", marginHorizontal: 16, marginTop: 14,
    borderRadius: 20, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: TEXT },

  // Image
  recipeImage: { width: "100%", height: 200, borderRadius: 14, marginTop: 4 },
  imagePH: {
    width: "100%", height: 140, borderRadius: 14, marginTop: 4,
    backgroundColor: "#F9FAFB", borderWidth: 2, borderColor: "#E5E7EB",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8,
  },
  imagePHTxt: { fontSize: 14, color: HINT, fontWeight: "600" },

  // Form
  label: { fontSize: 13, fontWeight: "700", color: "#5A4A3A", marginBottom: 6 },
  input: {
    backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: TEXT, marginBottom: 14,
  },
  multi: { height: 72, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 14 },

  // Chips
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: BORDER,
  },
  chipFlex: { flex: 1, alignItems: "center" },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipTxt: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  chipTxtActive: { color: "#fff" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#EEF4FB",
    borderWidth: 1.5, borderColor: BORDER,
  },
  catChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  catLabel: { fontSize: 13, fontWeight: "700", color: "#5A4A3A" },
  catLabelActive: { color: "#fff" },

  // Ingredient
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#E8F5E9", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  addBtnTxt: { fontSize: 12, fontWeight: "700", color: GREEN },
  ingHdr: { flexDirection: "row", gap: 8, marginBottom: 6, paddingHorizontal: 2 },
  ingHdrTxt: { fontSize: 11, fontWeight: "700", color: SUB },
  ingRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  ingInput: {
    backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: TEXT,
  },
  delBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  delDisabled: { backgroundColor: "#EEF4FB" },

  // Steps
  stepBlock: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: "#F9F6F2" },
  stepNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 8,
  },
  stepNumTxt: { fontSize: 13, fontWeight: "900", color: "#fff" },
  stepImageWrap: { marginBottom: 8, position: "relative" as const },
  stepImage: { width: "100%", height: 140, borderRadius: 10 },
  stepImageDel: { position: "absolute" as const, top: -6, right: -6 },
  stepCameraBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    backgroundColor: "#F5F8FC", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  stepCameraTxt: { fontSize: 11, fontWeight: "600", color: SUB },

  // Actions
  actions: { marginHorizontal: 16, marginTop: 24, marginBottom: 44, gap: 12 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: BRAND, paddingVertical: 18, borderRadius: 20,
    shadowColor: BRAND, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  saveBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "900" },
  discardBtn: {
    alignItems: "center", paddingVertical: 14, borderRadius: 16,
  },
  discardBtnTxt: { fontSize: 14, color: SUB, fontWeight: "600" },

  // Saving overlay
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
  },
  overlayBox: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32,
    width: "80%", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  overlayTitle: { fontSize: 18, fontWeight: "800", color: BRAND, marginTop: 16, marginBottom: 24 },
  overlaySteps: { width: "100%", gap: 12 },
  overlayStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  overlayStepTxt: { fontSize: 14, color: SUB },
  overlayDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
});
