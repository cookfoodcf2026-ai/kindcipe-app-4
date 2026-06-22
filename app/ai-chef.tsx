import { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Platform, Modal, ScrollView, Alert, Keyboard,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#8A94A6";
const HINT = "#B0BAC9";
const BORDER = "#E0EAF4";
const GREEN = "#16A34A";

const FIXED_PROMPTS = [
  "30分鐘內可以做好的家常菜",
  "今晚想吃清淡一點，4個人份",
];
const FOOD_PROMPTS = [
  "冰箱有雞胸肉和豆腐，可以煮什麼？",
  "預算$100以內，煮一頓豐盛晚餐",
  "小朋友喜歡吃的菜式",
  "想用番茄和雞蛋做一道菜",
  "冰箱只剩豬肉和椰菜",
  "想吃辣，有什麼好提議？",
  "用三文魚可以做什麼？",
  "有急凍蝦仁和翠玉瓜",
  "想煲湯，有什麼簡單的？",
  "牛肉和洋蔥可以煮什麼？",
  "想做咖喱，有什麼食譜？",
  "夏天想食開胃菜",
  "想整甜品，有什麼推介？",
  "有免治豬肉和豆腐",
  "想用鑄鐵鍋一鍋煮",
];

function getRandomPrompts(count = 3): string[] {
  const shuffled = [...FOOD_PROMPTS].sort(() => Math.random() - 0.5);
  return [...FIXED_PROMPTS, ...shuffled.slice(0, count)];
}

const MEAL_TYPES = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" },
  { id: "snack", label: "小食" },
];

type Message = { role: "user" | "assistant"; content: string };
type AIRecipe = {
  name: string; cookTime: number; servings: number;
  difficulty: string; description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
};

