from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch target: {label}")
    return text.replace(old, new, 1)

# ---- backend/scraper.py: preserve provider VTT/Granite caption tracks ----
p = Path("backend/scraper.py")
t = p.read_text()

marker = "\ndef _run_one(cls, media_type, tmdb_id, season, episode):\n"
helper = r'''

def _normalize_captions(items, default_source: str) -> list:
    if not items:
        return []
    if isinstance(items, dict):
        items = list(items.values())
    if not isinstance(items, list):
        items = [items]

    out = []
    for idx, item in enumerate(items):
        if isinstance(item, str):
            item = {"url": item}
        if not isinstance(item, dict):
            continue

        url = item.get("url") or item.get("file") or item.get("src")
        if not isinstance(url, str) or not url.startswith("http"):
            continue

        kind = str(item.get("type") or item.get("format") or "").lower().lstrip(".")
        path = url.split("?", 1)[0].lower()
        is_vtt = kind in ("vtt", "webvtt") or path.endswith(".vtt")
        if not is_vtt:
            continue

        headers = item.get("headers", {}) or {}
        source = str(item.get("source") or item.get("provider") or default_source or "vtt").lower()
        out.append({
            "id": str(item.get("id") or f"{source}-vtt-{idx}"),
            "url": url,
            "name": item.get("name") or item.get("label") or item.get("display") or item.get("language") or "WebVTT",
            "lang": item.get("lang") or item.get("language") or "und",
            "source": source,
            "type": "vtt",
            "referer": headers.get("Referer") or item.get("referer") or "",
            "origin": headers.get("Origin") or item.get("origin") or "",
        })
    return out


def _caption_items(obj, default_source: str) -> list:
    if not isinstance(obj, dict):
        return []
    gathered = []
    for key in ("captions", "subtitles", "tracks"):
        value = obj.get(key)
        if value:
            gathered.extend(_normalize_captions(value, default_source))
    seen = set()
    result = []
    for caption in gathered:
        key = caption["url"]
        if key in seen:
            continue
        seen.add(key)
        result.append(caption)
    return result
'''
if "def _normalize_captions(" not in t:
    t = replace_once(t, marker, helper + marker, "scraper helper insertion")

old = '''        if data.get("status") != "success":
            return []
        streams = []
        for pu in data.get("playable_urls", []):
'''
new = '''        if data.get("status") != "success":
            return []
        default_caption_source = cls.__name__.replace("Resolver", "").lower()
        root_captions = _caption_items(data, default_caption_source)
        streams = []
        for pu in data.get("playable_urls", []):
'''
if "root_captions = _caption_items" not in t:
    t = replace_once(t, old, new, "root caption collection")

old = '''            headers = pu.get("headers", {}) or {}
            streams.append({
                "url": url,
'''
new = '''            headers = pu.get("headers", {}) or {}
            captions = list(root_captions)
            captions.extend(_caption_items(pu, default_caption_source))
            deduped_captions = []
            seen_caption_urls = set()
            for caption in captions:
                if caption["url"] in seen_caption_urls:
                    continue
                seen_caption_urls.add(caption["url"])
                deduped_captions.append(caption)
            streams.append({
                "url": url,
'''
if "deduped_captions" not in t:
    t = replace_once(t, old, new, "per-stream caption collection")

old = '''                "user_agent": headers.get("User-Agent", USER_AGENT),
            })
'''
new = '''                "user_agent": headers.get("User-Agent", USER_AGENT),
                "captions": deduped_captions,
            })
'''
if '"captions": deduped_captions' not in t:
    t = replace_once(t, old, new, "caption attachment")

p.write_text(t)

# ---- backend/server.py: expose same-origin caption proxy URLs ----
p = Path("backend/server.py")
t = p.read_text()
old = '''    out = []
    for s in servers:
        out.append({
            "id": s["id"], "name": s["name"], "provider": s["provider"],
            "primary": s["primary"], "type": s["type"], "quality": s["quality"],
            "play_url": _play_url(s["url"], s["referer"], s["origin"]),
        })
'''
new = '''    out = []
    for s in servers:
        captions = []
        for c in s.get("captions", []):
            captions.append({
                "id": c.get("id"),
                "name": c.get("name") or "WebVTT",
                "lang": c.get("lang") or "und",
                "source": c.get("source") or "vtt",
                "type": "vtt",
                "play_url": _play_url(c["url"], c.get("referer", ""), c.get("origin", "")),
            })
        out.append({
            "id": s["id"], "name": s["name"], "provider": s["provider"],
            "primary": s["primary"], "type": s["type"], "quality": s["quality"],
            "play_url": _play_url(s["url"], s["referer"], s["origin"]),
            "captions": captions,
        })
'''
if '"captions": captions' not in t:
    t = replace_once(t, old, new, "server caption exposure")
