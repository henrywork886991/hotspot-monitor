#!/usr/bin/env python3
"""
collect_keyword.py — Search a specific keyword across multiple sources.
Outputs a JSON array to stdout. Pipe into save_to_db.py to persist.

Usage:
  python collect_keyword.py "Bitcoin ETF"
  python collect_keyword.py "Claude Sonnet" --days 7
  python collect_keyword.py "OpenAI" | python save_to_db.py
"""

import sys
import os
import json
import argparse
import requests
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor


def search_hackernews(keyword: str, days: int) -> list[dict]:
    """Algolia API — free, no key needed."""
    since_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    try:
        resp = requests.get(
            "https://hn.algolia.com/api/v1/search",
            params={"query": keyword, "tags": "story", "hitsPerPage": 20,
                    "numericFilters": f"created_at_i>{since_ts}"},
            timeout=10,
        )
        resp.raise_for_status()
        return [
            {"title": h.get("title", ""),
             "content": f"Points: {h.get('points', 0)} | Comments: {h.get('num_comments', 0)}",
             "url": h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
             "source": "hackernews", "source_type": "api",
             "published_at": h.get("created_at", "")}
            for h in resp.json().get("hits", []) if h.get("title")
        ]
    except Exception as e:
        print(f"[hackernews] ERROR: {e}", file=sys.stderr)
        return []


def search_reddit(keyword: str, days: int) -> list[dict]:
    """Public Reddit JSON API — no key needed."""
    time_filter = "week" if days <= 7 else "month"
    try:
        resp = requests.get(
            "https://www.reddit.com/search.json",
            params={"q": keyword, "sort": "relevance", "t": time_filter, "limit": 25},
            headers={"User-Agent": "hotspot-monitor/1.0"},
            timeout=10,
        )
        resp.raise_for_status()
        return [
            {"title": p["data"].get("title", ""),
             "content": (p["data"].get("selftext", "") or "")[:400]
                        or f"Score: {p['data'].get('score', 0)} | Comments: {p['data'].get('num_comments', 0)}",
             "url": f"https://reddit.com{p['data'].get('permalink', '')}",
             "source": "reddit", "source_type": "api",
             "published_at": datetime.fromtimestamp(
                 p["data"].get("created_utc", 0), tz=timezone.utc).isoformat()}
            for p in resp.json().get("data", {}).get("children", [])
            if p["data"].get("title")
        ]
    except Exception as e:
        print(f"[reddit] ERROR: {e}", file=sys.stderr)
        return []


def search_exa(keyword: str, days: int, category: str, exa_key: str,
               limit: int = 15) -> list[dict]:
    """Exa neural search — requires EXA_API_KEY. Covers news, tweets, web."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload: dict = {
        "query": keyword, "numResults": limit,
        "startPublishedDate": since,
        "contents": {"text": {"maxCharacters": 600}},
    }
    if category in ("news", "tweet"):
        payload["category"] = category
    src = category if category in ("news", "tweet") else "web"
    try:
        resp = requests.post(
            "https://api.exa.ai/search",
            json=payload,
            headers={"x-api-key": exa_key, "Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        return [
            {"title": r.get("title", ""),
             "content": (r.get("text") or "")[:600],
             "url": r.get("url", ""), "source": f"exa_{src}", "source_type": "api",
             "published_at": r.get("publishedDate", "")}
            for r in resp.json().get("results", []) if r.get("url")
        ]
    except Exception as e:
        print(f"[exa/{category}] ERROR: {e}", file=sys.stderr)
        return []


def collect_keyword(keyword: str, days: int) -> list[dict]:
    exa_key = os.environ.get("EXA_API_KEY")

    jobs: dict = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs["hackernews"] = pool.submit(search_hackernews, keyword, days)
        jobs["reddit"]     = pool.submit(search_reddit,     keyword, days)
        if exa_key:
            jobs["exa_news"]  = pool.submit(search_exa, keyword, days, "news",  exa_key, 15)
            jobs["exa_tweet"] = pool.submit(search_exa, keyword, days, "tweet", exa_key, 15)
        else:
            print("[exa] SKIP: set EXA_API_KEY for news/tweet search", file=sys.stderr)

        all_items: list[dict] = []
        for name, future in jobs.items():
            try:
                items = future.result()
                print(f"  [{name}] {len(items)}", file=sys.stderr)
                all_items.extend(items)
            except Exception as e:
                print(f"  [{name}] ERROR: {e}", file=sys.stderr)

    seen, unique = set(), []
    for item in all_items:
        if item["url"] and item["url"] not in seen:
            seen.add(item["url"])
            unique.append(item)
    return unique


def main():
    p = argparse.ArgumentParser(description="Search a keyword across multiple sources")
    p.add_argument("keyword", help="Keyword to search")
    p.add_argument("--days", type=int, default=7, help="Days to look back (default: 7)")
    p.add_argument("--pretty", action="store_true")
    args = p.parse_args()

    print(f'Searching "{args.keyword}" (last {args.days}d)...', file=sys.stderr)
    results = collect_keyword(args.keyword, args.days)
    print(f"Total: {len(results)} unique items", file=sys.stderr)

    indent = 2 if args.pretty else None
    print(json.dumps(results, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    main()
