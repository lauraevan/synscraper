import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Play, Plus, Star } from "lucide-react";
import { getDetails, getSeason, backdrop, img } from "@/lib/api";
import { titleOf, yearOf, runtimeStr, ratingStr } from "@/lib/format";
import { Row } from "@/components/Row";
import { Spinner } from "@/components/Spinner";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";

const SeasonPicker = ({ id, seasons }) => {
  const navigate = useNavigate();
  const valid = seasons.filter((s) => s.season_number > 0);
  const [sel, setSel] = useState(valid[0]?.season_number || 1);
  const { data } = useQuery({ queryKey: ["season", id, sel], queryFn: () => getSeason(id, sel), enabled: !!sel });

  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8" data-testid="season-picker">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Episodes</h2><p className="mt-1 text-xs text-white/32">Pick up anywhere in the season.</p></div>
        <select data-testid="season-select" value={sel} onChange={(e) => setSel(Number(e.target.value))} className="rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white outline-none focus:border-white/25">
          {valid.map((s) => <option key={s.id} value={s.season_number} className="bg-[#111]">{s.name}</option>)}
        </select>
      </div>
      <div className="grid gap-2.5">
        {(data?.episodes || []).map((ep) => (
          <button key={ep.id} data-testid={`episode-${ep.episode_number}`} onClick={() => navigate(`/watch/tv/${id}?season=${sel}&episode=${ep.episode_number}`)} className="group flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.045]">
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black md:w-44">
              {ep.still_path && <img src={img(ep.still_path, "w300")} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black"><Play className="h-4 w-4 fill-current" /></span></div>
            </div>
            <div className="min-w-0 py-1">
              <p className="truncate text-sm font-medium text-white/86 md:text-[15px]">{ep.episode_number}. {ep.name}</p>
              <p className="mt-1 text-[11px] text-white/30">{ep.runtime ? `${ep.runtime}m` : ""}{ep.air_date ? ` · ${ep.air_date}` : ""}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/38 md:text-sm">{ep.overview}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default function Title() {
  const { mediaType, id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["details", mediaType, id], queryFn: () => getDetails(mediaType, id) });
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(inWatchlist({ media_type: mediaType, id: Number(id) })), [id, mediaType]);
  useEffect(() => window.scrollTo(0, 0), [id]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center bg-[#070707]"><Spinner /></div>;

  const genres = (data.genres || []).map((g) => g.name);
  const cast = (data.credits?.cast || []).slice(0, 12);
  const similar = data.similar?.results || data.recommendations?.results || [];
  const save = () => {
    const now = toggleWatchlist({ media_type: mediaType, id: Number(id), title: titleOf(data), poster_path: data.poster_path, backdrop_path: data.backdrop_path, vote_average: data.vote_average, release_date: data.release_date, first_air_date: data.first_air_date });
    setSaved(now);
  };

  return (
    <main className="min-h-screen bg-[#070707]" data-testid="title-page">
      <section className="relative h-[72vh] min-h-[560px] max-h-[840px] overflow-hidden">
        <img src={backdrop(data.backdrop_path, "original")} alt={titleOf(data)} className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,.97)_0%,rgba(7,7,7,.72)_34%,rgba(7,7,7,.18)_70%,rgba(7,7,7,.08)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#070707_0%,rgba(7,7,7,.72)_11%,transparent_50%)]" />

        <button onClick={() => navigate(-1)} className="absolute left-5 top-24 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/38 text-white/72 backdrop-blur-md transition hover:bg-white/10 hover:text-white md:left-8"><ChevronLeft className="h-5 w-5" /></button>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1500px] px-5 pb-14 md:px-8 md:pb-16">
          <div className="max-w-[760px]">
            <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-white md:text-7xl">{titleOf(data)}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/55">
              {Number(data.vote_average) > 0 && <span className="inline-flex items-center gap-1.5 font-medium text-white/82"><Star className="h-3.5 w-3.5 fill-current" />{ratingStr(data.vote_average)}</span>}
              {yearOf(data) && <span>{yearOf(data)}</span>}
              {mediaType === "movie" && data.runtime ? <span>{runtimeStr(data.runtime)}</span> : null}
              {mediaType === "tv" && data.number_of_seasons ? <span>{data.number_of_seasons} Season{data.number_of_seasons > 1 ? "s" : ""}</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{genres.slice(0, 4).map((g) => <span key={g} className="rounded-full border border-white/12 bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/45 backdrop-blur-sm">{g}</span>)}</div>
            {data.overview && <p className="mt-5 max-w-[650px] text-sm leading-6 text-white/52 md:text-[15px] md:leading-7">{data.overview}</p>}
            <div className="mt-7 flex items-center gap-2.5">
              <button data-testid="title-play-button" onClick={() => navigate(`/watch/${mediaType}/${id}${mediaType === "tv" ? "?season=1&episode=1" : ""}`)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/88"><Play className="h-4 w-4 fill-current" /> Play</button>
              <button data-testid="title-watchlist-button" onClick={save} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/14 bg-black/28 px-5 text-sm font-medium text-white/78 backdrop-blur-md transition hover:bg-white/[0.08] hover:text-white">{saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saved ? "In My List" : "My List"}</button>
            </div>
          </div>
        </div>
      </section>

      {mediaType === "tv" && data.seasons && <SeasonPicker id={id} seasons={data.seasons} />}

      {cast.length > 0 && (
        <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Cast</h2>
          <div className="scrollbar-none mt-5 flex gap-4 overflow-x-auto pb-2">
            {cast.map((person) => (
              <div key={person.id} className="w-24 shrink-0 text-center">
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03]">{person.profile_path ? <img src={img(person.profile_path, "w185")} alt={person.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-semibold text-white/20">{person.name?.[0]}</div>}</div>
                <p className="mt-2 truncate text-xs font-medium text-white/70">{person.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/28">{person.character}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && <Row title="More like this" items={similar} fallbackType={mediaType} testId="row-similar" />}
      <div className="h-12" />
    </main>
  );
}
