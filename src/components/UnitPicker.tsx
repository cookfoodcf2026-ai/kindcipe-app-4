import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  StyleSheet,
} from "react-native";

const COMMON_UNITS = [
  { label: "克", value: "克" },
  { label: "公斤 (kg)", value: "公斤" },
  { label: "毫升 (ml)", value: "毫升" },
  { label: "公升 (L)", value: "公升" },
  { label: "茶匙 (tsp)", value: "茶匙" },
  { label: "湯匙 (tbsp)", value: "湯匙" },
  { label: "個", value: "個" },
  { label: "隻", value: "隻" },
  { label: "條", value: "條" },
  { label: "塊", value: "塊" },
  { label: "片", value: "片" },
  { label: "包", value: "包" },
  { label: "罐", value: "罐" },
  { label: "盒", value: "盒" },
  { label: "瓶", value: "瓶" },
  { label: "碗", value: "碗" },
  { label: "杯", value: "杯" },
  { label: "束", value: "束" },
  { label: "把", value: "把" },
  { label: "粒", value: "粒" },
  { label: "瓣", value: "瓣" },
  { label: "適量", value: "適量" },
  { label: "少許", value: "少許" },
];

interface Props {
  value: string;
  onChange: (unit: string) => void;
  style?: any;
}

export default function UnitPicker({ value, onChange, style }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const selected = COMMON_UNITS.find(u => u.value === value);

  return (
    <>
      <TouchableOpacity
        style={[s_unit.trigger, style]}
        onPress={() => setOpen(true)}
      >
        <Text style={[s_unit.triggerTxt, !selected && !value && { color: "#9CA3AF" }]}>
          {selected?.label || value || "單位"}
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
              data={COMMON_UNITS}
              keyExtractor={item => item.value}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s_unit.opt, value === item.value && s_unit.optActive]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text style={[s_unit.optTxt, value === item.value && s_unit.optTxtActive]}>{item.label}</Text>
                  {value === item.value && <Text style={s_unit.check}>✓</Text>}
                </TouchableOpacity>
              )}
              ListFooterComponent={() => (
                <View style={s_unit.customRow}>
                  <TextInput
                    style={s_unit.customInput}
                    value={custom}
                    onChangeText={setCustom}
                    placeholder="輸入自訂單位…"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={() => { if (custom.trim()) { onChange(custom.trim()); setOpen(false); } }}
                  />
                  <TouchableOpacity
                    style={[s_unit.customBtn, !custom.trim() && { opacity: 0.4 }]}
                    disabled={!custom.trim()}
                    onPress={() => { if (custom.trim()) { onChange(custom.trim()); setOpen(false); } }}
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
