import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COMMON_UNITS = [
  { label: "克", value: "克", category: "weight" },
  { label: "公斤 (kg)", value: "公斤", category: "weight" },
  { label: "磅 (lb)", value: "磅", category: "weight" },
  { label: "安士 (oz)", value: "安士", category: "weight" },
  { label: "毫升 (ml)", value: "毫升", category: "volume" },
  { label: "公升 (L)", value: "公升", category: "volume" },
  { label: "茶匙 (tsp)", value: "茶匙", category: "volume" },
  { label: "湯匙 (tbsp)", value: "湯匙", category: "volume" },
  { label: "個", value: "個", category: "count" },
  { label: "隻", value: "隻", category: "count" },
  { label: "條", value: "條", category: "count" },
  { label: "塊", value: "塊", category: "count" },
  { label: "片", value: "片", category: "count" },
  { label: "包", value: "包", category: "count" },
  { label: "罐", value: "罐", category: "count" },
  { label: "盒", value: "盒", category: "count" },
  { label: "瓶", value: "瓶", category: "count" },
  { label: "碗", value: "碗", category: "volume" },
  { label: "杯", value: "杯", category: "volume" },
  { label: "束", value: "束", category: "count" },
  { label: "把", value: "把", category: "count" },
  { label: "粒", value: "粒", category: "count" },
  { label: "瓣", value: "瓣", category: "count" },
  { label: "串", value: "串", category: "count" },
  { label: "扎", value: "扎", category: "count" },
  { label: "鑊", value: "鑊", category: "count" },
  { label: "適量", value: "適量", category: "other" },
  { label: "少許", value: "少許", category: "other" },
];

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  "克": { "公斤": 0.001, "磅": 0.00220462, "安士": 0.035274 },
  "公斤": { "克": 1000, "磅": 2.20462, "安士": 35.274 },
  "磅": { "克": 453.592, "公斤": 0.453592, "安士": 16 },
  "安士": { "克": 28.3495, "公斤": 0.0283495, "磅": 0.0625 },
  "毫升": { "公升": 0.001, "杯": 0.00422675, "湯匙": 0.0666667, "茶匙": 0.2 },
  "公升": { "毫升": 1000, "杯": 4.22675, "湯匙": 66.6667, "茶匙": 200 },
};

interface Props {
  value: string;
  onChange: (unit: string) => void;
  onUnitChange?: (oldUnit: string, newUnit: string) => void;
  quantity?: number;
  onQuantityChange?: (newQty: number) => void;
  style?: any;
}

export default function UnitPicker({ value, onChange, onUnitChange, quantity, onQuantityChange, style }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  useEffect(() => {
    loadCustomUnits();
  }, []);

  const loadCustomUnits = async () => {
    try {
      const stored = await AsyncStorage.getItem("@kindcipe:custom-units");
      if (stored) {
        setCustomUnits(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom units:", e);
    }
  };

  const saveCustomUnit = async (unit: string) => {
    if (!customUnits.includes(unit)) {
      const updated = [...customUnits, unit];
      setCustomUnits(updated);
      try {
        await AsyncStorage.setItem("@kindcipe:custom-units", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save custom unit:", e);
      }
    }
  };

  const selected = COMMON_UNITS.find(u => u.value === value) || customUnits.find(u => u === value);

  const handleUnitChange = (newUnit: string) => {
    if (onUnitChange && quantity !== undefined && onQuantityChange) {
      onUnitChange(value, newUnit);
      const conversion = UNIT_CONVERSIONS[value]?.[newUnit];
      if (conversion) {
        const newQty = parseFloat((quantity * conversion).toFixed(2));
        onQuantityChange(newQty);
      }
    }
    onChange(newUnit);
    setOpen(false);
  };

  const handleCustomUnitConfirm = () => {
    if (custom.trim()) {
      saveCustomUnit(custom.trim());
      handleUnitChange(custom.trim());
    }
  };

  const allUnits = [
    ...COMMON_UNITS,
    ...customUnits.map(u => ({ label: u, value: u, category: "custom" as const }))
  ];

  const renderSection = (title: string, units: typeof COMMON_UNITS) => {
    if (units.length === 0) return null;
    return (
      <>
        <View style={s_unit.sectionHeader}>
          <Text style={s_unit.sectionTitle}>{title}</Text>
        </View>
        {units.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[s_unit.opt, value === item.value && s_unit.optActive]}
            onPress={() => handleUnitChange(item.value)}
          >
            <Text style={[s_unit.optTxt, value === item.value && s_unit.optTxtActive]}>{item.label}</Text>
            {value === item.value && <Text style={s_unit.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const weightUnits = allUnits.filter(u => u.category === "weight");
  const volumeUnits = allUnits.filter(u => u.category === "volume");
  const countUnits = allUnits.filter(u => u.category === "count");
  const otherUnits = allUnits.filter(u => u.category === "other");
  const customSectionUnits = allUnits.filter(u => u.category === "custom");

  return (
    <>
      <TouchableOpacity
        style={[s_unit.trigger, style]}
        onPress={() => setOpen(true)}
      >
        <Text style={[s_unit.triggerTxt, !selected && !value && { color: "#9CA3AF" }]}>
          {typeof selected === "string" ? selected : selected?.label || value || "單位"}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={s_unit.overlay}>
          <View style={s_unit.sheet}>
            <View style={s_unit.header}>
              <Text style={s_unit.title}>選擇單位</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s_unit.closeBtn}>完成</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={[]}
              keyExtractor={item => String(item)}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={() => null}
              ListHeaderComponent={
                <>
                  {renderSection("📏 重量單位", weightUnits)}
                  {renderSection("📐 體積單位", volumeUnits)}
                  {renderSection("🔢 數量單位", countUnits)}
                  {renderSection("📝 其他", otherUnits)}
                  {customSectionUnits.length > 0 && renderSection("⭐ 自訂單位", customSectionUnits)}
                </>
              }
              ListFooterComponent={() => (
                <View style={s_unit.customRow}>
                  <TextInput
                    style={s_unit.customInput}
                    value={custom}
                    onChangeText={setCustom}
                    placeholder="輸入自訂單位…"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={handleCustomUnitConfirm}
                  />
                  <TouchableOpacity
                    style={[s_unit.customBtn, !custom.trim() && { opacity: 0.4 }]}
                    disabled={!custom.trim()}
                    onPress={handleCustomUnitConfirm}
                  >
                    <Text style={s_unit.customBtnTxt}>確定</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s_unit = StyleSheet.create({
  trigger: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 80,
    alignItems: "center",
  },
  triggerTxt: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  closeBtn: { fontSize: 15, fontWeight: "600", color: "#013E77" },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  optActive: { backgroundColor: "#EEF4FB" },
  optTxt: { flex: 1, fontSize: 15, color: "#1A1A1A" },
  optTxtActive: { fontWeight: "700", color: "#013E77" },
  check: { fontSize: 16, color: "#013E77", fontWeight: "700" },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  customInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#1A1A1A",
  },
  customBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#013E77",
    borderRadius: 8,
  },
  customBtnTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
