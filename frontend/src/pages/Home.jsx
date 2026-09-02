import { Link } from "react-router-dom";
import {
    ArrowRight, Captions, Check, Cloud, Gauge, Layers3, MonitorPlay,
    Play, ServerCog, Sparkles, Zap,
} from "lucide-react";

const Feature = ({ icon: Icon, title, children }) => (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-sm">
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Icon className="h-5 w-5 text-white/80" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">{children}</p>
    </div>
);

const PlayerPreview = () => (
    <div className="relative mx-auto mt-16 aspect-video w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#080808] shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.11),transparent_29%),linear-gradient(135deg,#171717,#050505_65%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),transparent_42%,rgba(0,0,0,0.82))]" />

        <Cloud className="absolute left-6 top-6 h-10 w-10 text-white/85 md:left-8 md:top-8 md:h-12 md:w-12" strokeWidth={1.6} />
        <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center md:top-8">
            <p className="text-xs font-medium text-white/55 md:text-base">You're Watching</p>
            <p className="mt-1 text-sm font-semibold text-white md:text-lg">Synapse Player Demo</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center gap-[10vw]">
            <div className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-white/70 text-lg font-semibold text-white/90 md:h-20 md:w-20">10</div>
            <div className="grid h-20 w-20 place-items-center text-white md:h-28 md:w-28">
                <Play className="h-16 w-16 fill-white md:h-24 md:w-24" strokeWidth={1.2} />
            </div>
            <div className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-white/70 text-lg font-semibold text-white/90 md:h-20 md:w-20">10</div>
        </div>

        <div className="absolute inset-x-5 bottom-5 md:inset-x-8 md:bottom-7">
            <div className="relative mb-5 h-1 rounded-full bg-white/25">
                <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-white" />
                <div className="absolute left-[38%] top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
            <div className="flex items-center gap-3 text-white/80">
                <div className="h-6 w-7 rounded-md border border-white/50" />
                <span className="text-xs font-medium md:text-sm">31:18 / 1:49:19</span>
                <div className="ml-auto flex items-center gap-4 md:gap-6">
                    <Captions className="h-6 w-6" />
                    <ServerCog className="h-6 w-6" />
                    <div className="h-6 w-6 rounded-md border-2 border-white/70" />
                </div>
            </div>
        </div>
    </div>
);

export default function Home() {
    return (
        <main className="overflow-hidden bg-black" data-testid="home-page">
            <section className="relative px-5 pb-24 pt-32 md:px-8 md:pb-32 md:pt-40">
                <div className="pointer-events-none absolute inset-0 site-grid opacity-35" />
                <div className="pointer-events-none absolute left-1/2 top-20 h-[460px] w-[780px] -translate-x-1/2 rounded-full bg-white/[0.045] blur-[120px]" />

                <div className="relative mx-auto max-w-7xl text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                        <Sparkles className="h-3.5 w-3.5" />
                        Synapse Player · multi-source playback
                    </div>

                    <h1 className="mx-auto mt-7 max-w-5xl text-balance text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl md:text-8xl">
                        Playback without the noise.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-white/45 md:text-lg">
                        A fast custom player for TMDB-based apps with source failover, adaptive HLS quality, captions, picture-in-picture and a clean interface that stays out of the way.
                    </p>

                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link to="/demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]">
                            Open player demo <Play className="h-4 w-4 fill-current" />
                        </Link>
                        <Link to="/docs" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.035] px-6 text-sm font-medium text-white/75 transition hover:bg-white/[0.07] hover:text-white">
                            Read documentation <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <PlayerPreview />
                </div>
            </section>

            <section className="border-y border-white/10 bg-[#050505] px-5 py-20 md:px-8 md:py-28">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-10 max-w-2xl">
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/35">Player engine</p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">Built around the stream, not around the UI.</h2>
                        <p className="mt-4 text-base leading-7 text-white/45">The interface is only the shell. Underneath it, Synapse keeps the existing provider resolution and HLS playback logic intact.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Feature icon={Zap} title="Multi-source failover">Resolve multiple sources, rank them, and move to the next server when a playback source fails.</Feature>
                        <Feature icon={Gauge} title="Adaptive quality">Expose HLS levels directly in the settings menu with Auto, 1080p, 720p and every rendition the manifest provides.</Feature>
                        <Feature icon={Captions} title="Caption tracks">Use HLS subtitle tracks from the stream and switch them instantly from the player controls.</Feature>
                        <Feature icon={MonitorPlay} title="Real player controls">Seek, volume, fullscreen, PiP, keyboard shortcuts, progress persistence and auto-hiding controls.</Feature>
                        <Feature icon={Layers3} title="Reusable frontend">Use the player inside the full Synapse site, the dedicated demo page, or your own React route.</Feature>
                        <Feature icon={ServerCog} title="Normalized API">The frontend consumes one server shape regardless of which provider resolved the media source.</Feature>
                    </div>
                </div>
            </section>

            <section className="px-5 py-20 md:px-8 md:py-28">
                <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/35">Flow</p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">TMDB ID in. Player ready.</h2>
                        <p className="mt-5 max-w-xl text-base leading-7 text-white/45">The demo takes a TMDB ID, resolves available sources through the existing backend, then hands the selected stream to the same Synapse Player component used by the watch page.</p>
                        <Link to="/demo" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/70">
                            Try the demo <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-7">
                        {[
                            ["01", "Resolve", "Query the provider stack in priority order."],
                            ["02", "Normalize", "Return a consistent server, quality and playback URL shape."],
                            ["03", "Prepare", "Proxy/rewrite HLS when the source needs playback headers."],
                            ["04", "Play", "Attach HLS.js, expose levels and subtitle tracks, then start playback."],
                        ].map(([n, title, body], i) => (
                            <div key={n} className={`flex gap-4 py-5 ${i ? "border-t border-white/10" : ""}`}>
                                <div className="mt-0.5 font-mono text-xs text-white/25">{n}</div>
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-semibold"><Check className="h-4 w-4 text-white/55" /> {title}</div>
                                    <p className="mt-1 text-sm leading-6 text-white/40">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-5 pb-24 md:px-8 md:pb-32">
                <div className="mx-auto max-w-7xl rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] p-8 text-center md:p-14">
                    <Cloud className="mx-auto h-11 w-11 text-white/70" strokeWidth={1.5} />
                    <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">See the actual player.</h2>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45 md:text-base">Enter a TMDB ID, choose movie or TV, and run the same provider + playback logic used by Synapse.</p>
                    <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link to="/demo" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">Launch demo</Link>
                        <Link to="/docs" className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/75 hover:bg-white/[0.05]">Open docs</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
