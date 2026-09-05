import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Dices, FileText, Film, Home, Menu, Search, Settings, Shield, SlidersHorizontal, Tv2, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Status", icon: Home, exact: true, status: true },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/browse/tv", label: "TV", icon: Tv2 },
];

const UTILITY_ITEMS = [
  { to: "/settings", label: "Settings", description: "Themes, appearance & player", icon: SlidersHorizontal },
  { to: "/my-list", label: "Watchlist", description: "Your saved films and shows", icon: Bookmark },
  { to: "/roulette", label: "Film Roulette", description: "Let SynFlix pick something", icon: Dices },
  { divider: true },
  { to: "/privacy", label: "Privacy", description: "Privacy policy", icon: Shield },
  { to: "/terms", label: "Terms", description: "Terms of service", icon: FileText },
];

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [q, setQ] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const gearRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setGearOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [searchOpen]);

  useEffect(() => {
    const close = (event) => {
      if (gearRef.current && !gearRef.current.contains(event.target)) setGearOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const active = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const submit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 pointer-events-none">
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 md:px-5 md:pt-5">
        <div className={`pointer-events-auto grid h-[72px] grid-cols-[auto_1fr_auto] items-center rounded-[38px] border px-5 transition-all duration-300 md:h-[80px] md:px-7 ${scrolled || mobileOpen || gearOpen || searchOpen ? "border-white/[0.14] bg-[#0a0d13] shadow-[0_18px_45px_rgba(0,0,0,.36)]" : "border-[#2a303b] bg-[#0d1118] shadow-[inset_0_1px_0_rgba(255,255,255,.035),0_16px_40px_rgba(0,0,0,.25)]"}`}>
          <Link to="/" className="flex shrink-0 items-center" aria-label="SynFlix home">
            <img src="/synflix-logo.webp" alt="" className="synflix-brand-logo h-11 w-11 object-contain md:h-12 md:w-12" />
          </Link>

          <nav className="hidden items-center justify-center gap-10 md:flex lg:gap-14">
            {NAV_ITEMS.map((item) => {
              const selected = active(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group inline-flex h-12 items-center gap-2.5 whitespace-nowrap px-1 text-[16px] font-semibold tracking-[-0.025em] transition lg:text-[17px] ${selected ? "text-white" : "text-white/58 hover:text-white/88"}`}
                >
                  {item.status && (
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-4 w-4 rounded-full bg-[#3d8f5b]/30" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-[#61b77b] shadow-[0_0_0_4px_rgba(97,183,123,.08)]" />
                    </span>
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-1.5 md:gap-2">
            <Link
              to="/roulette"
              className="hidden h-11 w-11 place-items-center rounded-full text-white/70 transition hover:bg-white/[0.05] hover:text-white md:grid"
              aria-label="Film Roulette"
            >
              <Dices className="h-[21px] w-[21px]" />
            </Link>

            <div className="mx-1 hidden h-8 w-px bg-white/[0.13] md:block" />

            <div ref={searchRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setGearOpen(false);
                }}
                className={`grid h-11 w-11 place-items-center rounded-full transition ${searchOpen ? "bg-white/[0.055] text-white" : "text-white/72 hover:bg-white/[0.05] hover:text-white"}`}
                aria-label="Search"
                aria-expanded={searchOpen}
              >
                <Search className="h-[21px] w-[21px]" />
              </button>

              {searchOpen && (
                <form onSubmit={submit} className="absolute right-0 top-[54px] flex h-12 w-[320px] items-center gap-2 rounded-[16px] border border-white/[0.1] bg-[#0b0f15] px-3 shadow-[0_22px_60px_rgba(0,0,0,.58)]">
                  <Search className="h-4 w-4 shrink-0 text-white/42" />
                  <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/28" />
                  {q && <button type="button" onClick={() => setQ("")} className="grid h-7 w-7 place-items-center rounded-full text-white/36 hover:bg-white/[0.05] hover:text-white/70" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
                </form>
              )}
            </div>

            <div ref={gearRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setGearOpen((v) => !v);
                  setSearchOpen(false);
                }}
                className={`grid h-11 w-11 place-items-center rounded-full transition ${gearOpen ? "bg-white/[0.055] text-white" : "text-white/78 hover:bg-white/[0.05] hover:text-white"}`}
                aria-label="Open SynFlix menu"
                aria-expanded={gearOpen}
              >
                <Settings className={`h-[22px] w-[22px] transition-transform duration-300 ${gearOpen ? "rotate-45" : ""}`} />
              </button>

              {gearOpen && (
                <div className="absolute right-0 top-[54px] w-[300px] overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#0b0f15] p-2 shadow-[0_24px_70px_rgba(0,0,0,.66)]">
                  <div className="px-3 pb-2.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/26">SynFlix</div>
                  {UTILITY_ITEMS.map((item, index) => {
                    if (item.divider) return <div key={`divider-${index}`} className="my-1.5 h-px bg-white/[0.07]" />;
                    const Icon = item.icon;
                    const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center gap-3 rounded-[13px] px-3 py-3 transition ${selected ? "bg-white/[0.065]" : "hover:bg-white/[0.045]"}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${selected ? "border-white/[0.13] bg-white/[0.06] text-white" : "border-white/[0.07] bg-[#11151c] text-white/48"}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-white/84">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-white/28">{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={() => setMobileOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full text-white/82 transition hover:bg-white/[0.05] md:hidden" aria-label="Menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="pointer-events-auto mt-2 rounded-[24px] border border-[#2a303b] bg-[#0b0f15] p-3 shadow-[0_22px_60px_rgba(0,0,0,.58)] md:hidden">
            <form onSubmit={submit} className="mb-3 flex h-11 items-center gap-2 rounded-[15px] border border-white/[0.09] bg-[#11151c] px-3 focus-within:border-white/[0.16]">
              <Search className="h-4 w-4 text-white/45" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" />
            </form>

            <nav className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={`flex flex-col items-center justify-center gap-2 rounded-[15px] border px-2 py-3.5 text-xs font-medium transition ${active(item) ? "border-white/[0.15] bg-white/[0.07] text-white" : "border-white/[0.07] bg-[#11151c] text-white/64"}`}>
                    <Icon className="h-4 w-4" />{item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 rounded-[16px] border border-white/[0.07] bg-[#0d1118] p-2">
              {UTILITY_ITEMS.filter((item) => !item.divider).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-sm text-white/64 transition hover:bg-white/[0.04] hover:text-white">
                    <Icon className="h-4 w-4" />{item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
