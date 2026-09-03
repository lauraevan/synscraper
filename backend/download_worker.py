"""SynScraper HLS -> MP4 download worker.

Run this service on a normal host/VPS/container with FFmpeg installed. It intentionally
accepts only media resolved by SynScraper providers; callers cannot pass arbitrary
upstream URLs. The worker resolves the selected provider/mirror/quality, pins an exact
HLS variant when requested, then streams FFmpeg's remuxed MP4 to the client.
"""

import asyncio
import logging
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urljoin

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware

import scraper

logger = logging.getLogger("synscraper.download")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="SynScraper Download Worker")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[part.strip() for part in os.environ.get("DOWNLOAD_CORS_ORIGINS", "*").split(",") if part.strip()],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

UA = scraper.USER_AGENT
HTTP_TIMEOUT = httpx.Timeout(35.0, connect=10.0)
MAX_TITLE_LEN = 120


def _quality_height(value) -> int | None:
    text = str(value or "").strip().lower()
    if not text or text == "auto":
        return None
    if "4k" in text or "2160" in text:
        return 2160
    match = re.search(r"(1440|1080|720|480|360|240|144)", text)
    return int(match.group(1)) if match else None


def _safe_filename(title: str, media_type: str, season: int | None, episode: int | None, quality: str) -> str:
    base = str(title or "SynScraper download").strip()[:MAX_TITLE_LEN]
    if media_type == "tv" and season is not None and episode is not None:
        base += f" S{season:02d}E{episode:02d}"
    qh = _quality_height(quality)
    if qh:
        base += f" {('4K' if qh == 2160 else f'{qh}p')}"
    base = re.sub(r"[^A-Za-z0-9._()\- ]+", "", base).strip(" .") or "synscraper-download"
    return f"{base}.mp4"


def _headers(server: dict) -> dict[str, str]:
    headers = {
        "User-Agent": server.get("user_agent") or UA,
        "Accept": "*/*",
    }
    if server.get("referer"):
        headers["Referer"] = server["referer"]
    if server.get("origin"):
        headers["Origin"] = server["origin"]
    return headers


def _parse_master_playlist(text: str, base_url: str) -> list[dict]:
    """Return HLS variants from a master playlist."""
    lines = [line.strip() for line in text.replace("\r", "").split("\n")]
    variants = []
    for idx, line in enumerate(lines):
        if not line.startswith("#EXT-X-STREAM-INF:"):
            continue
        attrs = line.split(":", 1)[1]
        resolution = re.search(r"RESOLUTION=(\d+)x(\d+)", attrs, re.I)
        bandwidth = re.search(r"(?:AVERAGE-)?BANDWIDTH=(\d+)", attrs, re.I)
        uri = None
        for candidate in lines[idx + 1 :]:
            if not candidate:
                continue
            if candidate.startswith("#"):
                continue
            uri = candidate
            break
        if not uri:
            continue
        variants.append({
            "url": urljoin(base_url, uri),
            "height": int(resolution.group(2)) if resolution else 0,
            "bandwidth": int(bandwidth.group(1)) if bandwidth else 0,
        })
    return variants


async def _resolve_manifest_variant(server: dict, requested_quality: str) -> tuple[str, list[int]]:
    url = server.get("url") or ""
    if not url.startswith(("http://", "https://")):
        raise HTTPException(502, "Resolved stream URL is invalid")

    headers = _headers(server)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("manifest fetch failed: %s", exc)
            raise HTTPException(502, "Could not fetch the resolved HLS playlist") from exc

    text = response.text
    if "#EXTM3U" not in text[:512]:
        raise HTTPException(502, "Resolved stream is not an HLS playlist")

    variants = _parse_master_playlist(text, str(response.url))
    if not variants:
        # Already a media playlist: the scraper resolved the exact playlist for us.
        return str(response.url), []

    available = sorted({item["height"] for item in variants if item["height"]}, reverse=True)
    wanted = _quality_height(requested_quality)
    if wanted is None:
        # Auto downloads the highest-bandwidth variant, not every rendition in the master.
        best = max(variants, key=lambda item: (item["height"], item["bandwidth"]))
        return best["url"], available

    exact = [item for item in variants if item["height"] == wanted]
    if not exact:
        raise HTTPException(
            409,
            detail={
                "message": f"{wanted}p is not available on this HLS master playlist",
                "available_qualities": available,
            },
        )
    best = max(exact, key=lambda item: item["bandwidth"])
    return best["url"], available


def _pick_server(servers: list[dict], mirror: str, quality: str) -> dict:
    if not servers:
        raise HTTPException(404, "No streams were resolved for that source")

    mirror_norm = str(mirror or "").strip().lower()
    scoped = [s for s in servers if str(s.get("name") or "").strip().lower() == mirror_norm] if mirror_norm else []
    if not scoped:
        scoped = servers

    wanted = _quality_height(quality)
    if wanted is not None:
        exact = [s for s in scoped if _quality_height(s.get("quality")) == wanted]
        if exact:
            return exact[0]

    auto = [s for s in scoped if str(s.get("quality") or "").strip().lower().startswith("auto")]
    if auto:
        return auto[0]

    if wanted is None:
        return max(scoped, key=lambda s: _quality_height(s.get("quality")) or 0)

    # A provider may expose one master playlist labelled 1080p/unknown while that master
    # still contains the requested rendition. Let the manifest resolver verify it exactly.
    return scoped[0]