export default function AIChefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeFamily } = useAuth();
  const kitchenName = activeFamily?.name ?? "Kindcipe";
  const userName = user?.name ?? "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [recommendedRecipes, setRecommendedRecipes] = useState<AIRecipe[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

  useEffect(() => { setSuggestedPrompts(getRandomPrompts(3)); }, []);

  const [keyboardH, setKeyboardH] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const [showPlan, setShowPlan] = useState(false);
  const [planAction, setPlanAction] = useState<"meal" | "shopping">("meal");
  const [planRecipe, setPlanRecipe] = useState<AIRecipe | null>(null);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [planMeal, setPlanMeal] = useState("dinner");

  const chatMutation = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      if (data.recipes?.length > 0) setRecommendedRecipes(data.recipes);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "抱歉，AI 助手暫時無法回應" }]);
    },
  });

  const saveRecipeM = trpc.customRecipe.create.useMutation();
  const addPlanM = trpc.mealPlan.add.useMutation({
    onError: (e) => Alert.alert("加入排餐失敗", e.message),
  });
  const addShoppingM = trpc.shopping.addBatch.useMutation({
    onSuccess: (data) => { setShowPlan(false); Alert.alert("已加入採購", `${data.count} 項食材已加入採購清單`); },
    onError: (e) => Alert.alert("失敗", e.message),
  });

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { iso: d.toISOString().split("T")[0], label: i === 0 ? "今天" : i === 1 ? "明天" : d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric", weekday: "short" }) };
  });

  const scrollToEnd = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setInput("");
    setRecommendedRecipes([]);
    const msgs: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(msgs);
    chatMutation.mutate({ messages: msgs });
    scrollToEnd();
  };

  const confirmAction = () => {
    if (!planRecipe) return;
    if (planAction === "meal") {
      saveRecipeM.mutate({
        name: planRecipe.name,
        description: planRecipe.description,
        cookTime: planRecipe.cookTime,
        servings: planRecipe.servings,
        difficulty: planRecipe.difficulty,
        ingredients: JSON.stringify(planRecipe.ingredients.map(ing => ({
          name: ing.name, quantity: ing.quantity, unit: ing.unit, category: "食材",
        }))),
        steps: "[]",
        sourceType: "manual",
      }, {
        onSuccess: (saved) => {
          addPlanM.mutate({
            date: planDate, mealType: planMeal as any,
            recipeId: `user_${saved.id}`, recipeName: planRecipe.name,
            autoAddIngredients: true,
            ingredients: planRecipe.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit })),
          }, {
            onSuccess: () => {
              setShowPlan(false);
              setRecommendedRecipes([]);
              router.push(`/recipe/user_${saved.id}`);
            },
          });
        },
      });
    } else {
      addShoppingM.mutate({
        items: planRecipe.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, unit: ing.unit, category: "食材" })),
        fromRecipeName: planRecipe.name, plannedDate: planDate,
      });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[s.msgRow, isUser && { justifyContent: "flex-end" }]}>
        {!isUser && <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleBot]}>
          <Text style={[s.bubbleTxt, isUser && { color: "#fff" }]} selectable>{item.content}</Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name="sparkles" size={48} color={BRAND} /></View>
      <Text style={s.emptyTitle}>
        {userName ? `${userName}，今晚食咩好？` : "今晚食咩好？"}
      </Text>
      <Text style={s.emptySub}>
        {userName ? `${kitchenName}的 AI 助手` : "AI 幫你決定今晚煮什麼"}
      </Text>
      <View style={s.promptRow}>
            {suggestedPrompts.map((p, i) => (
          <TouchableOpacity key={i} style={s.promptChip} onPress={() => {
            const msgs: Message[] = [...messages, { role: "user", content: p }];
            setMessages(msgs);
            chatMutation.mutate({ messages: msgs });
            scrollToEnd();
          }} disabled={chatMutation.isPending}>
            <Text style={s.promptChipTxt}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{
        title: "AI 食譜助手",
        headerStyle: { backgroundColor: BG }, headerTintColor: BRAND,
        headerTitleStyle: { fontWeight: "800" },
      }} />
      <SafeAreaView style={s.root} edges={["top"]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, i) => String(i)}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={messages.length === 0 ? s.emptyList : s.list}
          onContentSizeChange={() => messages.length > 0 && scrollToEnd()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={chatMutation.isPending ? (
            <View style={[s.msgRow]}>
              <View style={s.avatar}><Ionicons name="sparkles" size={16} color={BRAND} /></View>
              <View style={[s.bubbleBot, s.typing]}>
                <ActivityIndicator size="small" color={BRAND} />
              </View>
            </View>
          ) : null}
        />

        {recommendedRecipes.length > 0 && (
          <View style={s.recBar}>
            <Text style={s.recTitle}><Ionicons name="restaurant-outline" size={13} /> AI 推薦食譜</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
              {recommendedRecipes.map((r, i) => (
                <View key={i} style={s.recCard}>
                  <View style={s.recCardTop}>
                    <Ionicons name="restaurant-outline" size={18} color={BRAND} />
                    <Text style={s.recCardDiff}>{r.difficulty}</Text>
                  </View>
                  <View style={s.recCardBody}>
                    <Text style={s.recCardName} numberOfLines={2}>{r.name}</Text>
                    <View style={s.recCardMeta}>
                      <Text style={s.recCardMetaTxt}>{r.cookTime}分</Text>
                      <Text style={s.recCardMetaTxt}>{r.servings}人</Text>
                      <Text style={[s.recCardMetaTxt, { color: GREEN }]}>{r.ingredients.length}食材</Text>
                    </View>
                    <View style={s.recCardBtns}>
                      <TouchableOpacity style={s.btnMeal} onPress={() => { setPlanRecipe(r); setPlanAction("meal"); setShowPlan(true); }}>
                        <Text style={s.btnMealTxt}>加排餐</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnShop} onPress={() => { setPlanRecipe(r); setPlanAction("shopping"); setShowPlan(true); }}>
                        <Text style={s.btnShopTxt}>加採購</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + keyboardH }]}>
          <TextInput
            style={s.input}
            value={input} onChangeText={setInput}
            placeholder="告訴我你想吃什麼..."
            placeholderTextColor={HINT}
            multiline maxLength={500}
            returnKeyType="send" onSubmitEditing={handleSend} blurOnSubmit
          />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || chatMutation.isPending) && s.sendOff]} onPress={handleSend} disabled={!input.trim() || chatMutation.isPending}>
            {chatMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showPlan} transparent animationType="slide">
        <View style={m.overlay}><View style={m.sheet}>
          <View style={m.handle} />
          <View style={m.head}>
            <Text style={m.title}>{planAction === "meal" ? "加入排餐" : "加入採購"}</Text>
            <TouchableOpacity onPress={() => setShowPlan(false)}><Ionicons name="close" size={22} color={TEXT} /></TouchableOpacity>
          </View>
          {planRecipe && <Text style={m.rname} numberOfLines={1}>{planRecipe.name}</Text>}
          {planAction === "meal" && <>
            <Text style={m.label}>餐次</Text>
            <View style={m.mealRow}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt.id} style={[m.mealChip, planMeal === mt.id && m.mealChipOn]} onPress={() => setPlanMeal(mt.id)}>
                  <Text style={[m.mealChipTxt, planMeal === mt.id && { color: "#fff" }]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
          <Text style={m.label}>日期</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {dateOptions.map(d => (
              <TouchableOpacity key={d.iso} style={[m.dateChip, planDate === d.iso && m.dateChipOn]} onPress={() => setPlanDate(d.iso)}>
                <Text style={[m.dateChipTxt, planDate === d.iso && { color: "#fff" }]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {planRecipe && (
            <View style={m.preview}>
              <Text style={m.label}>食材</Text>
              {planRecipe.ingredients.slice(0, 5).map((ing, i) => (
                <Text key={i} style={m.previewItem}>· {ing.name} {ing.quantity}{ing.unit}</Text>
              ))}
              {planRecipe.ingredients.length > 5 && <Text style={m.previewMore}>還有 {planRecipe.ingredients.length - 5} 項...</Text>}
            </View>
          )}
          <TouchableOpacity style={[m.btn, (saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending) && { opacity: 0.6 }]} onPress={confirmAction} disabled={saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending}>
            {(saveRecipeM.isPending || addPlanM.isPending || addShoppingM.isPending) ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.btnTxt}>確認</Text>}
          </TouchableOpacity>
        </View></View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  emptyList: { flexGrow: 1, padding: 20, paddingTop: 24 },
  list: { padding: 14 },

  // Messages
  msgRow: { flexDirection: "row", marginBottom: 12, gap: 8, alignItems: "flex-end" },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BRAND, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: CARD, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER },
  bubbleTxt: { fontSize: 14, color: TEXT, lineHeight: 21 },
  typing: { paddingHorizontal: 18, paddingVertical: 14 },

  // Empty
  empty: { alignItems: "center", paddingHorizontal: 16 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 14, color: SUB, marginBottom: 24 },
  promptRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  promptChip: { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: BORDER },
  promptChipTxt: { fontSize: 13, color: BRAND, fontWeight: "600" },

  // Rec
  recBar: { borderTopWidth: 1, borderTopColor: BORDER, padding: 12 },
  recTitle: { fontSize: 12, fontWeight: "700", color: BRAND, marginBottom: 10 },
  recScroll: { gap: 10 },
  recCard: { width: 170, backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, overflow: "hidden" },
  recCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: "#EEF4FB" },
  recCardDiff: { fontSize: 10, fontWeight: "700", color: BRAND },
  recCardBody: { padding: 10 },
  recCardName: { fontSize: 13, fontWeight: "800", color: TEXT, lineHeight: 18, marginBottom: 6 },
  recCardMeta: { flexDirection: "row", gap: 8, marginBottom: 8 },
  recCardMetaTxt: { fontSize: 10, color: SUB },
  recCardBtns: { flexDirection: "row", gap: 6 },
  btnMeal: { flex: 1, backgroundColor: BRAND, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  btnMealTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnShop: { flex: 1, backgroundColor: GREEN, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  btnShopTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },

  // Input
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD },
  input: { flex: 1, backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TEXT, maxHeight: 100, minHeight: 40, borderWidth: 1, borderColor: BORDER },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: TEXT },
  rname: { fontSize: 14, color: SUB, fontWeight: "600", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: SUB, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  mealChip: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  mealChipOn: { backgroundColor: BRAND },
  mealChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", marginRight: 8 },
  dateChipOn: { backgroundColor: BRAND },
  dateChipTxt: { fontSize: 13, fontWeight: "700", color: TEXT },
  preview: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  previewItem: { fontSize: 13, color: TEXT, lineHeight: 22 },
  previewMore: { fontSize: 12, color: SUB, marginTop: 4 },
  btn: { backgroundColor: BRAND, paddingVertical: 16, borderRadius: 14, alignItems: "center", shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
