# Synscraper / Synapse Player

Synapse Player is the frontend + playback layer for the provider stack extracted from `lauraevan/synflix`.

The existing playback engine is preserved: provider resolution, source failover, HLS.js attachment, progress persistence, PiP, fullscreen, keyboard controls, HLS quality selection and HLS subtitle tracks all remain part of the original player flow. The current work is a UI/frontend rework around that engine.

## Frontend

The React frontend now includes:

- `/` — Vidfast-inspired Synapse Player landing page
- `/demo` — interactive TMDB-ID player demo using the real resolver + `SynapsePlayer`
- `/docs` — player/component/API documentation
- `/watch/:mediaType/:id` — dedicated playback route
- `/browse/movie` and `/browse/tv` — existing browse views

## Player features

- Multi-source provider resolution and failover
- HLS.js playback
- Adaptive or manually selected HLS quality levels
- HLS caption/subtitle track selection
- 10-second seek controls
- Volume, seek bar, fullscreen and Picture-in-Picture
- Keyboard shortcuts
- Resume/continue-watching progress
- Custom resolving/fetch screen

## Stream API

The player resolves streams through:

```text
GET /api/streams?type=movie&id=TMDB_ID
GET /api/streams?type=tv&id=TMDB_ID&season=1&episode=1
```

The backend normalizes provider results into a common server shape and generates `play_url` values for the frontend. HLS playlists/segments that require playback headers are relayed through `/api/hls`.

## React usage

```jsx
import { SynapsePlayer } from "@/components/SynapsePlayer";

<SynapsePlayer
  mediaType="movie"
  id="YOUR_TMDB_ID"
  meta={{
    title: "Example title",
    backdrop_path: "/backdrop.jpg",
    release_date: "2026-01-01",
  }}
  onBack={() => navigate("/")}
/>
```

See the in-app `/docs` page for the full component, API, quality, caption and shortcut documentation.


## Reuse the full scraper collection elsewhere

The canonical backend currently includes **11 resolvers**, all registered in
\`backend/scraper.py\`: Orlando, Vidy, Houston/Castle, Nova/VidLink, Nest/VidNest,
Zen/VidZee, Rock/VidRock, CineJoy, VidCore, VidFast, and Vix/VixSrc.

For other websites, native apps, or services, use the versioned endpoints:

\`\`\`text
GET /api/v1/providers
GET /api/v1/streams?type=movie&id=550
GET /api/v1/streams?type=movie&id=550&provider=vidfast
GET /api/v1/providers/vidfast/streams?type=movie&id=550
\`\`\`

These return absolute \`play_url\` and caption URLs suitable for off-site
clients. The existing Civy/SynPlayer \`/api/streams\` contract remains unchanged.

To use the providers directly from Python, install the repository:
\`pip install -e .\` then run \`synscraper-providers list\` or import
\`scraper.scrape_streams\`. See [full provider and integration documentation](docs/PROVIDER_API.md).
