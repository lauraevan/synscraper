from pathlib import Path

p = Path("frontend/src/components/SynapsePlayer.jsx")
t = p.read_text()

old = '''                        <button
                            data-testid="synapse-back-btn"
                            onClick={(e) => { e.stopPropagation(); onBack?.(); }}
                            className="absolute left-5 top-5 md:left-7 md:top-7 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                            aria-label="Back"
                        >
                            <Cloud className="w-11 h-11 md:w-12 md:h-12 stroke-[1.65]" />
                        </button>
'''

new = '''                        <div className="absolute left-5 top-5 md:left-7 md:top-7">
                            <button
                                data-testid="synapse-source-cloud-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenu(menu === "sources" ? null : "sources");
                                }}
                                className={`grid h-12 w-12 md:h-14 md:w-14 place-items-center rounded-full border transition-all duration-200 active:scale-95 ${menu === "sources" ? "border-white/30 bg-white/15 text-white" : "border-white/10 bg-black/20 text-white/90 hover:bg-white/10 hover:text-white"}`}
                                aria-label="Choose source"
                                title="Sources"
                            >
                                <Cloud className="h-9 w-9 md:h-10 md:w-10 stroke-[1.65]" />
                            </button>

                            {menu === "sources" && (
                                <div
                                    data-testid="synapse-source-popout"
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute left-0 top-[3.55rem] md:top-[4rem] z-40 w-[250px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/15 bg-black/88 p-2 shadow-2xl backdrop-blur-2xl"
                                >
                                    <div className="px-3 pb-2 pt-2.5">
                                        <p className="text-sm font-semibold text-white">Sources</p>
                                        <p className="mt-0.5 text-[11px] text-white/40">Switch without losing your place</p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto scrollbar-none">
                                        {servers.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => selectServer(s)}
                                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${serverId === s.id ? "bg-white text-black" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                                            >
                                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                                                <img
                                                    src="https://flagsapi.com/US/flat/24.png"
                                                    alt="US"
                                                    className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
                                                    loading="lazy"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
'''

if old not in t:
    raise SystemExit("cloud button patch target not found")

p.write_text(t.replace(old, new, 1))
