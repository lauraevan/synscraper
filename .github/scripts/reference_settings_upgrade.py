from pathlib import Path
import re

p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

# Modern line icons for the reference-style settings panel. Remove icons only used by the old popover.
old_import = '''    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,\n    Keyboard, ServerCog, X, ShieldCheck, AlertTriangle, Cloud,\n} from "lucide-react";'''
new_import = '''    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,\n    X, ShieldCheck, AlertTriangle, Cloud, ChevronRight, ArrowLeft,\n    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette,\n} from "lucide-react";'''
if old_import not in t:
    raise SystemExit("icon import target not found")
t = t.replace(old_import, new_import, 1)

# Reusable row matching the supplied reference image.
menu_item_end = '''const MenuItem = ({ active, onClick, children, testId, disabled = false }) => (\n    <button\n        data-testid={testId}\n        onClick={onClick}\n        disabled={disabled}\n        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${\n            disabled ? "cursor-not-allowed text-white/20" : active ? "bg-white text-black" : "hover:bg-white/10 text-zinc-200"\n        }`}\n    >\n        {children}\n    </button>\n);\n'''
if menu_item_end not in t:
    raise SystemExit("MenuItem target missing")
row_component = '''\nconst SettingsRow = ({ icon: Icon, label, value, onClick }) => (\n    <button\n        type="button"\n        onClick={onClick}\n        className="group flex w-full items-center gap-4 rounded-[16px] px-5 py-[13px] text-left transition-colors hover:bg-white/[0.045] md:px-6 md:py-[15px]"\n    >\n        <Icon className="h-6 w-6 shrink-0 text-white/78 md:h-[27px] md:w-[27px]" strokeWidth={1.55} />\n        <span className="min-w-0 flex-1 text-[15px] font-normal tracking-[-0.015em] text-white/95 md:text-[18px]">{label}</span>\n        <span className="max-w-[42%] truncate text-right text-[14px] font-normal text-white/62 md:text-[17px]">{value}</span>\n        <ChevronRight className="h-5 w-5 shrink-0 text-white/48" strokeWidth={1.55} />\n    </button>\n);\n'''
t = t.replace(menu_item_end, menu_item_end + row_component, 1)

# Audio boost refs.
old_refs = '''    const pendingSeekRef = useRef(null);\n    const autoCaptionRef = useRef(false);'''
new_refs = '''    const pendingSeekRef = useRef(null);\n    const autoCaptionRef = useRef(false);\n    const autoPlayRef = useRef(true);\n    const audioContextRef = useRef(null);\n    const audioSourceRef = useRef(null);\n    const gainRef = useRef(null);'''
if old_refs not in t:
    raise SystemExit("ref target missing")
t = t.replace(old_refs, new_refs, 1)

# Settings states.
old_state = '''    const [showControls, setShowControls] = useState(true);\n    const [menu, setMenu] = useState(null);\n    const [brandExpanded, setBrandExpanded] = useState(false);\n    const [help, setHelp] = useState(false);'''
new_state = '''    const [showControls, setShowControls] = useState(true);\n    const [menu, setMenu] = useState(null);\n    const [settingsPage, setSettingsPage] = useState("root");\n    const [autoPlay, setAutoPlay] = useState(true);\n    const [volumeBoost, setVolumeBoost] = useState(100);\n    const [spatialAudio, setSpatialAudio] = useState(false);\n    const [videoScale, setVideoScale] = useState(100);\n    const [upscaler, setUpscaler] = useState(false);\n    const [brandExpanded, setBrandExpanded] = useState(false);\n    const [help, setHelp] = useState(false);'''
if old_state not in t:
    raise SystemExit("settings state target missing")
t = t.replace(old_state, new_state, 1)

active_marker = '''    const activeServer = servers.find((s) => s.id === serverId);\n'''
if active_marker not in t:
    raise SystemExit("active server marker missing")
t = t.replace(active_marker, active_marker + '''    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);\n''', 1)

# Autoplay is now controlled by the Settings > Auto page.
old_play = 'video.play().catch(() => {});'
if t.count(old_play) < 2:
    raise SystemExit("expected two autoplay calls")
t = t.replace(old_play, 'if (autoPlayRef.current) video.play().catch(() => {});', 2)

