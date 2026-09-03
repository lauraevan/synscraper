"""Synflix multi-source stream scraper.

Scrapes real playable stream URLs (HLS .m3u8 / .mp4) off several embed providers
server-side, with VidUp attempted first. Each provider is a self-contained resolver
that replays the provider's own API/handshake and returns direct CDN URLs, which we
then relay through our own HLS/segment proxy (referer-aware).
"""
import asyncio
import json
import os
import re
import time

from providers.vidlink import VidlinkResolver
from providers.vidnest import VidNestResolver
from providers.castle import CastleResolver
from providers.vidrock import VidrockResolver
from providers.vidzee import VidzeeResolver
from providers.vixsrc import VixSrcResolver
from providers.vidy import VidyResolver
from providers.cinejoy import CineJoyResolver

VIDUP_ORIGIN = os.environ.get("VIDUP_ORIGIN", "https://vidup.to")
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)

# Friendly Synflix server names -> resolver classes, in priority order.
PROVIDERS = [
    ("Orbit", "castle", CastleResolver),      # primary
    ("Nova", "vidlink", VidlinkResolver),
    ("Nest", "vidnest", VidNestResolver),
    ("Zen", "vidzee", VidzeeResolver),
    ("Rock", "vidrock", VidrockResolver),
    ("Vidy", "vidy", VidyResolver),
    ("CineJoy", "cinejoy", CineJoyResolver),
    ("Vix", "vixsrc", VixSrcResolver),
]

_cache: dict[str, tuple[float, list]] = {}
_TTL = 480


def _key(t, i, s, e):
    return f"{t}:{i}:{s}:{e}"


def _stream_type(url: str) -> str:
    u = url.lower()
    if ".m3u8" in u:
        return "hls"
    if ".mp4" in u or ".mkv" in u:
        return "mp4"
    return "hls"



def _normalize_captions(items, default_source: str) -> list:
    if not items:
        return []
    if isinstance(items, dict):
        items = list(items.values())
    if not isinstance(items, list):
        items = [items]

    out = []
    for idx, item in enumerate(items):
        if isinstance(item, str):
            item = {"url": item}
        if not isinstance(item, dict):
            continue

        url = item.get("url") or item.get("file") or item.get("src")
        if not isinstance(url, str) or not url.startswith("http"):
            continue

        kind = str(item.get("type") or item.get("format") or "").lower().lstrip(".")
        path = url.split("?", 1)[0].lower()
        is_vtt = kind in ("vtt", "webvtt") or path.endswith(".vtt")
        if not is_vtt:
            continue

        headers = item.get("headers", {}) or {}
        source = str(item.get("source") or item.get("provider") or default_source or "vtt").lower()
        out.append({
            "id": str(item.get("id") or f"{source}-vtt-{idx}"),
            "url": url,
            "name": item.get("name") or item.get("label") or item.get("display") or item.get("language") or "WebVTT",
            "lang": item.get("lang") or item.get("language") or "und",
            "source": source,
            "type": "vtt",
            "referer": headers.get("Referer") or item.get("referer") or "",
            "origin": headers.get("Origin") or item.get("origin") or "",
        })
    return out


def _caption_items(obj, default_source: str) -> list:
    if not isinstance(obj, dict):
        return []
    gathered = []
    for key in ("captions", "subtitles", "tracks"):
        value = obj.get(key)
        if value:
            gathered.extend(_normalize_captions(value, default_source))
    seen = set()
    result = []
    for caption in gathered:
        key = caption["url"]
        if key in seen:
            continue
        seen.add(key)
        result.append(caption)
    return result

