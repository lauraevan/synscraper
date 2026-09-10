import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Play, Plus, Star } from "lucide-react";
import { getDetails, img } from "@/lib/api";
import { mediaTypeOf, ratingStr, titleOf, yearOf } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";
import { requestWebPlayback } from "@/lib/webPlayer";

export const MovieCard = ({ item, fallbackType, fluid = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mt = mediaTypeOf(item, fallbackType);
  const poster = img(item.poster_path, "w500");
  const [saved, setSaved] = useState(() => inWatchlist({ media_type: mt, id: item.id }));

  const meta = {
    title: titleOf(item),
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ["details", mt, String(item.id)],
      queryFn: () => getDetails(mt, item.id),
      staleTime: 5 * 60_000,
    });
  };

  const go = () => navigate(`/title/${mt}/${item.id}`);
  const play = (event) => {
    event.stopPropagation();
    requestWebPlayback({ mediaType: mt, id: item.id, season: 1, episode: 1, meta }, navigate);
  };
  const save = (event) => {
    event.stopPropagation();
    const next = toggleWatchlist({
      media_type: mt,
      id: item.id,
      title: titleOf(item),
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
    });
    setSaved(next);
  };

  return (
    <article
      data-testid={`movie-card-${item.id}`}
      onClick={go}
      onPointerEnter={prefetch}
      className={`group min-w-0 cursor-pointer select-none ${fluid ? "w-full" : "w-[148px] shrink-0 snap-start sm:w-[168px] md:w-[184px] lg:w-[196px]"}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-white/[0.065] bg-[#111]">
        {poster ? (
          <img src={poster} alt={titleOf(item)} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center p-4 text-center text-xs text-white/28">{titleOf(item)}</div>
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_44%,rgba(0,0,0,.16)_63%,rgba(0,0,0,.92)_100%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {Number(item.vote_average) > 0 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[5px] border border-white/10 bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white/84 backdrop-blur-md">
            <Star className="h-2.5 w-2.5 fill-current text-[var(--site-accent,#ffd400)]" />{ratingStr(item.vote_average)}
          </span>
        )}

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex translate-y-2 items-center justify-between gap-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <button data-testid={`movie-card-play-btn-${item.id}`} onClick={play} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--site-accent,#ffd400)] text-black transition-transform hover:scale-105" aria-label="Play">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </button>
            <button data-testid={`movie-card-save-btn-${item.id}`} onClick={save} className="grid h-9 w-9 place-items-center rounded-full border border-white/18 bg-black/58 text-white backdrop-blur-lg transition hover:border-white/32 hover:bg-white/10" aria-label={saved ? "Remove from My List" : "Add to My List"}>
              {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <span className="rounded-[4px] border border-white/15 bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-white/56">{mt === "tv" ? "Series" : "Movie"}</span>
        </div>
      </div>

      <div className="px-0.5 pt-2.5">
        <h3 className="truncate text-[13px] font-semibold tracking-[-0.018em] text-white/88 transition-colors group-hover:text-white sm:text-sm">{titleOf(item)}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/34">
          {yearOf(item) && <span>{yearOf(item)}</span>}
          {yearOf(item) && <span className="h-0.5 w-0.5 rounded-full bg-white/22" />}
          <span>{mt === "tv" ? "Series" : "Movie"}</span>
        </div>
      </div>
    </article>
  );
};
