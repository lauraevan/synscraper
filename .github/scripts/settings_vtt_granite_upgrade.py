from pathlib import Path
import re

player_path = Path("frontend/src/components/SynapsePlayer.jsx")
server_path = Path("backend/server.py")

t = player_path.read_text()

# Imports
old_import = '''    Keyboard, ServerCog, X, ShieldCheck, AlertTriangle, Cloud,\n} from "lucide-react";\nimport { getStreams, hlsProxyUrl } from "@/lib/api";'''
new_import = '''    Keyboard, ServerCog, X, ShieldCheck, AlertTriangle, Cloud,\n    ChevronRight, ArrowLeft, AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette,\n} from "lucide-react";\nimport { API, getStreams, hlsProxyUrl } from "@/lib/api";'''
if old_import not in t:
    raise SystemExit("import target not found")
t = t.replace(old_import, new_import, 1)

# External subtitle parsing helpers + settings row component.
marker = '''const CaptionSlider = ({ label, value, min, max, step = 1, suffix = "", onChange }) => ('''
if marker not in t:
    raise SystemExit("CaptionSlider marker not found")
helpers = r'''
const parseVttTime = (value) => {
    const clean = String(value || "").trim().replace(",", ".");
    const parts = clean.split(":").map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return NaN;
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts.length === 1 ? parts[0] : NaN;
};

const parseWebVtt = (value) => {
    const raw = String(value || "").replace(/^\uFEFF/, "").replace(/\r/g, "");
    const cues = [];
    for (const block of raw.split(/\n{2,}/)) {
        const lines = block.split("\n").map((line) => line.trimEnd()).filter(Boolean);
        if (!lines.length || /^WEBVTT(?:\s|$)/i.test(lines[0]) || /^NOTE(?:\s|$)/i.test(lines[0])) continue;
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex < 0) continue;
        const [startRaw, endRawWithSettings] = lines[timingIndex].split("-->");
        const endRaw = String(endRawWithSettings || "").trim().split(/\s+/)[0];
        const start = parseVttTime(startRaw);
        const end = parseVttTime(endRaw);
        const text = lines.slice(timingIndex + 1).join("\n").trim();
        if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) cues.push({ start, end, text });
    }
    return cues;
};

const parseGranitePayload = (value) => {
    const raw = String(value || "").trim();
    try {
        const data = JSON.parse(raw);
        const list = data?.segments || data?.captions || data?.items || data?.results || [];
        const cues = (Array.isArray(list) ? list : []).map((item) => ({
            start: Number(item?.start ?? item?.start_time ?? item?.from ?? item?.begin ?? 0),
            end: Number(item?.end ?? item?.end_time ?? item?.to ?? item?.finish ?? 0),
            text: String(item?.text ?? item?.caption ?? item?.transcript ?? "").trim(),
        })).filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start && cue.text);
        if (cues.length) return cues;
    } catch {
        // Granite can also export WebVTT directly.
    }
    return parseWebVtt(raw);
};

const SettingsRow = ({ icon: Icon, label, value, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-[16px] px-5 py-3.5 text-left transition-colors hover:bg-white/[0.045] md:px-6 md:py-4"
    >
        <Icon className="h-6 w-6 shrink-0 text-white/78 md:h-7 md:w-7" strokeWidth={1.55} />
        <span className="min-w-0 flex-1 text-[15px] font-normal tracking-[-0.015em] text-white/95 md:text-[18px]">{label}</span>
        <span className="max-w-[42%] truncate text-right text-[14px] text-white/62 md:text-[17px]">{value}</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/48" strokeWidth={1.6} />
    </button>
);

'''
t = t.replace(marker, helpers + marker, 1)

# Refs for audio boost.
old_refs = '''    const pendingSeekRef = useRef(null);\n    const autoCaptionRef = useRef(false);'''
new_refs = '''    const pendingSeekRef = useRef(null);\n    const autoCaptionRef = useRef(false);\n    const audioContextRef = useRef(null);\n    const audioSourceRef = useRef(null);\n    const gainRef = useRef(null);'''
if old_refs not in t:
    raise SystemExit("refs target not found")
