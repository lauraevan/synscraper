import copy
import logging
import os
import time
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware

import scraper

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

TMDB_TOKEN = os.environ.get("TMDB_TOKEN", "").strip()
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "68e094699525b18a70bab2f86b1fa706").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
UA = scraper.USER_AGENT
SYNSCRAPER_FALLBACK_ORIGIN = os.environ.get("SYNSCRAPER_FALLBACK_ORIGIN", "https://synscraper-tffk.vercel.app").strip().rstrip("/")
PUBLIC_API_PREFIX = (os.environ.get("PUBLIC_API_PREFIX", "/api").strip() or "/api").rstrip("/")
if not PUBLIC_API_PREFIX.startswith("/"):
    PUBLIC_API_PREFIX = "/" + PUBLIC_API_PREFIX

app = FastAPI(title="SynScraper API")
api_router = APIRouter(prefix="/api")

@app.middleware("http")
async def public_api_prefix_alias(request: Request, call_next):
    if PUBLIC_API_PREFIX != "/api":
        path = request.scope.get("path", "")
        if path == PUBLIC_API_PREFIX or path.startswith(PUBLIC_API_PREFIX + "/"):
            suffix = path[len(PUBLIC_API_PREFIX):]
            request.scope["path"] = "/api" + suffix
            request.scope["raw_path"] = request.scope["path"].encode("utf-8")
    return await call_next(request)
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
    q = f"{PUBLIC_API_PREFIX}/hls?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q


def _localize_fallback_proxy_url(value: str, endpoint: str) -> str:
    from urllib.parse import urlsplit

    raw = str(value or "").strip()
    if not raw:
        return raw
    try:
        parsed = urlsplit(raw)
        path = parsed.path if parsed.scheme else raw.split("?", 1)[0]
        query = parsed.query if parsed.scheme else (raw.split("?", 1)[1] if "?" in raw else "")
        if path.endswith(f"/{endpoint}") and query:
            return f"{PUBLIC_API_PREFIX}/{endpoint}?{query}"
    except Exception:
        pass
    return raw


