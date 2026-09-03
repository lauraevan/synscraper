from pathlib import Path

path = Path("frontend/src/components/SynapsePlayer.jsx")
s = path.read_text()


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"missing patch target: {label}")
    s = s.replace(old, new, 1)


# Throttle control wake/timer churn from mousemove events.
replace_once(
    '    const hideTimer = useRef(null);\n',
    '    const hideTimer = useRef(null);\n    const wakeThrottleRef = useRef(0);\n',
    'wake throttle ref',
)

old_background_start = s.index('        const startBackground = (exclude) => {')
old_background_end = s.index('        const quick = getStreams(', old_background_start)
new_background = '''        const startBackground = (exclude) => {
            if (backgroundPromise) return backgroundPromise;

            const excluded = new Set(
                String(exclude || "")
                    .split(",")
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean),
            );
            const providers = ["castle", "vidlink", "vidnest", "vidzee", "vidrock", "vidy", "cinejoy", "vidcore", "vixsrc"];
            const providerQueue = providers.filter((provider) => !excluded.has(provider));

            if (!providerQueue.length) {
                backgroundPromise = Promise.resolve([]);
                if (alive) setSourcesLoading(false);
                return backgroundPromise;
            }

            const loadProvider = (provider) => getStreams(mediaType, id, season, episode, {
                provider,
                mirror: provider === "vidy" ? "fast" : undefined,
                timeout: provider === "cinejoy" ? 12000 : 9500,
                ...streamResolveHints,
            })
                .then((data) => mergePayload(data, true))
                .catch(() => []);

            // Keep provider discovery progressive instead of hammering every resolver at once.
            // Three concurrent lookups keeps backup sources arriving quickly without competing
            // with the active HLS stream for CPU/network during startup.
            backgroundPromise = (async () => {
                const collected = [];
                const batchSize = 3;
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

'''
s = s[:old_background_start] + new_background + s[old_background_end:]

replace_once(
    '                    700,\n                );\n                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);',
    '                    1800,\n                );\n                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);',
    'background startup delay',
)

# Caption polling/preflight should not compete with video playback.
replace_once(
    '        const timer = window.setInterval(updateCaption, 80);',
    '        const timer = window.setInterval(updateCaption, 160);',
    'caption poll rate',
)
replace_once(
    '        const primaryDelay = captionsEnabled ? 0 : 1400;',
    '        const primaryDelay = captionsEnabled ? 0 : 2500;',
    'caption primary delay',
)
replace_once(
    '                captionsEnabled ? 500 : 1800,',
    '                captionsEnabled ? 2500 : 8000,',
    'caption secondary delay',
)

old_wake = '''    const wake = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => { if (playing) { setShowControls(false); setMenu(null); } }, 3200);
    }, [playing]);
'''
new_wake = '''    const wake = useCallback(() => {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - wakeThrottleRef.current < 120) return;
        wakeThrottleRef.current = now;
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => { if (playing) { setShowControls(false); setMenu(null); } }, 3200);
    }, [playing]);
'''
replace_once(old_wake, new_wake, 'wake function')

