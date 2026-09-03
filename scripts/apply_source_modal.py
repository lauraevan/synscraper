from pathlib import Path
import re

path = Path("frontend/src/components/SynapsePlayer.jsx")
s = path.read_text()


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"missing patch target: {label}")
    s = s.replace(old, new, 1)


# Keep the exact uploaded image bytes, but guarantee PNG=India and WebP=4K.
matches = re.findall(
    r'const SOURCE_(?:4K_BADGE|INDIA_FLAG) = "(data:image/(?:png|webp);base64,[^"]+)";',
    s,
)
png = next((value for value in matches if value.startswith("data:image/png;")), None)
webp = next((value for value in matches if value.startswith("data:image/webp;")), None)
if not png or not webp:
    raise SystemExit("uploaded source badge data URIs were not found")

s = re.sub(
    r'const SOURCE_4K_BADGE = "data:image/(?:png|webp);base64,[^"]+";',
    f'const SOURCE_4K_BADGE = "{webp}";',
    s,
    count=1,
)
s = re.sub(
    r'const SOURCE_INDIA_FLAG = "data:image/(?:png|webp);base64,[^"]+";',
    f'const SOURCE_INDIA_FLAG = "{png}";',
    s,
    count=1,
)

replace_once(
    '    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette, Download, Loader2,\n',
    '    AudioWaveform, WandSparkles, CirclePlus, RefreshCw, Palette, Download, Loader2, Star,\n',
    "Star import",
)

old_helpers = '''const sourceHas4KBadge = (source) =>
    source?.provider === "vidcore"
    || (source?.provider === "vidy" && /miami/i.test(String(source?.displayName || source?.name || "")));
const sourceIsHindi = (source) => {
    const language = String(source?.lang || source?.language || "").trim().toLowerCase();
    const label = [source?.displayName, source?.name, source?.label, source?.subserver]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return language === "hi" || language === "hin" || /(^|[ :_\\-])hindi($|[ :_\\-])/i.test(label);
};
const sourceFlag = (source) => sourceIsHindi(source)
    ? SOURCE_INDIA_FLAG
    : "https://flagsapi.com/US/flat/24.png";
'''
new_helpers = '''const sourceHas4KBadge = (source) => {
    const provider = String(source?.provider || "").trim().toLowerCase();
    const name = String(source?.displayName || source?.name || "");
    return provider === "vidcore" || (provider === "vidy" && /miami/i.test(name));
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
'''
replace_once(old_helpers, new_helpers, "source badge helpers")

replace_once(
    '    const [menu, setMenu] = useState(null);\n',
    '    const [menu, setMenu] = useState(null);\n    const [preferredSourceKey, setPreferredSourceKey] = useState(readPreferredSourceKey);\n',
    "preferred source state",
)

old_activate = '''        const activate = (list) => {
            if (!alive || started || !list.length) return;
            const wanted = preferredQualityRef.current;
            const preferred = (wanted ? list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === wanted) : null)
                || (!wanted ? list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && /^auto/i.test(String(s.quality || ""))) : null)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")) && qualityHeight(s.quality) === 1080)
                || list.find((s) => s.provider === "vidy" && /miami/i.test(String(s.name || "")))
                || list[0];
            started = true;
            clearInterval(tick);
            setServerId(preferred.id);
            setMode("ready");
        };
'''
new_activate = '''        const activate = (list, { allowFallback = false } = {}) => {
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
'''
replace_once(old_activate, new_activate, "favorite-aware startup")

old_merge = '''        const mergePayload = (data) => {
            if (!alive) return [];
            const list = data?.servers || [];
            if (list.length) {
                setServers((current) => mergeServers(current, list));
                activate(list);
            }
            return list;
        };
'''
new_merge = '''        const mergePayload = (data, allowFallback = false) => {
            if (!alive) return [];
            const list = data?.servers || [];
            if (list.length) {
                setServers((current) => mergeServers(current, list));
                activate(list, { allowFallback });
            }
            return list;
        };
'''
replace_once(old_merge, new_merge, "merge payload fallback control")

replace_once(
    '''            backgroundPromise = getStreams(mediaType, id, season, episode, { timeout: 45000, exclude, ...streamResolveHints })
                .then(mergePayload)
''',
    '''            backgroundPromise = getStreams(mediaType, id, season, episode, { timeout: 45000, exclude, ...streamResolveHints })
                .then((data) => mergePayload(data, true))
''',
    "background fallback",
)

old_quick_body = '''                const list = mergePayload(d);
                if (!list.length) {
                    return startBackground(undefined);
                }

                const hasMiamiCaptions = list.some((server) => (server.captions || []).length > 0);
                // Give Miami a clean startup lane: do not make its manifest/first fragments
                // compete with the whole provider pool. Backups arrive after playback has had time
                // to establish a buffer.
                backgroundTimer = window.setTimeout(
                    () => startBackground(hasMiamiCaptions ? "vidy,cinejoy" : "cinejoy"),
                    3200,
                );
                // CineJoy is WASM-heavy, so keep it well out of Miami's first-frame window.
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);
                return list;
'''
new_quick_body = '''                const list = mergePayload(d, false);
                if (!list.length) {
                    return startBackground(undefined);
                }

                const preferredSource = readPreferredSourceKey();
                const quickHasPreferred = preferredSource && list.some((server) => sourcePreferenceKey(server) === preferredSource);
                const preferredProvider = preferredSource ? preferredSource.split("|")[0] : "";
                const hasMiamiCaptions = list.some((server) => (server.captions || []).length > 0);

                if (preferredSource && !quickHasPreferred) {
                    // A starred source is the real default. Load the wider source pool immediately
                    // instead of locking playback to Miami before the favorite can arrive.
                    if (preferredProvider === "cinejoy") {
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 120);
                        backgroundTimer = window.setTimeout(() => startBackground("cinejoy"), 700);
                    } else {
                        backgroundTimer = window.setTimeout(() => startBackground("cinejoy"), 120);
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);
                    }
                    return list;
                }

                // Give Miami a clean startup lane when there is no different starred default.
                backgroundTimer = window.setTimeout(
                    () => startBackground(hasMiamiCaptions ? "vidy,cinejoy" : "cinejoy"),
                    3200,
                );
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);
                return list;
'''
replace_once(old_quick_body, new_quick_body, "quick favorite loading")

