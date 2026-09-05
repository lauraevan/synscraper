"""Synflix multi-source stream scraper.

Scrapes real playable stream URLs (HLS .m3u8 / .mp4) off several embed providers
server-side, with VidUp attempted first. Each provider is a self-contained resolver
that replays the provider's own API/handshake and returns direct CDN URLs, which we
then relay through our own HLS/segment proxy (referer-aware).
"""
import asyncio
import importlib
import json
import os
import re
import time

VIDUP_ORIGIN = os.environ.get("VIDUP_ORIGIN", "https://vidup.to")
USER_AGENT = os.environ.get(
    "SCRAPER_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)

# Friendly Synflix server names -> resolver classes, in priority order.
PROVIDERS = [
    ("Houston", "castle", ("providers.castle", "CastleResolver")),
    ("Nova", "vidlink", ("providers.vidlink", "VidlinkResolver")),
    ("Nest", "vidnest", ("providers.vidnest", "VidNestResolver")),
    ("Zen", "vidzee", ("providers.vidzee", "VidzeeResolver")),
    ("Rock", "vidrock", ("providers.vidrock", "VidrockResolver")),
    ("Vidy", "vidy", ("providers.vidy", "VidyResolver")),
    ("Orlando", "orlando", ("providers.orlando", "OrlandoResolver")),
    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),
    ("VidCore", "vidcore", ("providers.vidcore", "VidCoreResolver")),
    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),
]

_cache: dict[str, tuple[float, list]] = {}
_TTL = 180


def _key(t, i, s, e, provider_id=None, mirror=None, exclude=None):
    return f"{t}:{i}:{s}:{e}:{provider_id or 'all'}:{mirror or 'all'}:{exclude or 'none'}"


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

def _resolver_class(spec):
    module_name, class_name = spec
    module = importlib.import_module(module_name)
    return getattr(module, class_name)


def _run_one(spec, provider_id, media_type, tmdb_id, season, episode, provider_hint=None, fast_mirrors=False, metadata_hint=None):
    try:
        cls = _resolver_class(spec)
        r = cls()
        resolve_kwargs = {}
        if provider_id == "vidy":
            if provider_hint:
                resolve_kwargs["provider"] = provider_hint
            elif fast_mirrors:
                resolve_kwargs["provider"] = "fast"
            if metadata_hint:
                resolve_kwargs["metadata_hint"] = metadata_hint
        elif provider_id == "orlando" and metadata_hint:
            resolve_kwargs["metadata_hint"] = metadata_hint
        out = r.resolve(str(tmdb_id), media_type=media_type, season=season, episode=episode, **resolve_kwargs)
        data = json.loads(out) if isinstance(out, str) else out
        if data.get("status") != "success":
            return []
        default_caption_source = provider_id
        root_captions = _caption_items(data, default_caption_source)
        streams = []
        for pu in data.get("playable_urls", []):
            url = pu.get("url")
            if not url or not url.startswith("http"):
                continue
            if provider_id == "orlando" and not str(url).startswith("https://moon.peakstorm.top/"):
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


async def scrape_streams(media_type: str, tmdb_id, season=None, episode=None, provider_id=None, mirror=None, exclude=None, metadata_hint=None) -> list:
    """Return normalized playable servers, optionally scoped/excluding providers."""
    excluded = {part.strip().lower() for part in str(exclude or "").split(",") if part.strip()}
    normalized_exclude = ",".join(sorted(excluded))
    ck = _key(media_type, tmdb_id, season, episode, provider_id, mirror, normalized_exclude)
    hit = _cache.get(ck)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    selected_providers = [item for item in PROVIDERS if item[1] == provider_id] if provider_id else PROVIDERS
    if provider_id and not selected_providers:
        return []
    if excluded:
        selected_providers = [item for item in selected_providers if item[1] not in excluded]
    if not selected_providers:
        return []

    async def run(name, pid, spec):
        try:
            provider_hint = mirror if pid == "vidy" and mirror else None
            per_provider_timeout = 14.0 if pid == "orlando" else (8.5 if provider_id else 9.0)
            streams = await asyncio.wait_for(
                asyncio.to_thread(
                    _run_one, spec, pid, media_type, tmdb_id, season, episode,
                    provider_hint, provider_id is None and not mirror, metadata_hint,
                ),
                timeout=per_provider_timeout,
            )
        except (asyncio.TimeoutError, TimeoutError):
            streams = []
        return name, pid, streams

    results = await asyncio.gather(
        *[run(n, p, spec) for n, p, spec in selected_providers], return_exceptions=True
    )

    servers = []
    for res in results:
        if isinstance(res, Exception):
            continue
        name, pid, streams = res
        for idx, s in enumerate(streams):
            subserver = str(s.get("subserver") or "").strip()
            if pid == "orlando":
                display_name = "Orlando"
            elif subserver:
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
            is_miami = pid == "vidy" and display_name.lower() == "miami"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": is_miami,
                **s,
            })

    # Miami stays the fast/default playback source. Orlando is always ranked
    # immediately behind it and is limited to the moon.peakstorm.top source.
    def _quality_rank(server):
        quality = str(server.get("quality") or "").lower()
        return 0 if "1080" in quality else 1 if "720" in quality else 2 if "480" in quality else 3 if ("2160" in quality or "4k" in quality) else 4

    def _server_rank(server):
        if server.get("provider") == "vidy" and str(server.get("name") or "").lower() == "miami":
            return (0, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        if server.get("provider") == "orlando":
            return (1, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        return (2 if server.get("primary") else 3, 0, 0 if server.get("type") == "hls" else 1)

    servers.sort(key=_server_rank)
    _cache[ck] = (time.time(), servers)
    if len(_cache) > 512:
        oldest = sorted(_cache.items(), key=lambda item: item[1][0])[:128]
        for key, _ in oldest:
            _cache.pop(key, None)
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