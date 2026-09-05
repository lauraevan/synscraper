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

const embedUrl = (video, { background = false } = {}) => {
  if (!video?.key) return "";
  if (video.site === "YouTube") {
    const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}`;
    if (background) {
      return `${base}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(video.key)}&playsinline=1&rel=0&modestbranding=1`;
    }
    return `${base}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  }
  if (video.site === "Vimeo") {
    const base = `https://player.vimeo.com/video/${encodeURIComponent(video.key)}`;
    return background
      ? `${base}?autoplay=1&muted=1&background=1&loop=1&title=0&byline=0&portrait=0`
      : `${base}?autoplay=1&title=0&byline=0&portrait=0`;
  }
  return "";
};

const thumbnailUrl = (video) => video?.site === "YouTube" && video?.key
  ? `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/hqdefault.jpg`
  : null;

export const TrailerPreview = ({ videos = [], title = "" }) => {
  const ranked = useMemo(() => [...videos]
    .filter((video) => video?.key && supportedSite(video.site))
    .sort((a, b) => videoScore(b) - videoScore(a)), [videos]);
  const [selected, setSelected] = useState(null);

  if (!ranked.length) return null;

  const primary = ranked[0];
  const extras = ranked.slice(0, 6);

  return (
    <section id="synflix-preview" className="mx-auto max-w-[1500px] scroll-mt-24 px-5 py-8 md:px-8 md:py-10" data-testid="title-preview">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]">
            <span className="h-px w-6 bg-[#ffd400]" /> SynFlix preview
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Preview</h2>
          <p className="mt-1 text-xs text-white/34">Trailer, teaser, or clip supplied with this title.</p>
        </div>
      </div>

      <div className="synflix-preview-frame relative aspect-video overflow-hidden rounded-[22px] border border-white/[0.08] bg-black">
        <iframe
          src={embedUrl(primary, { background: true })}
          title={`${title || "Title"} preview`}
          className="absolute inset-0 h-full w-full scale-[1.02] pointer-events-none"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.78)_0%,rgba(0,0,0,.34)_42%,rgba(0,0,0,.12)_72%,rgba(0,0,0,.24)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.78)_0%,transparent_52%,rgba(0,0,0,.12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 md:p-7">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/25 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffd400] backdrop-blur-md">
              <Clapperboard className="h-3 w-3" /> {primary.type || "Preview"}
            </div>
            <h3 className="truncate text-lg font-semibold tracking-[-0.02em] text-white md:text-2xl">{primary.name || `${title} trailer`}</h3>
          </div>
          <button onClick={() => setSelected(primary)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#ffd400] px-5 text-sm font-semibold text-black transition hover:bg-[#ffe04a] active:scale-[.98]">
            <Play className="h-4 w-4 fill-current" /> Watch
          </button>
        </div>
      </div>

      {extras.length > 1 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-white">Trailers & more</h3>
            <span className="text-[11px] text-white/28">Powered by TMDB video metadata</span>
          </div>
          <div className="synflix-yellow-scroll grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((video) => {
              const thumb = thumbnailUrl(video);
              return (
                <button key={`${video.site}-${video.key}`} onClick={() => setSelected(video)} className="synflix-preview-card group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] text-left transition duration-200">
                  <div className="relative aspect-video overflow-hidden bg-[#111]">
                    {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" /> : <div className="grid h-full w-full place-items-center"><Clapperboard className="h-8 w-8 text-white/18" /></div>}
                    <div className="absolute inset-0 grid place-items-center bg-black/22 transition group-hover:bg-black/10">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ffd400] text-black shadow-lg"><Play className="h-4 w-4 fill-current" /></span>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <p className="truncate text-sm font-medium text-white/84">{video.name || video.type || "Preview"}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffd400]/72">{video.type || "Video"}{video.official ? " · Official" : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
