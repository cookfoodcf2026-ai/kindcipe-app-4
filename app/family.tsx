import { useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share, Modal, TextInput, FlatList,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

const BRAND = "#013E77";

const ROLE_LABEL: Record<string, string> = {
  owner: "主人",
  admin: "管理員",
  helper: "助手",
  member: "成員",
};

export default function FamilyScreen() {
  const router = useRouter();
  const { families, activeFamily, activeFamilyId, switchFamily, familyRole } = useAuth();
  const utils = trpc.useUtils();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const createM = trpc.family.create.useMutation({
    onSuccess: async (data) => {
      utils.family.list.invalidate();
      setShowCreateModal(false);
      setFamilyName("");
      const id = String((data as any).id);
      await switchFamily(id);
    },
    onError: (e) => Alert.alert("建立失敗", e.message),
  });

  const joinM = trpc.family.join.useMutation({
    onSuccess: async (data) => {
      utils.family.list.invalidate();
      setShowJoinModal(false);
      setInviteCode("");
      const id = String((data as any).family?.id);
      if (id) await switchFamily(id);
    },
    onError: (e) => Alert.alert("加入失敗", e.message),
  });

  const leaveM = trpc.family.leave.useMutation({
    onSuccess: () => {
      utils.family.list.invalidate();
      if (activeFamilyId && families.length > 0) {
        const next = families.find((f: any) => String(f.id) !== activeFamilyId);
        if (next) switchFamily(String(next.id));
      }
    },
    onError: (e) => Alert.alert("離開失敗", e.message),
  });

  const selectedFamily = selectedFamilyId
    ? families.find((f: any) => String(f.id) === selectedFamilyId)
    : activeFamily;

  const handleShareInvite = async () => {
    if (!(selectedFamily as any)?.inviteCode) return;
    try {
      await Share.share({
        message: `加入我的家庭廚房「${(selectedFamily as any).name}」！\n\n邀請碼：${(selectedFamily as any).inviteCode}\n\n下載 Kindcipe App 後，點選「加入家庭」並輸入邀請碼。`,
        title: "邀請加入家庭廚房",
      });
    } catch {
      Alert.alert("分享失敗");
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    setInviteCode(data);
    joinM.mutate({ inviteCode: data });
  };

  const handleSwitchAndNavigate = async (id: string) => {
    await switchFamily(id);
    router.push("/kitchen-settings");
  };

  const currentRole = (() => {
    if (!selectedFamilyId) return familyRole;
    const f = families.find((ff: any) => String(ff.id) === selectedFamilyId);
    return (f as any)?.role ?? null;
  })();
  const isOwner = currentRole === "owner";

  return (
    <>
      <Stack.Screen options={{ title: "家庭管理" }} />
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Header actions */}
        <View style={s.headerActions}>
          <TouchableOpacity style={s.headerBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle-outline" size={18} color={BRAND} />
            <Text style={s.headerBtnText}>建立</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => setShowJoinModal(true)}>
            <Ionicons name="qr-code-outline" size={18} color={BRAND} />
            <Text style={s.headerBtnText}>加入</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={families}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="home-outline" size={56} color="#ccc" />
              <Text style={s.emptyTitle}>尚未加入任何廚房</Text>
              <Text style={s.emptySub}>建立一個廚房或輸入邀請碼加入</Text>
              <TouchableOpacity style={s.createBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={s.createBtnText}>建立廚房</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.joinBtn} onPress={() => setShowJoinModal(true)}>
                <Text style={s.joinBtnText}>加入廚房</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const isActive = String(item.id) === String(selectedFamilyId ?? activeFamilyId);
            const isExpanded = expandedId === String(item.id);
            const role = ROLE_LABEL[item.role] ?? item.role;

            return (
              <TouchableOpacity
                style={[s.familyCard, isActive && s.familyCardActive]}
                onPress={() => {
                  setSelectedFamilyId(String(item.id));
                  setExpandedId(isExpanded ? null : String(item.id));
                }}
                activeOpacity={0.8}
              >
                <View style={s.familyHeader}>
                  <View style={s.familyIcon}>
                    <Ionicons name="home-outline" size={22} color={isActive ? "#fff" : BRAND} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.familyName, isActive && s.familyNameActive]}>
                      {item.name}
                    </Text>
                    <Text style={s.familyMeta}>
                      {role} · {item.memberCount ?? 0} 位成員
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={BRAND} />
                  )}
                </View>

                {isExpanded && (
                  <View style={s.familyBody}>
                    <View style={s.divider} />

                    <TouchableOpacity
                      style={s.actionRow}
                      onPress={() => handleSwitchAndNavigate(String(item.id))}
                    >
                      <Ionicons name="settings-outline" size={18} color={BRAND} />
                      <Text style={s.actionText}>管理此廚房</Text>
                      <Ionicons name="chevron-forward" size={16} color={SUB} />
                    </TouchableOpacity>

                    {isOwner && (
                      <TouchableOpacity
                        style={s.actionRow}
                        onPress={() => {
                          setSelectedFamilyId(String(item.id));
                          handleShareInvite();
                        }}
                      >
                        <Ionicons name="share-outline" size={18} color={BRAND} />
                        <Text style={s.actionText}>分享邀請碼</Text>
                        <Ionicons name="chevron-forward" size={16} color={SUB} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />

        {/* Create modal */}
        <Modal visible={showCreateModal} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContainer}>
              <Text style={s.modalTitle}>建立廚房</Text>
              <TextInput
                style={s.modalInput}
                placeholder="輸入廚房名稱"
                placeholderTextColor="#999"
                value={familyName}
                onChangeText={setFamilyName}
                autoFocus
              />
              <View style={s.modalActions}>
                <TouchableOpacity
                  style={[s.primaryBtn, !familyName.trim() && { opacity: 0.5 }]}
                  onPress={() => createM.mutate({ name: familyName.trim() })}
                  disabled={!familyName.trim() || createM.isPending}
                >
                  {createM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>建立</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Text style={{ color: "#999", fontSize: 14 }}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Join modal */}
        <Modal visible={showJoinModal} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContainer}>
              <Text style={s.modalTitle}>加入廚房</Text>
              <TextInput
                style={s.modalInput}
                placeholder="輸入邀請碼"
                placeholderTextColor="#999"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoFocus
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={s.scanQrButton}
                onPress={async () => {
                  if (!cameraPermission?.granted) {
                    const perm = await requestCameraPermission();
                    if (!perm.granted) {
                      Alert.alert("需要相機權限", "請在設定中允許 Kindcipe 使用相機");
                      return;
                    }
                  }
                  scannedRef.current = false;
                  setShowJoinModal(false);
                  setShowScanner(true);
                }}
              >
                <Ionicons name="camera-outline" size={18} color={BRAND} />
                <Text style={s.scanQrButtonText}>掃描 QR Code</Text>
              </TouchableOpacity>
              <View style={s.modalActions}>
                <TouchableOpacity
                  style={[s.primaryBtn, !inviteCode.trim() && { opacity: 0.5 }]}
                  onPress={() => joinM.mutate({ inviteCode: inviteCode.trim() })}
                  disabled={!inviteCode.trim() || joinM.isPending}
                >
                  {joinM.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>加入</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                  <Text style={{ color: "#999", fontSize: 14 }}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Scanner */}
        {showScanner && (
          <Modal visible={showScanner} animationType="slide">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={handleBarCodeScanned}
            >
              <View style={s.scannerOverlay}>
                <View style={s.scannerFrame} />
                <Text style={s.scannerText}>將 QR Code 放入框內掃描</Text>
                <TouchableOpacity
                  style={s.scannerCloseButton}
                  onPress={() => { setShowScanner(false); scannedRef.current = false; }}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </CameraView>
          </Modal>
        )}
      </View>
    </>
  );
}

