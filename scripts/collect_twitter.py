#!/usr/bin/env python3
"""
collect_twitter.py — Collect tweets from your Twitter/X Following timeline.
Uses Playwright browser automation. No API key needed — uses your login session.

First-time setup (one-time per machine):
  python collect_twitter.py --login
  → Browser opens, log in to Twitter, then close the window. Done.

Normal usage:
  python collect_twitter.py                     # collect + save
  python collect_twitter.py --scrolls 50        # quick run (50 scrolls)
  python collect_twitter.py --fresh 4           # skip if data < 4h old
  python collect_twitter.py --headless          # silent, no browser window

Install:
  pip install playwright
  python -m playwright install chromium
"""

import sys
import os
import re
import json
import time
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: Playwright not installed.", file=sys.stderr)
    print("  pip install playwright && python -m playwright install chromium", file=sys.stderr)
    sys.exit(1)

SKILL_ROOT  = Path(__file__).parent.parent
PROFILE_DIR = SKILL_ROOT / "data" / "browser-profile"
TWEETS_DIR  = SKILL_ROOT / "data" / "twitter"

# ── Browser management ────────────────────────────────────────────────────────

def cleanup_stale_browser(profile_dir: Path) -> None:
    """Kill leftover Chromium processes + remove stale SingletonLock files.
    On macOS, closing a browser window does NOT quit the process — the lock
    file remains and blocks the next launch. This runs before every launch."""
    try:
        subprocess.run(["pkill", "-f", "Google Chrome for Testing"],
                       capture_output=True)
        time.sleep(0.8)
    except Exception:
        pass
    for name in ["SingletonLock", "SingletonCookie", "SingletonSocket", "RunningChromeVersion"]:
        try:
            (profile_dir / name).unlink()
        except FileNotFoundError:
            pass


def _launch(playwright, profile_dir: Path, headless: bool):
    cleanup_stale_browser(profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)
    return playwright.chromium.launch_persistent_context(
        str(profile_dir),
        headless=headless,
        viewport={"width": 1280, "height": 800},
        ignore_default_args=["--enable-automation"],
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
        ],
    )


# ── Login ─────────────────────────────────────────────────────────────────────

def is_logged_in(profile_dir: Path) -> bool:
    """Check if the profile directory has a saved Twitter session."""
    return (profile_dir / "Default" / "Cookies").exists()


def run_login(profile_dir: Path) -> None:
    """Open browser, wait for user to log in, then save session."""
    print("=" * 55)
    print("  Twitter Login Setup")
    print("=" * 55)
    print()
    print("1. A browser window will open.")
    print("2. Log in to your Twitter/X account.")
    print("3. Once logged in (you see your timeline), close the window.")
    print("4. Your session is saved — no need to log in again.")
    print()

    with sync_playwright() as p:
        ctx = _launch(p, profile_dir, headless=False)
        page = ctx.new_page()
        page.goto("https://twitter.com/login", wait_until="domcontentloaded")

        # Wait for user to reach the home timeline (logged in)
        print("Waiting for login... (up to 10 minutes)")
        try:
            page.wait_for_url(re.compile(r"twitter\.com/home|x\.com/home"), timeout=600_000)
            print()
            print("✅ Login detected! Session saved.")
            print("   You can close the browser window now.")
            page.wait_for_timeout(4000)
        except Exception:
            print("Login window closed — session may or may not be saved.")

        ctx.close()

    cleanup_stale_browser(profile_dir)
    print()
    print("Setup complete. Run without --login to collect tweets.")


# ── Tweet extraction JS (ported from twitter-buddy's collect-timeline.js) ─────

_SCAN_JS = r"""
(() => {
  if (!window._tweetMap) window._tweetMap = new Map();
  document.querySelectorAll('[data-testid="tweet"]').forEach(t => {
    const userEl    = t.querySelector('[data-testid="User-Name"]');
    const user      = userEl ? userEl.innerText.split('\n').slice(0, 2).join(' ') : '';
    const timeEl    = t.querySelector('time');
    const time      = timeEl ? timeEl.getAttribute('datetime') : '';
    const text      = t.querySelector('[data-testid="tweetText"]')?.innerText || '';
    const link      = t.querySelector('a[href*="/status/"]')?.href || '';
    const socialCtx = t.closest('[data-testid="cellInnerDiv"]')
                       ?.querySelector('[data-testid="socialContext"]');
    const isRT      = socialCtx ? /retweet|转推|已转帖/i.test(socialCtx.innerText) : false;

    // Skip retweets — lower signal
    if (isRT || !time || !link) return;

    const key = time + '|' + link;
    if (!window._tweetMap.has(key)) {
      window._tweetMap.set(key, { user, time, text, link, type: 'tweet' });
    }
  });
  return {
    total: window._tweetMap.size,
    tweets: Array.from(window._tweetMap.values())
                 .sort((a, b) => b.time.localeCompare(a.time))
  };
})()
"""


