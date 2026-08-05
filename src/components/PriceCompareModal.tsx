/**
 * 共用「各平台比價」Modal
 * 從食譜詳情頁 / 購物清單頁抽出，避免三處重複邏輯。
 * 資料來源：消委會「網上價格一覽通」(priceWatchRouter.search)
 */
import { useState, useEffect, useMemo, ReactNode } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Linking, TextInput, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import {
  cleanIngredientName,
  isFreshIngredient,
  filterPriceResults,
  SM_STYLE,
  REDIRECT_PLATFORMS,
  openPlatform,
} from "@/lib/price";

const BRAND = "#013E77";
const CARD = "#FFFFFF";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const GREEN = "#16A34A";

export interface PriceCompareFooterContext {
  keyword: string;
  cleanKeyword: string;
  results: any[];
  selectedResult: any;
  selectedResultIdx: number;
  lowestPrice: number | null;
}

interface Props {
  visible: boolean;
  keyword: string;
  onClose: () => void;
  showKeywordEditor?: boolean;
  staleTime?: number;
  renderFooter?: (ctx: PriceCompareFooterContext) => ReactNode;
}

export default function PriceCompareModal({
  visible,
  keyword,
  onClose,
  showKeywordEditor = true,
  staleTime = 1000 * 60 * 60 * 6,
  renderFooter,
}: Props) {
  const [editablePriceKw, setEditablePriceKw] = useState("");
  const [appliedKw, setAppliedKw] = useState(keyword);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllSupermarkets, setShowAllSupermarkets] = useState(false);

  useEffect(() => {
    if (visible) {
      setEditablePriceKw(keyword);
      setAppliedKw(keyword);
      setSelectedResultIdx(0);
      setShowAllResults(false);
      setShowAllSupermarkets(false);
    }
  }, [visible, keyword]);

  const cleanPriceKw = useMemo(() => cleanIngredientName(appliedKw), [appliedKw]);
  const isFreshIng = useMemo(() => isFreshIngredient(appliedKw), [appliedKw]);
  const priceQ = trpc.priceWatch.search.useQuery(
    { keyword: cleanPriceKw },
    { enabled: visible && !!cleanPriceKw && !isFreshIng, staleTime }
  );
  const priceResults = useMemo(() => filterPriceResults(priceQ.data ?? [], cleanPriceKw), [priceQ.data, cleanPriceKw]);

  // Auto-select cheapest product when results load
  useEffect(() => {
    if (!priceResults || priceResults.length === 0) return;
    let cheapestIdx = 0;
    let cheapestPrice = Infinity;
    priceResults.forEach((item: any, idx: number) => {
      const validPrices = (item.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => !isNaN(v) && v > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : Infinity;
      if (minPrice < cheapestPrice) { cheapestPrice = minPrice; cheapestIdx = idx; }
    });
    setSelectedResultIdx(cheapestIdx);
  }, [priceResults]);

  const handleClose = () => {
    setEditablePriceKw("");
    setSelectedResultIdx(0);
    setShowAllResults(false);
    setShowAllSupermarkets(false);
    onClose();
  };

  const selectedResult = priceResults[selectedResultIdx] ?? priceResults[0];
  const sortedPrices = [...(selectedResult?.prices ?? [])]
    .filter((p: any) => !isNaN(Number(p.price)) && Number(p.price) > 0)
    .sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const lowestPrice = sortedPrices[0] ? Number(sortedPrices[0].price) : null;
  const top3 = sortedPrices.slice(0, 3);
  const hasMore = sortedPrices.length > 3;
  const summaryCheapest = sortedPrices[0];

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={[s.sheet, { maxHeight: "88%" }]}>
          <View style={s.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>各平台比價</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: BRAND, marginTop: 2 }}>{keyword}</Text>
                {cleanPriceKw !== keyword && (
                  <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>搜尋關鍵字：「{cleanPriceKw}」</Text>
                )}
              </View>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>

            {/* Editable keyword */}
            {showKeywordEditor && (
              <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
                <Text style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>編輯搜尋關鍵字</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: TEXT, borderWidth: 1, borderColor: "#E8E8E8" }}
                    placeholder="例如：雞湯 罐頭"
                    placeholderTextColor={SUB}
                    value={editablePriceKw}
                    onChangeText={setEditablePriceKw}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" }}
                    onPress={() => {
                      const kw = editablePriceKw.trim();
                      if (kw) { setAppliedKw(kw); setSelectedResultIdx(0); setShowAllResults(false); setShowAllSupermarkets(false); }
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>搜尋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Fresh ingredient notice */}
            {isFreshIng && (
              <View style={s.priceNotice}>
                <Ionicons name="leaf-outline" size={13} color={GREEN} />
                <Text style={s.priceNoticeTxt}>新鮮食材建議到街市或超市比價，消委會格價未涵蓋此類商品</Text>
              </View>
            )}

            {/* Loading */}
            {!isFreshIng && priceQ.isLoading && (
              <View style={s.priceNotice}>
                <ActivityIndicator size="small" color={BRAND} />
                <Text style={{ fontSize: 12, color: BRAND }}>正在查詢消委會格價資料…</Text>
              </View>
            )}

            {/* Error */}
            {!isFreshIng && priceQ.isError && (
              <View style={[s.priceNotice, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={{ fontSize: 12, color: "#DC2626", flex: 1 }}>無法載入消委會格價資料</Text>
                <TouchableOpacity onPress={() => priceQ.refetch()}>
                  <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "700" }}>重試</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* No results */}
            {!isFreshIng && !priceQ.isLoading && !priceQ.isError && priceResults.length === 0 && (
              <View style={[s.priceNotice, { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }]}>
                <Text style={{ fontSize: 12, color: SUB }}>消委會格價中未找到「{cleanPriceKw}」，可直接前往各平台搜尋</Text>
              </View>
            )}

            {/* Consumer Council data */}
            {!isFreshIng && priceResults.length > 0 && (
              <>
                {/* Summary card */}
                {summaryCheapest && lowestPrice !== null && (
                  <View style={{ marginHorizontal: 20, marginBottom: 14, backgroundColor: "#F0FDF4", borderRadius: 14, borderWidth: 1, borderColor: "#86EFAC", padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 22 }}>🏆</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: "#16A34A", fontWeight: "800" }}>最抵格價</Text>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }} numberOfLines={1}>{summaryCheapest.supermarketName}</Text>
                      </View>
                      <Text style={{ fontSize: 24, fontWeight: "900", color: "#16A34A" }}>HK${lowestPrice.toFixed(1)}</Text>
                    </View>
                    {sortedPrices[1] && (
                      <Text style={{ fontSize: 11, color: SUB, marginTop: 6 }}>
                        較第二平慳 HK${(Number(sortedPrices[1].price) - lowestPrice).toFixed(1)}
                      </Text>
                    )}
                  </View>
                )}

                {/* CC data badge */}
                <View style={s.ccBadge}>
                  <Text style={s.ccBadgeTxt}>消委會數據 · 今日更新</Text>
                </View>

                {/* Product selector — multiple results */}
                {priceResults.length > 1 && (
                  <View style={{ marginBottom: 10 }}>
                    <TouchableOpacity style={s.productSelector} onPress={() => setShowAllResults(v => !v)}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: SUB }}>產品規格</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }} numberOfLines={1}>
                          {selectedResult?.brand ? `${selectedResult.brand} ` : ""}{selectedResult?.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {lowestPrice !== null && (
                          <Text style={{ fontSize: 11, fontWeight: "700", color: BRAND }}>
                            最低 HK${lowestPrice.toFixed(1)}
                          </Text>
                        )}
                        <Ionicons name={showAllResults ? "chevron-up" : "chevron-down"} size={14} color={BRAND} />
                      </View>
                    </TouchableOpacity>

                    {showAllResults && (
                      <View style={s.productList}>
                        {priceResults.map((r: any, idx: number) => {
                          const rPrices = (r.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => v > 0);
                          const rMin = rPrices.length > 0 ? Math.min(...rPrices) : null;
                          const allMins = priceResults.map((item: any) => {
                            const ps = (item.prices ?? []).map((p: any) => Number(p.price)).filter((v: number) => v > 0);
                            return ps.length > 0 ? Math.min(...ps) : Infinity;
                          });
                          const globalMin = Math.min(...allMins);
                          const isCheapest = rMin !== null && rMin === globalMin;
                          const isSelected = idx === selectedResultIdx;
                          return (
                            <TouchableOpacity
                              key={r.code ?? idx}
                              style={[s.productItem, isSelected && s.productItemSelected]}
                              onPress={() => { setSelectedResultIdx(idx); setShowAllResults(false); }}
                            >
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: 12, fontWeight: isSelected ? "800" : "600", color: TEXT }} numberOfLines={1}>
                                  {r.brand ? `${r.brand} ` : ""}{r.name}
                                </Text>
                                {r.category && <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{r.category}</Text>}
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                {isCheapest && (
                                  <View style={{ backgroundColor: "#DCFCE7", borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontSize: 9, fontWeight: "700", color: "#15803D" }}>最便宜</Text>
                                  </View>
                                )}
                                {rMin !== null && (
                                  <Text style={{ fontSize: 13, fontWeight: "800", color: isCheapest ? "#15803D" : TEXT }}>
                                    HK${rMin.toFixed(1)}起
                                  </Text>
                                )}
                                {isSelected && <Ionicons name="checkmark-outline" size={10} color={BRAND} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Single product name */}
                {priceResults.length === 1 && selectedResult && (
                  <View style={s.singleProduct}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }}>{selectedResult.name}</Text>
                    {selectedResult.brand && <Text style={{ fontSize: 11, color: SUB, marginLeft: 6 }}>{selectedResult.brand}</Text>}
                  </View>
                )}

                {/* Supermarket prices - top 3 */}
                {top3.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 8, marginHorizontal: 20 }}>超市格價</Text>
                    {top3.map((p: any, idx: number) => {
                      const st = SM_STYLE[p.supermarketCode] ?? { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", logo: "?" };
                      const isLowest = idx === 0;
                      return (
                        <View key={p.supermarketCode} style={[s.smPriceRow, { backgroundColor: st.bg, borderColor: isLowest ? "#22C55E" : st.border, marginBottom: 8 }]}>
                          {isLowest && (
                            <View style={s.lowestBadge}>
                              <Ionicons name="checkmark-outline" size={10} color="#fff" />
                              <Text style={s.lowestBadgeTxt}>最低格價</Text>
                            </View>
                          )}
                          <View style={[s.smLogo, { backgroundColor: "#fff" }]}>
                            <Text style={{ fontSize: 18, fontWeight: "800", color: st.color }}>{st.logo}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>{p.supermarketName}</Text>
                            <Text style={{ fontSize: 10, color: SUB }}>{p.supermarketCode}</Text>
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: "900", color: isLowest ? "#15803D" : TEXT }}>HK${Number(p.price).toFixed(1)}</Text>
                        </View>
                      );
                    })}
                    {hasMore && (
                      <TouchableOpacity onPress={() => setShowAllSupermarkets(v => !v)} style={{ marginHorizontal: 20, marginTop: 6, paddingVertical: 6 }}>
                        <Text style={{ fontSize: 12, color: BRAND, fontWeight: "700", textAlign: "center" }}>
                          {showAllSupermarkets ? "收起" : `顯示全部 ${sortedPrices.length} 間超市`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showAllSupermarkets && sortedPrices.slice(3).map((p: any, idx: number) => {
                      const st = SM_STYLE[p.supermarketCode] ?? { color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", logo: "?" };
                      return (
                        <View key={p.supermarketCode} style={[s.smPriceRow, { backgroundColor: st.bg, borderColor: st.border, marginBottom: 8 }]}>
                          <View style={[s.smLogo, { backgroundColor: "#fff" }]}>
                            <Text style={{ fontSize: 18, fontWeight: "800", color: st.color }}>{st.logo}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>{p.supermarketName}</Text>
                            <Text style={{ fontSize: 10, color: SUB }}>{p.supermarketCode}</Text>
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: "900", color: TEXT }}>HK${Number(p.price).toFixed(1)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Special offers */}
            {!isFreshIng && selectedResult?.offers && selectedResult.offers.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 6 }}>特別優惠</Text>
                {selectedResult.offers.map((o: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Ionicons name="pricetag-outline" size={12} color="#92400E" />
                    <Text style={{ fontSize: 11, color: "#92400E", flex: 1 }}>{o.supermarketName}：{o.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Page-specific footer (e.g. record price to shopping list) */}
            {renderFooter && (
              <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
                {renderFooter({
                  keyword,
                  cleanKeyword: cleanPriceKw,
                  results: priceResults,
                  selectedResult,
                  selectedResultIdx,
                  lowestPrice,
                })}
              </View>
            )}

            {/* Platform redirect buttons - horizontal scroll */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: SUB, marginBottom: 8, marginHorizontal: 20 }}>
                {priceResults.length > 0 ? "其他平台搜尋" : "直接前往平台搜尋"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {REDIRECT_PLATFORMS.map(p => (
                  <TouchableOpacity
                    key={p.name}
                    style={[{ width: 100, alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 10, paddingBottom: 12, backgroundColor: p.bg, borderColor: p.border }]}
                    onPress={() => openPlatform(p, cleanPriceKw)}
                  >
                    <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 22 }}>{p.logo}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: TEXT, marginTop: 6 }} numberOfLines={1}>{p.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>搜尋</Text>
                      <Ionicons name="open-outline" size={11} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Consumer Council website link */}
            <TouchableOpacity style={s.ccLink} onPress={() => Linking.openURL(`https://online-price-watch.consumer.org.hk/opw/?keyword=${encodeURIComponent(cleanPriceKw)}`)}>
              <View style={s.ccLinkIcon}>
                <Ionicons name="business-outline" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: BRAND }}>消委會格價網查詢</Text>
                <Text style={{ fontSize: 10, color: SUB, marginTop: 1 }}>Consumer Council · 網上價格一覽通</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={BRAND} />
            </TouchableOpacity>

            {/* Disclaimer */}
            <View style={s.disclaimer}>
              <Text style={s.disclaimerTxt}>
                {priceResults.length > 0
                  ? "格價來自消委會「網上價格一覽通」，每日更新。實際售價以各平台為準。"
                  : "消委會格價涵蓋惠康、百佳等超市，不包括 HKTVmall、pandamart 及街市鮮貨。"}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E0D8", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: TEXT },
  priceNotice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#FFF7ED", borderWidth: 1.5, borderColor: "#FED7AA", marginBottom: 12 },
  priceNoticeTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: "#92400E" },
  ccBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, backgroundColor: "#EEF4FB", borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 10 },
  ccBadgeTxt: { fontSize: 10, color: BRAND, fontWeight: "700" },
  productSelector: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: CARD, borderWidth: 1.5, borderColor: "#BFDBFE" },
  productList: { borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, overflow: "hidden", marginTop: 4 },
  productItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  productItemSelected: { backgroundColor: "#DBEAFE" },
  singleProduct: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  smPriceRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, position: "relative" },
  lowestBadge: { position: "absolute", top: -8, right: 10, backgroundColor: "#22C55E", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 2 },
  lowestBadgeTxt: { fontSize: 9, fontWeight: "700", color: "#fff" },
  smLogo: { width: 38, height: 38, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  ccLink: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: CARD, borderWidth: 1.5, borderColor: BRAND, marginBottom: 10 },
  ccLinkIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  disclaimer: { padding: 10, borderRadius: 12, backgroundColor: "#EEF4FB", marginBottom: 8 },
  disclaimerTxt: { fontSize: 10, color: SUB, lineHeight: 15 },
});
