import { useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDetails, getSeason } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SynapsePlayer } from "@/components/SynapsePlayer";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Spinner } from "@/components/Spinner";

export default function Watch() {
    const { mediaType, id } = useParams();
    const [sp, setSp] = useSearchParams();
    const navigate = useNavigate();
    const season = Number(sp.get("season") || 1);
    const episode = Number(sp.get("episode") || 1);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { data: details, isLoading } = useQuery({
        queryKey: ["details", mediaType, id],
        queryFn: () => getDetails(mediaType, id),
    });

    const { data: seasonData } = useQuery({
        queryKey: ["season", id, season],
        queryFn: () => getSeason(id, season),
        enabled: mediaType === "tv",
    });

    const epCount = seasonData?.episodes?.length || 0;
    const hasNext = mediaType === "tv" && episode < epCount;
    const currentEp = useMemo(
        () => seasonData?.episodes?.find((e) => e.episode_number === episode),
        [seasonData, episode]
    );

    const nextEpisode = () => {
        if (hasNext) setSp({ season: String(season), episode: String(episode + 1) });
    };

    if (isLoading || !details) {
        return <div className="min-h-screen bg-black pt-16"><Spinner label="Preparing playback…" /></div>;
    }

    const meta = {
        title: titleOf(details),
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date,
        first_air_date: details.first_air_date,
    };

    return (
        <main data-testid="watch-page" className="min-h-screen bg-black px-3 pb-14 pt-3 md:px-6 md:pt-6">
            <div className="mx-auto max-w-[1600px]">
                <SynapsePlayer
                    key={`${mediaType}-${id}-${season}-${episode}`}
                    mediaType={mediaType}
                    id={id}
                    meta={meta}
                    season={season}
                    episode={episode}
                    hasNext={hasNext}
                    onNextEpisode={nextEpisode}
                    onBack={() => navigate(`/title/${mediaType}/${id}`)}
                />

                <DownloadPanel
                    mediaType={mediaType}
                    id={id}
                    season={season}
                    episode={episode}
                    title={meta.title}
                />

                <div className="mx-auto mt-7 max-w-6xl border-t border-white/10 pt-6">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/25">Now playing</p>
                            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{meta.title}</h1>
                            {mediaType === "tv" && currentEp && (
                                <p className="mt-2 text-sm text-white/55">Season {season} · Episode {episode} — {currentEp.name}</p>
                            )}
                            <p className="mt-4 text-sm leading-6 text-white/38">
                                {mediaType === "tv" ? currentEp?.overview || details.overview : details.overview}
                            </p>
                        </div>
                    </div>

                    {mediaType === "tv" && seasonData?.episodes?.length > 0 && (
                        <div className="mt-9" data-testid="watch-episode-strip">
                            <h2 className="mb-3 text-sm font-semibold text-white/75">Season {season}</h2>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                {seasonData.episodes.map((ep) => (
                                    <button
                                        key={ep.id}
                                        data-testid={`watch-ep-${ep.episode_number}`}
                                        onClick={() => setSp({ season: String(season), episode: String(ep.episode_number) })}
                                        className={`rounded-xl border p-3 text-left text-sm transition-all ${
                                            ep.episode_number === episode
                                                ? "border-white/30 bg-white/[0.08]"
                                                : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                                        }`}
                                    >
                                        <span className="font-mono text-[10px] text-white/25">EP {ep.episode_number}</span>
                                        <p className="mt-1 truncate font-medium text-white/70">{ep.name}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
