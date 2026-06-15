/**
 * 和諧食譜 Kindcipe — 品牌設計系統 v2
 * 深海藍 #013E77 + 暖金槽 #F5A823 + 湖水綠 #00BBA9 + 珊瑚紅 #FF6B6B + 米白 #FAFAF8
 * 字體：思源黑體 / Noto Sans TC
 * 標語：自己的食譜筆記・一家人的味道
 */

export const Colors = {
  // 主色 — 深海藍
  primary: '#013E77',
  primaryLight: '#1A5A9A',
  primaryDark: '#002855',
  primaryMuted: 'rgba(1, 62, 119, 0.08)',

  // 強調色 — 暖金槽
  copper: '#F5A823',
  copperLight: '#FFBE4D',
  copperDark: '#D48C10',
  copperMuted: 'rgba(245, 168, 35, 0.12)',

  // 輔助色 — 湖水綠
  teal: '#00BBA9',
  tealLight: '#33CFC0',
  tealDark: '#009688',
  tealMuted: 'rgba(0, 187, 169, 0.12)',

  // 提醒色 — 珊瑚紅
  coral: '#FF6B6B',
  coralLight: '#FF9090',
  coralDark: '#E04545',
  coralMuted: 'rgba(255, 107, 107, 0.12)',

  // 背景 — 米白
  background: '#FAFAF8',
  backgroundCard: '#FFFFFF',
  backgroundSection: '#F0EDE8',
  ivory: '#FAFAF8',
  ivoryDark: '#F0EDE8',
  white: '#FFFFFF',

  // 文字
  textPrimary: '#333D4B',
  textSecondary: '#8A94A6',
  textTertiary: '#B0BAC9',
  textWhite: '#FFFFFF',
  textBlue: '#013E77',

  // 狀態色
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F5A823',
  danger: '#FF6B6B',
  info: '#00BBA9',

  // 邊框
  border: '#EBEBEB',
  borderLight: '#F5F5F5',

  // Tab Bar
  tabActive: '#013E77',
  tabInactive: '#B0BAC9',
  tabBackground: '#FFFFFF',

  // 舊版相容
  accent: '#F5A823',
  accentLight: 'rgba(245, 168, 35, 0.12)',
  backgroundGray: '#FAFAF8',
};

export const Typography = {
  // 字體族
  fontEn: 'System',
  fontZh: 'System',

  // 字號
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 19,
  xl: 22,
  xxl: 26,
  xxxl: 32,

  // 字重
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const Brand = {
  name: '和諧食譜',
  nameEn: 'Kindcipe',
  tagline: '自己的食譜筆記・一家人的味道',
  taglineEn: 'Your Family Recipe Journal',
};

// 食物佔位圖（按類別）
export const FoodPlaceholders: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  chicken: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80',
  fish: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80',
  pork: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&q=80',
  vegetable: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
  rice: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&q=80',
  noodle: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&q=80',
};

// 超市顏色
export const SupermarketColors: Record<string, string> = {
  wellcome: '#E31837',
  parknshop: '#00843D',
  hktvmall: '#FF6600',
};
