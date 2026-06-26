import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config';

// Pick a locale from Accept-Language, falling back to the default.
function getLocale(req: NextRequest): string {
  const header = req.headers.get('accept-language') || '';
  // crude but dependency-free: first matching supported language tag wins
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0].toLowerCase();
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return;

  // No locale prefix → redirect to the locale-prefixed equivalent.
  const locale = getLocale(req);
  req.nextUrl.pathname = `/${locale}${pathname === '/' ? '/news' : pathname}`;
  return NextResponse.redirect(req.nextUrl);
}

export const config = {
  // Run on everything except API, Next internals, metadata files and static assets.
  matcher: ['/((?!api|_next|sitemap.xml|robots.txt|favicon.ico|.*\\..*).*)'],
};