# ── Collection ────────────────────────────────────────────────────────────────

def collect_tweets(profile_dir: Path, max_scrolls: int = 150,
                   output_dir: Path = TWEETS_DIR,
                   headless: bool = False) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Launching browser (max_scrolls={max_scrolls}, headless={headless})...")

    with sync_playwright() as p:
        ctx = _launch(p, profile_dir, headless=headless)
        page = ctx.new_page()

        # Suppress browser console noise
        page.on("console", lambda _: None)

        page.goto("https://twitter.com/home", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # Redirect to login = session expired
        if re.search(r"/login|/i/flow", page.url):
            ctx.close()
            cleanup_stale_browser(profile_dir)
            print("ERROR: Session expired. Re-run: python collect_twitter.py --login", file=sys.stderr)
            return []

        # Switch to "Following" tab for chronological order
        try:
            tabs = page.locator('[role="tab"]')
            for i in range(tabs.count()):
                if "following" in (tabs.nth(i).inner_text() or "").lower():
                    tabs.nth(i).click()
                    page.wait_for_timeout(2000)
                    break
        except Exception:
            pass  # stay on default timeline if tab not found

        # Scroll and collect
        stale_checks = 0
        prev_count   = 0
        burst_size   = 5  # scrolls before pausing

        for i in range(max_scrolls):
            page.evaluate("window.scrollBy(0, 700)")
            page.wait_for_timeout(400)

            # Pause every burst to mimic human reading
            if i % burst_size == burst_size - 1:
                page.wait_for_timeout(1500)

            # Status check every 20 scrolls
            if i % 20 == 19:
                result = page.evaluate(_SCAN_JS)
                count  = result.get("total", 0)
                print(f"  scroll {i+1}/{max_scrolls} — {count} tweets collected", end="\r")

                if count == prev_count:
                    stale_checks += 1
                    if stale_checks >= 3:
                        print(f"\n  Stale feed — stopping early at scroll {i+1}")
                        break
                else:
                    stale_checks = 0
                prev_count = count

        final = page.evaluate(_SCAN_JS)
        tweets = final.get("tweets", [])
        print(f"\n  Done: {len(tweets)} tweets")
        ctx.close()

    cleanup_stale_browser(profile_dir)

    if not tweets:
        return []

    # Save to daily file (same format as twitter-buddy for compatibility)
    today    = datetime.now().strftime("%Y-%m-%d")
    out_file = output_dir / f"tweets_{today}.json"

    existing: list[dict] = []
    if out_file.exists():
        try:
            with open(out_file, encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    existing_links = {t.get("link") for t in existing}
    new_tweets     = [t for t in tweets if t.get("link") not in existing_links]
    merged         = existing + new_tweets

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False)

    print(f"  Saved → {out_file.name}  ({len(new_tweets)} new, {len(merged)} total today)")
    return merged


# ── Freshness check ───────────────────────────────────────────────────────────

def is_fresh(tweets_dir: Path, max_age_hours: int) -> bool:
    """True if today's tweet file was written within max_age_hours."""
    today_file = tweets_dir / f"tweets_{datetime.now().strftime('%Y-%m-%d')}.json"
    if not today_file.exists():
        return False
    age_hours = (time.time() - today_file.stat().st_mtime) / 3600
    return age_hours < max_age_hours


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Collect tweets from your Twitter Following timeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
First-time setup:
  python collect_twitter.py --login

Daily collection:
  python collect_twitter.py
  python collect_twitter.py --fresh 4    # skip if data < 4h old
  python collect_twitter.py --headless   # no visible browser
        """,
    )
    p.add_argument("--login",    action="store_true",
                   help="Open browser for login (first-time setup)")
    p.add_argument("--scrolls",  type=int, default=150,
                   help="Max scroll count (default: 150, ~30-50 tweets/100 scrolls)")
    p.add_argument("--fresh",    type=int, default=0, metavar="HOURS",
                   help="Skip if today's data is fresher than N hours")
    p.add_argument("--headless", action="store_true",
                   help="Run browser in background (no visible window)")
    p.add_argument("--profile",  default=str(PROFILE_DIR),
                   help="Browser profile dir (stores login session)")
    p.add_argument("--output",   default=str(TWEETS_DIR),
                   help="Output directory for tweet JSON files")
    args = p.parse_args()

    profile = Path(args.profile)
    output  = Path(args.output)

    if args.login:
        run_login(profile)
        return

    if args.fresh and is_fresh(output, args.fresh):
        print(f"Data is fresh (< {args.fresh}h old) — skipping Twitter collection")
        return

    if not is_logged_in(profile):
        print("No saved login session found.")
        print("Run first: python collect_twitter.py --login")
        sys.exit(1)

    collect_tweets(profile, args.scrolls, output, headless=args.headless)


if __name__ == "__main__":
    main()
