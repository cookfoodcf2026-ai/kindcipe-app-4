/**
 * 打邊爐/BBQ/節慶大盆菜 買餸模板 (多語言對照版本)
 * 每個模板包含多個分類，每個分類有若干預設食材
 * 份量基於 2 人份，會根據人數自動調整
 */

export type TemplateItem = {
  id: string;
  name: string;
  nameEn: string;
  nameId?: string; // 印尼語 (Bahasa Indonesia)
  namePh?: string; // 菲律賓語 (Tagalog)
  unit: string;
  unitEn: string;
  unitId?: string;
  unitPh?: string;
  baseQuantity: number; // 2 人份的基準份量
  category: string;
  isOptional?: boolean; // 是否可選
  estimatedPricePerUnit?: number; // 每單位預計價錢 (HKD)
};

export type TemplateCategory = {
  id: string;
  name: string;
  nameEn: string;
  nameId?: string;
  namePh?: string;
  icon: string;
  items: TemplateItem[];
};

export type ShoppingTemplate = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  categories: TemplateCategory[];
};

// ─── 打邊爐模板 ──────────────────────────────────────────────
export const HOTPOT_TEMPLATE: ShoppingTemplate = {
  id: "template_hotpot",
  name: "經典打邊爐",
  nameEn: "Classic Hot Pot",
  description: "香港經典家庭打邊爐，適合 2-20 人聚餐",
  descriptionEn: "Classic Hong Kong home style hot pot feast",
  categories: [
    {
      id: "soup-base",
      name: "湯底",
      nameEn: "Soup Base",
      nameId: "Sup",
      namePh: "Sabaw",
      icon: "restaurant-outline",
      items: [
        { id: "soup-chicken", name: "雞湯底", nameEn: "Chicken soup base", nameId: "Sup ayam", namePh: "Sabaw ng manok", unit: "鍋", unitEn: "pot", unitId: "panci", unitPh: "kaldero", baseQuantity: 1, category: "soup-base" },
        { id: "soup-pork", name: "豬骨湯底", nameEn: "Pork bone soup base", nameId: "Sup tulang babi", namePh: "Sabaw ng buto ng baboy", unit: "鍋", unitEn: "pot", unitId: "panci", unitPh: "kaldero", baseQuantity: 1, category: "soup-base" },
        { id: "soup-clear", name: "清湯底", nameEn: "Clear soup base", nameId: "Sup bening", namePh: "Malinaw na sabaw", unit: "鍋", unitEn: "pot", unitId: "panci", unitPh: "kaldero", baseQuantity: 1, category: "soup-base" },
      ],
    },
    {
      id: "meat",
      name: "肉類",
      nameEn: "Meat",
      nameId: "Daging",
      namePh: "Karne",
      icon: "restaurant-outline",
      items: [
        { id: "meat-beef", name: "肥牛片", nameEn: "Sliced beef", nameId: "Irisan daging sapi", namePh: "Sliced beef", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 300, category: "meat", estimatedPricePerUnit: 0.15 },
        { id: "meat-lamb", name: "肥羊片", nameEn: "Sliced lamb", nameId: "Irisan daging kambing", namePh: "Sliced lamb", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 250, category: "meat", isOptional: true, estimatedPricePerUnit: 0.18 },
        { id: "meat-pork", name: "豬梅花片", nameEn: "Sliced pork neck", nameId: "Irisan daging babi", namePh: "Sliced pork", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 300, category: "meat", estimatedPricePerUnit: 0.12 },
        { id: "meat-chicken", name: "鮮雞肉件", nameEn: "Chicken pieces", nameId: "Potongan ayam", namePh: "Mga piraso ng manok", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 200, category: "meat", estimatedPricePerUnit: 0.1 },
        { id: "meat-ball-beef", name: "手打牛肉丸", nameEn: "Beef balls", nameId: "Bakso sapi", namePh: "Beef balls", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 6, category: "meat", estimatedPricePerUnit: 3 },
      ],
    },
    {
      id: "seafood",
      name: "海鮮",
      nameEn: "Seafood",
      nameId: "Makanan laut",
      namePh: "Seafood",
      icon: "fish-outline",
      items: [
        { id: "seafood-prawn", name: "鮮生蝦", nameEn: "Fresh prawns", nameId: "Udang segar", namePh: "Sariwang hipon", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 200, category: "seafood", estimatedPricePerUnit: 0.2 },
        { id: "seafood-squid", name: "鮮魷魚/墨魚", nameEn: "Fresh squid", nameId: "Cumi-cumi segar", namePh: "Sariwang pusit", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 200, category: "seafood", estimatedPricePerUnit: 0.15 },
        { id: "seafood-fish", name: "脆肉鯇魚片", nameEn: "Sliced grass carp", nameId: "Irisan ikan carp", namePh: "Sliced fish", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 250, category: "seafood", estimatedPricePerUnit: 0.12 },
        { id: "seafood-oyster", name: "廣島蠔", nameEn: "Fresh oysters", nameId: "Tiram segar", namePh: "Sariwang oysters", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 6, category: "seafood", isOptional: true, estimatedPricePerUnit: 8 },
      ],
    },
    {
      id: "balls-tofu",
      name: "丸類/豆製品",
      nameEn: "Balls & Tofu",
      nameId: "Bakso & Tahu",
      namePh: "Fish balls at Tofu",
      icon: "grid-outline",
      items: [
        { id: "ball-fish", name: "手打魚丸", nameEn: "Fish balls", nameId: "Bakso ikan", namePh: "Fish balls", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 6, category: "balls-tofu" },
        { id: "ball-cuttlefish", name: "鮮墨魚丸", nameEn: "Cuttlefish balls", nameId: "Bakso cumi-cumi", namePh: "Cuttlefish balls", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 6, category: "balls-tofu" },
        { id: "tofu-firm", name: "鮮豆腐", nameEn: "Fresh tofu", nameId: "Tahu segar", namePh: "Sariwang tofu", unit: "盒", unitEn: "box", unitId: "kotak", unitPh: "kahon", baseQuantity: 1, category: "balls-tofu" },
        { id: "tofu-skin", name: "炸響鈴/腐竹", nameEn: "Fried beancurd rolls", nameId: "Kulit tahu goreng", namePh: "Fried beancurd skin", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "balls-tofu" },
      ],
    },
    {
      id: "vegetable",
      name: "新鮮蔬菜",
      nameEn: "Vegetables",
      nameId: "Sayur-sayuran",
      namePh: "Gulay",
      icon: "leaf-outline",
      items: [
        { id: "veg-tongho", name: "皇帝菜/茼蒿", nameEn: "Chrysanthemum greens", nameId: "Sayur krisan", namePh: "Chrysanthemum greens", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 400, category: "vegetable" },
        { id: "veg-lettuce", name: "唐生菜", nameEn: "Chinese lettuce", nameId: "Selada Cina", namePh: "Chinese lettuce", unit: "個", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 1, category: "vegetable" },
        { id: "veg-corn", name: "甜粟米", nameEn: "Sweet corn", nameId: "Jagung manis", namePh: "Mais", unit: "條", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 1, category: "vegetable" },
        { id: "veg-mushroom", name: "金針菇/香菇", nameEn: "Enoki/Shiitake mushrooms", nameId: "Jamur enoki/shiitake", namePh: "Enoki/Shiitake mushrooms", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "vegetable" },
      ],
    },
    {
      id: "staple",
      name: "主食",
      nameEn: "Staples",
      nameId: "Makanan Pokok",
      namePh: "Kanin at Noodles",
      icon: "restaurant-outline",
      items: [
        { id: "staple-udon", name: "讚岐烏冬", nameEn: "Udon noodles", nameId: "Mie udon", namePh: "Udon noodles", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "staple" },
        { id: "staple-noodle", name: "出前一丁/即食麵", nameEn: "Instant noodles", nameId: "Mie instan", namePh: "Instant noodles", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "staple" },
      ],
    },
    {
      id: "sauce",
      name: "醬料配料",
      nameEn: "Condiments",
      nameId: "Saus & Bumbu",
      namePh: "Sarsa at Bawang",
      icon: "wine-outline",
      items: [
        { id: "sauce-shacha", name: "沙茶醬", nameEn: "Shacha sauce", nameId: "Saus Shacha", namePh: "Shacha sauce", unit: "罐", unitEn: "can", unitId: "kaleng", unitPh: "lata", baseQuantity: 0.5, category: "sauce" },
        { id: "sauce-soy", name: "火鍋豉油", nameEn: "Hot pot soy sauce", nameId: "Kecap asin", namePh: "Toyo", unit: "支", unitEn: "bottle", unitId: "botol", unitPh: "bote", baseQuantity: 0.5, category: "sauce" },
        { id: "sauce-garlic", name: "去皮蒜頭", nameEn: "Peeled garlic", nameId: "Bawang putih kupas", namePh: "Binalatang bawang", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 0.5, category: "sauce" },
        { id: "sauce-onion", name: "新鮮青蔥", nameEn: "Green spring onion", nameId: "Daun bawang", namePh: "Dahon ng sibuyas", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 0.5, category: "sauce" },
      ],
    },
  ],
};

