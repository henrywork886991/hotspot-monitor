import { SITE_URL } from '@/lib/site';
import { LOCALES, HTML_LANG, DEFAULT_LOCALE, type Locale } from './config';

/**
 * Next.js `alternates` block for a page: a self-referencing canonical plus
 * hreflang links to every locale + x-default. Pass the locale-less path
 * (e.g. "/news/crypto") and the current locale.
 */
export function altLanguages(pathNoLocale: string, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[HTML_LANG[l]] = `${SITE_URL}/${l}${pathNoLocale}`;
  languages['x-default'] = `${SITE_URL}/${DEFAULT_LOCALE}${pathNoLocale}`;
  return { canonical: `${SITE_URL}/${locale}${pathNoLocale}`, languages };
}
