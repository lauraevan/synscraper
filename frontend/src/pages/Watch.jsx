import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ListVideo } from "lucide-react";
import { getDetails, getSeason, img } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SynapsePlayer } from "@/components/SynapsePlayer";
import { Spinner } from "@/components/Spinner";

export default function Watch({ embed = false }) {
    const { mediaType, id } = useParams();
    const [sp, setSp] = useSearchParams();
    const navigate = useNavigate();
    const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false);
    const episodeMenuRef = useRef(null);
    const season = Number(sp.get("season") || 1);
    const episode = Number(sp.get("episode") || 1);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    useEffect(() => {
        const close = (event) => {
            if (episodeMenuRef.current && !episodeMenuRef.current.contains(event.target)) setEpisodeMenuOpen(false);
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, []);

    useEffect(() => setEpisodeMenuOpen(false), [season, episode]);

    const { data: details, isLoading } = useQuery({
        queryKey: ["details", mediaType, id],
        queryFn: () => getDetails(mediaType, id),
    });

    const { data: seasonData } = useQuery({
        queryKey: ["season", id, season],
        queryFn: () => getSeason(id, season),
        enabled: mediaType === "tv",
    });

    useEffect(() => {
        if (!embed || !details) return;
        window.parent?.postMessage({
            type: "synplayer:ready",
            mediaType,
            id,
            season,
            episode,
            title: titleOf(details),
        }, "*");
    }, [embed, details, mediaType, id, season, episode]);

    const epCount = seasonData?.episodes?.length || 0;
    const hasNext = mediaType === "tv" && episode < epCount;
    const validSeasons = (details?.seasons || []).filter((item) => item.season_number > 0);

    const nextEpisode = () => {
        if (hasNext) setSp({ season: String(season), episode: String(episode + 1) });
    };

    const pickEpisode = (episodeNumber) => {
        setSp({ season: String(season), episode: String(episodeNumber) });
        setEpisodeMenuOpen(false);
        if (embed) window.parent?.postMessage({ type: "synplayer:episodechange", mediaType, id, season, episode: episodeNumber }, "*");
    };

    const pickSeason = (seasonNumber) => {
        setSp({ season: String(seasonNumber), episode: "1" });
        setEpisodeMenuOpen(true);
        if (embed) window.parent?.postMessage({ type: "synplayer:episodechange", mediaType, id, season: seasonNumber, episode: 1 }, "*");
    };

    const handleBack = () => {
        if (embed) {
            window.parent?.postMessage({ type: "synplayer:back", mediaType, id, season, episode }, "*");
            return;
        }
        navigate(`/title/${mediaType}/${id}`);
    };

    if (isLoading || !details) {
        return <div className={`min-h-screen bg-black ${embed ? "grid place-items-center" : "pt-16"}`}><Spinner label="Preparing playback…" /></div>;
    }

    const meta = {
        title: titleOf(details),
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date,
        first_air_date: details.first_air_date,
    };

    return (
        <main data-testid={embed ? "embed-player-page" : "watch-page"} className={embed ? "min-h-screen bg-black p-0" : "min-h-screen bg-black px-3 pb-6 pt-3 md:px-6 md:pt-6"}>
            <div className={embed ? "w-full" : "mx-auto max-w-[1600px]"}>
                {!embed && (
                    <div className="mb-3 flex min-h-11 items-center justify-between gap-3 md:mb-4">
                        <button
                            type="button"
                            onClick={handleBack}
                            data-testid="watch-back-button"
                            className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.045] px-4 text-sm font-semibold text-white/82 backdrop-blur-xl transition hover:border-white/[0.22] hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                            <span>Back</span>
                        </button>
                        <div className="min-w-0 text-right">
                            <p className="truncate text-[13px] font-medium text-white/78 md:text-sm">{titleOf(details)}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/28">SynPlayer</p>
                        </div>
                    </div>
                )}

                <div className="relative">
                    <SynapsePlayer
                        key={`${mediaType}-${id}-${season}-${episode}`}
                        mediaType={mediaType}
                        id={id}
                        meta={meta}
                        season={season}
                        episode={episode}
                        hasNext={hasNext}
                        onNextEpisode={nextEpisode}
                        onBack={handleBack}
                    />

                    {mediaType === "tv" && seasonData?.episodes?.length > 0 && (
                        <div ref={episodeMenuRef} className="absolute right-3 top-3 z-[80] md:right-5 md:top-5" data-testid="player-episode-menu">
                            <button
                                type="button"
                                onClick={() => setEpisodeMenuOpen((open) => !open)}
                                className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold backdrop-blur-xl transition md:h-11 md:px-4 ${episodeMenuOpen ? "border-[#ffd400]/35 bg-[#ffd400]/12 text-[#ffd400]" : "border-white/15 bg-black/55 text-white/88 hover:border-white/28 hover:bg-black/72"}`}
                                aria-label="Episodes"
                                aria-expanded={episodeMenuOpen}
                            >
                                <ListVideo className="h-4 w-4" />
                                <span>Episodes</span>
                                <span className="text-white/42">S{season} E{episode}</span>
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${episodeMenuOpen ? "rotate-180" : ""}`} />
                            </button>

                            {episodeMenuOpen && (
                                <div className="absolute right-0 top-[48px] w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/12 bg-[#08090c]/95 shadow-[0_24px_70px_rgba(0,0,0,.72)] backdrop-blur-2xl md:top-[52px]">
                                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3.5 py-3">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffd400]/65">Now playing</p>
                                            <p className="mt-0.5 truncate text-sm font-semibold text-white/90">Season {season} · Episode {episode}</p>
                                        </div>
                                        {validSeasons.length > 1 && (
                                            <select
                                                value={season}
                                                onChange={(event) => pickSeason(Number(event.target.value))}
                                                className="max-w-[128px] rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-white/80 outline-none focus:border-[#ffd400]/35"
                                                aria-label="Season"
                                            >
                                                {validSeasons.map((item) => (
                                                    <option key={item.id} value={item.season_number} className="bg-[#111]">{item.name || `Season ${item.season_number}`}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div className="synflix-episode-menu-scroll max-h-[340px] overflow-y-auto p-2">
                                        {seasonData.episodes.map((ep) => {
                                            const selected = ep.episode_number === episode;
                                            return (
                                                <button
                                                    key={ep.id}
                                                    type="button"
                                                    data-testid={`watch-ep-${ep.episode_number}`}
                                                    onClick={() => pickEpisode(ep.episode_number)}
                                                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${selected ? "bg-[#ffd400]/10" : "hover:bg-white/[0.05]"}`}
                                                >
                                                    <span className={`relative h-[46px] w-[82px] shrink-0 overflow-hidden rounded-lg border bg-[#101114] ${selected ? "border-[#ffd400]/35" : "border-white/[0.08]"}`}>
                                                        {ep.still_path ? (
                                                            <img src={img(ep.still_path, "w300")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="absolute inset-0 bg-[linear-gradient(135deg,#17191f,#090a0d)]" />
                                                        )}
                                                        <span className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
                                                        <span className={`absolute bottom-1 left-1.5 text-[15px] font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,.95)] ${selected ? "text-[#ffd400]" : "text-white"}`}>{ep.episode_number}</span>
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={`block truncate text-[13px] font-medium ${selected ? "text-[#ffd400]" : "text-white/82"}`}>{ep.name || `Episode ${ep.episode_number}`}</span>
                                                        <span className="mt-0.5 block truncate text-[10px] text-white/30">{ep.runtime ? `${ep.runtime} min` : `Season ${season}`}</span>
                                                    </span>
                                                    {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd400]" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
