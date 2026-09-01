# 🎯 KOL 網紅食譜系統 - 長期商業化方案

**文件狀態**: 建議方案  
**最後更新**: 2026-08-28  
**目標**: 建立可長期經營、變現的 KOL 食譜平台

---

## 📋 執行摘要

本文檔詳述 Kindcipe App 引入 KOL（網紅）食譜系統的完整商業計劃和技術方案，重點係建立一個**可長期經營、安全、可擴展**的商業模式。

### 核心商業模式
```
KOL 合作 → 獨家食譜內容 → 用戶訂閱 → 收入分成
   ↓           ↓              ↓         ↓
簽約管理     內容審核       付費牆     自動結算
```

---

## 🔐 第一部分：Admin 權限系統（優先級：最高）

### 現狀分析

**而家系統**:
- 只靠 PIN 碼 `8888` 驗證
- 無真正嘅用戶帳號檢查
- 無操作記錄（Audit Trail）

**風險評估**:
| 風險 | 嚴重性 | 可能性 | 影響 |
|------|--------|--------|------|
| PIN 碼洩露 | 🔴 高 | 高 | 任何人都可以修改/刪除 KOL 內容 |
| 無權限管理 | 🔴 高 | 中 | 離職員工仍然可以訪問 |
| 無操作記錄 | 🟡 中 | 高 | 出問題無法追溯 |
| 法律風險 | 🔴 高 | 中 | 商業數據無保護 |

### 建議方案：**實施真正嘅 Admin 帳號系統**

#### 技術架構
```typescript
// 1. 後端：增強用戶表
ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user';
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
CREATE INDEX idx_users_role ON users(role);

// 2. 後端：Admin 專用權限表（可選，進階）
CREATE TABLE admin_permissions (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  permission VARCHAR(64), -- 'create_recipe', 'delete_recipe', 'manage_kol', etc.
  granted_at TIMESTAMP DEFAULT NOW()
);
```

#### 實施步驟

**Phase 1: 基本登入驗證（1-2 日）**
```typescript
// 後端：adminLogin endpoint
adminLogin: publicProcedure
  .input(z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [user] = await db.select()
      .from(users)
      .where(and(
        eq(users.email, input.email),
        eq(users.role, 'admin')
      ))
      .limit(1);
    
    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '無效帳號' });
    }
    
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '密碼錯誤' });
    }
    
    // 生成 JWT Token
    const token = jwt.sign(
      { userId: user.id, role: 'admin' },
      ENV.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

// 後端：Admin 專用 middleware
const adminProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts;
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理員權限' });
  }
  return opts.next({ ctx: { ...ctx, user: ctx.user } });
});
```

**Phase 2: Frontend 登入頁面（1 日）**
```typescript
// app/admin-login.tsx
export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginM = trpc.admin.adminLogin.useMutation({
    onSuccess: (data) => {
      // 保存 token 到 AsyncStorage
      await AsyncStorage.setItem('admin_token', data.token);
      router.push('/admin');
    },
    onError: (e) => Alert.alert('登入失敗', e.message),
  });

  return (
    <View style={s.container}>
      <Text style={s.title}>管理員登入</Text>
      <TextInput
        style={s.input}
        placeholder="電郵地址"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="密碼"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={s.button}
        onPress={() => loginM.mutate({ email, password })}
      >
        <Text style={s.buttonText}>登入</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**Phase 3: 操作審計日誌（可選，進階）**
```typescript
// 後端：記錄所有 Admin 操作
CREATE TABLE admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id TEXT,
  action VARCHAR(64), -- 'create_recipe', 'delete_recipe', etc.
  target_type VARCHAR(32), -- 'recipe', 'kol_partnership'
  target_id INTEGER,
  old_value JSONB, -- 修改前嘅數據
  new_value JSONB, -- 修改後嘅數據
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

// 每個 Admin endpoint 都要記錄
const adminCreateRecipe = adminProcedure
  .input(createRecipeSchema)
  .mutation(async ({ ctx, input }) => {
    const result = await createRecipe(input);
    
    // 記錄審計日誌
    await db.insert(adminAuditLogs).values({
      adminUserId: ctx.user.id,
      action: 'create_recipe',
      targetType: 'recipe',
      targetId: result.id,
      newValue: JSON.stringify(input),
      ipAddress: ctx.ip,
    });
    
    return result;
  });