// ─── BBQ 模板 ──────────────────────────────────────────────
export const BBQ_TEMPLATE: ShoppingTemplate = {
  id: "template_bbq",
  name: "經典 BBQ",
  nameEn: "Classic BBQ",
  description: "港式燒烤派對，肉類海鮮一應俱全",
  descriptionEn: "Classic Hong Kong style BBQ grill party",
  categories: [
    {
      id: "meat",
      name: "燒烤肉類",
      nameEn: "BBQ Meats",
      nameId: "Daging bakar",
      namePh: "Pang-BBQ na Karne",
      icon: "restaurant-outline",
      items: [
        { id: "meat-porkchop", name: "黑椒醃豬扒", nameEn: "Marinated pork chops", nameId: "Babi panggang lada hitam", namePh: "Marinated pork chop", unit: "塊", unitEn: "pcs", unitId: "potong", unitPh: "piraso", baseQuantity: 4, category: "meat" },
        { id: "meat-chickenwing", name: "蒜香醃雞翼", nameEn: "Marinated chicken wings", nameId: "Sayap ayam bawang putih", namePh: "Marinated chicken wings", unit: "隻", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 8, category: "meat" },
        { id: "meat-sausage", name: "廚師牌雞肉腸", nameEn: "Chicken sausages", nameId: "Sosis ayam", namePh: "Sausage ng manok", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "meat" },
        { id: "meat-steak", name: "蒜蓉醃牛扒", nameEn: "Marinated beef steaks", nameId: "Steak sapi bawang putih", namePh: "Marinated steak", unit: "塊", unitEn: "pcs", unitId: "potong", unitPh: "piraso", baseQuantity: 2, category: "meat", isOptional: true },
        { id: "meat-ball-fish", name: "燒烤大魚蛋", nameEn: "BBQ fish balls", nameId: "Bakso ikan bakar", namePh: "Fish balls", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "meat" },
      ],
    },
    {
      id: "seafood",
      name: "燒烤海鮮",
      nameEn: "BBQ Seafood",
      nameId: "Makanan laut bakar",
      namePh: "Pang-BBQ na Seafood",
      icon: "fish-outline",
      items: [
        { id: "seafood-prawn", name: "大虎蝦", nameEn: "Tiger prawns", nameId: "Udang windu", namePh: "Sugpo", unit: "隻", unitEn: "pcs", unitId: "ekor", unitPh: "piraso", baseQuantity: 6, category: "seafood" },
        { id: "seafood-squid", name: "醃整隻魷魚", nameEn: "Marinated whole squid", nameId: "Cumi-cumi", namePh: "Sariwang pusit", unit: "隻", unitEn: "pcs", unitId: "ekor", unitPh: "piraso", baseQuantity: 2, category: "seafood" },
      ],
    },
    {
      id: "vegetable",
      name: "燒烤蔬菜",
      nameEn: "BBQ Vegetables",
      nameId: "Sayur bakar",
      namePh: "Pang-BBQ na Gulay",
      icon: "leaf-outline",
      items: [
        { id: "veg-corn", name: "金黃粟米", nameEn: "Sweet corn", nameId: "Jagung manis", namePh: "Mais", unit: "條", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 2, category: "vegetable" },
        { id: "veg-potato", name: "錫紙包薯仔", nameEn: "Potatoes for baking", nameId: "Kentang bungkus foil", namePh: "Patatas para baking", unit: "個", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 2, category: "vegetable" },
      ],
    },
    {
      id: "sauce",
      name: "調味醬料",
      nameEn: "Sauces & Honey",
      nameId: "Saus & Madu",
      namePh: "Sarsa at Madu",
      icon: "wine-outline",
      items: [
        { id: "sauce-bbq", name: "蜜汁燒烤醬", nameEn: "BBQ basting sauce", nameId: "Saus BBQ", namePh: "Sarsa ng BBQ", unit: "支", unitEn: "bottle", unitId: "botol", unitPh: "bote", baseQuantity: 1, category: "sauce" },
        { id: "sauce-honey", name: "純正蜜糖", nameEn: "Pure honey", nameId: "Madu murni", namePh: "Madu", unit: "支", unitEn: "bottle", unitId: "botol", unitPh: "bote", baseQuantity: 1, category: "sauce" },
        { id: "sauce-oil", name: "燒烤生油", nameEn: "Cooking oil", nameId: "Minyak goreng", namePh: "Mantika", unit: "支", unitEn: "bottle", unitId: "botol", unitPh: "bote", baseQuantity: 0.5, category: "sauce" },
      ],
    },
    {
      id: "tools",
      name: "炭火/燒烤工具",
      nameEn: "BBQ Tools & Charcoal",
      nameId: "Arang & Alat bakar",
      namePh: "Uling at Kasangkapan",
      icon: "hardware-chip-outline",
      items: [
        { id: "tool-charcoal", name: "環保無煙炭", nameEn: "Smokeless charcoal", nameId: "Arang tanpa asap", namePh: "Uling", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1.5, category: "tools" },
        { id: "tool-lighter", name: "高效火種/打火機", nameEn: "Firelighters & lighter", nameId: "Penyala api & korek", namePh: "Pang-sindi at lighter", unit: "套", unitEn: "set", unitId: "set", unitPh: "set", baseQuantity: 1, category: "tools" },
        { id: "tool-foil", name: "厚錫紙", nameEn: "Heavy aluminum foil", nameId: "Aluminium foil", namePh: "Foil", unit: "卷", unitEn: "roll", unitId: "gulung", unitPh: "gulong", baseQuantity: 1, category: "tools" },
        { id: "tool-plate", name: "環保紙餐具套裝", nameEn: "Paper plates & chopsticks", nameId: "Piring kertas & sumpit", namePh: "Plato at chopstick", unit: "套", unitEn: "set", unitId: "set", unitPh: "set", baseQuantity: 1, category: "tools" },
      ],
    },
  ],
};