# Cleanup WebAudio with the existing HLS cleanup.
old_cleanup = '''    useEffect(() => () => { if (hlsRef.current) hlsRef.current.destroy(); }, []);'''
new_cleanup = '''    useEffect(() => () => {\n        if (hlsRef.current) hlsRef.current.destroy();\n        if (audioContextRef.current) audioContextRef.current.close().catch(() => {});\n    }, []);'''
if old_cleanup not in t:
    raise SystemExit("cleanup target missing")
t = t.replace(old_cleanup, new_cleanup, 1)

# Settings actions. Existing quality/source functions are preserved for other controls.
change_rate = '''    const changeRate = (r) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };'''
if change_rate not in t:
    raise SystemExit("changeRate target missing")
settings_actions = r'''
    const closeSettings = () => { setMenu(null); setSettingsPage("root"); };
    const selectServerInSettings = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        setServerId(s.id);
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
    const chooseAutoQualityInSettings = () => {
        if (hlsRef.current && levels.length) {
            hlsRef.current.currentLevel = -1;
            setLevel(-1);
            return;
        }
        if (autoServer && autoServer.id !== serverId) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(autoServer.id);
        }
    };
    const chooseQualityInSettings = (choice) => {
        if (!choice?.available) return;
        if (choice.levelIndex >= 0 && hlsRef.current) {
            hlsRef.current.currentLevel = choice.levelIndex;
            setLevel(choice.levelIndex);
            return;
        }
        if (choice.server) {
            pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
            setLevel(-1);
            setServerId(choice.server.id);
        }
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
            // Browser/stream may not allow WebAudio routing; normal audio remains usable.
        }
    };
'''
t = t.replace(change_rate, change_rate + settings_actions, 1)

# Video scale and light display enhancement for the visual Upscaler toggle.
old_video = '''                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover"'''
new_video = '''                className="synapse-video absolute inset-0 w-full h-full bg-black object-cover transition-[transform,filter] duration-200"\n                style={{ transform: `scale(${videoScale / 100})`, filter: upscaler ? "contrast(1.045) saturate(1.025)" : undefined }}'''
if old_video not in t:
    raise SystemExit("video target missing")
t = t.replace(old_video, new_video, 1)

# Replace the old compact quality/speed/source popover with the reference gear button.
settings_pattern = re.compile(
    r'''                                <div className="relative">\n                                    <button\n                                        data-testid="synapse-quality-menu".*?                                    </Popover>\n                                </div>\n\n                                <button onClick=\{togglePip\}''',
    re.S,
)
settings_button = '''                                <div className="relative">\n                                    <button\n                                        data-testid="synapse-quality-menu"\n                                        onClick={() => { setSettingsPage("root"); setMenu(menu === "settings" ? null : "settings"); }}\n                                        className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-full border transition active:scale-95 ${menu === "settings" ? "border-white/20 bg-white/14 text-white" : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/10 hover:text-white"}`}\n                                        title="Settings"\n                                        aria-label="Settings"\n                                    >\n                                        <Settings className="h-[22px] w-[22px] stroke-[1.9]" />\n                                    </button>\n                                </div>\n\n                                <button onClick={togglePip}'''
t, n = settings_pattern.subn(settings_button, t, count=1)
if n != 1:
    raise SystemExit(f"settings popover replacement count={n}")

# Derived labels shown on the root Settings screen.
derived = '''    const resolvePct = ((stepIdx + 1) / STEPS.length) * 100;'''
if derived not in t:
    raise SystemExit("derived marker missing")
extra_derived = '''    const activeExternalCaption = externalCaptions.find((track) => track.id === externalCaptionId);\n    const subtitleSettingsLabel = activeExternalCaption ? (String(activeExternalCaption.source || "").toLowerCase() === "granite" ? "Granite" : "VTT") : sub >= 0 ? "HLS" : "Off";\n    const settingsQualityLabel = level >= 0 ? (levels[level]?.height ? `${levels[level].height}p` : "Manual") : (activeQualityHeight ? (activeQualityHeight === 2160 ? "4K" : `${activeQualityHeight}p`) : "Auto");'''
t = t.replace(derived, derived + "\n" + extra_derived, 1)

# Insert the large centered settings panel before the keyboard shortcut overlay.
help_marker = '''            {help && ('''
if help_marker not in t:
    raise SystemExit("help marker missing")
modal = r'''
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

'''
t = t.replace(help_marker, modal + help_marker, 1)

p.write_text(t)
print("Reference settings panel patched")
