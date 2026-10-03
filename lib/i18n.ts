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

const languageMap: Record<string, string> = {
  'zh': 'zh-TW',
  'en': 'en',
  'fil': 'fil',
  'id': 'id',
};

const mapLocale = (code: string | undefined): string | null => {
  if (!code) return null;
  const base = code.toLowerCase().split('-')[0];
  return languageMap[base] || null;
};

const getDeviceLanguage = (): string => {
  // Web browsers expose a *list* of preferred languages (navigator.languages).
  // Take the first one we actually support instead of blindly trusting [0] —
  // otherwise a browser whose top language is unsupported (or a minor dialect)
  // would fall back to English even when the user also prefers Chinese.
  const locales = Localization.getLocales();
  for (const l of locales) {
    const mapped = mapLocale(l.languageCode || l.languageTag);
    if (mapped) return mapped;
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh-TW',
    fallbackLng: 'zh-TW',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

export async function initLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    const lang = stored || getDeviceLanguage();
    await i18n.changeLanguage(lang);
  } catch {
    // fall through — 'zh-TW' is already set
  }
}

export default i18n;