// ─── 節慶大盆菜 ──────────────────────────────────────────────
export const POONCHOI_TEMPLATE: ShoppingTemplate = {
  id: "template_poonchoi",
  name: "節慶大盆菜",
  nameEn: "Festive Poon Choi",
  description: "家鄉圍村盆菜，一層一層擺滿美味精華，大節必備",
  descriptionEn: "Traditional Walled Village Poon Choi Feast",
  categories: [
    {
      id: "seafood",
      name: "頂層：海鮮珍饈",
      nameEn: "Top Layer: Premium Seafood",
      nameId: "Bagian atas: Makanan laut",
      namePh: "Top Layer: Seafood",
      icon: "fish-outline",
      items: [
        { id: "pc-abalone", name: "罐頭紅燒鮑魚", nameEn: "Canned braised abalone", nameId: "Abalon kaleng", namePh: "Canned abalone", unit: "罐", unitEn: "can", unitId: "kaleng", unitPh: "lata", baseQuantity: 1, category: "seafood" },
        { id: "pc-prawn", name: "豉油皇大蝦", nameEn: "Fried king prawns", nameId: "Udang goreng kecap", namePh: "Fried prawns in soy sauce", unit: "隻", unitEn: "pcs", unitId: "ekor", unitPh: "piraso", baseQuantity: 6, category: "seafood" },
        { id: "pc-oyster", name: "蠔豉（金蠔）", nameEn: "Dried oysters", nameId: "Tiram kering", namePh: "Tuyong talaba", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 6, category: "seafood" },
      ],
    },
    {
      id: "meat",
      name: "中層：美味肉類",
      nameEn: "Middle Layer: Meats",
      nameId: "Bagian tengah: Daging",
      namePh: "Middle Layer: Karne",
      icon: "restaurant-outline",
      items: [
        { id: "pc-chicken", name: "玫瑰豉油雞件", nameEn: "Soy sauce chicken", nameId: "Ayam kecap", namePh: "Soy sauce chicken", unit: "半隻", unitEn: "half", unitId: "setengah ekor", unitPh: "kalahati", baseQuantity: 1, category: "meat" },
        { id: "pc-duck", name: "明爐明火燒鴨件", nameEn: "Roasted duck pieces", nameId: "Bebek panggang", namePh: "Roasted duck", unit: "例牌", unitEn: "plate", unitId: "porsi", unitPh: "plato", baseQuantity: 1, category: "meat" },
        { id: "pc-pork", name: "圍村燜五花腩", nameEn: "Stewed pork belly", nameId: "Daging perut babi rebus", namePh: "Nilagang liempo", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 350, category: "meat" },
        { id: "pc-roastpork", name: "脆皮燒肉件", nameEn: "Crispy roasted pork", nameId: "Babi panggang garing", namePh: "Lechon kawali", unit: "克", unitEn: "g", unitId: "g", unitPh: "g", baseQuantity: 250, category: "meat" },
      ],
    },
    {
      id: "vegetable",
      name: "底層：吸汁蔬菜/豆製品",
      nameEn: "Bottom Layer: Veg & Tofu",
      nameId: "Bagian bawah: Sayur & Tahu",
      namePh: "Bottom Layer: Gulay at Tofu",
      icon: "leaf-outline",
      items: [
        { id: "pc-turnip", name: "白蘿蔔（切厚塊）", nameEn: "White daikon radish", nameId: "Lobak putih", namePh: "Labanos", unit: "條", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 1, category: "vegetable" },
        { id: "pc-porkskin", name: "乾炸豬皮（發好）", nameEn: "Dried pork rinds", nameId: "Krupuk kulit babi", namePh: "Chicharon", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "vegetable" },
        { id: "pc-tofuskin", name: "酥炸腐竹/枝竹", nameEn: "Fried beancurd sticks", nameId: "Kembang tahu goreng", namePh: "Fried beancurd sticks", unit: "包", unitEn: "pack", unitId: "bungkus", unitPh: "pakete", baseQuantity: 1, category: "vegetable" },
        { id: "pc-taro", name: "荔浦芋頭（切厚片）", nameEn: "Taro root slices", nameId: "Irisan talas", namePh: "Gabi", unit: "個", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 0.5, category: "vegetable" },
        { id: "pc-mushroom", name: "厚花菇（燜好）", nameEn: "Dried shiitake mushrooms", nameId: "Jamur shiitake kering", namePh: "Shiitake mushroom", unit: "粒", unitEn: "pcs", unitId: "biji", unitPh: "piraso", baseQuantity: 8, category: "vegetable" },
        { id: "pc-broccoli", name: "西蘭花（點綴用）", nameEn: "Broccoli florets", nameId: "Brokoli", namePh: "Broccoli", unit: "個", unitEn: "pcs", unitId: "buah", unitPh: "piraso", baseQuantity: 1, category: "vegetable" },
      ],
    },
    {
      id: "sauce",
      name: "鮑汁調味",
      nameEn: "Abalone Sauce Basting",
      nameId: "Saus abalon",
      namePh: "Abalone sauce",
      icon: "wine-outline",
      items: [
        { id: "pc-sauce", name: "秘製特濃鮑汁/蠔油", nameEn: "Thick abalone/oyster sauce", nameId: "Saus abalon/tiram", namePh: "Abalone/oyster sauce", unit: "罐", unitEn: "can", unitId: "kaleng", unitPh: "lata", baseQuantity: 1, category: "sauce" },
      ],
    },
  ],
};