```

#### 安全最佳實踐

1. **密碼要求**:
   - 最少 8 個字元
   - 必須包含大細階 + 數字
   - 密碼強度檢查

2. **Token 管理**:
   - JWT Token 8 小時過期
   - 支援 Refresh Token
   - 登出時加入 Blacklist

3. **防暴力破解**:
   ```typescript
   // 密碼錯 5 次，鎖定 30 分鐘
   const failedAttempts = await redis.get(`login_failed:${email}`);
   if (failedAttempts >= 5) {
     throw new Error('嘗試次數過多，請 30 分鐘後再試');
   }
   ```

4. **IP 限制**（可選）:
   - 只允許指定 IP 訪問 Admin API
   - 需要登入時驗證 IP

---

## 📋 第二部分：收藏機制（核心功能）

### 方案比較

| 特性 | **方案 1: Copy 食譜** ✅ | 方案 2: Soft Delete |
|------|---------------------|-------------------|
| 數據所有權 | 清晰（用戶擁有） | 模糊（平台擁有） |
| KOL 刪除影響 | 無影響 | 用戶無法訪問 |
| 用戶編輯權 | 可以編輯 | 不可編輯 |
| 數據冗餘 | 高（Multiple copies） | 低（Single source） |
| KOL 更新同步 | 需手動更新 | 自動同步 |
| 法律風險 | 低 | 中 |
| **推薦度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 推薦方案：**收藏時 Copy 食譜數據 + 智能關聯**

#### 數據庫設計

```sql
-- 1. KOL 合作夥伴表
CREATE TABLE kol_partnerships (
  id SERIAL PRIMARY KEY,
  kol_name VARCHAR(128) NOT NULL,        -- KOL 名稱/品牌
  kol_handle VARCHAR(64),                 -- @handle / 社交帳號
  contact_email VARCHAR(320),             -- 聯絡電郵
  contact_phone VARCHAR(32),              -- 聯絡電話
  company_name VARCHAR(128),              -- 所屬公司（如有）
  
  -- 合約條款
  contract_start DATE NOT NULL,
  contract_end DATE,                      -- NULL = 無限期
  revenue_share_percent DECIMAL(5,2) DEFAULT 30.00, -- 分成比例
  minimum_guarantee DECIMAL(10,2) DEFAULT 0, -- 最低保證金
  
  -- 內容授權
  content_license_type VARCHAR(32) DEFAULT 'exclusive', -- 'exclusive' / 'non-exclusive'
  allowed_platforms TEXT[],               -- ['iOS', 'Android', 'Web']
  can_modify_content BOOLEAN DEFAULT true,
  
  -- 狀態追蹤
  status VARCHAR(32) DEFAULT 'active',    -- 'negotiating', 'active', 'expired', 'terminated'
  terminated_at TIMESTAMP,
  termination_reason TEXT,
  
  -- 元數據
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kol_partnerships_status ON kol_partnerships(status);
CREATE INDEX idx_kol_partnerships_expiry ON kol_partnerships(contract_end);

-- 2. 官方食譜表（增強 KOL 字段）
ALTER TABLE official_recipes ADD COLUMN kol_partnership_id INTEGER REFERENCES kol_partnerships(id);
ALTER TABLE official_recipes ADD COLUMN is_kol_recipe BOOLEAN DEFAULT false;
ALTER TABLE official_recipes ADD COLUMN kol_attribution TEXT; -- "食譜由 @xxx 提供"
ALTER TABLE official_recipes ADD COLUMN original_source_url TEXT; -- 原影片/貼文連結

CREATE INDEX idx_official_recipes_kol ON official_recipes(is_kol_recipe);

-- 3. 用戶收藏表（增強版）
CREATE TABLE user_recipe_collections (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  recipe_id VARCHAR(64) NOT NULL,
  recipe_type VARCHAR(16) NOT NULL,       -- 'official' / 'custom'
  
  -- 收藏類型
  collection_type VARCHAR(16) DEFAULT 'copy', -- 'copy' = 複製，'link' = 連結
  
  -- 如果係 Copy，記錄-copy 去邊
  copied_recipe_id INTEGER,                -- custom_recipes.id
  
  -- 如果係 Link，記錄原食譜
  original_recipe_id INTEGER,
  original_recipe_type VARCHAR(16),        -- 'official' / 'custom'
  
  -- KOL 歸因
  kol_partnership_id INTEGER REFERENCES kol_partnerships(id),
  
  -- 元數據
  saved_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  
  CONSTRAINT uniq_user_recipe UNIQUE(user_id, recipe_id, recipe_type)
);

CREATE INDEX idx_user_collections_user ON user_recipe_collections(user_id);
CREATE INDEX idx_user_collections_recipe ON user_recipe_collections(recipe_id, recipe_type);
```

#### 收藏流程（Copy 食譜）

```typescript
// 後端：收藏食譜 endpoint
toggleCollection: protectedProcedure
  .input(z.object({ 
    recipeId: z.string(),
    recipeType: z.enum(["official", "custom"]),
    collectionType: z.enum(["copy", "link"]).default("copy"),
  }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const userId = String(ctx.user.id);
    const { recipeId, recipeType, collectionType } = input;

    // 檢查是否已收藏
    const existing = await db.select()
      .from(userRecipeCollections)
      .where(and(
        eq(userRecipeCollections.userId, userId),
        eq(userRecipeCollections.recipeId, recipeId),
        eq(userRecipeCollections.recipeType, recipeType)
      ))
      .limit(1);

    if (existing.length > 0) {
      // 取消收藏
      await db.delete(userRecipeCollections)
        .where(and(
          eq(userRecipeCollections.userId, userId),
          eq(userRecipeCollections.recipeId, recipeId),
          eq(userRecipeCollections.recipeType, recipeType)
        ));
      return { collected: false };
    }

    // 新增收藏
    let copiedRecipeId: number | null = null;

    if (collectionType === "copy") {
      // Copy 食譜數據到 custom_recipes
      const originalRecipe = await getRecipeById(recipeId, recipeType);
      
      const [copiedRecipe] = await db.insert(customRecipes).values({
        familyId: ctx.activeFamilyId!, // 收藏去邊個家庭
        createdByUserId: userId,
        name: `${originalRecipe.name} (收藏自 ${originalRecipe.kolAttribution || 'KOL'})`,
        description: originalRecipe.description,
        image: originalRecipe.image,
        thumbnailUrl: originalRecipe.thumbnailUrl,
        cookTime: originalRecipe.cookTime,
        servings: originalRecipe.servings,
        difficulty: originalRecipe.difficulty,
        recipeCategory: originalRecipe.recipeCategory,
        ingredients: originalRecipe.ingredients,
        steps: originalRecipe.steps,
        tags: originalRecipe.tags,
        sourceType: 'kol',
        sourceAuthor: originalRecipe.sourceAuthor,
        sourceUrl: originalRecipe.sourceUrl,
        visibility: 'private', // 收藏嘅食譜預設私密
        isDraft: false,
      }).returning();

      copiedRecipeId = copiedRecipe.id;
    }

    // 記錄收藏關係
    await db.insert(userRecipeCollections).values({
      userId,
      recipeId,
      recipeType,
      collectionType,
      copiedRecipeId,
      originalRecipeId: parseInt(recipeId),
      originalRecipeType: recipeType,
    });

    return { collected: true, copiedRecipeId };
  });
```

#### 用戶體驗流程

```
用戶睇到 KOL 食譜
    ↓
按「收藏」按鈕
    ↓
系統自動 Copy 完整食譜到用戶帳號
    ↓
用戶「我的食譜」見到呢個食譜（標籤：收藏自 @KOL）
    ↓
用戶可以：
- 查看完整食譜（即使原 KOL 食譜刪除）
- 編輯食譜（修改食材、步驟）
- 分享食譜
- 刪除食譜

即使用戶取消收藏，Copy 咗嘅食譜仍然保留
（因為已經係用戶自己嘅數據）
```

---

## 🤝 第三部分：KOL 合作管理系統

### 商業合作流程

```
1. 接觸 KOL
   ↓
2. 協商條款（收入分成、獨家性、合約期）
   ↓
3. 簽署合約（書面/電子）
   ↓
4. Admin 录入系統
   ↓
5. KOL 提供食譜內容
   ↓
6. Admin 審核并发布
   ↓
7. 追蹤表現（瀏覽、收藏、訂閱轉化）
   ↓
8. 每月結算收入
   ↓
9. 合約到期前通知
   ↓
10. 續約或終止
```

### Admin Dashboard 功能

#### 3.1 KOL 合作夥伴管理

```typescript
// app/admin/kol-partners.tsx
export default function KolPartnersScreen() {
  const { data: partnerships = [] } = trpc.admin.listKolPartnerships.useQuery();
  const [showForm, setShowForm] = useState(false);

  const createPartnershipM = trpc.admin.createKolPartnership.useMutation();

  const activePartnerships = partnerships.filter(p => p.status === 'active');
  const expiringSoon = partnerships.filter(p => {
    if (!p.contractEnd) return false;
    const daysLeft = daysBetween(new Date(), new Date(p.contractEnd));
    return daysLeft <= 30;
  });

  return (
    <ScrollView style={s.container}>
      {/* 統計卡片 */}
      <View style={s.statsRow}>
        <StatCard 
          label="合作中" 
          value={activePartnerships.length} 
          color="#16A34A" 
        />
        <StatCard 
          label="即將到期" 
          value={expiringSoon.length} 
          color="#DC2626" 
        />
        <StatCard 
          label="總 KOL 數" 
          value={partnerships.length} 
          color="#013E77" 
        />
      </View>

      {/* KOL 列表 */}
      {partnerships.map(kol => (
        <KolPartnershipCard
          key={kol.id}
          kol={kol}
          onPress={() => router.push(`/admin/kol/${kol.id}`)}
        />
      ))}

      {/* 新增按鈕 */}
      <TouchableOpacity 
        style={s.addButton}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={s.addButtonText}>新增合作夥伴</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

#### 3.2 新增 KOL 合作表單

```typescript
// app/admin/kol-new.tsx
export default function NewKolPartnershipScreen() {
  const [form, setForm] = useState({
    kolName: '',
    kolHandle: '',
    contactEmail: '',
    contractStart: toISODate(new Date()),
    contractEnd: '',
    revenueShare: '30',
    contentLicense: 'exclusive',
    canModifyContent: true,
    notes: '',
  });

  const createM = trpc.admin.createKolPartnership.useMutation({
    onSuccess: () => {
      Alert.alert('成功', '已新增合作夥伴');
      router.back();
    },
  });

  const handleSubmit = () => {
    if (!form.kolName.trim()) {
      Alert.alert('錯誤', '請輸入 KOL 名稱');
      return;
    }

    createM.mutate({
      kolName: form.kolName,
      kolHandle: form.kolHandle,
      contactEmail: form.contactEmail,
      contractStart: form.contractStart,
      contractEnd: form.contractEnd || null,
      revenueSharePercent: parseFloat(form.revenueShare),
      contentLicenseType: form.contentLicense as 'exclusive' | 'non-exclusive',
      canModifyContent: form.canModifyContent,
      notes: form.notes,
      status: 'active',
    });
  };

  return (
    <ScrollView style={s.container}>
      <FormField label="KOL 名稱" value={form.kolName} onChange={v => setForm({...form, kolName: v})} />
      <FormField label="社交帳號 Handle" value={form.kolHandle} onChange={v => setForm({...form, kolHandle: v})} placeholder="@example" />
      <FormField label="聯絡電郵" value={form.contactEmail} onChange={v => setForm({...form, contactEmail: v})} keyboardType="email-address" />
      
      <View style={s.section}>
        <Text style={s.sectionTitle}>合約條款</Text>
        <DateField label="合約開始日期" value={form.contractStart} onChange={v => setForm({...form, contractStart: v})} />
        <DateField label="合約結束日期" value={form.contractEnd} onChange={v => setForm({...form, contractEnd: v})} optional />
        <PercentageField label="收入分成 (%)" value={form.revenueShare} onChange={v => setForm({...form, revenueShare: v})} />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>內容授權</Text>
        <SelectField 
          label="授權類型" 
          value={form.contentLicense} 
          options={[
            { label: '獨家授權', value: 'exclusive' },
            { label: '非獨家授權', value: 'non-exclusive' },
          ]}
          onChange={v => setForm({...form, contentLicense: v})}
        />
        <ToggleField 
          label="允許修改內容" 
          value={form.canModifyContent} 
          onChange={v => setForm({...form, canModifyContent: v})}
        />
      </View>

      <TouchableOpacity style={s.button} onPress={handleSubmit}>
        <Text style={s.buttonText}>建立合作夥伴</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

#### 3.3 KOL 食譜管理

```typescript
// app/admin/kol/[id].tsx
export default function KolDetailScreen() {
  const { id } = useLocalSearchParams();
  const { data: kol } = trpc.admin.getKolPartnership.useQuery({ id: Number(id) });
  const { data: recipes = [] } = trpc.admin.getKolRecipes.useQuery({ kolPartnershipId: Number(id) });
  const { data: stats } = trpc.admin.getKolStats.useQuery({ kolPartnershipId: Number(id) });

  const [showAddRecipe, setShowAddRecipe] = useState(false);

  // 計算表現指標
  const totalViews = stats?.totalViews || 0;
  const totalSaves = stats?.totalSaves || 0;
  const conversionRate = totalViews > 0 ? (totalSaves / totalViews * 100).toFixed(2) : 0;

  return (
    <ScrollView style={s.container}>
      {/* KOL 資料卡片 */}
      <View style={s.kolCard}>
        <Text style={s.kolName}>{kol?.kolName}</Text>
        <Text style={s.kolHandle}>{kol?.kolHandle}</Text>
        
        <View style={s.statusBadge}>
          <Text style={s.statusText}>{kol?.status}</Text>
        </View>

        {kol?.contractEnd && (
          <View style={s.expiryNotice}>
            <Ionicons name="calendar-outline" size={16} color="#DC2626" />
            <Text style={s.expiryText}>
              合約將於 {formatDate(kol.contractEnd)} 到期
            </Text>
          </View>
        )}
      </View>

      {/* 表現統計 */}
      <View style={s.statsSection}>
        <Text style={s.sectionTitle}>表現統計</Text>
        <View style={s.statsRow}>
          <StatItem label="總瀏覽" value={totalViews} />
          <StatItem label="總收藏" value={totalSaves} />
          <StatItem label="轉化率" value={`${conversionRate}%`} />
        </View>
      </View>

      {/* 食譜列表 */}
      <View style={s.recipesSection}>
        <Text style={s.sectionTitle}>食譜列表 ({recipes.length})</Text>
        
        {recipes.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}

        <TouchableOpacity 
          style={s.addRecipeButton}
          onPress={() => setShowAddRecipe(true)}
        >
          <Ionicons name="add" size={20} color="#013E77" />
          <Text style={s.addRecipeButtonText}>新增食譜</Text>
        </TouchableOpacity>
      </View>

      {/* 收入分成（可選）*/}
      {stats?.revenue && (
        <View style={s.revenueSection}>
          <Text style={s.sectionTitle}>收入分成</Text>
          <View style={s.revenueRow}>
            <Text style={s.revenueLabel}>本月預估:</Text>
            <Text style={s.revenueValue}>${stats.revenue.currentMonth}</Text>
          </View>
          <View style={s.revenueRow}>
            <Text style={s.revenueLabel}>累計:</Text>
            <Text style={s.revenueValue}>${stats.revenue.total}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
```

---

## 💰 第四部分：商業化模式

### 4.1 訂閱制（主要收入）

#### 定價策略

| 方案 | 價格 (HKD) | 特點 | 目標用戶 |
|------|-----------|------|---------|
| **免費** | $0 | 瀏覽 KOL 食譜，最多收藏 10 個 | 新用戶、試探用 |
| **高級** | $68/月 | 無限收藏、獨家內容、無廣告 | 一般用戶 |
| **年度** | $680/年 | 高級功能 + 2 個月免費 | 忠實用戶 |
| **家庭** | $98/月 | 最多 5 個家庭成員共享 | 家庭用戶 |

#### 功能分層

```typescript
// 後端：檢查用戶訂閱狀態
async function checkSubscriptionAccess(userId: string, feature: string): Promise<boolean> {
  const user = await getUser(userId);
  const subscription = await getUserSubscription(userId);

  if (!subscription || subscription.status !== 'active') {
    // 免費用戶
    return getFreeTierFeatures().includes(feature);
  }

  if (subscription.plan === 'premium') {
    return getPremiumFeatures().includes(feature);
  }

  if (subscription.plan === 'family') {
    return getFamilyFeatures().includes(feature);
  }

  return false;
}

// 功能限制
const FREE_TIER_FEATURES = [
  'browse_kol_recipes',
  'save_up_to_10_recipes',
  'basic_search',
];

const PREMIUM_FEATURES = [
  ...FREE_TIER_FEATURES,
  'unlimited_saves',
  'exclusive_kol_content',
  'meal_planning',
  'price_comparison',
  'ad_free',
];
```

#### 收費系統整合

```typescript
// 後端：Apple/Google/Stripe 整合
createSubscription: protectedProcedure
  .input(z.object({
    plan: z.enum(['premium', 'family']),
    billingCycle: z.enum(['monthly', 'yearly']),
    paymentMethod: z.enum(['apple_pay', 'google_pay', 'stripe']),
    receiptData: z.string().optional(), // Apple/Google 收據
  }))
  .mutation(async ({ ctx, input }) => {
    // 驗證收據（Apple/Google）
    if (input.receiptData) {
      const verified = await verifyReceipt(input.receiptData);
      if (!verified) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無效收據' });
      }
    }

    // 建立訂閱
    const [subscription] = await db.insert(userSubscriptions).values({
      userId: ctx.user.id,
      plan: input.plan,
      billingCycle: input.billingCycle,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), input.billingCycle === 'yearly' ? 12 : 1),
    }).returning();

    return { subscriptionId: subscription.id };
  });
```

### 4.2 KOL 收入分成

#### 分成模式

**模式 A: 訂閱收入分成**
```
總訂閱收入 × KOL 帶來嘅訂閱比例 × 分成比例 = KOL 收入

例如：
- 本月總訂閱收入：$100,000
- KOL @daydaycook 帶來嘅訂閱：30%（通過追蹤連結/歸因）
- 分成比例：30%
- KOL 收入：$100,000 × 30% × 30% = $9,000
```

**模式 B: 按表現付費**
```
每個收藏：$1.00
每個訂閱轉化：$50.00
獨家內容授權費：$5,000/月（固定）
```

#### 追蹤系統

```sql
-- 訂閱歸因表
CREATE TABLE subscription_attributions (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  subscription_id INTEGER,
  attributed_kol_id INTEGER REFERENCES kol_partnerships(id),
  attribution_type VARCHAR(32), -- 'first_touch', 'last_touch', 'multi_touch'
  touchpoint_count INTEGER,
  revenue_amount DECIMAL(10,2),
  kol_share_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- KOL 表現追蹤
CREATE TABLE kol_performance_metrics (
  id SERIAL PRIMARY KEY,
  kol_partnership_id INTEGER REFERENCES kol_partnerships(id),
  recipe_id INTEGER,
  metric_date DATE,
  views INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  subscription_conversions INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.3 聯盟營銷（可選）

```typescript
// KOL 推薦食材供應商
interface KolMerchantRecommendation {
  ingredient: string;
  merchant: string;      // 'HKTVmall', 'Pricerite', etc.
  url: string;           // 聯盟連結
  commissionRate: number; // 佣金比例
  kolHandle: string;
}

// 後端：追蹤聯盟連結點擊/購買
trackAffiliateClick: protectedProcedure
  .input(z.object({
    kolPartnershipId: z.number(),
    merchant: z.string(),
    url: z.string().url(),
  }))
  .mutation(async ({ ctx, input }) => {
    await db.insert(affiliateClicks).values({
      userId: ctx.user.id,
      kolPartnershipId: input.kolPartnershipId,
      merchant: input.merchant,
      url: input.url,
      clickedAt: new Date(),
    });
  });

// 每月結算佣金
const calculateMonthlyCommission = async (kolPartnershipId: number, month: Date) => {
  const clicks = await db.select()
    .from(affiliateClicks)
    .where(and(
      eq(affiliateClicks.kolPartnershipId, kolPartnershipId),
      sql`DATE_TRUNC('month', clicked_at) = ${month}`
    ));

  // 假設每個點擊 $0.50 佣金
  const totalCommission = clicks.length * 0.50;
  return totalCommission;
};
```

---

## 📊 第五部分：技術實施路線圖

### Phase 1: 基礎建設（2-4 週）⚡

**目標**: 建立安全、可靠嘅基礎設施

#### Week 1-2: Admin 認證系統
- [ ] 後端：`adminLogin` endpoint
- [ ] 後端：`adminProcedure` middleware（權限檢查）
- [ ] 後端：`admin_audit_logs` 表
- [ ] Frontend：`/admin-login` 頁面
- [ ] Frontend：Admin Page 保護（檢查 token）
- [ ] 測試：登入流程、權限檢查、Token 過期

**驗收標準**:
- ✅ Admin 需要登入先可以訪問 `/admin`
- ✅ 無權限用戶被拒絕訪問
- ✅ 所有 Admin 操作都有審計日誌

#### Week 3-4: 收藏 Copy 機制
- [ ] 後端：`kol_partnerships` 表
- [ ] 後端：增強 `user_recipe_collections` 表
- [ ] 後端：`toggleCollection` endpoint（支持 Copy）
- [ ] 後端：`listCollections` endpoint
- [ ] Frontend：`CollectionButton` 組件（更新）
- [ ] Frontend：「我的食譜」顯示收藏來源
- [ ] 測試：收藏流程、數據完整性

**驗收標準**:
- ✅ 用戶收藏 KOL 食譜時自動 Copy
- ✅ Copy 嘅食譜完整（食材、步驟、圖片）
- ✅ 原 KOL 食譜刪除後，用戶仍然可以訪問

**優先級**: 🔴 最高

---

### Phase 2: KOL 管理系統（4-6 週）🤝

**目標**: 實現完整嘅 KOL 合作管理

#### Week 5-6: KOL 合作夥伴管理
- [ ] 後端：`createKolPartnership` endpoint
- [ ] 後端：`listKolPartnerships` endpoint
- [ ] 後端：`updateKolPartnership` endpoint
- [ ] 後端：合約到期自動通知（Cron Job）
- [ ] Frontend：`/admin/kol-partners` 頁面
- [ ] Frontend：`/admin/kol-new` 表單
- [ ] Frontend：`/admin/kol/[id]` 詳情頁
- [ ] 測試：CRUD 操作、通知系統

#### Week 7-8: KOL 食譜管理
- [ ] 後端：`createKolRecipe` endpoint
- [ ] 後端：`listKolRecipes` endpoint
- [ ] 後端：`deleteKolRecipe` endpoint（Soft Delete）
- [ ] Frontend：Admin 食譜表單（支持 KOL 歸因）
- [ ] Frontend：KOL 食譜列表（Filter by KOL）
- [ ] 測試：食譜 CRUD、歸因追蹤

#### Week 9-10: 表現追蹤
- [ ] 後端：`trackRecipeView` endpoint
- [ ] 後端：`trackRecipeSave` endpoint
- [ ] 後端：`getKolPerformance` endpoint
- [ ] Frontend：KOL Dashboard（統計圖表）
- [ ] Frontend：表現報表（导出 CSV）
- [ ] 測試：數據準確性、報表生成

**優先級**: 🟡 高

---

### Phase 3: 變現功能（6-8 週）💰

**目標**: 實現訂閱制同收入追蹤

#### Week 11-12: 訂閱系統基礎
- [ ] 後端：`user_subscriptions` 表
- [ ] 後端：`createSubscription` endpoint
- [ ] 後端：`cancelSubscription` endpoint
- [ ] 後端：訂閱狀態檢查 middleware
- [ ] Frontend：訂閱方案頁面
- [ ] Frontend：付費牆（限制免費用戶）
- [ ] 整合：Stripe（Web/Android）
- [ ] 整合：Apple In-App Purchase（iOS）

#### Week 13-14: 收入分成系統
- [ ] 後端：`subscription_attributions` 表
- [ ] 後端：歸因邏輯（First-touch / Last-touch）
- [ ] 後端：`calculateKolRevenue` endpoint
- [ ] Frontend：KOL 收入 Dashboard
- [ ] Frontend：月度報表（PDF 导出）
- [ ] 測試：分成計算準確性

#### Week 15-16: 免費 vs 高級功能
- [ ] 後端：Feature Flag 系統
- [ ] 後端：免費用戶限制（收藏 ≤ 10）
- [ ] 後端：高級用戶無限功能
- [ ] Frontend：升級提示（當觸及限制）
- [ ] Frontend：付費內容標籤
- [ ] 測試：權限邊界、用戶體驗

**優先級**: 🟢 中（但係收入關鍵）

---

### Phase 4: 增長優化（8-12 週）📈

**目標**: 優化轉化、擴張功能

#### Week 17-18: 聯盟營銷
- [ ] 後端：`affiliate_links` 表
- [ ] 後端：追蹤點擊/購買
- [ ] 後端：佣金計算
- [ ] Frontend：聯盟連結展示
- [ ] 整合：商家 API（HKTVmall 等）

#### Week 19-20: A/B 測試
- [ ] 後端：A/B 測試框架
- [ ] 後端：追蹤唔同版本嘅轉化率
- [ ] Frontend：動態 UI 版本
- [ ] 分析：數據儀表板

#### Week 21-22: KOL 自助平台
- [ ] 後端：KOL 登入系統
- [ ] 後端：KOL 自行上傳食譜
- [ ] 後端：審核流程
- [ ] Frontend：KOL Portal
- [ ] Frontend：表現 Dashboard

#### Week 23-24: 自動化運營
- [ ] 後端：自動結算系統
- [ ] 後端：自動續約通知
- [ ] 後端：自動付費（Stripe Connect）
- [ ] Frontend：自動化報表
- [ ] 整合：會計系統（Xero/QuickBooks）

**優先級**: 🔵 低（長期優化）

---

## ⚖️ 第六部分：法律與合規

### 6.1 KOL 合作合約範本

**關鍵條款**:

```
1. 授權範圍
   - 獨家 / 非獨家
   - 平台限制（iOS / Android / Web）
   - 地域限制（香港 / 大灣區 / 全球）
   - 授權期限（合約期內 / 永久）

2. 內容所有權
   - KOL 保留版權
   - 平台獲得使用權
   - 合約終止後處理（刪除 / 保留已收藏）

3. 收入分成
   - 計算基準（總收入 / 淨收入）
   - 分成比例（固定 / 階梯式）
   - 結算周期（月結 / 季結）
   - 最低保證金（如有）

4. 合約終止
   - 提前通知期（30 日 / 60 日）
   - 違約條款
   - 終止後內容處理

5. 保密條款
   - 商業機密定義
   - 保密期限
   - 違約賠償
```

### 6.2 用戶服務條款

**關鍵條款**:

```
1. 收藏食譜所有權
   - 用戶收藏時獲得 Copy
   - 即使原 KOL 食譜刪除，用戶仍保留
   - 用戶可以編輯自己收藏嘅版本

2. 內容使用限制
   - 僅限個人使用
   - 禁止商業用途
   - 禁止批量下載/爬蟲

3. 訂閱服務
   - 付費方案詳情
   - 退款政策
   - 自動續訂條款

4. 私隱政策
   - 數據收集範圍
   - 數據使用目的
   - 第三方共享（如有）
```

### 6.3 私隱政策（GDPR/PDPO 合規）

**必須披露**:

```
1. 收集的個人數據
   - 用戶帳號（電郵、密碼）
   - 使用數據（瀏覽、收藏記錄）
   - 付費數據（訂閱、交易記錄）

2. 數據使用目的
   - 提供服務
   - 改善用戶體驗
   - 商業分析

3. 數據共享
   - KOL 表現數據（匿名化）
   - 支付處理商（Stripe/Apple/Google）
   - 法律要求

4. 用戶權利
   - 訪問個人數據
   - 更正數據
   - 刪除數據（被遺忘權）
   - 导出數據
```

---

## 📈 第七部分：成功指標（KPI）

### 7.1 業務指標

| 指標 | 定義 | 目標（6 個月） |
|------|------|---------------|
| **MAU** | 月活躍用戶 | 10,000 |
| **訂閱轉化率** | 免費→高級 | 5% |
| **MRR** | 每月經常收入 | $500,000 HKD |
| **Churn Rate** | 訂閱取消率 | < 5%/月 |
| **LTV** | 用戶終身價值 | $800 HKD |
| **CAC** | 用戶獲取成本 | < $200 HKD |

### 7.2 KOL 表現指標

| 指標 | 定義 | 目標 |
|------|------|------|
| **KOL 活躍度** | 每月新增食譜數 | ≥ 4 個/月 |
| **食譜瀏覽量** | 每個食譜平均瀏覽 | 1,000+ |
| **收藏轉化率** | 瀏覽→收藏 | 10%+ |
| **訂閱歸因** | 通過 KOL 帶來的訂閱 | 30%+ |
| **KOL 留存率** | 合約續約率 | 80%+ |

### 7.3 技術指標

| 指標 | 定義 | 目標 |
|------|------|------|
| **API 響應時間** | P95 < 500ms | 99% |
| **系統可用性** | Uptime | 99.9% |
| **收藏成功率** | 收藏操作成功 | 99.5%+ |
| **數據一致性** | Copy 食譜完整性 | 100% |

---

## 🚨 第八部分：風險管理

### 8.1 技術風險

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| 數據丟失 | 低 | 🔴 高 | 每日備份、異地冗餘 |
| 安全漏洞 | 中 | 🔴 高 | 定期審計、滲透測試 |
| 系統過載 | 中 | 🟡 中 | 自動擴展、負載平衡 |
| 第三方依賴 | 高 | 🟡 中 | 多供應商、降級方案 |

### 8.2 商業風險

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| KOL 合作失敗 | 中 | 🟡 中 | 多元化 KOL 組合 |
| 訂閱增長緩慢 | 中 | 🔴 高 | A/B 測試定價、營銷優化 |
| 法律訴訟 | 低 | 🔴 高 | 法律顧問、完善合約 |
| 競爭對手模仿 | 高 | 🟡 中 | 建立品牌護城河、獨家內容 |

### 8.3 合規風險

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| GDPR 違規 | 低 | 🔴 高 | 私隱合規審查 |
| 版權糾紛 | 中 | 🟡 中 | KOL 內容授權審核 |
| 支付合規 | 低 | 🟡 中 | PCI DSS 合規 |

---

## 📞 第九部分：下一步行動

### 立即行動（本週）

1. **確認 Admin 帳號**
   - 檢查現有用戶表
   - 將你的帳號設為 `role = 'admin'`
   - 測試登入流程

2. **實施 Admin 認證**
   - 優先級：🔴 最高
   - 預計時間：1-2 日
   - 負責人：開發團隊

3. **準備 KOL 合約範本**
   - 諮詢法律顧問
   - 起草標準合約
   - 確認分成比例

### 短期目標（1 個月內）

1. **完成 Phase 1**（基礎建設）
   - Admin 認證系統
   - 收藏 Copy 機制

2. **簽約 1-2 個試點 KOL**
   - 測試合作流程
   - 收集反饋
   - 優化系統

3. **準備訂閱系統**
   - 申請 Apple/Google 開發者帳號
   - 整合 Stripe
   - 測試付費流程

### 中期目標（3 個月內）

1. **完成 Phase 2-3**
   - KOL 管理系統
   - 訂閱變現功能

2. **招募 5-10 個 KOL**
   - 建立多元化內容
   - 測試唔同定價策略

3. **啟動營銷推廣**
   - 社交媒體宣傳
   - KOL 互相推廣
   - 用戶推薦計劃

---

## 🎯 第十部分：總結與建議

### 核心建議

1. **安全第一位** 🔐
   - 立即實施 Admin 認證
   - 唔好再用 PIN 碼 `8888`
   - 所有操作都要有審計日誌

2. **用戶數據所有權** 📋
   - 收藏 = Copy 食譜
   - 即使 KOL 食譜刪除，用戶仍保留
   - 法律風險最低

3. **長期商業模式** 💰
   - 訂閱制為核心收入
   - KOL 分成激勵優質內容
   - 聯盟營銷為輔助收入

4. **數據驅動決策** 📊
   - 追蹤所有關鍵指標
   - 定期檢討 KOL 表現
   - 根據數據優化策略

### 成功關鍵因素

✅ **執行質素**: 按時完成 Phase 1-2  
✅ **KOL 質素**: 簽約有影響力嘅 KOL  
✅ **用戶體驗**: 流暢、直觀、無 bug  
✅ **合規性**: 法律、私隱、支付合規  

---

**文件完**

*最後更新：2026-08-28*  
*作者：Kindcipe 開發團隊*  
*版本：1.0*
