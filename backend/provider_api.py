"""Stable, provider-agnostic contract for Synscraper consumers.

All implementations live under backend/providers and the registry in scraper.py.
This module deliberately avoids importing provider modules on its own.
"""

import os
from urllib.parse import urljoin, urlsplit

import scraper

API_VERSION = "1"


def list_providers() -> dict:
    providers = []
    for name, provider_id, _ in scraper.PROVIDERS:
        media_types = ["movie", "tv"]
        if provider_id == "vidy":
            media_types.append("anime")
        providers.append({
            "id": provider_id,
            "name": name,
            "media_types": media_types,
        })
    return {"version": API_VERSION, "count": len(providers), "providers": providers}


def validate_request(media_type, media_id, season=None, episode=None, provider=None):
    """Raise ValueError for invalid inputs or LookupError for unknown providers."""
    valid_providers = {item[1] for item in scraper.PROVIDERS}
    if provider is not None and provider not in valid_providers:
        raise LookupError(f"Unknown provider: {provider}")
    if media_type not in ("movie", "tv", "anime"):
        raise ValueError("type must be movie, tv, or anime")
    if media_type == "anime" and provider != "vidy":
        raise ValueError("anime requires provider=vidy")
    if not str(media_id).isdecimal() or int(media_id) <= 0:
        raise ValueError("id must be a positive numeric media ID")
    if media_type in ("tv", "anime") and (season is None and media_type == "tv" or episode is None):
        raise ValueError("TV requires season and episode; anime requires episode")
    for field, value in (("season", season), ("episode", episode)):
        if value is not None and (not isinstance(value, int) or value <= 0):
            raise ValueError(f"{field} must be a positive integer")


def public_origin(request) -> str:
    """Use a configured public origin, or the incoming request host if absent."""
    configured = os.getenv("SYNSCRAPER_PUBLIC_URL", "").strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


def absolute_url(url: str, origin: str) -> str:
    """Make relative API playback URLs usable by external projects."""
    value = str(url or "").strip()
    if not value or value.startswith(("https://", "http://")):
        return value
    parsed = urlsplit(origin)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("public origin must be an http(s) URL")
    return urljoin(f"{parsed.scheme}://{parsed.netloc}/", value.lstrip("/"))


def public_stream_response(payload: dict, origin: str) -> dict:
    """Return a copy with absolute play URLs, retaining legacy response fields."""
    result = dict(payload)
    result["version"] = API_VERSION
    normalized = []
    for stream in payload.get("servers", []):
        item = dict(stream)
        item["play_url"] = absolute_url(stream.get("play_url", ""), origin)
        item["captions"] = [
            {**caption, "play_url": absolute_url(caption.get("play_url", ""), origin)}
            for caption in stream.get("captions", [])
        ]
        normalized.append(item)
    result["servers"] = normalized
    return result
