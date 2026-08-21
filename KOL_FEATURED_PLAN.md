# 📘 KOL 網紅食譜 + Featured 分級系統完整方案

**最後更新**：2026-08-18  
**狀態**：Plan 完成，準備執行  
**相關功能**：比價功能（現有）、Home Page、More Page、食譜列表

---

## 🎯 核心概念：3 級顯示系統

| Grade | 名稱 | 位置 | 目的 | 內容數量 | 更新頻率 | 商業價值 |
|---|---|---|---|---|---|---|
| **Grade 1** | **Featured（精選）** | Home Page 頂部（橫向 Scroll） | 策展/發現/變現 | 3-10 個 | 每週/手動 | ⭐⭐⭐⭐⭐（可賣廣告位） |
| **Grade 2** | **Category（分類）** | More Page 食譜入口（3 按鈕） | 瀏覽/導航 | 3 個入口 | 固定 | ⭐⭐⭐（導航清晰） |
| **Grade 3** | **Library（庫藏）** | 食譜列表頁（Filter 後） | 搜尋/管理 | 全部 | 動態 | ⭐（基礎功能） |

---

## 📊 用戶旅程圖

```
用戶打開 App
    ↓
┌─────────────────────────────────────┐
│ Grade 1: Home Page Featured         │
│ 「🔥 網紅精選」橫向 Scroll（3-5 個）   │  ← 黃金位置，最高曝光
└─────────────────────────────────────┘
    ↓
用戶撳「查看更多」or 落去 More Page
    ↓
┌─────────────────────────────────────┐
│ Grade 2: More Page 食譜入口          │
│ [官方食譜] [網紅食譜] [我的食譜]      │  ← 清晰分類，意圖導航
└─────────────────────────────────────┘
    ↓
用戶撳某個入口
    ↓
┌─────────────────────────────────────┐
│ Grade 3: 食譜列表頁（Filter 後）      │
│ 顯示該分類嘅全部食譜（可無限 Scroll）  │  ← 完整庫藏，可搜尋/篩選
└─────────────────────────────────────┘
```

---

## 📋 Phase 0：後端 Schema（技術預留位）

### T0.1 加 Featured 字段

**文件**：`kindcipe-backend/server/db/schema.ts`

```ts
// official_recipes 表加字段：
export const officialRecipes = mysqlTable("official_recipes", {
  // ... 現有字段
  featuredRank: int("featured_rank"),              // 1=最優先，null=唔顯示
  featuredCategory: varchar("featured_category", { length: 64 }),  // "home_hero" / "kol_spotlight" / "weekly_pick"
  featuredExpiry: date("featured_expiry"),         // 自動落架日期（可選）
  sourceType: mysqlEnum("sourceType", ["official", "kol", "user_import"]).default("official"),
  kolHandle: varchar("kol_handle", { length: 64 }),  // @daydaycook
  kolMerchantRecommendations: text("kol_merchant_recommendations"),  // JSON: [{ingredient, merchant, url, note}]
});

// customRecipes 表同樣加呢啲字段（如果 KOL 食譜要放 custom 表）
```

**Migration 腳本**：
```sql
-- 加字段
ALTER TABLE official_recipes 
  ADD COLUMN featured_rank INT DEFAULT NULL,
  ADD COLUMN featured_category VARCHAR(64) DEFAULT NULL,
  ADD COLUMN featured_expiry DATE DEFAULT NULL,
  ADD COLUMN source_type ENUM('official', 'kol', 'user_import') DEFAULT 'official',
  ADD COLUMN kol_handle VARCHAR(64) DEFAULT NULL,
  ADD COLUMN kol_merchant_recommendations TEXT DEFAULT NULL;

-- 舊食譜預設值
UPDATE official_recipes SET source_type = 'official' WHERE source_type IS NULL;
```

---

### T0.2 tRPC Endpoint（撈 Featured 食譜）

**文件**：`kindcipe-backend/server/routers/recipes.ts`

```ts
// 加呢個新 endpoint
getFeatured: publicProcedure
  .input(z.object({
    category: z.string().optional(),  // "home_hero" / "kol_spotlight" / "weekly_pick"
    limit: z.number().int().min(1).max(20).default(5),
  }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];

    const conditions: any[] = [
      eq(officialRecipes.isActive, true),
      isNotNull(officialRecipes.featuredRank),
    ];

    if (input.category) {
      conditions.push(eq(officialRecipes.featuredCategory, input.category));
    }

    // 可選：自動過濾過期
    conditions.push(or(
      isNull(officialRecipes.featuredExpiry),
      gte(officialRecipes.featuredExpiry, new Date())
    ));

    const rows = await db.select()
      .from(officialRecipes)
      .where(and(...conditions))
      .orderBy(asc(officialRecipes.featuredRank))
      .limit(input.limit);

    return rows.map((r) => ({
      ...r,
      ingredients: r.ingredients ? JSON.parse(r.ingredients) : [],
      steps: r.steps ? JSON.parse(r.steps) : [],
      tags: r.tags ? JSON.parse(r.tags) : [],
      source: r.sourceType || "official",
    }));
  }),
```

