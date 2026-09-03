from pathlib import Path

path = Path("frontend/src/components/SynapsePlayer.jsx")
text = path.read_text()
start_marker = '            {menu === "settings" && mode === "ready" && ('
end_marker = '\n            {help && ('
start = text.index(start_marker)
end = text.index(end_marker, start)

block = r'''            {menu === "settings" && mode === "ready" && (
                <div
                    data-testid="synapse-settings-overlay"
                    className="absolute inset-0 z-[70]"
                    onClick={closeSettings}
                >
                    <div
                        data-testid="synapse-settings-panel"
                        className="absolute bottom-[76px] right-3 flex max-h-[72%] w-[430px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[18px] border border-white/[0.10] bg-[#090909]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl md:bottom-[92px] md:right-7"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex h-[58px] shrink-0 items-center border-b border-white/[0.08] px-3.5">
                            {settingsPage !== "root" ? (
                                <button
                                    type="button"
                                    onClick={() => setSettingsPage("root")}
                                    className="grid h-9 w-9 shrink-0 place-items-center text-white/65 transition hover:text-white"
                                    aria-label="Back"
                                >
                                    <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
                                </button>
                            ) : <div className="w-9" />}
                            <div className="min-w-0 flex-1 px-1.5">
                                <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-white">
                                    {({
                                        root: "Settings",
                                        server: "Source",
                                        quality: "Quality",
                                        speed: "Playback speed",
                                        subtitles: "Captions",
                                        auto: "Autoplay",
                                        boost: "Volume boost",
                                        spatial: "Spatial audio",
                                        video: "Picture",
                                        upscaler: "Upscaler",
                                    }[settingsPage] || "Settings")}
                                </h2>
                                {settingsPage === "root" && <p className="mt-0.5 text-[10px] text-white/32">Playback preferences</p>}
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
                                <div className="py-1.5">
                                    <div className="px-4 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Playback</div>
                                    <button onClick={() => setSettingsPage("server")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Cloud className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Source</span>
                                        <span className="max-w-[42%] truncate text-[12px] text-white/40">{activeServer?.name || "Auto"}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("quality")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Gauge className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Quality</span>
                                        <span className="text-[12px] text-white/40">{settingsQualityLabel}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("speed")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <RefreshCw className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Playback speed</span>
                                        <span className="text-[12px] text-white/40">{rate}x</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("auto")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Play className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Autoplay</span>
                                        <span className="text-[12px] text-white/40">{autoPlay ? "On" : "Off"}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>

                                    <div className="mx-4 my-1 h-px bg-white/[0.07]" />
                                    <div className="px-4 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Audio & captions</div>
                                    <button onClick={() => setSettingsPage("subtitles")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Subtitles className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Captions</span>
                                        <span className="max-w-[42%] truncate text-[12px] text-white/40">{subtitleSettingsLabel}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("boost")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <Volume2 className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Volume boost</span>
                                        <span className="text-[12px] text-white/40">{volumeBoost}%</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("spatial")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <AudioWaveform className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Spatial audio</span>
                                        <span className="text-[12px] text-white/40">{spatialAudio ? "On" : "Off"}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>

                                    <div className="mx-4 my-1 h-px bg-white/[0.07]" />
                                    <div className="px-4 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Picture</div>
                                    <button onClick={() => setSettingsPage("video")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <CirclePlus className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Video size</span>
                                        <span className="text-[12px] text-white/40">{videoScale}%</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("upscaler")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <WandSparkles className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Upscaler</span>
                                        <span className="text-[12px] text-white/40">{upscaler ? "On" : "Off"}</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                </div>
                            )}

                            {settingsPage === "server" && (
                                <div className="py-1.5">
                                    <p className="px-4 py-2 text-[11px] leading-relaxed text-white/34">Miami is prioritized for startup. Switching sources keeps your current position.</p>
                                    <div className="border-t border-white/[0.06]">
                                        {sourceSlots.map((s) => {
                                            const selected = serverId === s.id;
                                            return (
                                                <button key={s.id} disabled={!s.available} onClick={() => s.available && selectServerInSettings(s)} className={`flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition ${s.available ? "hover:bg-white/[0.045]" : "cursor-not-allowed opacity-30"}`}>
                                                    <span className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-white" : "bg-white/18"}`} />
                                                    <span className={`min-w-0 flex-1 truncate text-[14px] ${selected ? "font-semibold text-white" : "font-medium text-white/72"}`}>{s.displayName || s.name}</span>
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
                                            <span className="max-w-[42%] truncate text-[10px] text-white/35">{choice.available ? (choice.levelIndex >= 0 ? "HLS" : choice.server?.name || "Stream") : "Unavailable"}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {settingsPage === "speed" && (
                                <div className="p-3">
                                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/[0.08]">
                                        {SPEEDS.map((r) => (
                                            <button key={r} onClick={() => changeRateInSettings(r)} className={`border-b border-r border-white/[0.07] px-3 py-3.5 text-[13px] font-medium transition ${rate === r ? "bg-white text-black" : "bg-transparent text-white/64 hover:bg-white/[0.045] hover:text-white"}`}>{r}x</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {settingsPage === "subtitles" && (
                                <div className="py-1.5">
                                    <div className="px-4 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Language</div>
                                    <button onClick={turnOffCaptions} className={`flex w-full items-center gap-3 border-y border-white/[0.055] px-4 py-3 text-left transition ${!captionsEnabled ? "bg-white/[0.07] text-white" : "text-white/72 hover:bg-white/[0.045]"}`}>
                                        <span className={`h-2 w-2 rounded-full ${!captionsEnabled ? "bg-white" : "bg-white/18"}`} />
                                        <span className="flex-1 text-[14px] font-medium">Off</span>
                                    </button>
                                    {captionLanguageOptions.map((option) => (
                                        <button key={`settings-caption-${option.code}`} onClick={() => selectCaptionLanguage(option.code)} className={`flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition ${captionsEnabled && preferredCaptionLang === option.code ? "bg-white/[0.07] text-white" : "text-white/72 hover:bg-white/[0.045]"}`}>
                                            <span className={`h-2 w-2 rounded-full ${captionsEnabled && preferredCaptionLang === option.code ? "bg-white" : "bg-white/18"}`} />
                                            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{option.name}</span>
                                            <span className="max-w-[48%] truncate text-[9px] uppercase tracking-[0.08em] text-white/30">{option.best ? `Best · ${option.best.serverName}` : option.pending ? "Checking…" : "HLS"}</span>
                                        </button>
                                    ))}
                                    {!captionLanguageOptions.length && <p className="px-4 py-4 text-[11px] text-white/32">No healthy caption track is available yet.</p>}

                                    <div className="mx-4 my-2 h-px bg-white/[0.07]" />
                                    <div className="flex items-center justify-between px-4 pb-1 pt-2">
                                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Appearance</span>
                                        <button onClick={resetCaptionStyle} className="text-[10px] font-medium text-white/38 transition hover:text-white">Reset</button>
                                    </div>
                                    <CaptionSlider label="Size" value={captionStyle.size} min={60} max={180} suffix="%" onChange={(v) => updateCaptionStyle("size", v)} />
                                    <CaptionSlider label="Background" value={captionStyle.background} min={0} max={90} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                    <CaptionSlider label="Position" value={captionStyle.position} min={60} max={92} suffix="%" onChange={(v) => updateCaptionStyle("position", v)} />
                                    <CaptionSlider label="Sync" value={captionStyle.delay} min={-5} max={5} step={0.05} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex-1 text-[13px] text-white/64">Text color</span>
                                        {["#ffffff", "#ffe66d", "#77e0ff", "#9cff8f"].map((color) => (
                                            <button key={color} onClick={() => updateCaptionStyle("color", color)} className={`h-6 w-6 rounded-full border ${captionStyle.color.toLowerCase() === color ? "border-white ring-1 ring-white/50" : "border-white/15"}`} style={{ backgroundColor: color }} aria-label={`Caption color ${color}`} />
                                        ))}
                                    </div>
                                    {externalCaptionError && <p className="px-4 pb-3 text-[10px] text-red-300/70">{externalCaptionError}</p>}
                                </div>
                            )}

                            {settingsPage === "auto" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">Automatically start playback when a source is ready.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setAutoPlay(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${autoPlay ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>On</button>
                                        <button onClick={() => { setAutoPlay(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!autoPlay ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "boost" && (
                                <div className="p-4">
                                    <div className="flex items-end justify-between">
                                        <div><p className="text-[13px] font-medium text-white/76">Gain</p><p className="mt-1 text-[10px] text-white/30">100% keeps the original stream level</p></div>
                                        <p className="text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-white">{volumeBoost}%</p>
                                    </div>
                                    <input type="range" min="100" max="200" step="5" value={volumeBoost} onChange={(e) => setVolumeBoostValue(e.target.value)} className="mt-6 w-full accent-white" />
                                    <div className="mt-2 flex justify-between text-[9px] tabular-nums text-white/25"><span>100%</span><span>150%</span><span>200%</span></div>
                                </div>
                            )}

                            {settingsPage === "spatial" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">Adds a wider stereo presentation when the browser supports it.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setSpatialAudio(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${spatialAudio ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>On</button>
                                        <button onClick={() => { setSpatialAudio(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!spatialAudio ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
                            )}

                            {settingsPage === "video" && (
                                <div className="p-4">
                                    <div className="flex items-end justify-between">
                                        <div><p className="text-[13px] font-medium text-white/76">Video size</p><p className="mt-1 text-[10px] text-white/30">Zoom without changing stream quality</p></div>
                                        <p className="text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-white">{videoScale}%</p>
                                    </div>
                                    <input type="range" min="75" max="125" step="1" value={videoScale} onChange={(e) => setVideoScale(Number(e.target.value))} className="mt-6 w-full accent-white" />
                                    <div className="mt-2 flex justify-between text-[9px] tabular-nums text-white/25"><span>75%</span><span>100%</span><span>125%</span></div>
                                </div>
                            )}

                            {settingsPage === "upscaler" && (
                                <div className="p-4">
                                    <p className="mb-3 text-[11px] leading-relaxed text-white/34">A light display enhancement for softer sources. It does not create a native 4K stream.</p>
                                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08]">
                                        <button onClick={() => { setUpscaler(true); setSettingsPage("root"); }} className={`px-4 py-3 text-[13px] font-medium transition ${upscaler ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>Enhance</button>
                                        <button onClick={() => { setUpscaler(false); setSettingsPage("root"); }} className={`border-l border-white/[0.08] px-4 py-3 text-[13px] font-medium transition ${!upscaler ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.045]"}`}>Off</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
'''

path.write_text(text[:start] + block + text[end:])
print("settings reworked")
