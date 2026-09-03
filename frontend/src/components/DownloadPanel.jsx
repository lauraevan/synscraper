import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, HardDrive, Loader2, X } from "lucide-react";
import {
    DOWNLOADS_CONFIGURED,
    downloadWorkerUrl,
    getDownloadOptions,
    getStreams,
} from "@/lib/api";

const QUALITY_ORDER = [2160, 1440, 1080, 720, 480, 360, 240, 144];

const qualityHeight = (value) => {
    const text = String(value || "").toLowerCase();
    if (text.includes("4k") || text.includes("2160")) return 2160;
    const match = text.match(/(1440|1080|720|480|360|240|144)/);
    return match ? Number(match[1]) : 0;
};

const qualityLabel = (height) => height === 2160 ? "4K" : `${height}p`;
const sourceKey = (server) => `${server.provider}|${server.name}`;

const mergeServers = (current, incoming) => {
    const map = new Map();
    [...(current || []), ...(incoming || [])].forEach((server) => {
        if (!server || server.type !== "hls") return;
        map.set(`${server.provider}|${server.name}|${server.quality}|${server.id}`, server);
    });
    return Array.from(map.values());
};

export const DownloadPanel = ({ mediaType, id, season, episode, title }) => {
    const [open, setOpen] = useState(false);
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [source, setSource] = useState("");
    const [quality, setQuality] = useState("1080");
    const [probedQualities, setProbedQualities] = useState([]);
    const [probing, setProbing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        setLoading(true);
        setError("");
        setServers([]);

        const add = (payload) => {
            if (!alive) return;
            setServers((current) => mergeServers(current, payload?.servers || []));
        };

        const quick = getStreams(mediaType, id, season, episode, {
            provider: "vidy",
            mirror: "miami",
            timeout: 10000,
        }).then(add).catch(() => {});

        Promise.resolve(quick)
            .finally(() => getStreams(mediaType, id, season, episode, { timeout: 45000 }).then(add))
            .catch(() => {
                if (alive) setError("Could not resolve downloadable HLS sources.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => { alive = false; };
    }, [open, mediaType, id, season, episode]);

    const sources = useMemo(() => {
        const seen = new Map();
        servers.forEach((server) => {
            const key = sourceKey(server);
            if (!seen.has(key)) seen.set(key, {
                key,
                provider: server.provider,
                name: server.name,
            });
        });
        return Array.from(seen.values()).sort((a, b) => {
            const aMiami = a.provider === "vidy" && /miami/i.test(a.name) ? 0 : 1;
            const bMiami = b.provider === "vidy" && /miami/i.test(b.name) ? 0 : 1;
            return aMiami - bMiami || a.name.localeCompare(b.name);
        });
    }, [servers]);

    useEffect(() => {
        if (!sources.length) return;
        if (!source || !sources.some((item) => item.key === source)) {
            setSource(sources[0].key);
        }
    }, [sources, source]);

    const selectedSource = sources.find((item) => item.key === source);
    const selectedServers = useMemo(
        () => servers.filter((server) => sourceKey(server) === source),
        [servers, source]
    );

    useEffect(() => {
        if (!open || !selectedSource || !DOWNLOADS_CONFIGURED) {
            setProbedQualities([]);
            return undefined;
        }
        let alive = true;
        setProbing(true);
        setError("");
        getDownloadOptions({
            type: mediaType,
            id,
            season,
            episode,
            provider: selectedSource.provider,
            mirror: selectedSource.name,
        })
            .then((data) => {
                if (!alive) return;
                setProbedQualities((data?.available_qualities || []).map(Number).filter(Boolean));
            })
            .catch((err) => {
                if (alive) {
                    setProbedQualities([]);
                    setError(err?.message || "Could not inspect download qualities.");
                }
            })
            .finally(() => {
                if (alive) setProbing(false);
            });
        return () => { alive = false; };
    }, [open, selectedSource?.key, mediaType, id, season, episode]); // eslint-disable-line react-hooks/exhaustive-deps

    const qualities = useMemo(() => {
        const set = new Set(probedQualities);
        selectedServers.forEach((server) => {
            const height = qualityHeight(server.quality);
            if (height) set.add(height);
        });
        return QUALITY_ORDER.filter((height) => set.has(height));
    }, [selectedServers, probedQualities]);

    useEffect(() => {
        if (!qualities.length) {
            setQuality("auto");
            return;
        }
        const current = Number(quality);
        if (!qualities.includes(current)) {
            setQuality(String(qualities.includes(1080) ? 1080 : qualities[0]));
        }
    }, [qualities, quality]);

    const startDownload = () => {
        if (!selectedSource || !DOWNLOADS_CONFIGURED) return;
        setError("");
        const url = downloadWorkerUrl({
            type: mediaType,
            id,
            season,
            episode,
            provider: selectedSource.provider,
            mirror: selectedSource.name,
            quality,
            title,
        });
        if (!url) {
            setError("Download worker is not configured.");
            return;
        }
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    return (
        <div className="mx-auto mt-3 max-w-[1600px]" data-testid="download-panel">
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.045]"
                >
                    <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.07]">
                            <Download className="h-4.5 w-4.5 text-white/80" strokeWidth={1.8} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white/86">Download MP4</p>
                            <p className="mt-0.5 text-[11px] text-white/36">Pick a source and exact HLS quality, then remux with FFmpeg.</p>
                        </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/35" />
                </button>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-[#090909] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.3)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07]">
                                <HardDrive className="h-5 w-5 text-white/80" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white/90">Download MP4</h3>
                                <p className="mt-0.5 text-[11px] text-white/35">The worker pins one HLS rendition and remuxes it without re-encoding.</p>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center text-white/40 transition hover:text-white" aria-label="Close download panel">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {!DOWNLOADS_CONFIGURED ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs leading-5 text-white/50">
                            Downloads are added, but this build has no worker URL yet. Set <span className="font-mono text-white/75">REACT_APP_DOWNLOAD_WORKER_URL</span> to the VPS/container running <span className="font-mono text-white/75">backend/download_worker.py</span>.
                        </div>
                    ) : (
                        <>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Source</span>
                                    <select
                                        value={source}
                                        onChange={(event) => setSource(event.target.value)}
                                        disabled={loading && !sources.length}
                                        className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none"
                                    >
                                        {!sources.length && <option value="">{loading ? "Finding sources…" : "No HLS sources"}</option>}
                                        {sources.map((item) => (
                                            <option key={item.key} value={item.key} className="bg-black">{item.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Quality</span>
                                    <select
                                        value={quality}
                                        onChange={(event) => setQuality(event.target.value)}
                                        disabled={!selectedSource || probing}
                                        className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none"
                                    >
                                        {qualities.length ? qualities.map((height) => (
                                            <option key={height} value={height} className="bg-black">{qualityLabel(height)}</option>
                                        )) : <option value="auto" className="bg-black">{probing ? "Inspecting…" : "Auto / highest"}</option>}
                                    </select>
                                </label>
                            </div>

                            {error && <p className="mt-3 text-xs text-red-300/80">{error}</p>}

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                                <p className="text-[11px] text-white/32">
                                    {selectedSource ? `${selectedSource.name} · ${quality === "auto" ? "Auto" : qualityLabel(Number(quality))}` : "Choose a source"}
                                </p>
                                <button
                                    type="button"
                                    onClick={startDownload}
                                    disabled={!selectedSource || loading || probing}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    {(loading || probing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Download MP4
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
