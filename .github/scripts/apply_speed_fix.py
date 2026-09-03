from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing patch marker for {label}: {old[:140]!r}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# backend/scraper.py: lazy providers, fast Vidy tier, exclusions, tighter cache
# ---------------------------------------------------------------------------
p = Path("backend/scraper.py")
t = p.read_text()

old_imports = '''import asyncio
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
'''
new_imports = '''import asyncio
import importlib
import json
import os
import re
import time
'''
t = replace_once(t, old_imports, new_imports, "lazy provider imports")

old_providers = '''PROVIDERS = [
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
'''
new_providers = '''PROVIDERS = [
    ("Houston", "castle", ("providers.castle", "CastleResolver")),
    ("Nova", "vidlink", ("providers.vidlink", "VidlinkResolver")),
    ("Nest", "vidnest", ("providers.vidnest", "VidNestResolver")),
    ("Zen", "vidzee", ("providers.vidzee", "VidzeeResolver")),
    ("Rock", "vidrock", ("providers.vidrock", "VidrockResolver")),
    ("Vidy", "vidy", ("providers.vidy", "VidyResolver")),
    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),
    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),
]

_cache: dict[str, tuple[float, list]] = {}
_TTL = 180


def _key(t, i, s, e, provider_id=None, mirror=None, exclude=None):
    return f"{t}:{i}:{s}:{e}:{provider_id or 'all'}:{mirror or 'all'}:{exclude or 'none'}"
'''
t = replace_once(t, old_providers, new_providers, "provider registry")

run_start = t.index("def _run_one(")
run_end = t.index("\n\nasync def scrape_streams", run_start)
new_run = '''def _resolver_class(spec):
    module_name, class_name = spec
    module = importlib.import_module(module_name)
    return getattr(module, class_name)


def _run_one(spec, provider_id, media_type, tmdb_id, season, episode, provider_hint=None, fast_mirrors=False):
    try:
        cls = _resolver_class(spec)
        r = cls()
        resolve_kwargs = {}
        if provider_id == "vidy":
            if provider_hint:
                resolve_kwargs["provider"] = provider_hint
            elif fast_mirrors:
                resolve_kwargs["provider"] = "fast"
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
'''
t = t[:run_start] + new_run + t[run_end:]

scrape_start = t.index("async def scrape_streams(")
scrape_end = t.index("\n\n# --------------- referer-aware HLS", scrape_start)
old_scrape = t[scrape_start:scrape_end]
new_scrape = '''async def scrape_streams(media_type: str, tmdb_id, season=None, episode=None, provider_id=None, mirror=None, exclude=None) -> list:
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
            per_provider_timeout = 8.5 if provider_id else 9.0
            streams = await asyncio.wait_for(
                asyncio.to_thread(
                    _run_one, spec, pid, media_type, tmdb_id, season, episode,
                    provider_hint, provider_id is None and not mirror,
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
            is_miami = pid == "vidy" and display_name.lower() == "miami"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": is_miami,
                **s,
            })

    # Miami is the fast/default playback source. Prefer 1080p for startup,
    # while preserving 4K/Auto as selectable qualities once the manifest is ready.
    def _server_rank(server):
        if server.get("provider") == "vidy" and str(server.get("name") or "").lower() == "miami":
            quality = str(server.get("quality") or "").lower()
            qrank = 0 if "1080" in quality else 1 if "720" in quality else 2 if "480" in quality else 3 if ("2160" in quality or "4k" in quality) else 4
            return (0, qrank, 0 if server.get("type") == "hls" else 1)
        return (1 if server.get("primary") else 2, 0, 0 if server.get("type") == "hls" else 1)

    servers.sort(key=_server_rank)
    _cache[ck] = (time.time(), servers)
    if len(_cache) > 512:
        oldest = sorted(_cache.items(), key=lambda item: item[1][0])[:128]
        for key, _ in oldest:
            _cache.pop(key, None)
    return servers
'''
t = t[:scrape_start] + new_scrape + t[scrape_end:]
p.write_text(t)


# ---------------------------------------------------------------------------
# backend/providers/vidy.py: parallel prep + fast mirror tier + short caches
# ---------------------------------------------------------------------------
p = Path("backend/providers/vidy.py")
t = p.read_text()
t = replace_once(t, "import ssl\nimport urllib.error", "import ssl\nimport threading\nimport time\nimport urllib.error", "Vidy cache imports")

