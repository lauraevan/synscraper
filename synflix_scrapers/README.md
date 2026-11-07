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

## VidFast integration (credit: Byte)

`backend/providers/vidfast.py` is registered as provider `vidfast` in the
existing `/api/streams?type=movie&id=550&provider=vidfast` API. TV requests use
`type=tv&id=1399&season=1&episode=1&provider=vidfast`.

The primary resolver implements the publicly documented VidFast flow from
[EncDecEndpoints' sample](https://github.com/smy778/EncDecEndpoints/blob/main/samples/vidfast.py):
page token, stage-one encryption, stage-two server routes, server decryption,
and per-server stream decryption. The resolver uses `curl_cffi` for
browser-compatible HTTP when installed and falls back to `requests`.
Sources are normalized for SynPlayer and duplicates removed. DASH sources are
excluded because SynPlayer currently accepts HLS and MP4 only.

This relies on an independent third-party API (`enc-dec.app`), which may have
its own availability and privacy implications. Override with
`VIDFAST_ENCDEC_API`, or set `VIDFAST_API=0` to disable it. The
`VIDFAST_ORIGIN` setting overrides the documented embed host.

If the direct API fails, the resolver checks publicly declared HTML media URLs
and **validates** HLS/MP4 content rather than trusting file extensions. When
`VIDFAST_BROWSER=1` and Playwright Chromium is installed, it additionally
observes real network responses from the normal player. To host with a browser,
build `backend/Dockerfile.vidfast` and deploy as a separate Python service.
Vercel Python functions do not install Chromium automatically.

**Verification:** Offline unit tests run on every relevant push. A separate
live Chromium smoke test may fail when the upstream website blocks GitHub
runners (HTTP 403 / Cloudflare); that failure is not proof of a working or
non-working stream on a normal network. Do not treat an embed URL as a direct
stream or claim successful playback without a positive live test.

Run unit tests:

    cd backend && python -m unittest -v test_vidfast

The optional live probe prints only statuses and hostnames and avoids logging
CDN links, cookies or tokens:

    cd backend && python scripts/vidfast_probe.py

Shoutout to Byte for permission to implement the VidFast integration.

### Last verified smoke test

On 2026-11-07 UTC, [GitHub Actions run #42322585398](https://github.com/lauraevan/synscraper/actions/runs/42322585398)
passed with 12 offline tests, three decrypted VidFast HLS sources, three readable
HLS manifests (HTTP 200), a successfully fetched transport segment (HTTP 206,
1024 bytes sampled), and a successful SynScraper `httpx` manifest request
(HTTP 200). This verifies stream extraction, manifest access, and segment
reachability from the CI network. Actual full-length playback on every
client/network is not guaranteed, and provider availability can change.
