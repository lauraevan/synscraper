from pathlib import Path


def require_replace(text: str, old: str, new: str, count: int = 1) -> str:
    if old not in text:
        raise RuntimeError(f"Expected patch marker not found: {old[:120]!r}")
    return text.replace(old, new, count)


# ---------------- Backend: dedicated timed-text proxy ----------------
p = Path("backend/server.py")
t = p.read_text()

play_url = '''def _play_url(url, ref, origin):
    q = f"/api/hls?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q
'''
caption_helper = play_url + '''

def _caption_url(url, ref, origin):
    q = f"/api/caption?url={quote(url, safe='')}"
    if ref:
        q += f"&ref={quote(ref, safe='')}"
    if origin:
        q += f"&origin={quote(origin, safe='')}"
    return q
'''
t = require_replace(t, play_url, caption_helper)
t = require_replace(
    t,
    '"play_url": _play_url(c["url"], c.get("referer", ""), c.get("origin", "")),',
    '"play_url": _caption_url(c["url"], c.get("referer", ""), c.get("origin", "")),',
)

hls_marker = '@api_router.get("/hls")\nasync def hls('
if hls_marker not in t:
    raise RuntimeError("HLS route marker missing")
caption_route = '''@api_router.get("/caption")
async def caption(url: str = Query(...), ref: str | None = None,
                  origin: str | None = None):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "caption URL must be http(s)")
    headers = {
        "User-Agent": UA,
        "Accept": "text/vtt,text/plain,application/x-subrip,application/octet-stream,*/*",
    }
    if ref:
        headers["Referer"] = ref
    if origin:
        headers["Origin"] = origin
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url, headers=headers)
            r.raise_for_status()
        if len(r.content) > 5 * 1024 * 1024:
            raise HTTPException(413, "caption file is too large")
        text = r.content.decode("utf-8-sig", errors="replace")
        text = text.replace("\\r\\n", "\\n").replace("\\r", "\\n")
        return Response(
            text,
            media_type="text/vtt",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=120",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("caption proxy failed %s: %s", url[:80], exc)
        raise HTTPException(502, "caption upstream error")


'''
t = t.replace(hls_marker, caption_route + hls_marker, 1)
p.write_text(t)


# ---------------- Frontend: validate/rank captions across sources ----------------
p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

shortcut_marker = "const SHORTCUTS = ["
if shortcut_marker not in t:
    raise RuntimeError("SHORTCUTS marker missing")
helpers = r'''const CAPTION_LANGUAGE_NAMES = {
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

'''
t = t.replace(shortcut_marker, helpers + shortcut_marker, 1)
t = t.replace("    accuracy: 85,", "    accuracy: 0,", 1)
t = t.replace("    autoCorrect: true,", "    autoCorrect: false,", 1)
t = t.replace("synapse-caption-style-v1", "synscraper-caption-style-v2")

# Robust line-based VTT/SRT parser.
parser_start = t.index("const parseWebVtt = (value) => {")
parser_end = t.index("\n\nconst CaptionSlider", parser_start)
parser = r'''const parseWebVtt = (value) => {
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
};'''
t = t[:parser_start] + parser + t[parser_end:]

t = require_replace(
    t,
    "    const gainRef = useRef(null);\n",
    "    const gainRef = useRef(null);\n    const captionCacheRef = useRef(new Map());\n",
)
state_marker = '    const [externalCaptionError, setExternalCaptionError] = useState("");\n'
t = require_replace(
    t,
    state_marker,
    state_marker + '    const [captionHealth, setCaptionHealth] = useState({});\n    const [captionsEnabled, setCaptionsEnabled] = useState(readCaptionsEnabled);\n    const [preferredCaptionLang, setPreferredCaptionLang] = useState(readCaptionLanguage);\n',
)

# Validated, cached, detached caption loader.
loader_start = t.index("    const selectExternalCaption = async (caption) => {")
loader_end = t.index("    // video wiring", loader_start)
loader = r'''    const loadExternalCaption = async (caption, { silent = false } = {}) => {
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

'''
t = t[:loader_start] + loader + t[loader_end:]

