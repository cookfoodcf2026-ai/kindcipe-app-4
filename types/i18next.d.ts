import "i18next";
import type en from "../locales/en.json";

// Compile-time i18n key checking: t("home.title") is valid, t("typo") is a type error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}
