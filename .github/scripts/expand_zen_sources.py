from pathlib import Path

scraper = Path('backend/scraper.py')
text = scraper.read_text()
old = '''            streams.append({
                "url": url,
                "type": pu.get("type") or _stream_type(url),
                "quality": pu.get("quality", "Auto"),
                "referer": headers.get("Referer", ""),
                "origin": headers.get("Origin", ""),
                "user_agent": headers.get("User-Agent", USER_AGENT),
                "captions": deduped_captions,
            })'''
new = '''            streams.append({
                "url": url,
                "type": pu.get("type") or _stream_type(url),
                "quality": pu.get("quality", "Auto"),
                "referer": headers.get("Referer", ""),
                "origin": headers.get("Origin", ""),
                "user_agent": headers.get("User-Agent", USER_AGENT),
                "captions": deduped_captions,
                "subserver": pu.get("server") or pu.get("label") or "",
                "lang": pu.get("lang") or pu.get("language") or "",
            })'''
if old not in text:
    raise SystemExit('scraper stream normalization snippet not found')
text = text.replace(old, new, 1)

old = '''        for idx, s in enumerate(streams):
            servers.append({
                "id": f"{pid}-{idx}",
                "name": name if idx == 0 else f"{name} {idx + 1}",
                "provider": pid,
                "primary": pid == "castle",
                **s,
            })'''
new = '''        for idx, s in enumerate(streams):
            subserver = str(s.get("subserver") or "").strip()
            if pid == "vidzee" and subserver:
                pretty = {
                    "dcloud": "DCloud",
                    "tik": "Tik",
                    "ipcloud": "IPCloud",
                    "v6:hindi": "V6 Hindi",
                }.get(subserver.lower(), subserver)
                display_name = f"{name} · {pretty}"
            else:
                display_name = name if idx == 0 else f"{name} {idx + 1}"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": pid == "castle",
                **s,
            })'''
if old not in text:
    raise SystemExit('scraper naming snippet not found')
text = text.replace(old, new, 1)
scraper.write_text(text)

player = Path('frontend/src/components/SynapsePlayer.jsx')
text = player.read_text()
old = '''    const sourceSlots = SOURCE_CATALOG.map((source) => {
        const server = servers.find((s) => s.provider === source.provider);
        return server
            ? { ...server, displayName: source.name, available: true }
            : { id: `unavailable-${source.provider}`, provider: source.provider, name: source.name, displayName: source.name, available: false };
    });'''
new = '''    const sourceSlots = SOURCE_CATALOG.flatMap((source) => {
        const matches = servers.filter((s) => s.provider === source.provider);
        if (source.provider === "vidzee" && matches.length) {
            return matches.map((server) => ({
                ...server,
                displayName: server.name || source.name,
                available: true,
            }));
        }
        const server = matches[0];
        return server
            ? [{ ...server, displayName: source.name, available: true }]
            : [{ id: `unavailable-${source.provider}`, provider: source.provider, name: source.name, displayName: source.name, available: false }];
    });'''
if old not in text:
    raise SystemExit('sourceSlots snippet not found')
text = text.replace(old, new, 1)
text = text.replace('<MenuItem key={s.provider} active={serverId === s.id} onClick={() => selectCaptionSource(s)}>', '<MenuItem key={s.id} active={serverId === s.id} onClick={() => selectCaptionSource(s)}>')
player.write_text(text)