marker = '''DEFAULT_PROVIDERS = (
    "miami",
    "atlanta",
    "seattle",
    "denver",
    "phoenix",
    "portland",
    "dallas",
)
'''
replacement = marker + '''FAST_PROVIDERS = (
    "miami",
    "atlanta",
    "seattle",
)
'''
t = replace_once(t, marker, replacement, "Vidy fast providers")

t = replace_once(t, "PHI32 = 0x9E3779B9\n", '''PHI32 = 0x9E3779B9

_META_CACHE: dict[tuple[str, int], tuple[float, dict[str, Any]]] = {}
_SEED_CACHE: dict[int, tuple[float, str]] = {}
_META_CACHE_LOCK = threading.Lock()
_SEED_CACHE_LOCK = threading.Lock()
_META_TTL = 900.0
_SEED_TTL = 35.0
''', "Vidy caches")

t = replace_once(t, '        timeout: float = 25.0,', '        timeout: float = 7.5,', "Vidy default timeout")

metadata_marker = '    def _metadata(self, media_id: int, media_type: str) -> dict[str, Any]:\n'
metadata_replacement = '''    def _metadata(self, media_id: int, media_type: str) -> dict[str, Any]:
        key = (str(media_type), int(media_id))
        now = time.monotonic()
        with _META_CACHE_LOCK:
            hit = _META_CACHE.get(key)
            if hit and now - hit[0] < _META_TTL:
                return dict(hit[1])
        value = self._metadata_uncached(media_id, media_type)
        with _META_CACHE_LOCK:
            _META_CACHE[key] = (time.monotonic(), dict(value))
        return dict(value)

    def _metadata_uncached(self, media_id: int, media_type: str) -> dict[str, Any]:
'''
t = replace_once(t, metadata_marker, metadata_replacement, "Vidy metadata cache wrapper")

seed_marker = '''    def _seed(self, media_id: int) -> str:
        data = self._request(f"{API_BASE}/seed", params={"mediaId": int(media_id)}, timeout=6.0)
        if not isinstance(data, dict) or data.get("seed") is None:
            raise RuntimeError(f"Unexpected Vidy seed response: {data!r}")
        return str(data["seed"])
'''
seed_replacement = '''    def _seed(self, media_id: int) -> str:
        numeric_id = int(media_id)
        now = time.monotonic()
        with _SEED_CACHE_LOCK:
            hit = _SEED_CACHE.get(numeric_id)
            if hit and now - hit[0] < _SEED_TTL:
                return hit[1]
        data = self._request(f"{API_BASE}/seed", params={"mediaId": numeric_id}, timeout=5.0)
        if not isinstance(data, dict) or data.get("seed") is None:
            raise RuntimeError(f"Unexpected Vidy seed response: {data!r}")
        value = str(data["seed"])
        with _SEED_CACHE_LOCK:
            _SEED_CACHE[numeric_id] = (time.monotonic(), value)
        return value
'''
t = replace_once(t, seed_marker, seed_replacement, "Vidy seed cache")
t = t.replace('response = self._request(f"{API_BASE}/{provider}/sources", params=query, timeout=6.5)', 'response = self._request(f"{API_BASE}/{provider}/sources", params=query, timeout=6.0)', 1)

