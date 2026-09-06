"""Lightweight jump-scare lookup for horror title pages.

Counts are read from Where's The Jump?'s public full-movie table and cached in-memory.
We only return a count when a title/year match is found; unknown movies are never guessed.
"""

import html as html_lib
import logging
import re
import time
import unicodedata

import httpx
from fastapi import APIRouter, Query

router = APIRouter()
logger = logging.getLogger("synscraper.jumpscares")

SOURCE_URL = "https://wheresthejump.com/full-movie-list/"
CACHE_SECONDS = 6 * 60 * 60
_cache_at = 0.0
_cache_rows: list[dict] = []


def _text(fragment: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", fragment, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html_lib.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def _key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "")).casefold()
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "", normalized)


async def _catalog() -> list[dict]:
    global _cache_at, _cache_rows
    now = time.monotonic()
    if _cache_rows and now - _cache_at < CACHE_SECONDS:
        return _cache_rows

    try:
        async with httpx.AsyncClient(timeout=18, follow_redirects=True) as client:
            response = await client.get(
                SOURCE_URL,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; SynFlix/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            response.raise_for_status()

        rows: list[dict] = []
        for raw_row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", response.text, flags=re.I | re.S):
            cells = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", raw_row, flags=re.I | re.S)
            if len(cells) < 5:
                continue
            values = [_text(cell) for cell in cells]
            year_match = re.search(r"\b((?:18|19|20)\d{2})\b", values[2])
            count_match = re.search(r"\b(\d{1,3})\b", values[3])
            rating_match = re.search(r"\b([0-5](?:\.\d)?)\b", values[4])
            title = values[0].strip()
            if not title or not year_match or not count_match:
                continue
            rows.append({
                "title": title,
                "key": _key(title),
                "year": int(year_match.group(1)),
                "count": int(count_match.group(1)),
                "rating": float(rating_match.group(1)) if rating_match else None,
            })

        if rows:
            _cache_rows = rows
            _cache_at = now
        return _cache_rows
    except Exception as exc:  # noqa: BLE001
        logger.warning("jump-scare catalog refresh failed: %s", exc)
        return _cache_rows


@router.get("/jumpscares")
async def jumpscare_lookup(
    title: str = Query(..., min_length=1, max_length=180),
    year: int | None = Query(default=None, ge=1800, le=2200),
):
    wanted = _key(title)
    if not wanted:
        return {"found": False}

    matches = [row for row in await _catalog() if row["key"] == wanted]
    if not matches:
        return {"found": False}

    match = None
    if year is not None:
        exact = [row for row in matches if row["year"] == year]
        if exact:
            match = exact[0]
        else:
            close = sorted(matches, key=lambda row: abs(row["year"] - year))
            if close and abs(close[0]["year"] - year) <= 1:
                match = close[0]
    elif len(matches) == 1:
        match = matches[0]

    if match is None:
        return {"found": False}

    return {
        "found": True,
        "title": match["title"],
        "year": match["year"],
        "count": match["count"],
        "rating": match["rating"],
        "source": "Where's The Jump?",
    }
