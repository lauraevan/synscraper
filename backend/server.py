import copy
import logging
import os
import time
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware

import scraper

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

TMDB_TOKEN = os.environ.get("TMDB_TOKEN", "").strip()
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "68e094699525b18a70bab2f86b1fa706").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
UA = scraper.USER_AGENT

app = FastAPI(title="SynScraper API")
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("synscraper")

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


async def tmdb_get(path: str, params: dict | None = None) -> dict:
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


@api_router.get("/")
async def root():
    return {"message": "SynScraper API", "sources": [p[0] for p in scraper.PROVIDERS]}


# ----------------------- TMDB -----------------------
@api_router.get("/tmdb/{full_path:path}")
async def tmdb_proxy(full_path: str, request: Request):
    return await tmdb_get(full_path, dict(request.query_params))


@api_router.get("/home")
async def home_feed():
    import asyncio
    keys = {
        "trending": ("trending/all/week", {}),
        "popular_movies": ("movie/popular", {}),
        "top_rated_movies": ("movie/top_rated", {}),
        "now_playing": ("movie/now_playing", {}),
        "popular_tv": ("tv/popular", {}),
        "top_rated_tv": ("tv/top_rated", {}),
        "upcoming": ("movie/upcoming", {}),
    }
    results = await asyncio.gather(*[tmdb_get(p, q) for p, q in keys.values()], return_exceptions=True)
    return {name: (res.get("results", []) if isinstance(res, dict) else []) for name, res in zip(keys.keys(), results)}


@api_router.get("/search")
async def search(q: str = Query(...), page: int = 1):
    data = await tmdb_get("search/multi", {"query": q, "page": page, "include_adult": "false"})
    data["results"] = [r for r in data.get("results", []) if r.get("media_type") in ("movie", "tv")]
    return data


@api_router.get("/details/{media_type}/{tmdb_id}")
async def details(media_type: str, tmdb_id: int):
    if media_type not in ("movie", "tv"):
        raise HTTPException(400, "media_type must be movie or tv")
    return await tmdb_get(
        f"{media_type}/{tmdb_id}",
        {"append_to_response": "credits,videos,images,similar,recommendations,content_ratings,release_dates"},
    )


@api_router.get("/tv/{tmdb_id}/season/{season}")
async def tv_season(tmdb_id: int, season: int):
    return await tmdb_get(f"tv/{tmdb_id}/season/{season}")


@api_router.get("/genre/{media_type}")
async def genre_list(media_type: str):
    return await tmdb_get(f"genre/{media_type}/list")


@api_router.get("/discover/{media_type}")
async def discover(media_type: str, request: Request):
    params = dict(request.query_params)
    params.setdefault("sort_by", "popularity.desc")
    return await tmdb_get(f"discover/{media_type}", params)


# ----------------------- Stream scraping -----------------------
def _play_url(url, ref, origin):
    q = f"/api/hls?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q


def _caption_url(url, ref, origin):
    q = f"/api/caption?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q


@api_router.get("/streams")
async def streams(type: str = "movie", id: str = Query(...),
                  season: int | None = None, episode: int | None = None,
                  provider: str | None = None, mirror: str | None = None,
                  exclude: str | None = None, title: str | None = None,
                  year: int | None = None, imdb_id: str | None = None):
    metadata_hint = None
    if title:
        metadata_hint = {"title": title, "year": year, "imdbId": imdb_id or ""}
    servers = await scraper.scrape_streams(
        type, id, season, episode, provider_id=provider, mirror=mirror,
        exclude=exclude, metadata_hint=metadata_hint
    )
    out = []
    for s in servers:
        captions = []
        for c in s.get("captions", []):
            captions.append({
                "id": c.get("id"),
                "name": c.get("name") or "WebVTT",
                "lang": c.get("lang") or "und",
                "source": c.get("source") or "vtt",
                "type": "vtt",
                "play_url": _caption_url(c["url"], c.get("referer", ""), c.get("origin", "")),
            })
        out.append({
            "id": s["id"], "name": s["name"], "provider": s["provider"],
            "primary": s["primary"], "type": s["type"], "quality": s["quality"],
            "play_url": _play_url(s["url"], s["referer"], s["origin"]),
            "captions": captions,
        })
    return {"type": type, "id": id, "season": season, "episode": episode,
            "count": len(out), "servers": out}


@api_router.get("/caption")
async def caption(url: str = Query(...), ref: str | None = None,
                  origin: str | None = None):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "caption URL must be http(s)")
    headers = {
        "User-Agent": UA,
        "Accept": "text/vtt,text/plain,application/x-subrip,application/octet-stream,*/*",
    }
    if ref:
        headers["Referer"] = ref
    if origin:
        headers["Origin"] = origin
    try:
        r = await _http().get(url, headers=headers, timeout=20)
        r.raise_for_status()
        if len(r.content) > 5 * 1024 * 1024:
            raise HTTPException(413, "caption file is too large")
        text = r.content.decode("utf-8-sig", errors="replace")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        return Response(
            text,
            media_type="text/vtt",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=120",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("caption proxy failed %s: %s", url[:80], exc)
        raise HTTPException(502, "caption upstream error")


@api_router.get("/hls")
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


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)
