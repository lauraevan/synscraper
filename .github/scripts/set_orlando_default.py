from pathlib import Path

player_path = Path('frontend/src/components/SynapsePlayer.jsx')
text = player_path.read_text()

replacements = []

replacements.append((
'''        return Array.from(found.values()).sort((a, b) => {
            const aMiami = a.provider === "vidy" && /miami/i.test(a.name) ? 0 : 1;
            const bMiami = b.provider === "vidy" && /miami/i.test(b.name) ? 0 : 1;
            return aMiami - bMiami || a.name.localeCompare(b.name);
        });''',
'''        return Array.from(found.values()).sort((a, b) => {
            const rank = (source) => source.provider === "orlando"
                ? 0
                : (source.provider === "vidy" && /miami/i.test(source.name) ? 1 : 2);
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
        });'''
))

replacements.append((
'''            unique.sort((a, b) => {
                const aMiami = a.provider === "vidy" && /miami/i.test(a.source) ? 0 : 1;
                const bMiami = b.provider === "vidy" && /miami/i.test(b.source) ? 0 : 1;
                const aq = a.quality === "auto" ? 0 : Number(a.quality);
                const bq = b.quality === "auto" ? 0 : Number(b.quality);
                return aMiami - bMiami || bq - aq || a.source.localeCompare(b.source);
            });''',
'''            unique.sort((a, b) => {
                const rank = (item) => item.provider === "orlando"
                    ? 0
                    : (item.provider === "vidy" && /miami/i.test(item.source) ? 1 : 2);
                const aq = a.quality === "auto" ? 0 : Number(a.quality);
                const bq = b.quality === "auto" ? 0 : Number(b.quality);
                return rank(a) - rank(b) || bq - aq || a.source.localeCompare(b.source);
            });'''
))

replacements.append((
'''            const preferred = favorite
                || (wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === wanted) : null)
                || (!wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && /^auto/i.test(String(candidate.quality || ""))) : null)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === 1080)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")))
                || list[0];''',
'''            const preferred = favorite
                || (wanted ? list.find((candidate) => candidate.provider === "orlando" && qualityHeight(candidate.quality) === wanted) : null)
                || (!wanted ? list.find((candidate) => candidate.provider === "orlando" && /^auto/i.test(String(candidate.quality || ""))) : null)
                || list.find((candidate) => candidate.provider === "orlando" && qualityHeight(candidate.quality) === 1080)
                || list.find((candidate) => candidate.provider === "orlando")
                || (wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === wanted) : null)
                || (!wanted ? list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && /^auto/i.test(String(candidate.quality || ""))) : null)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")) && qualityHeight(candidate.quality) === 1080)
                || list.find((candidate) => candidate.provider === "vidy" && /miami/i.test(String(candidate.name || "")))
                || list[0];'''
))

replacements.append((
'const providers = ["orlando", "castle", "vidlink", "vidnest", "vidzee", "vidrock", "vidy", "cinejoy", "vidcore", "vixsrc"];',
'const providers = ["orlando", "vidy", "castle", "vidlink", "vidnest", "vidzee", "vidrock", "cinejoy", "vidcore", "vixsrc"];'
))

replacements.append((
'mirror: provider === "vidy" ? "fast" : undefined,',
'mirror: provider === "vidy" ? "miami" : undefined,'
))

old_startup = '''        const quick = getStreams(mediaType, id, season, episode, { provider: "vidy", mirror: "miami", timeout: 5200, ...streamResolveHints })
            .then((d) => {
                if (!alive) return [];
                const list = mergePayload(d, false);
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
                    1800,
                );
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);
                return list;
            })
            .catch(() => startBackground(undefined));

        // If Miami is unusually slow, don't leave the user staring at it forever.
        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground(undefined);
        }, readPreferredSourceKey() ? 5500 : 1800);'''