t = t.replace(old_refs, new_refs, 1)

# New state.
old_state = '''    const [menu, setMenu] = useState(null);\n    const [brandExpanded, setBrandExpanded] = useState(false);\n    const [help, setHelp] = useState(false);'''
new_state = '''    const [menu, setMenu] = useState(null);\n    const [settingsPage, setSettingsPage] = useState("root");\n    const [brandExpanded, setBrandExpanded] = useState(false);\n    const [externalSubtitleSource, setExternalSubtitleSource] = useState("hls");\n    const [externalCues, setExternalCues] = useState([]);\n    const [externalSubtitleLoading, setExternalSubtitleLoading] = useState(false);\n    const [externalSubtitleError, setExternalSubtitleError] = useState("");\n    const [vttSubtitleUrl, setVttSubtitleUrl] = useState("");\n    const [graniteSubtitleUrl, setGraniteSubtitleUrl] = useState("");\n    const [autoPlay, setAutoPlay] = useState(true);\n    const [volumeBoost, setVolumeBoost] = useState(100);\n    const [spatialAudio, setSpatialAudio] = useState(false);\n    const [videoScale, setVideoScale] = useState(100);\n    const [upscaler, setUpscaler] = useState(false);\n    const [help, setHelp] = useState(false);'''
if old_state not in t:
    raise SystemExit("state target not found")
t = t.replace(old_state, new_state, 1)

# Keep autoplay setting current inside HLS callbacks without rebuilding player callbacks.
autoplay_marker = '''    const activeServer = servers.find((s) => s.id === serverId);\n'''
if autoplay_marker not in t:
    raise SystemExit("active server marker missing")
t = t.replace(autoplay_marker, '''    const activeServer = servers.find((s) => s.id === serverId);\n    const autoPlayRef = useRef(autoPlay);\n    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);\n''', 1)

t = t.replace('''                video.play().catch(() => {});''', '''                if (autoPlayRef.current) video.play().catch(() => {});''', 1)
# The direct-media fallback is the next occurrence.
t = t.replace('''            video.play().catch(() => {});''', '''            if (autoPlayRef.current) video.play().catch(() => {});''', 1)

# Unified HLS / VTT / Granite caption rendering.
start = t.find('''    useEffect(() => {\n        if (mode !== "ready" || sub < 0) {''')
end_marker = '''    }, [mode, sub, subs, serverId, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);'''
end = t.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("caption effect target not found")
end += len(end_marker)
new_effect = r'''    useEffect(() => {
        const usingExternal = externalSubtitleSource === "vtt" || externalSubtitleSource === "granite";
        if (mode !== "ready" || (!usingExternal && sub < 0) || (usingExternal && !externalCues.length)) {
            setCaptionText("");
            return undefined;
        }
        const updateCaption = () => {
            const video = videoRef.current;
            if (!video) return;
            const adjustedTime = video.currentTime - Number(captionStyle.delay || 0);
            const tolerance = Number(captionStyle.accuracy) >= 60
                ? Math.min(0.4, Number(captionStyle.accuracy) / 250)
                : 0;
            let text = "";

            if (usingExternal) {
                const cue = externalCues.find((item) => adjustedTime >= item.start - tolerance && adjustedTime <= item.end + tolerance);
                text = cue?.text || "";
            } else {
                const wanted = subs[sub] || {};
                const candidates = Array.from(video.textTracks || []);
                let track = candidates.find((candidate) => {
                    const labelMatch = wanted.name && candidate.label && wanted.name.toLowerCase() === candidate.label.toLowerCase();
                    const lang = wanted.lang || wanted.language;
                    const langMatch = lang && candidate.language && String(lang).toLowerCase() === candidate.language.toLowerCase();
                    return labelMatch || langMatch;
                });
                if (!track) track = candidates[sub];
                if (!track?.cues) {
                    setCaptionText("");
                    return;
                }
                text = Array.from(track.cues)
                    .filter((cue) => adjustedTime >= cue.startTime && adjustedTime <= cue.endTime)
                    .map((cue) => cue.text || "")
                    .filter(Boolean)
                    .join("\n");
                if (!text && tolerance) {
                    const nearby = Array.from(track.cues).find((cue) => adjustedTime >= cue.startTime - tolerance && adjustedTime <= cue.endTime + tolerance);
                    text = nearby?.text || "";
                }
            }

            const next = captionStyle.autoCorrect
                ? autoCorrectCaptionText(text, captionStyle.accuracy)
                : normalizeCaptionText(text);
            setCaptionText((old) => old === next ? old : next);
        };
        updateCaption();
        const timer = window.setInterval(updateCaption, 80);
        return () => window.clearInterval(timer);
    }, [mode, sub, subs, serverId, externalSubtitleSource, externalCues, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);'''
