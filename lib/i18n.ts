import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';
import fil from '../locales/fil.json';
import id from '../locales/id.json';

const LANG_STORAGE_KEY = 'kindcipe_language';

const resources = {
  'zh-TW': { translation: zhTW },
  'en': { translation: en },
  'fil': { translation: fil },
  'id': { translation: id },
};

const getDeviceLanguage = (): string => {
  const locale = Localization.getLocales()[0]?.languageCode || 'en';
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
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

export async function initLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    const lang = stored || getDeviceLanguage();
    if (lang && lang !== 'en') {
      await i18n.changeLanguage(lang);
    }
  } catch {
    // fall through — 'en' is already set
  }
}

export default i18n;
