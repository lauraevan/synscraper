import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward,
    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,
    X, ShieldCheck, AlertTriangle, Cloud, ChevronRight, ArrowLeft,
    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette, Download, Loader2, Star,
} from "lucide-react";
import { getStreams, hlsProxyUrl, getDownloadOptions, downloadWorkerUrl } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { saveProgress, getProgress } from "@/lib/storage";

let hlsLoaderPromise = null;
const loadHls = () => {
    if (!hlsLoaderPromise) hlsLoaderPromise = import("hls.js").then((module) => module.default || module);
    return hlsLoaderPromise;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SOURCE_4K_BADGE = "data:image/webp;base64,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";
const SOURCE_INDIA_FLAG = "data:image/png;base64,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";
const sourceHas4KBadge = (source) => {
    const provider = String(source?.provider || "").trim().toLowerCase();
    const name = String(source?.displayName || source?.name || "");
    return provider === "orlando" || provider === "vidcore" || (provider === "vidy" && /miami/i.test(name));
};
const sourceIsHindi = (source) => {
    const language = String(source?.lang || source?.language || "").trim().toLowerCase();
    const label = [source?.displayName, source?.name, source?.label, source?.subserver]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const explicitlyHindiV6 = /hindi[^a-z0-9]*v6|v6[^a-z0-9]*hindi/i.test(label);
    const v6LanguageHint = (language === "hi" || language === "hin") && /(^|[^a-z0-9])v6([^a-z0-9]|$)/i.test(label);
    return explicitlyHindiV6 || v6LanguageHint;
};
const sourceFlag = (source) => sourceIsHindi(source)
    ? SOURCE_INDIA_FLAG
    : "https://flagsapi.com/US/flat/24.png";
const sourcePreferenceKey = (source) => `${String(source?.provider || "").trim().toLowerCase()}|${String(source?.displayName || source?.name || "").trim().toLowerCase()}`;
const readPreferredSourceKey = () => typeof window !== "undefined"
    ? String(window.localStorage.getItem("synscraper-default-source-v1") || "").trim().toLowerCase()
    : "";

const sourceQualityRank = (source) => {
    const provider = String(source?.provider || "").trim().toLowerCase();
    const name = String(source?.displayName || source?.name || "").trim().toLowerCase();
    if (provider === "orlando") return 0;
    if (provider === "vidy" && /miami/i.test(name)) return 1;
    if (provider === "vidcore") return 2;
    if (provider === "castle") return 3;
    if (provider === "vidlink") return 4;
    if (provider === "vidnest") return 5;
    if (provider === "vidzee") return 6;
    if (provider === "vidrock") return 7;
    if (provider === "cinejoy") return 8;
    if (provider === "vixsrc") return 9;
    return 20;
};
const bestServerForQuality = (items, height) => [...(items || [])]
    .filter((source) => qualityHeight(source?.quality) === height)
    .sort((a, b) => sourceQualityRank(a) - sourceQualityRank(b))[0] || null;

const SOURCE_CATALOG = [
    { provider: "orlando", name: "Orlando" },
    { provider: "vidy", name: "Miami" },
    { provider: "castle", name: "Houston" },
    { provider: "vidlink", name: "Nova" },
    { provider: "vidnest", name: "Nest" },
    { provider: "vidzee", name: "Zen" },
    { provider: "vidrock", name: "Rock" },
    { provider: "cinejoy", name: "Lisbon" },
    { provider: "vidcore", name: "VidCore" },
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
const CAPTION_LANGUAGE_NAMES = {
    en: "English", es: "Spanish", ar: "Arabic", fr: "French", de: "German",
    it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese",
    hi: "Hindi", ru: "Russian", tr: "Turkish", nl: "Dutch", pl: "Polish",
};
const normalizeCaptionLanguage = (value) => {
    const raw = String(value || "").trim().toLowerCase().replace(/_/g, "-");
    if (!raw) return "und";
    const aliases = {
        english: "en", eng: "en", en: "en", spanish: "es", esp: "es", spa: "es", es: "es",
        arabic: "ar", ara: "ar", ar: "ar", french: "fr", fra: "fr", fre: "fr", fr: "fr",
        german: "de", deu: "de", ger: "de", de: "de", italian: "it", ita: "it", it: "it",
        portuguese: "pt", por: "pt", pt: "pt", japanese: "ja", jpn: "ja", ja: "ja",
        korean: "ko", kor: "ko", ko: "ko", chinese: "zh", zho: "zh", chi: "zh", zh: "zh",
        hindi: "hi", hin: "hi", hi: "hi", russian: "ru", rus: "ru", ru: "ru",
        turkish: "tr", tur: "tr", tr: "tr", dutch: "nl", nld: "nl", nl: "nl",
        polish: "pl", pol: "pl", pl: "pl",
    };
    if (aliases[raw]) return aliases[raw];
    const first = raw.split(/[-\s(]/)[0];
    return aliases[first] || (/^[a-z]{2}$/.test(first) ? first : "und");
};
const captionLanguageName = (code) => CAPTION_LANGUAGE_NAMES[code] || (code === "und" ? "Captions" : String(code || "CC").toUpperCase());
const captionTrackKey = (track) => track?.key || track?.play_url || `${track?.source || "caption"}:${track?.id || track?.name || "track"}`;
const readCaptionLanguage = () => {
    if (typeof window === "undefined") return "en";
    return normalizeCaptionLanguage(window.localStorage.getItem("synscraper-caption-language-v2") || "en");
};
const readCaptionsEnabled = () => typeof window !== "undefined" && window.localStorage.getItem("synscraper-captions-enabled-v2") === "1";
const scoreCaptionCues = (cues) => {
    if (!Array.isArray(cues) || cues.length < 2) return 0;
    const first = Math.max(0, Number(cues[0]?.start || 0));
    const last = Math.max(...cues.map((cue) => Number(cue.end || 0)));
    const span = Math.max(0, last - first);
    return Math.round((Math.min(cues.length, 3000) * 2) + Math.min(span / 5, 1800) - Math.min(first / 3, 180));
};
const cueTextAt = (cues, time) => {
    if (!Array.isArray(cues) || !cues.length) return "";
    let lo = 0;
    let hi = cues.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cues[mid].start <= time) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    if (found < 0) return "";
    const active = [];
    for (let i = Math.max(0, found - 4); i < Math.min(cues.length, found + 5); i += 1) {
        if (cues[i].start <= time && cues[i].end >= time && cues[i].text) active.push(cues[i].text);
    }
    return Array.from(new Set(active)).join("\n");
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
    accuracy: 0,
    autoCorrect: false,
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
    const lines = String(value || "").replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
    const cues = [];
    for (let i = 0; i < lines.length; i += 1) {
        if (!lines[i].includes("-->")) continue;
        const [rawStart, rawEndAndSettings] = lines[i].split("-->");
        const rawEnd = String(rawEndAndSettings || "").trim().split(/\s+/)[0];
        const startTime = parseVttTime(rawStart);
        const endTime = parseVttTime(rawEnd);
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) continue;
        const body = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            if (lines[j].includes("-->")) break;
            if (!lines[j].trim()) { i = j; break; }
            body.push(lines[j]);
            i = j;
        }
        const text = normalizeCaptionText(body.join("\n"));
        if (text) cues.push({ start: startTime, end: endTime, text });
    }
    cues.sort((a, b) => a.start - b.start || a.end - b.end);
    const unique = [];
    const seen = new Set();
    for (const cue of cues) {
        const key = `${cue.start.toFixed(3)}|${cue.end.toFixed(3)}|${cue.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(cue);
    }
    return unique;
};

const CaptionSlider = ({ label, value, min, max, step = 1, suffix = "", onChange }) => (
    <label className="block py-2.5">
        <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-white/72">{label}</span>
            <span className="rounded-md bg-white/[0.055] px-1.5 py-0.5 tabular-nums text-white/48">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[#eadb8a]"
        />
    </label>
);

const Popover = ({ open, children, wide = false }) =>
    open ? (
        <div className={`absolute bottom-14 right-0 z-30 overflow-y-auto rounded-[14px] border border-white/[0.09] bg-[#0d0c0a]/[0.97] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.58)] backdrop-blur-xl scrollbar-none ${wide ? "w-[330px] max-w-[calc(100vw-2rem)] max-h-[min(70vh,540px)]" : "min-w-[205px] max-h-80"}`}>
            {children}
        </div>
    ) : null;

const MenuItem = ({ active, onClick, children, testId, disabled = false }) => (
    <button
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
            disabled ? "cursor-not-allowed text-white/20" : active ? "bg-[#eadb8a] text-[#17140c]" : "text-white/72 hover:bg-white/[0.055] hover:text-white"
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
    const wakeThrottleRef = useRef(0);
    const pendingSeekRef = useRef(null);
    const autoCaptionRef = useRef(false);
    const autoPlayRef = useRef(true);
    const audioContextRef = useRef(null);
    const audioSourceRef = useRef(null);
    const gainRef = useRef(null);
    const captionCacheRef = useRef(new Map());
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
    const [preferredSourceKey, setPreferredSourceKey] = useState(readPreferredSourceKey);
    const [settingsPage, setSettingsPage] = useState("root");
    const [downloadItems, setDownloadItems] = useState([]);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
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
    const [captionHealth, setCaptionHealth] = useState({});
    const [captionsEnabled, setCaptionsEnabled] = useState(readCaptionsEnabled);
    const [preferredCaptionLang, setPreferredCaptionLang] = useState(readCaptionLanguage);
    const [captionStyle, setCaptionStyle] = useState(() => {
        if (typeof window === "undefined") return DEFAULT_CAPTION_STYLE;
        try {
            const saved = JSON.parse(window.localStorage.getItem("synscraper-caption-style-v2") || "null");
            return { ...DEFAULT_CAPTION_STYLE, ...(saved || {}) };
        } catch {
            return DEFAULT_CAPTION_STYLE;
        }
    });

    useEffect(() => { loadHls().catch(() => {}); }, []);

    const activeServer = servers.find((s) => s.id === serverId);
    const streamResolveHints = useMemo(() => ({
        title: meta?.title || meta?.name || "",
        year: Number(String(meta?.release_date || meta?.first_air_date || "").slice(0, 4)) || undefined,
        imdbId: meta?.imdb_id || meta?.external_ids?.imdb_id || undefined,
    }), [meta]);
    const downloadSources = (() => {
        const found = new Map();
        servers.filter((server) => server?.type === "hls").forEach((server) => {
            const key = `${server.provider}|${server.name}`;
            if (!found.has(key)) found.set(key, { key, provider: server.provider, name: server.name });
        });
        return Array.from(found.values()).sort((a, b) => {
            const rank = (source) => source.provider === "orlando"
                ? 0
                : (source.provider === "vidy" && /miami/i.test(source.name) ? 1 : 2);
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
        });
    })();

    useEffect(() => {
        if (settingsPage !== "download") return undefined;
        let alive = true;
        setDownloadLoading(true);
        setDownloadError("");
        setDownloadItems([]);

        if (!downloadSources.length) {
            setDownloadLoading(false);
            setDownloadError("No downloadable HLS streams are available for this title.");
            return undefined;
        }

        Promise.allSettled(downloadSources.map(async (source) => {
            const data = await getDownloadOptions({
                type: mediaType,
                id,
                season,
                episode,
                provider: source.provider,
                mirror: source.name,
            });
            const qualities = (data?.available_qualities || [])
                .map(Number)
                .filter((height) => height > 0 && height <= 1080)
                .sort((a, b) => b - a);
            const usable = qualities.length ? qualities.map(String) : ["auto"];
            return usable.map((quality) => ({
                key: `${source.key}|${quality}`,
                provider: source.provider,
                source: source.name,
                quality,
            }));
        })).then((results) => {
            if (!alive) return;
            const items = results
                .filter((result) => result.status === "fulfilled")
                .flatMap((result) => result.value);
            const unique = Array.from(new Map(items.map((item) => [item.key, item])).values());
            unique.sort((a, b) => {
                const rank = (item) => item.provider === "orlando"
                    ? 0
                    : (item.provider === "vidy" && /miami/i.test(item.source) ? 1 : 2);
                const aq = a.quality === "auto" ? 0 : Number(a.quality);
                const bq = b.quality === "auto" ? 0 : Number(b.quality);
                return rank(a) - rank(b) || bq - aq || a.source.localeCompare(b.source);
            });
            setDownloadItems(unique);
            const failed = results.filter((result) => result.status === "rejected").length;
            if (!unique.length) setDownloadError("No downloads could be prepared from the available streams.");
            else if (failed) setDownloadError(`${failed} source${failed === 1 ? "" : "s"} couldn't be checked, but the downloads below are ready.`);
        }).finally(() => {
            if (alive) setDownloadLoading(false);
        });

        return () => { alive = false; };
    }, [settingsPage, servers, mediaType, id, season, episode]); // eslint-disable-line react-hooks/exhaustive-deps

    const startDownloadFromSettings = (item) => {
        if (!item || typeof document === "undefined") return;
        const url = downloadWorkerUrl({
            type: mediaType,
            id,
            season,
            episode,
            provider: item.provider,
            mirror: item.source,
            quality: item.quality || "auto",
            title: meta?.title || "Synapse",
        });
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
    useEffect(() => {
        preferredQualityRef.current = preferredQuality;
        if (typeof window !== "undefined") {
            window.localStorage.setItem("synscraper-quality-v1", preferredQuality == null ? "auto" : String(preferredQuality));
        }
    }, [preferredQuality]);

    const playServer = useCallback(async (server) => {
        const video = videoRef.current;
        if (!video || !server) return;
        setBuffering(true);
        hlsRetryRef.current = { serverId: server.id, network: 0, media: 0 };
        setLevels([]); setLevel(-1); setSubs([]); setSub(-1);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const url = hlsProxyUrl(server.play_url);
        const Hls = server.type === "hls" ? await loadHls() : null;
        if (server.type === "hls" && Hls?.isSupported()) {
            const isMiami = server.provider === "vidy" && /miami/i.test(String(server.name || ""));
            const hls = new Hls({
                enableWorker: true,
                progressive: true,
                startFragPrefetch: true,
                maxBufferLength: isMiami ? 10 : 14,
                maxMaxBufferLength: isMiami ? 24 : 30,
                backBufferLength: 15,
                abrEwmaDefaultEstimate: isMiami ? 24_000_000 : 5_000_000,
                manifestLoadingTimeOut: isMiami ? 4500 : 7000,
                manifestLoadingMaxRetry: 2,
                manifestLoadingRetryDelay: isMiami ? 120 : 250,
                levelLoadingTimeOut: isMiami ? 5500 : 8000,
                levelLoadingMaxRetry: 2,
                levelLoadingRetryDelay: isMiami ? 120 : 250,
                fragLoadingTimeOut: isMiami ? 10000 : 15000,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: isMiami ? 120 : 250,
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

    // Progressive source loading: start Orlando immediately, keep Miami directly behind it, then fill the rest in the background.
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
                const existing = map.get(key);
                if (!existing) {
                    map.set(key, item);
                    continue;
                }
                const captionMap = new Map();
                for (const caption of [...(existing.captions || []), ...(item.captions || [])]) {
                    const captionKey = caption.play_url || caption.id || `${caption.lang || "und"}:${caption.name || "caption"}`;
                    captionMap.set(captionKey, caption);
                }
                map.set(key, {
                    ...existing,
                    ...item,
                    id: existing.id,
                    captions: Array.from(captionMap.values()),
                });
            }
            return Array.from(map.values());
        };
        const activate = (list, { allowFallback = false } = {}) => {
            if (!alive || started || !list.length) return;
            const wanted = preferredQualityRef.current;
            const preferredSource = readPreferredSourceKey();
            const favoriteCandidates = preferredSource
                ? list.filter((candidate) => sourcePreferenceKey(candidate) === preferredSource)
                : [];
            const favorite = favoriteCandidates.length
                ? ((wanted ? favoriteCandidates.find((candidate) => qualityHeight(candidate.quality) === wanted) : null)
                    || (!wanted ? favoriteCandidates.find((candidate) => /^auto/i.test(String(candidate.quality || ""))) : null)
                    || favoriteCandidates.find((candidate) => qualityHeight(candidate.quality) === 1080)
                    || favoriteCandidates[0])
                : null;
            if (preferredSource && !favorite && !allowFallback) return;
            const preferred = favorite
                || (wanted ? list.find((candidate) => candidate.provider === "orlando" && qualityHeight(candidate.quality) === wanted) : null)
                || (!wanted ? list.find((candidate) => candidate.provider === "orlando" && /^auto/i.test(String(candidate.quality || ""))) : null)
                || list.find((candidate) => candidate.provider === "orlando" && qualityHeight(candidate.quality) === 1080)
                || list.find((candidate) => candidate.provider === "orlando")
                || (wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === wanted) : null)
                || (!wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && /^auto/i.test(String(candidate.quality || ""))) : null)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === 1080)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")))
                || list[0];
            started = true;
            clearInterval(tick);
            setServerId(preferred.id);
            setMode("ready");
        };

        let backgroundPromise = null;
        let backgroundTimer = null;
        let heavyTimer = null;
        let safetyTimer = null;

        const mergePayload = (data, allowFallback = false) => {
            if (!alive) return [];
            const list = data?.servers || [];
            if (list.length) {
                setServers((current) => mergeServers(current, list));
                activate(list, { allowFallback });
            }
            return list;
        };

        const startHeavyCineJoy = () => {
            if (!alive) return Promise.resolve([]);
            return getStreams(mediaType, id, season, episode, { provider: "cinejoy", timeout: 18000 })
                .then(mergePayload)
                .catch(() => []);
        };

        const startBackground = (exclude) => {
            if (backgroundPromise) return backgroundPromise;

            const excluded = new Set(
                String(exclude || "")
                    .split(",")
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean),
            );
            const providers = ["orlando", "vidy", "castle", "vidlink", "vidnest", "vidzee", "vidrock", "cinejoy", "vidcore", "vixsrc"];
            const providerQueue = providers.filter((provider) => !excluded.has(provider));

            if (!providerQueue.length) {
                backgroundPromise = Promise.resolve([]);
                if (alive) setSourcesLoading(false);
                return backgroundPromise;
            }

            const loadProvider = (provider) => getStreams(mediaType, id, season, episode, {
                provider,
                mirror: provider === "vidy" ? "miami" : undefined,
                timeout: provider === "cinejoy" ? 12000 : provider === "orlando" ? 15000 : 9500,
                ...streamResolveHints,
            })
                .then((data) => mergePayload(data, true))
                .catch(() => []);

            // Keep provider discovery progressive instead of hammering every resolver at once.
            // Three concurrent lookups keeps backup sources arriving quickly without competing
            // with the active HLS stream for CPU/network during startup.
            backgroundPromise = (async () => {
                const collected = [];
                const batchSize = 2;
                for (let index = 0; alive && index < providerQueue.length; index += batchSize) {
                    const batch = providerQueue.slice(index, index + batchSize);
                    const results = await Promise.allSettled(batch.map(loadProvider));
                    for (const result of results) {
                        if (result.status === "fulfilled" && Array.isArray(result.value)) collected.push(...result.value);
                    }
                }
                return collected;
            })().finally(() => {
                if (alive) setSourcesLoading(false);
            });
            return backgroundPromise;
        };

        const quick = getStreams(mediaType, id, season, episode, { provider: "orlando", timeout: 4600, ...streamResolveHints })
            .then(async (d) => {
                if (!alive) return [];
                const list = mergePayload(d, false);
                const preferredSource = readPreferredSourceKey();
                const quickHasPreferred = preferredSource && list.some((server) => sourcePreferenceKey(server) === preferredSource);
                const preferredProvider = preferredSource ? preferredSource.split("|")[0] : "";

                // Orlando is the default. If it misses, give Miami the first fallback attempt.
                if (!list.length) {
                    const miami = await getStreams(mediaType, id, season, episode, {
                        provider: "vidy",
                        mirror: "miami",
                        timeout: 3600,
                        ...streamResolveHints,
                    }).catch(() => null);
                    if (!alive) return [];
                    const miamiList = mergePayload(miami, false);
                    backgroundTimer = window.setTimeout(() => startBackground("orlando,vidy,cinejoy"), 900);
                    heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);
                    if (!miamiList.length) return startBackground("orlando,vidy");
                    return miamiList;
                }

                if (preferredSource && !quickHasPreferred) {
                    // A starred source still overrides the built-in Orlando -> Miami order.
                    if (preferredProvider === "cinejoy") {
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 120);
                        backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 700);
                    } else {
                        backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 120);
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);
                    }
                    return list;
                }

                // Orlando is already active; load Miami immediately behind it, then the rest.
                backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 650);
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);
                return list;
            })
            .catch(async () => {
                const miami = await getStreams(mediaType, id, season, episode, {
                    provider: "vidy",
                    mirror: "miami",
                    timeout: 3600,
                    ...streamResolveHints,
                }).catch(() => null);
                if (!alive) return [];
                const miamiList = mergePayload(miami, false);
                if (!miamiList.length) return startBackground("orlando,vidy");
                backgroundTimer = window.setTimeout(() => startBackground("orlando,vidy,cinejoy"), 900);
                return miamiList;
            });

        // Give Orlando the startup lane; if it stalls, begin the Miami-first fallback pool.
        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground("orlando,cinejoy");
        }, readPreferredSourceKey() ? 2600 : 1800);

        Promise.resolve(quick).finally(() => {
            if (!alive) return;
            if (!started && !backgroundPromise) {
                startBackground(undefined).finally(() => {
                    if (alive && !started) {
                        clearInterval(tick);
                        setMode("error");
                        setError("No streams could be scraped for this title yet.");
                    }
                });
            }
        });


        return () => {
            alive = false;
            clearInterval(tick);
            if (backgroundTimer) window.clearTimeout(backgroundTimer);
            if (heavyTimer) window.clearTimeout(heavyTimer);
            if (safetyTimer) window.clearTimeout(safetyTimer);
        };
    }, [mediaType, id, season, episode, streamResolveHints]);

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
    const toggleFavoriteSource = (s) => {
        if (!s?.available || typeof window === "undefined") return;
        const key = sourcePreferenceKey(s);
        const next = preferredSourceKey === key ? "" : key;
        setPreferredSourceKey(next);
        if (next) window.localStorage.setItem("synscraper-default-source-v1", next);
        else window.localStorage.removeItem("synscraper-default-source-v1");
    };
    const selectCaptionSource = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        autoCaptionRef.current = true;
        setSub(-1);
        setMenu(null);
        setServerId(s.id);
    };

    const loadExternalCaption = async (caption, { silent = false } = {}) => {
        if (!caption?.play_url) return null;
        const key = captionTrackKey(caption);
        const cached = captionCacheRef.current.get(key);
        if (cached?.cues?.length) return cached;
        if (!silent) setExternalCaptionLoading(true);
        setCaptionHealth((old) => ({ ...old, [key]: { ...(old[key] || {}), status: "loading" } }));
        try {
            const response = await fetch(hlsProxyUrl(caption.play_url), { headers: { Accept: "text/vtt,text/plain,*/*" } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const cues = parseWebVtt(await response.text());
            if (cues.length < 2) throw new Error("Caption file has no usable cues");
            const score = scoreCaptionCues(cues);
            const entry = { cues, score, cueCount: cues.length, first: cues[0]?.start || 0, last: cues[cues.length - 1]?.end || 0 };
            captionCacheRef.current.set(key, entry);
            setCaptionHealth((old) => ({ ...old, [key]: { status: "ok", score, cueCount: entry.cueCount, first: entry.first, last: entry.last } }));
            return entry;
        } catch (err) {
            setCaptionHealth((old) => ({ ...old, [key]: { status: "bad", score: 0, error: err?.message || "Caption failed" } }));
            if (!silent) setExternalCaptionError(err?.message || "Could not load this caption track");
            return null;
        } finally {
            if (!silent) setExternalCaptionLoading(false);
        }
    };

    const selectExternalCaption = async (caption, { remember = true } = {}) => {
        if (!caption) return;
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionError("");
        const loaded = await loadExternalCaption(caption);
        if (!loaded?.cues?.length) return;
        const key = captionTrackKey(caption);
        setExternalCaptionId(key);
        setExternalCues(loaded.cues);
        if (remember) {
            const lang = normalizeCaptionLanguage(caption.language || caption.lang || caption.name);
            setPreferredCaptionLang(lang);
            setCaptionsEnabled(true);
            if (typeof window !== "undefined") {
                window.localStorage.setItem("synscraper-caption-language-v2", lang);
                window.localStorage.setItem("synscraper-captions-enabled-v2", "1");
            }
        }
    };

    const turnOffCaptions = () => {
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionId(null);
        setExternalCues([]);
        setCaptionText("");
        setCaptionsEnabled(false);
        if (typeof window !== "undefined") window.localStorage.setItem("synscraper-captions-enabled-v2", "0");
    };

    const toggleCaptionsPreference = () => {
        if (captionsEnabled) {
            turnOffCaptions();
            return;
        }
        setCaptionsEnabled(true);
        setExternalCaptionError("");
        if (typeof window !== "undefined") window.localStorage.setItem("synscraper-captions-enabled-v2", "1");
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
        window.localStorage.setItem("synscraper-caption-style-v2", JSON.stringify(captionStyle));
    }, [captionStyle]);

    useEffect(() => {
        if (externalCaptionId) return undefined;
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
        const timer = window.setInterval(updateCaption, 250);
        return () => window.clearInterval(timer);
    }, [mode, sub, subs, serverId, externalCaptionId, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);

    const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
    useEffect(() => {
        if (!externalCaptionId || !externalCues.length) return;
        const adjustedTime = current - Number(captionStyle.delay || 0);
        const raw = cueTextAt(externalCues, adjustedTime);
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

        const targetServer = choice.server;
        const currentIsAtLeastAsPreferred = choice.levelIndex >= 0
            && activeServer
            && (!targetServer || sourceQualityRank(activeServer) <= sourceQualityRank(targetServer));

        if (currentIsAtLeastAsPreferred && hlsRef.current) {
            changeLevel(choice.levelIndex);
            setMenu(null);
            return;
        }
        if (targetServer && targetServer.id !== serverId) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(targetServer.id);
            setMenu(null);
            return;
        }
        if (choice.levelIndex >= 0 && hlsRef.current) {
            changeLevel(choice.levelIndex);
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
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - wakeThrottleRef.current < 120) return;
        wakeThrottleRef.current = now;
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
                c: toggleCaptionsPreference,
                n: () => hasNext && onNextEpisode?.(),
                "?": () => setHelp((v) => !v),
            };
            if (map[k]) { e.preventDefault(); map[k](); wake(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [mode, sub, subs, hasNext, wake, captionsEnabled]); // eslint-disable-line

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
    const externalCaptions = Array.from(new Map(
        servers.flatMap((s) => (s.captions || []).map((c) => {
            const key = c.play_url || `${c.source || s.provider}:${c.id || c.name || "caption"}`;
            const language = normalizeCaptionLanguage(c.lang || c.name);
            return [key, { ...c, key, language, serverName: s.name, provider: s.provider }];
        }))
    ).values());
    const captionInventoryKey = externalCaptions.map((track) => track.key).sort().join("|");

    useEffect(() => {
        if (mode !== "ready" || !externalCaptions.length) return undefined;
        let alive = true;
        let secondaryTimer = null;
        const preferred = externalCaptions.filter((track) => track.language === preferredCaptionLang);
        const english = externalCaptions.filter((track) => track.language === "en" && !preferred.includes(track));
        const rest = externalCaptions.filter((track) => !preferred.includes(track) && !english.includes(track));
        const firstBatch = preferred.length ? preferred : english;

        const loadBatch = async (tracks) => {
            for (let i = 0; alive && i < tracks.length; i += 2) {
                await Promise.allSettled(tracks.slice(i, i + 2).map((track) => loadExternalCaption(track, { silent: true })));
            }
        };

        const primaryDelay = captionsEnabled ? 0 : 2500;
        const primaryTimer = window.setTimeout(async () => {
            await loadBatch(firstBatch);
            if (!alive) return;
            secondaryTimer = window.setTimeout(
                () => loadBatch([...english.filter((track) => !firstBatch.includes(track)), ...rest]),
                captionsEnabled ? 2500 : 8000,
            );
        }, primaryDelay);

        return () => {
            alive = false;
            window.clearTimeout(primaryTimer);
            if (secondaryTimer) window.clearTimeout(secondaryTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captionInventoryKey, captionsEnabled, preferredCaptionLang, mode]);

    const captionLanguageOptions = (() => {
        const codes = new Set();
        for (const track of externalCaptions) {
            const health = captionHealth[track.key];
            if (health?.status !== "bad") codes.add(track.language || "und");
        }
        for (const track of subs) codes.add(normalizeCaptionLanguage(track.lang || track.language || track.name));
        const options = Array.from(codes).map((code) => {
            const direct = externalCaptions.filter((track) => track.language === code);
            const good = direct
                .filter((track) => captionHealth[track.key]?.status === "ok")
                .sort((a, b) => (captionHealth[b.key]?.score || 0) - (captionHealth[a.key]?.score || 0));
            const pending = direct.some((track) => !captionHealth[track.key] || captionHealth[track.key]?.status === "loading");
            const hlsIndex = subs.findIndex((track) => normalizeCaptionLanguage(track.lang || track.language || track.name) === code);
            return { code, name: captionLanguageName(code), best: good[0] || null, pending, hlsIndex, available: good.length > 0 || pending || hlsIndex >= 0 };
        }).filter((option) => option.available);
        options.sort((a, b) => (a.code === "en" ? -1 : b.code === "en" ? 1 : a.name.localeCompare(b.name)));
        return options;
    })();

    useEffect(() => {
        if (!captionsEnabled) return;
        const option = captionLanguageOptions.find((item) => item.code === preferredCaptionLang)
            || captionLanguageOptions.find((item) => item.code === "en")
            || captionLanguageOptions[0];
        if (!option) return;
        if (option.best) {
            const key = captionTrackKey(option.best);
            const cached = captionCacheRef.current.get(key);
            if (cached?.cues?.length && externalCaptionId !== key) {
                if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
                setSub(-1);
                setExternalCaptionId(key);
                setExternalCues(cached.cues);
                setCaptionText("");
            }
            return;
        }
        if (!option.pending && option.hlsIndex >= 0 && (sub !== option.hlsIndex || externalCaptionId)) {
            setExternalCaptionId(null);
            setExternalCues([]);
            if (hlsRef.current) hlsRef.current.subtitleTrack = option.hlsIndex;
            setSub(option.hlsIndex);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captionsEnabled, preferredCaptionLang, captionHealth, captionInventoryKey, subs, serverId, externalCaptionId]);

    const selectCaptionLanguage = (code) => {
        const normalized = normalizeCaptionLanguage(code);
        setPreferredCaptionLang(normalized);
        setCaptionsEnabled(true);
        setExternalCaptionError("");
        if (typeof window !== "undefined") {
            window.localStorage.setItem("synscraper-caption-language-v2", normalized);
            window.localStorage.setItem("synscraper-captions-enabled-v2", "1");
        }
    };

    const activeQualityHeight = preferredQuality || (level >= 0 ? Number(levels[level]?.height || 0) : (levels.length ? 0 : qualityHeight(activeServer?.quality)));
    const autoServer = servers.find((s) => s.provider === activeServer?.provider && s.name === activeServer?.name && /^auto/i.test(String(s.quality || "")))
        || servers.find((s) => s.provider === activeServer?.provider && /^auto/i.test(String(s.quality || "")))
        || servers.find((s) => /^auto/i.test(String(s.quality || "")));
    const autoQualityAvailable = levels.length > 0 || !!autoServer;
    const qualityChoices = QUALITY_LADDER.map((target) => {
        const levelIndex = levels.findIndex((l) => Number(l.height || 0) === target.height);
        const server = bestServerForQuality(servers, target.height);
        return { ...target, levelIndex, server, available: levelIndex >= 0 || !!server };
    });
    const releaseDate = meta.release_date || meta.first_air_date || "";
    const year = releaseDate ? String(releaseDate).slice(0, 4) : "";
    const displayTitle = `${meta.title || "Untitled"}${year ? ` (${year})` : ""}`;
    const resolvePct = ((stepIdx + 1) / STEPS.length) * 100;
    const activeExternalCaption = externalCaptions.find((track) => track.key === externalCaptionId);
    const subtitleSettingsLabel = captionsEnabled ? `${captionLanguageName(preferredCaptionLang)}${activeExternalCaption ? ` · ${activeExternalCaption.serverName}` : sub >= 0 ? " · HLS" : ""}` : "Off";
    const settingsQualityLabel = preferredQuality ? (preferredQuality === 2160 ? "4K" : `${preferredQuality}p`) : "Auto";

    return (
        <div
            ref={containerRef}
            data-testid="synapse-player-container"
            onMouseMove={wake}
            onTouchStart={wake}
            onClick={() => menu && setMenu(null)}
            className="relative w-full aspect-video overflow-hidden rounded-[14px] border border-white/[0.06] bg-black text-white shadow-[0_16px_48px_rgba(0,0,0,0.34)] select-none"
        >
            <video
                ref={videoRef}
                data-testid="synapse-video-element"
                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover transition-[transform,filter] duration-200"
                style={{ transform: `scale(${videoScale / 100})`, filter: upscaler ? "contrast(1.045) saturate(1.025)" : undefined }}
                onClick={(e) => { e.stopPropagation(); togglePlay(); wake(); }}
                onDoubleClick={toggleFs}
                poster={meta.backdrop_path ? `https://image.tmdb.org/t/p/w1280${meta.backdrop_path}` : undefined}
                playsInline
                preload="auto"
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
                            src={`https://image.tmdb.org/t/p/w1280${meta.backdrop_path}`}
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
                                className={`grid h-11 w-11 place-items-center transition-all duration-200 active:scale-95 md:h-12 md:w-12 ${menu === "sources" ? "scale-105 text-[#eadb8a]" : "text-white/75 hover:scale-105 hover:text-white"}`}
                                aria-label="Choose source"
                                title="Servers"
                            >
                                <Cloud className="h-7 w-7 stroke-[1.55] md:h-8 md:w-8" />
                            </button>
                        </div>

                        <div className="absolute left-1/2 top-5 md:top-6 -translate-x-1/2 text-center max-w-[60%] pointer-events-none">
                            <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.18em] text-white/38 leading-none">You're Watching</p>
                            <p className="mt-1.5 text-sm md:text-lg font-medium tracking-[-0.02em] text-white/92 truncate">{displayTitle}</p>
                        </div>

                    </div>

                    {menu === "sources" && (
                        <div
                            data-testid="synapse-source-popout"
                            data-source-layout="player-modal"
                            className="absolute inset-0 z-[95] flex items-center justify-center bg-black/68 px-4 py-6 backdrop-blur-[3px] pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenu(null);
                            }}
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="w-[min(90vw,480px)] max-h-[min(72vh,580px)] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#10100f] shadow-[0_24px_80px_rgba(0,0,0,0.74)]"
                            >
                                <div className="flex h-[58px] items-center border-b border-white/[0.08] px-4.5 md:px-5">
                                    <h3 className="flex-1 text-[15px] font-semibold tracking-[-0.02em] text-white/92 md:text-[16px]">Servers</h3>
                                    <button
                                        type="button"
                                        onClick={() => setMenu(null)}
                                        className="grid h-8 w-8 place-items-center rounded-full text-white/48 transition hover:bg-white/[0.05] hover:text-white"
                                        aria-label="Close servers"
                                    >
                                        <X className="h-5 w-5" strokeWidth={1.7} />
                                    </button>
                                </div>

                                <div className="max-h-[min(59vh,490px)] overflow-y-auto px-2.5 py-2 scrollbar-none md:px-3">
                                    {sourceSlots.map((s) => {
                                        const selected = sourcePreferenceKey(activeServer) === sourcePreferenceKey(s);
                                        const favorite = preferredSourceKey === sourcePreferenceKey(s);
                                        const show4K = sourceHas4KBadge(s);
                                        const hindi = sourceIsHindi(s);
                                        const subtitle = !s.available
                                            ? "Unavailable"
                                            : show4K
                                                ? "Original audio, 4K"
                                                : hindi
                                                    ? "Hindi audio"
                                                    : s.provider === "cinejoy"
                                                        ? "Multiple audio"
                                                        : "Original audio";
                                        return (
                                            <div
                                                key={s.id}
                                                data-source-favorite={favorite ? "true" : "false"}
                                                className={`group flex min-h-[60px] items-center rounded-[12px] px-1 transition ${s.available ? "hover:bg-white/[0.045]" : "opacity-35"}`}
                                            >
                                                <button
                                                    type="button"
                                                    disabled={!s.available}
                                                    onClick={() => {
                                                        if (!s.available) return;
                                                        selectServer(s);
                                                        setMenu(null);
                                                    }}
                                                    className={`flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left ${s.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                                                >
                                                    <div className="flex h-7 w-8 shrink-0 items-center justify-center">
                                                        {show4K ? (
                                                            <img
                                                                src={SOURCE_4K_BADGE}
                                                                alt="4K"
                                                                title="4K source"
                                                                className="h-6 w-8 object-contain"
                                                            />
                                                        ) : (
                                                            <img
                                                                src={hindi ? SOURCE_INDIA_FLAG : sourceFlag(s)}
                                                                alt={hindi ? "India" : "US"}
                                                                title={hindi ? "Hindi v6 source" : "Original audio source"}
                                                                className="h-5 w-7 rounded-[2px] object-cover"
                                                                loading="lazy"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`truncate text-[14px] font-semibold tracking-[-0.015em] md:text-[15px] ${selected ? "text-[#eadb8a]" : "text-white/88"}`}>
                                                            {s.displayName || s.name}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[10px] text-white/34 md:text-[11px]">{subtitle}</p>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={!s.available}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavoriteSource(s);
                                                    }}
                                                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${favorite ? "text-[#eadb8a]" : "text-white/24 hover:bg-white/[0.05] hover:text-[#eadb8a]"}`}
                                                    aria-label={favorite ? `Remove ${s.displayName || s.name} as default source` : `Make ${s.displayName || s.name} the default source`}
                                                    title={favorite ? "Default source" : "Make default source"}
                                                >
                                                    <Star className={`h-[18px] w-[18px] ${favorite ? "fill-current" : ""}`} strokeWidth={1.7} />
                                                </button>

                                                {selected && (
                                                    <div className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#332e18] text-[#eadb8a]" title="Currently playing">
                                                        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {sourcesLoading && (
                                        <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-white/38">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading more servers…
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute inset-0 z-20 flex items-center justify-center gap-[8vw] max-md:gap-10 transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    >
                        <button onClick={() => seekBy(-10)} className="relative w-14 h-14 md:w-16 md:h-16 text-white/90 hover:text-white active:scale-95 transition" aria-label="Back 10 seconds">
                            <RotateCcw className="absolute inset-0 w-full h-full stroke-[1.7]" />
                            <span className="absolute inset-0 flex items-center justify-center text-sm md:text-base font-semibold pt-0.5">10</span>
                        </button>

                        <button
                            data-testid="synapse-play-pause-btn"
                            onClick={togglePlay}
                            className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform drop-shadow-[0_4px_14px_rgba(0,0,0,0.38)]"
                            aria-label={playing ? "Pause" : "Play"}
                        >
                            {playing ? <Pause className="w-11 h-11 md:w-14 md:h-14 fill-current stroke-[1.2]" /> : <Play className="w-14 h-14 md:w-16 md:h-16 fill-current stroke-[1.2] ml-1.5" />}
                        </button>

                        <button onClick={() => seekBy(10)} className="relative w-14 h-14 md:w-16 md:h-16 text-white/90 hover:text-white active:scale-95 transition" aria-label="Forward 10 seconds">
                            <RotateCw className="absolute inset-0 w-full h-full stroke-[1.7]" />
                            <span className="absolute inset-0 flex items-center justify-center text-sm md:text-base font-semibold pt-0.5">10</span>
                        </button>
                    </div>

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute bottom-0 left-0 right-0 z-30 px-5 md:px-8 pb-5 md:pb-7 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    >
                        <div className="group/seek relative mb-5 md:mb-6 h-4 flex items-center">
                            <div className="absolute left-0 right-0 h-[4px] rounded-full bg-white/20 overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-white/22" style={{ width: `${bufPct}%` }} />
                                <div className="absolute inset-y-0 left-0 bg-[#eadb8a]" style={{ width: `${seekPct}%` }} />
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
                            <div className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#eadb8a] shadow-[0_1px_6px_rgba(0,0,0,0.35)] pointer-events-none" style={{ left: `${seekPct}%` }} />
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                            <button data-testid="synapse-mute-btn" onClick={toggleMute} className="grid h-9 w-9 shrink-0 place-items-center text-white/90 hover:text-white hover:scale-105 active:scale-95 transition" aria-label="Mute">
                                {muted || volume === 0 ? <VolumeX className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" /> : <Volume2 className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" />}
                            </button>

                            <span data-testid="synapse-time" className="text-sm md:text-lg font-medium tabular-nums text-white/95 whitespace-nowrap">
                                {fmtTime(current)} <span className="text-white/65 px-1">/</span> {fmtTime(duration)}
                            </span>
                            <span
                                className="hidden whitespace-nowrap text-[15px] font-bold tracking-[-0.04em] sm:inline-flex md:text-[18px]"
                                data-testid="synplayer-label"
                                style={{ fontFamily: "'Avenir Next', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif" }}
                            >
                                <span className="text-white/95">Syn</span><span className="text-[#eadb8a]">Player</span>
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
                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center transition active:scale-95 hover:scale-105 ${sub >= 0 || externalCaptionId ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}`}
                                        title="Captions (C)"
                                        aria-label="Captions"
                                    >
                                        <Subtitles className="h-[25px] w-[25px] stroke-[1.8]" />
                                    </button>
                                    <Popover open={menu === "subs"} wide>
                                        <div className="px-3 pb-2 pt-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[14px] font-semibold tracking-[-0.02em] text-white/95">Subtitles</p>
                                                    <p className="mt-0.5 text-[10px] text-white/34">Pick a language and SynPlayer handles the source.</p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${captionsEnabled ? "bg-[#eadb8a]/[0.12] text-[#eadb8a]" : "bg-white/[0.05] text-white/35"}`}>
                                                    {captionsEnabled ? "ON" : "OFF"}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={toggleCaptionsPreference}
                                            className="mx-1.5 mb-1 flex w-[calc(100%-0.75rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] text-white/74 transition hover:bg-white/[0.045]"
                                        >
                                            <Subtitles className="h-4 w-4 text-white/50" />
                                            <span className="flex-1 font-medium">Enable subtitles</span>
                                            <span className={`relative h-5 w-9 rounded-full transition ${captionsEnabled ? "bg-[#eadb8a]" : "bg-white/[0.12]"}`}>
                                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${captionsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                                            </span>
                                        </button>
                                        <div className="max-h-52 overflow-y-auto border-y border-white/[0.07] py-1 scrollbar-none">
                                            {captionLanguageOptions.map((option) => (
                                                <MenuItem key={`caption-language-${option.code}`} active={captionsEnabled && preferredCaptionLang === option.code} onClick={() => selectCaptionLanguage(option.code)}>
                                                    <span className="min-w-0 truncate">{option.name}</span>
                                                    <span className="ml-3 text-[9px] font-medium opacity-45">{option.pending ? "Checking" : "Ready"}</span>
                                                </MenuItem>
                                            ))}
                                            {!captionLanguageOptions.length && <p className="px-3 py-4 text-[11px] text-white/35">No subtitle languages are ready yet.</p>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setSettingsPage("subtitles"); setMenu("settings"); }}
                                            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-white/58 transition hover:bg-white/[0.045] hover:text-white"
                                        >
                                            <span className="flex-1">Subtitle settings</span>
                                            <ChevronRight className="h-4 w-4 text-white/30" />
                                        </button>
                                    </Popover>
                                </div>

                                <div className="relative">
                                    <button
                                        data-testid="synapse-quality-menu"
                                        onClick={() => setMenu(menu === "quality" ? null : "quality")}
                                        className={`h-10 min-w-[52px] px-1 text-xs font-semibold tracking-[-0.02em] transition hover:scale-105 active:scale-95 ${menu === "quality" ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}`}
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
                                                <span>{choice.label}</span><span className="text-[10px] opacity-40">{choice.available ? "Available" : "Unavailable"}</span>
                                            </MenuItem>
                                        ))}
                                    </Popover>
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => { setSettingsPage("root"); setMenu(menu === "settings" ? null : "settings"); }}
                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center transition active:scale-95 hover:scale-105 ${menu === "settings" ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}`}
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
                    className="absolute inset-0 z-[70]"
                    onClick={closeSettings}
                >
                    <div
                        data-testid="synapse-settings-panel"
                        className="absolute bottom-[70px] right-3 flex max-h-[78%] w-[372px] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-[16px] border border-white/[0.085] bg-[#0d0c0a]/[0.985] shadow-[0_22px_68px_rgba(0,0,0,0.68)] backdrop-blur-xl md:bottom-[84px] md:right-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex h-[50px] shrink-0 items-center border-b border-white/[0.07] px-3">
                            {settingsPage !== "root" ? (
                                <button
                                    type="button"
                                    onClick={() => setSettingsPage("root")}
                                    className="grid h-9 w-9 shrink-0 place-items-center text-white/65 transition hover:text-white"
                                    aria-label="Back"
                                >
                                    <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
                                </button>
                            ) : <div className="w-1" />}
                            <div className="min-w-0 flex-1 px-1.5">
                                <h2 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-white/94">
                                    {({
                                        root: "Settings",
                                        server: "Server",
                                        quality: "Quality",
                                        download: "Download",
                                        speed: "Playback speed",
                                        subtitles: "Subtitle settings",
                                        auto: "Autoplay",
                                        volume: "Volume",
                                        boost: "Volume boost",
                                        spatial: "Spatial audio",
                                        video: "Picture",
                                        upscaler: "Upscaler",
                                    }[settingsPage] || "Settings")}
                                </h2>
                                {settingsPage === "root" && <p className="mt-0.5 text-[9px] font-medium text-[#eadb8a]/60">SynPlayer</p>}
                            </div>
                            <button
                                type="button"
                                onClick={closeSettings}
                                className="grid h-9 w-9 shrink-0 place-items-center text-white/55 transition hover:text-white"
                                aria-label="Close settings"
                            >
                                <X className="h-[19px] w-[19px]" strokeWidth={1.8} />
                            </button>
                        </div>

                        <div className="overflow-y-auto scrollbar-none">
                            {settingsPage === "root" && (
                                <div className="p-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setSettingsPage("quality")} className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.055]">
                                            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"><Gauge className="h-3.5 w-3.5" />Quality</div>
                                            <p className="mt-1.5 truncate text-[14px] font-semibold text-white/90">{settingsQualityLabel}</p>
                                        </button>
                                        <button onClick={() => setSettingsPage("server")} className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.055]">
                                            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"><Cloud className="h-3.5 w-3.5" />Server</div>
                                            <p className="mt-1.5 truncate text-[14px] font-semibold text-white/90">{activeServer?.name || "Auto"}</p>
                                        </button>
                                        <button onClick={() => setSettingsPage("subtitles")} className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.055]">
                                            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"><Subtitles className="h-3.5 w-3.5" />Subtitles</div>
                                            <p className="mt-1.5 truncate text-[14px] font-semibold text-white/90">{captionsEnabled ? captionLanguageName(preferredCaptionLang) : "Off"}</p>
                                        </button>
                                        <button onClick={() => setSettingsPage("volume")} className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.055]" data-testid="synapse-volume-settings-row">
                                            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35"><Volume2 className="h-3.5 w-3.5" />Audio</div>
                                            <p className="mt-1.5 truncate text-[14px] font-semibold text-white/90">{Math.round((muted ? 0 : volume) * 100)}%</p>
                                        </button>
                                    </div>

                                    <div className="mt-2 overflow-hidden rounded-[12px] border border-white/[0.065] bg-black/20">
                                        <button onClick={() => setSettingsPage("download")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]" data-testid="synapse-download-settings-row">
                                            <Download className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Download</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={toggleCaptionsPreference} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <Subtitles className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Enable subtitles</span>
                                            <span className={`relative h-5 w-9 rounded-full transition ${captionsEnabled ? "bg-[#eadb8a]" : "bg-white/[0.12]"}`}>
                                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${captionsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                                            </span>
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSettingsPage("speed")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <RefreshCw className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Playback settings</span>
                                            <span className="text-[10px] text-white/30">{rate}x</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSettingsPage("subtitles")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <Subtitles className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Subtitle settings</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSettingsPage("boost")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <Volume2 className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Volume boost</span>
                                            <span className="text-[10px] text-white/30">{volumeBoost}%</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSpatialAudio((value) => !value)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <AudioWaveform className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Spatial audio</span>
                                            <span className={`text-[10px] font-medium ${spatialAudio ? "text-[#eadb8a]" : "text-white/30"}`}>{spatialAudio ? "On" : "Off"}</span>
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSettingsPage("video")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <CirclePlus className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Picture</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                        <div className="mx-3.5 h-px bg-white/[0.055]" />
                                        <button onClick={() => setSettingsPage("upscaler")} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]">
                                            <WandSparkles className="h-4 w-4 shrink-0 text-white/48" strokeWidth={1.7} />
                                            <span className="flex-1 text-[12px] font-medium text-white/78">Display enhancement</span>
                                            <span className={`text-[10px] ${upscaler ? "text-[#eadb8a]" : "text-white/30"}`}>{upscaler ? "On" : "Off"}</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-white/24" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "server" && (
                                <div className="py-1.5">
                                    <p className="px-4 py-2 text-[11px] leading-relaxed text-white/34">Orlando is prioritized for startup, with Miami immediately behind it. Switching sources keeps your current position.</p>
                                    <div className="border-t border-white/[0.06]">
                                        {sourceSlots.map((s) => {
                                            const selected = serverId === s.id;
                                            return (
                                                <button key={s.id} disabled={!s.available} onClick={() => s.available && selectServerInSettings(s)} className={`flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition ${s.available ? "hover:bg-white/[0.045]" : "cursor-not-allowed opacity-30"}`}>
                                                    <span className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-white" : "bg-white/18"}`} />
                                                    <span className={`min-w-0 flex-1 truncate text-[14px] ${selected ? "font-semibold text-white" : "font-medium text-white/72"}`}>{s.displayName || s.name}</span>
                                                    {sourceHas4KBadge(s) && <img src={SOURCE_4K_BADGE} alt="4K" title="4K source" className="h-[18px] w-[18px] shrink-0 object-contain" />}
                                                    <img src={sourceFlag(s)} alt={sourceIsHindi(s) ? "India" : "US"} title={sourceIsHindi(s) ? "Hindi source" : "US source"} className="h-4 w-6 shrink-0 rounded-[2px] object-cover" loading="lazy" />
                                                    {!s.available ? <span className="text-[9px] uppercase tracking-[0.12em] text-white/30">Unavailable</span> : selected ? <span className="text-[10px] font-medium text-white/45">Active</span> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {sourcesLoading && <p className="px-4 py-3 text-[10px] text-white/30">Finding more sources…</p>}
                                </div>
                            )}

                            {settingsPage === "quality" && (
                                <div className="py-1.5">
                                    <p className="px-4 py-2 text-[11px] leading-relaxed text-white/34">Manual quality stays locked until you choose Auto again.</p>
                                    <button disabled={!autoQualityAvailable} onClick={chooseAutoQualityInSettings} className={`flex w-full items-center gap-3 border-y border-white/[0.055] px-4 py-3 text-left transition ${preferredQuality == null ? "bg-white/[0.07] text-white" : autoQualityAvailable ? "text-white/72 hover:bg-white/[0.045]" : "text-white/25"}`}>
                                        <span className={`h-2 w-2 rounded-full ${preferredQuality == null ? "bg-white" : "bg-white/18"}`} />
                                        <span className="flex-1 text-[14px] font-medium">Auto</span>
                                        <span className="text-[10px] text-white/35">Adaptive</span>
                                    </button>
                                    {qualityChoices.map((choice) => (
                                        <button key={`settings-quality-${choice.height}`} disabled={!choice.available} onClick={() => chooseQualityInSettings(choice)} className={`flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition ${activeQualityHeight === choice.height ? "bg-white/[0.07] text-white" : choice.available ? "text-white/72 hover:bg-white/[0.045]" : "text-white/22"}`}>
                                            <span className={`h-2 w-2 rounded-full ${activeQualityHeight === choice.height ? "bg-white" : "bg-white/18"}`} />
                                            <span className="flex-1 text-[14px] font-medium">{choice.label}</span>
                                            <span className="max-w-[42%] truncate text-[10px] text-white/35">{choice.available ? "Available" : "Unavailable"}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {settingsPage === "download" && (
                                <div className="py-1.5" data-testid="synapse-download-settings-page">
                                    <div className="px-4 pb-3 pt-2">
                                        <p className="text-[13px] font-medium text-white/82">Available downloads</p>
                                        <p className="mt-1 text-[10px] leading-relaxed text-white/34">Pick a ready download below. SynScraper finds the source and quality for you; MP4 downloads are capped at 1080p.</p>
                                    </div>

                                    {downloadLoading && (
                                        <div className="border-t border-white/[0.06] px-4 py-4">
                                            <div className="flex items-center gap-2 text-[11px] text-white/42">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Finding available downloads…
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                {[0, 1, 2].map((item) => <div key={item} className="h-[58px] animate-pulse rounded-xl bg-white/[0.035]" />)}
                                            </div>
                                        </div>
                                    )}

                                    {!downloadLoading && downloadItems.length > 0 && (
                                        <div className="border-t border-white/[0.06]" data-testid="synapse-download-list">
                                            {downloadItems.map((item, index) => {
                                                const isMiami = item.provider === "vidy" && /miami/i.test(item.source);
                                                const qualityLabel = item.quality === "auto" ? "Best ≤1080p" : `${item.quality}p`;
                                                return (
                                                    <div key={item.key} className="flex items-center gap-3 border-b border-white/[0.055] px-4 py-3" data-testid="synapse-download-item">
                                                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.055] text-white/72">
                                                            <Download className="h-4 w-4" strokeWidth={1.8} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <span className="truncate text-[13px] font-medium text-white/88">{item.source}</span>
                                                                {isMiami && index === 0 && <span className="shrink-0 rounded-full bg-white/[0.09] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-white/50">Recommended</span>}
                                                            </div>
                                                            <p className="mt-0.5 text-[10px] text-white/34">MP4 · {qualityLabel}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => startDownloadFromSettings(item)}
                                                            className="shrink-0 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
                                                            data-testid="synapse-download-mp4"
                                                        >
                                                            Download
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {!downloadLoading && !downloadItems.length && (
                                        <div className="border-t border-white/[0.06] px-4 py-5 text-center">
                                            <Download className="mx-auto h-5 w-5 text-white/28" />
                                            <p className="mt-2 text-[11px] text-white/36">No downloadable stream was found.</p>
                                        </div>
                                    )}

                                    {downloadError && <p className="px-4 py-3 text-[10px] leading-relaxed text-white/30">{downloadError}</p>}
                                </div>
                            )}

                            {settingsPage === "speed" && (
                                <div className="p-3">
                                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/[0.08]">
                                        {SPEEDS.map((r) => (
                                            <button key={r} onClick={() => changeRateInSettings(r)} className={`border-b border-r border-white/[0.07] px-3 py-3.5 text-[13px] font-medium transition ${rate === r ? "bg-[#eadb8a] text-[#17140c]" : "bg-transparent text-white/64 hover:bg-white/[0.045] hover:text-white"}`}>{r}x</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {settingsPage === "volume" && (
                                <div className="p-4" data-testid="synapse-volume-settings-page">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[13px] font-medium text-white/76">Volume</p>
                                            <p className="mt-1 text-[10px] text-white/30">Player volume</p>
                                        </div>
                                        <p className="text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-white">{Math.round((muted ? 0 : volume) * 100)}%</p>
                                    </div>
                                    <input
                                        data-testid="synapse-settings-volume-slider"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={muted ? 0 : Math.round(volume * 100)}
                                        onChange={(e) => setVol(Number(e.target.value) / 100)}
                                        className="mt-6 w-full accent-[#eadb8a]"
                                        aria-label="Volume"
                                    />
                                    <div className="mt-2 flex justify-between text-[9px] tabular-nums text-white/25"><span>0%</span><span>50%</span><span>100%</span></div>
                                    <button
                                        type="button"
                                        onClick={toggleMute}
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-[12px] font-medium text-white/68 transition hover:bg-white/[0.06] hover:text-white"
                                    >
                                        {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                        {muted ? "Unmute" : "Mute"}
                                    </button>
                                </div>
                            )}

                            {settingsPage === "subtitles" && (
                                <div className="p-3" data-testid="synapse-friendly-subtitle-settings">
                                    <button
                                        type="button"
                                        onClick={toggleCaptionsPreference}
                                        className="flex w-full items-center gap-3 rounded-[13px] border border-white/[0.065] bg-white/[0.03] px-3.5 py-3 text-left transition hover:bg-white/[0.05]"
                                    >
                                        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/[0.045]"><Subtitles className="h-4 w-4 text-white/60" /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-semibold text-white/86">Subtitles</p>
                                            <p className="mt-0.5 text-[9px] text-white/32">{captionsEnabled ? `${captionLanguageName(preferredCaptionLang)} is enabled` : "Currently turned off"}</p>
                                        </div>
                                        <span className={`relative h-5 w-9 rounded-full transition ${captionsEnabled ? "bg-[#eadb8a]" : "bg-white/[0.12]"}`}>
                                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${captionsEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                                        </span>
                                    </button>

                                    <div className="mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Language</div>
                                    <div className="mt-1.5 overflow-hidden rounded-[12px] border border-white/[0.065] bg-black/20">
                                        <button onClick={turnOffCaptions} className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${!captionsEnabled ? "bg-[#eadb8a]/[0.09]" : "hover:bg-white/[0.04]"}`}>
                                            <span className={`h-2 w-2 rounded-full ${!captionsEnabled ? "bg-[#eadb8a]" : "bg-white/16"}`} />
                                            <span className="flex-1 text-[12px] font-medium text-white/72">Off</span>
                                        </button>
                                        {captionLanguageOptions.map((option) => {
                                            const selected = captionsEnabled && preferredCaptionLang === option.code;
                                            return (
                                                <button key={`settings-caption-${option.code}`} onClick={() => selectCaptionLanguage(option.code)} className={`flex w-full items-center gap-3 border-t border-white/[0.05] px-3.5 py-2.5 text-left transition ${selected ? "bg-[#eadb8a]/[0.09]" : "hover:bg-white/[0.04]"}`}>
                                                    <span className={`h-2 w-2 rounded-full ${selected ? "bg-[#eadb8a]" : "bg-white/16"}`} />
                                                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/74">{option.name}</span>
                                                    <span className="text-[9px] text-white/28">{option.pending ? "Checking" : "Ready"}</span>
                                                </button>
                                            );
                                        })}
                                        {!captionLanguageOptions.length && <p className="px-3.5 py-4 text-[10px] text-white/32">Subtitle languages are still loading.</p>}
                                    </div>

                                    <div className="mt-3 rounded-[13px] border border-white/[0.065] bg-white/[0.025] p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[12px] font-semibold text-white/82">Appearance</p>
                                                <p className="mt-0.5 text-[9px] text-white/30">Simple presets instead of tiny sliders.</p>
                                            </div>
                                            <button onClick={resetCaptionStyle} className="rounded-lg px-2 py-1.5 text-[9px] font-medium text-white/36 transition hover:bg-white/[0.05] hover:text-white">Reset</button>
                                        </div>

                                        <div className="mt-3">
                                            <p className="mb-1.5 text-[10px] font-medium text-white/48">Text size</p>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[["Small", 80], ["Medium", 100], ["Large", 125]].map(([label, value]) => {
                                                    const active = label === "Small" ? captionStyle.size < 90 : label === "Medium" ? captionStyle.size >= 90 && captionStyle.size < 115 : captionStyle.size >= 115;
                                                    return <button key={label} onClick={() => updateCaptionStyle("size", value)} className={`rounded-[9px] px-2 py-2 text-[10px] font-medium transition ${active ? "bg-[#eadb8a] text-[#17140c]" : "bg-white/[0.045] text-white/52 hover:bg-white/[0.07] hover:text-white"}`}>{label}</button>;
                                                })}
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <p className="mb-1.5 text-[10px] font-medium text-white/48">Background</p>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[["None", 0], ["Soft", 45], ["Strong", 75]].map(([label, value]) => {
                                                    const active = label === "None" ? captionStyle.background < 20 : label === "Soft" ? captionStyle.background >= 20 && captionStyle.background < 60 : captionStyle.background >= 60;
                                                    return <button key={label} onClick={() => updateCaptionStyle("background", value)} className={`rounded-[9px] px-2 py-2 text-[10px] font-medium transition ${active ? "bg-[#eadb8a] text-[#17140c]" : "bg-white/[0.045] text-white/52 hover:bg-white/[0.07] hover:text-white"}`}>{label}</button>;
                                                })}
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <p className="mb-1.5 text-[10px] font-medium text-white/48">Position</p>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[["Lower", 68], ["Default", 78], ["Higher", 88]].map(([label, value]) => {
                                                    const active = label === "Lower" ? captionStyle.position < 73 : label === "Default" ? captionStyle.position >= 73 && captionStyle.position < 84 : captionStyle.position >= 84;
                                                    return <button key={label} onClick={() => updateCaptionStyle("position", value)} className={`rounded-[9px] px-2 py-2 text-[10px] font-medium transition ${active ? "bg-[#eadb8a] text-[#17140c]" : "bg-white/[0.045] text-white/52 hover:bg-white/[0.07] hover:text-white"}`}>{label}</button>;
                                                })}
                                            </div>
                                        </div>

                                        <div className="mt-3 border-t border-white/[0.055] pt-1.5">
                                            <CaptionSlider label="Subtitle timing" value={captionStyle.delay} min={-3} max={3} step={0.1} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                            <div className="-mt-1 flex justify-between text-[8px] text-white/22"><span>Earlier</span><span>Later</span></div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.055] pt-3">
                                            <span className="flex-1 text-[10px] font-medium text-white/48">Text color</span>
                                            {["#ffffff", "#ffe66d", "#77e0ff", "#9cff8f"].map((color) => (
                                                <button key={color} onClick={() => updateCaptionStyle("color", color)} className={`h-6 w-6 rounded-full border ${captionStyle.color.toLowerCase() === color ? "border-[#eadb8a] ring-1 ring-[#eadb8a]/45" : "border-white/15"}`} style={{ backgroundColor: color }} aria-label={`Caption color ${color}`} />
                                            ))}
                                        </div>
                                    </div>
                                    {externalCaptionError && <p className="px-1 pt-2 text-[9px] text-red-300/65">{externalCaptionError}</p>}
                                </div>
                            )}

                            {settingsPage === "auto" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">Automatically start playback when a source is ready.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setAutoPlay(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${autoPlay ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>On</button>
                                        <button onClick={() => { setAutoPlay(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!autoPlay ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "boost" && (
                                <div className="p-4">
                                    <div className="flex items-end justify-between">
                                        <div><p className="text-[13px] font-medium text-white/76">Gain</p><p className="mt-1 text-[10px] text-white/30">100% keeps the original stream level</p></div>
                                        <p className="text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-white">{volumeBoost}%</p>
                                    </div>
                                    <input type="range" min="100" max="200" step="5" value={volumeBoost} onChange={(e) => setVolumeBoostValue(e.target.value)} className="mt-6 w-full accent-[#eadb8a]" />
                                    <div className="mt-2 flex justify-between text-[9px] tabular-nums text-white/25"><span>100%</span><span>150%</span><span>200%</span></div>
                                </div>
                            )}

                            {settingsPage === "spatial" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">Adds a wider stereo presentation when the browser supports it.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setSpatialAudio(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${spatialAudio ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>On</button>
                                        <button onClick={() => { setSpatialAudio(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!spatialAudio ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "video" && (
                                <div className="p-4">
                                    <div className="flex items-end justify-between">
                                        <div><p className="text-[13px] font-medium text-white/76">Video size</p><p className="mt-1 text-[10px] text-white/30">Zoom without changing stream quality</p></div>
                                        <p className="text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-white">{videoScale}%</p>
                                    </div>
                                    <input type="range" min="75" max="125" step="1" value={videoScale} onChange={(e) => setVideoScale(Number(e.target.value))} className="mt-6 w-full accent-[#eadb8a]" />
                                    <div className="mt-2 flex justify-between text-[9px] tabular-nums text-white/25"><span>75%</span><span>100%</span><span>125%</span></div>
                                </div>
                            )}

                            {settingsPage === "upscaler" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">A light display enhancement for softer sources. It does not create a native 4K stream.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setUpscaler(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${upscaler ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>Enhance</button>
                                        <button onClick={() => { setUpscaler(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!upscaler ? "bg-[#eadb8a] text-[#17140c]" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
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
