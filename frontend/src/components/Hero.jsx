import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Info, Play, Plus, Star } from "lucide-react";
import { backdrop, getTitleImages, img } from "@/lib/api";
import { mediaTypeOf, ratingStr, titleOf, yearOf } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";
import { requestWebPlayback } from "@/lib/webPlayer";

const pickLogo = (logos = []) => {
  const rank = (list) => [...list].sort((a, b) => {
    const votes = Number(b?.vote_average || 0) - Number(a?.vote_average || 0);
    if (votes) return votes;
    return Number(b?.width || 0) - Number(a?.width || 0);
  });
  const english = rank(logos.filter((logo) => logo?.iso_639_1 === "en"));
  if (english.length) return english[0];
  const neutral = rank(logos.filter((logo) => !logo?.iso_639_1));
  if (neutral.length) return neutral[0];
  return rank(logos)[0] || null;
};

export const Hero = ({ items = [] }) => {
  const navigate = useNavigate();
  const featured = useMemo(() => items.filter((item) => item?.backdrop_path).slice(0, 5), [items]);
  const [idx, setIdx] = useState(0);
  const item = featured[idx];
  const mt = item ? mediaTypeOf(item) : "movie";
  const [saved, setSaved] = useState(false);

  const { data: titleImages, isFetched: logoFetched } = useQuery({
    queryKey: ["hero-logo", mt, item?.id],
    queryFn: () => getTitleImages(mt, item.id),
    enabled: !!item?.id,
    staleTime: 3_600_000,
    retry: 1,
  });

  const heroLogo = useMemo(() => pickLogo(titleImages?.logos || []), [titleImages]);

  useEffect(() => {
    if (idx >= featured.length) setIdx(0);
  }, [featured.length, idx]);

  useEffect(() => {
    if (featured.length < 2) return undefined;
    const timer = window.setInterval(() => setIdx((value) => (value + 1) % featured.length), 10500);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  useEffect(() => {
    if (item) setSaved(inWatchlist({ media_type: mt, id: item.id }));
  }, [item, mt]);

  if (!item) return <section className="h-[72vh] min-h-[560px] bg-[#050505]" />;

  const meta = {
    title: titleOf(item),
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };

  const play = () => requestWebPlayback({ mediaType: mt, id: item.id, season: 1, episode: 1, meta }, navigate);

  const save = () => {
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
    <section data-testid="hero-banner" className="relative overflow-hidden bg-[#050505]">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={`hero-art-${item.id}`}
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={backdrop(item.backdrop_path, "original")}
            alt={titleOf(item)}
            className="synflix-hero-image h-full w-full object-cover object-center"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,.98)_0%,rgba(5,5,5,.82)_27%,rgba(5,5,5,.28)_58%,rgba(5,5,5,.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,.72)_11%,rgba(5,5,5,.03)_46%,rgba(5,5,5,.22)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_35%,transparent_0%,rgba(5,5,5,.08)_34%,rgba(5,5,5,.52)_100%)]" />

      <div className="relative z-[4] mx-auto flex h-full max-w-[1540px] items-end px-5 pb-20 pt-28 md:px-10 md:pb-24 xl:px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`hero-copy-${item.id}`}
            className="synflix-hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/48">
              <span className="h-[2px] w-5 rounded-full bg-[var(--site-accent,#ffd400)]" />
              Featured on SynFlix
            </div>

            <div className="flex min-h-[92px] items-end md:min-h-[126px]">
              {heroLogo ? (
                <img
                  src={img(heroLogo.file_path, "w500")}
                  alt={titleOf(item)}
                  className="max-h-[118px] w-auto max-w-[78vw] object-contain object-left drop-shadow-[0_10px_26px_rgba(0,0,0,.44)] md:max-h-[150px] md:max-w-[540px]"
                  loading="eager"
                  decoding="async"
                />
              ) : logoFetched ? (
                <h1 className="text-balance text-[46px] font-semibold leading-[0.94] tracking-[-0.06em] text-white sm:text-6xl md:text-[78px]">{titleOf(item)}</h1>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium text-white/58">
              {Number(item.vote_average) > 0 && <span className="inline-flex items-center gap-1.5 text-[var(--site-accent,#ffd400)]"><Star className="h-3.5 w-3.5 fill-current" />{ratingStr(item.vote_average)}</span>}
              {yearOf(item) && <span>{yearOf(item)}</span>}
              <span>{mt === "tv" ? "Series" : "Movie"}</span>
              <span className="rounded-[4px] border border-white/18 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-white/48">HD</span>
            </div>

            {item.overview && <p className="mt-4 max-w-[610px] line-clamp-3 text-[14px] leading-6 text-white/58 md:text-[15px] md:leading-7">{item.overview}</p>}

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button data-testid="hero-play-button" onClick={play} className="inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-bold">
                <Play className="h-4 w-4 fill-current" /> Play
              </button>
              <button data-testid="hero-info-button" onClick={() => navigate(`/title/${mt}/${item.id}`)} className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold">
                <Info className="h-4 w-4" /> More Info
              </button>
              <button data-testid="hero-watchlist-button" onClick={save} className="grid h-11 w-11 place-items-center" aria-label={saved ? "Remove from My List" : "Add to My List"}>
                {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {featured.length > 1 && (
              <div className="mt-9 flex items-center gap-2" role="tablist" aria-label="Featured titles">
                {featured.map((feature, index) => (
                  <button
                    key={feature.id}
                    onClick={() => setIdx(index)}
                    className="group relative h-5 w-9"
                    aria-label={`Show ${titleOf(feature)}`}
                    aria-selected={index === idx}
                    role="tab"
                  >
                    <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/18">
                      <span className={`block h-full origin-left bg-[var(--site-accent,#ffd400)] transition-transform duration-300 ${index === idx ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"}`} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