// ─── 自訂聚會模板 ──────────────────────────────────────────────
export const CUSTOM_TEMPLATE: ShoppingTemplate = {
  id: "template_custom",
  name: "自訂聚會",
  nameEn: "Custom Gathering",
  description: "完全自訂食材清單，適合任何聚會場景",
  descriptionEn: "Fully customizable shopping list for any gathering",
  categories: [
    {
      id: "meat",
      name: "肉類",
      nameEn: "Meat",
      nameId: "Daging",
      namePh: "Karne",
      icon: "restaurant-outline",
      items: [],
    },
    {
      id: "seafood",
      name: "海鮮",
      nameEn: "Seafood",
      nameId: "Makanan laut",
      namePh: "Seafood",
      icon: "fish-outline",
      items: [],
    },
    {
      id: "vegetable",
      name: "蔬菜",
      nameEn: "Vegetables",
      nameId: "Sayur-sayuran",
      namePh: "Gulay",
      icon: "leaf-outline",
      items: [],
    },
    {
      id: "staple",
      name: "主食",
      nameEn: "Staples",
      nameId: "Makanan Pokok",
      namePh: "Kanin at Noodles",
      icon: "restaurant-outline",
      items: [],
    },
    {
      id: "drink",
      name: "飲品/酒",
      nameEn: "Drinks & Alcohol",
      nameId: "Minuman & Alkohol",
      namePh: "Inumin at Alkohol",
      icon: "wine-outline",
      items: [],
    },
    {
      id: "dessert",
      name: "蛋糕",
      nameEn: "Desserts",
      nameId: "Makanan Penutup",
      namePh: "Panghimagas",
      icon: "restaurant-outline",
      items: [],
    },
    {
      id: "fruit",
      name: "水果",
      nameEn: "Fruits",
      nameId: "Buah-buahan",
      namePh: "Mga Prutas",
      icon: "rose-outline",
      items: [],
    },
    {
      id: "snack",
      name: "零食",
      nameEn: "Snacks",
      nameId: "Makanan Ringan",
      namePh: "Mga Snack",
      icon: "leaf-outline",
      items: [],
    },
    {
      id: "other",
      name: "其他",
      nameEn: "Others",
      nameId: "Lainnya",
      namePh: "Iba pa",
      icon: "ellipsis-horizontal-outline",
      items: [],
    },
  ],
};

