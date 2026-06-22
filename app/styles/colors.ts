export const colors = {
  primary: {
    navy: '#013E77',
    copper: '#F5A823',
    cream: '#FAF8F5',
    darkGray: '#333D4B',
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