replace_once(
    '''        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground(undefined);
        }, 1800);
''',
    '''        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground(undefined);
        }, readPreferredSourceKey() ? 5500 : 1800);
''',
    "favorite safety timeout",
)

old_select_server = '''    const selectServer = (s) => {
        pendingSeekRef.current = videoRef.current?.currentTime || current || 0;
        const wanted = preferredQualityRef.current;
        const matching = wanted ? servers.find((candidate) =>
            candidate.provider === s.provider && candidate.name === s.name && qualityHeight(candidate.quality) === wanted
        ) : null;
        setMenu(null); setServerId((matching || s).id);
    };
'''
new_select_server = '''    const selectServer = (s) => {
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
'''
replace_once(old_select_server, new_select_server, "favorite toggle")

start_marker = '                        <div className="absolute left-5 top-5 md:left-7 md:top-7">'
end_marker = '                        <div className="absolute left-1/2 top-5 md:top-6 -translate-x-1/2 text-center max-w-[60%] pointer-events-none">'
start = s.find(start_marker)
end = s.find(end_marker, start + 1)
if start < 0 or end < 0:
    raise SystemExit(f"source picker boundaries missing: start={start}, end={end}")

modal = '''                        <div className="absolute left-5 top-5 md:left-7 md:top-7">
                            <button
                                data-testid="synapse-source-cloud-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenu(menu === "sources" ? null : "sources");
                                }}
                                className={`grid h-11 w-11 place-items-center transition-all duration-200 active:scale-95 md:h-12 md:w-12 ${menu === "sources" ? "scale-105 text-white" : "text-white/80 hover:scale-105 hover:text-white"}`}
                                aria-label="Choose source"
                                title="Servers"
                            >
                                <Cloud className="h-7 w-7 stroke-[1.55] md:h-8 md:w-8" />
                            </button>

                            {menu === "sources" && (
                                <div
                                    data-testid="synapse-source-popout"
                                    data-source-layout="server-modal"
                                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[5px]"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenu(null);
                                    }}
                                >
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-[min(92vw,600px)] max-h-[min(82vh,680px)] overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#242424] shadow-[0_28px_95px_rgba(0,0,0,0.72)]"
                                    >
                                        <div className="flex h-[74px] items-center border-b border-white/[0.15] px-6 md:px-7">
                                            <h3 className="flex-1 text-[20px] font-medium tracking-[-0.02em] text-white/95 md:text-[22px]">Servers</h3>
                                            <button
                                                type="button"
                                                onClick={() => setMenu(null)}
                                                className="grid h-11 w-11 place-items-center rounded-full text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                                                aria-label="Close servers"
                                            >
                                                <X className="h-8 w-8" strokeWidth={1.55} />
                                            </button>
                                        </div>

                                        <div className="max-h-[min(67vh,570px)] overflow-y-auto px-3 py-2 scrollbar-none md:px-4 md:py-3">
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
                                                        className={`group flex min-h-[76px] items-center rounded-[16px] px-2 transition ${s.available ? "hover:bg-white/[0.045]" : "opacity-40"}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={!s.available}
                                                            onClick={() => {
                                                                if (!s.available) return;
                                                                selectServer(s);
                                                                setMenu(null);
                                                            }}
                                                            className={`flex min-w-0 flex-1 items-center gap-4 px-2 py-3 text-left ${s.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                                                        >
                                                            <div className="flex h-9 w-10 shrink-0 items-center justify-center">
                                                                {show4K ? (
                                                                    <img
                                                                        src={SOURCE_4K_BADGE}
                                                                        alt="4K"
                                                                        title="4K source"
                                                                        className="h-8 w-10 object-contain"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={hindi ? SOURCE_INDIA_FLAG : sourceFlag(s)}
                                                                        alt={hindi ? "India" : "US"}
                                                                        title={hindi ? "Hindi v6 source" : "Original audio source"}
                                                                        className="h-6 w-8 rounded-[2px] object-cover"
                                                                        loading="lazy"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className={`truncate text-[17px] font-medium tracking-[-0.015em] md:text-[19px] ${selected ? "text-[#ecd36d]" : "text-white/95"}`}>
                                                                    {s.displayName || s.name}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-[12px] text-white/38 md:text-[13px]">{subtitle}</p>
                                                            </div>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={!s.available}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleFavoriteSource(s);
                                                            }}
                                                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${favorite ? "text-[#efd268]" : "text-[#e2c45f] hover:bg-white/[0.05] hover:text-[#ffe28a]"}`}
                                                            aria-label={favorite ? `Remove ${s.displayName || s.name} as default source` : `Make ${s.displayName || s.name} the default source`}
                                                            title={favorite ? "Default source" : "Make default source"}
                                                        >
                                                            <Star className={`h-7 w-7 ${favorite ? "fill-current" : ""}`} strokeWidth={1.65} />
                                                        </button>

                                                        {selected && (
                                                            <div className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0b6f62] text-white shadow-[0_4px_18px_rgba(0,0,0,0.24)]" title="Currently playing">
                                                                <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={1.4} />
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
                        </div>

'''

s = s[:start] + modal + s[end:]
path.write_text(s)
print("server favorite modal patch applied")