old_prepare = '''        try:
            params = self._metadata(numeric_id, media_type)
            if media_type == "tv":
                params["seasonId"] = int(season)
                params["episodeId"] = int(episode)

            providers = ALL_PROVIDERS if provider == "all" else ((provider,) if provider not in {"auto", ""} else DEFAULT_PROVIDERS)
            playable: list[dict[str, Any]] = []
            subtitles: list[dict[str, Any]] = []
            errors: dict[str, str] = {}
            shared_seed = self._seed(numeric_id)
'''
new_prepare = '''        try:
            # Metadata and the short-lived seed are independent network calls.
            # Resolve them in parallel so Miami only waits on the slower one.
            with ThreadPoolExecutor(max_workers=2) as prep_pool:
                metadata_future = prep_pool.submit(self._metadata, numeric_id, media_type)
                seed_future = prep_pool.submit(self._seed, numeric_id)
                params = metadata_future.result()
                shared_seed = seed_future.result()

            if media_type == "tv":
                params["seasonId"] = int(season)
                params["episodeId"] = int(episode)

            providers = (
                ALL_PROVIDERS if provider == "all"
                else FAST_PROVIDERS if provider == "fast"
                else ((provider,) if provider not in {"auto", ""} else DEFAULT_PROVIDERS)
            )
            playable: list[dict[str, Any]] = []
            subtitles: list[dict[str, Any]] = []
            errors: dict[str, str] = {}
'''
t = replace_once(t, old_prepare, new_prepare, "Vidy parallel prep")
t = replace_once(t, 'parser.add_argument("--provider", choices=["auto", "all", *ALL_PROVIDERS], default="auto")', 'parser.add_argument("--provider", choices=["auto", "fast", "all", *ALL_PROVIDERS], default="auto")', "Vidy CLI fast mode")
p.write_text(t)


# ---------------------------------------------------------------------------
# backend/server.py: pooled upstream connections + true streaming relay + cache
# ---------------------------------------------------------------------------
p = Path("backend/server.py")
t = p.read_text()
t = replace_once(t, "import logging\nimport os", "import copy\nimport logging\nimport os\nimport time", "server cache imports")

logger_marker = 'logger = logging.getLogger("synscraper")\n'
logger_add = logger_marker + '''
_HTTP_LIMITS = httpx.Limits(max_connections=100, max_keepalive_connections=40, keepalive_expiry=30.0)
_HTTP_TIMEOUT = httpx.Timeout(30.0, connect=8.0)
_http_client: httpx.AsyncClient | None = None
_tmdb_cache: dict[tuple, tuple[float, dict]] = {}


def _http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=_HTTP_TIMEOUT,
            follow_redirects=True,
            limits=_HTTP_LIMITS,
        )
    return _http_client
'''
t = replace_once(t, logger_marker, logger_add, "shared HTTP client")

start = t.index("async def tmdb_get(")
end = t.index("\n\n@api_router.get(\"/\")", start)
new_tmdb = '''async def tmdb_get(path: str, params: dict | None = None) -> dict:
    params = dict(params or {})
    params.setdefault("language", "en-US")
    headers = {"accept": "application/json"}

    if TMDB_TOKEN:
        headers["Authorization"] = f"Bearer {TMDB_TOKEN}"
    elif TMDB_API_KEY:
        params.setdefault("api_key", TMDB_API_KEY)
    else:
        raise HTTPException(status_code=503, detail="TMDB credentials are not configured")

    cache_key = (path, tuple(sorted((str(k), str(v)) for k, v in params.items())))
    now = time.monotonic()
    hit = _tmdb_cache.get(cache_key)
    if hit and now - hit[0] < 180:
        return copy.deepcopy(hit[1])

    r = await _http().get(f"{TMDB_BASE}/{path.lstrip('/')}", params=params, headers=headers, timeout=20)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=f"TMDB error: {r.text[:200]}")
    data = r.json()
    _tmdb_cache[cache_key] = (now, data)
    if len(_tmdb_cache) > 512:
        oldest = sorted(_tmdb_cache.items(), key=lambda item: item[1][0])[:128]
        for key, _ in oldest:
            _tmdb_cache.pop(key, None)
    return copy.deepcopy(data)
'''
t = t[:start] + new_tmdb + t[end:]

old_streams_sig = '''async def streams(type: str = "movie", id: str = Query(...),
                  season: int | None = None, episode: int | None = None,
                  provider: str | None = None, mirror: str | None = None):
    servers = await scraper.scrape_streams(type, id, season, episode, provider_id=provider, mirror=mirror)
'''
new_streams_sig = '''async def streams(type: str = "movie", id: str = Query(...),
                  season: int | None = None, episode: int | None = None,
                  provider: str | None = None, mirror: str | None = None,
                  exclude: str | None = None):
    servers = await scraper.scrape_streams(
        type, id, season, episode, provider_id=provider, mirror=mirror, exclude=exclude
    )
'''
t = replace_once(t, old_streams_sig, new_streams_sig, "stream exclusions")

