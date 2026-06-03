export const locales = ['en', 'zh'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';
export const languageCookieName = 'qwen_ui_locale';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'zh';
}
