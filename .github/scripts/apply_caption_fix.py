from pathlib import Path

p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

old = '''        const mergeServers = (current, incoming) => {
            const map = new Map();
            for (const item of current || []) map.set(`${item.provider}|${item.name}|${item.quality}`, item);
            for (const item of incoming || []) {
                const key = `${item.provider}|${item.name}|${item.quality}`;
                if (!map.has(key)) map.set(key, item);
            }
            return Array.from(map.values());
        };
'''
new = '''        const mergeServers = (current, incoming) => {
            const map = new Map();
            for (const item of current || []) map.set(`${item.provider}|${item.name}|${item.quality}`, item);
            for (const item of incoming || []) {
                const key = `${item.provider}|${item.name}|${item.quality}`;
                const existing = map.get(key);
                if (!existing) {
                    map.set(key, item);
                    continue;
                }
                const captionMap = new Map();
                for (const caption of [...(existing.captions || []), ...(item.captions || [])]) {
                    const captionKey = caption.play_url || caption.id || `${caption.lang || "und"}:${caption.name || "caption"}`;
                    captionMap.set(captionKey, caption);
                }
                map.set(key, {
                    ...existing,
                    ...item,
                    id: existing.id,
                    captions: Array.from(captionMap.values()),
                });
            }
            return Array.from(map.values());
        };
'''
if old not in t:
    raise SystemExit("progressive merge marker not found")
t = t.replace(old, new, 1)

old = '    }, [mode, sub, subs, hasNext, wake]); // eslint-disable-line\n'
new = '    }, [mode, sub, subs, hasNext, wake, captionsEnabled]); // eslint-disable-line\n'
if old not in t:
    raise SystemExit("keyboard dependency marker not found")
t = t.replace(old, new, 1)

p.write_text(t)
print("Caption merge hardening applied")
