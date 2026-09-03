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
    ("Houston", "castle", CastleResolver),      # primary
    ("Nova", "vidlink", VidlinkResolver),
    ("Nest", "vidnest", VidNestResolver),
    ("Zen", "vidzee", VidzeeResolver),
    ("Rock", "vidrock", VidrockResolver),
    ("Vidy", "vidy", VidyResolver),
    ("CineJoy", "cinejoy", CineJoyResolver),
    ("Vix", "vixsrc", VixSrcResolver),
]

_cache: dict[str, tuple[float, list]] = {}
_TTL = 120


def _key(t, i, s, e, provider_id=None, mirror=None):
    return f"{t}:{i}:{s}:{e}:{provider_id or 'all'}:{mirror or 'all'}"


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

def _run_one(cls, media_type, tmdb_id, season, episode, provider_hint=None, all_mirrors=False):
    try:
        r = cls()
        resolve_kwargs = {}
        if cls is VidyResolver:
            if provider_hint:
                resolve_kwargs["provider"] = provider_hint
            elif all_mirrors:
                resolve_kwargs["provider"] = "all"
        out = r.resolve(str(tmdb_id), media_type=media_type, season=season, episode=episode, **resolve_kwargs)
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


async def scrape_streams(media_type: str, tmdb_id, season=None, episode=None, provider_id=None, mirror=None) -> list:
    """Return normalized playable servers, optionally scoped to one provider/mirror."""
    ck = _key(media_type, tmdb_id, season, episode, provider_id, mirror)
    hit = _cache.get(ck)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    selected_providers = [item for item in PROVIDERS if item[1] == provider_id] if provider_id else PROVIDERS
    if provider_id and not selected_providers:
        return []

    async def run(name, pid, cls):
        try:
            provider_hint = mirror if pid == "vidy" and mirror else None
            streams = await asyncio.wait_for(
                asyncio.to_thread(
                    _run_one, cls, media_type, tmdb_id, season, episode,
                    provider_hint, provider_id is None,
                ),
                timeout=10.0,
            )
        except (asyncio.TimeoutError, TimeoutError):
            streams = []
        return name, pid, streams

    results = await asyncio.gather(
        *[run(n, p, c) for n, p, c in selected_providers], return_exceptions=True
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
                    display_name = {
                        "dcloud": "DCloud",
                        "tik": "Tik",
                        "ipcloud": "IPCloud",
                        "v6:hindi": "V6 Hindi",
                    }.get(subserver.lower(), subserver)
                elif pid == "castle" and subserver.lower() == "castle":
                    display_name = "Houston"
                else:
                    display_name = subserver
                    if display_name.lower().startswith(name.lower()):
                        display_name = display_name[len(name):].lstrip(" ·:-")
                    display_name = display_name or name
            else:
                display_name = name if idx == 0 else f"{name} {idx + 1}"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": pid == "castle",
                **s,
            })

    # Miami is the default playback source. Start at 1080p for faster loading.
    def _server_rank(server):
        if server.get("provider") == "vidy" and str(server.get("name") or "").lower() == "miami":
            quality = str(server.get("quality") or "").lower()
            qrank = 0 if "1080" in quality else 1 if "720" in quality else 2 if "480" in quality else 3 if ("2160" in quality or "4k" in quality) else 4
            return (0, qrank, 0 if server.get("type") == "hls" else 1)
        return (1 if server.get("primary") else 2, 0, 0 if server.get("type") == "hls" else 1)

    servers.sort(key=_server_rank)
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