# Smaller center playback controls.
replace_once(
    'className={`absolute inset-0 z-20 flex items-center justify-center gap-[11vw] max-md:gap-16 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}',
    'className={`absolute inset-0 z-20 flex items-center justify-center gap-[8vw] max-md:gap-10 transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}',
    'center controls spacing',
)
replace_once(
    'className="relative w-20 h-20 md:w-24 md:h-24 text-white/90 hover:text-white active:scale-95 transition" aria-label="Back 10 seconds"',
    'className="relative w-14 h-14 md:w-16 md:h-16 text-white/90 hover:text-white active:scale-95 transition" aria-label="Back 10 seconds"',
    'back button size',
)
replace_once(
    '<span className="absolute inset-0 flex items-center justify-center text-xl md:text-2xl font-semibold pt-1">10</span>',
    '<span className="absolute inset-0 flex items-center justify-center text-sm md:text-base font-semibold pt-0.5">10</span>',
    'back button text size',
)
replace_once(
    'className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform drop-shadow-[0_5px_20px_rgba(0,0,0,0.45)]"',
    'className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform drop-shadow-[0_4px_14px_rgba(0,0,0,0.38)]"',
    'play button size',
)
replace_once(
    '{playing ? <Pause className="w-16 h-16 md:w-20 md:h-20 fill-current stroke-[1.2]" /> : <Play className="w-20 h-20 md:w-24 md:h-24 fill-current stroke-[1.2] ml-2" />}',
    '{playing ? <Pause className="w-11 h-11 md:w-14 md:h-14 fill-current stroke-[1.2]" /> : <Play className="w-14 h-14 md:w-16 md:h-16 fill-current stroke-[1.2] ml-1.5" />}',
    'play icon size',
)
replace_once(
    'className="relative w-20 h-20 md:w-24 md:h-24 text-white/90 hover:text-white active:scale-95 transition" aria-label="Forward 10 seconds"',
    'className="relative w-14 h-14 md:w-16 md:h-16 text-white/90 hover:text-white active:scale-95 transition" aria-label="Forward 10 seconds"',
    'forward button size',
)
replace_once(
    '<span className="absolute inset-0 flex items-center justify-center text-xl md:text-2xl font-semibold pt-1">10</span>',
    '<span className="absolute inset-0 flex items-center justify-center text-sm md:text-base font-semibold pt-0.5">10</span>',
    'forward button text size',
)

# Bottom-left: keep mute button, remove inline volume slider, add SynPlayer branding beside time.
old_audio = '''                            <div className="flex min-w-[118px] items-center gap-2 md:min-w-[168px] md:gap-3">
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
'''
new_audio = '''                            <button data-testid="synapse-mute-btn" onClick={toggleMute} className="grid h-9 w-9 shrink-0 place-items-center text-white/90 hover:text-white hover:scale-105 active:scale-95 transition" aria-label="Mute">
                                {muted || volume === 0 ? <VolumeX className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" /> : <Volume2 className="h-5 w-5 md:h-[22px] md:w-[22px] stroke-[1.9]" />}
                            </button>

                            <span data-testid="synapse-time" className="text-sm md:text-lg font-medium tabular-nums text-white/95 whitespace-nowrap">
                                {fmtTime(current)} <span className="text-white/65 px-1">/</span> {fmtTime(duration)}
                            </span>
                            <span className="hidden sm:inline text-[11px] md:text-[13px] font-semibold tracking-[0.04em] text-white/38 whitespace-nowrap" data-testid="synplayer-label">
                                <span className="mr-2 text-white/18">·</span>SynPlayer
                            </span>
'''
replace_once(old_audio, new_audio, 'bottom audio and SynPlayer label')

# Add normal Volume into settings navigation/header.
replace_once(
    '                                        subtitles: "Captions",\n                                        auto: "Autoplay",\n                                        boost: "Volume boost",',
    '                                        subtitles: "Captions",\n                                        auto: "Autoplay",\n                                        volume: "Volume",\n                                        boost: "Volume boost",',
    'settings volume header',
)

captions_row = '''                                    <button onClick={() => setSettingsPage("subtitles")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Subtitles className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Captions</span>
                                        <span className="max-w-[42%] truncate text-[12px] text-white/40">{subtitleSettingsLabel}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
'''
volume_and_captions = '''                                    <button onClick={() => setSettingsPage("volume")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]" data-testid="synapse-volume-settings-row">
                                        <Volume2 className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Volume</span>
                                        <span className="text-[12px] text-white/40">{Math.round((muted ? 0 : volume) * 100)}%</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
''' + captions_row
replace_once(captions_row, volume_and_captions, 'volume settings row')

volume_page_anchor = '''                            {settingsPage === "subtitles" && (
'''
volume_page = '''                            {settingsPage === "volume" && (
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
                                        className="mt-6 w-full accent-white"
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

''' + volume_page_anchor
replace_once(volume_page_anchor, volume_page, 'volume settings page')

path.write_text(s)
print('patched compact controls, settings volume, SynPlayer label, and playback performance')
