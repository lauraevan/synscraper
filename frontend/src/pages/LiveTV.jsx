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
  cdn: {
    label: "CDN Live TV",
    short: "CDN",
    description: "CDN Live TV API",
  },
  iptv: {
    label: "IPTV",
    short: "IPTV",
    description: "IPTV-org API",
  },
};

const ChannelMark = ({ channel, large = false }) => {
  const [broken, setBroken] = useState(false);
  const size = large ? "h-14 w-14 rounded-2xl text-lg" : "h-11 w-11 rounded-xl text-sm";

  useEffect(() => setBroken(false), [channel?.id, channel?.image]);

  if (channel?.image && !broken) {
    return (
      <span className={`${size} grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-white/[0.04]`}>
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
    <span className={`${size} grid shrink-0 place-items-center border border-[#ffd400]/20 bg-[#ffd400]/[0.08] font-black text-[#ffd400]`}>
      {String(channel?.name || "TV").trim().slice(0, 2).toUpperCase()}
    </span>
  );
};

const DirectHlsPlayer = ({ channel }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel?.url) return undefined;

    setStatus("Connecting…");
    setError("");
    video.muted = true;

    const onReady = () => {
      setStatus("LIVE");
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
          setStatus("Reconnecting…");
          window.setTimeout(() => hls.startLoad(), 900);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus("Recovering…");
          hls.recoverMediaError();
        } else {
          setStatus("Offline");
          setError("This IPTV stream is not playable from the browser right now.");
        }
      });
    } else {
      video.src = channel.url;
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("error", () => {
        setStatus("Offline");
        setError("This IPTV stream is not playable from the browser right now.");
      }, { once: true });
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
    <div className="relative aspect-video overflow-hidden rounded-[26px] border border-white/[0.09] bg-black shadow-[0_28px_90px_rgba(0,0,0,.55)]" data-testid="live-tv-player">
      <video ref={videoRef} controls playsInline autoPlay muted className="h-full w-full bg-black object-contain" />
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 md:left-5 md:top-5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.12] px-2.5 text-[10px] font-black tracking-[0.12em] text-red-400 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
        </span>
        <span className="rounded-full border border-white/[0.10] bg-black/[0.56] px-2.5 py-1.5 text-[10px] font-semibold text-white/[0.68] backdrop-blur-md">{status}</span>
      </div>
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/[0.82] p-8 text-center backdrop-blur-sm">
          <div className="max-w-sm">
            <AlertCircle className="mx-auto h-8 w-8 text-[#ffd400]" />
            <p className="mt-4 text-sm font-semibold text-white/[0.9]">Stream unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/[0.4]">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const LiveViewport = ({ channel }) => {
  if (!channel) {
    return (
      <div className="grid aspect-video place-items-center rounded-[26px] border border-white/[0.08] bg-black text-center">
        <div>
          <Radio className="mx-auto h-8 w-8 animate-pulse text-[#ffd400]" />
          <p className="mt-3 text-sm font-semibold text-white/[0.72]">Loading live channels…</p>
        </div>
      </div>
    );
  }

  if (channel.source === "cdn") {
    return (
      <div className="relative aspect-video overflow-hidden rounded-[26px] border border-white/[0.09] bg-black shadow-[0_28px_90px_rgba(0,0,0,.55)]" data-testid="live-tv-player">
        <iframe
          key={channel.id}
          src={channel.url}
          title={`${channel.name} live TV`}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
        />
        <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex h-7 items-center gap-1.5 rounded-full border border-red-500/20 bg-black/[0.62] px-2.5 text-[10px] font-black tracking-[0.12em] text-red-400 backdrop-blur-md md:left-5 md:top-5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
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
    <main className="min-h-screen overflow-hidden bg-[#070707] pb-20 pt-24 text-white md:pt-28" data-testid="live-tv-page">
      <section className="synflix-live-slide-left mx-auto max-w-[1500px] px-4 md:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_18%_0%,rgba(255,212,0,.09),transparent_34%),linear-gradient(135deg,#111318,#090a0d_60%,#070707)] px-5 py-6 shadow-[0_28px_90px_rgba(0,0,0,.34)] md:px-8 md:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/20 bg-[#ffd400]/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd400]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffd400]" /> API powered
              </div>
              <h1 className="text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">Live TV</h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/[0.38] md:text-sm">
                Real channel data from CDN Live TV with IPTV as a second source. Search by channel or country and switch providers instantly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-white/[0.09] bg-black/[0.28] p-1">
                {Object.entries(SOURCE_META).map(([key, meta]) => {
                  const active = source === key;
                  const count = key === "cdn" ? cdnChannels.length : iptvChannels.length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => changeSource(key)}
                      className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[11px] font-bold transition ${active ? "bg-[#ffd400] text-black" : "text-white/[0.52] hover:bg-white/[0.05] hover:text-white"}`}
                    >
                      {key === "cdn" ? <Radio className="h-3.5 w-3.5" /> : <Tv2 className="h-3.5 w-3.5" />}
                      {meta.short}
                      <span className={`text-[9px] ${active ? "text-black/[0.55]" : "text-white/[0.28]"}`}>{loading[key] ? "…" : count}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={refresh}
                disabled={activeLoading}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.09] bg-white/[0.035] text-white/[0.64] transition hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                aria-label="Refresh live channels"
              >
                <RefreshCw className={`h-4 w-4 ${activeLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 grid max-w-[1500px] gap-5 px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
        <div className="synflix-live-slide-left min-w-0">
          {activeError && !selected ? (
            <div className="grid aspect-video place-items-center rounded-[26px] border border-red-500/[0.12] bg-[#0b0d10] p-8 text-center">
              <div className="max-w-sm">
                <AlertCircle className="mx-auto h-8 w-8 text-[#ffd400]" />
                <p className="mt-4 text-sm font-semibold text-white/[0.88]">Could not load {SOURCE_META[source].label}</p>
                <p className="mt-2 text-xs leading-5 text-white/[0.38]">{activeError}</p>
                <button type="button" onClick={refresh} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#ffd400] px-4 text-xs font-bold text-black">
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
              </div>
            </div>
          ) : (
            <LiveViewport channel={selected} />
          )}

          <div className="mt-4 grid gap-3 rounded-[22px] border border-white/[0.07] bg-[#0b0d10] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center md:p-5">
            <ChannelMark channel={selected} large />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-white md:text-lg">{selected?.name || "Loading channel…"}</h2>
                {selected && <span className="rounded-full border border-red-500/15 bg-red-500/[0.08] px-2 py-1 text-[9px] font-black tracking-[0.12em] text-red-400">LIVE</span>}
                {selected?.quality && <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[9px] font-bold text-white/[0.52]">{selected.quality}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/[0.32]">
                <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" /> {selected?.code || "--"}</span>
                <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3" /> {SOURCE_META[source].description}</span>
                {source === "cdn" && selected?.viewers > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {selected.viewers.toLocaleString()} viewers</span>}
              </div>
            </div>
            <div className="justify-self-start sm:justify-self-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd400]/15 bg-[#ffd400]/[0.06] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#ffd400]/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffd400]" /> {SOURCE_META[source].short}
              </span>
            </div>
          </div>
        </div>

        <aside className="synflix-live-slide-right overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0d10] shadow-[0_24px_70px_rgba(0,0,0,.30)]">
          <div className="border-b border-white/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white/[0.9]">Channels</p>
                <p className="mt-0.5 text-[10px] text-white/[0.28]">
                  {activeLoading ? "Updating…" : `${activeChannels.length.toLocaleString()} from ${SOURCE_META[source].short}`}
                  {updatedAt ? ` · ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd400]/15 bg-[#ffd400]/[0.05] px-2.5 py-1.5 text-[9px] font-bold text-[#ffd400]/80"><Radio className="h-3 w-3" /> LIVE</span>
            </div>

            <div className="mt-3 flex h-10 items-center gap-2 rounded-[13px] border border-white/[0.08] bg-black/[0.26] px-3 focus-within:border-[#ffd400]/30">
              <Search className="h-4 w-4 shrink-0 text-white/[0.28]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/[0.22]" />
              {query && <button type="button" onClick={() => setQuery("")} className="text-white/[0.28] hover:text-white" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {countries.map((item) => (
                <button key={item} type="button" onClick={() => setCountry(item)} className={`h-8 shrink-0 rounded-full border px-3 text-[10px] font-semibold transition ${country === item ? "border-[#ffd400]/25 bg-[#ffd400]/[0.09] text-[#ffd400]" : "border-white/[0.07] bg-white/[0.025] text-white/[0.42] hover:text-white/[0.75]"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto p-2 [scrollbar-color:rgba(255,212,0,.28)_transparent] [scrollbar-width:thin]">
            {visibleChannels.length ? visibleChannels.map((channel) => {
              const active = channel.id === selected?.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedBySource((current) => ({ ...current, [source]: channel.id }))}
                  className={`group/channel flex w-full items-center gap-3 rounded-[16px] border px-2.5 py-2.5 text-left transition ${active ? "border-[#ffd400]/20 bg-[#ffd400]/[0.07]" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.035]"}`}
                >
                  <ChannelMark channel={channel} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-semibold ${active ? "text-white" : "text-white/[0.72] group-hover/channel:text-white"}`}>{channel.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-[9px] text-white/[0.28]">
                      <span>{channel.code}</span>
                      {channel.quality && <span>{channel.quality}</span>}
                      {source === "cdn" && channel.viewers > 0 && <span>{channel.viewers.toLocaleString()} watching</span>}
                    </span>
                  </span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${channel.status === "online" ? "bg-emerald-400/80" : "bg-white/[0.16]"}`} />
                </button>
              );
            }) : (
              <div className="grid min-h-[260px] place-items-center p-6 text-center">
                <div>
                  {activeLoading ? <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#ffd400]" /> : <Search className="mx-auto h-5 w-5 text-white/[0.22]" />}
                  <p className="mt-3 text-xs font-semibold text-white/[0.5]">{activeLoading ? "Loading channels…" : "No channels found"}</p>
                  <p className="mt-1 text-[10px] text-white/[0.24]">{activeLoading ? SOURCE_META[source].description : "Try another search or country."}</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
