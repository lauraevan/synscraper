from pathlib import Path

player_path = Path("frontend/src/components/SynapsePlayer.jsx")
s = player_path.read_text()

state_old = '''    const [settingsPage, setSettingsPage] = useState("root");
    const [downloadSourceKey, setDownloadSourceKey] = useState("");
    const [downloadQuality, setDownloadQuality] = useState("1080");
    const [downloadQualities, setDownloadQualities] = useState([]);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const [autoPlay, setAutoPlay] = useState(true);'''
state_new = '''    const [settingsPage, setSettingsPage] = useState("root");
    const [downloadItems, setDownloadItems] = useState([]);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const [autoPlay, setAutoPlay] = useState(true);'''
if state_old not in s:
    raise SystemExit("missing download state block")
s = s.replace(state_old, state_new, 1)

logic_start = s.index('    const activeServer = servers.find((s) => s.id === serverId);')
logic_end = s.index('    useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);', logic_start)
logic_new = '''    const activeServer = servers.find((s) => s.id === serverId);
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
                const aMiami = a.provider === "vidy" && /miami/i.test(a.source) ? 0 : 1;
                const bMiami = b.provider === "vidy" && /miami/i.test(b.source) ? 0 : 1;
                const aq = a.quality === "auto" ? 0 : Number(a.quality);
                const bq = b.quality === "auto" ? 0 : Number(b.quality);
                return aMiami - bMiami || bq - aq || a.source.localeCompare(b.source);
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

'''
s = s[:logic_start] + logic_new + s[logic_end:]

page_start = s.index('                            {settingsPage === "download" && (')
page_end = s.index('                            {settingsPage === "speed" && (', page_start)
page_new = '''                            {settingsPage === "download" && (
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

'''
s = s[:page_start] + page_new + s[page_end:]

player_path.write_text(s)
