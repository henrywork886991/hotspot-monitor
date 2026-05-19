"""
config_loader.py — Load skill configuration from config.json.

Priority (highest → lowest):
  1. Environment variables  (HOTSPOT_DB_PATH, HOTSPOT_CATEGORY, etc.)
  2. config.json            (skill root, gitignored — personal settings)
  3. config.example.json    (skill root, committed — safe defaults)
  4. Built-in defaults      (hardcoded fallback)
"""

import os
import json
from pathlib import Path

_SKILL_ROOT = Path(__file__).parent.parent  # skills/hotspot-monitor/
_DEFAULTS = {
    "db": {"path": "data/hotspots.db"},
    "collection": {
        "default_category": "all",
        "default_days": 3,
        "twitter_buddy_dir": None,
    },
}


def _load_json(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _deep_merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def load() -> dict:
    cfg = dict(_DEFAULTS)
    # Layer 1: config.example.json (safe committed defaults)
    cfg = _deep_merge(cfg, _load_json(_SKILL_ROOT / "config.example.json"))
    # Layer 2: config.json (personal overrides, gitignored)
    cfg = _deep_merge(cfg, _load_json(_SKILL_ROOT / "config.json"))
    # Layer 3: environment variables
    if v := os.environ.get("HOTSPOT_DB_PATH"):
        cfg["db"]["path"] = v
    if v := os.environ.get("HOTSPOT_CATEGORY"):
        cfg["collection"]["default_category"] = v
    if v := os.environ.get("HOTSPOT_DAYS"):
        cfg["collection"]["default_days"] = int(v)
    if v := os.environ.get("TWITTER_BUDDY_DIR"):
        cfg["collection"]["twitter_buddy_dir"] = v
    return cfg


def db_path() -> str:
    """Return the absolute DB path, resolving relative paths from skill root."""
    raw = load()["db"]["path"]
    p = Path(raw)
    if not p.is_absolute():
        p = _SKILL_ROOT / p
    return str(p)
