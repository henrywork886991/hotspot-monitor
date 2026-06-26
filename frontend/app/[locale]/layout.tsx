import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import SiteHeader from '@/components/SiteHeader';
import { LocaleProvider } from '@/components/LocaleProvider';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import { LOCALES, HTML_LANG, isLocale, type Locale } from '@/lib/i18n/config';
import { t } from '@/lib/i18n/messages';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : 'zh';
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t(l, 'site.title'), template: '%s' },
    description: t(l, 'site.description'),
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/${locale}`,
        name: SITE_NAME,
        inLanguage: HTML_LANG[locale],
        // Site search → enables the sitelinks search box markup.
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/${locale}/news?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
      },
    ],
  };

  return (
    <html lang={HTML_LANG[locale]} data-theme="dark" data-skin="primary">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <LocaleProvider locale={locale}>
          <SiteHeader />
          <main>{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
