import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { getStreams, hlsProxyUrl } from "@/lib/api";
import { getProgress, saveProgress } from "@/lib/storage";

let hlsLoaderPromise = null;
const loadHls = () => {
  if (!hlsLoaderPromise) hlsLoaderPromise = import("hls.js").then((module) => module.default || module);
  return hlsLoaderPromise;
};

const serverLabel = (server) => server?.quality || server?.name || "Source";
const playerAccent = "var(--player-accent, #ffd400)";

export const SystemPlayer = ({
  mediaType,
  id,
  season,
  episode,
  meta,
  onBack,
  hasNext,
  onNextEpisode,
}) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const saveTimerRef = useRef(0);
  const restoreRef = useRef(false);
  const preservedTimeRef = useRef(null);
  const preservedPausedRef = useRef(false);

  const [servers, setServers] = useState([]);
  const [selectedID, setSelectedID] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedID) || servers[0] || null,
    [servers, selectedID]
  );

  const cleanupPlayback = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  const attachServer = useCallback(async (server, { preserve = false } = {}) => {
    const video = videoRef.current;
    if (!video || !server) return;

    if (preserve) {
      preservedTimeRef.current = Number.isFinite(video.currentTime) ? video.currentTime : null;
      preservedPausedRef.current = video.paused;
    } else {
      preservedTimeRef.current = null;
      preservedPausedRef.current = false;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setSelectedID(server.id);
    setSourceOpen(false);
    setPhase("loading");
    setMessage("");

    const playURL = hlsProxyUrl(server.play_url);
    if (!playURL) {
      setPhase("failed");
      setMessage("That source did not return a playable URL.");
      return;
    }

    const canNativeHls = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
    const likelyHls = server.type === "hls" || /\.m3u8(?:$|\?)/i.test(playURL);

    try {
      if (likelyHls && !canNativeHls) {
        const Hls = await loadHls();
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 24,
            maxMaxBufferLength: 48,
          });
          hlsRef.current = hls;
          hls.loadSource(playURL);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else {
              setPhase("failed");
              setMessage("Playback stopped because this source could not be decoded.");
            }
          });
        } else {
          video.src = playURL;
        }
      } else {
        video.src = playURL;
      }
      video.load();
    } catch (error) {
      setPhase("failed");
      setMessage(error?.message || "That source could not be opened.");
    }
  }, []);

  const loadSources = useCallback(async () => {
    setPhase("loading");
    setMessage("");
    try {
      const response = await getStreams(mediaType, id, season, episode, {
        title: meta?.title,
        year: Number((meta?.release_date || meta?.first_air_date || "").slice(0, 4)) || undefined,
      });
      const loaded = Array.isArray(response?.servers) ? response.servers : [];
      if (!loaded.length) throw new Error("No playable sources were returned for this title.");
      setServers(loaded);
      const first = loaded.find((server) => server.primary) || loaded[0];
      await attachServer(first);
    } catch (error) {
      setPhase("failed");
      setMessage(error?.message || "SynFlix could not find a playable source.");
    }
  }, [attachServer, episode, id, mediaType, meta, season]);

  useEffect(() => {
    restoreRef.current = false;
    loadSources();
    return cleanupPlayback;
  }, [cleanupPlayback, loadSources]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onLoaded = () => {
      setPhase("ready");

      if (preservedTimeRef.current != null) {
        video.currentTime = Math.min(preservedTimeRef.current, Math.max(0, video.duration - 0.25));
        const stayPaused = preservedPausedRef.current;
        preservedTimeRef.current = null;
        if (!stayPaused) video.play().catch(() => {});
        return;
      }

      if (!restoreRef.current) {
        restoreRef.current = true;
        const saved = getProgress(mediaType, id, season, episode);
        if (saved?.position && saved.position > 12 && (!video.duration || saved.position < video.duration - 20)) {
          video.currentTime = saved.position;
        }
      }

      video.play().catch(() => {});
    };

    const persist = () => {
      const now = Date.now();
      if (now - saveTimerRef.current < 5000) return;
      saveTimerRef.current = now;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      saveProgress({
        media_type: mediaType,
        id,
        season,
        episode,
        position: video.currentTime,
        duration: video.duration,
        title: meta?.title,
        poster_path: meta?.poster_path,
        backdrop_path: meta?.backdrop_path,
      });
    };

    const onError = () => {
      if (phase === "loading") return;
      setPhase("failed");
      setMessage("This source stopped responding. Try another source.");
    };

    const onEnded = () => {
      persist();
      if (hasNext && onNextEpisode) onNextEpisode();
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    video.addEventListener("timeupdate", persist);
    video.addEventListener("error", onError);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("timeupdate", persist);
      video.removeEventListener("error", onError);
      video.removeEventListener("ended", onEnded);
    };
  }, [episode, hasNext, id, mediaType, meta, onNextEpisode, phase, season]);

  const captions = selectedServer?.captions || [];

  return (
    <section className="relative isolate aspect-video w-full overflow-hidden rounded-[18px] bg-black shadow-[0_28px_90px_rgba(0,0,0,.55)]" data-testid="system-player">
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        controls
        playsInline
        preload="metadata"
        disablePictureInPicture={false}
        aria-label={`${meta?.title || "SynFlix"} player`}
      >
        {captions.map((caption, index) => (
          <track
            key={`${selectedServer?.id || "source"}-${caption.id || index}`}
            kind="subtitles"
            src={hlsProxyUrl(caption.play_url)}
            srcLang={caption.lang || "en"}
            label={caption.name || caption.lang || "Subtitles"}
            default={index === 0}
          />
        ))}
      </video>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-3 pb-12 pt-3 sm:px-4 sm:pt-4">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/35 text-white/90 shadow-lg backdrop-blur-2xl transition hover:bg-black/55 active:scale-95"
          aria-label="Close player"
        >
          <ChevronDown className="h-5 w-5" />
        </button>

        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setSourceOpen((open) => !open)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 text-xs font-semibold text-white/90 shadow-lg backdrop-blur-2xl transition hover:bg-black/55"
            aria-expanded={sourceOpen}
            aria-label="Choose playback source"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: playerAccent }} />
            <span>{serverLabel(selectedServer)}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-white/55 transition ${sourceOpen ? "rotate-180" : ""}`} />
          </button>

          {sourceOpen && (
            <div className="absolute right-0 top-12 w-[260px] overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b0d]/92 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-2xl">
              <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Playback source</div>
              <div className="max-h-64 overflow-y-auto">
                {servers.map((server) => {
                  const active = server.id === selectedID;
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => attachServer(server, { preserve: true })}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${active ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.05] hover:text-white"}`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${active ? "text-black" : "bg-white/[0.05] text-white/45"}`} style={active ? { backgroundColor: playerAccent } : undefined}>
                        {active ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{server.name || "Source"}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/35">{server.quality || server.provider || "Automatic"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {phase !== "ready" && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/72 px-6 text-center backdrop-blur-sm">
          {phase === "loading" ? (
            <div className="flex flex-col items-center gap-4">
              <img src="/synflix-logo.webp" alt="" className="h-16 w-16 object-contain" />
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: playerAccent }} />
              <div>
                <div className="text-sm font-semibold text-white">{meta?.title || "SynFlix"}</div>
                <div className="mt-1 text-xs text-white/40">Finding the best source</div>
              </div>
            </div>
          ) : (
            <div className="max-w-sm">
              <AlertCircle className="mx-auto h-8 w-8" style={{ color: playerAccent }} />
              <div className="mt-4 text-lg font-semibold text-white">Playback unavailable</div>
              <p className="mt-2 text-sm leading-6 text-white/45">{message}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-xs font-semibold text-white/75">
                  <X className="h-4 w-4" /> Close
                </button>
                <button type="button" onClick={loadSources} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-black" style={{ backgroundColor: playerAccent }}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
