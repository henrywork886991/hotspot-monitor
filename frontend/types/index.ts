export type Importance = 'urgent' | 'high' | 'medium' | 'low';

export type Category =
  | 'all'
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
