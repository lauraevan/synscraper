from pathlib import Path

player_path = Path("frontend/src/components/SynapsePlayer.jsx")
s = player_path.read_text()

def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"missing patch target: {label}")
    s = s.replace(old, new, 1)

replace_once(
    '    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette,\n} from "lucide-react";',
    '    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette, Download, Loader2,\n} from "lucide-react";',
    "lucide imports",
)

replace_once(
    'import { getStreams, hlsProxyUrl } from "@/lib/api";',
    'import { getStreams, hlsProxyUrl, getDownloadOptions, downloadWorkerUrl } from "@/lib/api";',
    "download api imports",
)

replace_once(
    '    const [settingsPage, setSettingsPage] = useState("root");\n    const [autoPlay, setAutoPlay] = useState(true);',
    '''    const [settingsPage, setSettingsPage] = useState("root");
    const [downloadSourceKey, setDownloadSourceKey] = useState("");
    const [downloadQuality, setDownloadQuality] = useState("1080");
    const [downloadQualities, setDownloadQualities] = useState([]);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const [autoPlay, setAutoPlay] = useState(true);''',
    "download state",
)

replace_once(
    '    const activeServer = servers.find((s) => s.id === serverId);\n    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);',
    '''    const activeServer = servers.find((s) => s.id === serverId);
    const downloadSources = (() => {
        const found = new Map();
        servers.filter((server) => server?.type === "hls").forEach((server) => {
            const key = `${server.provider}|${server.name}`;
            if (!found.has(key)) found.set(key, { key, provider: server.provider, name: server.name });
        });
        return Array.from(found.values()).sort((a, b) => {
            const aMiami = a.provider === "vidy" && /miami/i.test(a.name) ? 0 : 1;
            const bMiami = b.provider === "vidy" && /miami/i.test(b.name) ? 0 : 1;
            return aMiami - bMiami || a.name.localeCompare(b.name);
        });
    })();
    const selectedDownloadSource = downloadSources.find((source) => source.key === downloadSourceKey) || null;

    useEffect(() => {
        if (settingsPage !== "download" || !downloadSources.length) return;
        const activeKey = activeServer?.type === "hls" ? `${activeServer.provider}|${activeServer.name}` : "";
        if (!downloadSourceKey || !downloadSources.some((source) => source.key === downloadSourceKey)) {
            setDownloadSourceKey(downloadSources.some((source) => source.key === activeKey) ? activeKey : downloadSources[0].key);
        }
    }, [settingsPage, servers, serverId, downloadSourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (settingsPage !== "download" || !selectedDownloadSource) return undefined;
        let alive = true;
        setDownloadLoading(true);
        setDownloadError("");
        getDownloadOptions({
            type: mediaType,
            id,
            season,
            episode,
            provider: selectedDownloadSource.provider,
            mirror: selectedDownloadSource.name,
        })
            .then((data) => {
                if (!alive) return;
                const available = (data?.available_qualities || [])
                    .map(Number)
                    .filter((height) => height > 0 && height <= 1080)
                    .sort((a, b) => b - a);
                setDownloadQualities(available);
                setDownloadQuality((currentQuality) => {
                    const currentHeight = Number(currentQuality);
                    if (available.includes(currentHeight)) return String(currentHeight);
                    if (available.includes(1080)) return "1080";
                    return available.length ? String(available[0]) : "auto";
                });
            })
            .catch((err) => {
                if (!alive) return;
                setDownloadQualities([]);
                setDownloadQuality("auto");
                setDownloadError(err?.message || "Could not inspect download qualities.");
            })
            .finally(() => {
                if (alive) setDownloadLoading(false);
            });
        return () => { alive = false; };
    }, [settingsPage, downloadSourceKey, mediaType, id, season, episode]); // eslint-disable-line react-hooks/exhaustive-deps

    const startDownloadFromSettings = () => {
        if (!selectedDownloadSource || typeof document === "undefined") return;
        setDownloadError("");
        const url = downloadWorkerUrl({
            type: mediaType,
            id,
            season,
            episode,
            provider: selectedDownloadSource.provider,
            mirror: selectedDownloadSource.name,
            quality: downloadQuality || "auto",
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

    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);''',
    "download effects",
)

