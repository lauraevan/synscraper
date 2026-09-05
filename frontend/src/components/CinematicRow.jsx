import { useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Plus, Check, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { backdrop } from "@/lib/api";
import { ratingStr, titleOf, yearOf } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";
import { useState } from "react";

const CinematicCard = ({ item }) => {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => inWatchlist({ media_type: "movie", id: item.id }));
  const art = backdrop(item.backdrop_path, "w780");

  const save = (event) => {
    event.stopPropagation();
    const next = toggleWatchlist({
      media_type: "movie",
      id: item.id,
      title: titleOf(item),
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
    });
    setSaved(next);
  };

  const play = (event) => {
    event.stopPropagation();
    navigate(`/watch/movie/${item.id}`);
  };

  return (
    <article
      onClick={() => navigate(`/title/movie/${item.id}`)}
      className="group relative w-[78vw] max-w-[520px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#10100f] shadow-[0_18px_50px_rgba(0,0,0,.28)] transition duration-500 hover:-translate-y-1 hover:border-[#ffd400]/30 hover:shadow-[0_24px_64px_rgba(0,0,0,.48)] sm:w-[440px] lg:w-[500px]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {art ? (
          <img src={art} alt={titleOf(item)} loading="lazy" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]" />
        ) : (
          <div className="grid h-full w-full place-items-center px-6 text-center text-lg font-semibold text-white/30">{titleOf(item)}</div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,.12)_55%,rgba(0,0,0,.94)_100%)]" />
        <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_75%_20%,rgba(255,212,0,.14),transparent_38%)]" />

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-semibold tracking-[-0.025em] text-white sm:text-xl">{titleOf(item)}</h3>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-white/52">
                {yearOf(item) && <span>{yearOf(item)}</span>}
                {Number(item.vote_average) > 0 && <span className="inline-flex items-center gap-1 text-[#ffd400]/90"><Star className="h-3 w-3 fill-current" />{ratingStr(item.vote_average)}</span>}
                <span className="rounded border border-white/14 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-white/52">Movie</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <button onClick={play} className="grid h-10 w-10 place-items-center rounded-full bg-[#ffd400] text-black shadow-lg transition hover:scale-105" aria-label="Play"><Play className="ml-0.5 h-4 w-4 fill-current" /></button>
              <button onClick={save} className="grid h-10 w-10 place-items-center rounded-full border border-white/18 bg-black/50 text-white backdrop-blur-md transition hover:border-[#ffd400]/45 hover:text-[#ffd400]" aria-label={saved ? "Remove from My List" : "Add to My List"}>{saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export const CinematicRow = ({ title, subtitle, items = [], reverse = false, testId }) => {
  const ref = useRef(null);
  if (!items.length) return null;

  const scroll = (direction) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(520, el.clientWidth * 0.78), behavior: "smooth" });
  };

  const displayItems = reverse ? [...items].reverse() : items;

  return (
    <section className="group/cinematic py-7 md:py-9" data-testid={testId}>
      <div className={`mb-4 flex items-end justify-between gap-4 px-5 md:px-8 ${reverse ? "md:flex-row-reverse md:text-right" : ""}`}>
        <div>
          <div className={`mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/62 ${reverse ? "md:justify-end" : ""}`}>
            <span className="h-px w-5 bg-[#ffd400]/55" /> Curated cinema
          </div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-white md:text-[24px]">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-5 text-white/34">{subtitle}</p>}
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          <button onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/48 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]" aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/48 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]" aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div
        ref={ref}
        className={`scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:gap-5 ${reverse ? "flex-row-reverse pl-5 md:pl-8" : "pr-5 md:pr-8"}`}
        style={reverse ? { paddingRight: "max(1.25rem, calc((100vw - 1500px) / 2 + 2rem))" } : { paddingLeft: "max(1.25rem, calc((100vw - 1500px) / 2 + 2rem))" }}
      >
        {displayItems.slice(0, 12).map((item) => <CinematicCard key={item.id} item={item} />)}
      </div>
    </section>
  );
};
