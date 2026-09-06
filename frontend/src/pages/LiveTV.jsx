import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Check,
  ChevronRight,
  Maximize2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Radio,
  Search,
  Star,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const USER_CHANNELS_KEY = "synflix-live-user-channels";
const FAVORITES_KEY = "synflix-live-favorites";

const DEFAULT_CHANNELS = [
  {
    id: "synflix-live-demo",
    name: "SynFlix Live Demo",
    group: "Featured",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    description: "A public HLS demo feed for testing the SynFlix Live TV experience.",
    now: "Live demo feed",
    next: "Continuous programming",
    demo: true,
  },
];

const readJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const cleanUrl = (value) => {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
};

const parseM3U = (text) => {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = [];
  let meta = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      const name = line.includes(",") ? line.slice(line.lastIndexOf(",") + 1).trim() : "Live channel";
      const group = line.match(/group-title="([^"]*)"/i)?.[1]?.trim() || "Imported";
      const logo = line.match(/tvg-logo="([^"]*)"/i)?.[1]?.trim() || "";
      const tvgName = line.match(/tvg-name="([^"]*)"/i)?.[1]?.trim() || "";
      meta = { name: tvgName || name || "Live channel", group, logo };
      continue;
    }

    if (!line.startsWith("#")) {
      const url = cleanUrl(line);
      if (url) {
        const channelMeta = meta || { name: `Channel ${channels.length + 1}`, group: "Imported", logo: "" };
        channels.push({
          id: `import-${Date.now()}-${channels.length}-${Math.random().toString(36).slice(2, 7)}`,
          ...channelMeta,
          url,
          description: "Imported live stream",
          userAdded: true,
        });
      }
      meta = null;
    }
  }

  return channels;
};

const ChannelMark = ({ channel, large = false }) => {
  const [broken, setBroken] = useState(false);
  const size = large ? "h-14 w-14 rounded-2xl text-lg" : "h-10 w-10 rounded-xl text-sm";

  if (channel.logo && !broken) {
    return (
      <span className={`${size} grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-white/[0.04]`}>
        <img src={channel.logo} alt="" className="h-full w-full object-contain p-1.5" onError={() => setBroken(true)} loading="lazy" />
      </span>
    );
  }

  return (
    <span className={`${size} grid shrink-0 place-items-center border border-[#ffd400]/18 bg-[#ffd400]/[0.07] font-black text-[#ffd400]`}>
      {String(channel.name || "TV").trim().slice(0, 2).toUpperCase()}
    </span>
  );
};

const LivePlayer = ({ channel }) => {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hlsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.82);
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel?.url) return undefined;

    setError("");
    setStatus("Connecting…");
    setPlaying(false);
    video.muted = true;
    setMuted(true);

    const playVideo = () => {
      video.play().then(() => {
        setPlaying(true);
        setStatus("LIVE");
      }).catch(() => setStatus("Ready"));
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
      hls.on(Hls.Events.MANIFEST_PARSED, playVideo);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus("Reconnecting…");
          window.setTimeout(() => hls.startLoad(), 900);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus("Recovering…");
          hls.recoverMediaError();
        } else {
          setError("This stream could not be played. Check the channel URL or its CORS settings.");
          setStatus("Offline");
        }
      });
    } else {
      video.src = channel.url;
      video.addEventListener("loadedmetadata", playVideo, { once: true });
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true)).catch(() => {});
    else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => setMuted((value) => !value);

  const pip = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled || !video.requestPictureInPicture) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { /* browser rejected PiP */ }
  };

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen?.();
    } catch { /* browser rejected fullscreen */ }
  };

  return (
    <div ref={shellRef} className="group/player relative aspect-video overflow-hidden rounded-[24px] border border-white/[0.08] bg-black shadow-[0_28px_90px_rgba(0,0,0,.54)]" data-testid="live-tv-player">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full bg-black object-contain"
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.10)_0%,transparent_48%,rgba(0,0,0,.82)_100%)]" />

      <div className="absolute left-4 top-4 flex items-center gap-2 md:left-5 md:top-5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/12 px-2.5 text-[10px] font-black tracking-[0.12em] text-red-400 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
        </span>
        <span className="rounded-full border border-white/[0.10] bg-black/48 px-2.5 py-1.5 text-[10px] font-semibold text-white/62 backdrop-blur-md">{status}</span>
      </div>

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/74 p-8 text-center backdrop-blur-sm">
          <div className="max-w-sm">
            <Radio className="mx-auto h-8 w-8 text-[#ffd400]" />
            <p className="mt-4 text-sm font-semibold text-white/88">Stream unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/38">{error}</p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-3.5 md:p-5">
        <button type="button" onClick={togglePlay} className="grid h-10 w-10 place-items-center rounded-full bg-[#ffd400] text-black transition-transform duration-200 hover:scale-105 active:scale-95" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <button type="button" onClick={toggleMute} className="grid h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/[0.08] hover:text-white" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            setMuted(next === 0);
          }}
          className="hidden w-24 accent-[#ffd400] sm:block"
          aria-label="Volume"
        />

        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-xs font-semibold text-white/92 md:text-sm">{channel.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-white/38 md:text-[11px]">{channel.now || "Live programming"}</p>
        </div>

        <button type="button" onClick={pip} className="hidden h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white sm:grid" aria-label="Picture in picture"><PictureInPicture2 className="h-4 w-4" /></button>
        <button type="button" onClick={fullscreen} className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white" aria-label="Fullscreen"><Maximize2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
};

