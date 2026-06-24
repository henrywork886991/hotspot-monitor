#!/usr/bin/env bash
#
# refresh.sh — full data refresh for the news frontend.
# Collects every category (newest-published only), classifies importance,
# and backfills cover images. Safe to run on a schedule (e.g. cron).
#
#   bash scripts/refresh.sh
#
# Cron example (every 2 hours):
#   0 */2 * * * cd "/Users/han513/Dev/side project/hotspot-monitor" && bash scripts/refresh.sh >> data/refresh.log 2>&1
#
set -euo pipefail

cd "$(dirname "$0")"                 # scripts/
PY="../.venv/bin/python"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-3}"    # drop anything published older than this
DAYS="${DAYS:-2}"                    # how far back each source looks

# Load secrets (DEEPSEEK_API_KEY, …) from gitignored .env if present.
if [ -f ../.env ]; then set -a; . ../.env; set +a; fi

echo "===== refresh @ $(date '+%Y-%m-%d %H:%M:%S %Z') ====="

# Narrow categories first, broad ones (crypto) last, so each item lands in its
# most specific tab (dedup is first-write-wins by URL).
for cat in markets regulation web3 defi asia cn_crypto macro stocks tech crypto; do
  n=$("$PY" collect_trend.py --category "$cat" --days "$DAYS" 2>/dev/null \
      | "$PY" save_to_db.py --max-age-days "$MAX_AGE_DAYS" 2>/dev/null \
      | grep -oE "New: [0-9]+" || true)
  echo "  $cat -> ${n:-New: 0}"
done

"$PY" classify_importance.py 2>&1 | tail -1
# Drop small/logo cover images (real-dimension check) before filling gaps
"$PY" validate_images.py --limit 900 2>&1 | tail -1
"$PY" enrich_images.py --limit 900 2>&1 | tail -1
# Full article text for the freshest batch (article pages + SEO depth).
# No API cost (just scraping) and it's the feeder for the rewrite floor, so we
# run it wider than the AI stages to keep short-excerpt items from piling up.
"$PY" enrich_content.py --limit 280 2>&1 | tail -1

# Refresh BYDFi tradeable-coin list weekly (stable; skip if recent).
if [ ! -f ../data/bydfi_symbols.json ] || [ -n "$(find ../data/bydfi_symbols.json -mtime +6 2>/dev/null)" ]; then
  "$PY" fetch_bydfi_symbols.py 2>&1 | tail -1
fi
# Crypto Fear & Greed Index (market-sentiment widget)
"$PY" fetch_fear_greed.py 2>&1 | tail -1
# Per-coin price + 24h change (coin hub pages, article token chips) — via CoinGecko
"$PY" fetch_coin_prices.py 2>&1 | tail -1
# BYDFi 抄底指數 — our composite dip signal (uses fear_greed + news already in DB)
"$PY" compute_dip_index.py 2>&1 | tail -1
# BYDFi 逃頂指數 — our composite top/distribution signal (mirror of the dip index)
"$PY" compute_top_index.py 2>&1 | tail -1
# Full BTC daily-close history (incremental) — powers the backtest tools
"$PY" fetch_btc_history.py 2>&1 | tail -1
# AI transform (summary + keywords + tradeable coins) via DeepSeek — needs key.
if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  "$PY" enrich_ai.py --limit 320 2>&1 | tail -1
  # Rewrite the freshest articles into original, unified-language SEO/GEO content.
  # Limit sized above the typical 2h eligible-inflow (+burst headroom) so new
  # articles don't fall behind; it's capped by actual unrewritten rows anyway.
  "$PY" enrich_rewrite.py --limit 220 2>&1 | tail -1
  # English sibling: original EN article (article_md_en) from the SAME source,
  # for the /en locale. Forward+recent only (default 72h window), so it tracks the
  # live feed without back-translating the whole archive.
  "$PY" enrich_rewrite_en.py --limit 220 2>&1 | tail -1
  # Translate thin (headline-only) articles' titles so the whole feed is one language.
  "$PY" enrich_titles.py --limit 400 2>&1 | tail -1
else
  echo "  [enrich_ai] skipped (no DEEPSEEK_API_KEY)"
fi

# Generate original cover images for the freshest still-imageless articles and
# upload to Cloudinary — quality layer on top of the CSS CoverFallback. Only
# touches new articles (default last 2 days), so it never backfills the
# historical no-image rows. Needs both an image-model key and Cloudinary.
if [ -n "${IMAGE_API_KEY:-}" ] && [ -n "${CLOUDINARY_URL:-}" ]; then
  "$PY" generate_images.py --limit "${IMG_GEN_LIMIT:-40}" 2>&1 | tail -1
else
  echo "  [generate_images] skipped (need IMAGE_API_KEY + CLOUDINARY_URL)"
fi
echo "===== done ====="