t = t[:start] + new_effect + t[end:]

# Switch HLS captions back to HLS mode when an embedded track is selected.
old_change_sub = '''    const changeSub = (i) => {\n        if (hlsRef.current) hlsRef.current.subtitleTrack = i;\n        setSub(i);\n        if (i < 0) setCaptionText("");\n    };'''
new_change_sub = '''    const changeSub = (i) => {\n        setExternalSubtitleSource("hls");\n        setExternalCues([]);\n        setExternalSubtitleError("");\n        if (hlsRef.current) hlsRef.current.subtitleTrack = i;\n        setSub(i);\n        if (i < 0) setCaptionText("");\n    };'''
if old_change_sub not in t:
    raise SystemExit("changeSub target missing")
t = t.replace(old_change_sub, new_change_sub, 1)

# Functional helpers for settings pages.
change_rate_line = '''    const changeRate = (r) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };'''
if change_rate_line not in t:
    raise SystemExit("changeRate target missing")
extra_functions = r'''
    const changeRateInSettings = (r) => {
        const v = videoRef.current;
        if (v) v.playbackRate = r;
        setRate(r);
        setSettingsPage("root");
    };
    const selectServerInSettings = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        setServerId(s.id);
        setSettingsPage("root");
    };
    const setQualityInSettings = (choice) => {
        if (!choice?.available) return;
        if (choice.levelIndex >= 0 && hlsRef.current) {
            hlsRef.current.currentLevel = choice.levelIndex;
            setLevel(choice.levelIndex);
        } else if (choice.server) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(choice.server.id);
        }
    };
    const setAutoQualityInSettings = () => {
        if (hlsRef.current && levels.length) {
            hlsRef.current.currentLevel = -1;
            setLevel(-1);
        } else if (autoServer && autoServer.id !== serverId) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(autoServer.id);
        }
    };
    const loadExternalSubtitles = async (kind) => {
        const sourceUrl = (kind === "granite" ? graniteSubtitleUrl : vttSubtitleUrl).trim();
        if (!sourceUrl) {
            setExternalSubtitleError(kind === "granite" ? "Paste a Granite VTT or JSON result URL first." : "Paste a WebVTT URL first.");
            return;
        }
        setExternalSubtitleLoading(true);
        setExternalSubtitleError("");
        try {
            const response = await fetch(`${API}/subtitles/external?url=${encodeURIComponent(sourceUrl)}`);
            if (!response.ok) throw new Error(`Subtitle request failed (${response.status})`);
            const raw = await response.text();
            const cues = kind === "granite" ? parseGranitePayload(raw) : parseWebVtt(raw);
            if (!cues.length) throw new Error(kind === "granite" ? "No timed Granite caption segments were found." : "No WebVTT cues were found.");
            if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
            setSub(-1);
            setExternalSubtitleSource(kind);
            setExternalCues(cues);
            setCaptionText("");
        } catch (err) {
            setExternalSubtitleError(err?.message || "Could not load subtitles.");
        } finally {
            setExternalSubtitleLoading(false);
        }
    };
    const useEmbeddedCaptions = () => {
        setExternalSubtitleSource("hls");
        setExternalCues([]);
        setExternalSubtitleError("");
        if (subs.length && sub < 0) changeSub(0);
    };
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
            // Keep normal playback if Web Audio is unavailable for this stream/browser.
        }
    };
    const closeSettings = () => { setMenu(null); setSettingsPage("root"); };
'''
t = t.replace(change_rate_line, change_rate_line + extra_functions, 1)