def _run_one(cls, media_type, tmdb_id, season, episode):
    try:
        r = cls()
        out = r.resolve(str(tmdb_id), media_type=media_type, season=season, episode=episode)
        data = json.loads(out) if isinstance(out, str) else out
        if data.get("status") != "success":
            return []
        default_caption_source = cls.__name__.replace("Resolver", "").lower()
        root_captions = _caption_items(data, default_caption_source)
        streams = []
        for pu in data.get("playable_urls", []):
            url = pu.get("url")
            if not url or not url.startswith("http"):
                continue
            headers = pu.get("headers", {}) or {}
            captions = list(root_captions)
            captions.extend(_caption_items(pu, default_caption_source))
            deduped_captions = []
            seen_caption_urls = set()
            for caption in captions:
                if caption["url"] in seen_caption_urls:
                    continue
                seen_caption_urls.add(caption["url"])
                deduped_captions.append(caption)
            streams.append({
                "url": url,
                "type": pu.get("type") or _stream_type(url),
                "quality": pu.get("quality", "Auto"),
                "referer": headers.get("Referer", ""),
                "origin": headers.get("Origin", ""),
                "user_agent": headers.get("User-Agent", USER_AGENT),
                "captions": deduped_captions,
                "subserver": pu.get("server") or pu.get("label") or "",
                "lang": pu.get("lang") or pu.get("language") or "",
            })
        return streams
    except Exception:
        return []


async def scrape_streams(media_type: str, tmdb_id, season=None, episode=None) -> list:
    """Return a normalized, ranked list of playable servers scraped from all providers."""
    ck = _key(media_type, tmdb_id, season, episode)
    hit = _cache.get(ck)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    async def run(name, pid, cls):
        try:
            streams = await asyncio.wait_for(
                asyncio.to_thread(_run_one, cls, media_type, tmdb_id, season, episode),
                timeout=10.0,
            )
        except (asyncio.TimeoutError, TimeoutError):
            streams = []
        return name, pid, streams

    results = await asyncio.gather(
        *[run(n, p, c) for n, p, c in PROVIDERS], return_exceptions=True
    )

    servers = []
    for res in results:
        if isinstance(res, Exception):
            continue
        name, pid, streams = res
        for idx, s in enumerate(streams):
            subserver = str(s.get("subserver") or "").strip()
            if subserver:
                if pid == "vidzee":
                    pretty = {
                        "dcloud": "DCloud",
                        "tik": "Tik",
                        "ipcloud": "IPCloud",
                        "v6:hindi": "V6 Hindi",
                    }.get(subserver.lower(), subserver)
                    display_name = f"{name} · {pretty}"
                elif subserver.lower().startswith(name.lower()):
                    display_name = subserver
                else:
                    display_name = f"{name} · {subserver}"
            else:
                display_name = name if idx == 0 else f"{name} {idx + 1}"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": pid == "castle",
                **s,
            })

    # rank: primary first, then hls before mp4
    servers.sort(key=lambda s: (0 if s["primary"] else 1, 0 if s["type"] == "hls" else 1))
    _cache[ck] = (time.time(), servers)
    return servers


# --------------- referer-aware HLS / media proxy ---------------
def strip_png_ts(buf: bytes) -> bytes:
    if len(buf) < 4 or buf[0] == 0x47:
        return buf
    if buf[:4] == b"\x89PNG":
        idx = buf.find(b"IEND")
        if idx >= 0 and idx + 8 < len(buf):
            return buf[idx + 8:]
    for i in range(min(len(buf), 65536)):
        if buf[i] == 0x47 and i + 188 < len(buf) and buf[i + 188] == 0x47:
            return buf[i:]
    return buf


def rewrite_m3u8(text: str, base_url: str, ref: str, origin: str) -> str:
    from urllib.parse import quote, urljoin

    def prox(u):
        abs_u = urljoin(base_url, u)
        q = f"/api/hls?url={quote(abs_u, safe='')}"
        if ref:
            q += f"&ref={quote(ref, safe='')}"
        if origin:
            q += f"&origin={quote(origin, safe='')}"
        return q

    out = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            out.append(line)
        elif s.startswith("#"):
            m = re.search(r'URI="([^"]+)"', line)
            if m:
                line = line.replace(m.group(1), prox(m.group(1)))
            out.append(line)
        else:
            out.append(prox(s))
    return "\n".join(out)