replace_once(
    '                                        quality: "Quality",\n                                        speed: "Playback speed",',
    '                                        quality: "Quality",\n                                        download: "Download",\n                                        speed: "Playback speed",',
    "settings title",
)

replace_once(
    '''                                    <button onClick={() => setSettingsPage("speed")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <RefreshCw className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Playback speed</span>
                                        <span className="text-[12px] text-white/40">{rate}x</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>''',
    '''                                    <button onClick={() => setSettingsPage("download")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]" data-testid="synapse-download-settings-row">
                                        <Download className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Download</span>
                                        <span className="text-[12px] text-white/40">MP4 · 1080p max</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>
                                    <button onClick={() => setSettingsPage("speed")} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.045]">
                                        <RefreshCw className="h-[19px] w-[19px] shrink-0 text-white/55" strokeWidth={1.7} />
                                        <span className="flex-1 text-[14px] font-medium text-white/86">Playback speed</span>
                                        <span className="text-[12px] text-white/40">{rate}x</span>
                                        <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
                                    </button>''',
    "download settings row",
)

replace_once(
    '''                            {settingsPage === "speed" && (
                                <div className="p-3">''',
    '''                            {settingsPage === "download" && (
                                <div className="p-4" data-testid="synapse-download-settings-page">
                                    <p className="mb-4 text-[11px] leading-relaxed text-white/34">Download the current title as an MP4. Downloads are capped at 1080p and remux the selected HLS source without re-encoding.</p>

                                    <label className="block">
                                        <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Source</span>
                                        <select
                                            value={downloadSourceKey}
                                            onChange={(event) => setDownloadSourceKey(event.target.value)}
                                            className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.045] px-3 text-[13px] text-white outline-none"
                                            disabled={!downloadSources.length}
                                            data-testid="synapse-download-source"
                                        >
                                            {!downloadSources.length && <option value="">No HLS sources</option>}
                                            {downloadSources.map((source) => <option key={source.key} value={source.key} className="bg-black">{source.name}</option>)}
                                        </select>
                                    </label>

                                    <div className="mt-4">
                                        <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/28">Quality · 1080p maximum</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(downloadQualities.length ? downloadQualities : ["auto"]).map((quality) => {
                                                const value = String(quality);
                                                const selected = downloadQuality === value;
                                                return (
                                                    <button
                                                        key={`download-quality-${value}`}
                                                        type="button"
                                                        onClick={() => setDownloadQuality(value)}
                                                        disabled={downloadLoading}
                                                        className={`rounded-xl border px-3 py-3 text-[13px] font-medium transition ${selected ? "border-white bg-white text-black" : "border-white/[0.08] bg-white/[0.025] text-white/68 hover:bg-white/[0.055]"}`}
                                                    >
                                                        {value === "auto" ? "Auto ≤1080p" : `${value}p`}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {downloadLoading && <div className="mt-4 flex items-center gap-2 text-[11px] text-white/38"><Loader2 className="h-3.5 w-3.5 animate-spin" />Inspecting available qualities…</div>}
                                    {downloadError && <p className="mt-3 text-[11px] leading-relaxed text-red-300/75">{downloadError}</p>}

                                    <button
                                        type="button"
                                        onClick={startDownloadFromSettings}
                                        disabled={!selectedDownloadSource || downloadLoading}
                                        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
                                        data-testid="synapse-download-mp4"
                                    >
                                        {downloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        Download MP4
                                    </button>
                                    <p className="mt-2 text-center text-[9px] text-white/25">{selectedDownloadSource ? `${selectedDownloadSource.name} · ${downloadQuality === "auto" ? "Auto ≤1080p" : `${downloadQuality}p`}` : "Choose a source"}</p>
                                </div>
                            )}

                            {settingsPage === "speed" && (
                                <div className="p-3">''',
    "download settings page",
)

player_path.write_text(s)

watch_path = Path("frontend/src/pages/Watch.jsx")
w = watch_path.read_text()
w = w.replace('import { DownloadPanel } from "@/components/DownloadPanel";\n', "", 1)
old_panel = '''
                <DownloadPanel
                    mediaType={mediaType}
                    id={id}
                    season={season}
                    episode={episode}
                    title={meta.title}
                />
'''
if old_panel not in w:
    raise SystemExit("missing patch target: old download panel")
w = w.replace(old_panel, "\n", 1)
watch_path.write_text(w)