# Cleanup WebAudio too.
old_cleanup = '''    useEffect(() => () => { if (hlsRef.current) hlsRef.current.destroy(); }, []);'''
new_cleanup = '''    useEffect(() => () => {\n        if (hlsRef.current) hlsRef.current.destroy();\n        if (audioContextRef.current) audioContextRef.current.close().catch(() => {});\n    }, []);'''
if old_cleanup not in t:
    raise SystemExit("cleanup target missing")
t = t.replace(old_cleanup, new_cleanup, 1)

# Video zoom + light visual enhancement. Does not claim native resolution creation.
old_video_class = '''                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover"'''
new_video_class = '''                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover transition-[transform,filter] duration-200"\n                style={{\n                    transform: `scale(${videoScale / 100})`,\n                    filter: upscaler ? "contrast(1.045) saturate(1.025)" : undefined,\n                }}'''
if old_video_class not in t:
    raise SystemExit("video class target missing")
t = t.replace(old_video_class, new_video_class, 1)

old_caption_render = '''            {mode === "ready" && sub >= 0 && captionText && ('''
new_caption_render = '''            {mode === "ready" && captionText && (sub >= 0 || externalSubtitleSource === "vtt" || externalSubtitleSource === "granite") && ('''
if old_caption_render not in t:
    raise SystemExit("caption render condition missing")
t = t.replace(old_caption_render, new_caption_render, 1)

# Replace small quality/speed/source popover with only the gear button.
settings_pattern = re.compile(
    r'''                                <div className="relative">\n                                    <button\n                                        data-testid="synapse-quality-menu".*?                                    </Popover>\n                                </div>\n\n                                <button onClick=\{togglePip\}''',
    re.S,
)
new_settings_button = '''                                <div className="relative">\n                                    <button\n                                        data-testid="synapse-quality-menu"\n                                        onClick={() => { setSettingsPage("root"); setMenu(menu === "settings" ? null : "settings"); }}\n                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-full border transition active:scale-95 ${menu === "settings" ? "border-white/20 bg-white/14 text-white" : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/10 hover:text-white"}`}\n                                        title="Settings"\n                                        aria-label="Settings"\n                                    >\n                                        <Settings className="h-[22px] w-[22px] stroke-[1.9]" />\n                                    </button>\n                                </div>\n\n                                <button onClick={togglePip}'''
t, count = settings_pattern.subn(new_settings_button, t, count=1)
if count != 1:
    raise SystemExit(f"settings popover replacement count={count}")

# Main value helpers near derived values.
derived_marker = '''    const resolvePct = ((stepIdx + 1) / STEPS.length) * 100;'''
if derived_marker not in t:
    raise SystemExit("derived marker missing")
derived_extra = '''    const subtitleSourceLabel = externalSubtitleSource === "granite" ? "Granite" : externalSubtitleSource === "vtt" ? "VTT" : sub >= 0 ? "HLS" : "Off";\n    const qualityLabel = level >= 0 ? (levels[level]?.height ? `${levels[level].height}p` : "Manual") : (activeQualityHeight ? (activeQualityHeight === 2160 ? "4K" : `${activeQualityHeight}p`) : "Auto");'''
t = t.replace(derived_marker, derived_marker + "\n" + derived_extra, 1)

