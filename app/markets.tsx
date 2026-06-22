import { View, Text, StyleSheet, FlatList, TextInput } from "react-native";
import { useState, useMemo } from "react";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import marketsData from "@/data/markets.json";

const DISTRICT_EMOJI: Record<string, string> = {
  "中西區": "location-outline", "東區": "location-outline", "離島區": "location-outline", "南區": "location-outline",
  "灣仔區": "location-outline", "九龍城區": "location-outline", "觀塘區": "location-outline", "旺角區": "location-outline",
  "深水埗區": "location-outline", "黃大仙區": "location-outline", "油尖區": "location-outline",
  "葵青區": "location-outline", "北區": "location-outline", "西貢區": "location-outline", "沙田區": "location-outline",
  "大埔區": "location-outline", "荃灣區": "location-outline", "屯門區": "location-outline", "元朗區": "location-outline",
};

export default function MarketsPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return marketsData;
    const q = search.toLowerCase();
    return marketsData
      .map((district) => ({
        ...district,
        markets: district.markets.filter(
          (m: any) =>
            m.name.toLowerCase().includes(q) ||
            m.address.toLowerCase().includes(q),
        ),
      }))
      .filter((d: any) => d.markets.length > 0);
  }, [search]);

  const totalMarkets = useMemo(
    () => marketsData.reduce((sum: number, d: any) => sum + d.markets.length, 0),
    [],
  );

  return (
    <>
      <Stack.Screen options={{ title: "街市指南" }} />
      <View style={styles.container}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋街市名稱或地區..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <Text style={styles.countLabel}>
          {search ? `${filtered.length} 區` : `全港 ${totalMarkets} 個街市`}
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(d: any) => d.districtZh}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <Text style={styles.footer}>資料來源：食物環境衞生署</Text>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={styles.districtCard}>
              <View style={styles.districtHeader}>
                <Ionicons
                  name={(DISTRICT_EMOJI[item.districtZh] || "location-outline") as any}
                  size={16}
                  color="#013E77"
                />
                <Text style={styles.districtName}>{item.districtZh}</Text>
                <Text style={styles.districtCount}>{item.markets.length}</Text>
              </View>
              {item.markets.map((m: any, i: number) => (
                <View key={i} style={styles.marketItem}>
                  <Text style={styles.marketName}>{m.name}</Text>
                  <Text style={styles.marketAddress}>{m.address}</Text>
                </View>
              ))}
            </View>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  searchBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8E8E8" },
  searchInput: { backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#1A1A1A" },
  countLabel: { fontSize: 12, color: "#999", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  listContent: { paddingHorizontal: 12, paddingBottom: 32 },
  districtCard: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  districtHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },

  districtName: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  districtCount: { marginLeft: "auto", fontSize: 14, fontWeight: "700", color: "#013E77", backgroundColor: "#E8F0FE", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  marketItem: { marginBottom: 8, paddingLeft: 4 },
  marketName: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  marketAddress: { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 16 },
  footer: { fontSize: 11, color: "#bbb", textAlign: "center", paddingVertical: 16 },
});
