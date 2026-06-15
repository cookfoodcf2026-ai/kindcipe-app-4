/**
 * 家庭管理頁面 — QR Code 分享、家庭成員管理
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share
} from "react-native";
import { useState } from "react";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

export default function FamilyScreen() {
  const [showQR, setShowQR] = useState(false);

  const familyQuery = trpc.getFamily.useQuery();
  const membersQuery = trpc.getFamilyMembers.useQuery();

  const family = familyQuery.data;
  const members = membersQuery.data || [];

  const handleShareInvite = async () => {
    if (!family?.inviteCode) return;
    try {
      await Share.share({
        message: `加入我的家庭廚房「${family.name}」！\n\n邀請碼：${family.inviteCode}\n\n下載 和諧食譜 Kindcipe App 後，點選「加入家庭」並輸入邀請碼。`,
        title: "邀請加入家庭廚房",
      });
    } catch (e) {
      Alert.alert("分享失敗");
    }
  };

  const removeMemberMutation = trpc.removeFamilyMember.useMutation({
    onSuccess: () => membersQuery.refetch(),
    onError: (err) => Alert.alert("移除失敗", err.message),
  });

  return (
    <>
      <Stack.Screen options={{ title: "家庭管理" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 家庭資訊卡 */}
        {familyQuery.isLoading ? (
          <ActivityIndicator color="#013E77" style={{ marginTop: 40 }} />
        ) : family ? (
          <View style={styles.familyCard}>
            <View style={styles.familyIconWrapper}>
              <Ionicons name="home" size={32} color="#013E77" />
            </View>
            <Text style={styles.familyName}>{family.name}</Text>
            <Text style={styles.familyMeta}>{members.length} 位成員</Text>
          </View>
        ) : (
          <View style={styles.noFamilyCard}>
            <Ionicons name="home-outline" size={48} color="#9CA3AF" />
            <Text style={styles.noFamilyText}>尚未建立家庭廚房</Text>
          </View>
        )}

        {/* QR Code 分享區域 */}
        {family && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>邀請家人加入</Text>
            <View style={styles.inviteCard}>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeLabel}>邀請碼</Text>
                <Text style={styles.inviteCode}>{family.inviteCode || "LOADING"}</Text>
              </View>
              <Text style={styles.inviteNote}>
                家人下載 Kindcipe App 後，輸入邀請碼即可加入你的家庭廚房，共享食譜和採購清單。
              </Text>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>分享邀請碼</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 家庭成員列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家庭成員</Text>
          {membersQuery.isLoading ? (
            <ActivityIndicator color="#013E77" />
          ) : members.length === 0 ? (
            <Text style={styles.noMembersText}>還沒有其他成員</Text>
          ) : (
            members.map((member: any) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.name ? member.name[0] : "?"}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>
                    {member.role === "housewife" ? "主婦" :
                     member.role === "helper" ? "工人" : "家庭成員"}
                  </Text>
                </View>
                <View style={[styles.onlineDot, { backgroundColor: member.isOnline ? "#22C55E" : "#D1D5DB" }]} />
              </View>
            ))
          )}
        </View>

        {/* 角色說明 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>角色說明</Text>
          <View style={styles.roleCard}>
            <View style={styles.roleItem}>
              <View style={[styles.roleIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="person" size={20} color="#013E77" />
              </View>
              <View style={styles.roleContent}>
                <Text style={styles.roleName}>主婦 / 主人</Text>
                <Text style={styles.roleDesc}>管理食譜、排餐計劃、採購清單，發送烹飪指令</Text>
              </View>
            </View>
            <View style={styles.roleItem}>
              <View style={[styles.roleIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="person-outline" size={20} color="#22C55E" />
              </View>
              <View style={styles.roleContent}>
                <Text style={styles.roleName}>工人 / 助手</Text>
                <Text style={styles.roleDesc}>查閱採購清單、按步驟烹飪、上傳採購照片</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FC" },
  familyCard: {
    margin: 16, backgroundColor: "#013E77", borderRadius: 20, padding: 24,
    alignItems: "center",
    shadowColor: "#013E77", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  familyIconWrapper: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  familyName: { fontSize: 20, fontWeight: "900", color: "#fff" },
  familyMeta: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  noFamilyCard: {
    margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 32,
    alignItems: "center",
  },
  noFamilyText: { fontSize: 14, color: "#6B7280", marginTop: 10 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A", marginBottom: 10 },
  inviteCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  inviteCodeBox: {
    backgroundColor: "#F5F8FC", borderRadius: 12, padding: 16,
    alignItems: "center", marginBottom: 12,
  },
  inviteCodeLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "600", marginBottom: 4 },
  inviteCode: { fontSize: 28, fontWeight: "900", color: "#013E77", letterSpacing: 4 },
  inviteNote: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 12 },
  shareButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#013E77", padding: 12, borderRadius: 10,
  },
  shareButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { fontSize: 18, fontWeight: "800", color: "#013E77" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  memberRole: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  noMembersText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 20 },
  roleCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  roleItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  roleIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  roleContent: { flex: 1 },
  roleName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  roleDesc: { fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 18 },
});