new_startup = '''        const quick = getStreams(mediaType, id, season, episode, { provider: "orlando", timeout: 8000, ...streamResolveHints })
            .then(async (d) => {
                if (!alive) return [];
                const list = mergePayload(d, false);
                const preferredSource = readPreferredSourceKey();
                const quickHasPreferred = preferredSource && list.some((server) => sourcePreferenceKey(server) === preferredSource);
                const preferredProvider = preferredSource ? preferredSource.split("|")[0] : "";

                // Orlando is the default. If it misses, give Miami the first fallback attempt.
                if (!list.length) {
                    const miami = await getStreams(mediaType, id, season, episode, {
                        provider: "vidy",
                        mirror: "miami",
                        timeout: 5200,
                        ...streamResolveHints,
                    }).catch(() => null);
                    if (!alive) return [];
                    const miamiList = mergePayload(miami, false);
                    backgroundTimer = window.setTimeout(() => startBackground("orlando,vidy,cinejoy"), 900);
                    heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);
                    if (!miamiList.length) return startBackground("orlando,vidy");
                    return miamiList;
                }

                if (preferredSource && !quickHasPreferred) {
                    // A starred source still overrides the built-in Orlando -> Miami order.
                    if (preferredProvider === "cinejoy") {
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 120);
                        backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 700);
                    } else {
                        backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 120);
                        heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 6500);
                    }
                    return list;
                }

                // Orlando is already active; load Miami immediately behind it, then the rest.
                backgroundTimer = window.setTimeout(() => startBackground("orlando,cinejoy"), 350);
                heavyTimer = window.setTimeout(() => startHeavyCineJoy(), 7000);
                return list;
            })
            .catch(async () => {
                const miami = await getStreams(mediaType, id, season, episode, {
                    provider: "vidy",
                    mirror: "miami",
                    timeout: 5200,
                    ...streamResolveHints,
                }).catch(() => null);
                if (!alive) return [];
                const miamiList = mergePayload(miami, false);
                if (!miamiList.length) return startBackground("orlando,vidy");
                backgroundTimer = window.setTimeout(() => startBackground("orlando,vidy,cinejoy"), 900);
                return miamiList;
            });

        // Give Orlando the startup lane; if it stalls, begin the Miami-first fallback pool.
        safetyTimer = window.setTimeout(() => {
            if (!started) startBackground("orlando,cinejoy");
        }, readPreferredSourceKey() ? 5500 : 4200);'''

replacements.append((old_startup, new_startup))

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Frontend block not found:\n{old[:180]}')
    text = text.replace(old, new, 1)

player_path.write_text(text)

scraper_path = Path('backend/scraper.py')
scraper = scraper_path.read_text()

backend_replacements = [
(
'''# Friendly Synflix server names -> resolver classes, in priority order.
PROVIDERS = [
    ("Houston", "castle", ("providers.castle", "CastleResolver")),
    ("Nova", "vidlink", ("providers.vidlink", "VidlinkResolver")),
    ("Nest", "vidnest", ("providers.vidnest", "VidNestResolver")),
    ("Zen", "vidzee", ("providers.vidzee", "VidzeeResolver")),
    ("Rock", "vidrock", ("providers.vidrock", "VidrockResolver")),
    ("Vidy", "vidy", ("providers.vidy", "VidyResolver")),
    ("Orlando", "orlando", ("providers.orlando", "OrlandoResolver")),
    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),
    ("VidCore", "vidcore", ("providers.vidcore", "VidCoreResolver")),
    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),
]''',
'''# Friendly Synflix server names -> resolver classes, in priority order.
PROVIDERS = [
    ("Orlando", "orlando", ("providers.orlando", "OrlandoResolver")),
    ("Vidy", "vidy", ("providers.vidy", "VidyResolver")),
    ("Houston", "castle", ("providers.castle", "CastleResolver")),
    ("Nova", "vidlink", ("providers.vidlink", "VidlinkResolver")),
    ("Nest", "vidnest", ("providers.vidnest", "VidNestResolver")),
    ("Zen", "vidzee", ("providers.vidzee", "VidzeeResolver")),
    ("Rock", "vidrock", ("providers.vidrock", "VidrockResolver")),
    ("CineJoy", "cinejoy", ("providers.cinejoy", "CineJoyResolver")),
    ("VidCore", "vidcore", ("providers.vidcore", "VidCoreResolver")),
    ("Vix", "vixsrc", ("providers.vixsrc", "VixSrcResolver")),
]'''
),
(
'''            is_miami = pid == "vidy" and display_name.lower() == "miami"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": is_miami,
                **s,
            })

    # Miami stays the fast/default playback source. Orlando is always ranked
    # immediately behind it and is limited to the moon.peakstorm.top source.''',
'''            is_orlando = pid == "orlando"
            servers.append({
                "id": f"{pid}-{idx}",
                "name": display_name,
                "provider": pid,
                "primary": is_orlando,
                **s,
            })

    # Orlando is the default playback source. Miami is ranked immediately
    # behind it as the first fallback.'''
),
(
'''    def _server_rank(server):
        if server.get("provider") == "vidy" and str(server.get("name") or "").lower() == "miami":
            return (0, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        if server.get("provider") == "orlando":
            return (1, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        return (2 if server.get("primary") else 3, 0, 0 if server.get("type") == "hls" else 1)''',
'''    def _server_rank(server):
        if server.get("provider") == "orlando":
            return (0, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        if server.get("provider") == "vidy" and str(server.get("name") or "").lower() == "miami":
            return (1, _quality_rank(server), 0 if server.get("type") == "hls" else 1)
        return (2 if server.get("primary") else 3, 0, 0 if server.get("type") == "hls" else 1)'''
),
]

for old, new in backend_replacements:
    if old not in scraper:
        raise SystemExit(f'Backend block not found:\n{old[:180]}')
    scraper = scraper.replace(old, new, 1)

scraper_path.write_text(scraper)
print('Patched Orlando -> Miami source priority successfully')
