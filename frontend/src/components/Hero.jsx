import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Info, Play, Plus, Star } from "lucide-react";
import { backdrop, getTitleImages, img } from "@/lib/api";
import { mediaTypeOf, ratingStr, titleOf, yearOf } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";

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
    const timer = window.setInterval(() => setIdx((v) => (v + 1) % featured.length), 9000);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  useEffect(() => {
    if (item) setSaved(inWatchlist({ media_type: mt, id: item.id }));
  }, [item, mt]);

  if (!item) return <section className="h-[62vh] min-h-[500px] bg-[#0b0b0b]" />;

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
    <section data-testid="hero-banner" className="relative h-[76vh] min-h-[570px] max-h-[880px] overflow-hidden">
      {featured.map((feature, index) => (
        <div key={feature.id} className="absolute inset-0 transition-opacity duration-1000 ease-out" style={{ opacity: index === idx ? 1 : 0 }}>
          <img src={backdrop(feature.backdrop_path, "original")} alt={titleOf(feature)} className="h-full w-full object-cover object-center" />
        </div>
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,6,.97)_0%,rgba(7,7,6,.78)_30%,rgba(7,7,6,.22)_65%,rgba(7,7,6,.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#070706_0%,rgba(7,7,6,.78)_10%,rgba(7,7,6,.06)_44%,rgba(7,7,6,.16)_100%)]" />

      <div className="relative mx-auto flex h-full max-w-[1500px] items-end px-5 pb-20 pt-28 md:px-8 md:pb-24">
        <div key={item.id} className="max-w-[720px] syn-fade-up">
          <div className="flex min-h-[92px] items-end md:min-h-[126px]">
            {heroLogo ? (
              <img
                src={img(heroLogo.file_path, "w500")}
                alt={titleOf(item)}
                className="max-h-[118px] w-auto max-w-[78vw] object-contain object-left drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)] md:max-h-[150px] md:max-w-[520px]"
                loading="eager"
                decoding="async"
              />
            ) : logoFetched ? (
              <h1 className="text-balance text-[45px] font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl md:text-[74px]">{titleOf(item)}</h1>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
            {Number(item.vote_average) > 0 && <span className="inline-flex items-center gap-1.5 font-medium text-[#ffd400]"><Star className="h-3.5 w-3.5 fill-current" />{ratingStr(item.vote_average)}</span>}
            {yearOf(item) && <span>{yearOf(item)}</span>}
            <span className="rounded-md border border-[#ffd400]/20 bg-[#ffd400]/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffd400]/75">{mt === "tv" ? "Series" : "Movie"}</span>
          </div>

          {item.overview && <p className="mt-5 max-w-[620px] line-clamp-3 text-[14px] leading-6 text-white/56 md:text-[15px] md:leading-7">{item.overview}</p>}

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button data-testid="hero-play-button" onClick={() => navigate(`/watch/${mt}/${item.id}${mt === "tv" ? "?season=1&episode=1" : ""}`)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ffd400] px-5 text-sm font-semibold text-black transition hover:bg-[#ffe04a] active:scale-[.98]">
              <Play className="h-4 w-4 fill-current" /> Play
            </button>
            <button data-testid="hero-info-button" onClick={() => navigate(`/title/${mt}/${item.id}`)} className="inline-flex h-11 items-center gap-2 rounded-full border border-[#ffd400]/18 bg-black/28 px-5 text-sm font-medium text-white/82 backdrop-blur-md transition hover:border-[#ffd400]/38 hover:bg-[#ffd400]/10 hover:text-[#ffd400]">
              <Info className="h-4 w-4" /> Details
            </button>
            <button data-testid="hero-watchlist-button" onClick={save} className="grid h-11 w-11 place-items-center rounded-full border border-[#ffd400]/18 bg-black/28 text-white/78 backdrop-blur-md transition hover:border-[#ffd400]/38 hover:bg-[#ffd400]/10 hover:text-[#ffd400]" aria-label={saved ? "Remove from My List" : "Add to My List"}>
              {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {featured.length > 1 && (
            <div className="mt-9 flex items-center gap-2">
              {featured.map((feature, index) => <button key={feature.id} onClick={() => setIdx(index)} className={`h-[3px] rounded-full transition-all ${index === idx ? "w-8 bg-[#ffd400]" : "w-4 bg-white/22 hover:bg-[#ffd400]/45"}`} aria-label={`Show ${titleOf(feature)}`} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
