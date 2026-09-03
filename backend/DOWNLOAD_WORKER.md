# SynScraper downloads

SynScraper's download flow is capped at **1080p**. 1440p, 4K, and higher requests are rejected by the backend before FFmpeg starts.

## Flow

1. The watch page resolves the available SynScraper sources.
2. The user chooses a source (for example **Miami**) and a quality up to 1080p.
3. The backend re-runs that provider resolver server-side so the client never supplies an arbitrary upstream URL.
4. If the resolved URL is an HLS master playlist, the backend pins the requested `RESOLUTION` rendition. `Auto` means the highest verifiable rendition at or below 1080p.
5. FFmpeg reads that one playlist and its segments in order, copies the existing audio/video streams, and streams a fragmented `.mp4` download. No re-encoding is performed.

The download routes are mounted into the normal SynScraper `/api` backend. `imageio-ffmpeg` supplies a bundled FFmpeg executable for Python serverless deployments when a system `ffmpeg` binary is not available.

The worker does not contain DRM bypass logic. Use it only with non-DRM streams you are authorized to download.

## Endpoints

```text
GET /api/download?type=movie&id=123&provider=vidy&mirror=Miami&quality=1080&title=Example
GET /api/download/options?type=movie&id=123&provider=vidy&mirror=Miami
```

`/api/download/options` only returns qualities at or below 1080p.

## Serverless notes

The root Vercel configuration gives the Python API a 300-second function duration. Streaming avoids buffering the whole MP4 in memory, but a title that cannot finish within the platform's execution-time limit can still be terminated by the host.

`REACT_APP_DOWNLOAD_WORKER_URL` is no longer required. By default the frontend uses the same `REACT_APP_BACKEND_URL` (or same origin) for downloads. The variable is still supported as an optional override for a dedicated worker/serverless-container deployment.

## Optional standalone container

The previous standalone worker remains available for local testing or a serverless-container host:

```bash
docker build -f backend/Dockerfile.download-worker -t synscraper-download-worker .
docker run --rm -p 8000:8000 synscraper-download-worker
```

Optional environment variables:

- `DOWNLOAD_CORS_ORIGINS` — comma-separated allowed frontend origins for the standalone app. Defaults to `*`.
- `FFMPEG_BINARY` — alternate FFmpeg binary name/path. Otherwise SynScraper tries system FFmpeg and then the bundled `imageio-ffmpeg` executable.
- Existing provider-specific SynScraper environment variables can be passed through normally.
