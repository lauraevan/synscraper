import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward,
    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,
    X, ShieldCheck, AlertTriangle, Cloud, ChevronRight, ArrowLeft,
    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette,
} from "lucide-react";
import { getStreams, hlsProxyUrl } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { saveProgress, getProgress } from "@/lib/storage";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SOURCE_CATALOG = [
    { provider: "vidy", name: "Miami" },
    { provider: "castle", name: "Houston" },
    { provider: "vidlink", name: "Nova" },
    { provider: "vidnest", name: "Nest" },
    { provider: "vidzee", name: "Zen" },
    { provider: "vidrock", name: "Rock" },
    { provider: "cinejoy", name: "Lisbon" },
    { provider: "vixsrc", name: "Vix" },
];
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
const readPreferredQuality = () => {
    if (typeof window === "undefined") return 1080;
    const saved = window.localStorage.getItem("synscraper-quality-v1");
    if (saved === "auto") return null;
    const parsed = Number(saved);
    return [2160, 1440, 1080, 720, 480, 360, 240, 144].includes(parsed) ? parsed : 1080;
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

const DEFAULT_CAPTION_STYLE = {
    size: 100,
    color: "#ffffff",
    transparency: 0,
    background: 45,
    weight: 600,
    delay: 0,
    accuracy: 85,
    autoCorrect: true,
    position: 80,
    outline: 2,
};

const normalizeCaptionText = (value) => String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

const autoCorrectCaptionText = (value, accuracy = 85) => {
    const strength = Number(accuracy) || 0;
    let text = normalizeCaptionText(value);
    if (strength >= 20) {
        text = text.replace(/\s+([,.!?;:])/g, "$1").replace(/([,.!?;:])([A-Za-z])/g, "$1 $2");
    }
    if (strength >= 45) {
        text = text.replace(/([!?.,])\1{2,}/g, "$1$1");
    }
    if (strength >= 65) {
        text = text.replace(/\b([A-Za-z][A-Za-z']{1,})\s+\1\b/gi, "$1");
    }
    if (strength >= 80) {
        text = text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (m, lead, ch) => `${lead}${ch.toUpperCase()}`);
        text = text.replace(/\bi\b/g, "I");
    }
    return text;
};


const parseVttTime = (value) => {
    const parts = String(value || "").trim().replace(",", ".").split(":");
    let seconds = 0;
    for (const part of parts) {
        const n = Number(part);
        if (!Number.isFinite(n)) return NaN;
        seconds = (seconds * 60) + n;
    }
    return seconds;
};

const parseWebVtt = (value) => {
    const blocks = String(value || "").replace(/\r/g, "").split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex < 0) continue;
        const [rawStart, rawEndAndSettings] = lines[timingIndex].split("-->");
        const rawEnd = String(rawEndAndSettings || "").trim().split(/\s+/)[0];
        const start = parseVttTime(rawStart);
        const end = parseVttTime(rawEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
        const text = normalizeCaptionText(lines.slice(timingIndex + 1).join("\n"));
        if (text) cues.push({ start, end, text });
    }
    return cues;
};

const CaptionSlider = ({ label, value, min, max, step = 1, suffix = "", onChange }) => (
    <label className="block px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="text-white/70">{label}</span>
            <span className="tabular-nums text-white/45">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
        />
    </label>
);

const Popover = ({ open, children, wide = false }) =>
    open ? (
        <div className={`absolute bottom-14 right-0 overflow-y-auto scrollbar-none rounded-2xl bg-black/88 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl z-30 ${wide ? "w-[370px] max-w-[calc(100vw-2rem)] max-h-[min(72vh,590px)]" : "min-w-[220px] max-h-80"}`}>
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

const SettingsRow = ({ icon: Icon, label, value, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-[16px] px-5 py-[13px] text-left transition-colors hover:bg-white/[0.045] md:px-6 md:py-[15px]"
    >
        <Icon className="h-6 w-6 shrink-0 text-white/78 md:h-[27px] md:w-[27px]" strokeWidth={1.55} />
        <span className="min-w-0 flex-1 text-[15px] font-normal tracking-[-0.015em] text-white/95 md:text-[18px]">{label}</span>
        <span className="max-w-[42%] truncate text-right text-[14px] font-normal text-white/62 md:text-[17px]">{value}</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/48" strokeWidth={1.55} />
    </button>
);

export const SynapsePlayer = ({ mediaType, id, meta = {}, season, episode, onNextEpisode, hasNext, onBack }) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const hlsRetryRef = useRef({ serverId: null, network: 0, media: 0 });
    const hideTimer = useRef(null);
    const pendingSeekRef = useRef(null);
    const autoCaptionRef = useRef(false);
    const autoPlayRef = useRef(true);
    const audioContextRef = useRef(null);
    const audioSourceRef = useRef(null);
    const gainRef = useRef(null);
    const preferredQualityRef = useRef(1080);

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
    const [preferredQuality, setPreferredQuality] = useState(readPreferredQuality);
    const [sourcesLoading, setSourcesLoading] = useState(false);
    const [subs, setSubs] = useState([]);
    const [sub, setSub] = useState(-1);
    const [rate, setRate] = useState(1);
    const [fs, setFs] = useState(false);
    const [buffering, setBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [menu, setMenu] = useState(null);
    const [settingsPage, setSettingsPage] = useState("root");
    const [autoPlay, setAutoPlay] = useState(true);
    const [volumeBoost, setVolumeBoost] = useState(100);
    const [spatialAudio, setSpatialAudio] = useState(false);
    const [videoScale, setVideoScale] = useState(100);
    const [upscaler, setUpscaler] = useState(false);
    const [help, setHelp] = useState(false);
    const [ripple, setRipple] = useState(null);
    const [scrubPct, setScrubPct] = useState(null);
    const [captionText, setCaptionText] = useState("");
    const [externalCaptionId, setExternalCaptionId] = useState(null);
    const [externalCues, setExternalCues] = useState([]);
    const [externalCaptionLoading, setExternalCaptionLoading] = useState(false);
    const [externalCaptionError, setExternalCaptionError] = useState("");
    const [captionStyle, setCaptionStyle] = useState(() => {
        if (typeof window === "undefined") return DEFAULT_CAPTION_STYLE;
        try {
            const saved = JSON.parse(window.localStorage.getItem("synapse-caption-style-v1") || "null");
            return { ...DEFAULT_CAPTION_STYLE, ...(saved || {}) };
        } catch {
            return DEFAULT_CAPTION_STYLE;
        }
    });

    const activeServer = servers.find((s) => s.id === serverId);
    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
    useEffect(() => {
        preferredQualityRef.current = preferredQuality;
        if (typeof window !== "undefined") {
            window.localStorage.setItem("synscraper-quality-v1", preferredQuality == null ? "auto" : String(preferredQuality));
        }
    }, [preferredQuality]);

    const playServer = useCallback((server) => {
        const video = videoRef.current;
        if (!video || !server) return;
        setBuffering(true);
        hlsRetryRef.current = { serverId: server.id, network: 0, media: 0 };
        setLevels([]); setLevel(-1); setSubs([]); setSub(-1);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const url = hlsProxyUrl(server.play_url);
        if (server.type === "hls" && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                startFragPrefetch: true,
                maxBufferLength: 45,
                maxMaxBufferLength: 90,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 350,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                levelLoadingRetryDelay: 350,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 4,
                fragLoadingRetryDelay: 350,
            });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                const parsedLevels = hls.levels || [];
                setLevels(parsedLevels);
                const wantedQuality = preferredQualityRef.current;
                if (wantedQuality) {
                    const wantedIndex = parsedLevels.findIndex((item) => Number(item.height || 0) === wantedQuality);
                    if (wantedIndex >= 0) {
                        hls.currentLevel = wantedIndex;
                        hls.nextLevel = wantedIndex;
                        setLevel(wantedIndex);
                    }
                }
                const resumeAt = pendingSeekRef.current;
                if (resumeAt != null && resumeAt > 0) {
                    if (typeof video.fastSeek === "function") video.fastSeek(resumeAt);
                    else video.currentTime = resumeAt;
                    pendingSeekRef.current = null;
                }
                if (autoPlayRef.current) video.play().catch(() => {});
            });
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => {
                const tracks = d.subtitleTracks || [];
                setSubs(tracks);
                if (autoCaptionRef.current && tracks.length) {
                    const preferred = tracks.findIndex((track) => /(^|[-_])en($|[-_])/i.test(track.lang || track.language || "") || /english/i.test(track.name || ""));
                    const index = preferred >= 0 ? preferred : 0;
                    hls.subtitleTrack = index;
                    setSub(index);
                    autoCaptionRef.current = false;
                }
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
                setLevel(preferredQualityRef.current == null && hls.autoLevelEnabled ? -1 : d.level);
            });
            hls.on(Hls.Events.ERROR, (_e, data) => {
                if (!data.fatal) return;
                const retries = hlsRetryRef.current;
                if (retries.serverId !== server.id) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries.network < 2) {
                    retries.network += 1;
                    const delay = 300 * retries.network;
                    window.setTimeout(() => {
                        if (hlsRef.current !== hls) return;
                        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                            hls.loadSource(url);
                        } else {
                            hls.startLoad();
                        }
                    }, delay);
                    return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries.media < 1) {
                    retries.media += 1;
                    hls.recoverMediaError();
                    return;
                }
                tryNext(server.id);
            });
        } else {
            const resumeAt = pendingSeekRef.current;
            const restore = () => {
                if (resumeAt != null && resumeAt > 0) video.currentTime = resumeAt;
                pendingSeekRef.current = null;
                video.removeEventListener("loadedmetadata", restore);
            };
            if (resumeAt != null) video.addEventListener("loadedmetadata", restore);
            video.src = url;
            if (autoPlayRef.current) video.play().catch(() => {});
        }
    }, [servers]); // eslint-disable-line

    const tryNext = useCallback((failedId) => {
        const idx = servers.findIndex((s) => s.id === failedId);
        const next = servers[idx + 1];
        if (next) {
            pendingSeekRef.current = videoRef.current?.currentTime || 0;
            setServerId(next.id);
        }
        else setError("All scraped servers failed to play. Try another title.");
    }, [servers]);

    // Progressive source loading: start Miami immediately, fill the rest in the background.
    useEffect(() => {
        let alive = true;
        let started = false;
        setMode("loading"); setStepIdx(0); setError(null); setServers([]);
        setSourcesLoading(true);
        setExternalCaptionId(null); setExternalCues([]); setExternalCaptionError("");
        const tick = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 700);

        const mergeServers = (current, incoming) => {
            const map = new Map();
            for (const item of current || []) map.set(`${item.provider}|${item.name}|${item.quality}`, item);
            for (const item of incoming || []) {
                const key = `${item.provider}|${item.name}|${item.quality}`;
                if (!map.has(key)) map.set(key, item);
            }
            return Array.from(map.values());
        };
        const activate = (list) => {
            if (!alive || started || !list.length) return;
            const wanted = preferredQualityRef.current || 1080;
            const preferred = list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === wanted)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === 1080)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")))
                || list[0];
            started = true;
            clearInterval(tick);
            setServerId(preferred.id);
            setMode("ready");
        };

        const quick = getStreams(mediaType, id, season, episode, { provider: "vidy", mirror: "miami", timeout: 12000 })
            .then((d) => {
                if (!alive) return;
                const list = d.servers || [];
                if (list.length) {
                    setServers((current) => mergeServers(current, list));
                    activate(list);
                }
            })
            .catch(() => {});

        const full = getStreams(mediaType, id, season, episode, { timeout: 90000 })
            .then((d) => {
                if (!alive) return;
                const list = d.servers || [];
                if (list.length) {
                    setServers((current) => mergeServers(current, list));
                    activate(list);
                }
                setSourcesLoading(false);
            })
            .catch(() => { if (alive) setSourcesLoading(false); });

        Promise.allSettled([quick, full]).then(() => {
            if (!alive) return;
            clearInterval(tick);
            if (!started) {
                setMode("error");
                setError("No streams could be scraped for this title yet.");
            }
        });

        return () => { alive = false; clearInterval(tick); };
    }, [mediaType, id, season, episode]);

    // when ready + server chosen, start playback
    useEffect(() => {
        if (mode === "ready" && activeServer && videoRef.current) playServer(activeServer);
        // eslint-disable-next-line
    }, [mode, serverId]);

    const selectServer = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        const wanted = preferredQualityRef.current;
        const matching = wanted ? servers.find((candidate) =>
            candidate.provider === s.provider && candidate.name === s.name && qualityHeight(candidate.quality) === wanted
        ) : null;
        setMenu(null); setServerId((matching || s).id);
    };
    const selectCaptionSource = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        autoCaptionRef.current = true;
        setSub(-1);
        setMenu(null);
        setServerId(s.id);
    };

    const selectExternalCaption = async (caption) => {
        if (!caption?.play_url) return;
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionId(caption.id);
        setExternalCues([]);
        setExternalCaptionError("");
        setExternalCaptionLoading(true);
        try {
            const response = await fetch(hlsProxyUrl(caption.play_url));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const cues = parseWebVtt(await response.text());
            if (!cues.length) throw new Error("No WebVTT cues found");
            setExternalCues(cues);
        } catch (err) {
            setExternalCaptionId(null);
            setExternalCaptionError(err?.message || "Could not load this VTT track");
        } finally {
            setExternalCaptionLoading(false);
        }
    };

    const turnOffCaptions = () => {
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionId(null);
        setExternalCues([]);
        setCaptionText("");
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
    useEffect(() => () => {
        if (hlsRef.current) hlsRef.current.destroy();
        if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("synapse-caption-style-v1", JSON.stringify(captionStyle));
    }, [captionStyle]);

    useEffect(() => {
        if (mode !== "ready" || sub < 0) {
            setCaptionText("");
            return undefined;
        }
        const updateCaption = () => {
            const video = videoRef.current;
            if (!video) return;
            const wanted = subs[sub] || {};
            const adjustedTime = video.currentTime - Number(captionStyle.delay || 0);
            const candidates = Array.from(video.textTracks || []);
            let track = candidates.find((candidate) => {
                const labelMatch = wanted.name && candidate.label && wanted.name.toLowerCase() === candidate.label.toLowerCase();
                const lang = wanted.lang || wanted.language;
                const langMatch = lang && candidate.language && String(lang).toLowerCase() === candidate.language.toLowerCase();
                return labelMatch || langMatch;
            });
            if (!track) track = candidates.find((candidate) => candidate.mode !== "disabled") || candidates[candidates.length - 1];
            if (!track || !track.cues) {
                setCaptionText("");
                return;
            }
            const matching = Array.from(track.cues).filter((cue) => cue.startTime <= adjustedTime && cue.endTime >= adjustedTime);
            let text = matching.map((cue) => cue.text).filter(Boolean).join("\n");
            if (!text && Number(captionStyle.accuracy) >= 60) {
                const tolerance = Math.min(0.4, Number(captionStyle.accuracy) / 250);
                const nearby = Array.from(track.cues).find((cue) => adjustedTime >= cue.startTime - tolerance && adjustedTime <= cue.endTime + tolerance);
                text = nearby?.text || "";
            }
            const next = captionStyle.autoCorrect
                ? autoCorrectCaptionText(text, captionStyle.accuracy)
                : normalizeCaptionText(text);
            setCaptionText((old) => old === next ? old : next);
        };
        updateCaption();
        const timer = window.setInterval(updateCaption, 80);
        return () => window.clearInterval(timer);
    }, [mode, sub, subs, serverId, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);

    const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
    useEffect(() => {
        if (!externalCaptionId || !externalCues.length) return;
        const adjustedTime = current - Number(captionStyle.delay || 0);
        const raw = externalCues
            .filter((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end)
            .map((cue) => cue.text)
            .join("\n");
        setCaptionText(captionStyle.autoCorrect ? autoCorrectCaptionText(raw, captionStyle.accuracy) : normalizeCaptionText(raw));
    }, [externalCaptionId, externalCues, current, captionStyle.delay, captionStyle.autoCorrect, captionStyle.accuracy]);

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
    const changeLevel = (i) => { if (hlsRef.current) { hlsRef.current.currentLevel = i; hlsRef.current.nextLevel = i; } setLevel(i); };
    const chooseAutoQuality = () => {
        setPreferredQuality(null);
        preferredQualityRef.current = null;
        if (autoServer && autoServer.id !== serverId) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(autoServer.id);
        } else if (hlsRef.current) {
            hlsRef.current.currentLevel = -1;
            hlsRef.current.nextLevel = -1;
            setLevel(-1);
        }
        setMenu(null);
    };
    const chooseQuality = (choice) => {
        if (!choice?.available) return;
        setPreferredQuality(choice.height);
        preferredQualityRef.current = choice.height;
        const sameMirror = servers.find((candidate) =>
            candidate.provider === activeServer?.provider && candidate.name === activeServer?.name && qualityHeight(candidate.quality) === choice.height
        );
        if (sameMirror && sameMirror.id !== serverId) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(sameMirror.id);
            setMenu(null);
            return;
        }
        if (choice.levelIndex >= 0 && hlsRef.current) {
            changeLevel(choice.levelIndex);
            setMenu(null);
            return;
        }
        if (choice.server) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(choice.server.id);
        }
        setMenu(null);
    };
    const changeSub = (i) => {
        if (hlsRef.current) hlsRef.current.subtitleTrack = i;
        setSub(i);
        if (i < 0) setCaptionText("");
    };
    const updateCaptionStyle = (key, value) => setCaptionStyle((prev) => ({ ...prev, [key]: value }));
    const resetCaptionStyle = () => setCaptionStyle(DEFAULT_CAPTION_STYLE);
    const changeRate = (r) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };
    const closeSettings = () => { setMenu(null); setSettingsPage("root"); };
    const selectServerInSettings = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        const wanted = preferredQualityRef.current;
        const matching = wanted ? servers.find((candidate) =>
            candidate.provider === s.provider && candidate.name === s.name && qualityHeight(candidate.quality) === wanted
        ) : null;
        setServerId((matching || s).id);
        setSettingsPage("root");
    };
    const changeRateInSettings = (r) => {
        const v = videoRef.current;
        if (v) v.playbackRate = r;
        setRate(r);
        setSettingsPage("root");
    };
    const selectCaptionSourceInSettings = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        autoCaptionRef.current = true;
        setExternalCaptionId(null);
        setExternalCues([]);
        setSub(-1);
        setServerId(s.id);
    };
    const chooseAutoQualityInSettings = () => { chooseAutoQuality(); setSettingsPage("root"); };
    const chooseQualityInSettings = (choice) => { chooseQuality(choice); setSettingsPage("root"); };
    const setVolumeBoostValue = async (value) => {
        const next = Math.max(100, Math.min(200, Number(value) || 100));
        setVolumeBoost(next);
        const video = videoRef.current;
        if (!video || typeof window === "undefined") return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
            const ctx = audioContextRef.current;
            if (!audioSourceRef.current) {
                audioSourceRef.current = ctx.createMediaElementSource(video);
                gainRef.current = ctx.createGain();
                audioSourceRef.current.connect(gainRef.current);
                gainRef.current.connect(ctx.destination);
            }
            if (ctx.state === "suspended") await ctx.resume();
            gainRef.current.gain.setTargetAtTime(next / 100, ctx.currentTime, 0.015);
        } catch {
            // Browser/stream may not allow WebAudio routing; normal audio remains usable.
        }
    };

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
    const sourceSlots = SOURCE_CATALOG.flatMap((source) => {
        const matches = servers.filter((s) => s.provider === source.provider);
        if (!matches.length) {
            if (source.provider === "vidy" || source.provider === "cinejoy") return [];
            return [{ id: `unavailable-${source.provider}`, provider: source.provider, name: source.name, displayName: source.name, available: false }];
        }
        const mirrors = new Map();
        for (const server of matches) {
            const mirrorName = server.name || source.name;
            const existing = mirrors.get(mirrorName);
            const sourceScore = (candidate) => {
                if (/^auto/i.test(String(candidate?.quality || ""))) return 100000;
                const height = qualityHeight(candidate?.quality);
                if (source.provider === "vidy" && height === 1080) return 90000;
                return height;
            };
            const score = sourceScore(server);
            const existingScore = existing ? sourceScore(existing) : -1;
            if (!existing || score > existingScore) mirrors.set(mirrorName, server);
        }
        const mirrorValues = Array.from(mirrors.values());
        if (source.provider === "vidy") {
            mirrorValues.sort((a, b) => {
                const am = /miami/i.test(String(a.name || "")) ? 0 : 1;
                const bm = /miami/i.test(String(b.name || "")) ? 0 : 1;
                return am - bm || String(a.name || "").localeCompare(String(b.name || ""));
            });
        }
        return mirrorValues.map((server) => ({
            ...server,
            displayName: server.name || source.name,
            available: true,
        }));
    });
    const captionSources = sourceSlots.filter((s) => s.available);
    const externalCaptions = Array.from(new Map(
        servers.flatMap((s) => (s.captions || []).map((c) => [c.play_url || c.id, { ...c, serverName: s.name }]))
    ).values());
    const activeQualityHeight = preferredQuality || (level >= 0 ? Number(levels[level]?.height || 0) : (levels.length ? 0 : qualityHeight(activeServer?.quality)));
    const autoServer = servers.find((s) => s.provider === activeServer?.provider && s.name === activeServer?.name && /^auto/i.test(String(s.quality || "")))
        || servers.find((s) => s.provider === activeServer?.provider && /^auto/i.test(String(s.quality || "")))
        || servers.find((s) => /^auto/i.test(String(s.quality || "")));
    const autoQualityAvailable = levels.length > 0 || !!autoServer;
    const qualityChoices = QUALITY_LADDER.map((target) => {
        const levelIndex = levels.findIndex((l) => Number(l.height || 0) === target.height);
        const sameMirror = servers.find((s) => s.provider === activeServer?.provider && s.name === activeServer?.name && qualityHeight(s.quality) === target.height);
        const sameProvider = servers.find((s) => s.provider === activeServer?.provider && qualityHeight(s.quality) === target.height);
        const server = sameMirror || sameProvider || servers.find((s) => qualityHeight(s.quality) === target.height);
        return { ...target, levelIndex, server, available: levelIndex >= 0 || !!server };
    });
    const releaseDate = meta.release_date || meta.first_air_date || "";
    const year = releaseDate ? String(releaseDate).slice(0, 4) : "";
    const displayTitle = `${meta.title || "Untitled"}${year ? ` (${year})` : ""}`;
    const resolvePct = ((stepIdx + 1) / STEPS.length) * 100;
    const activeExternalCaption = externalCaptions.find((track) => track.id === externalCaptionId);
    const subtitleSettingsLabel = activeExternalCaption ? (String(activeExternalCaption.source || "").toLowerCase() === "granite" ? "Granite" : "VTT") : sub >= 0 ? "HLS" : "Off";
    const settingsQualityLabel = preferredQuality ? (preferredQuality === 2160 ? "4K" : `${preferredQuality}p`) : "Auto";

    return (
        <div
            ref={containerRef}
            data-testid="synapse-player-container"
            onMouseMove={wake}
            onTouchStart={wake}
            onClick={() => menu && setMenu(null)}
            className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden border border-white/[0.08] select-none text-white shadow-[0_20px_65px_rgba(0,0,0,0.38)]"
        >
            <video
                ref={videoRef}
                data-testid="synapse-video-element"
                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover transition-[transform,filter] duration-200"
                style={{ transform: `scale(${videoScale / 100})`, filter: upscaler ? "contrast(1.045) saturate(1.025)" : undefined }}
                onClick={(e) => { e.stopPropagation(); togglePlay(); wake(); }}
                onDoubleClick={toggleFs}
                poster={meta.backdrop_path ? `https://image.tmdb.org/t/p/original${meta.backdrop_path}` : undefined}
                playsInline
                crossOrigin="anonymous"
            />
            <style>{`.synapse-video::cue { color: transparent !important; background: transparent !important; text-shadow: none !important; }`}</style>

            {mode === "ready" && (sub >= 0 || externalCaptionId) && captionText && (
                <div
                    data-testid="synapse-custom-captions"
                    className="absolute left-1/2 z-[19] max-w-[88%] -translate-x-1/2 whitespace-pre-line text-center leading-[1.24] pointer-events-none transition-[bottom,font-size] duration-150"
                    style={{
                        bottom: `${100 - captionStyle.position}%`,
                        fontSize: `clamp(14px, ${1.75 * (captionStyle.size / 100)}vw, ${34 * (captionStyle.size / 100)}px)`,
                        color: captionStyle.color,
                        opacity: Math.max(0.1, (100 - captionStyle.transparency) / 100),
                        fontWeight: captionStyle.weight,
                        WebkitTextStroke: `${captionStyle.outline}px rgba(0,0,0,0.92)`,
                        paintOrder: "stroke fill",
                    }}
                >
                    <span
                        className="inline box-decoration-clone rounded-md px-2.5 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.28)]"
                        style={{ backgroundColor: `rgba(0,0,0,${captionStyle.background / 100})` }}
                    >
                        {captionText}
                    </span>
                </div>
            )}

            {mode === "ready" && showControls && (
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.24),rgba(0,0,0,0.02)_34%,rgba(0,0,0,0.05)_60%,rgba(0,0,0,0.64)_100%)] z-10" />
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
                        <div className="absolute left-5 top-5 md:left-7 md:top-7">
                            <button
                                data-testid="synapse-source-cloud-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenu(menu === "sources" ? null : "sources");
                                }}
                                className={`grid h-11 w-11 md:h-12 md:w-12 place-items-center transition-all duration-200 active:scale-95 ${menu === "sources" ? "text-white scale-105" : "text-white/85 hover:text-white hover:scale-105"}`}
                                aria-label="Choose source"
                                title="Sources"
                            >
                                <Cloud className="h-7 w-7 md:h-8 md:w-8 stroke-[1.55]" />
                            </button>

                            {menu === "sources" && (
                                <div
                                    data-testid="synapse-source-popout"
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute left-0 top-[3.2rem] md:top-[3.45rem] z-40 w-[244px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/86 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
                                >
                                    <div className="px-3 pb-2 pt-2.5">
                                        <p className="text-sm font-semibold text-white">Sources</p>
                                        <p className="mt-0.5 text-[11px] text-white/40">Switch without losing your place</p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto scrollbar-none">
                                        {sourceSlots.map((s) => (
                                            <button
                                                key={s.id}
                                                disabled={!s.available}
                                                onClick={() => s.available && selectServer(s)}
                                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${serverId === s.id ? "bg-white text-black" : s.available ? "text-white/80 hover:bg-white/10 hover:text-white" : "cursor-not-allowed text-white/28"}`}
                                            >
                                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.displayName || s.name}</span>
                                                {!s.available && <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/28">Unavailable</span>}
                                                <img
                                                    src="https://flagsapi.com/US/flat/24.png"
                                                    alt="US"
                                                    className={`h-4 w-6 shrink-0 rounded-[2px] object-cover ${s.available ? "opacity-100" : "opacity-25"}`}
                                                    loading="lazy"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    {sourcesLoading && (
                                        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-white/35">Loading more sources…</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="absolute left-1/2 top-5 md:top-6 -translate-x-1/2 text-center max-w-[60%] pointer-events-none">
                            <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.18em] text-white/38 leading-none">You're Watching</p>
                            <p className="mt-1.5 text-sm md:text-lg font-medium tracking-[-0.02em] text-white/92 truncate">{displayTitle}</p>
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
                        className={`absolute bottom-0 left-0 right-0 z-30 px-5 md:px-8 pb-5 md:pb-7 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    >
                        <div className="group/seek relative mb-5 md:mb-6 h-4 flex items-center">
                            <div className="absolute left-0 right-0 h-[4px] rounded-full bg-white/20 overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-white/22" style={{ width: `${bufPct}%` }} />
                                <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${seekPct}%` }} />
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
                            <div className="absolute w-3.5 h-3.5 rounded-full bg-white -translate-x-1/2 pointer-events-none shadow-[0_1px_6px_rgba(0,0,0,0.35)]" style={{ left: `${seekPct}%` }} />
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="flex min-w-[118px] items-center gap-2 md:min-w-[168px] md:gap-3">
                                <button data-testid="synapse-mute-btn" onClick={toggleMute} className="grid h-9 w-9 shrink-0 place-items-center text-white/90 hover:text-white hover:scale-105 active:scale-95 transition" aria-label="Mute">
                                    {muted || volume === 0 ? <VolumeX className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" /> : <Volume2 className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" />}
                                </button>
                                <input
                                    data-testid="synapse-volume-slider"
                                    type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume}
                                    onChange={(e) => setVol(parseFloat(e.target.value))}
                                    className="h-1.5 w-16 min-w-0 cursor-pointer accent-white md:w-24"
                                    aria-label="Volume"
                                />
                            </div>

                            <span data-testid="synapse-time" className="text-sm md:text-lg font-medium tabular-nums text-white/95 whitespace-nowrap">
                                {fmtTime(current)} <span className="text-white/65 px-1">/</span> {fmtTime(duration)}
                            </span>

                            <div className="ml-auto flex items-center gap-1 md:gap-1.5">
                                {hasNext && (
                                    <button data-testid="synapse-next-episode-btn" onClick={onNextEpisode} className="hidden sm:grid h-10 w-10 md:h-11 md:w-11 place-items-center text-white/85 hover:text-white hover:scale-105 active:scale-95 transition" title="Next episode (N)">
                                        <SkipForward className="h-[21px] w-[21px] stroke-[1.9]" />
                                    </button>
                                )}

                                <div className="relative">
                                    <button
                                        data-testid="synapse-subtitles-menu"
                                        onClick={() => setMenu(menu === "subs" ? null : "subs")}
                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center transition active:scale-95 hover:scale-105 ${sub >= 0 || externalCaptionId ? "text-white" : "text-white/85 hover:text-white"}`}
                                        title="Captions (C)"
                                        aria-label="Captions"
                                    >
                                        <Subtitles className="h-[25px] w-[25px] stroke-[1.8]" />
                                    </button>
                                    <Popover open={menu === "subs"} wide>
                                        <div className="px-4 pb-3 pt-2">
                                            <p className="text-sm font-semibold text-white">Captions</p>
                                            <p className="mt-1 text-[11px] text-white/40">Pick a track first. Styling stays simple and live.</p>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto border-y border-white/10 py-1 scrollbar-none">
                                            <MenuItem active={sub === -1 && !externalCaptionId} onClick={turnOffCaptions} testId="sub-off">
                                                <span>Off</span><span className="text-[10px] opacity-40">No captions</span>
                                            </MenuItem>
                                            {externalCaptions.map((track) => (
                                                <MenuItem key={`caption-${track.play_url || track.id}`} active={externalCaptionId === track.id} onClick={() => selectExternalCaption(track)}>
                                                    <span className="min-w-0 truncate">{track.name || track.lang || "WebVTT"}</span>
                                                    <span className="ml-3 text-[10px] uppercase opacity-40">{track.lang || "CC"} · {track.serverName || "VTT"}</span>
                                                </MenuItem>
                                            ))}
                                            {subs.map((track, i) => (
                                                <MenuItem key={`hls-caption-${i}`} active={sub === i && !externalCaptionId} onClick={() => { setExternalCaptionId(null); setExternalCues([]); changeSub(i); }}>
                                                    <span className="min-w-0 truncate">{track.name || track.lang || `Track ${i + 1}`}</span>
                                                    <span className="ml-3 text-[10px] uppercase opacity-40">{track.lang || track.language || "CC"} · HLS</span>
                                                </MenuItem>
                                            ))}
                                            {!subs.length && !externalCaptions.length && (
                                                <p className="px-3 py-4 text-xs text-white/40">No caption tracks are available yet. More may appear as sources finish loading.</p>
                                            )}
                                        </div>
                                        {externalCaptionLoading && <p className="px-3 py-2 text-[11px] text-white/40">Loading captions…</p>}
                                        {externalCaptionError && <p className="px-3 py-2 text-[11px] text-red-300/75">{externalCaptionError}</p>}
                                        <div className="flex items-center justify-between px-3 pb-1 pt-3">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Appearance</p>
                                            <button onClick={resetCaptionStyle} className="text-[11px] text-white/45 hover:text-white">Reset</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 px-3 py-2">
                                            {[80, 100, 125].map((size) => (
                                                <button key={size} onClick={() => updateCaptionStyle("size", size)} className={`rounded-lg px-2 py-2 text-xs ${captionStyle.size === size ? "bg-white text-black" : "bg-white/[0.05] text-white/60 hover:text-white"}`}>{size === 80 ? "Small" : size === 100 ? "Medium" : "Large"}</button>
                                            ))}
                                        </div>
                                        <CaptionSlider label="Background" value={captionStyle.background} min={0} max={80} step={10} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                        <CaptionSlider label="Sync" value={captionStyle.delay} min={-3} max={3} step={0.1} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                                            {["#ffffff", "#ffe66d", "#77e0ff", "#9cff8f"].map((color) => (
                                                <button key={color} onClick={() => updateCaptionStyle("color", color)} className={`h-7 w-7 rounded-full border-2 ${captionStyle.color.toLowerCase() === color ? "border-white" : "border-white/15"}`} style={{ backgroundColor: color }} aria-label={`Caption color ${color}`} />
                                            ))}
                                        </div>
                                    </Popover>
                                </div>

                                <div className="relative">
                                    <button
                                        data-testid="synapse-quality-menu"
                                        onClick={() => setMenu(menu === "quality" ? null : "quality")}
                                        className={`h-10 min-w-[52px] px-1 text-xs font-semibold tracking-[-0.02em] transition hover:scale-105 active:scale-95 ${menu === "quality" ? "text-white" : "text-white/85 hover:text-white"}`}
                                        title="Quality"
                                        aria-label="Quality"
                                    >
                                        {settingsQualityLabel}
                                    </button>
                                    <Popover open={menu === "quality"}>
                                        <div className="px-3 pb-2 pt-1 text-xs font-semibold text-white/70">Quality</div>
                                        <MenuItem active={preferredQuality == null} onClick={chooseAutoQuality} disabled={!autoQualityAvailable}>
                                            <span>Auto</span><span className="text-[10px] opacity-40">Adaptive</span>
                                        </MenuItem>
                                        {qualityChoices.filter((choice) => choice.available).map((choice) => (
                                            <MenuItem key={`quick-quality-${choice.height}`} active={preferredQuality === choice.height} onClick={() => chooseQuality(choice)}>
                                                <span>{choice.label}</span><span className="text-[10px] opacity-40">{choice.levelIndex >= 0 ? "HLS" : choice.server?.name || "Stream"}</span>
                                            </MenuItem>
                                        ))}
                                    </Popover>
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => { setSettingsPage("root"); setMenu(menu === "settings" ? null : "settings"); }}
                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center transition active:scale-95 hover:scale-105 ${menu === "settings" ? "text-white" : "text-white/85 hover:text-white"}`}
                                        title="Settings"
                                        aria-label="Settings"
                                    >
                                        <Settings className="h-[25px] w-[25px] stroke-[1.8]" />
                                    </button>
                                </div>

                                <button onClick={togglePip} className="hidden sm:grid h-10 w-10 md:h-11 md:w-11 place-items-center text-white/85 hover:text-white hover:scale-105 active:scale-95 transition" title="Picture in Picture" aria-label="Picture in Picture">
                                    <PictureInPicture2 className="h-[24px] w-[24px] stroke-[1.8]" />
                                </button>

                                <button data-testid="synapse-fullscreen-btn" onClick={toggleFs} className="grid h-10 w-10 md:h-11 md:w-11 place-items-center text-white/85 hover:text-white hover:scale-105 active:scale-95 transition" title="Fullscreen (F)" aria-label="Fullscreen">
                                    {fs ? <Minimize className="h-[26px] w-[26px] stroke-[1.8]" /> : <Maximize className="h-[26px] w-[26px] stroke-[1.8]" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}


            {menu === "settings" && mode === "ready" && (
                <div
                    data-testid="synapse-settings-overlay"
                    className="absolute inset-0 z-[70] flex items-center justify-center bg-black/16 p-3 md:p-6"
                    onClick={closeSettings}
                >
                    <div
                        data-testid="synapse-settings-panel"
                        className="flex max-h-[89%] w-[660px] max-w-[94vw] flex-col overflow-hidden rounded-[29px] border border-white/[0.11] bg-[#071019]/[0.94] shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-[30px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex min-h-[72px] items-center border-b border-white/[0.09] px-5 md:min-h-[88px] md:px-7">
                            {settingsPage !== "root" && (
                                <button type="button" onClick={() => setSettingsPage("root")} className="mr-2 grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white" aria-label="Back">
                                    <ArrowLeft className="h-5 w-5" strokeWidth={1.7} />
                                </button>
                            )}
                            <h2 className="flex-1 text-[20px] font-semibold tracking-[-0.025em] text-white md:text-[26px]">
                                {settingsPage === "root" ? "Settings" : settingsPage === "server" ? "Server" : settingsPage === "speed" ? "Speed" : settingsPage === "subtitles" ? "Subtitle style" : settingsPage === "auto" ? "Auto" : settingsPage === "boost" ? "Volume boost" : settingsPage === "spatial" ? "Spatial audio" : settingsPage === "video" ? "Video" : "Upscaler"}
                            </h2>
                            <button type="button" onClick={closeSettings} className="grid h-9 w-9 place-items-center rounded-full border border-white/75 text-white/90 hover:bg-white/[0.08] md:h-10 md:w-10" aria-label="Close settings">
                                <X className="h-5 w-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-2.5 scrollbar-none md:p-3.5">
                            {settingsPage === "root" && (
                                <div className="space-y-0.5">
                                    <SettingsRow icon={Cloud} label="Server" value={activeServer?.name || "Auto"} onClick={() => setSettingsPage("server")} />
                                    <SettingsRow icon={Gauge} label="Speed" value={`${rate}x`} onClick={() => setSettingsPage("speed")} />
                                    <SettingsRow icon={Palette} label="Subtitle style" value={subtitleSettingsLabel} onClick={() => setSettingsPage("subtitles")} />
                                    <SettingsRow icon={RefreshCw} label="Auto" value={autoPlay ? "Play" : "Off"} onClick={() => setSettingsPage("auto")} />
                                    <SettingsRow icon={Volume2} label="Volume boost" value={`${volumeBoost}%`} onClick={() => setSettingsPage("boost")} />
                                    <SettingsRow icon={AudioWaveform} label="Spatial audio" value={spatialAudio ? "On" : "Off"} onClick={() => setSettingsPage("spatial")} />
                                    <SettingsRow icon={CirclePlus} label="Video" value={`${videoScale}%`} onClick={() => setSettingsPage("video")} />
                                    <SettingsRow icon={WandSparkles} label="Upscaler" value={upscaler ? "On" : "Off"} onClick={() => setSettingsPage("upscaler")} />
                                </div>
                            )}

                            {settingsPage === "server" && (
                                <div className="space-y-1 py-1">
                                    {sourceSlots.map((s) => (
                                        <button key={s.id} disabled={!s.available} onClick={() => s.available && selectServerInSettings(s)} className={`flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition ${serverId === s.id ? "bg-white text-black" : s.available ? "text-white/85 hover:bg-white/[0.06]" : "cursor-not-allowed text-white/25"}`}>
                                            <Cloud className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                                            <span className="min-w-0 flex-1 truncate text-[16px]">{s.displayName || s.name}</span>
                                            {!s.available && <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/28">Unavailable</span>}
                                            <img src="https://flagsapi.com/US/flat/24.png" alt="US" className={`h-4 w-6 rounded-[2px] object-cover ${s.available ? "opacity-100" : "opacity-25"}`} />
                                            {serverId === s.id && <span className="text-xs opacity-55">Selected</span>}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {settingsPage === "speed" && (
                                <div className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-3">
                                    {SPEEDS.map((r) => <button key={r} onClick={() => changeRateInSettings(r)} className={`rounded-2xl border px-4 py-4 text-sm transition ${rate === r ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.025] text-white/80 hover:bg-white/[0.07]"}`}>{r}x</button>)}
                                </div>
                            )}

                            {settingsPage === "subtitles" && (
                                <div className="space-y-4 p-1">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
                                        <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.17em] text-white/38">Tracks</p>
                                        <button onClick={turnOffCaptions} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${sub < 0 && !externalCaptionId ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}><span>Off</span></button>
                                        {externalCaptions.map((track) => (
                                            <button key={`settings-vtt-${track.play_url || track.id}`} onClick={() => selectExternalCaption(track)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${externalCaptionId === track.id ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}>
                                                <span className="min-w-0 flex-1 truncate">{track.name || track.lang || "WebVTT"}</span>
                                                <span className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${String(track.source || "").toLowerCase() === "granite" && externalCaptionId !== track.id ? "text-emerald-300" : "opacity-45"}`}>{String(track.source || "").toLowerCase() === "granite" ? "Granite · VTT" : "VTT"}</span>
                                            </button>
                                        ))}
                                        {subs.map((track, i) => (
                                            <button key={`settings-hls-${i}`} onClick={() => { setExternalCaptionId(null); setExternalCues([]); changeSub(i); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${sub === i && !externalCaptionId ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}>
                                                <span>{track.name || track.lang || `Track ${i + 1}`}</span><span className="text-[10px] uppercase opacity-45">HLS · {track.lang || track.language || "CC"}</span>
                                            </button>
                                        ))}
                                        {!subs.length && !externalCaptions.length && <p className="px-3 py-3 text-xs text-white/40">No subtitle tracks are exposed by the current sources.</p>}
                                        {externalCaptionLoading && <p className="px-3 py-2 text-xs text-white/40">Loading WebVTT…</p>}
                                        {externalCaptionError && <p className="px-3 py-2 text-xs text-red-300/80">{externalCaptionError}</p>}
                                    </div>

                                    {captionSources.length > 1 && (
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                                            <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.17em] text-white/38">Caption source</p>
                                            <div className="grid grid-cols-2 gap-1">
                                                {captionSources.map((s) => <button key={`settings-source-${s.provider}`} onClick={() => selectCaptionSourceInSettings(s)} className={`rounded-xl px-3 py-2.5 text-sm ${serverId === s.id ? "bg-white text-black" : "text-white/70 hover:bg-white/[0.06]"}`}>{s.name}</button>)}
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-2">
                                        <div className="flex items-center justify-between px-3 py-2"><p className="text-[10px] uppercase tracking-[0.17em] text-white/38">Appearance & sync</p><button onClick={resetCaptionStyle} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 hover:bg-white/10">Reset</button></div>
                                        <CaptionSlider label="Size" value={captionStyle.size} min={60} max={180} suffix="%" onChange={(v) => updateCaptionStyle("size", v)} />
                                        <CaptionSlider label="Transparency" value={captionStyle.transparency} min={0} max={90} suffix="%" onChange={(v) => updateCaptionStyle("transparency", v)} />
                                        <CaptionSlider label="Boldness" value={captionStyle.weight} min={300} max={900} step={100} onChange={(v) => updateCaptionStyle("weight", v)} />
                                        <CaptionSlider label="Outline" value={captionStyle.outline} min={0} max={4} step={0.5} suffix="px" onChange={(v) => updateCaptionStyle("outline", v)} />
                                        <CaptionSlider label="Background" value={captionStyle.background} min={0} max={90} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                        <CaptionSlider label="Vertical position" value={captionStyle.position} min={60} max={92} suffix="%" onChange={(v) => updateCaptionStyle("position", v)} />
                                        <CaptionSlider label="Delay" value={captionStyle.delay} min={-5} max={5} step={0.05} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                        <CaptionSlider label="Accuracy assist" value={captionStyle.accuracy} min={0} max={100} suffix="%" onChange={(v) => updateCaptionStyle("accuracy", v)} />
                                        <div className="flex items-center gap-3 px-3 py-3"><input type="color" value={captionStyle.color} onChange={(e) => updateCaptionStyle("color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" aria-label="Subtitle color" /><span className="flex-1 text-sm text-white/70">Subtitle color</span><button role="switch" aria-checked={captionStyle.autoCorrect} onClick={() => updateCaptionStyle("autoCorrect", !captionStyle.autoCorrect)} className={`relative h-6 w-11 rounded-full transition ${captionStyle.autoCorrect ? "bg-white" : "bg-white/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${captionStyle.autoCorrect ? "left-6 bg-black" : "left-1 bg-white/60"}`} /></button></div>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "auto" && (
                                <div className="grid grid-cols-2 gap-3 p-2"><button onClick={() => { setAutoPlay(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 text-base ${autoPlay ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Play</button><button onClick={() => { setAutoPlay(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 text-base ${!autoPlay ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button></div>
                            )}

                            {settingsPage === "boost" && (
                                <div className="p-5"><div className="flex items-end justify-between"><p className="text-sm text-white/55">Gain</p><p className="text-3xl font-medium tabular-nums">{volumeBoost}%</p></div><input type="range" min="100" max="200" step="5" value={volumeBoost} onChange={(e) => setVolumeBoostValue(e.target.value)} className="mt-6 w-full accent-white" /><p className="mt-4 text-xs leading-relaxed text-white/35">100% is the untouched stream level. Extra gain uses the browser's Web Audio path when available.</p></div>
                            )}

                            {settingsPage === "spatial" && (
                                <div className="grid grid-cols-2 gap-3 p-2"><button onClick={() => { setSpatialAudio(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${!spatialAudio ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button><button onClick={() => { setSpatialAudio(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${spatialAudio ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>On</button></div>
                            )}

                            {settingsPage === "video" && (
                                <div className="space-y-5 p-4"><div><div className="flex items-center justify-between text-sm"><span className="text-white/55">Video size</span><span className="tabular-nums text-white/85">{videoScale}%</span></div><input type="range" min="75" max="125" step="1" value={videoScale} onChange={(e) => setVideoScale(Number(e.target.value))} className="mt-3 w-full accent-white" /></div><div className="h-px bg-white/10" /><div><p className="mb-2 text-[10px] uppercase tracking-[0.17em] text-white/38">Quality · {settingsQualityLabel}</p><button disabled={!autoQualityAvailable} onClick={chooseAutoQualityInSettings} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${level === -1 && activeQualityHeight === 0 ? "bg-white text-black" : autoQualityAvailable ? "text-white/75 hover:bg-white/[0.06]" : "text-white/20"}`}><span>Auto</span><span className="text-xs opacity-45">Adaptive</span></button>{qualityChoices.map((choice) => <button key={`settings-quality-${choice.height}`} disabled={!choice.available} onClick={() => chooseQualityInSettings(choice)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${activeQualityHeight === choice.height ? "bg-white text-black" : choice.available ? "text-white/75 hover:bg-white/[0.06]" : "text-white/20"}`}><span>{choice.label}</span><span className="text-[10px] opacity-45">{choice.available ? (choice.levelIndex >= 0 ? "HLS" : choice.server?.name) : "Unavailable"}</span></button>)}</div></div>
                            )}

                            {settingsPage === "upscaler" && (
                                <div className="p-4"><div className="grid grid-cols-2 gap-3"><button onClick={() => { setUpscaler(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${!upscaler ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button><button onClick={() => { setUpscaler(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${upscaler ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Enhance</button></div><p className="mt-4 text-xs leading-relaxed text-white/35">Enhance is a light display filter. It does not fabricate a native 4K rendition.</p></div>
                            )}
                        </div>
                    </div>
                </div>
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
