from pathlib import Path

path = Path("frontend/src/components/SynapsePlayer.jsx")
s = path.read_text()


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"missing patch target: {label}")
    s = s.replace(old, new, 1)


# Warmer, flatter PStream-inspired surfaces.
replace_once(
    'className={`absolute bottom-14 right-0 overflow-y-auto scrollbar-none rounded-2xl bg-black/88 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl z-30 ${wide ? "w-[370px] max-w-[calc(100vw-2rem)] max-h-[min(72vh,590px)]" : "min-w-[220px] max-h-80"}`}',
    'className={`absolute bottom-14 right-0 z-30 overflow-y-auto rounded-[14px] border border-white/[0.09] bg-[#0d0c0a]/[0.97] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.58)] backdrop-blur-xl scrollbar-none ${wide ? "w-[330px] max-w-[calc(100vw-2rem)] max-h-[min(70vh,540px)]" : "min-w-[205px] max-h-80"}`}',
    'popover surface',
)
replace_once(
    'disabled ? "cursor-not-allowed text-white/20" : active ? "bg-white text-black" : "hover:bg-white/10 text-zinc-200"',
    'disabled ? "cursor-not-allowed text-white/20" : active ? "bg-[#eadb8a] text-[#17140c]" : "text-white/72 hover:bg-white/[0.055] hover:text-white"',
    'popover item theme',
)
replace_once(
    '<label className="block px-3 py-2.5">',
    '<label className="block py-2.5">',
    'caption slider padding',
)
replace_once(
    '<span className="text-white/70">{label}</span>\n            <span className="tabular-nums text-white/45">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>',
    '<span className="font-medium text-white/72">{label}</span>\n            <span className="rounded-md bg-white/[0.055] px-1.5 py-0.5 tabular-nums text-white/48">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>',
    'caption slider labels',
)
replace_once(
    'className="h-1.5 w-full cursor-pointer accent-white"',
    'className="h-1.5 w-full cursor-pointer accent-[#eadb8a]"',
    'caption slider accent',
)

# Player frame and the warm SynPlayer accent used throughout the controls.
replace_once(
    'className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden border border-white/[0.08] select-none text-white shadow-[0_20px_65px_rgba(0,0,0,0.38)]"',
    'className="relative w-full aspect-video overflow-hidden rounded-[14px] border border-white/[0.06] bg-black text-white shadow-[0_16px_48px_rgba(0,0,0,0.34)] select-none"',
    'player frame',
)
replace_once(
    '<div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${seekPct}%` }} />',
    '<div className="absolute inset-y-0 left-0 bg-[#eadb8a]" style={{ width: `${seekPct}%` }} />',
    'seek progress accent',
)
replace_once(
    'className="absolute w-3.5 h-3.5 rounded-full bg-white -translate-x-1/2 pointer-events-none shadow-[0_1px_6px_rgba(0,0,0,0.35)]"',
    'className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#eadb8a] shadow-[0_1px_6px_rgba(0,0,0,0.35)] pointer-events-none"',
    'seek thumb accent',
)
replace_once(
    '${menu === "sources" ? "scale-105 text-white" : "text-white/80 hover:scale-105 hover:text-white"}',
    '${menu === "sources" ? "scale-105 text-[#eadb8a]" : "text-white/75 hover:scale-105 hover:text-white"}',
    'source button accent',
)
replace_once(
    '${sub >= 0 || externalCaptionId ? "text-white" : "text-white/85 hover:text-white"}',
    '${sub >= 0 || externalCaptionId ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}',
    'caption button accent',
)
replace_once(
    '${menu === "quality" ? "text-white" : "text-white/85 hover:text-white"}',
    '${menu === "quality" ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}',
    'quality button accent',
)
replace_once(
    '${menu === "settings" ? "text-white" : "text-white/85 hover:text-white"}',
    '${menu === "settings" ? "text-[#eadb8a]" : "text-white/82 hover:text-white"}',
    'settings button accent',
)