# A detached VTT caption must not be cleared just because the current HLS subtitle index is -1.
t = require_replace(
    t,
    '''    useEffect(() => {
        if (mode !== "ready" || sub < 0) {
            setCaptionText("");
            return undefined;
        }
''',
    '''    useEffect(() => {
        if (externalCaptionId) return undefined;
        if (mode !== "ready" || sub < 0) {
            setCaptionText("");
            return undefined;
        }
''',
)
t = t.replace(
    "    }, [mode, sub, subs, serverId, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);",
    "    }, [mode, sub, subs, serverId, externalCaptionId, captionStyle.delay, captionStyle.accuracy, captionStyle.autoCorrect]);",
    1,
)
t = require_replace(
    t,
    '''        const raw = externalCues
            .filter((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end)
            .map((cue) => cue.text)
            .join("\\n");
''',
    '''        const raw = cueTextAt(externalCues, adjustedTime);
''',
)
t = require_replace(
    t,
    '                c: () => changeSub(sub >= 0 ? -1 : (subs[0] ? 0 : -1)),',
    '                c: toggleCaptionsPreference,',
)

# Group tracks by language and rank healthy direct caption files by completeness.
derived_start = t.index("    const captionSources = sourceSlots.filter((s) => s.available);")
derived_end = t.index("    const activeQualityHeight =", derived_start)
derived = r'''    const externalCaptions = Array.from(new Map(
        servers.flatMap((s) => (s.captions || []).map((c) => {
            const key = c.play_url || `${c.source || s.provider}:${c.id || c.name || "caption"}`;
            const language = normalizeCaptionLanguage(c.lang || c.name);
            return [key, { ...c, key, language, serverName: s.name, provider: s.provider }];
        }))
    ).values());
    const captionInventoryKey = externalCaptions.map((track) => track.key).sort().join("|");

    useEffect(() => {
        let alive = true;
        Promise.allSettled(externalCaptions.map(async (track) => {
            const result = await loadExternalCaption(track, { silent: true });
            return alive ? result : null;
        }));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captionInventoryKey]);

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

'''
t = t[:derived_start] + derived + t[derived_end:]
t = require_replace(
    t,
    '    const activeExternalCaption = externalCaptions.find((track) => track.id === externalCaptionId);',
    '    const activeExternalCaption = externalCaptions.find((track) => track.key === externalCaptionId);',
)
t = require_replace(
    t,
    '    const subtitleSettingsLabel = activeExternalCaption ? (String(activeExternalCaption.source || "").toLowerCase() === "granite" ? "Granite" : "VTT") : sub >= 0 ? "HLS" : "Off";',
    '    const subtitleSettingsLabel = captionsEnabled ? `${captionLanguageName(preferredCaptionLang)}${activeExternalCaption ? ` · ${activeExternalCaption.serverName}` : sub >= 0 ? " · HLS" : ""}` : "Off";',
)

# Quick caption menu: languages only; automatically displays the current best source.
quick_start = t.index('                                    <Popover open={menu === "subs"} wide>')
quality_marker = '''                                <div className="relative">
                                    <button
                                        data-testid="synapse-quality-menu"'''