# Centered reference-matching Settings modal + sub-pages.
help_marker = '''            {help && ('''
if help_marker not in t:
    raise SystemExit("help marker missing")
modal = r'''
            {menu === "settings" && mode === "ready" && (
                <div
                    data-testid="synapse-settings-overlay"
                    className="absolute inset-0 z-[70] flex items-center justify-center bg-black/18 p-3 md:p-6"
                    onClick={closeSettings}
                >
                    <div
                        data-testid="synapse-settings-panel"
                        className="flex max-h-[88%] w-[660px] max-w-[94vw] flex-col overflow-hidden rounded-[28px] border border-white/[0.10] bg-[#070b11]/[0.94] shadow-[0_26px_80px_rgba(0,0,0,0.55)] backdrop-blur-[28px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex min-h-[74px] items-center border-b border-white/[0.09] px-5 md:min-h-[88px] md:px-7">
                            {settingsPage !== "root" && (
                                <button
                                    type="button"
                                    onClick={() => setSettingsPage("root")}
                                    className="mr-3 grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/8 hover:text-white"
                                    aria-label="Back to settings"
                                >
                                    <ArrowLeft className="h-5 w-5" strokeWidth={1.7} />
                                </button>
                            )}
                            <h2 className="flex-1 text-[20px] font-semibold tracking-[-0.025em] text-white md:text-[26px]">
                                {settingsPage === "root" ? "Settings" : settingsPage === "server" ? "Server" : settingsPage === "speed" ? "Speed" : settingsPage === "subtitles" ? "Subtitle style" : settingsPage === "auto" ? "Auto" : settingsPage === "boost" ? "Volume boost" : settingsPage === "spatial" ? "Spatial audio" : settingsPage === "video" ? "Video" : "Upscaler"}
                            </h2>
                            <button
                                type="button"
                                onClick={closeSettings}
                                className="grid h-9 w-9 place-items-center rounded-full border border-white/70 text-white/90 transition hover:bg-white/10 md:h-10 md:w-10"
                                aria-label="Close settings"
                            >
                                <X className="h-5 w-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-2.5 scrollbar-none md:p-3.5">
                            {settingsPage === "root" && (
                                <div className="space-y-0.5">
                                    <SettingsRow icon={Cloud} label="Server" value={activeServer?.name || "Auto"} onClick={() => setSettingsPage("server")} />
                                    <SettingsRow icon={Gauge} label="Speed" value={`${rate}x`} onClick={() => setSettingsPage("speed")} />
                                    <SettingsRow icon={Palette} label="Subtitle style" value={subtitleSourceLabel} onClick={() => setSettingsPage("subtitles")} />
                                    <SettingsRow icon={RefreshCw} label="Auto" value={autoPlay ? "Play" : "Off"} onClick={() => setSettingsPage("auto")} />
                                    <SettingsRow icon={Volume2} label="Volume boost" value={`${volumeBoost}%`} onClick={() => setSettingsPage("boost")} />
                                    <SettingsRow icon={AudioWaveform} label="Spatial audio" value={spatialAudio ? "On" : "Off"} onClick={() => setSettingsPage("spatial")} />
                                    <SettingsRow icon={CirclePlus} label="Video" value={`${videoScale}%`} onClick={() => setSettingsPage("video")} />
                                    <SettingsRow icon={WandSparkles} label="Upscaler" value={upscaler ? "On" : "Off"} onClick={() => setSettingsPage("upscaler")} />
                                </div>
                            )}

                            {settingsPage === "server" && (
                                <div className="space-y-1 py-1">
                                    {servers.map((s) => (
                                        <button key={s.id} onClick={() => selectServerInSettings(s)} className={`flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition ${serverId === s.id ? "bg-white text-black" : "text-white/85 hover:bg-white/[0.06]"}`}>
                                            <Cloud className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                                            <span className="min-w-0 flex-1 truncate text-[16px]">{s.name}</span>
                                            <img src="https://flagsapi.com/US/flat/24.png" alt="US" className="h-4 w-6 rounded-[2px] object-cover" />
                                            {serverId === s.id && <span className="text-xs opacity-55">Selected</span>}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {settingsPage === "speed" && (
                                <div className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-3">
                                    {SPEEDS.map((r) => (
                                        <button key={r} onClick={() => changeRateInSettings(r)} className={`rounded-2xl border px-4 py-4 text-sm transition ${rate === r ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.025] text-white/80 hover:bg-white/[0.07]"}`}>{r}x</button>
                                    ))}
                                </div>
                            )}

                            {settingsPage === "subtitles" && (
                                <div className="space-y-4 p-1">
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={useEmbeddedCaptions} className={`rounded-2xl border px-3 py-3 text-sm ${externalSubtitleSource === "hls" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.025] text-white/70"}`}>HLS</button>
                                        <button onClick={() => { setExternalSubtitleSource("vtt"); setExternalSubtitleError(""); }} className={`rounded-2xl border px-3 py-3 text-sm ${externalSubtitleSource === "vtt" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.025] text-white/70"}`}>VTT</button>
                                        <button onClick={() => { setExternalSubtitleSource("granite"); setExternalSubtitleError(""); }} className={`rounded-2xl border px-3 py-3 text-sm ${externalSubtitleSource === "granite" ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.025] text-white/70"}`}>Granite</button>
                                    </div>

                                    {externalSubtitleSource === "hls" && (
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
                                            <button onClick={() => changeSub(-1)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${sub < 0 ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}><span>Off</span></button>
                                            {subs.map((track, i) => (
                                                <button key={i} onClick={() => changeSub(i)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${sub === i ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}>
                                                    <span>{track.name || track.lang || `Track ${i + 1}`}</span><span className="text-[10px] uppercase opacity-45">{track.lang || track.language || "CC"}</span>
                                                </button>
                                            ))}
                                            {!subs.length && <p className="px-3 py-3 text-xs text-white/40">This stream does not expose an embedded subtitle track.</p>}
                                        </div>
                                    )}

                                    {(externalSubtitleSource === "vtt" || externalSubtitleSource === "granite") && (
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                                            <label className="text-xs font-medium text-white/55">{externalSubtitleSource === "granite" ? "Granite VTT / JSON URL" : "WebVTT URL"}</label>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                                <input
                                                    type="url"
                                                    value={externalSubtitleSource === "granite" ? graniteSubtitleUrl : vttSubtitleUrl}
                                                    onChange={(e) => externalSubtitleSource === "granite" ? setGraniteSubtitleUrl(e.target.value) : setVttSubtitleUrl(e.target.value)}
                                                    placeholder={externalSubtitleSource === "granite" ? "https://.../granite-captions.vtt" : "https://.../captions.vtt"}
                                                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
                                                />
                                                <button disabled={externalSubtitleLoading} onClick={() => loadExternalSubtitles(externalSubtitleSource)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-45">
                                                    {externalSubtitleLoading ? "Loading…" : "Load"}
                                                </button>
                                            </div>
                                            <p className="mt-2 text-[11px] leading-relaxed text-white/35">{externalSubtitleSource === "granite" ? "Accepts Granite Speech timed JSON or Granite-exported WebVTT." : "Loads a standard WEBVTT file through SynPlayer's protected subtitle proxy."}</p>
                                            {externalSubtitleError && <p className="mt-2 text-xs text-red-300/85">{externalSubtitleError}</p>}
                                            {externalCues.length > 0 && <p className="mt-2 text-xs text-white/55">Loaded {externalCues.length} timed cues.</p>}
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-2">
                                        <div className="flex items-center justify-between px-3 py-2">
                                            <p className="text-xs uppercase tracking-[0.16em] text-white/38">Appearance & sync</p>
                                            <button onClick={resetCaptionStyle} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 hover:bg-white/10">Reset</button>
                                        </div>
                                        <CaptionSlider label="Size" value={captionStyle.size} min={60} max={180} suffix="%" onChange={(v) => updateCaptionStyle("size", v)} />
                                        <CaptionSlider label="Transparency" value={captionStyle.transparency} min={0} max={90} suffix="%" onChange={(v) => updateCaptionStyle("transparency", v)} />
                                        <CaptionSlider label="Boldness" value={captionStyle.weight} min={300} max={900} step={100} onChange={(v) => updateCaptionStyle("weight", v)} />
                                        <CaptionSlider label="Outline" value={captionStyle.outline} min={0} max={4} step={0.5} suffix="px" onChange={(v) => updateCaptionStyle("outline", v)} />
                                        <CaptionSlider label="Background" value={captionStyle.background} min={0} max={100} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                        <CaptionSlider label="Position" value={captionStyle.position} min={55} max={92} suffix="%" onChange={(v) => updateCaptionStyle("position", v)} />
                                        <CaptionSlider label="Delay" value={captionStyle.delay} min={-5} max={5} step={0.05} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                        <CaptionSlider label="Accuracy assist" value={captionStyle.accuracy} min={0} max={100} suffix="%" onChange={(v) => updateCaptionStyle("accuracy", v)} />
                                        <div className="flex items-center gap-3 px-3 py-3">
                                            <input type="color" value={captionStyle.color} onChange={(e) => updateCaptionStyle("color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" aria-label="Subtitle color" />
                                            <span className="flex-1 text-sm text-white/70">Subtitle color</span>
                                            <button role="switch" aria-checked={captionStyle.autoCorrect} onClick={() => updateCaptionStyle("autoCorrect", !captionStyle.autoCorrect)} className={`relative h-6 w-11 rounded-full transition ${captionStyle.autoCorrect ? "bg-white" : "bg-white/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${captionStyle.autoCorrect ? "left-6 bg-black" : "left-1 bg-white/60"}`} /></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "auto" && (
                                <div className="grid grid-cols-2 gap-3 p-2">
                                    <button onClick={() => { setAutoPlay(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 text-base ${autoPlay ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Play</button>
                                    <button onClick={() => { setAutoPlay(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 text-base ${!autoPlay ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button>
                                </div>
                            )}

                            {settingsPage === "boost" && (
                                <div className="p-5">
                                    <div className="flex items-end justify-between"><p className="text-sm text-white/55">Gain</p><p className="text-3xl font-medium tabular-nums">{volumeBoost}%</p></div>
                                    <input type="range" min="100" max="200" step="5" value={volumeBoost} onChange={(e) => setVolumeBoostValue(e.target.value)} className="mt-6 w-full accent-white" />
                                    <p className="mt-4 text-xs leading-relaxed text-white/35">Uses Web Audio gain when the browser allows it. 100% is the untouched stream level.</p>
                                </div>
                            )}

                            {settingsPage === "spatial" && (
                                <div className="grid grid-cols-2 gap-3 p-2">
                                    <button onClick={() => { setSpatialAudio(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${!spatialAudio ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button>
                                    <button onClick={() => { setSpatialAudio(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${spatialAudio ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>On</button>
                                </div>
                            )}

                            {settingsPage === "video" && (
                                <div className="space-y-5 p-4">
                                    <div>
                                        <div className="flex items-center justify-between text-sm"><span className="text-white/55">Video size</span><span className="tabular-nums text-white/85">{videoScale}%</span></div>
                                        <input type="range" min="75" max="125" step="1" value={videoScale} onChange={(e) => setVideoScale(Number(e.target.value))} className="mt-3 w-full accent-white" />
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div>
                                        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/38">Quality · {qualityLabel}</p>
                                        <button disabled={!autoQualityAvailable} onClick={setAutoQualityInSettings} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${level === -1 && activeQualityHeight === 0 ? "bg-white text-black" : autoQualityAvailable ? "text-white/75 hover:bg-white/[0.06]" : "text-white/20"}`}><span>Auto</span><span className="text-xs opacity-45">Adaptive</span></button>
                                        {qualityChoices.map((choice) => (
                                            <button key={choice.height} disabled={!choice.available} onClick={() => setQualityInSettings(choice)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${activeQualityHeight === choice.height ? "bg-white text-black" : choice.available ? "text-white/75 hover:bg-white/[0.06]" : "text-white/20"}`}><span>{choice.label}</span><span className="text-[10px] opacity-45">{choice.available ? (choice.levelIndex >= 0 ? "HLS" : choice.server?.name) : "Unavailable"}</span></button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {settingsPage === "upscaler" && (
                                <div className="p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => { setUpscaler(false); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${!upscaler ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Off</button>
                                        <button onClick={() => { setUpscaler(true); setSettingsPage("root"); }} className={`rounded-2xl border px-4 py-6 ${upscaler ? "border-white bg-white text-black" : "border-white/10 text-white/70"}`}>Enhance</button>
                                    </div>
                                    <p className="mt-4 text-xs leading-relaxed text-white/35">Enhance applies a light display filter only; it does not invent a native 4K rendition.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

'''
t = t.replace(help_marker, modal + help_marker, 1)

