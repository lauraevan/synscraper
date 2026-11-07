# Synscraper: use every scraper from another project

All **11 provider implementations** are maintained under \`backend/providers/\`.
There is one canonical registry, \`backend/scraper.py::PROVIDERS\`, which
powers the existing Civy/SynPlayer API, the new versioned API, and the Python
package. The older \`synflix_scrapers/\` scripts remain for compatibility and
are **not** a second source of truth.

## Available providers

| Display name | Provider ID | Implementation |
| --- | --- | --- |
| Orlando | \`orlando\` | \`providers/orlando.py\` |
| Vidy (including supported anime IDs) | \`vidy\` | \`providers/vidy.py\` |
| Houston / Castle | \`castle\` | \`providers/castle.py\` |
| Nova / VidLink | \`vidlink\` | \`providers/vidlink.py\` |
| Nest / VidNest | \`vidnest\` | \`providers/vidnest.py\` |
| Zen / VidZee | \`vidzee\` | \`providers/vidzee.py\` |
| Rock / VidRock | \`vidrock\` | \`providers/vidrock.py\` |
| CineJoy | \`cinejoy\` | \`providers/cinejoy.py\` |
| VidCore | \`vidcore\` | \`providers/vidcore.py\` |
| VidFast (thanks to Byte) | \`vidfast\` | \`providers/vidfast.py\` |
| Vix / VixSrc | \`vixsrc\` | \`providers/vixsrc.py\` |

Providers may return zero sources because an upstream server is unreachable or
has changed; listing a provider does not guarantee playback.

## HTTP API (websites, mobile apps, other backends)

Configure \`SYNSCRAPER_PUBLIC_URL=https://your-host.example\` if the application
runs behind a reverse proxy that changes the incoming Host header. Otherwise
the versioned API builds absolute playback URLs from the incoming request.

- \`GET /api/v1/providers\` — all available provider IDs and supported media types
- \`GET /api/v1/streams?type=movie&id=550\` — fetch all matching providers, with absolute proxy playback and caption URLs
- \`GET /api/v1/streams?type=tv&id=1399&season=1&episode=1\`
- \`GET /api/v1/streams?type=movie&id=550&provider=vidfast\` — target one provider
- \`GET /api/v1/providers/vidfast/streams?type=movie&id=550\` — same selection, provider-oriented route
- \`GET /api/v1/streams?type=anime&id=16498&episode=1&provider=vidy\` — Vidy anime resolution (AniList ID)

Optional query parameters: \`mirror\` (Vidy), \`exclude\` (comma-separated
provider IDs), \`title\`, \`year\`, \`imdb_id\`. Responses keep the legacy
\`type\`, \`id\`, \`count\`, \`servers\`, and caption structure, and add
\`version: "1"\`. Only \`play_url\` fields become absolute URLs; direct
upstream URLs and request headers are **not** exposed in the public API.

Example JavaScript:

\`\`\`js
const base = "https://your-synscraper-host.example";
const providers = await fetch(base + "/api/v1/providers").then(r => r.json());
const response = await fetch(base + "/api/v1/streams?type=movie&id=550").then(r => r.json());
console.log(providers.providers.map(p => p.id));
const stream = response.servers[0];
if (stream) {
  console.log(stream.provider, stream.play_url, stream.captions);
  // On Safari, AVPlayer or native HLS can consume HLS; other browsers may need hls.js.
}
\`\`\`

The existing \`/api/streams\`, \`/api/hls\`, and \`/api/caption\` endpoints
remain unchanged for Civy and the current frontend.

## Install standalone Python resolvers

From the repository root:

\`\`\`sh
python -m pip install -e .
synscraper-providers list
synscraper-providers resolve --type movie --id 550 --provider vidfast
synscraper-providers resolve --type tv --id 1399 --season 1 --episode 1
\`\`\`

Or install from GitHub in any other Python project:

\`\`\`sh
python -m pip install "git+https://github.com/lauraevan/synscraper.git"
\`\`\`

Use the same normalized scraper in Python:

\`\`\`python
import asyncio
import scraper

async def main():
    streams = await scraper.scrape_streams("movie", "550", provider_id="vidfast")
    for stream in streams:
        print(stream["provider"], stream["type"], stream["quality"])

asyncio.run(main())
\`\`\`

The Python/CLI interface returns resolver-level media URLs and request headers.
Treat these as short-lived credentials: **do not** log or publish signed media
URLs, response cookies, secret headers, or upstream tokens. Prefer the public
HTTP API when consuming from browsers/mobile apps. Optional VidFast browser
fallback dependencies are available with \`pip install -e ".[browser]"\` and
require installing a compatible Chromium binary separately.

## Development and validation

\`\`\`sh
cd backend
python -m unittest -v test_provider_api test_vidfast
\`\`\`

The tests are offline contract checks, not a live guarantee that every third-party
site still works. The older \`synflix_scrapers/\` entry points are preserved;
use the shared registry/API for new projects.

Only use streams and providers you are authorized to access and distribute.