old_caption_fetch = '''        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url, headers=headers)
            r.raise_for_status()
'''
new_caption_fetch = '''        r = await _http().get(url, headers=headers, timeout=20)
        r.raise_for_status()
'''
t = replace_once(t, old_caption_fetch, new_caption_fetch, "caption pooling")

hls_start = t.index('@api_router.get("/hls")')
hls_end = t.index("\n\napp.include_router(api_router)", hls_start)
new_hls = '''@api_router.get("/hls")
async def hls(url: str = Query(...), ref: str | None = None,
              origin: str | None = None, request: Request = None):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "HLS URL must be http(s)")

    path = url.split("?", 1)[0].lower()
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if ref:
        headers["Referer"] = ref
    if origin:
        headers["Origin"] = origin
    if request and request.headers.get("range"):
        headers["Range"] = request.headers["range"]

    cors = {"Access-Control-Allow-Origin": "*"}
    client = _http()
    upstream = None
    try:
        req = client.build_request("GET", url, headers=headers)
        upstream = await client.send(req, stream=True)
        if upstream.status_code >= 400:
            status = upstream.status_code
            await upstream.aclose()
            upstream = None
            raise HTTPException(502, f"upstream returned {status}")

        ct = upstream.headers.get("content-type", "").lower()
        is_manifest = path.endswith(".m3u8") or "mpegurl" in ct
        if is_manifest:
            raw = await upstream.aread()
            await upstream.aclose()
            upstream = None
            text = raw.decode("utf-8", errors="replace")
            body = scraper.rewrite_m3u8(text, url, ref or "", origin or "")
            return Response(
                body,
                media_type="application/vnd.apple.mpegurl",
                headers={**cors, "Cache-Control": "no-cache"},
            )

        response_headers = {
            **cors,
            "Cache-Control": "public, max-age=3600",
        }
        for header_name in ("accept-ranges", "content-range", "etag", "last-modified"):
            if header_name in upstream.headers:
                response_headers[header_name] = upstream.headers[header_name]

        sanitize_first_chunk = path.endswith(".ts") or "video/mp2t" in ct

        async def gen():
            first = True
            try:
                async for chunk in upstream.aiter_bytes(65536):
                    if not chunk:
                        continue
                    if first:
                        first = False
                        if sanitize_first_chunk:
                            chunk = scraper.strip_png_ts(chunk)
                    if chunk:
                        yield chunk
            finally:
                await upstream.aclose()

        return StreamingResponse(
            gen(),
            status_code=upstream.status_code,
            headers=response_headers,
            media_type=ct.split(";", 1)[0] or "application/octet-stream",
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if upstream is not None:
            try:
                await upstream.aclose()
            except Exception:
                pass
        logger.warning("hls proxy failed %s: %s", url[:80], exc)
        raise HTTPException(502, "upstream error")
'''
t = t[:hls_start] + new_hls + t[hls_end:]
p.write_text(t)


