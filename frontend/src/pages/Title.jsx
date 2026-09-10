import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Play, Plus, Skull, Star } from "lucide-react";
import { getDetails, getSeason, getStreams, img } from "@/lib/api";
import { titleOf, yearOf, runtimeStr, ratingStr } from "@/lib/format";
import { Row } from "@/components/Row";
import { Spinner } from "@/components/Spinner";
import { TrailerPreview } from "@/components/TrailerPreview";
import { DetailsTrailerBackground } from "@/components/DetailsTrailerBackground";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";
import { requestWebPlayback } from "@/lib/webPlayer";

const SeasonPicker = ({ id, seasons, seriesMeta }) => {
  const navigate = useNavigate();
  const valid = seasons.filter((season) => season.season_number > 0);
  const [selectedSeason, setSelectedSeason] = useState(valid[0]?.season_number || 1);
  const { data } = useQuery({
    queryKey: ["season", String(id), selectedSeason],
    queryFn: () => getSeason(id, selectedSeason),
    enabled: Boolean(selectedSeason),
    staleTime: 3 * 60_000,
  });

  const playEpisode = (episodeNumber) => {
    requestWebPlayback({ mediaType: "tv", id, season: selectedSeason, episode: episodeNumber, meta: seriesMeta }, navigate);
  };

  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8" data-testid="season-picker">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--site-accent,#ffd400)]">Episodes</p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white md:text-2xl">Choose an episode</h2>
        </div>
        <select data-testid="season-select" value={selectedSeason} onChange={(event) => setSelectedSeason(Number(event.target.value))} className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-white/25">
          {valid.map((season) => <option key={season.id} value={season.season_number} className="bg-[#111]">{season.name}</option>)}
        </select>
      </div>

      <div className="grid gap-2.5">
        {(data?.episodes || []).map((episode) => (
          <button key={episode.id} data-testid={`episode-${episode.episode_number}`} onClick={() => playEpisode(episode.episode_number)} className="group flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:border-white/14 hover:bg-white/[0.045]">
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black md:w-44">
              {episode.still_path && <img src={img(episode.still_path, "w300")} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />}
              <div className="absolute inset-0 grid place-items-center bg-black/34 opacity-0 transition group-hover:opacity-100"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--site-accent,#ffd400)] text-black"><Play className="ml-0.5 h-4 w-4 fill-current" /></span></div>
            </div>
            <div className="min-w-0 py-1">
              <p className="truncate text-sm font-semibold text-white/88 md:text-[15px]">{episode.episode_number}. {episode.name}</p>
              <p className="mt-1 text-[11px] text-white/32">{episode.runtime ? `${episode.runtime}m` : ""}{episode.air_date ? ` · ${episode.air_date}` : ""}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/40 md:text-sm">{episode.overview}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

const has2160pSource = (payload) => (payload?.servers || []).some((server) => {
  const value = `${server?.quality || ""} ${server?.label || ""} ${server?.url || ""}`;
  return /(^|[^0-9])2160(?:p)?([^0-9]|$)|\b4k\b/i.test(value);
});

export default function Title() {
  const { mediaType, id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["details", mediaType, String(id)], queryFn: () => getDetails(mediaType, id), staleTime: 5 * 60_000 });
  const [saved, setSaved] = useState(false);

  const detailTitle = data ? titleOf(data) : "";
  const jumpYear = Number(String(data?.release_date || "").slice(0, 4)) || undefined;
  const isHorror = mediaType === "movie" && (data?.genres || []).some((genre) => genre?.id === 27 || String(genre?.name || "").toLowerCase() === "horror");

  const { data: uhdSources } = useQuery({
    queryKey: ["title-uhd", mediaType, id],
    queryFn: () => getStreams(mediaType, id, mediaType === "tv" ? 1 : undefined, mediaType === "tv" ? 1 : undefined, {
      provider: "orlando", timeout: 5200, title: titleOf(data),
      year: Number(String(data?.release_date || data?.first_air_date || "").slice(0, 4)) || undefined,
      imdbId: data?.imdb_id || data?.external_ids?.imdb_id || undefined,
    }).catch(() => null),
    enabled: Boolean(data?.id), staleTime: 5 * 60_000, retry: 0,
  });

  const { data: jumpScares } = useQuery({
    queryKey: ["jumpscares", detailTitle, jumpYear],
    queryFn: async () => {
      const params = new URLSearchParams({ title: detailTitle });
      if (jumpYear) params.set("year", String(jumpYear));
      const response = await fetch(`/api/jumpscares?${params.toString()}`);
      if (!response.ok) return { found: false };
      return response.json();
    },
    enabled: isHorror && Boolean(detailTitle), staleTime: 6 * 60 * 60_000, retry: 0,
  });

  useEffect(() => setSaved(inWatchlist({ media_type: mediaType, id: Number(id) })), [id, mediaType]);
  useEffect(() => window.scrollTo(0, 0), [id]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center bg-[#050505]"><Spinner /></div>;

  const genres = (data.genres || []).map((genre) => genre.name);
  const cast = (data.credits?.cast || []).slice(0, 12);
  const similar = data.similar?.results || data.recommendations?.results || [];
  const videos = data.videos?.results || [];
  const hasUhd = has2160pSource(uhdSources);
  const meta = { title: titleOf(data), poster_path: data.poster_path, backdrop_path: data.backdrop_path, release_date: data.release_date, first_air_date: data.first_air_date };

  const play = () => requestWebPlayback({ mediaType, id, season: 1, episode: 1, meta }, navigate);
  const save = () => {
    const now = toggleWatchlist({ media_type: mediaType, id: Number(id), title: titleOf(data), poster_path: data.poster_path, backdrop_path: data.backdrop_path, vote_average: data.vote_average, release_date: data.release_date, first_air_date: data.first_air_date });
    setSaved(now);
  };

  return (
    <main className="min-h-screen bg-[#050505]" data-testid="title-page">
      <section className="relative h-[78vh] min-h-[600px] max-h-[880px] overflow-hidden">
        <DetailsTrailerBackground videos={videos} title={titleOf(data)} backdropPath={data.backdrop_path} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,.98)_0%,rgba(5,5,5,.76)_31%,rgba(5,5,5,.24)_66%,rgba(5,5,5,.08)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,.76)_11%,transparent_52%)]" />

        <button onClick={() => navigate(-1)} className="absolute left-5 top-24 z-10 grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-black/42 text-white/72 backdrop-blur-md transition hover:bg-white/10 hover:text-white md:left-8" aria-label="Go back"><ChevronLeft className="h-5 w-5" /></button>

        <div className="absolute inset-x-0 bottom-0 z-[2] mx-auto max-w-[1500px] px-5 pb-14 md:px-8 md:pb-16">
          <div className="max-w-[780px]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--site-accent,#ffd400)]">{mediaType === "tv" ? "Series" : "Feature film"}</p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.94] tracking-[-0.06em] text-white md:text-7xl">{titleOf(data)}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium text-white/55">
              {Number(data.vote_average) > 0 && <span className="inline-flex items-center gap-1.5 text-[var(--site-accent,#ffd400)]"><Star className="h-3.5 w-3.5 fill-current" />{ratingStr(data.vote_average)}</span>}
              {yearOf(data) && <span>{yearOf(data)}</span>}
              {mediaType === "movie" && data.runtime ? <span>{runtimeStr(data.runtime)}</span> : null}
              {mediaType === "tv" && data.number_of_seasons ? <span>{data.number_of_seasons} Season{data.number_of_seasons > 1 ? "s" : ""}</span> : null}
              {isHorror && jumpScares?.found && <span data-testid="jumpscare-counter" className="inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-red-400/20 bg-black/58 px-2 text-[10px] font-medium text-white/78"><Skull className="h-3 w-3 text-red-400/85" /><strong className="font-semibold text-white">{jumpScares.count}</strong> jumpscare{jumpScares.count === 1 ? "" : "s"}</span>}
              {hasUhd && <span data-testid="title-4k-uhd-badge" className="inline-flex h-6 items-center rounded-[5px] border border-white/35 bg-black/70 px-2 text-[9px] font-black uppercase tracking-[0.11em] text-white">4K UHD</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">{genres.slice(0, 4).map((genre) => <span key={genre} className="text-[11px] font-medium text-white/46">{genre}</span>)}</div>
            {data.overview && <p className="mt-5 max-w-[660px] text-sm leading-6 text-white/56 md:text-[15px] md:leading-7">{data.overview}</p>}

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button data-testid="title-play-button" onClick={play} className="inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-bold"><Play className="h-4 w-4 fill-current" /> Play</button>
              <button data-testid="title-watchlist-button" onClick={save} className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold">{saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saved ? "In My List" : "My List"}</button>
            </div>
          </div>
        </div>
      </section>

      <TrailerPreview videos={videos} title={titleOf(data)} />
      {mediaType === "tv" && data.seasons && <SeasonPicker id={id} seasons={data.seasons} seriesMeta={meta} />}

      {cast.length > 0 && (
        <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--site-accent,#ffd400)]">Cast</p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white md:text-2xl">People behind the title</h2>
          <div className="scrollbar-none mt-5 flex gap-4 overflow-x-auto pb-2">
            {cast.map((person) => (
              <button key={person.id} type="button" onClick={() => navigate(`/person/${person.id}`)} className="group w-24 shrink-0 text-center" aria-label={`View ${person.name}`}>
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/18">{person.profile_path ? <img src={img(person.profile_path, "w185")} alt={person.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-semibold text-[var(--site-accent,#ffd400)]">{person.name?.[0]}</div>}</div>
                <p className="mt-2 truncate text-xs font-semibold text-white/74 transition group-hover:text-white">{person.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/30">{person.character}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && <Row title="More like this" items={similar} fallbackType={mediaType} testId="row-similar" />}
      <div className="h-16" />
    </main>
  );
}
