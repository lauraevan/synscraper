import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Captions,
  Check,
  ChevronDown,
  Expand,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { getStreams, hlsProxyUrl } from "@/lib/api";
import { getProgress, saveProgress } from "@/lib/storage";

let hlsLoaderPromise = null;
const loadHls = () => {
  if (!hlsLoaderPromise) hlsLoaderPromise = import("hls.js").then((module) => module.default || module);
  return hlsLoaderPromise;
};

const playerAccent = "var(--player-accent, var(--site-accent, #ffd400))";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
};

const sourceLabel = (server) => server?.quality || server?.name || "Auto";

export const SystemPlayer = ({
  mediaType,
  id,
  season,
  episode,
  meta,
  onBack,
  hasNext,
  onNextEpisode,
  fullscreen = false,
}) => {
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimerRef = useRef(null);
  const saveTimerRef = useRef(0);
  const restoreRef = useRef(false);
  const preservedTimeRef = useRef(null);
  const preservedPausedRef = useRef(false);
  const fatalRecoveryRef = useRef(0);

  const [servers, setServers] = useState([]);
  const [selectedID, setSelectedID] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedID) || servers[0] || null,
    [servers, selectedID]
  );

  const captions = selectedServer?.captions || [];

  const stopHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    stopHideTimer();
    if (!playing || phase !== "ready" || sourceOpen) return;
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2800);
  }, [phase, playing, sourceOpen, stopHideTimer]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const cleanupPlayback = useCallback(() => {
    stopHideTimer();
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
  }, [stopHideTimer]);

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

    fatalRecoveryRef.current = 0;
    setSelectedID(server.id);
    setSourceOpen(false);
    setPhase("loading");
    setMessage("");
    revealControls();

    const playURL = hlsProxyUrl(server.play_url);
    if (!playURL) {
      setPhase("failed");
      setMessage("This source did not return a playable stream.");
      return;
    }

    const likelyHls = server.type === "hls" || /\.m3u8(?:$|\?)/i.test(playURL);
    const canNativeHls = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));

    try {
      if (likelyHls && !canNativeHls) {
        const Hls = await loadHls();
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 75,
            startFragPrefetch: true,
          });
          hlsRef.current = hls;
          hls.loadSource(playURL);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && fatalRecoveryRef.current < 2) {
              fatalRecoveryRef.current += 1;
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalRecoveryRef.current < 2) {
              fatalRecoveryRef.current += 1;
              hls.recoverMediaError();
              return;
            }
            setPhase("failed");
            setMessage("This source became unstable. Switch sources or retry.");
            revealControls();
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
      setMessage(error?.message || "This source could not be opened.");
    }
  }, [revealControls]);

  const loadSources = useCallback(async () => {
    setPhase("loading");
    setMessage("");
    setServers([]);
    revealControls();
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
  }, [attachServer, episode, id, mediaType, meta, revealControls, season]);

  useEffect(() => {
    restoreRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    loadSources();
    return cleanupPlayback;
  }, [cleanupPlayback, loadSources]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const restorePosition = () => {
      if (preservedTimeRef.current != null) {
        const target = Math.min(preservedTimeRef.current, Math.max(0, video.duration - 0.25));
        if (Number.isFinite(target)) video.currentTime = target;
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
    };

    const onLoaded = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setPhase("ready");
      restorePosition();
      video.play().catch(() => setPlaying(false));
    };

    const persist = (force = false) => {
      const now = Date.now();
      if (!force && now - saveTimerRef.current < 5000) return;
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

    const updateTimeline = () => {
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      if (video.buffered?.length && Number.isFinite(video.duration) && video.duration > 0) {
        const end = video.buffered.end(video.buffered.length - 1);
        setBuffered(clamp((end / video.duration) * 100, 0, 100));
      }
      persist();
    };

    const onPlay = () => {
      setPlaying(true);
      scheduleHide();
    };
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
      stopHideTimer();
      persist(true);
    };
    const onWaiting = () => setPhase((value) => value === "failed" ? value : "buffering");
    const onPlaying = () => setPhase("ready");
    const onError = () => {
      setPhase("failed");
      setMessage("Playback stopped. Try another source or retry this one.");
      setControlsVisible(true);
    };
    const onEnded = () => {
      persist(true);
      setPlaying(false);
      setControlsVisible(true);
      if (hasNext && onNextEpisode) onNextEpisode();
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted || video.volume === 0);
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    video.addEventListener("durationchange", updateTimeline);
    video.addEventListener("timeupdate", updateTimeline);
    video.addEventListener("progress", updateTimeline);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("error", onError);
    video.addEventListener("ended", onEnded);

    return () => {
      persist(true);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("durationchange", updateTimeline);
      video.removeEventListener("timeupdate", updateTimeline);
      video.removeEventListener("progress", updateTimeline);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("error", onError);
      video.removeEventListener("ended", onEnded);
    };
  }, [episode, hasNext, id, mediaType, meta, onNextEpisode, scheduleHide, season, stopHideTimer]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || phase === "failed") return;
    revealControls();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [phase, revealControls]);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = clamp(video.currentTime + delta, 0, video.duration);
    setCurrentTime(video.currentTime);
    revealControls();
  }, [revealControls]);

  const seekTo = (event) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const next = (Number(event.target.value) / 1000) * video.duration;
    video.currentTime = next;
    setCurrentTime(next);
    revealControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    revealControls();
  };

  const changeVolume = (event) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(event.target.value);
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    revealControls();
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    revealControls();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (videoRef.current?.webkitEnterFullscreen) videoRef.current.webkitEnterFullscreen();
    } catch { /* browser denied fullscreen */ }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    revealControls();
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { /* PiP unavailable for this stream */ }
  };

  const toggleCaptions = () => {
    const video = videoRef.current;
    if (!video?.textTracks?.length) return;
    const next = !captionsEnabled;
    Array.from(video.textTracks).forEach((track, index) => {
      track.mode = next && index === 0 ? "showing" : "disabled";
    });
    setCaptionsEnabled(next);
    revealControls();
  };

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if (!shellRef.current) return;

      if (event.key === "Escape" && !document.fullscreenElement) {
        event.preventDefault();
        onBack?.();
        return;
      }
      if (event.code === "Space" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        seekBy(-10);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault();
        seekBy(10);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, seekBy, togglePlayback]);

  useEffect(() => {
    if (sourceOpen) {
      setControlsVisible(true);
      stopHideTimer();
    } else {
      scheduleHide();
    }
  }, [scheduleHide, sourceOpen, stopHideTimer]);

  const timelineValue = duration > 0 ? clamp((currentTime / duration) * 1000, 0, 1000) : 0;
  const shellClass = fullscreen
    ? "synplayer3-shell synplayer3-fullscreen"
    : "synplayer3-shell synplayer3-inline";
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;

  return (
    <section
      ref={shellRef}
      className={`${shellClass} ${controlsVisible ? "controls-visible" : "controls-hidden"}`}
      data-testid="system-player"
      data-fullscreen={fullscreen ? "true" : "false"}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onMouseLeave={() => playing && !sourceOpen && setControlsVisible(false)}
    >
      <video
        ref={videoRef}
        className="synplayer3-video"
        playsInline
        preload="auto"
        disablePictureInPicture={false}
        onClick={togglePlayback}
        onDoubleClick={toggleFullscreen}
        aria-label={`${meta?.title || "SynFlix"} player`}
      >
        {captions.map((caption, index) => (
          <track
            key={`${selectedServer?.id || "source"}-${caption.id || index}`}
            kind="subtitles"
            src={hlsProxyUrl(caption.play_url)}
            srcLang={caption.lang || "en"}
            label={caption.name || caption.lang || "Subtitles"}
          />
        ))}
      </video>

      <div className="synplayer3-vignette synplayer3-vignette-top" />
      <div className="synplayer3-vignette synplayer3-vignette-bottom" />

      <div className="synplayer3-topbar">
        <button type="button" className="synplayer3-close" onClick={onBack} aria-label="Exit player">
          <X />
        </button>

        <div className="synplayer3-heading">
          <strong>{meta?.title || "SynFlix"}</strong>
          {mediaType === "tv" && <span>Season {season} · Episode {episode}</span>}
        </div>

        <div className="synplayer3-top-actions">
          <div className="synplayer3-source-wrap">
            <button
              type="button"
              className="synplayer3-source-button"
              onClick={() => setSourceOpen((open) => !open)}
              aria-expanded={sourceOpen}
              aria-label="Choose playback source"
            >
              <span className="synplayer3-source-dot" />
              <span>{sourceLabel(selectedServer)}</span>
              <ChevronDown className={sourceOpen ? "rotate-180" : ""} />
            </button>

            {sourceOpen && (
              <div className="synplayer3-source-menu">
                <div className="synplayer3-source-title">Playback source</div>
                <div className="synplayer3-source-list">
                  {servers.map((server) => {
                    const active = server.id === selectedID;
                    return (
                      <button
                        key={server.id}
                        type="button"
                        onClick={() => attachServer(server, { preserve: true })}
                        className={active ? "is-active" : ""}
                      >
                        <span className="synplayer3-source-check">{active ? <Check /> : null}</span>
                        <span className="synplayer3-source-copy">
                          <strong>{server.name || "Source"}</strong>
                          <small>{server.quality || server.provider || "Automatic"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {phase === "ready" && controlsVisible && !playing && (
        <button type="button" className="synplayer3-center-play" onClick={togglePlayback} aria-label="Play">
          <Play />
        </button>
      )}

      {(phase === "loading" || phase === "buffering") && (
        <div className="synplayer3-loading" aria-live="polite">
          <Loader2 />
          <span>{phase === "loading" ? "Starting playback" : "Buffering"}</span>
        </div>
      )}

      {phase === "failed" && (
        <div className="synplayer3-error" role="alert">
          <AlertCircle />
          <h2>Playback unavailable</h2>
          <p>{message}</p>
          <div>
            <button type="button" onClick={onBack} className="secondary"><X /> Exit</button>
            <button type="button" onClick={loadSources} className="primary"><RefreshCw /> Retry</button>
          </div>
        </div>
      )}

      <div className="synplayer3-controls">
        <div className="synplayer3-timeline-wrap">
          <div className="synplayer3-buffer" style={{ width: `${buffered}%` }} />
          <div className="synplayer3-progress" style={{ width: `${timelineValue / 10}%` }} />
          <input
            className="synplayer3-timeline"
            type="range"
            min="0"
            max="1000"
            step="1"
            value={timelineValue}
            onChange={seekTo}
            aria-label="Seek"
          />
        </div>

        <div className="synplayer3-control-row">
          <div className="synplayer3-control-left">
            <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause /> : <Play />}
            </button>
            <button type="button" onClick={() => seekBy(-10)} aria-label="Back 10 seconds"><RotateCcw /></button>
            <button type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds"><RotateCw /></button>

            <div className="synplayer3-volume">
              <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}><VolumeIcon /></button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={muted ? 0 : volume}
                onChange={changeVolume}
                aria-label="Volume"
              />
            </div>

            <span className="synplayer3-time">{formatTime(currentTime)} <em>/</em> {formatTime(duration)}</span>
          </div>

          <div className="synplayer3-control-right">
            {hasNext && onNextEpisode && (
              <button type="button" onClick={onNextEpisode} aria-label="Next episode" className="synplayer3-next">
                <SkipForward /><span>Next episode</span>
              </button>
            )}
            {captions.length > 0 && (
              <button type="button" onClick={toggleCaptions} className={captionsEnabled ? "is-active" : ""} aria-label="Subtitles">
                <Captions />
              </button>
            )}
            {typeof document !== "undefined" && document.pictureInPictureEnabled && (
              <button type="button" onClick={togglePiP} aria-label="Picture in Picture"><PictureInPicture2 /></button>
            )}
            <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
