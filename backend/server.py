import copy
import json
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
                 season: int | None = None, episode: int | None = None,
                 title: str | None = None, year: int | None = None):
    media_type = "tv" if type == "tv" else "movie"
    safe_id = "".join(ch for ch in str(id) if ch.isdigit()) or str(id)
    safe_season = max(1, int(season or 1))
    safe_episode = max(1, int(episode or 1))
    display_title = (title or "Arc Media").strip()[:160] or "Arc Media"
    display_meta = (
        f"Season {safe_season} · Episode {safe_episode}"
        if media_type == "tv"
        else (str(year) if year else "Movie")
    )

    template = r"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>__DOC_TITLE__</title>
<script src="https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js"></script>
<style>
:root{--accent:#f07a22;--panel:rgba(12,12,12,.94);--line:rgba(255,255,255,.12);--muted:#8d8d8d}
html,body{margin:0;width:100%;height:100%;background:#000;color:#fff;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
*{box-sizing:border-box}
button,input{font:inherit}
button{-webkit-tap-highlight-color:transparent}
#stage{position:fixed;inset:0;background:#000;overflow:hidden;user-select:none;-webkit-user-select:none}
video{width:100%;height:100%;display:block;background:#000;object-fit:contain}
#stage.controls-hidden{cursor:none}
#shadeTop,#shadeBottom{position:absolute;left:0;right:0;z-index:4;pointer-events:none;transition:opacity .18s ease}
#shadeTop{top:0;height:140px;background:linear-gradient(180deg,rgba(0,0,0,.72),transparent)}
#shadeBottom{bottom:0;height:210px;background:linear-gradient(0deg,rgba(0,0,0,.9),rgba(0,0,0,.48) 50%,transparent)}
.controls-hidden #shadeTop,.controls-hidden #shadeBottom,.controls-hidden #topbar,.controls-hidden #centerControls,.controls-hidden #controls{opacity:0}
#topbar,#centerControls,#controls{transition:opacity .18s ease}
#topbar{position:absolute;top:0;left:0;right:0;z-index:7;display:flex;align-items:flex-start;padding:max(20px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) 0 max(24px,env(safe-area-inset-left));pointer-events:none}
#identity{display:flex;align-items:flex-start;gap:12px;min-width:0}
#mark{display:flex;align-items:center;gap:7px;height:30px;flex:0 0 auto;font-size:10px;font-weight:780;letter-spacing:.13em;color:#d8d8d8}
#mark i{width:5px;height:5px;border-radius:50%;background:var(--accent)}
#titleWrap{min-width:0}
#title{font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(58vw,680px)}
#meta{font-size:10px;color:#8b8b8b;margin-top:3px;letter-spacing:.02em}
#centerControls{position:absolute;left:50%;top:50%;z-index:7;transform:translate(-50%,-50%);display:flex;align-items:center;gap:22px;pointer-events:auto}
.centerBtn{position:relative;border:0;color:#fff;background:rgba(0,0,0,.34);display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);transition:transform .14s ease,background .14s ease}
.centerBtn:hover{transform:scale(1.045);background:rgba(0,0,0,.5)}
.centerBtn.skip{width:48px;height:48px;border-radius:50%}
.centerBtn.skip svg{width:26px;height:26px;display:block}
.centerBtn.skip .ten{position:absolute;left:50%;top:50%;transform:translate(-50%,-44%);font-size:7px;font-weight:800;letter-spacing:-.04em;pointer-events:none}
#centerPlay{width:68px;height:68px;border-radius:50%;background:#fff;color:#0a0a0a}
#centerPlay:hover{background:#f2f2f2}
#centerPlay svg{width:27px;height:27px}
#controls{position:absolute;z-index:7;left:max(20px,env(safe-area-inset-left));right:max(20px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));pointer-events:auto}
#timeline{position:relative;height:22px;display:flex;align-items:center}
#seek{width:100%;height:22px;margin:0;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;--p:0%;--b:0%}
#seek::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,var(--accent) 0 var(--p),rgba(255,255,255,.34) var(--p) var(--b),rgba(255,255,255,.16) var(--b) 100%)}
#seek::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;border:0;margin-top:-4px;box-shadow:none}
#seek::-moz-range-track{height:4px;border-radius:99px;background:rgba(255,255,255,.16)}
#seek::-moz-range-progress{height:4px;border-radius:99px;background:var(--accent)}
#seek::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
#controlRow{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:5px}
#leftControls,#rightControls{display:flex;align-items:center;gap:3px}
.control{height:38px;min-width:38px;border:0;border-radius:7px;background:transparent;color:#f0f0f0;display:grid;place-items:center;cursor:pointer;padding:0 8px;transition:opacity .14s ease,background .14s ease}
.control:hover,.control.active{background:rgba(255,255,255,.08)}
.control svg{width:21px;height:21px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#volume{width:78px;height:18px;margin:0 6px 0 1px;appearance:none;-webkit-appearance:none;background:transparent;--p:100%}
#volume::-webkit-slider-runnable-track{height:3px;border-radius:99px;background:linear-gradient(90deg,#fff 0 var(--p),rgba(255,255,255,.22) var(--p) 100%)}
#volume::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#fff;border:0;margin-top:-3.5px}
#volume::-moz-range-track{height:3px;background:rgba(255,255,255,.22)}
#volume::-moz-range-progress{height:3px;background:#fff}
#volume::-moz-range-thumb{width:10px;height:10px;border:0;border-radius:50%;background:#fff}
#time{font-size:10px;color:#a7a7a7;font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:4px}
.textControl{font-size:10px;color:#c4c4c4;padding:0 10px;min-width:auto}

#menu{position:absolute;z-index:9;right:max(20px,env(safe-area-inset-right));bottom:72px;width:min(390px,calc(100vw - 28px));max-height:min(440px,65vh);background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.4);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);pointer-events:auto}
#menu[hidden]{display:none}
#menuTabs{display:flex;gap:2px;padding:8px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
#menuTabs::-webkit-scrollbar{display:none}
.tab{height:32px;border:0;border-radius:7px;background:transparent;color:#8e8e8e;padding:0 10px;font-size:10px;cursor:pointer;white-space:nowrap}
.tab.active{background:rgba(255,255,255,.09);color:#fff}
#menuBody{padding:8px;overflow:auto;max-height:360px}
.menuItem{width:100%;min-height:42px;border:0;border-radius:8px;background:transparent;color:#d8d8d8;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:8px 10px;cursor:pointer}
.menuItem:hover,.menuItem.active{background:rgba(255,255,255,.08)}
.menuItem b{font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.menuItem span{font-size:10px;color:#777;white-space:nowrap}
.menuItem .check{color:var(--accent);font-weight:800}
#status{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;text-align:center;padding:24px;background:#050505;color:#777}
#status b{color:#eee;font-size:15px;font-weight:650}
#status small{max-width:520px;line-height:1.5;color:#626262}
#status[hidden]{display:none}
.spinner{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.16);border-top-color:#fff;animation:spin .8s linear infinite;margin-bottom:4px}
@keyframes spin{to{transform:rotate(360deg)}}
#buffering{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.18);border-top-color:#fff;animation:spin .8s linear infinite;pointer-events:none}
#buffering[hidden]{display:none}
#toast{position:absolute;z-index:10;left:50%;top:42%;transform:translate(-50%,-50%);background:rgba(12,12,12,.82);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 11px;color:#e8e8e8;font-size:11px;opacity:0;transition:opacity .15s ease;pointer-events:none}
#toast.show{opacity:1}
@media(max-width:720px){
  #topbar{padding-top:max(12px,env(safe-area-inset-top));padding-left:14px;padding-right:14px}
  #mark{display:none}
  #title{max-width:58vw;font-size:13px}
  #meta{font-size:9px}
  #topActions .desktopOnly{display:none}
  #controls{left:12px;right:12px;bottom:max(9px,env(safe-area-inset-bottom))}
  #volume,#sourceBadge,.desktopOnlyControl{display:none}
  #centerControls{gap:12px}
  #centerPlay{width:66px;height:66px}
  .centerBtn.skip{width:50px;height:50px}
  .control{height:36px;min-width:36px;padding:0 7px}
  #time{font-size:9px;margin-left:2px}
  #menu{right:12px;bottom:62px;width:calc(100vw - 24px);max-height:58vh}
  #menuBody{max-height:calc(58vh - 50px)}
}
@media(max-width:430px){
  #rightControls .hideTiny{display:none}
  #centerControls{gap:9px}
  .centerBtn.skip{width:46px;height:46px}
  #centerPlay{width:62px;height:62px}
}
</style>
</head>
<body>
<div id="stage">
  <video id="video" autoplay playsinline webkit-playsinline></video>
  <div id="shadeTop"></div>
  <div id="shadeBottom"></div>

  <div id="topbar">
    <div id="identity">
      <div id="mark"><i></i> ARC</div>
      <div id="titleWrap">
        <div id="title">__TITLE__</div>
        <div id="meta">__META__</div>
      </div>
    </div>
  </div>

  <div id="centerControls">
    <button class="centerBtn skip" id="back10Center" aria-label="Back 10 seconds"><i data-lucide="rotate-ccw"></i><span class="ten">10</span></button>
    <button class="centerBtn" id="centerPlay" aria-label="Play or pause"><span class="playGlyph"></span></button>
    <button class="centerBtn skip" id="forward10Center" aria-label="Forward 10 seconds"><i data-lucide="rotate-cw"></i><span class="ten">10</span></button>
  </div>

  <div id="controls">
    <div id="timeline">
      <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
    </div>
    <div id="controlRow">
      <div id="leftControls">
        <button class="control" id="playPause" aria-label="Play or pause"><span class="playGlyph"></span></button>
        <button class="control desktopOnlyControl" id="back10" aria-label="Back 10 seconds"><i data-lucide="rotate-ccw"></i></button>
        <button class="control desktopOnlyControl" id="forward10" aria-label="Forward 10 seconds"><i data-lucide="rotate-cw"></i></button>
        <button class="control" id="mute" aria-label="Mute"><span id="volumeGlyph"></span></button>
        <input id="volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">
        <div id="time">0:00 / 0:00</div>
      </div>
      <div id="rightControls">
        <button class="control hideTiny" id="captionBtn" aria-label="Captions"><i data-lucide="captions"></i></button>
        <button class="control" id="pipBtn" aria-label="Picture in picture"><i data-lucide="picture-in-picture-2"></i></button>
        <button class="control" id="settingsBtn" aria-label="Playback settings"><i data-lucide="sliders-horizontal"></i></button>
        <button class="control" id="fullscreen" aria-label="Fullscreen"><i data-lucide="maximize"></i></button>
      </div>
    </div>
  </div>

  <div id="menu" hidden>
    <div id="menuTabs">
      <button class="tab active" data-tab="quality">Quality</button>
      <button class="tab" data-tab="captions">Captions</button>
      <button class="tab" data-tab="speed">Speed</button>
      <button class="tab" data-tab="source">Sources</button>
    </div>
    <div id="menuBody"></div>
  </div>

  <div id="buffering" hidden></div>
  <div id="toast"></div>
  <div id="status"><div class="spinner"></div><b>Finding a stream</b><small>Connecting to Arc media…</small></div>
</div>

<script>
(() => {
  const API = location.pathname.startsWith('/media/v1/') ? '/media/v1' : '/api';
  const TYPE = __TYPE__;
  const ID = __ID__;
  const SEASON = __SEASON__;
  const EPISODE = __EPISODE__;

  const $ = (id) => document.getElementById(id);
  const stage=$('stage'), video=$('video'), status=$('status'), buffering=$('buffering');
  const seek=$('seek'), volume=$('volume'), time=$('time'), menu=$('menu'), menuBody=$('menuBody');
  const playPause=$('playPause'), centerPlay=$('centerPlay'), mute=$('mute');
  const fullscreen=$('fullscreen'), pipBtn=$('pipBtn');
  const settingsBtn=$('settingsBtn'), captionBtn=$('captionBtn');
  let hls=null, servers=[], activeServerIndex=-1, activeServer=null, hideTimer=null, toastTimer=null;
  let seeking=false, menuTab='quality', switching=false;

  const absolute=(url)=>!url?'':(/^https?:\/\//i.test(url)?url:(url.startsWith('/')?url:'/'+url));
  const fmt=(s)=>{
    if(!Number.isFinite(s)||s<0)return '0:00';
    const sec=Math.floor(s%60), min=Math.floor(s/60)%60, hr=Math.floor(s/3600);
    return hr?hr+':'+String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0'):min+':'+String(sec).padStart(2,'0');
  };
  const toast=(text)=>{
    const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),700);
  };
  const setStatus=(title,detail='')=>{
    status.hidden=false;
    status.innerHTML='<div class="spinner"></div><b></b><small></small>';
    status.querySelector('b').textContent=title;
    status.querySelector('small').textContent=detail;
  };
  const clearStatus=()=>{status.hidden=true};
  const setRange=(el,played,buffered=null)=>{
    el.style.setProperty('--p',Math.max(0,Math.min(100,played*100))+'%');
    if(buffered!==null)el.style.setProperty('--b',Math.max(0,Math.min(100,buffered*100))+'%');
  };
  const renderLucide=()=>{
    try{window.lucide?.createIcons({attrs:{'stroke-width':'1.8'}})}catch(_){}
  };
  const setPlayIcon=(playing)=>{
    document.querySelectorAll('.playGlyph').forEach((el)=>{el.innerHTML='<i data-lucide="'+(playing?'pause':'play')+'"></i>'});
    renderLucide();
  };
  const setVolumeIcon=(muted)=>{
    $('volumeGlyph').innerHTML='<i data-lucide="'+(muted?'volume-x':'volume-2')+'"></i>';
    renderLucide();
  };
  const showControls=()=>{
    stage.classList.remove('controls-hidden');clearTimeout(hideTimer);
    if(!video.paused&&!video.ended&&!menu.hidden) return;
    if(!video.paused&&!video.ended) hideTimer=setTimeout(()=>stage.classList.add('controls-hidden'),2600);
  };
  const togglePlay=()=>video.paused?video.play().catch(()=>{}):video.pause();
  const skip=(amount)=>{
    video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:Infinity,video.currentTime+amount));
    toast((amount>0?'+':'')+amount+'s');showControls();
  };
  const updateTimeline=()=>{
    let played=0,bufferedRatio=0;
    if(Number.isFinite(video.duration)&&video.duration>0){
      played=video.currentTime/video.duration;
      if(video.buffered&&video.buffered.length){
        try{bufferedRatio=video.buffered.end(video.buffered.length-1)/video.duration}catch(_){}
      }
      if(!seeking)seek.value=String(Math.round(played*1000));
    }
    setRange(seek,played,Math.max(played,bufferedRatio));
    time.textContent=fmt(video.currentTime)+' / '+fmt(video.duration);
  };
  const updateVolume=()=>{
    const v=video.muted?0:video.volume;volume.value=String(v);setRange(volume,v);
    setVolumeIcon(v===0);
  };
  const clearTracks=()=>{
    Array.from(video.querySelectorAll('track')).forEach((t)=>t.remove());
  };
  const applyCaptions=(server)=>{
    clearTracks();
    (server?.captions||[]).forEach((cap,index)=>{
      const track=document.createElement('track');
      track.kind='subtitles';
      track.label=cap.label||cap.language||cap.lang||('Subtitle '+(index+1));
      track.srclang=cap.lang||cap.language||'en';
      track.src=absolute(cap.play_url||cap.url||'');
      video.appendChild(track);
    });
    setTimeout(()=>renderMenu(menuTab),80);
  };
  const activeCaptionIndex=()=>{
    const tracks=Array.from(video.textTracks||[]);
    return tracks.findIndex((t)=>t.mode==='showing');
  };
  const setCaption=(index)=>{
    Array.from(video.textTracks||[]).forEach((t,i)=>t.mode=i===index?'showing':'disabled');
    captionBtn.classList.toggle('active',index>=0);
    renderMenu('captions');
  };
  const destroySource=()=>{
    try{hls?.destroy()}catch(_){}
    hls=null;
    try{video.pause()}catch(_){}
    video.removeAttribute('src');
    try{video.load()}catch(_){}
  };
  const waitNative=(timeout=14000)=>new Promise((resolve,reject)=>{
    let done=false;
    const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener('loadedmetadata',ok);video.removeEventListener('canplay',ok);video.removeEventListener('error',bad);err?reject(err):resolve()};
    const ok=()=>finish(),bad=()=>finish(new Error('Video source failed')),timer=setTimeout(()=>finish(new Error('Video source timed out')),timeout);
    video.addEventListener('loadedmetadata',ok);video.addEventListener('canplay',ok);video.addEventListener('error',bad);
  });
  const loadHlsLib=()=>new Promise((resolve,reject)=>{
    if(window.Hls)return resolve(window.Hls);
    const urls=['https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js','https://unpkg.com/hls.js@1/dist/hls.min.js'];
    let i=0;
    const next=()=>{
      if(i>=urls.length)return reject(new Error('HLS player library could not load'));
      const s=document.createElement('script');s.src=urls[i++];s.onload=()=>window.Hls?resolve(window.Hls):next();s.onerror=()=>{s.remove();next()};document.head.appendChild(s);
    };next();
  });
  const runtimeFailover=async()=>{
    if(switching||servers.length<2)return;
    const next=(activeServerIndex+1)%servers.length;
    if(next===activeServerIndex)return;
    try{await switchServer(next,true)}catch(_){}
  };
  const attachServer=async(server)=>{
    destroySource();
    const url=absolute(server.play_url||'');
    if(!url)throw new Error('Missing playback URL');
    const isHls=server.type==='hls'||/\.m3u8(?:$|\?)/i.test(url);
    if(isHls&&video.canPlayType('application/vnd.apple.mpegurl')){
      video.src=url;video.load();await waitNative();return;
    }
    if(isHls){
      const Hls=await loadHlsLib();
      if(!Hls?.isSupported())throw new Error('HLS is not supported here');
      hls=new Hls({enableWorker:true,lowLatencyMode:false,manifestLoadingTimeOut:10000,levelLoadingTimeOut:10000,fragLoadingTimeOut:12000,manifestLoadingMaxRetry:2,levelLoadingMaxRetry:2,fragLoadingMaxRetry:3});
      await new Promise((resolve,reject)=>{
        let settled=false;
        const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('HLS source timed out'))}},15000);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(settled)return;settled=true;clearTimeout(timer);resolve()});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data?.fatal&&!settled){settled=true;clearTimeout(timer);reject(new Error('HLS source failed'))}});
        hls.loadSource(url);hls.attachMedia(video);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED,()=>renderMenu(menuTab));
      hls.on(Hls.Events.ERROR,(_event,data)=>{if(data?.fatal)runtimeFailover()});
      return;
    }
    video.src=url;video.load();await waitNative();
  };
  const serverLabel=(server,index)=>server?.name||server?.provider||('Source '+(index+1));
  const switchServer=async(index,automatic=false)=>{
    if(switching||!servers[index])return;
    switching=true;
    const resumeAt=video.currentTime||0,shouldPlay=!video.paused||video.currentTime===0;
    const server=servers[index];
    setStatus(automatic?'Recovering playback':'Switching source',serverLabel(server,index));
    try{
      await attachServer(server);
      activeServerIndex=index;activeServer=server;applyCaptions(server);
      if(resumeAt>0&&Number.isFinite(video.duration))video.currentTime=Math.min(resumeAt,Math.max(0,video.duration-1));
      clearStatus();renderMenu(menuTab);
      if(shouldPlay)video.play().catch(()=>{});
    }finally{switching=false}
  };
  const renderQuality=()=>{
    const items=[];
    if(hls&&Array.isArray(hls.levels)&&hls.levels.length){
      items.push({label:'Auto',detail:'Adaptive',active:hls.currentLevel===-1,click:()=>{hls.currentLevel=-1;renderMenu('quality')}});
      const seen=new Set();
      hls.levels.map((l,i)=>({i,h:l.height||0,b:l.bitrate||0})).sort((a,b)=>b.h-a.h).forEach((x)=>{
        const key=x.h||x.b;if(seen.has(key))return;seen.add(key);
        items.push({label:x.h?x.h+'p':Math.round(x.b/1000)+' kbps',detail:'',active:hls.currentLevel===x.i,click:()=>{hls.currentLevel=x.i;renderMenu('quality')}});
      });
    }else{
      items.push({label:'Auto',detail:'Managed by your device',active:true,click:()=>{}});
    }
    return items;
  };
  const renderCaptions=()=>{
    const tracks=Array.from(video.textTracks||[]);
    return [{label:'Off',detail:'',active:activeCaptionIndex()<0,click:()=>setCaption(-1)}].concat(tracks.map((t,i)=>({label:t.label||('Subtitle '+(i+1)),detail:t.language||'',active:t.mode==='showing',click:()=>setCaption(i)})));
  };
  const renderSpeed=()=>[.5,.75,1,1.25,1.5,1.75,2].map((v)=>({label:v+'×',detail:v===1?'Normal':'',active:Math.abs(video.playbackRate-v)<.01,click:()=>{video.playbackRate=v;renderMenu('speed')}}));
  const renderSources=()=>servers.map((s,i)=>({label:serverLabel(s,i),detail:[s.provider,s.quality].filter(Boolean).join(' · '),active:i===activeServerIndex,click:()=>switchServer(i,false)}));
  const renderMenu=(tab=menuTab)=>{
    menuTab=tab;
    document.querySelectorAll('.tab').forEach((b)=>b.classList.toggle('active',b.dataset.tab===tab));
    const items=tab==='quality'?renderQuality():tab==='captions'?renderCaptions():tab==='speed'?renderSpeed():renderSources();
    menuBody.innerHTML='';
    items.forEach((item)=>{
      const b=document.createElement('button');b.className='menuItem'+(item.active?' active':'');
      const left=document.createElement('b');left.textContent=item.label;
      const right=document.createElement('span');right.textContent=item.active?'✓':(item.detail||'');if(item.active)right.className='check';
      b.append(left,right);b.onclick=async()=>{await item.click();if(tab==='source')menu.hidden=true;showControls()};
      menuBody.appendChild(b);
    });
  };
  const openMenu=(tab='quality')=>{
    menu.hidden=false;renderMenu(tab);stage.classList.remove('controls-hidden');clearTimeout(hideTimer);
  };
  const toggleMenu=(tab='quality')=>{
    if(!menu.hidden&&menuTab===tab){menu.hidden=true;showControls();return}
    openMenu(tab);
  };
  const doPip=async()=>{
    try{
      if(document.pictureInPictureElement)await document.exitPictureInPicture();
      else if(document.pictureInPictureEnabled&&video.requestPictureInPicture)await video.requestPictureInPicture();
      else if(video.webkitSetPresentationMode)video.webkitSetPresentationMode('picture-in-picture');
    }catch(_){}
  };
  const doFullscreen=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(stage.requestFullscreen)await stage.requestFullscreen();
      else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
    }catch(_){}
    showControls();
  };

  playPause.onclick=togglePlay;centerPlay.onclick=togglePlay;
  $('back10').onclick=()=>skip(-10);$('forward10').onclick=()=>skip(10);$('back10Center').onclick=()=>skip(-10);$('forward10Center').onclick=()=>skip(10);
  mute.onclick=()=>{video.muted=!video.muted;updateVolume();showControls()};
  volume.oninput=()=>{video.muted=false;video.volume=Number(volume.value);updateVolume()};
  seek.oninput=()=>{seeking=true;setRange(seek,Number(seek.value)/1000);if(Number.isFinite(video.duration))time.textContent=fmt((Number(seek.value)/1000)*video.duration)+' / '+fmt(video.duration)};
  seek.onchange=()=>{if(Number.isFinite(video.duration))video.currentTime=(Number(seek.value)/1000)*video.duration;seeking=false;updateTimeline()};
  fullscreen.onclick=doFullscreen;pipBtn.onclick=doPip;
  settingsBtn.onclick=()=>toggleMenu(menuTab);
  captionBtn.onclick=()=>toggleMenu('captions');
  document.querySelectorAll('.tab').forEach((b)=>b.onclick=()=>renderMenu(b.dataset.tab));
  stage.addEventListener('pointermove',showControls);
  stage.addEventListener('pointerdown',(e)=>{if(!menu.contains(e.target)&&!settingsBtn.contains(e.target)&&!settingsTop.contains(e.target))menu.hidden=true;showControls()});
  video.addEventListener('click',()=>{if(stage.classList.contains('controls-hidden'))showControls();else togglePlay()});
  video.addEventListener('dblclick',(e)=>skip(e.clientX<innerWidth/2?-10:10));
  video.addEventListener('play',()=>{setPlayIcon(true);buffering.hidden=true;showControls()});
  video.addEventListener('pause',()=>{setPlayIcon(false);showControls()});
  video.addEventListener('playing',()=>{buffering.hidden=true});
  video.addEventListener('waiting',()=>{if(status.hidden)buffering.hidden=false});
  video.addEventListener('canplay',()=>{buffering.hidden=true});
  video.addEventListener('ended',()=>{setPlayIcon(false);showControls()});
  video.addEventListener('timeupdate',updateTimeline);
  video.addEventListener('progress',updateTimeline);
  video.addEventListener('durationchange',updateTimeline);
  video.addEventListener('volumechange',updateVolume);
  document.addEventListener('keydown',(e)=>{
    if(e.target&&/input|select|textarea/i.test(e.target.tagName))return;
    const key=e.key.toLowerCase();
    if(e.code==='Space'||key==='k'){e.preventDefault();togglePlay()}
    else if(key==='j'||e.key==='ArrowLeft')skip(-10);
    else if(key==='l'||e.key==='ArrowRight')skip(10);
    else if(key==='m'){video.muted=!video.muted;updateVolume()}
    else if(key==='f')doFullscreen();
    else if(key==='c')toggleMenu('captions');
    showControls();
  });
  if(!document.pictureInPictureEnabled&&!video.webkitSetPresentationMode){pipBtn.style.display='none'}
  renderLucide();updateVolume();updateTimeline();setPlayIcon(false);showControls();

  (async()=>{
    try{
      const params=new URLSearchParams({type:TYPE,id:ID});
      if(TYPE==='tv'){params.set('season',String(SEASON));params.set('episode',String(EPISODE))}
      const response=await fetch(API+'/streams?'+params.toString(),{cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.detail||payload.error||'Stream lookup failed');
      servers=Array.isArray(payload.servers)?payload.servers:[];
      if(!servers.length)throw new Error('No stream sources were returned');
      renderMenu('source');
      let lastError=null;
      for(let i=0;i<servers.length;i++){
        try{await switchServer(i,false);return}catch(err){lastError=err;switching=false}
      }
      throw lastError||new Error('All available stream sources failed');
    }catch(err){
      destroySource();setStatus('Playback unavailable',err?.message||'Could not start this title');
    }
  })();
})();
</script>
</body>
</html>"""

    html = (
        template
        .replace("__DOC_TITLE__", display_title.replace("<", "").replace(">", ""))
        .replace("__TITLE__", display_title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        .replace("__META__", display_meta.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        .replace("__TYPE__", json.dumps(media_type))
        .replace("__ID__", json.dumps(safe_id))
        .replace("__SEASON__", str(safe_season))
        .replace("__EPISODE__", str(safe_episode))
    )
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