player_path.write_text(t)

# Backend public text proxy for VTT / Granite timed subtitle exports.
s = server_path.read_text()
old_imports = '''import logging\nimport os\nfrom pathlib import Path\nfrom urllib.parse import quote\n'''
new_imports = '''import logging\nimport os\nimport ipaddress\nimport socket\nfrom pathlib import Path\nfrom urllib.parse import quote, urljoin, urlparse\n'''
if old_imports not in s:
    raise SystemExit("server import target missing")
s = s.replace(old_imports, new_imports, 1)

server_marker = '''# ----------------------- Stream scraping -----------------------\n'''
if server_marker not in s:
    raise SystemExit("server stream marker missing")
proxy_code = r'''
# ----------------------- External subtitles -----------------------
def _validate_public_subtitle_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(400, "subtitle URL must be public http/https")
    host = parsed.hostname.lower().strip(".")
    if host == "localhost" or host.endswith(".localhost"):
        raise HTTPException(400, "local subtitle hosts are not allowed")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except OSError:
        raise HTTPException(400, "subtitle host could not be resolved")
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if not addr.is_global:
            raise HTTPException(400, "private subtitle hosts are not allowed")
    return value


@api_router.get("/subtitles/external")
async def external_subtitles(url: str = Query(...)):
    current = _validate_public_subtitle_url(url)
    headers = {"User-Agent": UA, "Accept": "text/vtt,text/plain,application/json;q=0.9,*/*;q=0.2"}
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as c:
        for _ in range(4):
            r = await c.get(current, headers=headers)
            if r.status_code in (301, 302, 303, 307, 308):
                location = r.headers.get("location")
                if not location:
                    raise HTTPException(502, "subtitle redirect had no location")
                current = _validate_public_subtitle_url(urljoin(current, location))
                continue
            if r.status_code >= 400:
                raise HTTPException(r.status_code, "subtitle source request failed")
            body = r.content
            if len(body) > 5_000_000:
                raise HTTPException(413, "subtitle file is too large")
            content_type = r.headers.get("content-type", "").lower()
            if not (content_type.startswith("text/") or "json" in content_type or "octet-stream" in content_type or current.lower().split("?")[0].endswith((".vtt", ".json"))):
                raise HTTPException(415, "subtitle source must be WebVTT, text, or timed JSON")
            media_type = "application/json" if "json" in content_type or current.lower().split("?")[0].endswith(".json") else "text/vtt"
            return Response(body, media_type=media_type, headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300"})
    raise HTTPException(502, "too many subtitle redirects")


'''
s = s.replace(server_marker, proxy_code + server_marker, 1)
server_path.write_text(s)

print("Patched SynPlayer settings, VTT/Granite subtitles, and subtitle proxy")
