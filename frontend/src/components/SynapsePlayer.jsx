import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward,
    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,
    Keyboard, ServerCog, X, ShieldCheck, AlertTriangle, Cloud,
} from "lucide-react";
import { getStreams, hlsProxyUrl } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { saveProgress, getProgress } from "@/lib/storage";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITY_LADDER = [
    { label: "4K", height: 2160 }, { label: "1440p", height: 1440 },
    { label: "1080p", height: 1080 }, { label: "720p", height: 720 },
    { label: "480p", height: 480 }, { label: "360p", height: 360 },
    { label: "240p", height: 240 }, { label: "144p", height: 144 },
];
const qualityHeight = (value) => {
    const q = String(value || "").toLowerCase();
    if (q.includes("4k") || q.includes("2160")) return 2160;
    const m = q.match(/(1440|1080|720|480|360|240|144)/);
    return m ? Number(m[1]) : 0;
};
const SHORTCUTS = [
    ["Space / K", "Play / Pause"], ["F", "Fullscreen"], ["M", "Mute"],
    ["← / →", "Seek ∓5s"], ["J / L", "Seek ∓10s"], ["↑ / ↓", "Volume"],
    ["N", "Next Episode"], ["C", "Subtitles"], ["?", "This help"],
];
const STEPS = [
    "Checking available sources",
    "Resolving playback links",
    "Choosing the fastest stream",
    "Preparing adaptive playback",
];

const Popover = ({ open, children }) =>
    open ? (
        <div className="absolute bottom-14 right-0 min-w-[220px] max-h-80 overflow-y-auto scrollbar-none rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl z-30">
            {children}
        </div>
    ) : null;

