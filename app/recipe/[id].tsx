/**
 * 食譜詳情頁 v3 — 白底 + 深藍品牌色 + 大圖頂部 + 卡片式佈局
 * 功能：食材勾選、步驟計時器、烹飪模式、加入排餐、比價
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal, Linking, Platform,
  Dimensions,
} from "react-native";
import { useState, useEffect, useRef, useMemo } from "react";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const BRAND = "#013E77";
const BRAND_LIGHT = "#FFF3D6"
const COPPER = "#F5A823";
const BG = "#FAFAF8";
const CARD = "#FFFFFF";
const TEXT = "#333D4B";
const SUB = "#8A94A6";
const HINT = "#B0BAC9";
const BORDER = "#EBEBEB";

const MEAL_TYPES = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" },
  { id: "snack", label: "小食" },
];

const SUPERMARKETS = [
  { id: "HKTVMALL", name: "HKTVmall", color: "#FF6B00", icon: "🛒" },
  { id: "PARKNSHOP", name: "百佳", color: "#007DC5", icon: "🟢" },
  { id: "WELLCOME", name: "惠康", color: "#E31837", icon: "🔴" },
];

function cleanKeyword(name: string) {
  return name.replace(/\d+/g, "").replace(/(克|公克|g|kg|ml|升|斤|兩|個|條|片|塊|包|罐|瓶|袋|束|棵|顆|粒|隻|尾|份|碗|匙|茶匙|湯匙)/g, "").trim();
}

async function openSupermarket(id: string, keyword: string) {
  const kw = encodeURIComponent(cleanKeyword(keyword));
  const urls: Record<string, string> = {
    HKTVMALL: `hktvmall://search?keyword=${kw}`,
    PARKNSHOP: `https://www.parknshop.com/search?q=${kw}`,
    WELLCOME: `https://www.wellcome.com.hk/search?q=${kw}`,
  };
  const webUrls: Record<string, string> = {
    HKTVMALL: `https://www.hktvmall.com/hktv/zh/search?query=${kw}`,
    PARKNSHOP: `https://www.parknshop.com/search?q=${kw}`,
    WELLCOME: `https://www.wellcome.com.hk/search?q=${kw}`,
  };
  try {
    const can = await Linking.canOpenURL(urls[id]);
    if (can) { await Linking.openURL(urls[id]); return; }
  } catch {}
  await Linking.openURL(webUrls[id] ?? webUrls.HKTVMALL);
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // 防止螢幕在烹飪時自動鎖定
  useKeepAwake();

  const [checkedIng, setCheckedIng] = useState<Set<number>>(new Set());
  const [cookMode, setCookMode] = useState(false);
  const [step, setStep] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showPlan, setShowPlan] = useState(false);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [planMeal, setPlanMeal] = useState("dinner");

  const [showPrice, setShowPrice] = useState(false);
  const [priceKw, setPriceKw] = useState("");

  // 標籤管理
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [localTags, setLocalTags] = useState<string[] | null>(null);

  const updateTagsM = trpc.recipes.updateUserTags.useMutation({
    onSuccess: (data) => {
      setLocalTags(data.tags);
      setShowTagEditor(false);
    },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const recipeQ = trpc.recipes.getById.useQuery({ id: id! }, { enabled: !!id });
  const priceQ = trpc.priceWatch.search.useQuery({ keyword: priceKw }, { enabled: showPrice && !!priceKw });

  const addPlanM = trpc.mealPlan.add.useMutation({
    onSuccess: () => { setShowPlan(false); Alert.alert("✅ 已加入排餐", "食材已自動加入採購清單"); },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: () => Alert.alert("✅ 已加入採購清單"),
    onError: (e) => Alert.alert("失敗", e.message),
  });

  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerOn]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const label = i === 0 ? "今天" : i === 1 ? "明天" : d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric", weekday: "short" });
      return { iso, label };
    });
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const recipe = recipeQ.data;
  const ingredients: any[] = recipe?.ingredients ?? [];
  const steps: any[] = recipe?.steps ?? [];
  const imgUrl = (recipe as any)?.image || (recipe as any)?.thumbnailUrl;
  const isUserRecipe = (recipe as any)?.source === "user";
  const recipeNumericId = id ? parseInt(id.replace("user_", "").replace("official_", "")) : 0;
  const displayTags: string[] = localTags ?? ((recipe as any)?.tags ?? []);

  if (recipeQ.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={BRAND} size="large" />
        <Text style={s.loadTxt}>載入食譜中...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={52} color={HINT} />
        <Text style={s.loadTxt}>找不到食譜</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnTxt}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* 頂部大圖 */}
          <View style={s.hero}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={s.heroImg} resizeMode="cover" />
            ) : (
              <View style={[s.heroImg, s.heroPlaceholder]}>
                <Ionicons name="restaurant" size={56} color={HINT} />
              </View>
            )}
            {/* 漸層遮罩 */}
            <View style={s.heroGrad} />
            {/* 返回按鈕 */}
            <TouchableOpacity style={s.heroBack} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            {/* 烹飪模式按鈕 */}
            <TouchableOpacity style={s.heroCook} onPress={() => setCookMode(!cookMode)}>
              <Ionicons name={cookMode ? "close" : "restaurant-outline"} size={20} color="#fff" />
            </TouchableOpacity>
            {/* 食譜資訊 */}
            <View style={s.heroInfo}>
              {(recipe as any).source === "official" && (
                <View style={s.officialBadge}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={s.officialTxt}>官方食譜</Text>
                </View>
              )}
              <Text style={s.heroTitle}>{recipe.name}</Text>
              <View style={s.heroMeta}>
                {recipe.cookTime > 0 && (
                  <View style={s.metaChip}>
                    <Ionicons name="time-outline" size={12} color="#fff" />
                    <Text style={s.metaChipTxt}>{recipe.cookTime} 分鐘</Text>
                  </View>
                )}
                {recipe.servings > 0 && (
                  <View style={s.metaChip}>
                    <Ionicons name="people-outline" size={12} color="#fff" />
                    <Text style={s.metaChipTxt}>{recipe.servings} 人份</Text>
                  </View>
                )}
                {recipe.difficulty && (
                  <View style={s.metaChip}>
                    <Text style={s.metaChipTxt}>{recipe.difficulty}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 主要操作按鈕 */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.btnPrimary} onPress={() => {
              if (!isAuthenticated) { router.push("/login"); return; }
              setShowPlan(true);
            }}>
              <Ionicons name="calendar-outline" size={17} color="#fff" />
              <Text style={s.btnPriTxt}>加入排餐</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => {
              if (!isAuthenticated) { router.push("/login"); return; }
              const items = ingredients.map((ing: any) => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: "食材" }));
              if (items.length === 0) { Alert.alert("沒有食材資訊"); return; }
              addShoppingM.mutate({ items, fromRecipeId: id!, fromRecipeName: recipe.name });
            }}>
              <Ionicons name="cart-outline" size={17} color={BRAND} />
              <Text style={s.btnSecTxt}>加入採購</Text>
            </TouchableOpacity>
          </View>

          {/* 主婦貼士 */}
          {(recipe as any).housewifeTips && (
            <View style={s.tipsCard}>
              <View style={s.tipsRow}>
                <Ionicons name="bulb-outline" size={15} color="#F59E0B" />
                <Text style={s.tipsTitle}>主婦貼士</Text>
              </View>
              <Text style={s.tipsTxt}>{(recipe as any).housewifeTips}</Text>
            </View>
          )}

          {/* 標籤區塊 */}
          {(displayTags.length > 0 || isUserRecipe) && (
            <View style={s.tagsCard}>
              <View style={s.tagsHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="pricetags-outline" size={15} color={BRAND} />
                  <Text style={s.tagsTitle}>標籤</Text>
                </View>
                {isUserRecipe && isAuthenticated && (
                  <TouchableOpacity
                    style={s.editTagBtn}
                    onPress={() => { setLocalTags(displayTags); setShowTagEditor(true); }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={BRAND} />
                    <Text style={s.editTagTxt}>編輯</Text>
                  </TouchableOpacity>
                )}
              </View>
              {displayTags.length === 0 ? (
                <Text style={s.noTagTxt}>尚未添加標籤</Text>
              ) : (
                <View style={s.tagsRow}>
                  {displayTags.map((tag, i) => (
                    <View key={i} style={s.tagChip}>
                      <Text style={s.tagChipTxt}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 食材清單 */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>食材清單</Text>
              <Text style={s.cardSub}>{ingredients.length} 項</Text>
            </View>
            {ingredients.length === 0 ? (
              <Text style={s.emptyTxt}>暫無食材資訊</Text>
            ) : (
              ingredients.map((ing: any, i: number) => {
                const checked = checkedIng.has(i);
                return (
                  <View key={i} style={[s.ingRow, i < ingredients.length - 1 && s.ingBorder]}>
                    <TouchableOpacity
                      style={[s.checkbox, checked && s.checkboxOn]}
                      onPress={() => {
                        const n = new Set(checkedIng);
                        checked ? n.delete(i) : n.add(i);
                        setCheckedIng(n);
                      }}
                    >
                      {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </TouchableOpacity>
                    <Text style={[s.ingName, checked && s.ingNameDone]}>{ing.name}</Text>
                    <Text style={s.ingQty}>{ing.quantity} {ing.unit}</Text>
                    <TouchableOpacity
                      style={s.priceBtn}
                      onPress={() => { setPriceKw(ing.name); setShowPrice(true); }}
                    >
                      <Ionicons name="pricetag-outline" size={14} color={BRAND} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* 烹飪步驟 */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>烹飪步驟</Text>
              <Text style={s.cardSub}>{steps.length} 步</Text>
            </View>
            {/* 計時器 */}
            {cookMode && (
              <View style={s.timerBox}>
                <Text style={s.timerTxt}>{fmt(timerSec)}</Text>
                <View style={s.timerBtns}>
                  <TouchableOpacity style={s.timerBtn} onPress={() => setTimerOn(!timerOn)}>
                    <Ionicons name={timerOn ? "pause" : "play"} size={16} color={BRAND} />
                    <Text style={s.timerBtnTxt}>{timerOn ? "暫停" : "開始"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.timerBtn} onPress={() => { setTimerSec(0); setTimerOn(false); }}>
                    <Ionicons name="refresh" size={16} color={SUB} />
                    <Text style={[s.timerBtnTxt, { color: SUB }]}>重置</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {steps.length === 0 ? (
              <Text style={s.emptyTxt}>暫無步驟資訊</Text>
            ) : (
              steps.map((st: any, i: number) => {
                const desc = typeof st === "string" ? st : (st.description ?? st.step ?? st.instruction ?? "");
                const isActive = cookMode && step === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.stepCard, isActive && s.stepCardActive]}
                    onPress={() => cookMode && setStep(i)}
                    activeOpacity={cookMode ? 0.7 : 1}
                  >
                    <View style={[s.stepNum, isActive && s.stepNumActive]}>
                      <Text style={[s.stepNumTxt, isActive && { color: "#fff" }]}>{i + 1}</Text>
                    </View>
                    <Text style={[s.stepDesc, isActive && s.stepDescActive]}>{desc}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* 烹飪模式底部導航 */}
        {cookMode && (
          <View style={s.cookNav}>
            <TouchableOpacity
              style={[s.cookNavBtn, step === 0 && s.cookNavDisabled]}
              onPress={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <Ionicons name="chevron-back" size={20} color={step === 0 ? HINT : BRAND} />
              <Text style={[s.cookNavTxt, step === 0 && { color: HINT }]}>上一步</Text>
            </TouchableOpacity>
            <Text style={s.cookNavProg}>{step + 1} / {steps.length}</Text>
            <TouchableOpacity
              style={[s.cookNavBtn, step === steps.length - 1 && s.cookNavDisabled]}
              onPress={() => setStep(Math.min(steps.length - 1, step + 1))}
              disabled={step === steps.length - 1}
            >
              <Text style={[s.cookNavTxt, step === steps.length - 1 && { color: HINT }]}>下一步</Text>
              <Ionicons name="chevron-forward" size={20} color={step === steps.length - 1 ? HINT : BRAND} />
            </TouchableOpacity>
          </View>
        )}

        {/* 加入排餐 Modal */}
        <Modal visible={showPlan} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>加入排餐</Text>
                <TouchableOpacity onPress={() => setShowPlan(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              <Text style={s.sheetLabel}>選擇日期</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {dateOptions.map((d) => (
                  <TouchableOpacity
                    key={d.iso}
                    style={[s.dateChip, planDate === d.iso && s.dateChipActive]}
                    onPress={() => setPlanDate(d.iso)}
                  >
                    <Text style={[s.dateChipTxt, planDate === d.iso && { color: "#fff" }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.sheetLabel}>餐次</Text>
              <View style={s.mealRow}>
                {MEAL_TYPES.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.mealChip, planMeal === m.id && s.mealChipActive]}
                    onPress={() => setPlanMeal(m.id)}
                  >
                    <Text style={[s.mealChipTxt, planMeal === m.id && { color: "#fff" }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.confirmBtn, addPlanM.isPending && { opacity: 0.6 }]}
                onPress={() => addPlanM.mutate({ date: planDate, mealType: planMeal as any, recipeId: id!, recipeName: recipe.name, autoAddIngredients: true, ingredients: ingredients.map((ing: any) => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit })) })}
                disabled={addPlanM.isPending}
              >
                {addPlanM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnTxt}>確認加入</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 標籤編輯 Modal */}
        <Modal visible={showTagEditor} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>編輯標籤</Text>
                <TouchableOpacity onPress={() => setShowTagEditor(false)}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              {/* 現有標籤 */}
              <View style={s.tagsRow}>
                {(localTags ?? []).map((tag, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.tagChipRemovable}
                    onPress={() => setLocalTags(prev => (prev ?? []).filter((_, idx) => idx !== i))}
                  >
                    <Text style={s.tagChipTxt}>{tag}</Text>
                    <Ionicons name="close" size={12} color={BRAND} />
                  </TouchableOpacity>
                ))}
              </View>
              {/* 新增標籤輸入 */}
              {(localTags ?? []).length < 10 && (
                <View style={s.tagInputRow}>
                  <TextInput
                    style={s.tagInput}
                    placeholder="新增標籤（最多 10 個）"
                    placeholderTextColor={HINT}
                    value={newTag}
                    onChangeText={setNewTag}
                    maxLength={32}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const t = newTag.trim();
                      if (t && !(localTags ?? []).includes(t)) {
                        setLocalTags(prev => [...(prev ?? []), t]);
                      }
                      setNewTag("");
                    }}
                  />
                  <TouchableOpacity
                    style={s.tagAddBtn}
                    onPress={() => {
                      const t = newTag.trim();
                      if (t && !(localTags ?? []).includes(t)) {
                        setLocalTags(prev => [...(prev ?? []), t]);
                      }
                      setNewTag("");
                    }}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={{ fontSize: 11, color: HINT, marginBottom: 16 }}>點擊標籤可刪除</Text>
              <TouchableOpacity
                style={[s.confirmBtn, updateTagsM.isPending && { opacity: 0.6 }]}
                onPress={() => updateTagsM.mutate({ id: recipeNumericId, tags: localTags ?? [] })}
                disabled={updateTagsM.isPending}
              >
                {updateTagsM.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmBtnTxt}>儲存標籤</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 比價 Modal */}
        <Modal visible={showPrice} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>比價：{priceKw}</Text>
                <TouchableOpacity onPress={() => { setShowPrice(false); setPriceKw(""); }}>
                  <Ionicons name="close" size={22} color={TEXT} />
                </TouchableOpacity>
              </View>
              {priceQ.isLoading ? (
                <View style={{ alignItems: "center", padding: 32 }}>
                  <ActivityIndicator color={BRAND} />
                  <Text style={{ marginTop: 12, color: SUB }}>搜尋價格中...</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {SUPERMARKETS.map((sm) => {
                    const r = priceQ.data?.find((x: any) => x.platform?.toUpperCase() === sm.id);
                    return (
                      <TouchableOpacity key={sm.id} style={s.smRow} onPress={() => openSupermarket(sm.id, priceKw)}>
                        <Text style={{ fontSize: 22 }}>{sm.icon}</Text>
                        <Text style={s.smName}>{sm.name}</Text>
                        <Text style={s.smPrice}>{r?.price ? `HK$${r.price}` : "—"}</Text>
                        <View style={[s.smBtn, { backgroundColor: sm.color }]}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>前往</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={{ height: 20 }} />
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: BG },
  loadTxt: { fontSize: 15, color: SUB },
  backBtn: { backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnTxt: { color: "#fff", fontWeight: "700" },

  // Hero
  hero: { width: "100%", height: 300, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroPlaceholder: { backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  heroGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: 160, backgroundColor: "rgba(0,0,0,0.55)" },
  heroBack: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroCook: { position: "absolute", top: Platform.OS === "ios" ? 56 : 16, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroInfo: { position: "absolute", bottom: 16, left: 16, right: 16 },
  officialBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(245,158,11,0.25)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, alignSelf: "flex-start", marginBottom: 6 },
  officialTxt: { fontSize: 11, color: "#FCD34D", fontWeight: "700" },
  heroTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 8, lineHeight: 28 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  metaChipTxt: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // 操作按鈕
  actionRow: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 16 },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 14, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnPriTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: CARD, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND },
  btnSecTxt: { color: BRAND, fontSize: 15, fontWeight: "800" },

  // 主婦貼士
  tipsCard: { backgroundColor: "#FFFBEB", marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
  tipsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  tipsTitle: { fontSize: 14, fontWeight: "800", color: "#92400E" },
  tipsTxt: { fontSize: 13, color: "#78350F", lineHeight: 20 },

  // 卡片
  card: { backgroundColor: CARD, marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: TEXT },
  cardSub: { fontSize: 13, color: HINT },
  emptyTxt: { fontSize: 14, color: HINT, textAlign: "center", paddingVertical: 20 },

  // 食材
  ingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, gap: 10 },
  ingBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BRAND, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: BRAND },
  ingName: { flex: 1, fontSize: 14, color: TEXT, fontWeight: "500" },
  ingNameDone: { color: HINT, textDecorationLine: "line-through" },
  ingQty: { fontSize: 13, color: SUB, fontWeight: "600" },
  priceBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND_LIGHT, alignItems: "center", justifyContent: "center" },

  // 計時器
  timerBox: { backgroundColor: BRAND_LIGHT, borderRadius: 14, padding: 14, marginBottom: 14, alignItems: "center" },
  timerTxt: { fontSize: 36, fontWeight: "900", color: BRAND, fontVariant: ["tabular-nums"] },
  timerBtns: { flexDirection: "row", gap: 16, marginTop: 10 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: CARD, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  timerBtnTxt: { fontSize: 14, fontWeight: "700", color: BRAND },

  // 步驟
  stepCard: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER, alignItems: "flex-start" },
  stepCardActive: { backgroundColor: BRAND_LIGHT, borderRadius: 14, padding: 12, marginHorizontal: -4, borderBottomWidth: 0, marginBottom: 4 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumActive: { backgroundColor: BRAND },
  stepNumTxt: { fontSize: 13, fontWeight: "800", color: TEXT },
  stepDesc: { flex: 1, fontSize: 14, color: TEXT, lineHeight: 22 },
  stepDescActive: { color: BRAND, fontWeight: "600" },

  // 烹飪導航
  cookNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: CARD, paddingHorizontal: 24, paddingVertical: 14, paddingBottom: Platform.OS === "ios" ? 28 : 14, borderTopWidth: 1, borderTopColor: BORDER, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  cookNavBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  cookNavDisabled: { opacity: 0.4 },
  cookNavTxt: { fontSize: 15, fontWeight: "700", color: BRAND },
  cookNavProg: { fontSize: 16, fontWeight: "900", color: TEXT },

  // Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: TEXT },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },

  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", marginRight: 8 },
  dateChipActive: { backgroundColor: BRAND },
  dateChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },

  mealRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  mealChip: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  mealChipActive: { backgroundColor: BRAND },
  mealChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },

  confirmBtn: { backgroundColor: BRAND, paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // 標籤
  tagsCard: { backgroundColor: "#F0F4FF", marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16 },
  tagsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  tagsTitle: { fontSize: 14, fontWeight: "800", color: BRAND },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: "#E0EAFF", borderWidth: 1, borderColor: "#C7D9FF" },
  tagChipRemovable: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: "#E0EAFF", borderWidth: 1, borderColor: BRAND },
  tagChipTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  noTagTxt: { fontSize: 13, color: HINT, fontStyle: "italic" },
  editTagBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#E0EAFF" },
  editTagTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  tagInputRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  tagInput: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT },
  tagAddBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },

  // 比價
  smRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: BG, borderRadius: 14, padding: 14 },
  smName: { flex: 1, fontSize: 15, fontWeight: "700", color: TEXT },
  smPrice: { fontSize: 16, fontWeight: "900", color: BRAND },
  smBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
});
