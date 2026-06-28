import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Switch, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "#013E77";
const BG = "#F5F8FC";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";

const ROLE_LABEL: Record<string, string> = {
  owner: "主人",
  admin: "管理員",
  helper: "助手",
  member: "成員",
};

export default function KitchenSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFamily, activeFamilyId, familyRole, switchFamily, families } = useAuth();
  const utils = trpc.useUtils();

  // Debug: log activeFamily to check if inviteCode is present
  useEffect(() => {
    console.log("[KitchenSettings] activeFamily:", activeFamily);
    console.log("[KitchenSettings] inviteCode:", (activeFamily as any)?.inviteCode);
  }, [activeFamily]);

  // Force refetch family data when screen mounts to ensure fresh data
  useEffect(() => {
    utils.family.get.invalidate();
  }, []);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [changingRole, setChangingRole] = useState<{ userId: string; role: string } | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const isOwner = familyRole === "owner";
  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const renameM = trpc.family.rename.useMutation({
    onSuccess: () => {
      utils.family.get.invalidate();
      utils.family.list.invalidate();
      setEditingName(false);
    },
    onError: (e) => Alert.alert("改名失敗", e.message),
  });

  const updateRoleM = trpc.family.updateMemberRole.useMutation({
    onSuccess: () => utils.family.get.invalidate(),
    onError: (e) => Alert.alert("修改角色失敗", e.message),
  });

  const removeMemberM = trpc.family.removeMember.useMutation({
    onSuccess: () => utils.family.get.invalidate(),
    onError: (e) => Alert.alert("移除失敗", e.message),
  });

  const updateSettingsM = trpc.family.updateSettings.useMutation({
    onSuccess: () => utils.family.get.invalidate(),
    onError: (e) => Alert.alert("更新失敗", e.message),
  });

  const dissolveM = trpc.family.dissolve.useMutation({
    onSuccess: async () => {
      await switchFamily("");
      utils.family.list.invalidate();
      router.replace("/family");
    },
    onError: (e) => Alert.alert("解散失敗", e.message),
  });

  const settings = (activeFamily as any)?.settings ?? { approvalRequired: true };
  const members: any[] = (activeFamily as any)?.members ?? [];

  const handleStartRename = () => {
    setNameInput(activeFamily?.name ?? "");
    setEditingName(true);
  };

  const handleRename = () => {
    const name = nameInput.trim();
    if (!name || !activeFamilyId) return;
    renameM.mutate({ name });
  };

  const handleChangeRole = (userId: string, newRole: string) => {
    if (!activeFamilyId) return;
    const familyIdNum = Number(activeFamilyId);
    if (isNaN(familyIdNum)) return;
    updateRoleM.mutate({ familyId: familyIdNum, userId, role: newRole as any });
    setShowRolePicker(false);
    setChangingRole(null);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (!activeFamilyId) return;
    Alert.alert("移除成員", `確定要將「${name}」從廚房移除？`, [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => {
          const familyIdNum = Number(activeFamilyId);
          if (isNaN(familyIdNum)) return;
          removeMemberM.mutate({ familyId: familyIdNum, userId });
        },
      },
    ]);
  };

  const handleDissolve = () => {
    Alert.alert(
      "解散廚房",
      "確定要解散這個廚房？所有資料（排餐、購物清單、食材庫存）將會被永久刪除，無法復原！",
      [
        { text: "取消", style: "cancel" },
        {
          text: "確認解散",
          style: "destructive",
          onPress: () => dissolveM.mutate(),
        },
      ],
    );
  };

  const roleOptions = isOwner
    ? ["owner", "admin", "helper", "member"]
    : ["admin", "helper", "member"];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Kitchen name */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>廚房名稱</Text>
          <View style={s.card}>
            {editingName ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={s.input}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="輸入廚房名稱"
                  placeholderTextColor={SUB}
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={s.primaryBtn} onPress={handleRename} disabled={renameM.isPending}>
                    {renameM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>儲存</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.secondaryBtn} onPress={() => setEditingName(false)}>
                    <Text style={s.secondaryBtnText}>取消</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.row} onPress={handleStartRename} disabled={!isAdmin}>
                <Ionicons name="home-outline" size={20} color={BRAND} />
                <Text style={s.rowLabel}>{activeFamily?.name ?? "未命名廚房"}</Text>
                {isAdmin && <Ionicons name="pencil-outline" size={16} color={SUB} />}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Approval toggle */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>審批設定</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>成員提案需要審批</Text>
                <Text style={s.rowSub}>成員新增的排餐和食材需經管理員確認</Text>
              </View>
              <Switch
                value={settings.approvalRequired !== false}
                onValueChange={(v) => updateSettingsM.mutate({ approvalRequired: v })}
                trackColor={{ false: "#D1D5DB", true: BRAND + "60" }}
                thumbColor={settings.approvalRequired !== false ? BRAND : "#F9FAFB"}
                disabled={!isAdmin}
              />
            </View>
          </View>
        </View>

        {/* Members */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={s.sectionTitle}>成員 ({members.length})</Text>
          </View>
          {members.length === 0 ? (
            <Text style={{ color: SUB, textAlign: "center", padding: 20 }}>暫無成員</Text>
          ) : (
            members.map((m: any) => {
              const isSelf = String(m.userId) === String(activeFamily?.ownerId);
              return (
                <View key={m.id} style={s.memberCard}>
                  <View style={s.memberAvatar}>
                    <Text style={s.memberAvatarText}>
                      {(m.name || "?")[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>
                      {m.name || m.nickname || "成員"}
                      {isSelf ? <Text style={{ color: SUB, fontSize: 11 }}>（你）</Text> : null}
                    </Text>
                    <Text style={s.memberRole}>{ROLE_LABEL[m.familyRole] ?? m.familyRole}</Text>
                  </View>
                  {isAdmin && !isSelf && (
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      <TouchableOpacity
                        style={s.iconBtn}
                        onPress={() => {
                          setChangingRole({ userId: m.userId, role: m.familyRole });
                          setShowRolePicker(true);
                        }}
                      >
                        <Ionicons name="swap-horizontal-outline" size={18} color={BRAND} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.iconBtn}
                        onPress={() => handleRemoveMember(m.userId, m.name || m.nickname || m.familyRole)}
                      >
                        <Ionicons name="close-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Role Picker Modal */}
        {showRolePicker && changingRole && (
          <View style={s.overlay}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => { setShowRolePicker(false); setChangingRole(null); }} />
            <View style={s.sheet}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>變更角色</Text>
              {roleOptions.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[s.roleOption, changingRole.role === role && s.roleOptionActive]}
                  onPress={() => handleChangeRole(changingRole.userId, role)}
                >
                  <Text style={[s.roleOptionText, changingRole.role === role && s.roleOptionTextActive]}>
                    {ROLE_LABEL[role] ?? role}
                  </Text>
                  {changingRole.role === role && <Ionicons name="checkmark" size={20} color={BRAND} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Invite code */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>邀請碼</Text>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: BRAND, letterSpacing: 3 }}>
                {(activeFamily as any)?.inviteCode ?? "---"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity 
                  style={s.secondaryBtn} 
                  onPress={async () => {
                    const code = (activeFamily as any)?.inviteCode;
                    if (code) {
                      await Clipboard.setStringAsync(code);
                      Alert.alert("已複製", `邀請碼 ${code} 已複製到剪貼簿`);
                    }
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={BRAND} />
                  <Text style={s.secondaryBtnText}>複製</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.primaryBtn} onPress={() => router.push("/family")}>
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={s.primaryBtnText}>分享</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        {isOwner && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: "#EF4444" }]}>危險區域</Text>
            <TouchableOpacity
              style={s.dangerCard}
              onPress={handleDissolve}
              disabled={dissolveM.isPending}
            >
              <Ionicons name="warning-outline" size={22} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={s.dangerText}>解散此廚房</Text>
                <Text style={s.dangerSub}>所有資料將被永久刪除</Text>
              </View>
              {dissolveM.isPending ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#EF4444" />
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Math.max(insets.bottom + 16, 40) }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: TEXT, marginBottom: 8 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TEXT,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  rowBetween: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  rowLabel: { fontSize: 15, fontWeight: "700", color: TEXT, flex: 1 },
  rowSub: { fontSize: 11, color: SUB, marginTop: 2 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: BRAND, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  secondaryBtnText: { color: BRAND, fontSize: 13, fontWeight: "600" },
  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    marginBottom: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { fontSize: 16, fontWeight: "800", color: BRAND },
  memberName: { fontSize: 14, fontWeight: "700", color: TEXT },
  memberRole: { fontSize: 12, color: SUB, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8",
    alignSelf: "center", marginTop: 10, marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 12,
  },
  roleOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 16,
    borderRadius: 10, marginBottom: 4,
  },
  roleOptionActive: { backgroundColor: "#EEF4FB" },
  roleOptionText: { fontSize: 15, fontWeight: "600", color: TEXT },
  roleOptionTextActive: { color: BRAND, fontWeight: "800" },
  dangerCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FEF2F2", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#FECACA",
  },
  dangerText: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
  dangerSub: { fontSize: 11, color: SUB, marginTop: 2 },
});
