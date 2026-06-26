"""
image_filter.py — decide whether a cover-image URL is too small / logo-like.

We'd rather show a clean gradient placeholder than upscale a 150px share-icon
into a blurry hero. The reliable signal is dimensions; we read them from the URL
(most CDNs embed WxH or resize params) and, when available, from og:image:width.
"""

import re
import requests

_MIN_WIDTH = 400  # below this a hero/card image looks blurry when enlarged

# Obvious non-photo assets (avatars, icons, thumbnails) — reject regardless of size.
_BAD_TOKENS = re.compile(
    r"(share[-_]?icon|favicon|sprite|placeholder|spacer|1x1|/small/|/thumb/|/thumbs/|"
    r"userpics|/avatars?/|[-_]avatar[-_.]|[-_]thumbnail|"
    r"[-_](mid|small|normal|thumb|xs|sm|icon)\.(png|jpe?g|webp|gif)|"
    r"default[-_]?(og|share|image|cover|avatar))",
    re.I,
)

_IMG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def probe_image_width(url: str, timeout: int = 10) -> int | None:
    """Read an image's real pixel width from its header bytes. None if unknown."""
    try:
        from io import BytesIO
        from PIL import Image
        r = requests.get(url, headers={**_IMG_HEADERS, "Range": "bytes=0-262143"},
                         timeout=timeout, stream=True)
        if r.status_code not in (200, 206):
            return None
        data = r.content[:262144]
        return Image.open(BytesIO(data)).size[0]
    except Exception:
        return None
# Dimensions embedded in the URL, e.g. "...-1152x648.jpg"
_WXH = re.compile(r"(\d{2,4})x(\d{2,4})")
# Resize params, e.g. "w=600", "w_600", "width=300"
_W_PARAM = re.compile(r"[?&](?:w|width)=(\d{2,4})\b|[/_-]w_(\d{2,4})\b", re.I)


def is_low_quality_image(url: str, width: int | None = None, probe: bool = False) -> bool:
    """True if the image is too small / logo-like to use as a cover.

    Cheap URL + metadata checks first. If `probe` is set and nothing else
    rejected it, fetch the image header and check the *real* pixel width — this
    catches logos/avatars whose URL gives no size hint (e.g. TradingView userpics).
    """
    if not url:
        return True
    u = url.lower()

    if width is not None and width < _MIN_WIDTH:
        return True
    if _BAD_TOKENS.search(u):
        return True

    # Largest WxH width found in the URL (CDN-resized variants).
    widths = [int(m.group(1)) for m in _WXH.finditer(u)]
    if widths and max(widths) < _MIN_WIDTH:
        return True

    # Explicit resize width param.
    for m in _W_PARAM.finditer(u):
        w = m.group(1) or m.group(2)
        if w and int(w) < _MIN_WIDTH:
            return True

    # Authoritative check: real pixel dimensions. Only reject when *confirmed*
    # small — an unreadable header keeps the image (benefit of the doubt).
    if probe and width is None:
        real = probe_image_width(url)
        if real is not None and real < _MIN_WIDTH:
            return True

    return False
