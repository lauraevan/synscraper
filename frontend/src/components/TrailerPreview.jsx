import { useMemo, useState } from "react";
import { Clapperboard, Play, X } from "lucide-react";

const supportedSite = (site) => site === "YouTube" || site === "Vimeo";

const videoScore = (video) => {
  const type = String(video?.type || "").toLowerCase();
  const name = String(video?.name || "").toLowerCase();
  let score = 0;
  if (type === "trailer") score += 100;
  else if (type === "teaser") score += 80;
  else if (type === "clip") score += 60;
  else if (type === "featurette") score += 40;
  if (video?.official) score += 30;
  if (/official|trailer|teaser/.test(name)) score += 10;
  if (video?.site === "YouTube") score += 4;
  return score;
};

const embedUrl = (video) => {
  if (!video?.key) return "";
  if (video.site === "YouTube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  }
  if (video.site === "Vimeo") {
    return `https://player.vimeo.com/video/${encodeURIComponent(video.key)}?autoplay=1&title=0&byline=0&portrait=0`;
  }
  return "";
};

const thumbnailUrl = (video) => video?.site === "YouTube" && video?.key
  ? `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/hqdefault.jpg`
  : null;

export const TrailerPreview = ({ videos = [], title = "" }) => {
  const ranked = useMemo(() => [...videos]
    .filter((video) => video?.key && supportedSite(video.site))
    .sort((a, b) => videoScore(b) - videoScore(a))
    .slice(0, 6), [videos]);
  const [selected, setSelected] = useState(null);

  if (!ranked.length) return null;

  return (
    <section id="synflix-preview" className="mx-auto max-w-[1500px] px-5 py-9 md:px-8 md:py-12" data-testid="title-preview">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Trailers & more</h2>
      </div>

      <div className="scrollbar-none flex snap-x gap-3.5 overflow-x-auto pb-2">
        {ranked.map((video) => {
          const thumb = thumbnailUrl(video);
          return (
            <button
              key={`${video.site}-${video.key}`}
              type="button"
              onClick={() => setSelected(video)}
              className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.025] text-left transition hover:border-[#ffd400]/22 sm:w-[330px]"
            >
              <div className="relative aspect-video overflow-hidden bg-[#111]">
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                ) : (
                  <div className="grid h-full w-full place-items-center"><Clapperboard className="h-8 w-8 text-white/18" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                <span className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
              </div>
              <div className="p-3.5">
                <p className="truncate text-sm font-medium text-white/88">{video.name || video.type || "Preview"}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">{video.type || "Video"}{video.official ? " · Official" : ""}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/88 p-4 backdrop-blur-md" onClick={() => setSelected(null)} role="presentation">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-2xl" onClick={(e) => e.stopPropagation()} role="presentation">
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/70 text-white backdrop-blur-md transition hover:border-[#ffd400]/40 hover:text-[#ffd400]" aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video bg-black">
              <iframe
                src={embedUrl(selected)}
                title={selected.name || `${title} preview`}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
