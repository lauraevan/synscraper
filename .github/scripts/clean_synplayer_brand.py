from pathlib import Path

p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

replacements = [
    (
        '    const [menu, setMenu] = useState(null);\n    const [help, setHelp] = useState(false);',
        '    const [menu, setMenu] = useState(null);\n    const [brandExpanded, setBrandExpanded] = useState(false);\n    const [help, setHelp] = useState(false);',
        'brand state',
    ),
    (
        'className="relative w-full aspect-video bg-black rounded-[22px] overflow-hidden border border-white/10 select-none text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"',
        'className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden border border-white/[0.08] select-none text-white shadow-[0_20px_65px_rgba(0,0,0,0.38)]"',
        'clean container',
    ),
    (
        'className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.34),rgba(0,0,0,0.04)_34%,rgba(0,0,0,0.08)_58%,rgba(0,0,0,0.72)_100%)] z-10"',
        'className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.24),rgba(0,0,0,0.02)_34%,rgba(0,0,0,0.05)_60%,rgba(0,0,0,0.64)_100%)] z-10"',
        'lighter control gradient',
    ),
    (
        'className={`grid h-12 w-12 md:h-14 md:w-14 place-items-center rounded-full border transition-all duration-200 active:scale-95 ${menu === "sources" ? "border-white/30 bg-white/15 text-white" : "border-white/10 bg-black/20 text-white/90 hover:bg-white/10 hover:text-white"}`}',
        'className={`grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-full border backdrop-blur-xl transition-all duration-200 active:scale-95 ${menu === "sources" ? "border-white/25 bg-white/14 text-white" : "border-white/[0.08] bg-black/18 text-white/85 hover:bg-white/[0.08] hover:text-white"}`}',
        'clean source button',
    ),
    (
        '<Cloud className="h-9 w-9 md:h-10 md:w-10 stroke-[1.65]" />',
        '<Cloud className="h-7 w-7 md:h-8 md:w-8 stroke-[1.55]" />',
        'source icon',
    ),
    (
        'className="absolute left-0 top-[3.55rem] md:top-[4rem] z-40 w-[250px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/15 bg-black/88 p-2 shadow-2xl backdrop-blur-2xl"',
        'className="absolute left-0 top-[3.2rem] md:top-[3.45rem] z-40 w-[244px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/86 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl"',
        'source popout',
    ),
    (
        '                        <div className="absolute left-1/2 top-6 md:top-7 -translate-x-1/2 text-center max-w-[68%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] pointer-events-none">\n                            <p className="text-sm md:text-lg font-medium text-white/80 leading-none">You\'re Watching</p>\n                            <p className="mt-2 text-base md:text-xl font-semibold text-white truncate">{displayTitle}</p>\n                        </div>',
        '                        <div className="absolute left-1/2 top-5 md:top-6 -translate-x-1/2 text-center max-w-[60%] pointer-events-none">\n                            <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.18em] text-white/38 leading-none">Now playing</p>\n                            <p className="mt-1.5 text-sm md:text-lg font-medium tracking-[-0.02em] text-white/92 truncate">{displayTitle}</p>\n                        </div>\n\n                        <button\n                            data-testid="synplayer-brand-pill"\n                            onClick={(e) => { e.stopPropagation(); setBrandExpanded((v) => !v); }}\n                            className={`absolute right-5 top-5 md:right-7 md:top-7 flex h-9 items-center overflow-hidden rounded-full border border-white/[0.09] bg-black/20 text-white/90 backdrop-blur-xl transition-[width,background-color,border-color] duration-300 ease-out hover:bg-white/[0.08] hover:border-white/15 ${brandExpanded ? "w-[112px] px-3" : "w-9 px-0 justify-center"}`}\n                            aria-label={brandExpanded ? "Collapse SynPlayer branding" : "Show SynPlayer branding"}\n                            aria-expanded={brandExpanded}\n                            title="SynPlayer"\n                        >\n                            <span className="shrink-0 text-sm font-semibold tracking-[-0.03em]">S</span>\n                            <span className={`overflow-hidden whitespace-nowrap text-sm font-medium tracking-[-0.03em] transition-all duration-300 ${brandExpanded ? "ml-0.5 max-w-[78px] opacity-100" : "ml-0 max-w-0 opacity-0"}`}>ynPlayer</span>\n                        </button>',
        'brand pill and cleaner title',
    ),
    (
        'className={`absolute bottom-0 left-0 right-0 z-30 px-4 md:px-7 pb-4 md:pb-7 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}',
        'className={`absolute bottom-0 left-0 right-0 z-30 px-4 md:px-7 pb-4 md:pb-6 pt-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}',
        'bottom spacing',
    ),
    (
        'className="group/seek relative mb-6 md:mb-8 h-4 flex items-center"',
        'className="group/seek relative mb-5 md:mb-6 h-4 flex items-center"',
        'seek spacing',
    ),
    (
        'className="absolute left-0 right-0 h-[5px] rounded-full bg-white/28 overflow-hidden"',
        'className="absolute left-0 right-0 h-[4px] rounded-full bg-white/20 overflow-hidden"',
        'slimmer seek bar',
    ),
    (
        'className="absolute w-4 h-4 rounded-full bg-white -translate-x-1/2 pointer-events-none shadow-[0_1px_8px_rgba(0,0,0,0.4)]"',
        'className="absolute w-3.5 h-3.5 rounded-full bg-white -translate-x-1/2 pointer-events-none shadow-[0_1px_6px_rgba(0,0,0,0.35)]"',
        'smaller seek knob',
    ),
    (
        'className="ml-auto flex items-center gap-1.5 md:gap-2"',
        'className="ml-auto flex items-center gap-1 md:gap-1.5"',
        'cleaner right controls',
    ),
]

for old, new, label in replacements:
    if old not in t:
        raise SystemExit(f"missing patch target: {label}")
    t = t.replace(old, new, 1)

p.write_text(t)