# ---------------------------------------------------------------------------
# frontend/src/lib/api.js: short memory cache + stream exclusions
# ---------------------------------------------------------------------------
p = Path("frontend/src/lib/api.js")
p.write_text('''import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, timeout: 30000 });
const memoryCache = new Map();

const cached = (key, ttl, loader) => {
    const now = Date.now();
    const hit = memoryCache.get(key);
    if (hit && hit.expires > now) {
        if (hit.promise) return hit.promise;
        return Promise.resolve(hit.value);
    }
    const promise = Promise.resolve()
        .then(loader)
        .then((value) => {
            memoryCache.set(key, { expires: Date.now() + ttl, value });
            return value;
        })
        .catch((error) => {
            memoryCache.delete(key);
            throw error;
        });
    memoryCache.set(key, { expires: now + ttl, promise });
    if (memoryCache.size > 160) {
        for (const [cacheKey, entry] of memoryCache) {
            if (entry.expires <= now) memoryCache.delete(cacheKey);
            if (memoryCache.size <= 120) break;
        }
    }
    return promise;
};

export const getHome = () =>
    cached("home", 60_000, () => http.get("/home").then((r) => r.data));
export const searchAll = (q, page = 1) =>
    cached(`search:${q}:${page}`, 20_000, () => http.get("/search", { params: { q, page } }).then((r) => r.data));
export const getDetails = (mediaType, id) =>
    cached(`details:${mediaType}:${id}`, 300_000, () => http.get(`/details/${mediaType}/${id}`).then((r) => r.data));
export const getSeason = (id, season) =>
    cached(`season:${id}:${season}`, 180_000, () => http.get(`/tv/${id}/season/${season}`).then((r) => r.data));
export const getGenres = (mediaType) =>
    cached(`genres:${mediaType}`, 600_000, () => http.get(`/genre/${mediaType}`).then((r) => r.data));
export const discover = (mediaType, params) =>
    cached(`discover:${mediaType}:${JSON.stringify(params || {})}`, 30_000, () => http.get(`/discover/${mediaType}`, { params }).then((r) => r.data));
export const getStreams = (type, id, season, episode, options = {}) => {
    const params = {
        type,
        id,
        season,
        episode,
        provider: options.provider,
        mirror: options.mirror,
        exclude: options.exclude,
    };
    const key = `streams:${JSON.stringify(params)}`;
    return cached(key, 45_000, () => http.get("/streams", {
        params,
        timeout: options.timeout || 90000,
    }).then((r) => r.data));
};

// image helpers
const IMG = "https://image.tmdb.org/t/p";
export const img = (path, size = "w500") =>
    path ? `${IMG}/${size}${path}` : null;
export const backdrop = (path, size = "original") =>
    path ? `${IMG}/${size}${path}` : null;

export const hlsProxyUrl = (playUrl) =>
    playUrl?.startsWith("http") ? playUrl : `${BACKEND_URL}${playUrl}`;
''')


# ---------------------------------------------------------------------------
# SynapsePlayer: Miami-first staged loading + delayed caption/heavy work
# ---------------------------------------------------------------------------
p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

old_hls = '''            const hls = new Hls({
                enableWorker: true,
                startFragPrefetch: true,
                maxBufferLength: 45,
                maxMaxBufferLength: 90,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 350,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                levelLoadingRetryDelay: 350,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 4,
                fragLoadingRetryDelay: 350,
            });
'''
new_hls = '''            const isMiami = server.provider === "vidy" && /miami/i.test(String(server.name || ""));
            const hls = new Hls({
                enableWorker: true,
                startFragPrefetch: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                backBufferLength: 30,
                abrEwmaDefaultEstimate: isMiami ? 8_000_000 : 5_000_000,
                manifestLoadingTimeOut: 7000,
                manifestLoadingMaxRetry: 2,
                manifestLoadingRetryDelay: 250,
                levelLoadingTimeOut: 8000,
                levelLoadingMaxRetry: 2,
                levelLoadingRetryDelay: 250,
                fragLoadingTimeOut: 15000,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 250,
            });
'''
t = replace_once(t, old_hls, new_hls, "HLS fast config")

block_start = t.index("        const quick = getStreams(mediaType, id, season, episode, { provider: \"vidy\", mirror: \"miami\", timeout: 12000 })")
block_end = t.index("\n\n        return () => { alive = false; clearInterval(tick); };", block_start)
old_block = t[block_start:block_end]
new_block = '''        let backgroundPromise = null;
        let backgroundTimer = null;
        let heavyTimer = null;
        let safetyTimer = null;

        const mergePayload = (data) => {
            if (!alive) return [];
            const list = data?.servers || [];
            if (list.length) {
                setServers((current) => mergeServers(current, list));
                activate(list);
            }
            return list;
        };

        const startHeavyCineJoy = () => {
            if (!alive) return Promise.resolve([]);
            return getStreams(mediaType, id, season, episode, { provider: "cinejoy", timeout: 18000 })
                .then(mergePayload)
                .catch(() => []);
        };

        const startBackground = (exclude) => {
            if (backgroundPromise) return backgroundPromise;
            backgroundPromise = getStreams(mediaType, id, season, episode, { timeout: 45000, exclude })
                .then(mergePayload)
                .catch(() => [])
                .finally(() => {
                    if (alive) setSourcesLoading(false);
                });
            return backgroundPromise;
        };

        const quick = getStreams(mediaType, id, season, episode, { provider: "vidy", mirror: "miami", timeout: 8500 })
            .then((d) => {
                if (!alive) return [];
                const list = mergePayload(d);
                if (!list.length) {
                    return startBackground(undefined);
                }

                const hasMiamiCaptions = list.some((server) => (server.captions || []).length > 0);
                // Keep the first second almost entirely for Miami + its manifest.
                // If Miami omitted captions this time, let the fast Vidy fallback tier refresh them.
                backgroundTimer = window.setTimeout(
                    () => startBackground(hasMiamiCaptions ? "vidy,cinejoy" : "cinejoy"),
                    700,
                );
                // CineJoy is WASM-heavy. Load it only after playback has had time to settle.
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 3800);
                return list;
            })
            .catch(() => startBackground(undefined));

        // If Miami is unusually slow, don't leave the user staring at it forever.
        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground(undefined);
        }, 1800);

        Promise.resolve(quick).finally(() => {
            if (!alive) return;
            if (!started && !backgroundPromise) {
                startBackground(undefined).finally(() => {
                    if (alive && !started) {
                        clearInterval(tick);
                        setMode("error");
                        setError("No streams could be scraped for this title yet.");
                    }
                });
            }
        });
'''
t = t[:block_start] + new_block + t[block_end:]

