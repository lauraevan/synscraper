"""Vercel-safe SynScraper HLS -> MP4 download routes.

FFmpeg reads through SynScraper's /api/hls proxy so provider headers and the TS
sanitizer match normal playback. Download rows are validated against real HLS media
before being shown, and the worker waits for a real fragmented-MP4 media fragment
before committing response headers so empty/zero-second MP4s are never returned.
"""

import asyncio
import logging
import os
import re
from urllib.parse import quote, urljoin

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

import download_worker as legacy
import scraper

logger = logging.getLogger("synscraper.download.v2")
router = APIRouter()

MAX_DOWNLOAD_HEIGHT = legacy.MAX_DOWNLOAD_HEIGHT
STARTUP_TIMEOUT_SECONDS = 55
MAX_PREFLIGHT_BYTES = 4 * 1024 * 1024
PROBE_BYTES = 96 * 1024


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


def _friendly_ffmpeg_error(stderr: str) -> str:
    lowered = stderr.lower()
    if "403" in lowered or "forbidden" in lowered:
        return "The selected source rejected one of the HLS requests"
    if "404" in lowered or "not found" in lowered:
        return "An HLS playlist or segment was not found"
    if "timed out" in lowered or "connection timed out" in lowered:
        return "The selected source timed out while preparing the download"
    if "invalid data" in lowered or "could not find codec" in lowered:
        return "FFmpeg could not read the selected HLS stream"
    if "end of file" in lowered or "eof" in lowered:
        return "The selected source ended before any video was received"
    return "FFmpeg could not remux the selected stream"


def _contains_real_media(data: bytes) -> bool:
    """A fragmented MP4 is only useful once at least one moof+mdat pair exists."""
    return b"moof" in data and b"mdat" in data


