# SynScraper download worker

The download path is intentionally separate from the normal Vercel playback API. Long 1080p/4K FFmpeg jobs need a normal process/container with FFmpeg and enough bandwidth; they should not run inside a Vercel serverless function.

## Flow

1. The watch page resolves the available SynScraper sources.
2. The user chooses a source (for example **Miami**) and an exact quality (4K, 1080p, 720p, etc.).
3. `backend/download_worker.py` re-runs that provider resolver server-side so the client never supplies an arbitrary upstream URL.
4. If the resolved URL is an HLS master playlist, the worker parses it and pins the exact requested `RESOLUTION` rendition. If the exact rendition is absent, it returns HTTP 409 instead of silently downloading another quality.
5. FFmpeg reads that one playlist and its segments in order, copies the existing audio/video streams, and emits a single fragmented `.mp4` download. No re-encoding is performed.

The worker does not contain DRM bypass logic. Use it only with non-DRM streams you are authorized to download.

## Docker

From the repository root:

```bash
docker build -f backend/Dockerfile.download-worker -t synscraper-download-worker .
docker run --rm -p 8000:8000 \
  -e DOWNLOAD_CORS_ORIGINS="https://your-synscraper-site.example" \
  synscraper-download-worker
```

Health check:

```text
GET http://localhost:8000/api
```

Download endpoint:

```text
GET /api/download?type=movie&id=123&provider=vidy&mirror=Miami&quality=1080&title=Example
```

Quality probe endpoint:

```text
GET /api/download/options?type=movie&id=123&provider=vidy&mirror=Miami
```

## Frontend configuration

Build the frontend with the worker URL:

```text
REACT_APP_DOWNLOAD_WORKER_URL=https://downloads.example.com
```

The normal `REACT_APP_BACKEND_URL` can remain pointed at the existing SynScraper/Vercel API. The browser talks directly to the download worker for the long-running MP4 response, so the Vercel API does not stay open for the duration of the download.

## Optional environment variables

- `DOWNLOAD_CORS_ORIGINS` — comma-separated allowed frontend origins. Defaults to `*`.
- `FFMPEG_BINARY` — alternate FFmpeg binary name/path. Defaults to `ffmpeg`.
- Existing provider-specific SynScraper environment variables can be passed to the worker exactly as they are passed to the normal backend.