const SUB = "#9CA3AF";

const s = StyleSheet.create({
  headerActions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#E8E8E8",
  },
  headerBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1.5, borderColor: BRAND,
  },
  headerBtnText: { fontSize: 13, fontWeight: "700", color: BRAND },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: BRAND, marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: SUB, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  createBtn: {
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, marginBottom: 10,
    minWidth: 200, alignItems: "center",
  },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  joinBtn: {
    borderWidth: 2, borderColor: BRAND, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32,
    minWidth: 200, alignItems: "center",
  },
  joinBtnText: { fontSize: 16, fontWeight: "700", color: BRAND },

  familyCard: {
    backgroundColor: "#fff", borderRadius: 16,
    padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: "#EBEBEB",
  },
  familyCardActive: { borderColor: BRAND, borderWidth: 2 },
  familyHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  familyIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center",
  },
  familyName: { fontSize: 16, fontWeight: "800", color: "#1A1A1A" },
  familyNameActive: { color: BRAND },
  familyMeta: { fontSize: 12, color: SUB, marginTop: 2 },
  familyBody: { marginTop: 12 },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginBottom: 10 },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10,
  },
  actionText: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "600" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    width: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    color: "#1A1A1A", marginBottom: 20,
  },
  modalActions: { gap: 12, alignItems: "center" },
  primaryBtn: {
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, alignItems: "center",
    minWidth: 200,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  scanQrButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, marginBottom: 12,
    borderWidth: 1.5, borderColor: BRAND, borderRadius: 10,
    borderStyle: "dashed",
  },
  scanQrButtonText: { fontSize: 14, fontWeight: "700", color: BRAND },

  scannerOverlay: {
    flex: 1, alignItems: "center", justifyContent: "center",
  },
  scannerFrame: {
    width: 240, height: 240,
    borderWidth: 2, borderColor: "#fff",
    borderRadius: 16, backgroundColor: "transparent",
  },
  scannerText: {
    color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 24,
  },
  scannerCloseButton: {
    position: "absolute", top: 60, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
});