p.write_text(t)

# ---- frontend: WebVTT parser + Granite/VTT menu ----
p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

marker = "\nconst CaptionSlider = ({ label, value, min, max, step = 1, suffix = \"\", onChange }) => (\n"
parser = r'''

const parseVttTime = (value) => {
    const parts = String(value || "").trim().replace(",", ".").split(":");
    let seconds = 0;
    for (const part of parts) {
        const n = Number(part);
        if (!Number.isFinite(n)) return NaN;
        seconds = (seconds * 60) + n;
    }
    return seconds;
};

const parseWebVtt = (value) => {
    const blocks = String(value || "").replace(/\r/g, "").split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex < 0) continue;
        const [rawStart, rawEndAndSettings] = lines[timingIndex].split("-->");
        const rawEnd = String(rawEndAndSettings || "").trim().split(/\s+/)[0];
        const start = parseVttTime(rawStart);
        const end = parseVttTime(rawEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
        const text = normalizeCaptionText(lines.slice(timingIndex + 1).join("\n"));
        if (text) cues.push({ start, end, text });
    }
    return cues;
};
'''
if "const parseWebVtt =" not in t:
    t = replace_once(t, marker, parser + marker, "VTT parser insertion")

old = '''    const [captionText, setCaptionText] = useState("");
    const [captionStyle, setCaptionStyle] = useState(() => {
'''
new = '''    const [captionText, setCaptionText] = useState("");
    const [externalCaptionId, setExternalCaptionId] = useState(null);
    const [externalCues, setExternalCues] = useState([]);
    const [externalCaptionLoading, setExternalCaptionLoading] = useState(false);
    const [externalCaptionError, setExternalCaptionError] = useState("");
    const [captionStyle, setCaptionStyle] = useState(() => {
'''
if "externalCaptionId" not in t:
    t = replace_once(t, old, new, "external caption state")

old = '''        let alive = true;
        setMode("loading"); setStepIdx(0); setError(null);
'''
new = '''        let alive = true;
        setMode("loading"); setStepIdx(0); setError(null);
        setExternalCaptionId(null); setExternalCues([]); setExternalCaptionError("");
'''
if "setExternalCaptionId(null); setExternalCues([]);" not in t:
    t = replace_once(t, old, new, "reset external captions")

marker = '''    // video wiring
'''
selector = r'''    const selectExternalCaption = async (caption) => {
        if (!caption?.play_url) return;
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionId(caption.id);
        setExternalCues([]);
        setExternalCaptionError("");
        setExternalCaptionLoading(true);
        try {
            const response = await fetch(hlsProxyUrl(caption.play_url));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const cues = parseWebVtt(await response.text());
            if (!cues.length) throw new Error("No WebVTT cues found");
            setExternalCues(cues);
        } catch (err) {
            setExternalCaptionId(null);
            setExternalCaptionError(err?.message || "Could not load this VTT track");
        } finally {
            setExternalCaptionLoading(false);
        }
    };

    const turnOffCaptions = () => {
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        setSub(-1);
        setExternalCaptionId(null);
        setExternalCues([]);
        setCaptionText("");
    };

'''
if "const selectExternalCaption =" not in t:
    t = replace_once(t, marker, selector + marker, "external caption selector")

# Add a dedicated effect after the existing HLS caption renderer. The existing
# renderer clears once when sub === -1; this later effect owns VTT text updates.
marker = '''    const fastSeekTo = (seconds, precise = false) => {
'''
external_effect = r'''    useEffect(() => {
        if (!externalCaptionId || !externalCues.length) return;
        const adjustedTime = current - Number(captionStyle.delay || 0);
        const raw = externalCues
            .filter((cue) => adjustedTime >= cue.start && adjustedTime <= cue.end)
            .map((cue) => cue.text)
            .join("\n");
        setCaptionText(captionStyle.autoCorrect ? autoCorrectCaptionText(raw, captionStyle.accuracy) : normalizeCaptionText(raw));
    }, [externalCaptionId, externalCues, current, captionStyle.delay, captionStyle.autoCorrect, captionStyle.accuracy]);

'''
if "externalCues.length" not in t:
    t = replace_once(t, marker, external_effect + marker, "external VTT render effect")