# Larger branded SynPlayer wordmark beside the timestamp; no separator dot.
old_brand = '''                            <span className="hidden sm:inline text-[11px] md:text-[13px] font-semibold tracking-[0.04em] text-white/38 whitespace-nowrap" data-testid="synplayer-label">
                                <span className="mr-2 text-white/18">·</span>SynPlayer
                            </span>
'''
new_brand = '''                            <span
                                className="hidden whitespace-nowrap text-[15px] font-bold tracking-[-0.04em] sm:inline-flex md:text-[18px]"
                                data-testid="synplayer-label"
                                style={{ fontFamily: "'Avenir Next', 'SF Pro Display', Inter, ui-sans-serif, system-ui, sans-serif" }}
                            >
                                <span className="text-white/95">Syn</span><span className="text-[#eadb8a]">Player</span>
                            </span>
'''
replace_once(old_brand, new_brand, 'SynPlayer wordmark')

# Smaller, darker source selector.
source_replacements = [
    ('className="absolute inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[5px] pointer-events-auto"',
     'className="absolute inset-0 z-[95] flex items-center justify-center bg-black/68 px-4 py-6 backdrop-blur-[3px] pointer-events-auto"', 'source overlay'),
    ('className="w-[min(92vw,600px)] max-h-[min(82vh,680px)] overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#242424] shadow-[0_28px_95px_rgba(0,0,0,0.72)]"',
     'className="w-[min(90vw,480px)] max-h-[min(72vh,580px)] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#10100f] shadow-[0_24px_80px_rgba(0,0,0,0.74)]"', 'source panel'),
    ('className="flex h-[74px] items-center border-b border-white/[0.15] px-6 md:px-7"',
     'className="flex h-[58px] items-center border-b border-white/[0.08] px-4.5 md:px-5"', 'source header'),
    ('className="flex-1 text-[20px] font-medium tracking-[-0.02em] text-white/95 md:text-[22px]"',
     'className="flex-1 text-[15px] font-semibold tracking-[-0.02em] text-white/92 md:text-[16px]"', 'source title'),
    ('className="grid h-11 w-11 place-items-center rounded-full text-white/72 transition hover:bg-white/[0.06] hover:text-white"',
     'className="grid h-8 w-8 place-items-center rounded-full text-white/48 transition hover:bg-white/[0.05] hover:text-white"', 'source close button'),
    ('<X className="h-8 w-8" strokeWidth={1.55} />', '<X className="h-5 w-5" strokeWidth={1.7} />', 'source close icon'),
    ('className="max-h-[min(67vh,570px)] overflow-y-auto px-3 py-2 scrollbar-none md:px-4 md:py-3"',
     'className="max-h-[min(59vh,490px)] overflow-y-auto px-2.5 py-2 scrollbar-none md:px-3"', 'source list'),
    ('className={`group flex min-h-[76px] items-center rounded-[16px] px-2 transition ${s.available ? "hover:bg-white/[0.045]" : "opacity-40"}`}',
     'className={`group flex min-h-[60px] items-center rounded-[12px] px-1 transition ${s.available ? "hover:bg-white/[0.045]" : "opacity-35"}`}', 'source row'),
    ('className={`flex min-w-0 flex-1 items-center gap-4 px-2 py-3 text-left ${s.available ? "cursor-pointer" : "cursor-not-allowed"}`}',
     'className={`flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left ${s.available ? "cursor-pointer" : "cursor-not-allowed"}`}', 'source row button'),
    ('className="flex h-9 w-10 shrink-0 items-center justify-center"', 'className="flex h-7 w-8 shrink-0 items-center justify-center"', 'source badge slot'),
    ('className="h-8 w-10 object-contain"', 'className="h-6 w-8 object-contain"', 'source 4k badge'),
    ('className="h-6 w-8 rounded-[2px] object-cover"', 'className="h-5 w-7 rounded-[2px] object-cover"', 'source flag'),
    ('text-[17px] font-medium tracking-[-0.015em] md:text-[19px] ${selected ? "text-[#ecd36d]" : "text-white/95"}',
     'text-[14px] font-semibold tracking-[-0.015em] md:text-[15px] ${selected ? "text-[#eadb8a]" : "text-white/88"}', 'source name'),
    ('className="mt-0.5 truncate text-[12px] text-white/38 md:text-[13px]"', 'className="mt-0.5 truncate text-[10px] text-white/34 md:text-[11px]"', 'source subtitle'),
    ('className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${favorite ? "text-[#efd268]" : "text-[#e2c45f] hover:bg-white/[0.05] hover:text-[#ffe28a]"}`}',
     'className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${favorite ? "text-[#eadb8a]" : "text-white/24 hover:bg-white/[0.05] hover:text-[#eadb8a]"}`}', 'source favorite button'),
    ('<Star className={`h-7 w-7 ${favorite ? "fill-current" : ""}`} strokeWidth={1.65} />', '<Star className={`h-[18px] w-[18px] ${favorite ? "fill-current" : ""}`} strokeWidth={1.7} />', 'source favorite icon'),
    ('className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0b6f62] text-white shadow-[0_4px_18px_rgba(0,0,0,0.24)]"',
     'className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#332e18] text-[#eadb8a]"', 'source selected badge'),
    ('<Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={1.4} />', '<Play className="ml-0.5 h-3.5 w-3.5 fill-current" strokeWidth={1.5} />', 'source selected icon'),
]
for old, new, label in source_replacements:
    replace_once(old, new, label)

