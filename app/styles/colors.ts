export const colors = {
  primary: {
    navy: '#183B56',
    copper: '#F47B3A',
    cream: '#FFF8EF',
    darkGray: '#333D4B',
  },

  brand: {
    headerNavy: '#183B56',
    navy: '#183B56',
    warmOrange: '#F47B3A',
    cream: '#FFF8EF',
    heroText: '#FFFFFF',
    heroSub: 'rgba(255,255,255,0.92)',
  },

  neutral: {
    white: '#FFFFFF',
    lightGray: '#F5F5F5',
    mediumGray: '#999999',
    darkGray: '#666666',
  },

  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
};

export type ColorKey = keyof typeof colors;
export default function Colors() { return null; }

export const canva = {
  bg: "#FFF8EF",
  surface: "#FFFFFF",
  banner: "#F3D7B3",
  apricot: "#F3D7B3",
  brown: "#8A4B2A",
  primary: "#183B56",
  accent: "#F47B3A",
  action: "#F37021", // Hermès orange — CTA 底；配 textOnAccent #10293D = 5.08:1（WCAG AA）
  muted: "#5F6F80",
  border: "#E6DED4",
  softBlue: "#E8F0F4",
  green: "#789B78",
  greenText: "#4F6F4F",
  danger: "#B4231A",
  textOnAccent: "#10293D", // 壓 #F37021 5.08:1；唔准用 #183B56（只有 3.98）
};