async def _wait_for_media_fragment(process) -> bytes:
    """Buffer startup output until FFmpeg emits actual media, exits, or times out."""
    assert process.stdout is not None
    buffered = bytearray()

    async def collect() -> bytes:
        while len(buffered) < MAX_PREFLIGHT_BYTES:
            chunk = await process.stdout.read(256 * 1024)
            if not chunk:
                break
            buffered.extend(chunk)
            if _contains_real_media(buffered):
                break
        return bytes(buffered)

    try:
        return await asyncio.wait_for(collect(), timeout=STARTUP_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as exc:
        if process.returncode is None:
            process.kill()
            await process.wait()
        raise HTTPException(504, "The stream did not produce downloadable video in time") from exc


def _playlist_refs(text: str, base_url: str) -> tuple[list[str], list[str], list[str]]:
    """Return key URLs, init-map URLs, and media segment URLs from a media playlist."""
    keys: list[str] = []
    maps: list[str] = []
    segments: list[str] = []
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXT-X-KEY:"):
            match = re.search(r'URI="([^"]+)"', line)
            if match and not match.group(1).startswith("data:"):
                keys.append(urljoin(base_url, match.group(1)))
        elif line.startswith("#EXT-X-MAP:"):
            match = re.search(r'URI="([^"]+)"', line)
            if match:
                maps.append(urljoin(base_url, match.group(1)))
        elif not line.startswith("#"):
            segments.append(urljoin(base_url, line))
    return keys, maps, segments


async def _read_probe_object(client: httpx.AsyncClient, url: str, headers: dict) -> tuple[bytes, str]:
    """Read only enough of an HLS object to establish that it is reachable/media-like."""
    probe_headers = dict(headers)
    probe_headers.setdefault("Range", f"bytes=0-{PROBE_BYTES - 1}")
    try:
        async with client.stream("GET", url, headers=probe_headers, follow_redirects=True) as response:
            if response.status_code >= 400:
                raise HTTPException(502, f"download source probe returned {response.status_code}")
            data = bytearray()
            async for chunk in response.aiter_bytes(32768):
                if chunk:
                    data.extend(chunk)
                if len(data) >= PROBE_BYTES:
                    break
            return bytes(data[:PROBE_BYTES]), response.headers.get("content-type", "").lower()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(502, "download source probe could not reach HLS media") from exc


async def _validate_download_source(server: dict, playlist_url: str) -> None:
    """Reject stale/broken HLS rows before the frontend displays them."""
    headers = legacy._headers(server)
    timeout = httpx.Timeout(18.0, connect=7.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        try:
            response = await client.get(playlist_url, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(502, "download media playlist is unreachable") from exc

        text = response.text
        if "#EXTM3U" not in text[:512]:
            raise HTTPException(502, "download source did not return an HLS playlist")

        # Some providers nest one more master level. Follow the best <=1080p variant.
        variants = legacy._parse_master_playlist(text, str(response.url))
        if variants:
            allowed = [item for item in variants if item.get("height") and item["height"] <= MAX_DOWNLOAD_HEIGHT]
            if not allowed:
                raise HTTPException(502, "download source has no usable <=1080p media rendition")
            chosen = max(allowed, key=lambda item: (item.get("height", 0), item.get("bandwidth", 0)))
            try:
                response = await client.get(chosen["url"], headers=headers)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise HTTPException(502, "download rendition playlist is unreachable") from exc
            text = response.text
            if "#EXTM3U" not in text[:512]:
                raise HTTPException(502, "download rendition is not HLS")

        keys, maps, segments = _playlist_refs(text, str(response.url))
        if not segments:
            raise HTTPException(502, "download playlist contains no media segments")

        # Verify encryption keys/init maps when present, then inspect the first media
        # object. This is much cheaper than spawning FFmpeg for every row in the list.
        for required_url in (keys[:1] + maps[:1]):
            data, _ = await _read_probe_object(client, required_url, headers)
            if not data:
                raise HTTPException(502, "download source is missing a required HLS object")

        segment_url = segments[0]
        data, content_type = await _read_probe_object(client, segment_url, headers)
        if not data:
            raise HTTPException(502, "download source returned an empty media segment")

        path = segment_url.split("?", 1)[0].lower()
        if path.endswith(".ts") or "video/mp2t" in content_type:
            cleaned = scraper.strip_png_ts(data)
            if len(cleaned) < 188 or cleaned[0] != 0x47:
                raise HTTPException(502, "download source returned invalid transport-stream media")
            if len(cleaned) >= 376 and cleaned[188] != 0x47:
                raise HTTPException(502, "download source transport stream failed sync validation")


@router.get("/download/health")
async def download_health(request: Request):
    ffmpeg = legacy._find_ffmpeg()
    return {
        "ok": bool(ffmpeg),
        "ffmpeg": bool(ffmpeg),
        "proxy_mode": True,
        "media_fragment_gate": True,
        "source_probe": True,
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
    server, playlist_url, available = await legacy._resolve_selection(
        type, id, season, episode, provider, mirror, "auto"
    )
    await _validate_download_source(server, playlist_url)
    if not available:
        qh = legacy._quality_height(server.get("quality"))
        available = [qh] if qh and qh <= MAX_DOWNLOAD_HEIGHT else []
    return {
        "provider": provider,
        "mirror": server.get("name") or mirror,
        "max_download_height": MAX_DOWNLOAD_HEIGHT,
        "available_qualities": [q for q in available if q <= MAX_DOWNLOAD_HEIGHT],
        "source_quality": server.get("quality") or "Auto",
        "validated": True,
    }


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
    await _validate_download_source(server, playlist_url)

    input_url = _proxied_playlist_url(request, playlist_url, server)

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-nostdin",
        "-rw_timeout", "30000000",
        "-user_agent", legacy.UA,
        "-fflags", "+genpts+discardcorrupt",
        "-i", input_url,
        "-map", "0:v:0?",
        "-map", "0:a:0?",
        "-map_metadata", "-1",
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+frag_keyframe+empty_moov+default_base_moof+negative_cts_offsets",
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

    try:
        startup = await _wait_for_media_fragment(process)
    except HTTPException:
        if not stderr_task.done():
            try:
                await asyncio.wait_for(stderr_task, timeout=2)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                stderr_task.cancel()
        raise

    if not _contains_real_media(startup):
        return_code = await process.wait()
        stderr = (await stderr_task).decode("utf-8", errors="replace")[-2000:]
        logger.warning("ffmpeg produced no media fragment rc=%s: %s", return_code, stderr)
        raise HTTPException(502, _friendly_ffmpeg_error(stderr))

    filename = legacy._safe_filename(title, type, season, episode, quality)

    async def body():
        try:
            yield startup
            assert process.stdout is not None
            while True:
                chunk = await process.stdout.read(256 * 1024)
                if not chunk:
                    break
                yield chunk
        except asyncio.CancelledError:
            raise
        finally:
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=3)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
            try:
                stderr = (await stderr_task).decode("utf-8", errors="replace")[-2000:]
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
            "X-SynScraper-Download-Mode": "hls-proxy-remux-v3",
            "X-SynScraper-Media-Gate": "moof-mdat",
            "X-SynScraper-Source-Probe": "validated",
            "X-SynScraper-Max-Download-Height": str(MAX_DOWNLOAD_HEIGHT),
        },
    )