// ─── 模板列表 ──────────────────────────────────────────────
export const SHOPPING_TEMPLATES: ShoppingTemplate[] = [HOTPOT_TEMPLATE, BBQ_TEMPLATE, CUSTOM_TEMPLATE];

/**
 * 根據人數計算食材份量
 * @param baseQuantity 基準份量（2 人份）
 * @param peopleCount 人數
 * @returns 調整後的份量
 */
export function calculateQuantityByPeople(baseQuantity: number, peopleCount: number): number {
  const ratio = peopleCount / 2;
  const adjusted = baseQuantity * ratio;
  
  if (adjusted <= 1) {
    return parseFloat(adjusted.toFixed(1));
  }
  return Math.ceil(adjusted);
}

/**
 * 將模板轉換為購物車項目
 * @param template 模板
 * @param peopleCount 人數
 * @param selectedItems 用戶選擇的食材 ID 列表
 * @param quantityOverrides 針對特定食材 ID 的手動數量微調（對應 baseQuantity 的加減）
 * @returns 購物車項目列表
 */
export function templateToShoppingItems(
  template: ShoppingTemplate,
  peopleCount: number,
  selectedItems: string[],
  quantityOverrides?: Record<string, number>
): Array<{
  name: string;
  quantity: string;
  unit: string;
  category: string;
}> {
  const items: Array<{ name: string; quantity: string; unit: string; category: string }> = [];
  
  template.categories.forEach(category => {
    category.items.forEach(item => {
      // 確保只加入被用戶剔選的項目
      if (!selectedItems.includes(item.id)) {
        return;
      }
      
      let baseQty = item.baseQuantity;
      // 支援手動微調倍率 (如果有的話)
      if (quantityOverrides && quantityOverrides[item.id] !== undefined) {
        baseQty = quantityOverrides[item.id];
      }
      
      const quantity = calculateQuantityByPeople(baseQty, peopleCount);
      items.push({
        name: item.name,
        quantity: quantity.toString(),
        unit: item.unit,
        category: category.id === "soup-base" ? "湯底" : category.id === "meat" ? "肉類" : category.id === "seafood" ? "海鮮" : category.id === "vegetable" ? "蔬菜" : category.id === "staple" ? "主食" : category.id === "sauce" ? "調味料" : category.id === "tools" ? "工具" : "其他",
      });
    });
  });
  
  return items;
}
