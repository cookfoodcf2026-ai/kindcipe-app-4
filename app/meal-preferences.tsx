import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/errors";
import { canva } from "@/app/styles/colors";
import {
  COMMON_ALLERGENS,
  COMMON_DISLIKES,
  DEFAULT_MEAL_PREFERENCES,
  normalizeMealPreferences,
  type MealPreferenceTime,
} from "@/lib/mealPreferences";

const BRAND = canva.primary;
const ORANGE = canva.accent;
const BG = canva.bg;
const TEXT = canva.primary;
const SUB = canva.muted;
const BORDER = canva.border;

const TIME_OPTIONS: { key: MealPreferenceTime; label: string }[] = [
  { key: "quick", label: "快手" },
  { key: "normal", label: "普通" },
  { key: "leisure", label: "慢慢煮" },
];

export default function MealPreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFamilyId, familyRole } = useAuth();
  const utils = trpc.useUtils();
  const canEdit = familyRole === "owner" || familyRole === "admin";

  const { data, isLoading, isError, refetch } = trpc.family.settings.useQuery(undefined, {
    enabled: !!activeFamilyId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const updateSettingsM = trpc.family.updateSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.family.settings.invalidate(),
        utils.family.get.invalidate(),
      ]);
      Alert.alert(t("已儲存" as any));
    },
    onError: (e: any) => Alert.alert(t("儲存失敗" as any), friendlyError(e) || t("再試一次" as any)),
  });

  const [servings, setServings] = useState(DEFAULT_MEAL_PREFERENCES.servings);
  const [timeModes, setTimeModes] = useState<MealPreferenceTime[]>(DEFAULT_MEAL_PREFERENCES.timeModes);
  const [hasKids, setHasKids] = useState(false);
  const [hasElderly, setHasElderly] = useState(false);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dislikeInput, setDislikeInput] = useState("");
  const [allergenInput, setAllergenInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    const prefs = normalizeMealPreferences((data as any)?.mealPreferences);
    setServings(prefs.servings);
    setTimeModes(prefs.timeModes);
    setHasKids(prefs.hasKids);
    setHasElderly(prefs.hasElderly);
    setDislikes(prefs.dislikes);
    setAllergens(prefs.allergens);
    setInitialized(true);
  }, [data, initialized]);

  const toggleValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value].slice(0, 20)));
  };

  const addValue = (
    input: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clear: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const value = input.trim();
    if (!value) return;
    setter((prev) => (prev.includes(value) ? prev : [...prev, value].slice(0, 20)));
    clear("");
  };

  const addDislike = () => addValue(dislikeInput, setDislikes, setDislikeInput);
  const addAllergen = () => addValue(allergenInput, setAllergens, setAllergenInput);

  const save = () => {
    if (!canEdit || updateSettingsM.isPending) return;
    updateSettingsM.mutate({
      mealPreferences: {
        servings,
        time: timeModes[0] ?? "normal",
        timeModes,
        hasKids,
        hasElderly,
        dislikes,
        allergens,
      },
    });
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={BRAND} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("AI 排餐偏好" as any)}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading || (!initialized && !isError) ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={s.muted}>{t("載入中" as any)}</Text>
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={34} color={SUB} />
          <Text style={s.muted}>{t("載入失敗" as any)}</Text>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => void refetch()}>
            <Text style={s.secondaryBtnTxt}>{t("再試一次" as any)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}>
          {!canEdit && (
            <View style={s.notice}>
              <Ionicons name="lock-closed-outline" size={14} color={SUB} />
              <Text style={s.noticeTxt}>{t("只限 owner / admin 修改" as any)}</Text>
            </View>
          )}

          <View style={s.card}>
            <Text style={s.label}>{t("預設人數" as any)}</Text>
            <View style={s.stepper}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setServings((v) => Math.max(1, v - 1))}
                disabled={!canEdit || servings <= 1}
              >
                <Ionicons name="remove" size={20} color={BRAND} />
              </TouchableOpacity>
              <Text style={s.stepValue}>{servings}</Text>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setServings((v) => Math.min(12, v + 1))}
                disabled={!canEdit || servings >= 12}
              >
                <Ionicons name="add" size={20} color={BRAND} />
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>{t("預設幾多人食" as any)}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("預設煮食時間" as any)}</Text>
            <View style={s.chips}>
              {TIME_OPTIONS.map((option) => {
                const active = timeModes.includes(option.key);
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => {
                      if (!canEdit) return;
                      setTimeModes((prev) => {
                        if (prev.includes(option.key)) {
                          return prev.length === 1 ? prev : prev.filter((x) => x !== option.key);
                        }
                        return [...prev, option.key];
                      });
                    }}
                    disabled={!canEdit}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t(option.label as any)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.card}>
            <View style={s.switchRow}>
              <Text style={s.label}>{t("有小朋友" as any)}</Text>
              <Switch
                value={hasKids}
                onValueChange={setHasKids}
                disabled={!canEdit}
                trackColor={{ false: "#E6DED4", true: `${ORANGE}80` }}
                thumbColor={hasKids ? ORANGE : "#FFF8EF"}
              />
            </View>
            <View style={s.divider} />
            <View style={s.switchRow}>
              <Text style={s.label}>{t("有老人家" as any)}</Text>
              <Switch
                value={hasElderly}
                onValueChange={setHasElderly}
                disabled={!canEdit}
                trackColor={{ false: "#E6DED4", true: `${ORANGE}80` }}
                thumbColor={hasElderly ? ORANGE : "#FFF8EF"}
              />
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("敏感 / 必須避免" as any)}</Text>
            <Text style={s.hint}>{t("呢啲會完全排除，唔會出錯。" as any)}</Text>
            <View style={s.chips}>
              {COMMON_ALLERGENS.map((item) => {
                const active = allergens.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => canEdit && toggleValue(item, setAllergens)}
                    disabled={!canEdit}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t(item as any)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={allergenInput}
                onChangeText={setAllergenInput}
                onSubmitEditing={addAllergen}
                returnKeyType="done"
                editable={canEdit}
                placeholder={t("其他敏感食材" as any)}
                placeholderTextColor="#8A99A8"
              />
              <TouchableOpacity style={s.addBtn} onPress={addAllergen} disabled={!canEdit}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={s.chips}>
              {allergens.filter((item) => !COMMON_ALLERGENS.includes(item)).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={s.dislikeChip}
                  onPress={() => canEdit && setAllergens((prev) => prev.filter((x) => x !== item))}
                  disabled={!canEdit}
                >
                  <Text style={s.dislikeTxt}>{item}</Text>
                  {canEdit && <Ionicons name="close" size={13} color={SUB} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.label}>{t("唔食 / 偏好" as any)}</Text>
            <Text style={s.hint}>{t("可揀多個；AI 會盡量避開。" as any)}</Text>
            <View style={s.chips}>
              {COMMON_DISLIKES.map((item) => {
                const active = dislikes.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => canEdit && toggleValue(item, setDislikes)}
                    disabled={!canEdit}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t(item as any)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={dislikeInput}
                onChangeText={setDislikeInput}
                onSubmitEditing={addDislike}
                returnKeyType="done"
                editable={canEdit}
                placeholder={t("其他唔食食材" as any)}
                placeholderTextColor="#8A99A8"
              />
              <TouchableOpacity style={s.addBtn} onPress={addDislike} disabled={!canEdit}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={s.chips}>
              {dislikes.filter((item) => !COMMON_DISLIKES.includes(item)).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={s.dislikeChip}
                  onPress={() => canEdit && setDislikes((prev) => prev.filter((x) => x !== item))}
                  disabled={!canEdit}
                >
                  <Text style={s.dislikeTxt}>{item}</Text>
                  {canEdit && <Ionicons name="close" size={13} color={SUB} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[s.saveBtn, (!canEdit || updateSettingsM.isPending) && { opacity: 0.5 }]}
          onPress={save}
          disabled={!canEdit || updateSettingsM.isPending}
        >
          {updateSettingsM.isPending ? (
            <ActivityIndicator size="small" color="#183B56" />
          ) : (
            <Text style={s.saveTxt}>{t("儲存" as any)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F8F1E7", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "900", color: TEXT },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10 },
  label: { fontSize: 14, fontWeight: "800", color: TEXT },
  hint: { fontSize: 11, color: SUB, lineHeight: 16 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, paddingVertical: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F8F1E7", alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 40, textAlign: "center", fontSize: 24, fontWeight: "900", color: BRAND },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: "#E8F0F4" },
  chipActive: { backgroundColor: BRAND },
  chipTxt: { fontSize: 12, fontWeight: "700", color: SUB },
  chipTxtActive: { color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: "#F4F0EA" },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: "#FFF8EF", borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, color: TEXT },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  dislikeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#FDE7D7", borderWidth: 1, borderColor: "#F3D7B3" },
  dislikeTxt: { fontSize: 12, fontWeight: "700", color: "#A14E1D" },
  notice: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E8F0F4", borderRadius: 10, padding: 10 },
  noticeTxt: { fontSize: 11, color: SUB, flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  muted: { fontSize: 12, color: SUB },
  secondaryBtn: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F8F1E7" },
  secondaryBtnTxt: { fontSize: 13, fontWeight: "700", color: BRAND },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: BORDER },
  saveBtn: { minHeight: 46, borderRadius: 13, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  saveTxt: { fontSize: 15, fontWeight: "900", color: "#183B56" },
});
