"""Vercel-safe SynScraper HLS -> MP4 download routes.

The player already uses /api/hls because some provider segments need SynScraper's
referer/origin handling and transport-stream sanitizing. The first download worker
fed the upstream playlist directly to FFmpeg, bypassing that proven path. This
worker keeps the same public API but makes FFmpeg read through SynScraper's own HLS
proxy so downloads see the exact bytes that playback sees.
"""

import asyncio
import logging
import os
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

import download_worker as legacy

logger = logging.getLogger("synscraper.download.v2")
router = APIRouter()

MAX_DOWNLOAD_HEIGHT = legacy.MAX_DOWNLOAD_HEIGHT


def _public_origin(request: Request) -> str:
    """Return a public origin FFmpeg can call back into from a Vercel function."""
    configured = os.environ.get("DOWNLOAD_PUBLIC_ORIGIN", "").strip().rstrip("/")
    if configured:
        return configured

    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",", 1)[0].strip()
    if host:
        return f"{proto}://{host}".rstrip("/")

    vercel_host = os.environ.get("VERCEL_URL", "").strip()
    if vercel_host:
        return f"https://{vercel_host}".rstrip("/")

    raise HTTPException(500, "Could not determine the public deployment origin")


def _proxied_playlist_url(request: Request, playlist_url: str, server: dict) -> str:
    origin = _public_origin(request)
    query = f"url={quote(playlist_url, safe='')}"
    referer = str(server.get("referer") or "").strip()
    upstream_origin = str(server.get("origin") or "").strip()
    if referer:
        query += f"&ref={quote(referer, safe='')}"
    if upstream_origin:
        query += f"&origin={quote(upstream_origin, safe='')}"
    return f"{origin}/api/hls?{query}"


async def _read_stderr(process) -> bytes:
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


@router.get("/download/health")
async def download_health(request: Request):
    ffmpeg = legacy._find_ffmpeg()
    return {
        "ok": bool(ffmpeg),
        "ffmpeg": bool(ffmpeg),
        "proxy_mode": True,
        "origin": _public_origin(request),
        "max_download_height": MAX_DOWNLOAD_HEIGHT,
    }


@router.get("/download/options")
async def download_options(
    type: str = Query("movie"),
    id: str = Query(...),
    season: int | None = None,
    episode: int | None = None,
    provider: str = Query(...),
    mirror: str = Query(""),
):
    # Playlist probing itself is safe to do directly; segment downloads are what need
    # to pass through /api/hls so they receive the same cleanup as normal playback.
    return await legacy.download_options(type, id, season, episode, provider, mirror)


@router.get("/download")
async def download(
    request: Request,
    type: str = Query("movie"),
    id: str = Query(...),
    season: int | None = None,
    episode: int | None = None,
    provider: str = Query(...),
    mirror: str = Query(""),
    quality: str = Query("1080"),
    title: str = Query("SynScraper download"),
):
    legacy._requested_height(quality)
    ffmpeg = legacy._find_ffmpeg()
    if not ffmpeg:
        raise HTTPException(503, "FFmpeg is not available in this Vercel function")

    server, playlist_url, _available = await legacy._resolve_selection(
        type, id, season, episode, provider, mirror, quality
    )

    # Critical difference from v1: FFmpeg now consumes SynScraper's own HLS proxy.
    # That proxy carries Referer/Origin and strips the provider PNG prefix from TS
    # segments, matching the path already proven by player playback.
    input_url = _proxied_playlist_url(request, playlist_url, server)

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-nostdin",
        "-rw_timeout", "20000000",
        "-user_agent", legacy.UA,
        "-i", input_url,
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
        logger.exception("could not start ffmpeg")
        raise HTTPException(500, "Could not start FFmpeg") from exc

    stderr_task = asyncio.create_task(_read_stderr(process))
    assert process.stdout is not None

    try:
        first_chunk = await asyncio.wait_for(process.stdout.read(256 * 1024), timeout=45)
    except asyncio.TimeoutError as exc:
        process.kill()
        await process.wait()
        stderr_task.cancel()
        raise HTTPException(504, "FFmpeg did not start producing the MP4 in time") from exc

    if not first_chunk:
        return_code = await process.wait()
        stderr = (await stderr_task).decode("utf-8", errors="replace")[-1600:]
        logger.warning("ffmpeg failed before output rc=%s: %s", return_code, stderr)
        # Keep provider URLs/tokens out of the browser while still exposing a useful
        # reason for troubleshooting.
        lowered = stderr.lower()
        if "403" in lowered or "forbidden" in lowered:
            message = "The selected source rejected one of the HLS requests"
        elif "404" in lowered or "not found" in lowered:
            message = "An HLS playlist or segment was not found"
        elif "invalid data" in lowered or "could not find codec" in lowered:
            message = "FFmpeg could not read the selected HLS stream"
        else:
            message = "FFmpeg could not remux the selected stream"
        raise HTTPException(502, message)

    filename = legacy._safe_filename(title, type, season, episode, quality)

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
                stderr = (await stderr_task).decode("utf-8", errors="replace")[-1600:]
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
            "X-Accel-Buffering": "no",
            "X-SynScraper-Download-Mode": "hls-proxy-remux",
            "X-SynScraper-Max-Download-Height": str(MAX_DOWNLOAD_HEIGHT),
        },
    )
