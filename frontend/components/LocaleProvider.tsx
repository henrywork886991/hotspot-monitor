'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Make the active route locale available to all client components. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Read the current locale inside any client component. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