# Friendlier compact quick-subtitle menu.
quick_start = s.index('                                    <Popover open={menu === "subs"} wide>')
quick_end = s.index('                                    </Popover>', quick_start) + len('                                    </Popover>')
quick_subtitles = '''                                    <Popover open={menu === "subs"} wide>
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
                                    </Popover>'''
s = s[:quick_start] + quick_subtitles + s[quick_end:]

# PStream-inspired settings panel surface and compact header.
replace_once(
    'className="absolute bottom-[76px] right-3 flex max-h-[72%] w-[430px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[18px] border border-white/[0.10] bg-[#090909]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl md:bottom-[92px] md:right-7"',
    'className="absolute bottom-[70px] right-3 flex max-h-[78%] w-[372px] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-[16px] border border-white/[0.085] bg-[#0d0c0a]/[0.985] shadow-[0_22px_68px_rgba(0,0,0,0.68)] backdrop-blur-xl md:bottom-[84px] md:right-6"',
    'settings panel',
)
replace_once(
    'className="flex h-[58px] shrink-0 items-center border-b border-white/[0.08] px-3.5"',
    'className="flex h-[50px] shrink-0 items-center border-b border-white/[0.07] px-3"',
    'settings header',
)
replace_once(') : <div className="w-9" />}', ') : <div className="w-1" />}', 'settings root spacer')
replace_once(
    'className="truncate text-[15px] font-semibold tracking-[-0.015em] text-white"',
    'className="truncate text-[14px] font-semibold tracking-[-0.02em] text-white/94"',
    'settings title style',
)
replace_once(
    '{settingsPage === "root" && <p className="mt-0.5 text-[10px] text-white/32">Playback preferences</p>}',
    '{settingsPage === "root" && <p className="mt-0.5 text-[9px] font-medium text-[#eadb8a]/60">SynPlayer</p>}',
    'settings subtitle',
)
replace_once('server: "Source",', 'server: "Server",', 'settings server title')
replace_once('subtitles: "Captions",', 'subtitles: "Subtitle settings",', 'settings subtitles title')

# Replace the root settings list with PStream-like status cards and compact action rows.
root_start = s.index('                            {settingsPage === "root" && (')
server_start = s.index('                            {settingsPage === "server" && (', root_start)
new_root = '''                            {settingsPage === "root" && (
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

'''
s = s[:root_start] + new_root + s[server_start:]

# Friendlier subtitle settings: plain language, presets, and only one advanced timing slider.
sub_start = s.index('                            {settingsPage === "subtitles" && (')
auto_start = s.index('                            {settingsPage === "auto" && (', sub_start)
new_subtitles = '''                            {settingsPage === "subtitles" && (
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

'''
s = s[:sub_start] + new_subtitles + s[auto_start:]

# Theme the remaining native settings pages so they feel like the same player.
s = s.replace('accent-white', 'accent-[#eadb8a]')
s = s.replace('rate === r ? "bg-white text-black"', 'rate === r ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('autoPlay ? "bg-white text-black"', 'autoPlay ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('!autoPlay ? "bg-white text-black"', '!autoPlay ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('spatialAudio ? "bg-white text-black"', 'spatialAudio ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('!spatialAudio ? "bg-white text-black"', '!spatialAudio ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('upscaler ? "bg-white text-black"', 'upscaler ? "bg-[#eadb8a] text-[#17140c]"')
s = s.replace('!upscaler ? "bg-white text-black"', '!upscaler ? "bg-[#eadb8a] text-[#17140c]"')

path.write_text(s)
print("patched PStream-inspired SynPlayer theme, compact sources, and friendly subtitle settings")