---

## 📋 Phase 1：Grade 1 - Home Page Featured（橫向 Scroll）

### T1.1 新建 FeaturedCarousel 組件

**文件**：`kindcipe-app-4/src/components/FeaturedCarousel.tsx`（新建）

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import type { Recipe } from "@/lib/router-types";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = SW - 32;
const CARD_HEIGHT = 200;

interface FeaturedCarouselProps {
  recipes: Recipe[];
  title?: string;
}

export default function FeaturedCarousel({ recipes, title = "🔥 網紅精選" }: FeaturedCarouselProps) {
  const router = useRouter();

  if (!recipes || recipes.length === 0) return null;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
        <TouchableOpacity onPress={() => router.push("/recipes?featured=1")}>
          <Text style={s.seeAll}>查看全部 →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
      >
        {recipes.map((recipe) => (
          <TouchableOpacity
            key={recipe.id}
            style={s.card}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
            activeOpacity={0.8}
          >
            <ExpoImage
              source={{ uri: recipe.thumbnailUrl || recipe.image }}
              style={s.image}
              contentFit="cover"
            />
            <View style={s.cardBody}>
              <Text style={s.name} numberOfLines={2}>{recipe.name}</Text>
              {recipe.sourceType === "kol" && recipe.kolHandle && (
                <View style={s.kolBadge}>
                  <Text style={s.kolBadgeText}>{recipe.kolHandle}</Text>
                </View>
              )}
              <View style={s.meta}>
                <Text style={s.metaItem}>⏱ {recipe.cookTime} 分鐘</Text>
                <Text style={s.metaItem}>🍽️ {recipe.servings} 人</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1C1E",
  },
  seeAll: {
    fontSize: 14,
    color: "#013E77",
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: CARD_HEIGHT,
  },
  cardBody: {
    padding: 12,
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  kolBadge: {
    backgroundColor: "#FFF3D6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  kolBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#013E77",
  },
  meta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 12,
    color: "#8E8E93",
  },
});
```

---

### T1.2 加到 Home Page

**文件**：`kindcipe-app-4/app/(tabs)/index.tsx`

```tsx
// 喺呢個文件加：
import FeaturedCarousel from "@/src/components/FeaturedCarousel";
import { trpc } from "@/lib/trpc";

// 喺主組件入面加：
export default function HomeTab() {
  // 撈 Featured 食譜（Grade 1）
  const { data: featuredRecipes = [] } = trpc.recipes.getFeatured.useQuery(
    { category: "home_hero", limit: 5 },
    { staleTime: 1000 * 60 * 5 }
  );

  return (
    <ScrollView style={s.root}>
      {/* Grade 1: Featured Carousel */}
      {featuredRecipes.length > 0 && (
        <FeaturedCarousel recipes={featuredRecipes} />
      )}

      {/* 現有內容（今晚菜單 + 購物清單 + 分類 Chips + 食譜列表） */}
      {/* ... */}
    </ScrollView>
  );
}
```

---

## 📋 Phase 2：Grade 2 - More Page 食譜入口

### T2.1 修改 More Page

**文件**：`kindcipe-app-4/app/(tabs)/more.tsx`

```tsx
// 喺 MENU_ITEMS 前面加呢個區段：
export default function MoreTab() {
  // ... 現有 code

  return (
    <ScrollView style={s.root}>
      {/* Grade 2: 食譜入口區段 */}
      <View style={s.recipeEntrySection}>
        <Text style={s.sectionTitle}>📖 食譜入口</Text>
        <View style={s.entryGrid}>
          <TouchableOpacity
            style={s.entryCard}
            onPress={() => router.push("/recipes?source=official")}
          >
            <View style={[s.entryIcon, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="restaurant-outline" size={24} color="#013E77" />
            </View>
            <Text style={s.entryLabel}>官方食譜</Text>
            <Text style={s.entrySub}>精選家常菜</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.entryCard}
            onPress={() => router.push("/recipes?source=kol")}
          >
            <View style={[s.entryIcon, { backgroundColor: "#FFF3D6" }]}>
              <Ionicons name="star-outline" size={24} color="#013E77" />
            </View>
            <Text style={s.entryLabel}>網紅食譜</Text>
            <Text style={s.entrySub}>KOL 特色菜</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.entryCard}
            onPress={() => router.push("/recipes?source=user")}
          >
            <View style={[s.entryIcon, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="bookmarks-outline" size={24} color="#013E77" />
            </View>
            <Text style={s.entryLabel}>我的食譜</Text>
            <Text style={s.entrySub}>收藏/匯入</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 現有 Menu Items */}
      {/* ... */}
    </ScrollView>
  );
}

// 加呢啲 style：
const s = StyleSheet.create({
  // ... 現有 style
  recipeEntrySection: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  entryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  entryCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  entryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  entryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  entrySub: {
    fontSize: 11,
    color: "#8E8E93",
  },
});
```

---

## 📋 Phase 3：Grade 3 - 食譜列表頁（Filter）

### T3.1 新建食譜列表頁

**文件**：`kindcipe-app-4/app/recipes.tsx`（新建）

```tsx
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRecipeSearch } from "@/hooks/useRecipeSearch";
import RecipeCard from "@/src/components/RecipeCard";
import { Ionicons } from "@expo/vector-icons";

export default function RecipesPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const source = (params.source as "official" | "kol" | "user") || "all";
  const featured = params.featured === "1";

  const { recipes, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useRecipeSearch({
    source: featured ? undefined : source,
    featuredCategory: featured ? "home_hero" : undefined,
    limit: 20,
  });

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#013E77" />
        </TouchableOpacity>
        <Text style={s.title}>
          {featured ? "🔥 網紅精選" : source === "official" ? "🍳 官方食譜" : source === "kol" ? "🌟 網紅食譜" : "📝 我的食譜"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#013E77" />
        </View>
      ) : recipes.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTxt}>暫無食譜</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => router.push(`/recipe/${item.id}`)}
            />
          )}
          contentContainerStyle={s.listContent}
          onEndReached={hasNextPage ? fetchNextPage : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color="#013E77" /> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1C1E",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTxt: {
    fontSize: 16,
    color: "#8E8E93",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
});
```

---

## 📋 Phase 4：KOL Merchant 推薦（可選）

### T4.1 比價 Modal 加 KOL 推薦欄目

**文件**：`kindcipe-app-4/src/components/PriceCompareModal.tsx`

```tsx
// 喺 Modal 入面加呢個區段（喺消委會比價前面）：
{recipe.kolMerchantRecommendations && (
  <View style={s.kolSection}>
    <Text style={s.kolSectionTitle}>⭐ KOL 推薦</Text>
    {JSON.parse(recipe.kolMerchantRecommendations).map((rec: any, idx: number) => (
      <TouchableOpacity
        key={idx}
        style={s.kolCard}
        onPress={() => Linking.openURL(rec.url)}
      >
        <View style={s.kolHeader}>
          <Text style={s.kolMerchant}>{rec.merchant}</Text>
          {rec.kolHandle && (
            <Text style={s.kolHandle}>{rec.kolHandle}</Text>
          )}
        </View>
        <Text style={s.kolIngredient}>{rec.ingredient}</Text>
        {rec.note && (
          <Text style={s.kolNote}>{rec.note}</Text>
        )}
        <View style={s.kolFooter}>
          <Text style={s.kolLink}>前往購買 →</Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
)}

// 加 style：
kolSection: {
  marginHorizontal: 20,
  marginBottom: 16,
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomColor: "#F0EDE8",
},
kolSectionTitle: {
  fontSize: 14,
  fontWeight: "800",
  color: "#1C1C1E",
  marginBottom: 12,
},
kolCard: {
  backgroundColor: "#FFF7ED",
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
},
kolHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
},
kolMerchant: {
  fontSize: 14,
  fontWeight: "700",
  color: "#1C1C1E",
},
kolHandle: {
  fontSize: 12,
  color: "#013E77",
  fontWeight: "700",
},
kolIngredient: {
  fontSize: 13,
  color: "#1C1C1E",
  marginBottom: 4,
},
kolNote: {
  fontSize: 12,
  color: "#8E8E93",
  fontStyle: "italic",
},
kolFooter: {
  marginTop: 8,
  alignItems: "flex-end",
},
kolLink: {
  fontSize: 13,
  color: "#013E77",
  fontWeight: "700",
},
```

---

## 📋 Phase 5：內容填充（手動）

### T5.1 手動加 Featured 食譜

**SQL 腳本**：
```sql
-- 加 5 個 Grade 1 Featured 食譜
UPDATE official_recipes SET
  featured_rank = 1,
  featured_category = 'home_hero',
  source_type = 'kol',
  kol_handle = '@daydaycook'
WHERE id = 1;

UPDATE official_recipes SET
  featured_rank = 2,
  featured_category = 'home_hero',
  source_type = 'kol',
  kol_handle = '@點 CookGuide'
WHERE id = 2;

-- ... 加更多
```

### T5.2 手動加 KOL Merchant 推薦

**SQL 腳本**：
```sql
UPDATE official_recipes SET
  kol_merchant_recommendations = '[
    {
      "ingredient": "辣椒油",
      "merchant": "淘寶",
      "merchantKey": "taobao",
      "url": "https://item.taobao.com/...",
      "note": "呢間係正宗四川味",
      "kolHandle": "@daydaycook"
    }
  ]'
WHERE id = 1;
```

---

## 🔑 關鍵文件路徑

| 文件 | 路徑 | 改動類型 |
|---|---|---|
| **後端 Schema** | `kindcipe-backend/server/db/schema.ts` | 加字段 |
| **tRPC Router** | `kindcipe-backend/server/routers/recipes.ts` | 加 endpoint |
| **FeaturedCarousel** | `kindcipe-app-4/src/components/FeaturedCarousel.tsx` | 新建 |
| **Home Page** | `kindcipe-app-4/app/(tabs)/index.tsx` | 加組件 |
| **More Page** | `kindcipe-app-4/app/(tabs)/more.tsx` | 加區段 |
| **食譜列表頁** | `kindcipe-app-4/app/recipes.tsx` | 新建 |
| **比價 Modal** | `kindcipe-app-4/src/components/PriceCompareModal.tsx` | 加欄目（可選） |

---

## 📅 執行時間估算

| Phase | 任務 | 預計時間 | 依賴 |
|---|---|---|---|
| **Phase 0** | 後端 Schema + Migration | 1 小時 | 無 |
| **Phase 1** | FeaturedCarousel + Home Page | 2 小時 | Phase 0 |
| **Phase 2** | More Page 食譜入口 | 1 小時 | 無 |
| **Phase 3** | 食譜列表頁 | 2 小時 | 無 |
| **Phase 4** | KOL Merchant 推薦（可選） | 1 小時 | Phase 0 |
| **Phase 5** | 內容填充 | 1 小時 | Phase 0/1 |
| **總計** | | **8 小時** | |

---

## ✅ 驗收標準

| Grade | 驗收項目 | 通過標準 |
|---|---|---|
| **Grade 1** | Home Page Featured 顯示 | 橫向 Scroll 正常，3-5 個食譜 |
| **Grade 1** | 撳入食譜詳情 | 正常跳轉 |
| **Grade 1** | KOL Badge 顯示 | `@handle` 正確顯示 |
| **Grade 2** | More Page 3 個入口 | 橫向 3 格正常 |
| **Grade 2** | 撳入正確 Filter | 去到食譜列表頁，Filter 正確 |
| **Grade 3** | 食譜列表無限 Scroll | 加載正常 |
| **Grade 3** | Filter 切換 | `source=official/kol/user` 正確 |
| **Phase 4** | KOL Merchant 欄目 | 比價 Modal 顯示正確（如果有） |

---

## 🚨 風險同應對

| 風險 | 應對 |
|---|---|
| **Featured 食譜太少** | 初期用手動填充，唔使等 KOL 合作 |
| **KOL 唔嚟** | 用「官方精選」填補，功能照用 |
| **技術複雜** | 分 Phase 做，每 Phase 獨立可測試 |
| **法律風險** | KOL 內容要簽協議，初期用自己內容 |

---

## 📞 用戶要提供嘅嘅（3 樣）

1. **Featured 食譜清單**（初期 5-10 個，邊啲菜放頭排？）
2. **KOL 清單**（有冇心水 IG account？例如 @daydaycook @點 CookGuide）
3. **Merchant 清單**（除咗現有 6 個，仲想加邊啲？淘寶/京東？）

---

**呢個 Plan 已經完整，可以開始執行。**

**建議順序**：Phase 0 → Phase 2 → Phase 3 → Phase 1 → Phase 5 →（可選）Phase 4

**原因**：
- Phase 0 係基礎（後端字段）
- Phase 2/3 唔依賴 Phase 1（可以獨立測試）
- Phase 1 係「錦上添花」（有數據先至最盡用）
- Phase 5 係內容填充（最後先做）
- Phase 4 係可選（KOL 合作先至需要）
