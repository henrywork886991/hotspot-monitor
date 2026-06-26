export type Importance = 'urgent' | 'high' | 'medium' | 'low';

export type Category =
  | 'all'
  | 'altcoin'
  | 'crypto'
  | 'defi'
  | 'web3'
  | 'cn_crypto'
  | 'asia'
  | 'stocks'
  | 'macro'
  | 'regulation'
  | 'tech'
  | 'markets';

export interface NewsItem {
  id: number;
  title: string;
  content: string | null;
  fulltext: string | null;
  url: string;
  source: string;
  source_type: string | null;
  category: Category;
  published_at: string | null;
  image_url: string | null;
  importance: Importance | null;
  summary: string | null;
  keywords: string | null;
  symbols: string | null;
  article_md: string | null;
  article_title: string | null;
  article_score: number | null;
  article_words: number | null;
  article_md_en: string | null;
  article_title_en: string | null;
  article_score_en: number | null;
  article_words_en: number | null;
  summary_zh: string | null;
  relevance: number | null;
  is_real: number | null;
  fetched_at: string;
}

export interface CategoryMeta {
  key: Category;
  label: string;
  labelEn: string;
  count: number;
}

export interface NewsResponse {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
}
