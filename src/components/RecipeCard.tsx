import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDef } from "@/lib/category-storage";
import { getRecipeCardImageRatio } from "@/lib/recipe-card-layout";

const BRAND = "#013E77";
const { width: SW } = Dimensions.get("window");
const CARD_GAP = 10;
const CARD_WIDTH = (SW - 14 - 14 - CARD_GAP) / 2;

interface RecipeCardProps {
  item: any;
  category?: CategoryDef;
  isUser: boolean;
  isAIGenerated: boolean;
  tags: string[];
  activeTagFilters: string[];
  setActiveTagFilters: (tags: string[] | ((prev: string[]) => string[])) => void;
  setQuickPlanRecipe: (recipe: { id: string; name: string; image?: string; ingredients?: any[] } | null) => void;
  navigateToRecipe: (item: any) => void;
  /** 是否顯示快速排餐按鈕（日曆 icon）。設為 true 可重新啟用此功能。 */
  showQuickPlan?: boolean;
}

export default function RecipeCard({
  item,
  category,
  isUser,
  isAIGenerated,
  tags,
  activeTagFilters,
  setActiveTagFilters,
  setQuickPlanRecipe,
  navigateToRecipe,
  showQuickPlan = false, // 預設隱藏快速排餐按鈕
}: RecipeCardProps) {
  const { height: screenHeight } = useWindowDimensions();
  const imageRatio = getRecipeCardImageRatio(screenHeight);
  const catColor = category ? getCategoryColor(category.key) : getCategoryColor("其他");

  // Check if image is a local asset
  const getLocalImage = (recipeName: string) => {
    const nameMap: Record<string, any> = {
      '番茄炒蛋': require('@/assets/recipes/scrambled-eggs-tomatoes.png'),
      '蒜蓉炒菜心': require('@/assets/recipes/garlic-choy-sum.png'),
      '紅燒肉': require('@/assets/recipes/braised-pork-belly.png'),
      '宮保雞丁': require('@/assets/recipes/kung-pao-chicken.png'),
      '麻婆豆腐': require('@/assets/recipes/mapo-tofu.png'),
      '糖醋排骨': require('@/assets/recipes/sweet-sour-ribs.png'),
      '清蒸鱸魚': require('@/assets/recipes/steamed-sea-bass.png'),
      '豉油王炒麵': require('@/assets/recipes/soy-sauce-noodles.png'),
      '臘味煲仔飯': require('@/assets/recipes/claypot-rice.png'),
      '紅蘿蔔粟米豬骨湯': require('@/assets/recipes/carrot-corn-soup.png'),
      '回鍋肉': require('@/assets/recipes/twice-cooked-pork.png'),
      '干煸四季豆': require('@/assets/recipes/dry-fried-beans.png'),
      '蝦仁炒蛋': require('@/assets/recipes/shrimp-scrambled-eggs.png'),
      '梅菜扣肉': require('@/assets/recipes/preserved-vegetable-pork.png'),
      '薑蔥蒸雞': require('@/assets/recipes/steamed-chicken.png'),
      '魚香茄子': require('@/assets/recipes/fish-fragrant-eggplant.png'),
      '腐乳通菜': require('@/assets/recipes/fermented-water-spinach.png'),
      '鹽焗雞翼': require('@/assets/recipes/salt-baked-wings.png'),
      '蠔油冬菇炆雞': require('@/assets/recipes/braised-chicken-mushroom.png'),
      '榨菜肉絲湯米粉': require('@/assets/recipes/rice-noodle-soup.png'),
      '原味蒸肉餅': require('@/assets/recipes/原味蒸肉餅.png'),
      '咸蛋蒸肉餅': require('@/assets/recipes/咸蛋蒸肉餅.png'),
      '梅菜蒸肉餅': require('@/assets/recipes/梅菜蒸肉餅.png'),
      '魷魚絲蒸肉餅': require('@/assets/recipes/魷魚絲蒸肉餅.png'),
      '馬蹄土魷蒸肉餅': require('@/assets/recipes/馬蹄土魷蒸肉餅.png'),
      '冬菇蒸雞': require('@/assets/recipes/冬菇蒸雞.png'),
      '雲耳勝瓜蒸雞': require('@/assets/recipes/雲耳勝瓜蒸雞.png'),
      '蟲草花蒸雞': require('@/assets/recipes/蟲草花蒸雞.png'),
      '豉汁蒸排骨': require('@/assets/recipes/豉汁蒸排骨.png'),
      '南瓜蒸排骨': require('@/assets/recipes/南瓜蒸排骨.png'),
      '榨菜蒸牛肉': require('@/assets/recipes/榨菜蒸牛肉.png'),
      '陳皮蒸牛肉球': require('@/assets/recipes/陳皮蒸牛肉球.png'),
      '清蒸海上鮮': require('@/assets/recipes/清蒸海上鮮.png'),
      '豉汁蒸鯇魚': require('@/assets/recipes/豉汁蒸鯇魚.png'),
      '薑蔥蒸魚雲': require('@/assets/recipes/薑蔥蒸魚雲.png'),
      '豉汁蒸生蠔': require('@/assets/recipes/豉汁蒸生蠔.png'),
      '蒜蓉粉絲蒸生蠔': require('@/assets/recipes/蒜蓉粉絲蒸生蠔.png'),
      '蒜蓉粉絲蒸大蝦': require('@/assets/recipes/蒜蓉粉絲蒸大蝦.png'),
      '蒜蓉粉絲蒸帶子': require('@/assets/recipes/蒜蓉粉絲蒸帶子.png'),
      '蒸三色蛋': require('@/assets/recipes/蒸三色蛋.png'),
      '西芹炒雞柳': require('@/assets/recipes/西芹炒雞柳.png'),
      '西芹炒牛肉': require('@/assets/recipes/西芹炒牛肉.png'),
      '腰果炒雞丁': require('@/assets/recipes/腰果炒雞丁.png'),
      '中式牛柳': require('@/assets/recipes/中式牛柳.png'),
      '黑椒牛仔骨': require('@/assets/recipes/黑椒牛仔骨.png'),
      '豉汁炒蜆': require('@/assets/recipes/豉汁炒蜆.png'),
      '豉椒炒牛肉': require('@/assets/recipes/豉椒炒牛肉.png'),
      '豉椒苦瓜炒牛肉': require('@/assets/recipes/豉椒苦瓜炒牛肉.png'),
      '菜脯炒蛋': require('@/assets/recipes/菜脯炒蛋.png'),
      '韭黃炒蛋': require('@/assets/recipes/韭黃炒蛋.png'),
      '韭菜花炒豬頸肉': require('@/assets/recipes/韭菜花炒豬頸肉.png'),
      '蝦醬炒鮮魷': require('@/assets/recipes/蝦醬炒鮮魷.png'),
      '九層塔炒蜆': require('@/assets/recipes/九層塔炒蜆.png'),
      '炒三鮮': require('@/assets/recipes/炒三鮮.png'),
      '生炒芥蘭': require('@/assets/recipes/生炒芥蘭.png'),
      '椒絲腐乳炒通菜': require('@/assets/recipes/椒絲腐乳炒通菜.png'),
      '蔥爆牛肉': require('@/assets/recipes/蔥爆牛肉.png'),
      '金沙鹹蛋黃炒蝦仁': require('@/assets/recipes/金沙鹹蛋黃炒蝦仁.png'),
      '薑蔥炒蟹': require('@/assets/recipes/薑蔥炒蟹.png'),
      '避風塘炒蟹': require('@/assets/recipes/避風塘炒蟹.png'),
      '柱侯蘿蔔牛腩煲': require('@/assets/recipes/柱侯蘿蔔牛腩煲.png'),
      '清湯蘿蔔牛腩': require('@/assets/recipes/清湯蘿蔔牛腩.png'),
      '港式咖喱牛腩煲': require('@/assets/recipes/港式咖喱牛腩煲.png'),
      '港式咖喱雞煲': require('@/assets/recipes/港式咖喱雞煲.png'),
      '啫啫滑雞煲': require('@/assets/recipes/啫啫滑雞煲.png'),
      '三杯雞': require('@/assets/recipes/三杯雞.png'),
      '栗子炆雞': require('@/assets/recipes/栗子炆雞.png'),
      '鮑汁冬菇炆花膠': require('@/assets/recipes/鮑汁冬菇炆花膠.png'),
      '北菇炆海參': require('@/assets/recipes/北菇炆海參.png'),
      '紅燒豆腐煲': require('@/assets/recipes/紅燒豆腐煲.png'),
      '琵琶豆腐': require('@/assets/recipes/琵琶豆腐.png'),
      '鹹魚雞粒豆腐煲': require('@/assets/recipes/鹹魚雞粒豆腐煲.png'),
      '海鮮豆腐煲': require('@/assets/recipes/海鮮豆腐煲.png'),
      '南乳粗齋煲': require('@/assets/recipes/南乳粗齋煲.png'),
      '雙冬支竹羊腩煲': require('@/assets/recipes/雙冬支竹羊腩煲.png'),
      '支竹炆豬腩肉': require('@/assets/recipes/支竹炆豬腩肉.png'),
      '芋頭扣肉': require('@/assets/recipes/芋頭扣肉.png'),
      '欖菜肉碎四季豆': require('@/assets/recipes/欖菜肉碎四季豆.png'),
      '魚香茄子煲': require('@/assets/recipes/魚香茄子煲.png'),
      '鮑汁海參花菇大鴨': require('@/assets/recipes/鮑汁海參花菇大鴨.png'),
      '煎釀三寶': require('@/assets/recipes/煎釀三寶.png'),
      '香煎紅衫魚': require('@/assets/recipes/香煎紅衫魚.png'),
      '香煎黃花魚': require('@/assets/recipes/香煎黃花魚.png'),
      '香煎馬友魚': require('@/assets/recipes/香煎馬友魚.png'),
      '香煎肉餅': require('@/assets/recipes/香煎肉餅.png'),
      '香煎蓮藕餅': require('@/assets/recipes/香煎蓮藕餅.png'),
      '煎釀蓮藕夾': require('@/assets/recipes/煎釀蓮藕夾.png'),
      '香煎生薯仔餅': require('@/assets/recipes/香煎生薯仔餅.png'),
      '生煎肉餅': require('@/assets/recipes/生煎肉餅.png'),
      '香煎蛋餃': require('@/assets/recipes/香煎蛋餃.png'),
      '韭菜煎蛋角': require('@/assets/recipes/韭菜煎蛋角.png'),
      '椒鹽豬扒': require('@/assets/recipes/椒鹽豬扒.png'),
      '椒鹽九吐魚': require('@/assets/recipes/椒鹽九吐魚.png'),
      '椒鹽鮮魷': require('@/assets/recipes/椒鹽鮮魷.png'),
      '椒鹽豆腐': require('@/assets/recipes/椒鹽豆腐.png'),
      '脆皮炸大腸': require('@/assets/recipes/脆皮炸大腸.png'),
      '生炸雞翼': require('@/assets/recipes/生炸雞翼.png'),
      '南乳炸雞翼': require('@/assets/recipes/南乳炸雞翼.png'),
      '吉列豬扒': require('@/assets/recipes/吉列豬扒.png'),
      '咕嚕肉': require('@/assets/recipes/咕嚕肉.png'),
      '口水雞': require('@/assets/recipes/口水雞.png'),
      '沙薑手撕雞': require('@/assets/recipes/沙薑手撕雞.png'),
      '沙薑浸滑雞': require('@/assets/recipes/沙薑浸滑雞.png'),
      '白切雞': require('@/assets/recipes/白切雞.png'),
      '豉油雞': require('@/assets/recipes/豉油雞.png'),
      '潮州滷水拼盤': require('@/assets/recipes/潮州滷水拼盤.png'),
      '五香牛肉': require('@/assets/recipes/五香牛肉.png'),
      '花雕醉雞': require('@/assets/recipes/花雕醉雞.png'),
      '涼拌皮蛋豆腐': require('@/assets/recipes/涼拌皮蛋豆腐.png'),
      '涼拌拍青瓜': require('@/assets/recipes/涼拌拍青瓜.png'),
      '上湯浸莧菜': require('@/assets/recipes/上湯浸莧菜.png'),
      '金銀蛋浸絲瓜': require('@/assets/recipes/金銀蛋浸絲瓜.png'),
      '鮮蝦蒸水蛋': require('@/assets/recipes/鮮蝦蒸水蛋.png'),
      '魚湯勝瓜浸魚餅': require('@/assets/recipes/魚湯勝瓜浸魚餅.png'),
      '港式辣子雞': require('@/assets/recipes/港式辣子雞.png'),
      '酸甜咕嚕魚塊': require('@/assets/recipes/酸甜咕嚕魚塊.png'),
      '粟米斑塊': require('@/assets/recipes/粟米斑塊.png'),
      '賽螃蟹': require('@/assets/recipes/賽螃蟹.png'),
      '什錦炒雜菜': require('@/assets/recipes/什錦炒雜菜.png'),
      '日式親子丼': require('@/assets/recipes/日式親子丼.png'),
      '日式照燒雞': require('@/assets/recipes/日式照燒雞.png'),
      '日式咖喱豬扒飯': require('@/assets/recipes/日式咖喱豬扒飯.png'),
      '日式味噌湯': require('@/assets/recipes/日式味噌湯.png'),
      '日式大根燉五花肉': require('@/assets/recipes/日式大根燉五花肉.png'),
      '豚汁': require('@/assets/recipes/豚汁.png'),
      '日式生薑燒肉': require('@/assets/recipes/日式生薑燒肉.png'),
      '日式壽喜燒': require('@/assets/recipes/日式壽喜燒.png'),
      '天婦羅炸大蝦': require('@/assets/recipes/天婦羅炸大蝦.png'),
      '日式章魚小丸子': require('@/assets/recipes/日式章魚小丸子.png'),
      '日式玉子燒': require('@/assets/recipes/日式玉子燒.png'),
      '日式漢堡排': require('@/assets/recipes/日式漢堡排.png'),
      '韓式拌飯': require('@/assets/recipes/韓式拌飯.png'),
      '韓式泡菜豆腐湯': require('@/assets/recipes/韓式泡菜豆腐湯.png'),
      '韓式炸雞': require('@/assets/recipes/韓式炸雞.png'),
      '韓式海鮮煎餅': require('@/assets/recipes/韓式海鮮煎餅.png'),
      '韓式泡菜炒飯': require('@/assets/recipes/韓式泡菜炒飯.png'),
      '韓式人參雞湯': require('@/assets/recipes/韓式人參雞湯.png'),
      '韓式大醬湯': require('@/assets/recipes/韓式大醬湯.png'),
      '韓式炒年糕': require('@/assets/recipes/韓式炒年糕.png'),
      '韓式部隊鍋': require('@/assets/recipes/韓式部隊鍋.png'),
      '韓式烤牛肉': require('@/assets/recipes/韓式烤牛肉.png'),
      '韓式安東燉雞': require('@/assets/recipes/韓式安東燉雞.png'),
      '韓式辣豆腐湯': require('@/assets/recipes/韓式辣豆腐湯.png'),
      '泰式青咖喱雞': require('@/assets/recipes/泰式青咖喱雞.png'),
      '泰式冬蔭功湯': require('@/assets/recipes/泰式冬蔭功湯.png'),
      '越式牛肉河粉': require('@/assets/recipes/越式牛肉河粉.png'),
      '泰式炒金邊粉': require('@/assets/recipes/泰式炒金邊粉.png'),
      '印尼炒飯': require('@/assets/recipes/印尼炒飯.png'),
      '新加坡海南雞飯': require('@/assets/recipes/新加坡海南雞飯.png'),
      '泰式香葉肉碎炒飯': require('@/assets/recipes/泰式香葉肉碎炒飯.png'),
      '肉骨茶': require('@/assets/recipes/肉骨茶.png'),
      '越式春卷': require('@/assets/recipes/越式春卷.png'),
      '新加坡叻沙湯麵': require('@/assets/recipes/新加坡叻沙湯麵.png'),
      '馬來沙嗲雞肉串': require('@/assets/recipes/馬來沙嗲雞肉串.png'),
      '泰式芒果糯米飯': require('@/assets/recipes/泰式芒果糯米飯.png'),
      '粟米忌廉湯': require('@/assets/recipes/粟米忌廉湯.png'),
      '粟米蛋花湯': require('@/assets/recipes/粟米蛋花湯.png'),
      '紫菜豆腐魚蛋湯': require('@/assets/recipes/紫菜豆腐魚蛋湯.png'),
      '番茄紅衫魚': require('@/assets/recipes/番茄紅衫魚.png'),
      '蒜蓉粉絲蒸魷魚': require('@/assets/recipes/蒜蓉粉絲蒸魷魚.png'),
      '雜菜炒粉絲': require('@/assets/recipes/雜菜炒粉絲.png'),
      '揚州炒飯': require('@/assets/recipes/揚州炒飯.png'),
      '星洲炒米': require('@/assets/recipes/星洲炒米.png'),
      '乾炒牛河': require('@/assets/recipes/乾炒牛河.png'),
      '鹹魚雞粒炒飯': require('@/assets/recipes/鹹魚雞粒炒飯.png'),
      '瑤柱蛋白炒飯': require('@/assets/recipes/瑤柱蛋白炒飯.png'),
      '肉絲炒麵': require('@/assets/recipes/肉絲炒麵.png'),
      '廈門炒米': require('@/assets/recipes/廈門炒米.png'),
      '餐蛋炒飯': require('@/assets/recipes/餐蛋炒飯.png'),
      '羅漢齋炒麵': require('@/assets/recipes/羅漢齋炒麵.png'),
      '肉片炒麵': require('@/assets/recipes/肉片炒麵.png'),
      '炒雞絲烏冬': require('@/assets/recipes/炒雞絲烏冬.png'),
      '日式牛肉炒烏冬': require('@/assets/recipes/日式牛肉炒烏冬.png'),
      '意式番茄肉醬意粉': require('@/assets/recipes/意式番茄肉醬意粉.png'),
      '凱撒沙律': require('@/assets/recipes/凱撒沙律.png'),
      '奶油蘑菇湯': require('@/assets/recipes/奶油蘑菇湯.png'),
      '蒜蓉炒時蔬': require('@/assets/recipes/蒜蓉炒時蔬.png'),
      '咖哩魚蛋': require('@/assets/recipes/咖哩魚蛋.png'),
      '碗仔翅': require('@/assets/recipes/碗仔翅.png'),
      '生菜魚肉': require('@/assets/recipes/生菜魚肉.png'),
      '懷舊砵仔糕': require('@/assets/recipes/懷舊砵仔糕.png'),
      '椰汁紅豆糕': require('@/assets/recipes/椰汁紅豆糕.png'),
      '香煎蘿蔔糕': require('@/assets/recipes/香煎蘿蔔糕.png'),
      '豉汁蒸鳳爪': require('@/assets/recipes/豉汁蒸鳳爪.png'),
      '青紅蘿蔔椰子豬骨湯': require('@/assets/recipes/青紅蘿蔔椰子豬骨湯.png'),
      '粉葛赤小豆扁豆鯪魚湯': require('@/assets/recipes/粉葛赤小豆扁豆鯪魚湯.png'),
      '海底椰無花果雪梨瘦肉湯': require('@/assets/recipes/海底椰無花果雪梨瘦肉湯.png'),
      '花膠響螺片燉雞湯': require('@/assets/recipes/花膠響螺片燉雞湯.png'),
      '木瓜花生排骨湯': require('@/assets/recipes/木瓜花生排骨湯.png'),
      '五指毛桃土茯苓煲豬骨湯': require('@/assets/recipes/五指毛桃土茯苓煲豬骨湯.png'),
      '楊枝甘露': require('@/assets/recipes/楊枝甘露.png'),
      '腐竹白果雞蛋糖水': require('@/assets/recipes/腐竹白果雞蛋糖水.png'),
      '番薯薑汁糖水': require('@/assets/recipes/番薯薑汁糖水.png'),
      '生磨芝麻糊': require('@/assets/recipes/生磨芝麻糊.png'),
      '竹蔗茅根馬蹄水': require('@/assets/recipes/竹蔗茅根馬蹄水.png'),
      '生薑紅棗桂圓茶': require('@/assets/recipes/生薑紅棗桂圓茶.png'),
      '港式絲襪奶茶': require('@/assets/recipes/港式絲襪奶茶.png'),
      '日式蛋包飯': require('@/assets/recipes/日式蛋包飯.png'),
      '番茄芝士焗肉丸': require('@/assets/recipes/番茄芝士焗肉丸.png'),
      '南瓜薯仔雞肉泥': require('@/assets/recipes/南瓜薯仔雞肉泥.png'),
      '肉餅蒸蛋': require('@/assets/recipes/肉餅蒸蛋.png'),
      '芝士焗西蘭花': require('@/assets/recipes/芝士焗西蘭花.png'),
      '香脆魚柳條': require('@/assets/recipes/香脆魚柳條.png'),
      '霸王花煲豬骨湯': require('@/assets/recipes/霸王花煲豬骨湯.png'),
      '極品鮑汁花菇炆扣肉': require('@/assets/recipes/極品鮑汁花菇炆扣肉.png'),
      '當紅炸子雞': require('@/assets/recipes/當紅炸子雞.png'),
      '富貴黃金大蝦': require('@/assets/recipes/富貴黃金大蝦.png'),
      '發財好市炆豬手': require('@/assets/recipes/發財好市炆豬手.png'),
      '豉汁排骨蒸陳村粉': require('@/assets/recipes/豉汁排骨蒸陳村粉.png'),
      '蓮藕炆排骨': require('@/assets/recipes/蓮藕炆排骨.png'),
      '港式沙爹牛肉公仔麵': require('@/assets/recipes/港式沙爹牛肉公仔麵.png'),
      '花雕醉溏心蛋': require('@/assets/recipes/花雕醉溏心蛋.png'),
      '朱古力心太軟': require('@/assets/recipes/朱古力心太軟.png'),
      '日式炒烏冬': require('@/assets/recipes/日式炒烏冬.png'),
      '台式滷肉飯': require('@/assets/recipes/台式滷肉飯.png'),
      '意大利千層麵': require('@/assets/recipes/意大利千層麵.png'),
      '經典芝士漢堡': require('@/assets/recipes/經典芝士漢堡.png'),
      '意式提拉米蘇': require('@/assets/recipes/意式提拉米蘇.png'),
      '順德雙皮奶': require('@/assets/recipes/順德雙皮奶.png'),
      '港式街頭雞蛋仔': require('@/assets/recipes/港式街頭雞蛋仔.png'),
      '蒜泥白肉': require('@/assets/recipes/蒜泥白肉.png'),
      '薑蔥生蠔煲': require('@/assets/recipes/薑蔥生蠔煲.png'),
      '電飯煲香菇滑雞飯': require('@/assets/recipes/電飯煲香菇滑雞飯.png'),
      '電飯煲臘味糯米飯': require('@/assets/recipes/電飯煲臘味糯米飯.png'),
      '電飯煲台式香菇油飯': require('@/assets/recipes/電飯煲台式香菇油飯.png'),
      '電飯煲南瓜排骨燜飯': require('@/assets/recipes/電飯煲南瓜排骨燜飯.png'),
      '電飯煲意式奶油煙肉野菌燉飯': require('@/assets/recipes/電飯煲意式奶油煙肉野菌燉飯.png'),
      '電飯煲日式蒲燒鰻魚滑蛋飯': require('@/assets/recipes/電飯煲日式蒲燒鰻魚滑蛋飯.png'),
      '電飯煲台式高麗菜鹹飯': require('@/assets/recipes/電飯煲台式高麗菜鹹飯.png'),
      '電飯煲川味麻辣牛肉豆腐飯': require('@/assets/recipes/電飯煲川味麻辣牛肉豆腐飯.png'),
      '電飯煲豉油皇肥牛煲仔飯': require('@/assets/recipes/電飯煲豉油皇肥牛煲仔飯.png'),
      '電飯煲韓式春川辣炒雞拉麵': require('@/assets/recipes/電飯煲韓式春川辣炒雞拉麵.png'),
      '電飯煲豉油皇雞翼飯': require('@/assets/recipes/電飯煲豉油皇雞翼飯.png'),
      '電飯煲番茄芝士肉醬意粉': require('@/assets/recipes/電飯煲番茄芝士肉醬意粉.png'),
      '電飯煲日式鮭魚菇菌炊飯': require('@/assets/recipes/電飯煲日式鮭魚菇菌炊飯.png'),
      '電飯煲南洋風味椰漿雞肉飯': require('@/assets/recipes/電飯煲南洋風味椰漿雞肉飯.png'),
      '電飯煲廣東經典滑蛋牛肉粥': require('@/assets/recipes/電飯煲廣東經典滑蛋牛肉粥.png'),
      '電飯煲海南雞飯': require('@/assets/recipes/電飯煲海南雞飯.png'),
      '蒜香煙肉蘑菇意粉': require('@/assets/recipes/蒜香煙肉蘑菇意粉.png'),
      '焗芝士菠菜': require('@/assets/recipes/焗芝士菠菜.png'),
      '韓式水冷麵': require('@/assets/recipes/韓式水冷麵.png'),
      '經典南乳花生炆豬手': require('@/assets/recipes/經典南乳花生炆豬手.png'),
      '忌廉南瓜湯': require('@/assets/recipes/忌廉南瓜湯.png'),
      '忌廉周打蜆湯': require('@/assets/recipes/忌廉周打蜆湯.png'),
      '支竹冬菇炆牛筋腩': require('@/assets/recipes/支竹冬菇炆牛筋腩.png'),
      '勝瓜炒蝦仁': require('@/assets/recipes/勝瓜炒蝦仁.png'),
      '八寶豆腐': require('@/assets/recipes/八寶豆腐.png'),
      '肉碎豆腐煲': require('@/assets/recipes/肉碎豆腐煲.png'),
      '韓式炸醬麵': require('@/assets/recipes/韓式炸醬麵.png'),
      '泰式酸辣無骨雞爪': require('@/assets/recipes/泰式酸辣無骨雞爪.png'),
      '俄式羅宋湯': require('@/assets/recipes/俄式羅宋湯.png'),
      '豉油雞翼': require('@/assets/recipes/豉油雞翼.png'),
      '經典紅豆沙': require('@/assets/recipes/經典紅豆沙.png'),
      '忌廉蘑菇湯': require('@/assets/recipes/忌廉蘑菇湯.png'),
      '日式叉燒豬骨拉麵': require('@/assets/recipes/日式叉燒豬骨拉麵.png'),
      '西班牙海鮮鐵鍋飯': require('@/assets/recipes/西班牙海鮮鐵鍋飯.png'),
      '無水雞肉椰菜煲': require('@/assets/recipes/無水雞肉椰菜煲.png'),
      '雪菜牛肉米粉': require('@/assets/recipes/雪菜牛肉米粉.png'),
      '洋蔥炒豬肉片': require('@/assets/recipes/洋蔥炒豬肉片.png'),
      '日式茶碗蒸': require('@/assets/recipes/日式茶碗蒸.png'),
      '台式紅燒牛肉麵': require('@/assets/recipes/台式紅燒牛肉麵.png'),
      '花甲蒸水蛋': require('@/assets/recipes/花甲蒸水蛋.png'),
      '白灼蠔油生菜': require('@/assets/recipes/白灼蠔油生菜.png'),
      '白灼蠔油菜心': require('@/assets/recipes/白灼蠔油菜心.png'),
      '白灼蠔油芥蘭': require('@/assets/recipes/白灼蠔油芥蘭.png'),
      '白灼蠔油西蘭花': require('@/assets/recipes/白灼蠔油西蘭花.png'),
      '上湯枸杞浸菜心': require('@/assets/recipes/上湯枸杞浸菜心.png'),
      '匈牙利牛肉湯': require('@/assets/recipes/匈牙利牛肉湯.png'),
      '大牌檔風味薑蔥炒牛肉': require('@/assets/recipes/大牌檔風味薑蔥炒牛肉.png'),
      '海南雞飯': require('@/assets/recipes/海南雞飯.png'),
      '清蒸白切鮮魷': require('@/assets/recipes/清蒸白切鮮魷.png'),
      '港式洋蔥豬扒飯': require('@/assets/recipes/港式洋蔥豬扒飯.png'),
      '港式蔥油撈麵': require('@/assets/recipes/港式蔥油撈麵.png'),
      '焗蜜汁金沙骨': require('@/assets/recipes/焗蜜汁金沙骨.png'),
      '焗蜜糖雞翼': require('@/assets/recipes/焗蜜糖雞翼.png'),
      '生煎土魷肉餅': require('@/assets/recipes/生煎土魷肉餅.png'),
      '番茄肥牛過橋米線': require('@/assets/recipes/番茄肥牛過橋米線.png'),
      '經典榨菜肉絲米粉': require('@/assets/recipes/經典榨菜肉絲米粉.png'),
      '經典港式生炒牛肉飯': require('@/assets/recipes/經典港式生炒牛肉飯.png'),
      '花雕醉大蝦': require('@/assets/recipes/花雕醉大蝦.png'),
      '花雕醉小鮑魚': require('@/assets/recipes/花雕醉小鮑魚.png'),
      '蒜蓉豆豉蒸雞髀肉': require('@/assets/recipes/蒜蓉豆豉蒸雞髀肉.png'),
      '蒜香焗金沙骨': require('@/assets/recipes/蒜香焗金沙骨.png'),
      '蜜汁焗叉燒': require('@/assets/recipes/蜜汁焗叉燒.png'),
      '蝦仁豆腐蒸水蛋': require('@/assets/recipes/蝦仁豆腐蒸水蛋.png'),
      '避風塘炒蝦仁': require('@/assets/recipes/避風塘炒蝦仁.png'),
      '金銀蛋浸莧菜': require('@/assets/recipes/金銀蛋浸莧菜.png'),
      '電飯煲三色藜麥時蔬雞胸肉飯': require('@/assets/recipes/電飯煲三色藜麥時蔬雞胸肉飯.png'),
      '電飯煲日式咖喱雞肉燉飯': require('@/assets/recipes/電飯煲日式咖喱雞肉燉飯.png'),
      '電飯煲番茄牛肉燉飯': require('@/assets/recipes/電飯煲番茄牛肉燉飯.png'),
      '電飯煲韓式泡菜五花肉燜飯': require('@/assets/recipes/電飯煲韓式泡菜五花肉燜飯.png'),
      '香煎三文魚配檸檬牛油汁': require('@/assets/recipes/香煎三文魚配檸檬牛油汁.png'),
      '希臘檸檬雞湯': require('@/assets/recipes/希臘檸檬雞湯.png'),
      '意大利牛肝菌燉飯': require('@/assets/recipes/意大利牛肝菌燉飯.png'),
      '意大利蔬菜湯': require('@/assets/recipes/意大利蔬菜湯.png'),
      '日式五目炊飯': require('@/assets/recipes/日式五目炊飯.png'),
      '正宗意式卡邦尼意粉': require('@/assets/recipes/正宗意式卡邦尼意粉.png'),
      '法式洋蔥湯': require('@/assets/recipes/法式洋蔥湯.png'),
      '法式焦糖燉蛋': require('@/assets/recipes/法式焦糖燉蛋.png'),
      '法式白汁燉雞': require('@/assets/recipes/法式白汁燉雞.png'),
      '波蘭酸黑麥湯': require('@/assets/recipes/波蘭酸黑麥湯.png'),
      '牧羊人派': require('@/assets/recipes/牧羊人派.png'),
      '番茄大蝦意粉': require('@/assets/recipes/番茄大蝦意粉.png'),
      '番茄肉醬意粉': require('@/assets/recipes/番茄肉醬意粉.png'),
      '白汁煙肉意粉': require('@/assets/recipes/白汁煙肉意粉.png'),
      '經典瑪格麗特薄餅': require('@/assets/recipes/經典瑪格麗特薄餅.png'),
      '經典芝士焗通心粉': require('@/assets/recipes/經典芝士焗通心粉.png'),
      '經典西冷牛排': require('@/assets/recipes/經典西冷牛排.png'),
      '美式BBQ烤豬肋骨': require('@/assets/recipes/美式BBQ烤豬肋骨.png'),
      '芒果班戟': require('@/assets/recipes/芒果班戟.png'),
      '芒果西米露': require('@/assets/recipes/芒果西米露.png'),
      '英式下午茶鬆餅': require('@/assets/recipes/英式下午茶鬆餅.png'),
      '蒜香橄欖油大蝦意粉': require('@/assets/recipes/蒜香橄欖油大蝦意粉.png'),
      '薑汁撞奶': require('@/assets/recipes/薑汁撞奶.png'),
      '西式番茄濃湯': require('@/assets/recipes/西式番茄濃湯.png'),
      '西式香草檸檬焗雞': require('@/assets/recipes/西式香草檸檬焗雞.png'),
    };
    const exactMatch = nameMap[recipeName];
    if (exactMatch) return exactMatch;

    const cleanName = recipeName
      .replace(/^(港式|日式|韓式|泰式|西式|意式|台式|電飯煲|經典|正宗|傳統|風味|大牌檔風味)/g, '')
      .replace(/\s*\([^)]+\)\s*$/g, '');
    return nameMap[cleanName];
  };

  const localImage = getLocalImage(item.name);
  const imageUrl = item.thumbnailUrl || item.image;
  const hasImage = localImage || imageUrl;

  // Track image load error to fall back to placeholder
  const [hasImageError, setHasImageError] = React.useState(false);

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => navigateToRecipe(item)} activeOpacity={0.85}>
        {/* ── Image / Placeholder ── */}
        {hasImage && !hasImageError
            ? localImage
              ? <Image source={localImage} style={[s.cardImg, { height: CARD_WIDTH * imageRatio }]} resizeMode="cover" />
            : <Image source={{ uri: imageUrl }} style={[s.cardImg, { height: CARD_WIDTH * imageRatio }]} resizeMode="cover" onError={() => setHasImageError(true)} />
          : (
            <View style={[s.cardImg, { height: CARD_WIDTH * imageRatio }, s.cardImgPH, { backgroundColor: catColor.bg }]}>
              <View style={s.placeholderContent}>
                <Text style={s.placeholderEmoji}>{category?.emoji || "🍽️"}</Text>
                <View style={s.placeholderTitleBox}>
                  <Text style={s.placeholderTitle} numberOfLines={2}>{item.name}</Text>
                </View>
              </View>
            </View>
          )
        }
        
        {/* ─ Badges ── */}
        <View style={s.cardBadges}>
          {isUser && (
            <View style={s.sourceBadge}>
              <Text style={s.sourceBadgeTxt}>我的</Text>
            </View>
          )}
          {isAIGenerated && (
            <View style={s.aiBadgeCorner}>
              <Text style={s.aiBadgeCornerTxt}>AI</Text>
            </View>
          )}
          {(item.popularity ?? 0) > 80 && (
            <View style={s.hotBadge}>
              <Text style={s.hotBadgeTxt}>🔥 熱門</Text>
            </View>
          )}
        </View>
        
        {/* ── Quick Plan Button ── 暫時隱藏（2026-08-09）：保留代碼方便將來重新啟用 */}
        {showQuickPlan && (
          <TouchableOpacity
            style={s.cardPlanBtn}
            onPress={(e) => {
              e.stopPropagation();
              setQuickPlanRecipe({ id: item.id, name: item.name, image: item.thumbnailUrl || item.image, ingredients: item.ingredients });
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* ── Card Info ── */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
        {item.nameEn ? <Text style={s.cardNameEn} numberOfLines={1}>{item.nameEn}</Text> : null}
        
        <View style={s.cardMeta}>
          {item.cookTime ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={s.cardMetaTxt}>{item.cookTime}分</Text>
            </View>
          ) : null}
          {item.difficulty ? (
            <View style={s.cardMetaItem}>
              <Ionicons name="flame-outline" size={12} color="#9CA3AF" />
              <Text style={s.cardMetaTxt}>{item.difficulty}</Text>
            </View>
          ) : null}
          {category?.emoji && (
            <View style={s.cardMetaItem}>
              <Text style={{ fontSize: 12 }}>{category.emoji}</Text>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <View style={s.cardTags}>
            {tags.slice(0, 2).map((tag) => {
              const isActive = activeTagFilters.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[s.cardTag, isActive && s.cardTagActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveTagFilters(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    );
                  }}
                >
                  <Text style={[s.cardTagTxt, isActive && s.cardTagTxtActive]}>#{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "中菜": { bg: "#FFF1F0", text: "#B91C1C" },
  "西餐": { bg: "#EFF6FF", text: "#1D4ED8" },
  "日式": { bg: "#FFF0F6", text: "#BE185D" },
  "韓式": { bg: "#FFF7ED", text: "#C2410C" },
  "東南亞": { bg: "#F0FDF4", text: "#15803D" },
  "甜品": { bg: "#FEFCE8", text: "#A16207" },
  "飲品": { bg: "#F5F3FF", text: "#7C3AED" },
  "其他": { bg: "#F3F4F6", text: "#4B5563" },
};

const getCategoryColor = (key?: string) => CATEGORY_COLORS[key || "其他"] || CATEGORY_COLORS["其他"];

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  cardImg: {
    width: "100%",
    backgroundColor: "#F5F5F5",
  },
  cardImgPH: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: {
    fontSize: 42,
    opacity: 0.8,
  },
  placeholderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  placeholderTitleBox: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    maxWidth: "92%",
  },
  cardBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 6,
  },
  sourceBadge: {
    backgroundColor: "rgba(1, 62, 119, 0.9)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sourceBadgeTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  aiBadgeCorner: {
    backgroundColor: "rgba(1, 62, 119, 0.9)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  aiBadgeCornerTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  hotBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.95)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  hotBadgeTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  cardPlanBtn: { 
    position: "absolute", 
    bottom: 8, 
    right: 8, 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: "rgba(1, 62, 119, 0.9)", 
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cardInfo: { padding: 12 },
  cardName: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#1A1A1A", 
    lineHeight: 20, 
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  aiBadge: { 
    backgroundColor: BRAND, 
    borderRadius: 6, 
    paddingHorizontal: 6, 
    paddingVertical: 2,
    marginLeft: 4,
  },
  aiBadgeTxt: { 
    fontSize: 9, 
    fontWeight: "800", 
    color: "#fff",
    letterSpacing: 0.5,
  },
  cardNameEn: { 
    fontSize: 11, 
    color: "#9CA3AF", 
    marginBottom: 6, 
    lineHeight: 16,
    fontStyle: "italic",
  },
  cardMeta: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 6,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardMetaTxt: { 
    fontSize: 11, 
    color: "#6B7280",
    fontWeight: "500",
  },
  cardTags: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 4,
    marginTop: 4,
  },
  cardTag: { 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 99, 
    backgroundColor: "#EEF4FB", 
    borderWidth: 1, 
    borderColor: "#C5D9F0",
  },
  cardTagActive: { 
    backgroundColor: BRAND, 
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTagTxt: { 
    fontSize: 10, 
    color: BRAND, 
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardTagTxtActive: { 
    color: "#fff",
    letterSpacing: 0.3,
  },
});