const MenuItem = ({ active, onClick, children, testId, disabled = false }) => (
    <button
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
            disabled ? "cursor-not-allowed text-white/20" : active ? "bg-white text-black" : "hover:bg-white/10 text-zinc-200"
        }`}
    >
        {children}
    </button>
);

export const SynapsePlayer = ({ mediaType, id, meta = {}, season, episode, onNextEpisode, hasNext, onBack }) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const hideTimer = useRef(null);
    const pendingSeekRef = useRef(null);
    const autoCaptionRef = useRef(false);

    const [servers, setServers] = useState([]);
    const [serverId, setServerId] = useState(null);
    const [mode, setMode] = useState("loading"); // loading | ready | error
    const [stepIdx, setStepIdx] = useState(0);
    const [error, setError] = useState(null);

    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [levels, setLevels] = useState([]);
    const [level, setLevel] = useState(-1);
    const [subs, setSubs] = useState([]);
    const [sub, setSub] = useState(-1);
    const [rate, setRate] = useState(1);
    const [fs, setFs] = useState(false);
    const [buffering, setBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [menu, setMenu] = useState(null);
    const [help, setHelp] = useState(false);
    const [ripple, setRipple] = useState(null);
    const [scrubPct, setScrubPct] = useState(null);

    const activeServer = servers.find((s) => s.id === serverId);

    const playServer = useCallback((server) => {
        const video = videoRef.current;
        if (!video || !server) return;
        setBuffering(true);
        setLevels([]); setLevel(-1); setSubs([]); setSub(-1);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const url = hlsProxyUrl(server.play_url);
        if (server.type === "hls" && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLevels(hls.levels || []);
                const resumeAt = pendingSeekRef.current;
                if (resumeAt != null && resumeAt > 0) {
                    if (typeof video.fastSeek === "function") video.fastSeek(resumeAt);
                    else video.currentTime = resumeAt;
                    pendingSeekRef.current = null;
                }
                video.play().catch(() => {});
            });
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => {
                const tracks = d.subtitleTracks || [];
                setSubs(tracks);
                if (autoCaptionRef.current && tracks.length) {
                    hls.subtitleTrack = 0;
                    setSub(0);
                    autoCaptionRef.current = false;
                }
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setLevel(hls.autoLevelEnabled ? -1 : d.level));
            hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryNext(server.id); });
        } else {
            const resumeAt = pendingSeekRef.current;
            const restore = () => {
                if (resumeAt != null && resumeAt > 0) video.currentTime = resumeAt;
                pendingSeekRef.current = null;
                video.removeEventListener("loadedmetadata", restore);
            };
            if (resumeAt != null) video.addEventListener("loadedmetadata", restore);
            video.src = url;
            video.play().catch(() => {});
        }
    }, [servers]); // eslint-disable-line

    const tryNext = useCallback((failedId) => {
        const idx = servers.findIndex((s) => s.id === failedId);
        const next = servers[idx + 1];
        if (next) { setServerId(next.id); playServer(next); }
        else setError("All scraped servers failed to play. Try another title.");
    }, [servers, playServer]);

    // scrape servers
    useEffect(() => {
        let alive = true;
        setMode("loading"); setStepIdx(0); setError(null);
        const tick = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 900);
        getStreams(mediaType, id, season, episode)
            .then((d) => {
                if (!alive) return;
                clearInterval(tick);
                const list = d.servers || [];
                setServers(list);
                if (list.length) {
                    setServerId(list[0].id);
                    setMode("ready");
                } else {
                    setMode("error");
                    setError("No streams could be scraped for this title yet.");
                }
            })
            .catch(() => { if (alive) { clearInterval(tick); setMode("error"); setError("Scraper request failed."); } });
        return () => { alive = false; clearInterval(tick); };
    }, [mediaType, id, season, episode]);

    // when ready + server chosen, start playback
    useEffect(() => {
        if (mode === "ready" && activeServer && videoRef.current) playServer(activeServer);
        // eslint-disable-next-line
    }, [mode, serverId, servers.length]);

    const selectServer = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        setMenu(null); setServerId(s.id); playServer(s);
    };
    const selectCaptionSource = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        autoCaptionRef.current = true;
        setSub(-1);
        setMenu(null);
        setServerId(s.id);
        playServer(s);
    };

    // video wiring
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onTime = () => { setCurrent(v.currentTime); if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); };
        const onMeta = () => {
            setDuration(v.duration);
            const p = getProgress(mediaType, id, season, episode);
            if (p && p.position && p.position < v.duration - 10) v.currentTime = p.position;
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onVol = () => { setVolume(v.volume); setMuted(v.muted); };
        const onWait = () => setBuffering(true);
        const onPlaying = () => setBuffering(false);
        v.addEventListener("timeupdate", onTime);
        v.addEventListener("loadedmetadata", onMeta);
        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        v.addEventListener("volumechange", onVol);
        v.addEventListener("waiting", onWait);
        v.addEventListener("playing", onPlaying);
        v.addEventListener("canplay", onPlaying);
        return () => {
            v.removeEventListener("timeupdate", onTime); v.removeEventListener("loadedmetadata", onMeta);
            v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause);
            v.removeEventListener("volumechange", onVol); v.removeEventListener("waiting", onWait);
            v.removeEventListener("playing", onPlaying); v.removeEventListener("canplay", onPlaying);
        };
    }, [mode, mediaType, id, season, episode]);

    useEffect(() => {
        if (!duration) return;
        const t = setInterval(() => {
            const v = videoRef.current; if (!v) return;
            saveProgress({ media_type: mediaType, id, title: meta.title, poster_path: meta.poster_path,
                backdrop_path: meta.backdrop_path, season, episode, position: v.currentTime, duration: v.duration });
        }, 5000);
        return () => clearInterval(t);
    }, [duration, mediaType, id, season, episode, meta]);

    useEffect(() => {
        const onFs = () => setFs(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFs);
        return () => document.removeEventListener("fullscreenchange", onFs);
    }, []);
    useEffect(() => () => { if (hlsRef.current) hlsRef.current.destroy(); }, []);

    const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
    const fastSeekTo = (seconds, precise = false) => {
        const v = videoRef.current;
        if (!v || !Number.isFinite(seconds)) return;
        const target = Math.max(0, Math.min(v.duration || duration || 0, seconds));
        setCurrent(target);
        if (!precise && typeof v.fastSeek === "function") v.fastSeek(target);
        else v.currentTime = target;
    };
    const seekBy = (d) => {
        const v = videoRef.current;
        if (v) fastSeekTo(v.currentTime + d);
        showRipple(d > 0 ? "fwd" : "back");
    };
    const previewSeek = (val) => {
        if (!duration) return;
        const next = Number(val);
        setScrubPct(next);
        fastSeekTo((next / 100) * duration);
    };
    const commitSeek = (val) => {
        if (!duration) return;
        const next = Number(val);
        fastSeekTo((next / 100) * duration, true);
        setScrubPct(null);
    };
    const setVol = (val) => { const v = videoRef.current; if (v) { v.volume = val; v.muted = val === 0; } };
    const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted; };
    const changeLevel = (i) => { if (hlsRef.current) { hlsRef.current.currentLevel = i; } setLevel(i); setMenu(null); };
    const chooseQuality = (choice) => {
        if (!choice) return;
        if (choice.levelIndex >= 0 && hlsRef.current) {
            changeLevel(choice.levelIndex);
            return;
        }
        if (choice.server) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setMenu(null);
            setServerId(choice.server.id);
            playServer(choice.server);
        }
    };
    const changeSub = (i) => { if (hlsRef.current) hlsRef.current.subtitleTrack = i; setSub(i); setMenu(null); };
    const changeRate = (r) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };
    const togglePip = async () => { const v = videoRef.current; if (!v) return; try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); } catch { /* noop */ } };
    const toggleFs = () => { const el = containerRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => {}); };
    const showRipple = (dir) => { setRipple(dir); setTimeout(() => setRipple(null), 500); };

    const wake = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => { if (playing) { setShowControls(false); setMenu(null); } }, 3200);
    }, [playing]);

    useEffect(() => {
        if (mode !== "ready") return;
        const onKey = (e) => {
            if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
            const k = e.key.toLowerCase();
            const map = {
                " ": togglePlay, k: togglePlay, f: toggleFs, m: toggleMute,
                arrowleft: () => seekBy(-5), arrowright: () => seekBy(5),
                j: () => seekBy(-10), l: () => seekBy(10),
                arrowup: () => setVol(Math.min(1, (videoRef.current?.volume || 0) + 0.1)),
                arrowdown: () => setVol(Math.max(0, (videoRef.current?.volume || 0) - 0.1)),
                c: () => changeSub(sub >= 0 ? -1 : (subs[0] ? 0 : -1)),
                n: () => hasNext && onNextEpisode?.(),
                "?": () => setHelp((v) => !v),
            };
            if (map[k]) { e.preventDefault(); map[k](); wake(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [mode, sub, subs, hasNext, wake]); // eslint-disable-line

    const pct = duration ? (current / duration) * 100 : 0;
    const seekPct = scrubPct == null ? pct : scrubPct;
    const bufPct = duration ? (buffered / duration) * 100 : 0;
    const captionSources = Array.from(new Map(servers.map((s) => [s.provider, s])).values()).slice(0, 6);
    const activeQualityHeight = level >= 0 ? Number(levels[level]?.height || 0) : qualityHeight(activeServer?.quality);
    const qualityChoices = QUALITY_LADDER.map((target) => {
        const levelIndex = levels.findIndex((l) => Number(l.height || 0) === target.height);
        const sameProvider = servers.find((s) => s.provider === activeServer?.provider && qualityHeight(s.quality) === target.height);
        const server = sameProvider || servers.find((s) => qualityHeight(s.quality) === target.height);
        return { ...target, levelIndex, server, available: levelIndex >= 0 || !!server };
    });
    const releaseDate = meta.release_date || meta.first_air_date || "";
    const year = releaseDate ? String(releaseDate).slice(0, 4) : "";
    const displayTitle = `${meta.title || "Untitled"}${year ? ` (${year})` : ""}`;
    const resolvePct = ((stepIdx + 1) / STEPS.length) * 100;

    return (
        <div
            ref={containerRef}
            data-testid="synapse-player-container"
            onMouseMove={wake}
            onTouchStart={wake}
            onClick={() => menu && setMenu(null)}
            className="relative w-full aspect-video bg-black rounded-[22px] overflow-hidden border border-white/10 select-none text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        >
            <video
                ref={videoRef}
                data-testid="synapse-video-element"
                className="absolute inset-0 w-full h-full bg-black object-cover"
                onClick={(e) => { e.stopPropagation(); togglePlay(); wake(); }}
                onDoubleClick={toggleFs}
                poster={meta.backdrop_path ? `https://image.tmdb.org/t/p/original${meta.backdrop_path}` : undefined}
                playsInline
                crossOrigin="anonymous"
            />

            {mode === "ready" && showControls && (
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.34),rgba(0,0,0,0.04)_34%,rgba(0,0,0,0.08)_58%,rgba(0,0,0,0.72)_100%)] z-10" />
            )}

            {mode === "ready" && buffering && playing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-14 h-14 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
                </div>
            )}

            {mode === "loading" && (
                <div data-testid="synapse-resolving" className="absolute inset-0 z-40 overflow-hidden bg-black">
                    {meta.backdrop_path && (
                        <img
                            src={`https://image.tmdb.org/t/p/original${meta.backdrop_path}`}
                            alt=""
                            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-[2px]"
                        />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.58),rgba(0,0,0,0.88)),radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.08),transparent_34%)]" />

                    <Cloud className="absolute left-5 top-5 h-10 w-10 text-white/70 md:left-7 md:top-7 md:h-12 md:w-12" strokeWidth={1.55} />

                    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
                        <div className="relative mb-7 grid h-20 w-20 place-items-center rounded-full border border-white/12 bg-white/[0.035] backdrop-blur-xl md:h-24 md:w-24">
                            <div className="absolute inset-2 rounded-full border border-white/10 syn-soft-pulse" />
                            <Cloud className="h-9 w-9 text-white/85 md:h-11 md:w-11" strokeWidth={1.4} />
                        </div>

                        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">Synapse Player</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white md:text-4xl">Finding the best source</h2>
                        <p className="mt-2 max-w-lg truncate text-sm text-white/48 md:text-base">{displayTitle}</p>
                        <p className="mt-3 text-xs text-white/28">This usually only takes a few seconds.</p>

                        <div className="mt-8 w-full max-w-md">
                            <div className="relative h-1 overflow-hidden rounded-full bg-white/10">
                                <div className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-all duration-700" style={{ width: `${resolvePct}%` }} />
                                <div className="syn-resolve-sweep absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                            </div>

                            <div className="mt-5 space-y-2 text-left">
                                {STEPS.map((step, i) => {
                                    const complete = i < stepIdx;
                                    const active = i === stepIdx;
                                    return (
                                        <div key={step} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs transition-all duration-300 ${active ? "bg-white/[0.055] text-white/75" : complete ? "text-white/45" : "text-white/20"}`}>
                                            <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${complete ? "border-white/25 bg-white/[0.08]" : active ? "border-white/35" : "border-white/10"}`}>
                                                {complete ? <ShieldCheck className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white syn-soft-pulse" : "bg-white/15"}`} />}
                                            </div>
                                            <span>{step}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mode === "error" && (
                <div data-testid="synapse-error" className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 z-40 px-6 text-center">
                    <AlertTriangle className="w-10 h-10 text-white/80 mb-3" />
                    <p className="font-semibold mb-1">Couldn't load this stream</p>
                    <p className="text-sm text-white/50 max-w-sm">{error}</p>
                    <button onClick={onBack} className="mt-5 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90">Go back</button>
                </div>
            )}

            {mode === "ready" && (
                <>
                    <div className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                        <button
                            data-testid="synapse-back-btn"
                            onClick={(e) => { e.stopPropagation(); onBack?.(); }}
                            className="absolute left-5 top-5 md:left-7 md:top-7 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                            aria-label="Back"
                        >
                            <Cloud className="w-11 h-11 md:w-12 md:h-12 stroke-[1.65]" />
                        </button>

                        <div className="absolute left-1/2 top-6 md:top-7 -translate-x-1/2 text-center max-w-[68%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] pointer-events-none">
                            <p className="text-sm md:text-lg font-medium text-white/80 leading-none">You're Watching</p>
                            <p className="mt-2 text-base md:text-xl font-semibold text-white truncate">{displayTitle}</p>
                        </div>
                    </div>

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute inset-0 z-20 flex items-center justify-center gap-[11vw] max-md:gap-16 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    >
                        <button onClick={() => seekBy(-10)} className="relative w-20 h-20 md:w-24 md:h-24 text-white/90 hover:text-white active:scale-95 transition" aria-label="Back 10 seconds">
                            <RotateCcw className="absolute inset-0 w-full h-full stroke-[1.7]" />
                            <span className="absolute inset-0 flex items-center justify-center text-xl md:text-2xl font-semibold pt-1">10</span>
                        </button>

                        <button
                            data-testid="synapse-play-pause-btn"
                            onClick={togglePlay}
                            className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform drop-shadow-[0_5px_20px_rgba(0,0,0,0.45)]"
                            aria-label={playing ? "Pause" : "Play"}
                        >
                            {playing ? <Pause className="w-16 h-16 md:w-20 md:h-20 fill-current stroke-[1.2]" /> : <Play className="w-20 h-20 md:w-24 md:h-24 fill-current stroke-[1.2] ml-2" />}
                        </button>

                        <button onClick={() => seekBy(10)} className="relative w-20 h-20 md:w-24 md:h-24 text-white/90 hover:text-white active:scale-95 transition" aria-label="Forward 10 seconds">
                            <RotateCw className="absolute inset-0 w-full h-full stroke-[1.7]" />
                            <span className="absolute inset-0 flex items-center justify-center text-xl md:text-2xl font-semibold pt-1">10</span>
                        </button>
                    </div>

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute bottom-0 left-0 right-0 z-30 px-4 md:px-7 pb-4 md:pb-7 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    >
                        <div className="group/seek relative mb-6 md:mb-8 h-4 flex items-center">
                            <div className="absolute left-0 right-0 h-[5px] rounded-full bg-white/28 overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-white/22" style={{ width: `${bufPct}%` }} />
                                <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct}%` }} />
                            </div>
                            <input
                                data-testid="synapse-seek-bar"
                                type="range" min="0" max="100" step="0.01" value={seekPct}
                                onPointerDown={(e) => setScrubPct(Number(e.currentTarget.value))}
                                onInput={(e) => previewSeek(e.currentTarget.value)}
                                onChange={(e) => commitSeek(e.currentTarget.value)}
                                onPointerUp={(e) => commitSeek(e.currentTarget.value)}
                                onTouchEnd={(e) => commitSeek(e.currentTarget.value)}
                                className="absolute -inset-y-2 inset-x-0 w-full h-8 cursor-pointer opacity-0 touch-none"
                                aria-label="Seek"
                            />
                            {scrubPct != null && (
                                <div className="absolute -top-9 -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[11px] font-medium tabular-nums text-white/85 backdrop-blur-xl pointer-events-none" style={{ left: `${seekPct}%` }}>
                                    {fmtTime((seekPct / 100) * duration)}
                                </div>
                            )}
                            <div className="absolute w-4 h-4 rounded-full bg-white -translate-x-1/2 pointer-events-none shadow-[0_1px_8px_rgba(0,0,0,0.4)]" style={{ left: `${seekPct}%` }} />
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="flex items-center group/vol">
                                <button data-testid="synapse-mute-btn" onClick={toggleMute} className="text-white/95 hover:text-white active:scale-95 transition" aria-label="Mute">
                                    {muted || volume === 0 ? <VolumeX className="w-8 h-8 md:w-9 md:h-9 fill-current/10 stroke-[2.2]" /> : <Volume2 className="w-8 h-8 md:w-9 md:h-9 fill-current/10 stroke-[2.2]" />}
                                </button>
                                <input
                                    data-testid="synapse-volume-slider"
                                    type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                                    onChange={(e) => setVol(parseFloat(e.target.value))}
                                    className="w-0 group-hover/vol:w-20 focus:w-20 transition-all duration-200 ml-2 accent-white"
                                    aria-label="Volume"
                                />
                            </div>

                            <span data-testid="synapse-time" className="text-sm md:text-lg font-medium tabular-nums text-white/95 whitespace-nowrap">
                                {fmtTime(current)} <span className="text-white/65 px-1">/</span> {fmtTime(duration)}
                            </span>

                            <div className="ml-auto flex items-center gap-4 md:gap-7">
                                {hasNext && (
                                    <button data-testid="synapse-next-episode-btn" onClick={onNextEpisode} className="hidden sm:block text-white/85 hover:text-white active:scale-95 transition" title="Next episode (N)">
                                        <SkipForward className="w-7 h-7 md:w-8 md:h-8" />
                                    </button>
                                )}

                                <div className="relative">
                                    <button
                                        data-testid="synapse-subtitles-menu"
                                        onClick={() => setMenu(menu === "subs" ? null : "subs")}
                                        className={`w-10 h-8 md:w-12 md:h-9 rounded-lg border-2 flex items-center justify-center transition ${sub >= 0 ? "bg-white text-black border-white" : "text-white/90 border-white/70 hover:border-white"}`}
                                        title="Captions (C)"
                                        aria-label="Captions"
                                    >
                                        <Subtitles className="w-6 h-6 md:w-7 md:h-7 stroke-[2.2]" />
                                    </button>
                                    <Popover open={menu === "subs"}>
                                        <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Caption source</p>
                                        <div className="max-h-36 overflow-y-auto scrollbar-none">
                                            {captionSources.map((s) => (
                                                <MenuItem key={s.provider} active={serverId === s.id} onClick={() => selectCaptionSource(s)}>
                                                    <span>{s.name}</span><span className="text-[10px] opacity-45">{s.provider}</span>
                                                </MenuItem>
                                            ))}
                                        </div>
                                        <div className="h-px bg-white/10 my-2" />
                                        <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Tracks · {activeServer?.name || "Current source"}</p>
                                        <MenuItem active={sub === -1} onClick={() => changeSub(-1)} testId="sub-off">Off</MenuItem>
                                        {subs.map((track, i) => (
                                            <MenuItem key={i} active={sub === i} onClick={() => changeSub(i)}>{track.name || track.lang || `Track ${i + 1}`}</MenuItem>
                                        ))}
                                        {!subs.length && <p className="px-3 py-3 text-xs text-white/45">This source has no exposed caption tracks. Try another source above.</p>}
                                    </Popover>
                                </div>

                                <div className="relative">
                                    <button
                                        data-testid="synapse-quality-menu"
                                        onClick={() => setMenu(menu === "settings" ? null : "settings")}
                                        className="text-white/90 hover:text-white active:scale-95 transition"
                                        title="Settings / quality"
                                        aria-label="Settings"
                                    >
                                        <Settings className="w-8 h-8 md:w-9 md:h-9 fill-white stroke-[2]" />
                                    </button>
                                    <Popover open={menu === "settings"}>
                                        <div className="px-3 py-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45"><Settings className="w-3.5 h-3.5" /> Quality</div>
                                        <MenuItem active={level === -1} onClick={() => changeLevel(-1)} testId="quality-auto">Auto <span className="text-xs opacity-60">Adaptive</span></MenuItem>
                                        {qualityChoices.map((choice) => (
                                            <MenuItem
                                                key={choice.height}
                                                active={activeQualityHeight === choice.height}
                                                disabled={!choice.available}
                                                onClick={() => chooseQuality(choice)}
                                                testId={`quality-${choice.height}`}
                                            >
                                                <span>{choice.label}</span>
                                                <span className="text-[10px] opacity-45">{choice.available ? (choice.levelIndex >= 0 ? "HLS" : choice.server?.name) : "Unavailable"}</span>
                                            </MenuItem>
                                        ))}}

                                        <div className="h-px bg-white/10 my-2" />
                                        <div className="px-3 py-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45"><Gauge className="w-3.5 h-3.5" /> Playback speed</div>
                                        {SPEEDS.map((r) => (
                                            <MenuItem key={r} active={rate === r} onClick={() => changeRate(r)}>{r === 1 ? "Normal" : `${r}x`}</MenuItem>
                                        ))}

                                        {servers.length > 1 && (
                                            <>
                                                <div className="h-px bg-white/10 my-2" />
                                                <div className="px-3 py-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45"><ServerCog className="w-3.5 h-3.5" /> Source</div>
                                                {servers.map((s) => (
                                                    <MenuItem key={s.id} active={serverId === s.id} onClick={() => selectServer(s)}>{s.name}{s.primary ? " · Primary" : ""}</MenuItem>
                                                ))}
                                            </>
                                        )}

                                        <div className="h-px bg-white/10 my-2" />
                                        <button onClick={() => { setMenu(null); setHelp(true); }} className="w-full px-3 py-2 rounded-lg text-sm text-left text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-2">
                                            <Keyboard className="w-4 h-4" /> Keyboard shortcuts
                                        </button>
                                    </Popover>
                                </div>

                                <button onClick={togglePip} className="hidden sm:block text-white/90 hover:text-white active:scale-95 transition" title="Picture in Picture" aria-label="Picture in Picture">
                                    <PictureInPicture2 className="w-8 h-8 md:w-9 md:h-9 stroke-[2]" />
                                </button>

                                <button data-testid="synapse-fullscreen-btn" onClick={toggleFs} className="text-white/90 hover:text-white active:scale-95 transition" title="Fullscreen (F)" aria-label="Fullscreen">
                                    {fs ? <Minimize className="w-8 h-8 md:w-10 md:h-10 stroke-[1.8]" /> : <Maximize className="w-8 h-8 md:w-10 md:h-10 stroke-[1.8]" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {help && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setHelp(false)}>
                    <div className="bg-black/75 backdrop-blur-2xl border border-white/15 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-xl">Keyboard shortcuts</h3>
                            <button onClick={() => setHelp(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {SHORTCUTS.map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-sm">
                                    <span className="text-white/55">{v}</span>
                                    <kbd className="font-mono text-xs bg-white/10 border border-white/10 rounded px-2 py-1">{k}</kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