old = '''    const captionSources = Array.from(new Map(servers.map((s) => [s.provider, s])).values()).slice(0, 6);
'''
new = '''    const captionSources = Array.from(new Map(servers.map((s) => [s.provider, s])).values()).slice(0, 6);
    const externalCaptions = Array.from(new Map(
        servers.flatMap((s) => (s.captions || []).map((c) => [c.play_url || c.id, { ...c, serverName: s.name }]))
    ).values());
'''
if "const externalCaptions =" not in t:
    t = replace_once(t, old, new, "external captions derivation")

# Custom caption overlay and CC button active state.
t = t.replace('mode === "ready" && sub >= 0 && captionText', 'mode === "ready" && (sub >= 0 || externalCaptionId) && captionText', 1)
t = t.replace('${sub >= 0 ? "bg-white text-black border-white"', '${sub >= 0 || externalCaptionId ? "bg-white text-black border-white"', 1)

old = '''                                        <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/45">All tracks · {activeServer?.name || "Current source"}</p>
                                        <MenuItem active={sub === -1} onClick={() => changeSub(-1)} testId="sub-off">Off</MenuItem>
                                        {subs.map((track, i) => (
                                            <MenuItem key={i} active={sub === i} onClick={() => changeSub(i)}>
                                                <span>{track.name || track.lang || `Track ${i + 1}`}</span>
                                                <span className="text-[10px] uppercase opacity-40">{track.lang || track.language || "CC"}</span>
                                            </MenuItem>
                                        ))}
                                        {!subs.length && <p className="px-3 py-3 text-xs leading-relaxed text-white/45">This source exposes no caption track. Pick another source above; Synapse keeps your movie position while it switches.</p>}
'''
new = '''                                        {externalCaptions.length > 0 && (
                                            <>
                                                <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/45">VTT / Granite</p>
                                                {externalCaptions.map((track) => (
                                                    <MenuItem key={`vtt-${track.play_url || track.id}`} active={externalCaptionId === track.id} onClick={() => selectExternalCaption(track)}>
                                                        <span className="min-w-0 truncate">{track.name || track.lang || "WebVTT"}</span>
                                                        <span className={`ml-3 text-[9px] font-semibold uppercase tracking-[0.12em] ${String(track.source || "").toLowerCase() === "granite" ? "text-emerald-300" : "opacity-45"}`}>
                                                            {String(track.source || "vtt").toLowerCase() === "granite" ? "GRANITE · VTT" : `${String(track.source || "VTT").toUpperCase()} · VTT`}
                                                        </span>
                                                    </MenuItem>
                                                ))}
                                                {externalCaptionLoading && <p className="px-3 py-2 text-[11px] text-white/40">Loading WebVTT…</p>}
                                                {externalCaptionError && <p className="px-3 py-2 text-[11px] text-red-300/75">{externalCaptionError}</p>}
                                                <div className="h-px bg-white/10 my-2" />
                                            </>
                                        )}
                                        <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/45">All tracks · {activeServer?.name || "Current source"}</p>
                                        <MenuItem active={sub === -1 && !externalCaptionId} onClick={turnOffCaptions} testId="sub-off">Off</MenuItem>
                                        {subs.map((track, i) => (
                                            <MenuItem key={i} active={sub === i && !externalCaptionId} onClick={() => { setExternalCaptionId(null); setExternalCues([]); changeSub(i); }}>
                                                <span>{track.name || track.lang || `Track ${i + 1}`}</span>
                                                <span className="text-[10px] uppercase opacity-40">{track.lang || track.language || "CC"}</span>
                                            </MenuItem>
                                        ))}
                                        {!subs.length && !externalCaptions.length && <p className="px-3 py-3 text-xs leading-relaxed text-white/45">This source exposes no caption track. Pick another source above; Synapse keeps your movie position while it switches.</p>}
'''
if "VTT / Granite" not in t:
    t = replace_once(t, old, new, "VTT/Granite caption menu")

p.write_text(t)
