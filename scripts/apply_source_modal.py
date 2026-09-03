from pathlib import Path
import textwrap

path = Path("frontend/src/components/SynapsePlayer.jsx")
s = path.read_text()

# Guard the badge rules the user requested. Do not silently regress these.
if 'return provider === "vidcore" || (provider === "vidy" && /miami/i.test(name));' not in s:
    raise SystemExit("Miami/VidCore 4K badge rule is missing")
if 'const explicitlyHindiV6 = /hindi[^a-z0-9]*v6|v6[^a-z0-9]*hindi/i.test(label);' not in s:
    raise SystemExit("Hindi v6 India-flag rule is missing")
if 'synscraper-default-source-v1' not in s or 'toggleFavoriteSource' not in s:
    raise SystemExit("source favorite/default logic is missing")

# The previous implementation placed the whole modal inside the top-left cloud
# control wrapper. That can make the overlay behave like a dropdown/anchored
# child. Pull it out and mount it directly over the player instead.
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

# Keep the existing cloud button exactly where it is, but remove the nested modal.
button_only = segment[:modal_start].rstrip() + '\n                        </div>\n\n'

# Reuse the existing server UI/favorite behavior, only change where it is mounted.
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

# Mount after the top control bar closes, before the center playback controls.
center_controls_marker = '''                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute inset-0 z-20 flex items-center justify-center'''
insert_at = s.find(center_controls_marker, left_start)
if insert_at < 0:
    raise SystemExit("center controls insertion point missing")
s = s[:insert_at] + modal_block + s[insert_at:]

# Sanity checks: exactly one modal, and it is no longer nested under the cloud wrapper.
if s.count('data-testid="synapse-source-popout"') != 1:
    raise SystemExit("expected exactly one source modal")
new_left_end = s.find(title_marker, left_start)
if 'synapse-source-popout' in s[left_start:new_left_end]:
    raise SystemExit("source modal is still nested in the top-left control")

path.write_text(s)
print("server modal mounted over full player")
