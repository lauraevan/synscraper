import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Film, LoaderCircle, Tv2 } from "lucide-react";
import { getDetails } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SynapsePlayer } from "@/components/SynapsePlayer";

const DEFAULT_DEMO = {
    id: "1083381",
    mediaType: "movie",
    season: undefined,
    episode: undefined,
    meta: { title: "Backrooms", release_date: "2026-05-27" },
};

export default function Demo() {
    const [mediaType, setMediaType] = useState("movie");
    const [tmdbId, setTmdbId] = useState(DEFAULT_DEMO.id);
    const [season, setSeason] = useState("1");
    const [episode, setEpisode] = useState("1");
    const [active, setActive] = useState(DEFAULT_DEMO);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        getDetails("movie", DEFAULT_DEMO.id).then((details) => {
            if (!alive) return;
            setActive((current) => current?.id === DEFAULT_DEMO.id ? {
                ...current,
                meta: {
                    title: titleOf(details) || "Backrooms",
                    poster_path: details.poster_path,
                    backdrop_path: details.backdrop_path,
                    release_date: details.release_date || "2026-05-27",
                },
            } : current);
        }).catch(() => {});
        return () => { alive = false; };
    }, []);

    const canLaunch = tmdbId.trim().length > 0 && !loading;

    const activeKey = useMemo(() => active ? `${active.mediaType}-${active.id}-${active.season}-${active.episode}` : "none", [active]);

    const launch = async (e) => {
        e?.preventDefault();
        if (!canLaunch) return;

        setLoading(true);
        setError("");
        try {
            const details = await getDetails(mediaType, tmdbId.trim());
            setActive({
                id: tmdbId.trim(),
                mediaType,
                season: mediaType === "tv" ? Number(season || 1) : undefined,
                episode: mediaType === "tv" ? Number(episode || 1) : undefined,
                meta: {
                    title: titleOf(details),
                    poster_path: details.poster_path,
                    backdrop_path: details.backdrop_path,
                    release_date: details.release_date,
                    first_air_date: details.first_air_date,
                },
            });
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || "Could not load that TMDB title.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black px-5 pb-24 pt-28 md:px-8 md:pt-32">
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                        <Cloud className="h-3.5 w-3.5" /> Live player demo
                    </div>
                    <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl md:text-6xl">Backrooms is ready to play.</h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/45 md:text-base">The licensed Backrooms demo starts here by default. Enter any other TMDB ID to test another title with the same live resolver and player.</p>
                </div>

                <form onSubmit={launch} className="mx-auto mt-10 max-w-4xl rounded-[26px] border border-white/10 bg-white/[0.035] p-4 md:p-5">
                    <div className="grid gap-3 md:grid-cols-[170px_1fr_auto_auto]">
                        <div className="flex rounded-2xl border border-white/10 bg-black/55 p-1">
                            <button type="button" onClick={() => setMediaType("movie")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm transition ${mediaType === "movie" ? "bg-white text-black" : "text-white/45 hover:text-white"}`}>
                                <Film className="h-4 w-4" /> Movie
                            </button>
                            <button type="button" onClick={() => setMediaType("tv")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm transition ${mediaType === "tv" ? "bg-white text-black" : "text-white/45 hover:text-white"}`}>
                                <Tv2 className="h-4 w-4" /> TV
                            </button>
                        </div>

                        <input value={tmdbId} onChange={(e) => setTmdbId(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="TMDB ID" className="h-[52px] rounded-2xl border border-white/10 bg-black/55 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25" />

                        {mediaType === "tv" && (
                            <>
                                <input value={season} onChange={(e) => setSeason(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Season" className="h-[52px] min-w-24 rounded-2xl border border-white/10 bg-black/55 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25" />
                                <input value={episode} onChange={(e) => setEpisode(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Episode" className="h-[52px] min-w-24 rounded-2xl border border-white/10 bg-black/55 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/25" />
                            </>
                        )}
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-white/30">Backrooms (2026) is loaded by default. Enter another TMDB ID anytime.</p>
                        <button disabled={!canLaunch} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35">
                            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {loading ? "Loading metadata" : "Launch player"}
                        </button>
                    </div>
                    {error && <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200/80">{error}</p>}
                </form>

                {active ? (
                    <section className="mt-10">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-white/30">Now testing</p>
                                <h2 className="mt-1 text-lg font-semibold">{active.meta.title}</h2>
                            </div>
                            <button onClick={() => setActive(null)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/[0.05] hover:text-white">Reset demo</button>
                        </div>

                        <SynapsePlayer
                            key={activeKey}
                            mediaType={active.mediaType}
                            id={active.id}
                            meta={active.meta}
                            season={active.season}
                            episode={active.episode}
                            onBack={() => setActive(null)}
                        />
                    </section>
                ) : (
                    <section className="mx-auto mt-10 grid min-h-[360px] max-w-5xl place-items-center rounded-[28px] border border-dashed border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_38%)] p-8 text-center">
                        <div className="max-w-md">
                            <Cloud className="mx-auto h-12 w-12 text-white/25" strokeWidth={1.4} />
                            <h2 className="mt-5 text-xl font-semibold">Your player will appear here.</h2>
                            <p className="mt-2 text-sm leading-6 text-white/35">Enter a TMDB ID above. The resolving screen will run first, then the real playback UI will take over.</p>
                            <Link to="/docs" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/65 hover:text-white">How the player works <ArrowRight className="h-4 w-4" /></Link>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
