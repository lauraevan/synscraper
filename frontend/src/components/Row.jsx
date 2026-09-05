import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";

export const Row = ({ title, subtitle, items = [], fallbackType, testId }) => {
  const ref = useRef(null);
  if (!items.length) return null;

  const scroll = (direction) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * Math.max(480, el.clientWidth * 0.82), behavior: "smooth" });
  };

  return (
    <section className="group/row py-5" data-testid={testId}>
      <div className="mb-4 flex items-end justify-between gap-4 px-5 md:px-8">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-white md:text-[22px]">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-white/34">{subtitle}</p>}
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          <button onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/48 transition hover:bg-white/[0.08] hover:text-white" aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/48 transition hover:bg-white/[0.08] hover:text-white" aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="scrollbar-none flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-3 md:gap-4 md:px-8">
        {items.map((item) => <MovieCard key={`${item.id}-${item.media_type || fallbackType || ""}`} item={item} fallbackType={fallbackType} />)}
      </div>
    </section>
  );
};
