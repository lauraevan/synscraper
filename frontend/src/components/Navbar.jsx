import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Dices, FileText, Film, Home, Menu, Search, Settings, Shield, SlidersHorizontal, Sparkles, Tv2, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/browse/tv", label: "TV", icon: Tv2 },
  { to: "/search?q=anime", label: "Anime", icon: Sparkles, anime: true },
  { to: "/roulette", label: "Roulette", icon: Dices },
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
  }, [location.pathname, location.search]);

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

  const active = (item) => {
    if (item.anime) {
      return location.pathname === "/search" && new URLSearchParams(location.search).get("q")?.toLowerCase() === "anime";
    }
    return item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const submit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  };

  const shellTone = scrolled || mobileOpen || gearOpen || searchOpen
    ? "border-white/[0.13] bg-[#0b0d10]/[0.97] shadow-[0_15px_42px_rgba(0,0,0,.40)]"
    : "border-[#2a2e36] bg-[linear-gradient(135deg,#11151c_0%,#0d1016_48%,#090b0f_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_14px_34px_rgba(0,0,0,.28)]";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="mx-auto w-full max-w-[1160px] px-3.5 pt-3.5 md:px-4 md:pt-4">
        <div className={`pointer-events-auto grid h-[60px] grid-cols-[auto_1fr_auto] items-center rounded-[31px] border px-4 backdrop-blur-xl transition-all duration-300 md:h-[68px] md:rounded-[35px] md:px-6 ${shellTone}`}>
          <Link to="/" className="flex shrink-0 items-center" aria-label="SynFlix home">
            <span className="grid h-9 w-9 place-items-center md:h-10 md:w-10">
              <img src="/synflix-logo.webp" alt="" className="synflix-brand-logo h-9 w-9 object-contain md:h-10 md:w-10" />
            </span>
          </Link>

          <nav className="hidden h-full items-center justify-center gap-6 md:flex lg:gap-9 xl:gap-10">
            {NAV_ITEMS.map((item) => {
              const selected = active(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative inline-flex h-full items-center whitespace-nowrap text-[14px] font-semibold tracking-[-0.02em] transition-colors duration-200 lg:text-[15px] ${selected ? "text-white" : "text-white/58 hover:text-white/90"}`}
                >
                  <span>{item.label}</span>
                  <span className={`absolute bottom-[10px] left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-[#ffd400] transition-all duration-200 ${selected ? "w-4 opacity-100" : "w-0 opacity-0 group-hover:w-2.5 group-hover:opacity-55"}`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-0.5 md:gap-1">
            <div className="mr-2 hidden h-6 w-px bg-white/[0.14] md:block" />

            <Link
              to="/my-list"
              className={`hidden h-10 w-10 place-items-center rounded-full transition md:grid ${location.pathname.startsWith("/my-list") ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/76 hover:bg-white/[0.055] hover:text-white"}`}
              aria-label="My List"
            >
              <Bookmark className="h-[19px] w-[19px]" strokeWidth={2.1} />
            </Link>

            <div ref={searchRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setGearOpen(false);
                }}
                className={`grid h-10 w-10 place-items-center rounded-full transition ${searchOpen ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/76 hover:bg-white/[0.055] hover:text-white"}`}
                aria-label="Search"
                aria-expanded={searchOpen}
              >
                <Search className="h-[19px] w-[19px]" strokeWidth={2.1} />
              </button>

              {searchOpen && (
                <form onSubmit={submit} className="absolute right-0 top-[48px] flex h-11 w-[320px] items-center gap-2 rounded-[16px] border border-white/[0.11] bg-[#0b0e13]/[0.98] px-3 shadow-[0_22px_60px_rgba(0,0,0,.60)] backdrop-blur-2xl">
                  <Search className="h-4 w-4 shrink-0 text-white/42" />
                  <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/28" />
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
                className={`grid h-10 w-10 place-items-center rounded-full transition ${gearOpen ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/80 hover:bg-white/[0.055] hover:text-white"}`}
                aria-label="Open SynFlix menu"
                aria-expanded={gearOpen}
              >
                <Settings className={`h-[20px] w-[20px] transition-transform duration-300 ${gearOpen ? "rotate-45" : ""}`} strokeWidth={2.1} />
              </button>

              {gearOpen && (
                <div className="absolute right-0 top-[48px] w-[290px] overflow-hidden rounded-[18px] border border-white/[0.10] bg-[#0b0e13]/[0.98] p-2 shadow-[0_24px_68px_rgba(0,0,0,.66)] backdrop-blur-2xl">
                  <div className="px-3 pb-2.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/55">SynFlix</div>
                  {UTILITY_ITEMS.map((item, index) => {
                    if (item.divider) return <div key={`divider-${index}`} className="my-1.5 h-px bg-white/[0.07]" />;
                    const Icon = item.icon;
                    const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center gap-3 rounded-[13px] px-3 py-3 transition ${selected ? "bg-[#ffd400]/[0.08]" : "hover:bg-white/[0.045]"}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${selected ? "border-[#ffd400]/20 bg-[#ffd400]/[0.07] text-[#ffd400]" : "border-white/[0.07] bg-[#11151c] text-white/48"}`}><Icon className="h-4 w-4" /></span>
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

            <button onClick={() => setMobileOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full text-white/82 transition hover:bg-white/[0.05] md:hidden" aria-label="Menu">
              {mobileOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="pointer-events-auto mt-2 rounded-[22px] border border-[#2a303b] bg-[#0b0f15]/[0.98] p-3 shadow-[0_22px_60px_rgba(0,0,0,.58)] backdrop-blur-xl md:hidden">
            <form onSubmit={submit} className="mb-3 flex h-10 items-center gap-2 rounded-[14px] border border-white/[0.09] bg-[#11151c] px-3 focus-within:border-[#ffd400]/35">
              <Search className="h-4 w-4 text-white/45" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" />
            </form>

            <nav className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={`flex items-center gap-2.5 rounded-[14px] border px-3 py-3 text-xs font-medium transition ${active(item) ? "border-[#ffd400]/22 bg-[#ffd400]/[0.08] text-[#ffd400]" : "border-white/[0.07] bg-[#11151c] text-white/64"}`}>
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
