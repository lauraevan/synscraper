# Synflix Scrapers
Standalone TMDB-id -> stream resolvers. Each returns JSON {status, playable_urls:[{url,type,quality,headers}]}.

- vidup.py  (VidUp  / VixSrc)  -> clean HLS
- vidy.py   (Vidy)             -> HLS/DASH
- orbit.py  (Orbit  / Castle)  -> HLS
- nova.py   (Nova   / Vidlink) -> HLS/MP4
- nest.py   (Nest   / VidNest) -> HLS

## Usage
    pip install -r requirements.txt
    python3 vidup.py 550 --type movie --pretty
    python3 vidy.py 550 --type movie --pretty
    python3 vidy.py 1399 --type tv --season 1 --episode 1 --pretty
    python3 vidy.py 16498 --type anime --episode 1 --pretty
    python3 nest.py 1396 --type tv --season 1 --episode 1 --pretty

## VidFast integration (thanks Byte)

The backend provider `backend/providers/vidfast.py` is registered as `vidfast` in SynScraper.
It checks the documented VidFast movie/TV pages for directly declared HLS, MP4,
or DASH sources and returns the existing `playable_urls` schema. Override the
host with `VIDFAST_ORIGIN` if Byte supplies a different approved VidFast origin.

**Limitation:** VidFast's documented public API is an **embed player**, not a
public stream-resolution endpoint. If the page only exposes a dynamic player,
this extractor correctly returns no sources rather than passing an iframe URL
as an HLS stream. A provider-authorized stream API or embedded-player integration
would be needed for that case; no obfuscation/DRM/anti-bot bypass is included.

Run offline tests from the backend directory:

    python -m unittest test_vidfast

### Optional dynamic player observation

VidFast commonly loads media after JavaScript starts. The HTML extractor alone
may return no streams. To enable a browser observation fallback on a server with
Chromium available (this is **not installed automatically** by the backend):

    pip install playwright
    python -m playwright install chromium
    VIDFAST_BROWSER=1 python -m uvicorn server:app --host 0.0.0.0 --port 8000

The browser fallback watches successful network responses for HLS/DASH/MP4
and normalizes their request headers for the existing proxy. It does **not**
bypass bot checks, decrypt private payloads, or promise availability. Deployments
without Chromium keep using the lightweight static extractor. On serverless
platforms without browser binaries, run a separate supported worker instead.

Provider smoke test: request `/api/streams/movie/550?provider=vidfast` if
that route is present on your deployment, or exercise `VidFastResolver.resolve`
locally. Do not treat an embed page as a direct HLS stream.
