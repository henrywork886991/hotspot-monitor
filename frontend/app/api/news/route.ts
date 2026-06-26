import { NextRequest, NextResponse } from 'next/server';
import { queryNews } from '@/lib/db';
import { Category } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const category = (searchParams.get('category') || 'all') as Category | 'all';
  const importance = searchParams.get('importance') || 'all';
  const keyword = searchParams.get('keyword') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const hours = parseInt(searchParams.get('hours') || '72', 10);
  const readyOnly = searchParams.get('ready') === '1';

  const { items, total } = queryNews({ category, importance, keyword, page, limit, hours, readyOnly });

  return NextResponse.json({ items, total, page, limit });
}
