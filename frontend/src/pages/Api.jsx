import { useMemo, useState } from "react";
import { Check, Clipboard, Code2, ExternalLink, Play, Zap } from "lucide-react";

const cleanId = (value) => String(value || "").replace(/[^0-9]/g, "");

export default function Api() {
  const [mediaType, setMediaType] = useState("movie");
  const [id, setId] = useState("");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [copied, setCopied] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hasId = Boolean(cleanId(id));
  const embedUrl = useMemo(() => {
    const tmdbId = cleanId(id) || "{TMDB_ID}";
    const base = `${origin}/embed/${mediaType}/${tmdbId}`;
    if (mediaType === "tv") {
      return `${base}?season=${Math.max(1, Number(season) || 1)}&episode=${Math.max(1, Number(episode) || 1)}`;
    }
    return base;
  }, [origin, mediaType, id, season, episode]);

  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="100%"\n  allow="autoplay; fullscreen; picture-in-picture"\n  allowfullscreen\n  style="border:0; aspect-ratio:16/9; background:#000;"\n></iframe>`;

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1400);
    } catch (_) {
      setCopied("");
    }
  };

  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-24 pt-28 text-white md:px-8 md:pt-32" data-testid="api-page">
      <div className="mx-auto max-w-[1180px]">
        <section className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/20 bg-[#ffd400]/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd400]">
            <Zap className="h-3.5 w-3.5 fill-current" /> SynPlayer API
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">Put SynPlayer in anything.</h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/48 md:text-base">No API key, no signup, and no fees. Give SynPlayer a TMDB ID and embed the player directly into Synapse or any site that supports iframes.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-white/58">
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">No API key</span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">$0</span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">Movies + TV</span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">Responsive iframe</span>
          </div>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-white/[0.08] bg-[#0d0e11] p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#ffd400]" />
              <h2 className="text-base font-semibold">Build your embed</h2>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/34">Type</label>
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 p-1">
                  {[
                    ["movie", "Movie"],
                    ["tv", "TV"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setMediaType(value)} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mediaType === value ? "bg-[#ffd400] text-black" : "text-white/46 hover:text-white"}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="synplayer-tmdb-id" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/34">TMDB ID</label>
                <input id="synplayer-tmdb-id" value={id} onChange={(event) => setId(cleanId(event.target.value))} inputMode="numeric" placeholder="Enter a TMDB ID" className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-white/18 focus:border-[#ffd400]/45" />
              </div>

              {mediaType === "tv" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="synplayer-season" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/34">Season</label>
                    <input id="synplayer-season" value={season} onChange={(event) => setSeason(cleanId(event.target.value))} inputMode="numeric" className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/35 px-4 text-sm text-white outline-none transition focus:border-[#ffd400]/45" />
                  </div>
                  <div>
                    <label htmlFor="synplayer-episode" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/34">Episode</label>
                    <input id="synplayer-episode" value={episode} onChange={(event) => setEpisode(cleanId(event.target.value))} inputMode="numeric" className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/35 px-4 text-sm text-white outline-none transition focus:border-[#ffd400]/45" />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-white/[0.07] bg-black/40 p-3.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/26">Player URL</p>
              <code className="block break-all text-[12px] leading-5 text-[#ffd400]/85">{embedUrl}</code>
              <button type="button" onClick={() => copy("url", embedUrl)} className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 text-[11px] font-semibold text-white/58 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]">
                {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />} {copied === "url" ? "Copied" : "Copy URL"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0c0f]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white/90">Live preview</p>
                <p className="mt-0.5 text-[11px] text-white/28">Enter an ID and SynPlayer loads here.</p>
              </div>
              {hasId && <a href={embedUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] text-white/40 transition hover:border-[#ffd400]/30 hover:text-[#ffd400]" aria-label="Open player"><ExternalLink className="h-4 w-4" /></a>}
            </div>
            <div className="aspect-video bg-black">
              {hasId ? (
                <iframe key={embedUrl} src={embedUrl} title="SynPlayer preview" className="h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#ffd400]/18 bg-[#ffd400]/[0.06] text-[#ffd400]"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
                    <p className="mt-4 text-sm font-semibold text-white/65">Your player preview will appear here</p>
                    <p className="mt-1 text-xs text-white/26">Use any TMDB movie or TV ID.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-white/[0.08] bg-[#0d0e11] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Drop this into Synapse</h2>
              <p className="mt-1 text-xs text-white/30">The embed always loads the current SynPlayer from this deployment.</p>
            </div>
            <button type="button" onClick={() => copy("iframe", iframeCode)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#ffd400] px-4 text-xs font-bold text-black transition hover:bg-[#ffe04a]">
              {copied === "iframe" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />} {copied === "iframe" ? "Copied" : "Copy embed"}
            </button>
          </div>
          <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/50 p-4 text-[12px] leading-6 text-white/62"><code>{iframeCode}</code></pre>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd400]/65">Movie endpoint</p>
            <code className="mt-3 block break-all text-sm text-white/72">/embed/movie/:tmdbId</code>
          </div>
          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd400]/65">TV endpoint</p>
            <code className="mt-3 block break-all text-sm text-white/72">/embed/tv/:tmdbId?season=1&amp;episode=1</code>
          </div>
        </section>
      </div>
    </main>
  );
}