async def _resolve_selection(
    media_type: str,
    tmdb_id: str,
    season: int | None,
    episode: int | None,
    provider: str,
    mirror: str,
    quality: str,
) -> tuple[dict, str, list[int]]:
    provider_ids = {item[1] for item in scraper.PROVIDERS}
    if provider not in provider_ids:
        raise HTTPException(400, "Unknown provider")
    if media_type not in ("movie", "tv"):
        raise HTTPException(400, "type must be movie or tv")
    if media_type == "tv" and (season is None or episode is None):
        raise HTTPException(400, "season and episode are required for TV downloads")

    servers = await scraper.scrape_streams(
        media_type,
        tmdb_id,
        season,
        episode,
        provider_id=provider,
        mirror=mirror if provider == "vidy" else None,
    )
    server = _pick_server(servers, mirror, quality)
    if server.get("type") != "hls" and ".m3u8" not in str(server.get("url") or "").lower():
        raise HTTPException(409, "The selected source is not HLS and cannot use this download flow")
    playlist_url, available = await _resolve_manifest_variant(server, quality)
    return server, playlist_url, available


@app.get("/")
@app.get("/api")
async def root():
    return {
        "message": "SynScraper download worker",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "download_endpoint": "/api/download",
    }


@app.get("/api/download/options")
async def download_options(
    type: str = Query("movie"),
    id: str = Query(...),
    season: int | None = None,
    episode: int | None = None,
    provider: str = Query(...),
    mirror: str = Query(""),
):
    """Probe one selected source and report exact HLS rendition heights."""
    server, _playlist_url, available = await _resolve_selection(
        type, id, season, episode, provider, mirror, "auto"
    )
    if not available:
        qh = _quality_height(server.get("quality"))
        available = [qh] if qh else []
    return {
        "provider": provider,
        "mirror": server.get("name") or mirror,
        "available_qualities": available,
        "source_quality": server.get("quality") or "Auto",
    }


@app.get("/api/download")
async def download(
    request: Request,
    type: str = Query("movie"),
    id: str = Query(...),
    season: int | None = None,
    episode: int | None = None,
    provider: str = Query(...),
    mirror: str = Query(""),
    quality: str = Query("auto"),
    title: str = Query("SynScraper download"),
):
    if os.environ.get("VERCEL"):
        raise HTTPException(503, "FFmpeg downloads must run on the SynScraper download worker, not Vercel serverless")
    ffmpeg = shutil.which(os.environ.get("FFMPEG_BINARY", "ffmpeg"))
    if not ffmpeg:
        raise HTTPException(503, "FFmpeg is not installed on this worker")

    server, playlist_url, _available = await _resolve_selection(
        type, id, season, episode, provider, mirror, quality
    )
    headers = _headers(server)
    header_blob = "".join(f"{key}: {value}\r\n" for key, value in headers.items())

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-nostdin",
        "-headers", header_blob,
        "-i", playlist_url,
        "-map", "0:v:0?",
        "-map", "0:a:0?",
        "-map_metadata", "-1",
        "-c", "copy",
        "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1",
    ]

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError as exc:
        raise HTTPException(500, "Could not start FFmpeg") from exc

    async def drain_stderr() -> bytes:
        data = bytearray()
        assert process.stderr is not None
        while True:
            chunk = await process.stderr.read(8192)
            if not chunk:
                break
            if len(data) < 64 * 1024:
                remaining = (64 * 1024) - len(data)
                data.extend(chunk[:remaining])
        return bytes(data)

    stderr_task = asyncio.create_task(drain_stderr())
    assert process.stdout is not None
    try:
        first_chunk = await asyncio.wait_for(process.stdout.read(256 * 1024), timeout=30)
    except asyncio.TimeoutError as exc:
        process.kill()
        await process.wait()
        stderr_task.cancel()
        raise HTTPException(504, "FFmpeg did not start producing the MP4 in time") from exc

    if not first_chunk:
        return_code = await process.wait()
        stderr = (await stderr_task).decode("utf-8", errors="replace")[-1200:]
        logger.warning("ffmpeg failed before output rc=%s: %s", return_code, stderr)
        raise HTTPException(502, "FFmpeg could not remux the selected stream")

    filename = _safe_filename(title, type, season, episode, quality)

    async def body():
        try:
            yield first_chunk
            while True:
                if await request.is_disconnected():
                    break
                chunk = await process.stdout.read(256 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=3)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
            try:
                stderr = (await stderr_task).decode("utf-8", errors="replace")[-1200:]
                if process.returncode not in (0, None):
                    logger.warning("ffmpeg exited rc=%s: %s", process.returncode, stderr)
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        body(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
