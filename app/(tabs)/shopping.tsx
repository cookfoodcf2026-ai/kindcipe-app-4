import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import UnitPicker from "@/src/components/UnitPicker";
import { scheduleShoppingNotification, requestNotificationPermission } from "@/lib/notifications";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "待採購", color: "#013E77", bg: "#E8F0FE" },
  pending: { label: "待確認", color: "#CA8A04", bg: "#FEF9C3" },
  bought: { label: "已購買", color: "#16A34A", bg: "#DCFCE7" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  "蔬菜": "🥬",
  "水果": "🍎",
  "肉類": "🥩",
  "海鮮": "🐟",
  "蛋奶": "🥚",
  "調味料": "🧂",
  "乾貨": "🥜",
  "主食": "🍚",
  "飲品": "🧃",
  "日用品": "",
  "其他": "",
};

const DEFAULT_CATEGORIES = [
  "全部", "蔬菜", "肉類", "海鮮", "蛋奶",
  "調味料", "乾貨", "主食", "飲品", "日用品", "其他",
];

const formatTimeAgo = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "剛剛";
  if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-HK");
};

export default function ShoppingTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBought, setShowBought] = useState(false);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("其他");

  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.shopping.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 15,
  });

  const addItemM = trpc.shopping.add.useMutation({
    onSuccess: (_data, variables) => {
      utils.shopping.list.invalidate();
      setShowAddModal(false);
      setNewName("");
      setNewQty("");
      setNewUnit("");
      setNewCategory("其他");
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleShoppingNotification(variables.name);
      });
    },
    onError: (e) => Alert.alert("新增失敗", e.message),
  });

  const toggleBoughtM = trpc.shopping.toggleBought.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("操作失敗", e.message),
  });

  const deleteItemM = trpc.shopping.delete.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("刪除失敗", e.message),
  });

  const clearBoughtM = trpc.shopping.clearBought.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("清除失敗", e.message),
  });

  // BUG#4 FIX: approve/reject mutations for pending items
  const approveItemM = trpc.shopping.approve.useMutation({
    onSuccess: (_data, variables) => {
      utils.shopping.list.invalidate();
      requestNotificationPermission().then((ok) => {
        if (ok) scheduleShoppingNotification(variables.itemName || "食材");
      });
    },
    onError: (e) => Alert.alert("確認失敗", e.message),
  });
  const rejectItemM = trpc.shopping.reject.useMutation({
    onSuccess: () => utils.shopping.list.invalidate(),
    onError: (e) => Alert.alert("拒絕失敗", e.message),
  });

  const { familyRole } = useAuth();
  const isAdmin = familyRole === "owner" || familyRole === "admin";

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q),
      );
    }
    if (activeCategory !== "全部") {
      list = list.filter((i) => (i.category || "其他") === activeCategory);
    }
    return list;
  }, [items, searchQuery, activeCategory]);

  const activeItems = useMemo(
    () => filteredItems.filter((i) => i.status !== "bought"),
    [filteredItems],
  );
  const boughtItems = useMemo(
    () => filteredItems.filter((i) => i.status === "bought"),
    [filteredItems],
  );

  // Group active items by category → ingredient name
  const groupedActive = useMemo(() => {
    const groups: Record<string, { name: string; items: any[] }[]> = {};
    activeItems.forEach((item: any) => {
      const cat = item.category || "其他";
      if (!groups[cat]) groups[cat] = [];
      let ingGroup = groups[cat].find((g) => g.name === item.name);
      if (!ingGroup) {
        ingGroup = { name: item.name, items: [] };
        groups[cat].push(ingGroup);
      }
      ingGroup.items.push(item);
    });
    return groups;
  }, [activeItems]);

  // Flatten into list items for rendering
  const groupedList = useMemo(() => {
    const list: any[] = [];
    const categoryOrder = ["蔬菜", "肉類", "海鮮", "蛋奶", "主食", "調味料", "乾貨", "飲品", "日用品", "其他"];
    Object.entries(groupedActive)
      .sort((a, b) => {
        const ai = categoryOrder.indexOf(a[0]);
        const bi = categoryOrder.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .forEach(([cat, ingGroups]) => {
        list.push({ _type: "catHeader" as const, label: cat });
        ingGroups.forEach((g) => {
          list.push({ _type: "ingGroup" as const, name: g.name, items: g.items });
        });
      });
    return list;
  }, [groupedActive]);

  const handleAdd = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    addItemM.mutate({
      name,
      quantity: newQty.trim() || undefined,
      unit: newUnit.trim() || undefined,
      category: newCategory === "其他" ? undefined : newCategory,
    });
  }, [newName, newQty, newUnit, newCategory, addItemM]);

  const handleToggle = useCallback(
    (item: any) => {
      toggleBoughtM.mutate({
        id: item.id,
        bought: item.status !== "bought",
      });
    },
    [toggleBoughtM],
  );

  const handleDelete = useCallback(
    (item: any) => {
      Alert.alert("刪除項目", `確定要刪除「${item.name}」？`, [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => deleteItemM.mutate({ id: item.id }),
        },
      ]);
    },
    [deleteItemM],
  );

  const handleClearBought = useCallback(() => {
    const count = boughtItems.length;
    if (count === 0) return;
    Alert.alert("清除已購買", `確定要清除 ${count} 項已購買的食材？`, [
      { text: "取消", style: "cancel" },
      {
        text: "清除",
        style: "destructive",
        onPress: () => clearBoughtM.mutate(),
      },
    ]);
  }, [boughtItems, clearBoughtM]);

  const renderItem = (item: any) => {
    const sConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
    const isBought = item.status === "bought";
    const isPending = item.status === "pending";
    const isProcessing = toggleBoughtM.isPending || deleteItemM.isPending;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemCard, isBought && styles.itemCardBought, isPending && styles.itemCardPending]}
        onPress={() => !isPending && handleToggle(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
        disabled={isProcessing}
      >
        <View style={styles.itemCheckCol}>
          <View style={[styles.checkbox, isBought && styles.checkboxChecked]}>
            {isBought && <Ionicons name="checkmark-outline" size={16} color="#013E77" />}
            {isPending && <Ionicons name="time-outline" size={14} color="#CA8A04" />}
          </View>
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, isBought && styles.itemNameBought]}>
            {item.name}
          </Text>
          <View style={styles.itemMeta}>
            {(item.quantity || item.unit) && (
              <Text style={styles.itemQty}>{item.quantity || ""}{item.unit || ""}</Text>
            )}
            {item.category && (
              <View style={styles.itemCategoryTag}>
                <Text style={styles.itemCategoryText}>{CATEGORY_EMOJI[item.category || ""] || ""} {item.category}</Text>
              </View>
            )}
            {item.fromRecipeName && (
              <Text style={styles.itemSource}>← {item.fromRecipeName}</Text>
            )}
            {item.proposedByName && !item.boughtByName && (
              <Text style={styles.itemProposer}>由 {item.proposedByName}</Text>
            )}
          </View>

          {isPending && isAdmin && (
            <View style={styles.approveRow}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approveItemM.mutate({ id: item.id })}
                disabled={approveItemM.isPending}
              >
                <Ionicons name="checkmark-outline" size={16} color="#013E77" />
                <Text style={styles.approveBtnTxt}>確認採購</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => rejectItemM.mutate({ id: item.id })}
                disabled={rejectItemM.isPending}
              >
                <Ionicons name="close-outline" size={16} color="#EF4444" />
                <Text style={styles.rejectBtnTxt}>拒絕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.itemRight}>
          {isPending && !isAdmin && (
            <View style={[styles.statusPill, { backgroundColor: sConfig.bg }]}>
              <Text style={[styles.statusPillText, { color: sConfig.color }]}>{sConfig.label}</Text>
            </View>
          )}
          {isBought && item.boughtByName && (
            <Text style={styles.boughtBy}>
              {item.boughtByName}{"\n"}
              {item.boughtAt ? formatTimeAgo(item.boughtAt) : "剛剛"}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render a flat list of bought items (no grouping for bought)
  const renderFlatItems = (item: any) => {
    if (item._type === "section") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{item.label}</Text>
          <Text style={styles.sectionCount}>{item.count} 項</Text>
          {item.label === "已購買" && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearBought}>
              <Text style={styles.clearBtnText}>清除全部</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return renderItem(item);
  };

  // Render grouped active items
  const renderGrouped = (item: any) => {
    if (item._type === "catHeader") {
      return (
        <View style={styles.catHeader}>
          <Text style={styles.catHeaderText}>{CATEGORY_EMOJI[item.label] || ""} {item.label}</Text>
        </View>
      );
    }
    if (item._type === "ingGroup") {
      return (
        <View style={styles.ingGroup}>
          {item.items.map((sub: any, idx: number) => {
            const isPending = sub.status === "pending";
            const isBought = sub.status === "bought";
            const isProcessing = toggleBoughtM.isPending || deleteItemM.isPending;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.ingRow, idx === 0 && styles.ingRowFirst]}
                onPress={() => !isPending && handleToggle(sub)}
                onLongPress={() => handleDelete(sub)}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <View style={styles.ingCheckCol}>
                  <View style={[styles.checkbox, isBought && styles.checkboxChecked]}>
                    {isBought && <Ionicons name="checkmark-outline" size={14} color="#013E77" />}
                    {isPending && <Ionicons name="time-outline" size={12} color="#CA8A04" />}
                  </View>
                </View>
                  <View style={styles.ingContent}>
                  {idx === 0 && <Text style={styles.ingName}>{item.name}</Text>}
                  <View style={styles.ingMetaRow}>
                    {(sub.quantity || sub.unit) && (
                      <Text style={styles.ingQty}>{sub.quantity || ""}{sub.unit || ""}</Text>
                    )}
                    {sub.fromRecipeName && (
                      <Text style={styles.ingSource}>← {sub.fromRecipeName}</Text>
                    )}
                    {isBought && sub.boughtByName && (
                      <Text style={styles.ingBoughtBy}>{sub.boughtByName} · {sub.boughtAt ? formatTimeAgo(sub.boughtAt) : "剛剛"}</Text>
                    )}
                    {isPending && !isAdmin && (
                      <Text style={styles.ingPending}>待確認</Text>
                    )}
                  </View>
                  {isPending && isAdmin && (
                    <View style={styles.ingApproveRow}>
                      <TouchableOpacity
                        style={styles.ingApproveBtn}
                        onPress={() => approveItemM.mutate({ id: sub.id })}
                      >
                        <Ionicons name="checkmark-outline" size={13} color="#013E77" />
                        <Text style={styles.ingApproveTxt}>確認</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ingRejectBtn}
                        onPress={() => rejectItemM.mutate({ id: sub.id })}
                      >
                        <Ionicons name="close-outline" size={13} color="#EF4444" />
                        <Text style={styles.ingRejectTxt}>拒絕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    return null;
  };

  const showGroupedView = !searchQuery && activeCategory === "全部";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>購物清單</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/markets")}
          >
            <Ionicons name="storefront-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.headerBtnText}>+ 新增</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋食材..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <Text style={{ color: "#999", fontSize: 14 }}>載入中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color="#ccc" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>購物清單是空的</Text>
          <Text style={styles.emptySubtitle}>點擊右上角新增食材</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(showGroupedView
              ? groupedList
              : activeItems),
            ...(showBought && boughtItems.length > 0
              ? [{ _type: "section" as const, label: "已購買", count: boughtItems.length }]
              : []),
            ...(showBought ? boughtItems : []),
          ]}
          keyExtractor={(item: any) => {
            if (item._type === "section") return `section_${item.label}`;
            if (item._type === "catHeader") return `cat_${item.label}`;
            if (item._type === "ingGroup") return `ing_${item.name}`;
            return `item_${item.id}`;
          }}
          renderItem={({ item }: { item: any }) => {
            if (item._type === "section") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>{item.label}</Text>
                  <Text style={styles.sectionCount}>{item.count} 項</Text>
                  {item.label === "已購買" && (
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClearBought}>
                      <Text style={styles.clearBtnText}>清除全部</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            if (showGroupedView) return renderGrouped(item);
            return renderItem(item);
          }}
          ListFooterComponent={
            boughtItems.length > 0 ? (
              <TouchableOpacity
                style={styles.toggleBoughtBtn}
                onPress={() => setShowBought(!showBought)}
              >
                <Text style={styles.toggleBoughtText}>
                  {showBought
                    ? "隱藏已購買"
                    : `顯示已購買 (${boughtItems.length})`}
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListHeaderComponent={
            <View style={styles.filterRow}>
              {DEFAULT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    activeCategory === cat && styles.filterChipActive,
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeCategory === cat && styles.filterChipTextActive,
                    ]}
                  >
                    {cat === "全部" ? "全部" : `${CATEGORY_EMOJI[cat] || ""} ${cat}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增食材</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>食材名稱 *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 雞蛋"
                placeholderTextColor="#bbb"
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />

              <View style={styles.qtyRow}>
                <View style={styles.qtyField}>
                  <Text style={styles.fieldLabel}>數量</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 2"
                    placeholderTextColor="#bbb"
                    value={newQty}
                    onChangeText={setNewQty}
                    keyboardType="default"
                  />
                </View>
                <View style={styles.qtyField}>
                  <Text style={styles.fieldLabel}>單位</Text>
                  <UnitPicker
                    value={newUnit}
                    onChange={setNewUnit}
                    style={{ width: "100%", height: 42 }}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>分類</Text>
              <View style={styles.categoryRow}>
                {["蔬菜", "肉類", "海鮮", "蛋奶", "調味料", "主食", "飲品", "日用品", "其他"].map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        newCategory === cat && styles.categoryChipActive,
                      ]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          newCategory === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {CATEGORY_EMOJI[cat] || ""} {cat}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, !newName.trim() && styles.submitBtnDisabled]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Text style={styles.submitBtnText}>加入購物清單</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#013E77",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  searchInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1A1A1A",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterChip: {
    backgroundColor: "#E8E8E8",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#013E77",
  },
  filterChipText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#013E77",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  sectionCount: {
    fontSize: 13,
    color: "#999",
    marginLeft: 8,
  },
  clearBtn: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardBought: {
    opacity: 0.6,
  },
  itemCardPending: {
    borderLeftWidth: 3,
    borderLeftColor: "#CA8A04",
    backgroundColor: "#FFFDF7",
  },
  approveRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  approveBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  rejectBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  itemCheckCol: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  checkmark: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  itemNameBought: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemQty: {
    fontSize: 12,
    color: "#666",
  },
  itemCategoryTag: {
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  itemCategoryText: {
    fontSize: 10,
    color: "#888",
  },
  itemProposer: {
    fontSize: 11,
    color: "#999",
  },
  itemSource: {
    fontSize: 11,
    color: "#013E77",
    fontWeight: "500",
  },
  itemRight: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  boughtBy: {
    fontSize: 10,
    color: "#16A34A",
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 14,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  toggleBoughtBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 32,
  },
  toggleBoughtText: {
    fontSize: 14,
    color: "#013E77",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalClose: {
    fontSize: 18,
    color: "#999",
    paddingHorizontal: 4,
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  qtyRow: {
    flexDirection: "row",
    gap: 12,
  },
  qtyField: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryChip: {
    backgroundColor: "#F0F0F0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: "#013E77",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#666",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  submitBtn: {
    backgroundColor: "#013E77",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },

  // Grouped shopping list styles
  catHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  catHeaderText: {
    fontSize: 15, fontWeight: "800", color: "#1A1A1A",
  },
  ingGroup: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#EBEBEB",
    overflow: "hidden",
  },
  ingRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 8,
  },
  ingRowFirst: {
    paddingTop: 10,
  },
  ingCheckCol: {
    paddingTop: 2,
  },
  ingContent: {
    flex: 1,
  },
  ingName: {
    fontSize: 14, fontWeight: "700", color: "#1A1A1A",
    marginBottom: 4,
  },
  ingMetaRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    flexWrap: "wrap",
  },
  ingQty: {
    fontSize: 12, fontWeight: "600", color: "#6B7280",
  },
  ingSource: {
    fontSize: 11, color: "#9CA3AF",
  },
  ingBoughtBy: {
    fontSize: 11, color: "#16A34A",
  },
  ingPending: {
    fontSize: 10, fontWeight: "700", color: "#CA8A04",
    backgroundColor: "#FEF9C3", paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4, overflow: "hidden",
  },
  ingApproveRow: {
    flexDirection: "row", gap: 6, marginTop: 4,
  },
  ingApproveBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 6, backgroundColor: "#E8F0FE",
  },
  ingApproveTxt: {
    fontSize: 11, fontWeight: "700", color: "#013E77",
  },
  ingRejectBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 6, backgroundColor: "#FEE2E2",
  },
  ingRejectTxt: {
    fontSize: 11, fontWeight: "700", color: "#EF4444",
  },
});
