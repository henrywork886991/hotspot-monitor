/* Locale config — single source of truth for supported languages + routing. */

export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

/** BCP-47 tag for <html lang> / hreflang / Intl formatting. */
export const HTML_LANG: Record<Locale, string> = { zh: 'zh-Hant', en: 'en' };
/** Intl date/number locale. */
export const INTL_LOCALE: Record<Locale, string> = { zh: 'zh-TW', en: 'en-US' };
