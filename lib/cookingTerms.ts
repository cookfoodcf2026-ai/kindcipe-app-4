export type CookingTerm = {
  zh: string;
  en: string;
  fil: string;
  id: string;
};

export const COOKING_TERMS: Record<string, CookingTerm> = {
  "飛水": { zh: "將食材放入滾水中短暫煮 1-2 分鐘，去除血水和腥味，撈起備用", en: "Blanching", fil: "Blanching", id: "Blansir" },
  "汆水": { zh: "將食材放入滾水中短暫煮 1-2 分鐘，去除血水和腥味，撈起備用", en: "Blanching", fil: "Blanching", id: "Blansir" },
  "焯水": { zh: "將蔬菜放入滾水快速燙熟，保持脆嫩色澤，再放入冰水降溫", en: "Blanch / Parboil", fil: "Pakuluan saglit", id: "Rebus sebentar" },
  "過冷河": { zh: "將燙好的食材立即放入冰水或凍開水中降溫，令口感更爽脆", en: "Ice bath / Shock", fil: "Isawsaw sa malamig na tubig", id: "Rendam air es" },
  "爆香": { zh: "用中小火爆香辛香料（蒜、薑、蔥等），使其香氣釋出", en: "Sauté aromatics", fil: "Pagprito ng pampalasa", id: "Menumis bumbu" },
  "走油": { zh: "將食材先以高溫油炸或煎至表面金黃，鎖住肉汁", en: "Flash-fry", fil: "Pagprito ng mabilis", id: "Menggoreng cepat" },
  "勾芡": { zh: "用粟粉水攪拌煮至微稠，使醬汁掛在食材上", en: "Thickening", fil: "Pagsasawikaw", id: "Mengentalkan kuah" },
  "燜": { zh: "加蓋用中小火慢煮，使食材軟腍入味", en: "Braise / Stew", fil: "Nilaga", id: "Rebus perlahan" },
  "炆": { zh: "類似燜，但火力更低、時間更長，粵菜常用", en: "Slow-braise", fil: "Mabagal na luto", id: "Rebus lambat" },
  "煨": { zh: "用微火長時間加熱，使湯汁收乾、味道濃縮", en: "Simmer", fil: "Kumulo nang matagal", id: "Didihkan perlahan" },
  "收汁": { zh: "開大火不加蓋，讓湯汁蒸發變濃稠", en: "Reduce", fil: "Pakuluin hanggang lumapot", id: "Kurangi kuah" },
  "醃製": { zh: "用調味料拌勻食材，放置一段時間讓其入味", en: "Marinate", fil: "Pag-aatsara", id: "Marinasi" },
  "切絲": { zh: "將食材切成細長條狀", en: "Julienne / Shred", fil: "Hiwain nang pahaba", id: "Potong korek api" },
  "切粒": { zh: "將食材切成小正方塊", en: "Dice", fil: "Hiwain nang maliit na cube", id: "Potong dadu" },
  "切片": { zh: "將食材切成薄片", en: "Slice", fil: "Hiwain nang manipis", id: "Iris tipis" },
  "滾刀塊": { zh: "邊滾動食材邊切塊，切成不規則多面體，常用於根莖類", en: "Roll cut", fil: "Hiwain nang pahaba-haba", id: "Potong serong" },
  "切蔥花": { zh: "將蔥切成幼小圓環狀", en: "Slice scallions", fil: "Tadtarin ang sibuyas", id: "Iris daun bawang" },
  "拍扁": { zh: "用刀背拍打食材使其扁平", en: "Smash / Flatten", fil: "Duruin", id: "Memarkan" },
  "剁碎": { zh: "將食材反覆切至碎末狀", en: "Mince / Chop fine", fil: "Tadtarin nang pino", id: "Cincang halus" },
  "去腥": { zh: "用薑、蔥、酒、胡椒粉等方法去除食材的腥味", en: "Remove odor", fil: "Alisin ang lansa", id: "Hilangkan bau amis" },
  "解凍": { zh: "將冷凍食材放在室溫或冷藏中自然退冰", en: "Thaw / Defrost", fil: "I-defrost", id: "Mencairkan" },
  "出水": { zh: "將食材放入滾水中煮一下去除青澀味", en: "Blanch / Parboil", fil: "Pakuluan saglit", id: "Rebus sebentar" },
  "蒸": { zh: "利用水蒸氣加熱食物，保留原汁原味", en: "Steam", fil: "Steam", id: "Kukus" },
  "煎": { zh: "用少量油在平底鍋中以中火加熱至表面金黃", en: "Pan-fry", fil: "Iprito", id: "Goreng dadar" },
  "炸": { zh: "用大量油以高溫將食物浸沒油炸至酥脆", en: "Deep-fry", fil: "Prituhin nang malalim", id: "Goreng rendam" },
  "炒": { zh: "用少量油在高溫下快速翻動食材", en: "Stir-fry", fil: "Gisa", id: "Tumis" },
};

export const COOKING_TERM_LIST = Object.keys(COOKING_TERMS).sort((a, b) => b.length - a.length);