quick_end = t.index(quality_marker, quick_start)
quick = r'''                                    <Popover open={menu === "subs"} wide>
                                        <div className="px-4 pb-3 pt-2">
                                            <p className="text-sm font-semibold text-white">Captions</p>
                                            <p className="mt-1 text-[11px] text-white/40">The cleanest complete track is picked automatically for each language.</p>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto border-y border-white/10 py-1 scrollbar-none">
                                            <MenuItem active={!captionsEnabled} onClick={turnOffCaptions} testId="sub-off">
                                                <span>Off</span><span className="text-[10px] opacity-40">No captions</span>
                                            </MenuItem>
                                            {captionLanguageOptions.map((option) => (
                                                <MenuItem key={`caption-language-${option.code}`} active={captionsEnabled && preferredCaptionLang === option.code} onClick={() => selectCaptionLanguage(option.code)}>
                                                    <span className="min-w-0 truncate">{option.name}</span>
                                                    <span className="ml-3 text-[10px] uppercase opacity-40">{option.best ? `Best · ${option.best.serverName}` : option.pending ? "Checking…" : "HLS"}</span>
                                                </MenuItem>
                                            ))}
                                            {!captionLanguageOptions.length && <p className="px-3 py-4 text-xs text-white/40">No healthy caption tracks are available yet.</p>}
                                        </div>
                                        {(externalCaptionLoading || sourcesLoading || captionLanguageOptions.some((option) => option.pending)) && <p className="px-3 py-2 text-[11px] text-white/35">Checking caption sources for the most complete track…</p>}
                                        {externalCaptionError && <p className="px-3 py-2 text-[11px] text-red-300/75">{externalCaptionError}</p>}
                                        <div className="flex items-center justify-between px-3 pb-1 pt-3">
                                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Appearance</p>
                                            <button onClick={resetCaptionStyle} className="text-[11px] text-white/45 hover:text-white">Reset</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 px-3 py-2">
                                            {[80, 100, 125].map((size) => (
                                                <button key={size} onClick={() => updateCaptionStyle("size", size)} className={`rounded-lg px-2 py-2 text-xs ${captionStyle.size === size ? "bg-white text-black" : "bg-white/[0.05] text-white/60 hover:text-white"}`}>{size === 80 ? "Small" : size === 100 ? "Medium" : "Large"}</button>
                                            ))}
                                        </div>
                                        <CaptionSlider label="Background" value={captionStyle.background} min={0} max={80} step={10} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                        <CaptionSlider label="Sync" value={captionStyle.delay} min={-3} max={3} step={0.1} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                                            {["#ffffff", "#ffe66d", "#77e0ff", "#9cff8f"].map((color) => (
                                                <button key={color} onClick={() => updateCaptionStyle("color", color)} className={`h-7 w-7 rounded-full border-2 ${captionStyle.color.toLowerCase() === color ? "border-white" : "border-white/15"}`} style={{ backgroundColor: color }} aria-label={`Caption color ${color}`} />
                                            ))}
                                        </div>
                                    </Popover>
                                </div>

'''
t = t[:quick_start] + quick + t[quick_end:]

# Settings caption page uses the same language/best-track model.
settings_start = t.index('                            {settingsPage === "subtitles" && (')
settings_end = t.index('                            {settingsPage === "auto" && (', settings_start)
settings = r'''                            {settingsPage === "subtitles" && (
                                <div className="space-y-4 p-1">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
                                        <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.17em] text-white/38">Language</p>
                                        <button onClick={turnOffCaptions} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm ${!captionsEnabled ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}><span>Off</span></button>
                                        {captionLanguageOptions.map((option) => (
                                            <button key={`settings-caption-${option.code}`} onClick={() => selectCaptionLanguage(option.code)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${captionsEnabled && preferredCaptionLang === option.code ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"}`}>
                                                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                                                <span className="text-[10px] uppercase opacity-45">{option.best ? `Best · ${option.best.serverName}` : option.pending ? "Checking…" : "HLS"}</span>
                                            </button>
                                        ))}
                                        {!captionLanguageOptions.length && <p className="px-3 py-3 text-xs text-white/40">No healthy subtitle track is available yet.</p>}
                                        {externalCaptionError && <p className="px-3 py-2 text-xs text-red-300/80">{externalCaptionError}</p>}
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-2">
                                        <div className="flex items-center justify-between px-3 py-2"><p className="text-[10px] uppercase tracking-[0.17em] text-white/38">Appearance & sync</p><button onClick={resetCaptionStyle} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 hover:bg-white/10">Reset</button></div>
                                        <CaptionSlider label="Size" value={captionStyle.size} min={60} max={180} suffix="%" onChange={(v) => updateCaptionStyle("size", v)} />
                                        <CaptionSlider label="Background" value={captionStyle.background} min={0} max={90} suffix="%" onChange={(v) => updateCaptionStyle("background", v)} />
                                        <CaptionSlider label="Outline" value={captionStyle.outline} min={0} max={4} step={0.5} suffix="px" onChange={(v) => updateCaptionStyle("outline", v)} />
                                        <CaptionSlider label="Vertical position" value={captionStyle.position} min={60} max={92} suffix="%" onChange={(v) => updateCaptionStyle("position", v)} />
                                        <CaptionSlider label="Sync" value={captionStyle.delay} min={-5} max={5} step={0.05} suffix="s" onChange={(v) => updateCaptionStyle("delay", v)} />
                                        <div className="flex items-center gap-3 px-3 py-3"><input type="color" value={captionStyle.color} onChange={(e) => updateCaptionStyle("color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" aria-label="Subtitle color" /><span className="flex-1 text-sm text-white/70">Subtitle color</span></div>
                                    </div>
                                </div>
                            )}

'''
t = t[:settings_start] + settings + t[settings_end:]

p.write_text(t)
print("Caption patch applied")
