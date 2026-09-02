import { Link } from "react-router-dom";
import { ArrowRight, Captions, Cloud, Gauge, Keyboard, ServerCog, TerminalSquare } from "lucide-react";

const Code = ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#050505] p-4 text-[12px] leading-6 text-white/70"><code>{children}</code></pre>
);

const Section = ({ id, eyebrow, title, children }) => (
    <section id={id} className="scroll-mt-28 border-b border-white/10 py-12 first:pt-0 last:border-b-0">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/30">{eyebrow}</p>}
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">{title}</h2>
        <div className="mt-5 text-sm leading-7 text-white/48">{children}</div>
    </section>
);

export default function Docs() {
    const nav = [
        ["overview", "Overview"],
        ["quick-start", "Quick start"],
        ["component", "Player component"],
        ["api", "Stream API"],
        ["quality", "Quality"],
        ["captions", "Captions"],
        ["shortcuts", "Shortcuts"],
    ];

    return (
        <main className="min-h-screen bg-black px-5 pb-24 pt-28 md:px-8 md:pt-32">
            <div className="mx-auto max-w-7xl">
                <div className="border-b border-white/10 pb-12">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/45">
                        <Cloud className="h-3.5 w-3.5" /> Synapse Player docs
                    </div>
                    <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Build on the player without touching the playback engine.</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">Synapse Player consumes normalized stream results, handles HLS playback, exposes quality and caption tracks, and keeps the UI separate from the provider layer.</p>
                    <Link to="/demo" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Open live demo <ArrowRight className="h-4 w-4" /></Link>
                </div>

                <div className="grid gap-12 pt-12 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <aside className="hidden lg:block">
                        <div className="sticky top-28 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/25">On this page</p>
                            {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded-xl px-3 py-2 text-sm text-white/45 transition hover:bg-white/[0.05] hover:text-white">{label}</a>)}
                        </div>
                    </aside>

                    <div className="min-w-0 max-w-4xl">
                        <Section id="overview" eyebrow="Concept" title="Overview">
                            <p>Synapse Player is split into two layers: the backend resolves provider-specific sources into one server shape, and the React player handles the actual playback experience. The current player keeps source failover, HLS.js, resume progress, PiP, fullscreen, quality selection and captions inside one component.</p>
                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {[
                                    [ServerCog, "Provider layer", "Resolves sources and returns normalized playback URLs."],
                                    [TerminalSquare, "Player layer", "Attaches the stream and owns the playback controls."],
                                    [Gauge, "HLS levels", "Reads renditions from the manifest for manual or adaptive quality."],
                                    [Captions, "Subtitle tracks", "Reads HLS subtitle tracks and exposes them in the CC menu."],
                                ].map(([Icon, title, body]) => (
                                    <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                                        <Icon className="h-5 w-5 text-white/55" />
                                        <p className="mt-3 font-medium text-white">{title}</p>
                                        <p className="mt-1 text-xs leading-5 text-white/35">{body}</p>
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <Section id="quick-start" eyebrow="React" title="Quick start">
                            <p>Use the existing <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/70">SynapsePlayer</code> component and give it a TMDB media type, ID and metadata. TV playback also receives season and episode numbers.</p>
                            <Code>{`import { SynapsePlayer } from "@/components/SynapsePlayer";

<SynapsePlayer
  mediaType="movie"
  id="YOUR_TMDB_ID"
  meta={{
    title: "Example title",
    backdrop_path: "/backdrop.jpg",
    release_date: "2026-01-01"
  }}
  onBack={() => navigate("/")}
/>`}</Code>
                            <p className="mt-4">The component calls the stream endpoint itself. You do not need to resolve a provider before rendering the player.</p>
                        </Section>

                        <Section id="component" eyebrow="Props" title="Player component">
                            <div className="overflow-x-auto rounded-2xl border border-white/10">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead className="bg-white/[0.035] text-white/55"><tr><th className="px-4 py-3">Prop</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Purpose</th></tr></thead>
                                    <tbody className="divide-y divide-white/10 text-white/45">
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">mediaType</td><td className="px-4 py-3">movie | tv</td><td className="px-4 py-3">Selects movie or series resolution.</td></tr>
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">id</td><td className="px-4 py-3">string</td><td className="px-4 py-3">TMDB ID used by the resolver.</td></tr>
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">meta</td><td className="px-4 py-3">object</td><td className="px-4 py-3">Title, poster/backdrop and release date for the UI/progress store.</td></tr>
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">season / episode</td><td className="px-4 py-3">number</td><td className="px-4 py-3">TV-only resolver coordinates.</td></tr>
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">onBack</td><td className="px-4 py-3">function</td><td className="px-4 py-3">Runs when the cloud/back control is pressed.</td></tr>
                                        <tr><td className="px-4 py-3 font-mono text-xs text-white/70">onNextEpisode</td><td className="px-4 py-3">function</td><td className="px-4 py-3">Optional next-episode action for TV.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        <Section id="api" eyebrow="Backend" title="Stream API">
                            <p>The player calls <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/70">GET /api/streams</code>. The backend asks the provider stack for candidates and returns a normalized array.</p>
                            <Code>{`GET /api/streams?type=movie&id=TMDB_ID

{
  "type": "movie",
  "id": "TMDB_ID",
  "count": 3,
  "servers": [
    {
      "id": "provider-0",
      "name": "Source name",
      "provider": "provider",
      "primary": true,
      "type": "hls",
      "quality": "1080p",
      "play_url": "/api/hls?url=..."
    }
  ]
}`}</Code>
                            <p className="mt-4">For protected HLS sources, the backend rewrites playlists through <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/70">/api/hls</code> so segment, key, Referer and Origin requirements stay consistent.</p>
                        </Section>

                        <Section id="quality" eyebrow="HLS" title="Quality selection">
                            <p>When HLS.js parses a master playlist, Synapse reads <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/70">hls.levels</code>. The gear menu renders every returned level and uses <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/70">currentLevel</code> to switch renditions.</p>
                            <Code>{`// Auto / adaptive
hls.currentLevel = -1;

// Manual rendition
hls.currentLevel = levelIndex;`}</Code>
                            <p className="mt-4">If the stream is a single MP4 or a non-master HLS playlist, the UI correctly reports that there is only one available quality.</p>
                        </Section>

                        <Section id="captions" eyebrow="CC" title="Caption tracks">
                            <p>Caption availability comes from the active HLS stream. Synapse listens for subtitle track updates and puts each track in the CC menu.</p>
                            <Code>{`hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
  setSubs(data.subtitleTracks || []);
});

// Off
hls.subtitleTrack = -1;

// Select a track
hls.subtitleTrack = trackIndex;`}</Code>
                        </Section>

                        <Section id="shortcuts" eyebrow="Controls" title="Keyboard shortcuts">
                            <div className="grid gap-2 sm:grid-cols-2">
                                {[
                                    ["Space / K", "Play or pause"], ["F", "Fullscreen"], ["M", "Mute"], ["← / →", "Seek 5 seconds"],
                                    ["J / L", "Seek 10 seconds"], ["↑ / ↓", "Volume"], ["C", "Toggle captions"], ["N", "Next episode"], ["?", "Shortcut help"],
                                ].map(([key, action]) => (
                                    <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5">
                                        <span className="text-white/45">{action}</span><kbd className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 font-mono text-[11px] text-white/70">{key}</kbd>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-center gap-2 text-white/40"><Keyboard className="h-4 w-4" /> Shortcuts are disabled while typing in form fields.</div>
                        </Section>
                    </div>
                </div>
            </div>
        </main>
    );
}