t = replace_once(
    t,
    '        return () => { alive = false; clearInterval(tick); };',
    '''        return () => {
            alive = false;
            clearInterval(tick);
            if (backgroundTimer) window.clearTimeout(backgroundTimer);
            if (heavyTimer) window.clearTimeout(heavyTimer);
            if (safetyTimer) window.clearTimeout(safetyTimer);
        };''',
    "player timer cleanup",
)

# Respect explicit Auto mode instead of silently turning it into 1080p.
old_activate = '''            const wanted = preferredQualityRef.current || 1080;
            const preferred = list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === wanted)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === 1080)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")))
                || list[0];
'''
new_activate = '''            const wanted = preferredQualityRef.current;
            const preferred = (wanted ? list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === wanted) : null)
                || (!wanted ? list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && /^auto/i.test(String(s.quality || ""))) : null)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === 1080)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")))
                || list[0];
'''
t = replace_once(t, old_activate, new_activate, "Miami auto quality")

# Replace eager all-caption validation with a small preferred-language batch first.
old_caption_effect = '''    useEffect(() => {
        let alive = true;
        Promise.allSettled(externalCaptions.map(async (track) => {
            const result = await loadExternalCaption(track, { silent: true });
            return alive ? result : null;
        }));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captionInventoryKey]);
'''
new_caption_effect = '''    useEffect(() => {
        if (mode !== "ready" || !externalCaptions.length) return undefined;
        let alive = true;
        let secondaryTimer = null;
        const preferred = externalCaptions.filter((track) => track.language === preferredCaptionLang);
        const english = externalCaptions.filter((track) => track.language === "en" && !preferred.includes(track));
        const rest = externalCaptions.filter((track) => !preferred.includes(track) && !english.includes(track));
        const firstBatch = preferred.length ? preferred : english;

        const loadBatch = async (tracks) => {
            for (let i = 0; alive && i < tracks.length; i += 2) {
                await Promise.allSettled(tracks.slice(i, i + 2).map((track) => loadExternalCaption(track, { silent: true })));
            }
        };

        const primaryDelay = captionsEnabled ? 0 : 1400;
        const primaryTimer = window.setTimeout(async () => {
            await loadBatch(firstBatch);
            if (!alive) return;
            secondaryTimer = window.setTimeout(
                () => loadBatch([...english.filter((track) => !firstBatch.includes(track)), ...rest]),
                captionsEnabled ? 500 : 1800,
            );
        }, primaryDelay);

        return () => {
            alive = false;
            window.clearTimeout(primaryTimer);
            if (secondaryTimer) window.clearTimeout(secondaryTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captionInventoryKey, captionsEnabled, preferredCaptionLang, mode]);
'''
t = replace_once(t, old_caption_effect, new_caption_effect, "staged caption validation")

t = replace_once(t, '                playsInline\n                crossOrigin="anonymous"', '                playsInline\n                preload="auto"\n                crossOrigin="anonymous"', "video preload")
p.write_text(t)

print("Speed patch applied")
