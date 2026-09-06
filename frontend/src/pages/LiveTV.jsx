import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  AlertCircle,
  Globe2,
  Radio,
  RefreshCw,
  Search,
  Tv2,
  Users,
  Wifi,
  X,
} from "lucide-react";

const CDN_CHANNELS_API = "https://api.cdnlivetv.is/api/v1/channels/?user=cdnlivetv&plan=free";
const IPTV_CHANNELS_API = "https://iptv-org.github.io/api/channels.json";
const IPTV_STREAMS_API = "https://iptv-org.github.io/api/streams.json";

const SOURCE_META = {
  cdn: { label: "CDN Live TV", short: "CDN", description: "CDN Live TV API" },
  iptv: { label: "IPTV", short: "IPTV", description: "IPTV-org API" },
};

const ChannelMark = ({ channel, large = false }) => {
  const [broken, setBroken] = useState(false);
  const size = large ? "h-12 w-12 rounded-[10px] text-sm" : "h-10 w-10 rounded-[8px] text-xs";

  useEffect(() => setBroken(false), [channel?.id, channel?.image]);

  if (channel?.image && !broken) {
    return (
      <span className={`${size} grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-[#111]`}>
        <img
          src={channel.image}
          alt=""
          className="h-full w-full object-contain p-1.5"
          onError={() => setBroken(true)}
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span className={`${size} grid shrink-0 place-items-center border border-white/[0.08] bg-[#111] font-semibold text-white/[0.62]`}>
      {String(channel?.name || "TV").trim().slice(0, 2).toUpperCase()}
    </span>
  );
};

const DirectHlsPlayer = ({ channel }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState("Connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel?.url) return undefined;

    setStatus("Connecting");
    setError("");
    video.muted = true;

    const onReady = () => {
      setStatus("Live");
      video.play().catch(() => setStatus("Ready"));
    };

    if (Hls.isSupported() && /\.m3u8(?:$|\?)/i.test(channel.url)) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
      });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus("Reconnecting");
          window.setTimeout(() => hls.startLoad(), 900);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus("Recovering");
          hls.recoverMediaError();
        } else {
          setStatus("Offline");
          setError("This stream cannot be played in the browser right now.");
        }
      });
    } else {
      const onError = () => {
        setStatus("Offline");
        setError("This stream cannot be played in the browser right now.");
      };
      video.src = channel.url;
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[14px] border border-white/[0.09] bg-black" data-testid="live-tv-player">
      <video ref={videoRef} controls playsInline autoPlay muted className="h-full w-full bg-black object-contain" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> LIVE
        </span>
        <span className="rounded-md bg-black/70 px-2 py-1 text-[10px] text-white/55 backdrop-blur-sm">{status}</span>
      </div>
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/90 p-8 text-center">
          <div className="max-w-sm">
            <AlertCircle className="mx-auto h-7 w-7 text-red-400" />
            <p className="mt-3 text-sm font-semibold text-white">Stream unavailable</p>
            <p className="mt-1.5 text-xs leading-5 text-white/40">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const LiveViewport = ({ channel }) => {
  if (!channel) {
    return (
      <div className="grid aspect-video place-items-center rounded-[14px] border border-white/[0.08] bg-black text-center">
        <div>
          <RefreshCw className="mx-auto h-5 w-5 animate-spin text-white/45" />
          <p className="mt-3 text-xs font-medium text-white/45">Loading channels</p>
        </div>
      </div>
    );
  }

  if (channel.source === "cdn") {
    return (
      <div className="relative aspect-video overflow-hidden rounded-[14px] border border-white/[0.09] bg-black" data-testid="live-tv-player">
        <iframe
          key={channel.id}
          src={channel.url}
          title={`${channel.name} live TV`}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
        />
        <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> LIVE
        </div>
      </div>
    );
  }

  return <DirectHlsPlayer channel={channel} />;
};

const normalizeCdnChannels = (payload) => {
  const list = Array.isArray(payload?.channels) ? payload.channels : [];
  return list
    .filter((channel) => channel?.name && channel?.url)
    .map((channel, index) => ({
      id: `cdn-${channel.code || "xx"}-${channel.name}-${index}`,
      source: "cdn",
      name: channel.name,
      code: String(channel.code || "--").toUpperCase(),
      url: channel.url,
      image: channel.image || "",
      status: channel.status || "online",
      viewers: Number(channel.viewers || 0),
      group: "CDN Live TV",
    }))
    .sort((a, b) => {
      if (a.status === "online" && b.status !== "online") return -1;
      if (b.status === "online" && a.status !== "online") return 1;
      return b.viewers - a.viewers || a.name.localeCompare(b.name);
    });
};

const normalizeIptvChannels = (channelPayload, streamPayload) => {
  const meta = new Map((Array.isArray(channelPayload) ? channelPayload : []).map((channel) => [channel.id, channel]));
  const seen = new Set();
  const output = [];

  for (const stream of Array.isArray(streamPayload) ? streamPayload : []) {
    if (output.length >= 1400) break;
    const channelId = stream?.channel;
    const url = String(stream?.url || "");
    if (!channelId || seen.has(channelId) || !url.startsWith("https://")) continue;
    if (stream.http_referrer || stream.referrer || stream.user_agent) continue;

    const info = meta.get(channelId);
    if (!info?.name || info.is_nsfw) continue;

    seen.add(channelId);
    output.push({
      id: `iptv-${channelId}`,
      source: "iptv",
      name: info.name,
      code: String(info.country || "--").toUpperCase(),
      url,
      image: info.logo || "",
      status: "online",
      viewers: 0,
      quality: stream.quality || "",
      group: Array.isArray(info.categories) && info.categories.length ? String(info.categories[0]) : "IPTV",
    });
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

export default function LiveTV() {
  const [source, setSource] = useState("cdn");
  const [cdnChannels, setCdnChannels] = useState([]);
  const [iptvChannels, setIptvChannels] = useState([]);
  const [selectedBySource, setSelectedBySource] = useState({ cdn: "", iptv: "" });
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [loading, setLoading] = useState({ cdn: true, iptv: true });
  const [errors, setErrors] = useState({ cdn: "", iptv: "" });
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadCdn = useCallback(async () => {
    setLoading((value) => ({ ...value, cdn: true }));
    setErrors((value) => ({ ...value, cdn: "" }));
    try {
      const response = await fetch(CDN_CHANNELS_API, { cache: "no-store" });
      if (!response.ok) throw new Error(`CDN API returned ${response.status}`);
      const data = await response.json();
      const channels = normalizeCdnChannels(data);
      if (!channels.length) throw new Error("CDN Live TV returned no channels");
      setCdnChannels(channels);
      setSelectedBySource((current) => ({ ...current, cdn: current.cdn || channels[0].id }));
      setUpdatedAt(new Date());
    } catch (error) {
      setErrors((value) => ({ ...value, cdn: error?.message || "Could not load CDN Live TV" }));
    } finally {
      setLoading((value) => ({ ...value, cdn: false }));
    }
  }, []);

  const loadIptv = useCallback(async () => {
    setLoading((value) => ({ ...value, iptv: true }));
    setErrors((value) => ({ ...value, iptv: "" }));
    try {
      const [channelsResponse, streamsResponse] = await Promise.all([
        fetch(IPTV_CHANNELS_API, { cache: "no-store" }),
        fetch(IPTV_STREAMS_API, { cache: "no-store" }),
      ]);
      if (!channelsResponse.ok || !streamsResponse.ok) throw new Error("IPTV API request failed");
      const [channelData, streamData] = await Promise.all([channelsResponse.json(), streamsResponse.json()]);
      const channels = normalizeIptvChannels(channelData, streamData);
      if (!channels.length) throw new Error("IPTV API returned no browser-playable streams");
      setIptvChannels(channels);
      setSelectedBySource((current) => ({ ...current, iptv: current.iptv || channels[0].id }));
      setUpdatedAt(new Date());
    } catch (error) {
      setErrors((value) => ({ ...value, iptv: error?.message || "Could not load IPTV" }));
    } finally {
      setLoading((value) => ({ ...value, iptv: false }));
    }
  }, []);

  useEffect(() => {
    loadCdn();
    const timer = window.setTimeout(loadIptv, 500);
    return () => window.clearTimeout(timer);
  }, [loadCdn, loadIptv]);

  const activeChannels = source === "cdn" ? cdnChannels : iptvChannels;
  const selectedId = selectedBySource[source];
  const selected = activeChannels.find((channel) => channel.id === selectedId) || activeChannels[0] || null;
  const activeError = errors[source];
  const activeLoading = loading[source];

  const countries = useMemo(() => {
    const values = Array.from(new Set(activeChannels.map((channel) => channel.code).filter((code) => code && code !== "--")));
    return ["All", ...values.sort()];
  }, [activeChannels]);

  const visibleChannels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activeChannels.filter((channel) => {
      if (country !== "All" && channel.code !== country) return false;
      if (!needle) return true;
      return `${channel.name} ${channel.code} ${channel.group || ""}`.toLowerCase().includes(needle);
    });
  }, [activeChannels, country, query]);

  const changeSource = (nextSource) => {
    setSource(nextSource);
    setQuery("");
    setCountry("All");
  };

  const refresh = () => {
    if (source === "cdn") loadCdn();
    else loadIptv();
  };

  return (
    <main className="min-h-screen bg-[#080808] pb-16 pt-24 text-white md:pt-28" data-testid="live-tv-page">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Live television
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] md:text-[42px]">Live TV</h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-white/38 md:text-sm">
              Live channels from CDN Live TV and IPTV, in one clean guide.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-5" role="tablist" aria-label="Live TV source">
              {Object.entries(SOURCE_META).map(([key, meta]) => {
                const active = source === key;
                const count = key === "cdn" ? cdnChannels.length : iptvChannels.length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeSource(key)}
                    className={`relative pb-2 text-xs font-medium transition-colors ${active ? "text-white" : "text-white/38 hover:text-white/72"}`}
                    aria-pressed={active}
                  >
                    <span className="inline-flex items-center gap-2">
                      {key === "cdn" ? <Radio className="h-3.5 w-3.5" /> : <Tv2 className="h-3.5 w-3.5" />}
                      {meta.short}
                      <span className="text-[10px] text-white/25">{loading[key] ? "…" : count.toLocaleString()}</span>
                    </span>
                    <span className={`absolute inset-x-0 bottom-0 h-px bg-white transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={activeLoading}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/[0.09] text-white/48 transition hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-white disabled:opacity-30"
              aria-label="Refresh live channels"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${activeLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {activeError && !selected ? (
              <div className="grid aspect-video place-items-center rounded-[14px] border border-red-500/15 bg-black p-8 text-center">
                <div className="max-w-sm">
                  <AlertCircle className="mx-auto h-7 w-7 text-red-400" />
                  <p className="mt-3 text-sm font-semibold">Could not load {SOURCE_META[source].label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-white/38">{activeError}</p>
                  <button type="button" onClick={refresh} className="mt-4 h-9 rounded-md border border-white/12 px-3 text-xs font-medium text-white/80 hover:bg-white/[0.05]">
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <LiveViewport channel={selected} />
            )}

            <div className="flex flex-col gap-3 border-b border-white/[0.08] py-4 sm:flex-row sm:items-center">
              <ChannelMark channel={selected} large />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-white md:text-lg">{selected?.name || "Loading channel"}</h2>
                  {selected && <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-red-400">Live</span>}
                  {selected?.quality && <span className="text-[10px] text-white/36">{selected.quality}</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/30">
                  <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" /> {selected?.code || "--"}</span>
                  <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3" /> {SOURCE_META[source].description}</span>
                  {source === "cdn" && selected?.viewers > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {selected.viewers.toLocaleString()} watching</span>}
                </div>
              </div>
            </div>
          </div>

          <aside className="min-w-0 lg:border-l lg:border-white/[0.08] lg:pl-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white/90">Channels</h2>
                <p className="mt-1 text-[10px] text-white/28">
                  {activeLoading ? "Updating" : `${activeChannels.length.toLocaleString()} available`}
                  {updatedAt ? ` · ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                </p>
              </div>
              <span className="text-[10px] font-medium text-white/28">{SOURCE_META[source].short}</span>
            </div>

            <div className="mt-4 flex h-10 items-center gap-2 rounded-[9px] border border-white/[0.09] bg-[#0d0d0d] px-3 focus-within:border-white/[0.18]">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/28" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search channels"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/22"
              />
              {query && <button type="button" onClick={() => setQuery("")} className="text-white/28 hover:text-white" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">Country</span>
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-8 max-w-[180px] rounded-md border border-white/[0.08] bg-[#0d0d0d] px-2 text-[10px] text-white/60 outline-none"
              >
                {countries.map((item) => <option key={item} value={item}>{item === "All" ? "All countries" : item}</option>)}
              </select>
            </div>

            <div className="mt-2 max-h-[620px] overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,.18)_transparent] [scrollbar-width:thin]">
              {visibleChannels.length ? visibleChannels.map((channel) => {
                const active = channel.id === selected?.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedBySource((current) => ({ ...current, [source]: channel.id }))}
                    className={`relative flex w-full items-center gap-3 rounded-[9px] px-2 py-2 text-left transition-colors ${active ? "bg-white/[0.055]" : "hover:bg-white/[0.028]"}`}
                  >
                    {active && <span className="absolute bottom-2 left-0 top-2 w-px bg-white/70" />}
                    <ChannelMark channel={channel} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-xs font-medium ${active ? "text-white" : "text-white/66"}`}>{channel.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-[9px] text-white/25">
                        <span>{channel.code}</span>
                        {channel.quality && <span>{channel.quality}</span>}
                        {source === "cdn" && channel.viewers > 0 && <span>{channel.viewers.toLocaleString()} watching</span>}
                      </span>
                    </span>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${channel.status === "online" ? "bg-emerald-400/70" : "bg-white/15"}`} />
                  </button>
                );
              }) : (
                <div className="grid min-h-[240px] place-items-center p-6 text-center">
                  <div>
                    {activeLoading ? <RefreshCw className="mx-auto h-4 w-4 animate-spin text-white/35" /> : <Search className="mx-auto h-4 w-4 text-white/20" />}
                    <p className="mt-3 text-xs font-medium text-white/42">{activeLoading ? "Loading channels" : "No channels found"}</p>
                    <p className="mt-1 text-[10px] text-white/22">{activeLoading ? SOURCE_META[source].description : "Try another search or country."}</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
