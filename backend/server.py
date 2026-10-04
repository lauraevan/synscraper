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
button,input{{font:inherit}}
button{{-webkit-tap-highlight-color:transparent}}
#stage{{position:fixed;inset:0;background:#000;overflow:hidden}}
video{{width:100%;height:100%;display:block;background:#000;object-fit:contain}}
#stage.controls-hidden{{cursor:none}}
#status{{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;padding:24px;background:#050505;color:#7d7d7d}}
#status b{{color:#eee;font-size:15px;font-weight:650}}
#status small{{max-width:520px;line-height:1.5;color:#5f5f5f}}
#status[hidden]{{display:none}}
#chrome{{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:1;transition:opacity 180ms ease}}
#chrome::after{{content:"";position:absolute;left:0;right:0;bottom:0;height:180px;background:linear-gradient(0deg,rgba(0,0,0,.92),rgba(0,0,0,.54) 45%,transparent);pointer-events:none}}
.controls-hidden #chrome{{opacity:0}}
.controls-hidden #chrome *{{pointer-events:none!important}}
#brand{{position:absolute;top:max(18px,env(safe-area-inset-top));left:max(20px,env(safe-area-inset-left));z-index:2;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:750;letter-spacing:.12em;color:rgba(255,255,255,.78);text-transform:uppercase;pointer-events:none}}
#brand i{{width:5px;height:5px;border-radius:50%;background:#f07a22;display:block}}
#centerPlay{{position:absolute;left:50%;top:50%;z-index:3;transform:translate(-50%,-50%);width:64px;height:64px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(8,8,8,.72);color:#fff;display:grid;place-items:center;pointer-events:auto;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}}
#centerPlay svg{{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}}
#controls{{position:absolute;left:max(18px,env(safe-area-inset-left));right:max(18px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:3;pointer-events:auto}}
#timelineRow{{display:flex;align-items:center;gap:12px;margin-bottom:10px}}
#time{{min-width:94px;color:#bdbdbd;font-size:11px;font-variant-numeric:tabular-nums;text-align:right}}
input[type=range]{{appearance:none;-webkit-appearance:none;height:18px;background:transparent;margin:0}}
input[type=range]::-webkit-slider-runnable-track{{height:3px;border-radius:99px;background:linear-gradient(90deg,#f07a22 0 var(--p,0%),rgba(255,255,255,.22) var(--p,0%) 100%)}}
input[type=range]::-webkit-slider-thumb{{appearance:none;-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#fff;border:0;margin-top:-4px}}
input[type=range]::-moz-range-track{{height:3px;border-radius:99px;background:rgba(255,255,255,.22)}}
input[type=range]::-moz-range-progress{{height:3px;border-radius:99px;background:#f07a22}}
input[type=range]::-moz-range-thumb{{width:11px;height:11px;border:0;border-radius:50%;background:#fff}}
#seek{{width:100%}}
#bottomRow{{display:flex;align-items:center;justify-content:space-between;gap:14px}}
#leftControls,#rightControls{{display:flex;align-items:center;gap:5px}}
.control{{width:38px;height:38px;border:0;border-radius:8px;background:transparent;color:#e8e8e8;display:grid;place-items:center;cursor:pointer}}
.control:hover{{background:rgba(255,255,255,.08)}}
.control svg{{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}}
.skip{{width:43px;font-size:10px;color:#bdbdbd}}
#volume{{width:84px;--p:100%}}
#sourceLabel{{font-size:10px;color:#747474;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-left:6px}}
@media(max-width:640px){{
  #controls{{left:12px;right:12px;bottom:max(10px,env(safe-area-inset-bottom))}}
  #brand{{top:max(12px,env(safe-area-inset-top));left:14px}}
  #centerPlay{{width:58px;height:58px}}
  #volume,#sourceLabel{{display:none}}
  .control{{width:36px;height:36px}}
  .skip{{width:40px}}
  #time{{min-width:82px;font-size:10px}}
}}
</style>
</head>
<body>
<div id="stage">
  <video id="video" autoplay playsinline webkit-playsinline></video>
  <div id="status"><b>Finding a stream</b><small>Connecting to Arc media…</small></div>

  <div id="chrome">
    <div id="brand"><i></i> ARC PLAYER</div>

    <button id="centerPlay" aria-label="Play or pause">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="playPath" d="M9 7.5 16 12l-7 4.5z"></path></svg>
    </button>

    <div id="controls">
      <div id="timelineRow">
        <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
        <div id="time">0:00 / 0:00</div>
      </div>
      <div id="bottomRow">
        <div id="leftControls">
          <button class="control" id="playPause" aria-label="Play or pause">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="playPath" d="M9 7.5 16 12l-7 4.5z"></path></svg>
          </button>
          <button class="control skip" id="back10" aria-label="Back 10 seconds">−10</button>
          <button class="control skip" id="forward10" aria-label="Forward 10 seconds">+10</button>
          <button class="control" id="mute" aria-label="Mute">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h3l4-3v10l-4-3H5z"></path><path id="volumeWave" d="M15 9.5a4 4 0 0 1 0 5"></path></svg>
          </button>
          <input id="volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">
          <span id="sourceLabel"></span>
        </div>
        <div id="rightControls">
          <button class="control" id="fullscreen" aria-label="Fullscreen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"></path></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
(() => {{
  const API = location.pathname.startsWith('/media/v1/') ? '/media/v1' : '/api';
  const TYPE = {media_type!r};
  const ID = {safe_id!r};
  const SEASON = {safe_season};
  const EPISODE = {safe_episode};
  const stage = document.getElementById('stage');
  const video = document.getElementById('video');
  const status = document.getElementById('status');
  const chrome = document.getElementById('chrome');
  const playPause = document.getElementById('playPause');
  const centerPlay = document.getElementById('centerPlay');
  const back10 = document.getElementById('back10');
  const forward10 = document.getElementById('forward10');
  const mute = document.getElementById('mute');
  const volume = document.getElementById('volume');
  const volumeWave = document.getElementById('volumeWave');
  const seek = document.getElementById('seek');
  const time = document.getElementById('time');
  const fullscreen = document.getElementById('fullscreen');
  const sourceLabel = document.getElementById('sourceLabel');
  let hls = null;
  let hideTimer = null;
  let seeking = false;

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
  const formatTime = (seconds) => {{
    if(!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const s=Math.floor(seconds%60);
    const m=Math.floor(seconds/60)%60;
    const h=Math.floor(seconds/3600);
    return h ? h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0') : m+':'+String(s).padStart(2,'0');
  }};
  const setRangeProgress = (input,ratio) => {{
    input.style.setProperty('--p',Math.max(0,Math.min(100,ratio*100))+'%');
  }};
  const setPlayIcon = (playing) => {{
    document.querySelectorAll('.playPath').forEach((path) => {{
      path.setAttribute('d', playing ? 'M8.5 7v10M15.5 7v10' : 'M9 7.5 16 12l-7 4.5z');
    }});
    centerPlay.style.opacity = playing ? '0' : '1';
    centerPlay.style.pointerEvents = playing ? 'none' : 'auto';
  }};
  const showControls = () => {{
    stage.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    if(!video.paused && !video.ended) {{
      hideTimer=setTimeout(()=>stage.classList.add('controls-hidden'),2400);
    }}
  }};
  const updateTimeline = () => {{
    if(!seeking && Number.isFinite(video.duration) && video.duration>0) {{
      const ratio=video.currentTime/video.duration;
      seek.value=String(Math.round(ratio*1000));
      setRangeProgress(seek,ratio);
    }}
    time.textContent=formatTime(video.currentTime)+' / '+formatTime(video.duration);
  }};
  const updateVolume = () => {{
    volume.value=String(video.muted ? 0 : video.volume);
    setRangeProgress(volume,video.muted?0:video.volume);
    volumeWave.style.opacity=(video.muted||video.volume===0)?'0':'1';
  }};
  const togglePlay = () => video.paused ? video.play().catch(()=>{{}}) : video.pause();
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

  playPause.addEventListener('click',togglePlay);
  centerPlay.addEventListener('click',togglePlay);
  video.addEventListener('click',()=>{{togglePlay();showControls()}});
  stage.addEventListener('pointermove',showControls);
  stage.addEventListener('pointerdown',showControls);
  video.addEventListener('play',()=>{{setPlayIcon(true);showControls()}});
  video.addEventListener('pause',()=>{{setPlayIcon(false);showControls()}});
  video.addEventListener('ended',()=>{{setPlayIcon(false);showControls()}});
  video.addEventListener('timeupdate',updateTimeline);
  video.addEventListener('durationchange',updateTimeline);
  back10.addEventListener('click',()=>{{video.currentTime=Math.max(0,video.currentTime-10);showControls()}});
  forward10.addEventListener('click',()=>{{video.currentTime=Math.min(Number.isFinite(video.duration)?video.duration:video.currentTime+10,video.currentTime+10);showControls()}});
  seek.addEventListener('input',()=>{{
    seeking=true;
    setRangeProgress(seek,Number(seek.value)/1000);
    if(Number.isFinite(video.duration)) time.textContent=formatTime((Number(seek.value)/1000)*video.duration)+' / '+formatTime(video.duration);
  }});
  seek.addEventListener('change',()=>{{
    if(Number.isFinite(video.duration)) video.currentTime=(Number(seek.value)/1000)*video.duration;
    seeking=false;
    updateTimeline();
  }});
  volume.addEventListener('input',()=>{{
    video.muted=false;
    video.volume=Number(volume.value);
    updateVolume();
  }});
  mute.addEventListener('click',()=>{{video.muted=!video.muted;updateVolume();showControls()}});
  video.addEventListener('volumechange',updateVolume);
  fullscreen.addEventListener('click',async()=>{{
    try {{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(stage.requestFullscreen) await stage.requestFullscreen();
      else if(video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    }} catch (_) {{}}
    showControls();
  }});
  document.addEventListener('keydown',(event)=>{{
    if(event.target && /input|select|textarea/i.test(event.target.tagName)) return;
    if(event.code==='Space'){{event.preventDefault();togglePlay()}}
    else if(event.code==='ArrowLeft') video.currentTime=Math.max(0,video.currentTime-10);
    else if(event.code==='ArrowRight') video.currentTime=Math.min(Number.isFinite(video.duration)?video.duration:video.currentTime+10,video.currentTime+10);
    else if(event.key.toLowerCase()==='f') fullscreen.click();
    showControls();
  }});
  updateVolume();
  updateTimeline();
  setPlayIcon(false);
  showControls();

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
          sourceLabel.textContent=[server.name||server.provider,server.quality].filter(Boolean).join(' · ');
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
