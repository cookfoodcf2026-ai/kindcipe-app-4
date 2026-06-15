import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// 導入翻譯檔案（暫時為空）
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';
import fil from '../locales/fil.json';
import id from '../locales/id.json';

// 資源配置
const resources = {
  'zh-TW': { translation: zhTW },
  'en': { translation: en },
  'fil': { translation: fil },
  'id': { translation: id },
};

// 取得手機語言
const getDeviceLanguage = (): string => {
  const locale = Localization.getLocales()[0]?.languageCode || 'en';
  
  // 語言代碼對應
  const languageMap: Record<string, string> = {
    'zh': 'zh-TW',
    'en': 'en',
    'fil': 'fil',
    'id': 'id',
  };
  
  return languageMap[locale] || 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v3',
  });

export default i18n;
