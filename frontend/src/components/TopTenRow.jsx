import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { img } from "@/lib/api";
import { ratingStr, titleOf, yearOf } from "@/lib/format";

export const TopTenRow = ({ items = [] }) => {
  const navigate = useNavigate();
  const top = items.filter((item) => item?.id && item?.poster_path).slice(0, 10);

  if (!top.length) return null;

  return (
    <section className="mx-auto max-w-[1500px] px-5 pb-12 pt-10 md:px-8" data-testid="top-ten-row">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/60"><span className="h-px w-5 bg-[#ffd400]/55" /> Today</div>
          <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-white md:text-[22px]">Top 10 Movies</h2>
        </div>
        <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/28">10 picks</span>
      </div>

      <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-6 sm:gap-7">
        {top.map((item, index) => (
          <article
            key={`${item.id}-${index}`}
            onClick={() => navigate(`/title/movie/${item.id}`)}
            className="group relative w-[236px] shrink-0 snap-start cursor-pointer select-none sm:w-[270px]"
          >
            <div className="relative h-[330px] sm:h-[370px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-1 bottom-5 z-0 text-[178px] font-black leading-[0.72] tracking-[-0.10em] sm:text-[205px]"
                style={{ color: "#070707", WebkitTextStroke: "2px rgba(255,255,255,.72)" }}
              >
                {index + 1}
              </div>

              <div className="absolute bottom-0 right-0 z-10 aspect-[2/3] w-[164px] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#111] shadow-[0_18px_50px_rgba(0,0,0,.42)] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#ffd400]/35 sm:w-[184px]">
                <img
                  src={img(item.poster_path, "w500")}
                  alt={titleOf(item)}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            </div>

            <div className="relative z-20 ml-[70px] mt-3 min-w-0 sm:ml-[82px]">
              <h3 className="truncate text-sm font-semibold tracking-[-0.02em] text-white/90 sm:text-[15px]">{titleOf(item)}</h3>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/34">
                {Number(item.vote_average) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#ffd400]/90">
                    <Star className="h-3 w-3 fill-current" />{ratingStr(item.vote_average)}
                  </span>
                )}
                {yearOf(item) && <><span>·</span><span>{yearOf(item)}</span></>}
                <span>·</span><span>Movie</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
