from pathlib import Path
import textwrap

path = Path("frontend/src/components/SynapsePlayer.jsx")
s = path.read_text()

# Guard the badge/default-source rules the player already relies on. Do not
# silently regress these while patching the source picker.
if 'return provider === "vidcore" || (provider === "vidy" && /miami/i.test(name));' not in s:
    raise SystemExit("Miami/VidCore 4K badge rule is missing")
if 'const explicitlyHindiV6 = /hindi[^a-z0-9]*v6|v6[^a-z0-9]*hindi/i.test(label);' not in s:
    raise SystemExit("Hindi v6 India-flag rule is missing")
if 'synscraper-default-source-v1' not in s or 'toggleFavoriteSource' not in s:
    raise SystemExit("source favorite/default logic is missing")

# Older revisions nested the whole server modal under the top-left cloud
# button. Relocate it only when that old layout is still present. The script is
# intentionally idempotent so it can also be reused for performance patches.
if 'data-source-layout="player-modal"' not in s:
    left_marker = '                        <div className="absolute left-5 top-5 md:left-7 md:top-7">'
    title_marker = '                        <div className="absolute left-1/2 top-5 md:top-6 -translate-x-1/2 text-center max-w-[60%] pointer-events-none">'
    left_start = s.find(left_marker)
    title_start = s.find(title_marker, left_start + 1)
    if left_start < 0 or title_start < 0:
        raise SystemExit(f"source control boundaries missing: left={left_start}, title={title_start}")

    segment = s[left_start:title_start]
    modal_marker = '                            {menu === "sources" && ('
    modal_start = segment.find(modal_marker)
    outer_close = segment.rfind('                        </div>')
    if modal_start < 0 or outer_close < 0 or outer_close <= modal_start:
        raise SystemExit("could not isolate nested server modal")

    button_only = segment[:modal_start].rstrip() + '\n                        </div>\n\n'
    modal_expr = textwrap.dedent(segment[modal_start:outer_close]).strip()
    modal_expr = modal_expr.replace('data-source-layout="server-modal"', 'data-source-layout="player-modal"', 1)
    modal_expr = modal_expr.replace(
        'className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[5px]"',
        'className="absolute inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[5px] pointer-events-auto"',
        1,
    )
    if 'data-source-layout="player-modal"' not in modal_expr or 'className="absolute inset-0 z-[95]' not in modal_expr:
        raise SystemExit("modal overlay conversion did not apply")
    modal_block = textwrap.indent(modal_expr, '                    ') + '\n\n'

    s = s[:left_start] + button_only + s[title_start:]

    center_controls_marker = '''                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute inset-0 z-20 flex items-center justify-center'''
    insert_at = s.find(center_controls_marker, left_start)
    if insert_at < 0:
        raise SystemExit("center controls insertion point missing")
    s = s[:insert_at] + modal_block + s[insert_at:]

# The old background resolver made one /streams request for every provider.
# The backend resolves those providers concurrently but does not return until
# the slowest one finishes, which makes the server picker look frozen. Fan the
# requests out by provider instead and merge each response as soon as it lands.
old_background = '''        const startBackground = (exclude) => {
            if (backgroundPromise) return backgroundPromise;
            backgroundPromise = getStreams(mediaType, id, season, episode, { timeout: 45000, exclude, ...streamResolveHints })
                .then((data) => mergePayload(data, true))
                .catch(() => [])
                .finally(() => {
                    if (alive) setSourcesLoading(false);
                });
            return backgroundPromise;
        };'''

new_background = '''        const startBackground = (exclude) => {
            if (backgroundPromise) return backgroundPromise;

            const excluded = new Set(
                String(exclude || "")
                    .split(",")
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean),
            );
            const providers = ["castle", "vidlink", "vidnest", "vidzee", "vidrock", "vidy", "cinejoy", "vidcore", "vixsrc"];
            const requests = providers
                .filter((provider) => !excluded.has(provider))
                .map((provider) => getStreams(mediaType, id, season, episode, {
                    provider,
                    mirror: provider === "vidy" ? "fast" : undefined,
                    timeout: provider === "cinejoy" ? 12000 : 9500,
                    ...streamResolveHints,
                })
                    .then((data) => mergePayload(data, true))
                    .catch(() => []));

            if (!requests.length) {
                backgroundPromise = Promise.resolve([]);
                if (alive) setSourcesLoading(false);
                return backgroundPromise;
            }

            backgroundPromise = Promise.allSettled(requests)
                .then((results) => results.flatMap((result) =>
                    result.status === "fulfilled" && Array.isArray(result.value) ? result.value : []
                ))
                .finally(() => {
                    if (alive) setSourcesLoading(false);
                });
            return backgroundPromise;
        };'''

if old_background in s:
    s = s.replace(old_background, new_background, 1)
elif new_background not in s:
    raise SystemExit("background source loader block not found")

# Start filling the picker shortly after Miami is ready. Because background
# providers now resolve independently, this no longer makes a slow provider
# block playback or the rest of the server list.
old_delay = '''                backgroundTimer = window.setTimeout(
                    () => startBackground(hasMiamiCaptions ? "vidy,cinejoy" : "cinejoy"),
                    3200,
                );'''
new_delay = '''                backgroundTimer = window.setTimeout(
                    () => startBackground(hasMiamiCaptions ? "vidy,cinejoy" : "cinejoy"),
                    700,
                );'''
if old_delay in s:
    s = s.replace(old_delay, new_delay, 1)
elif new_delay not in s:
    raise SystemExit("background source delay block not found")

# Sanity checks: exactly one player-level modal and the progressive loader are
# present after all transformations.
if s.count('data-testid="synapse-source-popout"') != 1:
    raise SystemExit("expected exactly one source modal")
if 'data-source-layout="player-modal"' not in s:
    raise SystemExit("player-level source modal is missing")
if 'Promise.allSettled(requests)' not in s or 'mirror: provider === "vidy" ? "fast" : undefined' not in s:
    raise SystemExit("progressive server loader patch is missing")

path.write_text(s)
print("server modal verified and progressive server loading enabled")