export default function LiveTV() {
  const [userChannels, setUserChannels] = useState(() => readJson(USER_CHANNELS_KEY, []));
  const [favorites, setFavorites] = useState(() => new Set(readJson(FAVORITES_KEY, [])));
  const [selectedId, setSelectedId] = useState(() => DEFAULT_CHANNELS[0].id);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [modal, setModal] = useState("");
  const [form, setForm] = useState({ name: "", group: "General", url: "", logo: "" });
  const [playlistText, setPlaylistText] = useState("");
  const [notice, setNotice] = useState("");

  const channels = useMemo(() => [...DEFAULT_CHANNELS, ...userChannels], [userChannels]);
  const selected = channels.find((channel) => channel.id === selectedId) || channels[0];
  const groups = useMemo(() => ["All", "Favorites", ...Array.from(new Set(channels.map((channel) => channel.group || "General")))], [channels]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels.filter((channel) => {
      if (group === "Favorites" && !favorites.has(channel.id)) return false;
      if (group !== "All" && group !== "Favorites" && (channel.group || "General") !== group) return false;
      if (!needle) return true;
      return `${channel.name} ${channel.group || ""} ${channel.description || ""}`.toLowerCase().includes(needle);
    });
  }, [channels, favorites, group, query]);

  useEffect(() => {
    localStorage.setItem(USER_CHANNELS_KEY, JSON.stringify(userChannels));
  }, [userChannels]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (event, id) => {
    event.stopPropagation();
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addChannel = (event) => {
    event.preventDefault();
    const url = cleanUrl(form.url);
    const name = form.name.trim();
    if (!name || !url) {
      setNotice("Add a channel name and a valid http(s) stream URL.");
      return;
    }

    const channel = {
      id: `user-${Date.now()}`,
      name,
      group: form.group.trim() || "General",
      url,
      logo: cleanUrl(form.logo),
      description: "Custom live channel",
      userAdded: true,
    };
    setUserChannels((items) => [...items, channel]);
    setSelectedId(channel.id);
    setForm({ name: "", group: "General", url: "", logo: "" });
    setNotice("");
    setModal("");
  };

  const importPlaylist = () => {
    const imported = parseM3U(playlistText);
    if (!imported.length) {
      setNotice("No playable http(s) channel URLs were found in that M3U playlist.");
      return;
    }
    setUserChannels((items) => [...items, ...imported]);
    setSelectedId(imported[0].id);
    setPlaylistText("");
    setNotice("");
    setModal("");
  };

  const removeChannel = (event, channel) => {
    event.stopPropagation();
    if (!channel.userAdded) return;
    setUserChannels((items) => items.filter((item) => item.id !== channel.id));
    setFavorites((current) => {
      const next = new Set(current);
      next.delete(channel.id);
      return next;
    });
    if (selectedId === channel.id) setSelectedId(DEFAULT_CHANNELS[0].id);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pb-20 pt-24 text-white md:pt-28" data-testid="live-tv-page">
      <section className="synflix-live-slide-left mx-auto max-w-[1500px] px-5 pt-7 md:px-8 md:pt-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/18 bg-red-500/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
              <Radio className="h-3.5 w-3.5" /> Live now
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl md:text-6xl">Live TV, built into SynFlix.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/42 md:text-[15px]">A fast channel guide, favorites, HLS playback, picture-in-picture, fullscreen, search, and M3U import. Add streams you own or are authorized to use and they stay saved on this device.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => { setNotice(""); setModal("import"); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-4 text-xs font-semibold text-white/70 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]"><Upload className="h-4 w-4" /> Import M3U</button>
            <button type="button" onClick={() => { setNotice(""); setModal("add"); }} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ffd400] px-4 text-xs font-bold text-black transition-transform hover:scale-[1.03] active:scale-95"><Plus className="h-4 w-4" /> Add channel</button>
          </div>
        </div>
      </section>

      <section className="synflix-live-slide-right mx-auto mt-8 grid max-w-[1500px] gap-5 px-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <LivePlayer key={selected?.id} channel={selected} />
          <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-3.5 md:p-4">
            <ChannelMark channel={selected} large />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-white/92 md:text-base">{selected.name}</h2>
                <span className="shrink-0 rounded border border-red-500/18 bg-red-500/[0.08] px-1.5 py-0.5 text-[8px] font-black tracking-[0.12em] text-red-400">LIVE</span>
              </div>
              <p className="mt-1 truncate text-xs text-white/36">{selected.now || "Live programming"}</p>
              {selected.next && <p className="mt-0.5 truncate text-[10px] text-white/24">Up next · {selected.next}</p>}
            </div>
            <button type="button" onClick={(event) => toggleFavorite(event, selected.id)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${favorites.has(selected.id) ? "border-[#ffd400]/28 bg-[#ffd400]/10 text-[#ffd400]" : "border-white/[0.08] text-white/38 hover:text-white"}`} aria-label="Favorite channel"><Star className={`h-4 w-4 ${favorites.has(selected.id) ? "fill-current" : ""}`} /></button>
          </div>
        </div>

        <aside className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0d10] shadow-[0_24px_70px_rgba(0,0,0,.30)]">
          <div className="border-b border-white/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/90">Channels</p>
                <p className="mt-0.5 text-[10px] text-white/28">{visible.length} available</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd400]/15 bg-[#ffd400]/[0.05] px-2.5 py-1 text-[9px] font-bold text-[#ffd400]/70"><span className="h-1.5 w-1.5 rounded-full bg-[#ffd400]" /> ON AIR</span>
            </div>
            <div className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/28 px-3 focus-within:border-[#ffd400]/30">
              <Search className="h-4 w-4 text-white/34" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/24" />
              {query && <button type="button" onClick={() => setQuery("")} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>

          <div className="synflix-yellow-scroll flex gap-1.5 overflow-x-auto border-b border-white/[0.06] px-3 py-3">
            {groups.map((item) => (
              <button key={item} type="button" onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${group === item ? "bg-[#ffd400] text-black" : "border border-white/[0.07] bg-white/[0.025] text-white/42 hover:text-white"}`}>{item}</button>
            ))}
          </div>

          <div className="synflix-yellow-scroll max-h-[540px] overflow-y-auto p-2">
            {visible.length ? visible.map((channel) => {
              const active = selected?.id === channel.id;
              const starred = favorites.has(channel.id);
              return (
                <button key={channel.id} type="button" onClick={() => setSelectedId(channel.id)} className={`group/channel flex w-full items-center gap-3 rounded-[15px] p-2.5 text-left transition ${active ? "bg-[#ffd400]/[0.08]" : "hover:bg-white/[0.035]"}`}>
                  <ChannelMark channel={channel} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-semibold ${active ? "text-[#ffd400]" : "text-white/76"}`}>{channel.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-white/28">{channel.now || channel.group || "Live"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover/channel:opacity-100">
                    <span role="button" tabIndex={0} onClick={(event) => toggleFavorite(event, channel.id)} onKeyDown={() => {}} className={`grid h-7 w-7 place-items-center rounded-full ${starred ? "text-[#ffd400]" : "text-white/26 hover:text-white"}`} aria-label="Favorite"><Star className={`h-3.5 w-3.5 ${starred ? "fill-current" : ""}`} /></span>
                    {channel.userAdded && <span role="button" tabIndex={0} onClick={(event) => removeChannel(event, channel)} onKeyDown={() => {}} className="grid h-7 w-7 place-items-center rounded-full text-white/20 hover:bg-red-500/10 hover:text-red-400" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></span>}
                    <ChevronRight className={`h-4 w-4 ${active ? "text-[#ffd400]" : "text-white/18"}`} />
                  </span>
                </button>
              );
            }) : (
              <div className="grid min-h-[220px] place-items-center p-6 text-center">
                <div><Radio className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-xs font-semibold text-white/48">No channels here</p><p className="mt-1 text-[10px] text-white/24">Try another category or add a channel.</p></div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="synflix-live-slide-left mx-auto mt-7 max-w-[1500px] px-5 md:px-8">
        <div className="rounded-[24px] border border-white/[0.07] bg-[#0b0c0f] p-4 md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd400]/60">Channel guide</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">What’s on now</h2>
            </div>
            <p className="text-[10px] text-white/24">Guide data appears when a channel provides it.</p>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {channels.slice(0, 9).map((channel) => (
              <button key={`guide-${channel.id}`} type="button" onClick={() => { setSelectedId(channel.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="group/guide flex items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.018] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#ffd400]/20 hover:bg-[#ffd400]/[0.025]">
                <ChannelMark channel={channel} />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white/78">{channel.name}</span><span className="mt-1 block truncate text-[10px] text-white/30">{channel.now || "Live programming"}</span></span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,.5)]" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/74 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}>
          <div className="synflix-modal-slide w-full max-w-[560px] overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#0b0d10] shadow-[0_32px_100px_rgba(0,0,0,.72)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div><p className="text-sm font-semibold text-white/92">{modal === "add" ? "Add live channel" : "Import M3U playlist"}</p><p className="mt-0.5 text-[10px] text-white/28">Use streams you own or are authorized to access.</p></div>
              <button type="button" onClick={() => setModal("")} className="grid h-8 w-8 place-items-center rounded-full text-white/36 transition hover:bg-white/[0.05] hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {modal === "add" ? (
              <form onSubmit={addChannel} className="space-y-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Channel name</span><input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="My channel" className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/20" /></label>
                  <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Category</span><input value={form.group} onChange={(event) => setForm((value) => ({ ...value, group: event.target.value }))} placeholder="News, Sports…" className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/20" /></label>
                </div>
                <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">HLS / video URL</span><input value={form.url} onChange={(event) => setForm((value) => ({ ...value, url: event.target.value }))} placeholder="https://…/master.m3u8" className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/20" /></label>
                <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Logo URL <span className="normal-case tracking-normal text-white/18">optional</span></span><input value={form.logo} onChange={(event) => setForm((value) => ({ ...value, logo: event.target.value }))} placeholder="https://…/logo.png" className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/20" /></label>
                {notice && <p className="rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-300/80">{notice}</p>}
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ffd400] px-4 text-xs font-bold text-black"><Check className="h-4 w-4" /> Add channel</button>
              </form>
            ) : (
              <div className="p-5">
                <textarea value={playlistText} onChange={(event) => setPlaylistText(event.target.value)} placeholder="#EXTM3U\n#EXTINF:-1 group-title=\"News\",My Channel\nhttps://example.com/live.m3u8" className="h-60 w-full resize-none rounded-2xl border border-white/[0.08] bg-black/35 p-4 font-mono text-[11px] leading-5 text-white/68 outline-none placeholder:text-white/18" />
                {notice && <p className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-300/80">{notice}</p>}
                <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[10px] leading-4 text-white/24">SynFlix stores imported channels locally in this browser.</p><button type="button" onClick={importPlaylist} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#ffd400] px-4 text-xs font-bold text-black"><Upload className="h-4 w-4" /> Import</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