def _caption_url(url, ref, origin):
    q = f"{PUBLIC_API_PREFIX}/caption?url={quote(url, safe='')}"
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
    fallback_used = False
    if not out and SYNSCRAPER_FALLBACK_ORIGIN:
        try:
            params = {
                "type": type,
                "id": id,
                "season": season,
                "episode": episode,
                "provider": provider,
                "mirror": mirror,
                "exclude": exclude,
                "title": title,
                "year": year,
                "imdb_id": imdb_id,
            }
            params = {k: v for k, v in params.items() if v is not None and v != ""}
            fallback_response = await _http().get(
                f"{SYNSCRAPER_FALLBACK_ORIGIN}/api/streams",
                params=params,
                timeout=60.0,
            )
            if fallback_response.status_code < 400:
                payload = fallback_response.json()
                fallback_servers = payload.get("servers", []) if isinstance(payload, dict) else []
                for item in fallback_servers:
                    if not isinstance(item, dict):
                        continue
                    server = dict(item)
                    server["play_url"] = _localize_fallback_proxy_url(server.get("play_url", ""), "hls")
                    captions = []
                    for caption_item in server.get("captions", []) or []:
                        if not isinstance(caption_item, dict):
                            continue
                        caption_copy = dict(caption_item)
                        caption_copy["play_url"] = _localize_fallback_proxy_url(caption_copy.get("play_url", ""), "caption")
                        captions.append(caption_copy)
                    server["captions"] = captions
                    if server.get("play_url"):
                        out.append(server)
                fallback_used = bool(out)
            else:
                logger.warning(
                    "fallback streams returned HTTP %s for %s:%s",
                    fallback_response.status_code,
                    type,
                    id,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("fallback streams failed for %s:%s: %s", type, id, exc)

    logger.info(
        "streams resolved type=%s id=%s count=%d fallback=%s providers=%s",
        type,
        id,
        len(out),
        fallback_used,
        ",".join(sorted({str(item.get("provider") or "unknown") for item in out})) if out else "none",
    )
    return {"type": type, "id": id, "season": season, "episode": episode,
            "count": len(out), "servers": out}



@api_router.get("/player", response_class=HTMLResponse)
async def player(type: str = "movie", id: str = Query(...),
                 season: int | None = None, episode: int | None = None):
    media_type = "tv" if type == "tv" else "movie"
    safe_id = "".join(ch for ch in str(id) if ch.isdigit()) or str(id)
    safe_season = max(1, int(season or 1))
    safe_episode = max(1, int(episode or 1))
    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Arc Player</title>
<style>
html,body{{margin:0;width:100%;height:100%;background:#000;color:#fff;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}}
*{{box-sizing:border-box}}
#stage{{position:fixed;inset:0;background:#000;display:grid;place-items:center}}
video{{width:100%;height:100%;background:#000;object-fit:contain}}
#status{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;padding:24px;background:#050505;color:#8a8a8a}}
#status b{{color:#eee;font-size:16px}}
#status small{{max-width:520px;line-height:1.5;color:#666}}
#status[hidden]{{display:none}}
</style>
</head>
<body>
<div id="stage">
  <video id="video" controls autoplay playsinline webkit-playsinline></video>
  <div id="status"><b>Finding a stream</b><small>Connecting to Arc media…</small></div>
</div>
<script>
(() => {{
  const API = location.pathname.startsWith('/media/v1/') ? '/media/v1' : '/api';
  const TYPE = {media_type!r};
  const ID = {safe_id!r};
  const SEASON = {safe_season};
  const EPISODE = {safe_episode};
  const video = document.getElementById('video');
  const status = document.getElementById('status');
  let hls = null;

  const setStatus = (title, detail='') => {{
    status.hidden = false;
    status.innerHTML = '<b></b><small></small>';
    status.querySelector('b').textContent = title;
    status.querySelector('small').textContent = detail;
  }};
  const clearStatus = () => {{ status.hidden = true; }};
  const absolute = (url) => {{
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/') ? url : '/' + url;
  }};
  const destroy = () => {{
    try {{ if (hls) hls.destroy(); }} catch (_) {{}}
    hls = null;
    try {{ video.pause(); }} catch (_) {{}}
    video.removeAttribute('src');
    try {{ video.load(); }} catch (_) {{}}
  }};
  const waitNative = (timeout=13000) => new Promise((resolve,reject) => {{
    let done=false;
    const finish=(err) => {{
      if(done) return;
      done=true;
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata',ok);
      video.removeEventListener('canplay',ok);
      video.removeEventListener('error',bad);
      err ? reject(err) : resolve();
    }};
    const ok=()=>finish();
    const bad=()=>finish(new Error('Video source failed'));
    const timer=setTimeout(()=>finish(new Error('Video source timed out')),timeout);
    video.addEventListener('loadedmetadata',ok);
    video.addEventListener('canplay',ok);
    video.addEventListener('error',bad);
  }});
  const loadHlsLib = () => new Promise((resolve,reject) => {{
    if (window.Hls) return resolve(window.Hls);
    const urls = [
      'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
      'https://unpkg.com/hls.js@1/dist/hls.min.js'
    ];
    let index=0;
    const next=()=>{{
      if(index>=urls.length) return reject(new Error('HLS player library could not load'));
      const script=document.createElement('script');
      script.src=urls[index++];
      script.onload=()=>window.Hls ? resolve(window.Hls) : next();
      script.onerror=()=>{{script.remove();next();}};
      document.head.appendChild(script);
    }};
    next();
  }});
  const tryServer = async (server) => {{
    destroy();
    const url = absolute(server.play_url || '');
    if (!url) throw new Error('Missing playback URL');
    const isHls = server.type === 'hls' || /\.m3u8(?:$|\?)/i.test(url);
    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {{
      video.src = url;
      video.load();
      await waitNative();
      return;
    }}
    if (isHls) {{
      const Hls = await loadHlsLib();
      if (!Hls || !Hls.isSupported()) throw new Error('HLS is not supported by this browser');
      hls = new Hls({{
        enableWorker:true,
        lowLatencyMode:false,
        manifestLoadingTimeOut:10000,
        levelLoadingTimeOut:10000,
        fragLoadingTimeOut:12000,
        manifestLoadingMaxRetry:2,
        levelLoadingMaxRetry:2,
        fragLoadingMaxRetry:3
      }});
      await new Promise((resolve,reject) => {{
        let settled=false;
        const timer=setTimeout(()=>{{
          if(settled) return;
          settled=true;
          reject(new Error('HLS source timed out'));
        }},15000);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{{
          if(settled) return;
          settled=true;
          clearTimeout(timer);
          resolve();
        }});
        hls.on(Hls.Events.ERROR,(_event,data)=>{{
          if(!data || !data.fatal || settled) return;
          settled=true;
          clearTimeout(timer);
          reject(new Error('HLS source failed'));
        }});
        hls.loadSource(url);
        hls.attachMedia(video);
      }});
      return;
    }}
    video.src=url;
    video.load();
    await waitNative();
  }};

  (async () => {{
    try {{
      const params = new URLSearchParams({{type:TYPE,id:ID}});
      if(TYPE === 'tv') {{
        params.set('season', String(SEASON));
        params.set('episode', String(EPISODE));
      }}
      const response = await fetch(API + '/streams?' + params.toString(), {{cache:'no-store'}});
      const payload = await response.json().catch(()=>({{}}));
      if(!response.ok) throw new Error(payload.detail || payload.error || 'Stream lookup failed');
      const servers = Array.isArray(payload.servers) ? payload.servers : [];
      if(!servers.length) throw new Error('No stream sources were returned');
      let lastError = null;
      for(let i=0;i<servers.length;i++) {{
        const server = servers[i];
        setStatus('Trying ' + (server.name || server.provider || ('source ' + (i+1))), server.quality || '');
        try {{
          await tryServer(server);
          clearStatus();
          video.play().catch(()=>{{}});
          return;
        }} catch (err) {{
          lastError = err;
        }}
      }}
      throw lastError || new Error('All available stream sources failed');
    }} catch (err) {{
      destroy();
      setStatus('Playback unavailable', err && err.message ? err.message : 'Could not start this title');
    }}
  }})();
}})();
</script>
</body>
</html>"""
    return HTMLResponse(
        html,
        headers={
            "Cache-Control": "no-store",
            "X-Arc-Player": "synscraper",
        },
    )


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
            if PUBLIC_API_PREFIX != "/api":
                body = body.replace("/api/hls?", f"{PUBLIC_API_PREFIX}/hls?")
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
