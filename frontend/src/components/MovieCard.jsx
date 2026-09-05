import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Play, Plus, Star } from "lucide-react";
import { img } from "@/lib/api";
import { mediaTypeOf, ratingStr, titleOf, yearOf } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";

export const MovieCard = ({ item, fallbackType, fluid = false }) => {
  const navigate = useNavigate();
  const mt = mediaTypeOf(item, fallbackType);
  const poster = img(item.poster_path, "w500");
  const [saved, setSaved] = useState(() => inWatchlist({ media_type: mt, id: item.id }));

  const go = () => navigate(`/title/${mt}/${item.id}`);
  const play = (e) => {
    e.stopPropagation();
    navigate(`/watch/${mt}/${item.id}${mt === "tv" ? "?season=1&episode=1" : ""}`);
  };
  const save = (e) => {
    e.stopPropagation();
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
    <article data-testid={`movie-card-${item.id}`} onClick={go} className={`group min-w-0 cursor-pointer select-none ${fluid ? "w-full" : "w-[148px] shrink-0 snap-start sm:w-[168px] md:w-[184px] lg:w-[196px]"}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#111] transition duration-300 ease-out group-hover:-translate-y-1 group-hover:border-white/18 group-hover:shadow-[0_16px_34px_rgba(0,0,0,.38)]">
        {poster ? <img src={poster} alt={titleOf(item)} loading="lazy" className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]" /> : <div className="grid h-full w-full place-items-center p-4 text-center text-xs text-white/28">{titleOf(item)}</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {Number(item.vote_average) > 0 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/68 px-1.5 py-1 text-[10px] font-semibold text-white/82 backdrop-blur-sm">
            <Star className="h-2.5 w-2.5 fill-current" />{ratingStr(item.vote_average)}
          </span>
        )}

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex translate-y-2 items-center gap-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <button data-testid={`movie-card-play-btn-${item.id}`} onClick={play} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:scale-105" aria-label="Play"><Play className="h-4 w-4 fill-current" /></button>
          <button data-testid={`movie-card-save-btn-${item.id}`} onClick={save} className="grid h-9 w-9 place-items-center rounded-full border border-white/18 bg-black/60 text-white backdrop-blur-md transition hover:bg-white/12" aria-label={saved ? "Remove from My List" : "Add to My List"}>{saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button>
        </div>
      </div>

      <div className="px-0.5 pt-2.5">
        <h3 className="truncate text-[13px] font-medium tracking-[-0.01em] text-white/88 transition group-hover:text-white sm:text-sm">{titleOf(item)}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/34">
          {yearOf(item) && <span>{yearOf(item)}</span>}
          {yearOf(item) && <span className="h-0.5 w-0.5 rounded-full bg-white/22" />}
          <span>{mt === "tv" ? "Series" : "Movie"}</span>
        </div>
      </div>
    </article>
  );
};
