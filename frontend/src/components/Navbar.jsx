import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Dices, FileText, Film, Home, Menu, Search, Settings, Shield, SlidersHorizontal, Tv2, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || mobileOpen || gearOpen ? "border-b border-white/[0.07] bg-[#070707]" : "bg-gradient-to-b from-black/85 via-black/42 to-transparent"}`}>
      <div className="relative mx-auto flex h-[70px] max-w-[1560px] items-center px-5 md:px-9">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="SynFlix home">
          <img src="/synflix-logo.webp" alt="" className="synflix-brand-logo h-9 w-9" />
          <span className="synflix-brand-text text-[16px] font-semibold tracking-[-0.03em]">SynFlix</span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
          <nav className="flex h-[42px] items-center gap-0.5 rounded-[14px] border border-white/[0.12] bg-[#090909] px-1.5 shadow-[0_10px_28px_rgba(0,0,0,.3)]">
            {NAV_ITEMS.map((item) => {
              const selected = active(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex h-[34px] items-center rounded-[10px] px-4 text-[12px] font-semibold tracking-[-0.01em] transition ${selected ? "bg-white/[0.07] text-white" : "text-white/48 hover:bg-white/[0.04] hover:text-white/82"}`}
                >
                  {item.label}
                  {selected && <span className="absolute inset-x-4 -bottom-[4px] h-[2px] rounded-full bg-[#ffd400]" />}
                </Link>
              );
            })}

            <div className="mx-1 h-5 w-px bg-white/[0.09]" />

            <div ref={gearRef} className="relative">
              <button
                type="button"
                onClick={() => setGearOpen((v) => !v)}
                className={`grid h-[34px] w-[36px] place-items-center rounded-[10px] transition ${gearOpen ? "bg-white/[0.08] text-[#ffd400]" : "text-white/48 hover:bg-white/[0.04] hover:text-white"}`}
                aria-label="Open SynFlix menu"
                aria-expanded={gearOpen}
              >
                <Settings className={`h-[17px] w-[17px] transition-transform duration-300 ${gearOpen ? "rotate-45" : ""}`} />
              </button>

              {gearOpen && (
                <div className="absolute right-0 top-[46px] w-[300px] overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#090909] p-2 shadow-[0_24px_70px_rgba(0,0,0,.68)]">
                  <div className="px-3 pb-2.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/26">SynFlix</div>
                  {UTILITY_ITEMS.map((item, index) => {
                    if (item.divider) return <div key={`divider-${index}`} className="my-1.5 h-px bg-white/[0.07]" />;
                    const Icon = item.icon;
                    const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center gap-3 rounded-[12px] px-3 py-3 transition ${selected ? "bg-white/[0.065]" : "hover:bg-white/[0.045]"}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${selected ? "border-[#ffd400]/25 bg-[#ffd400]/[0.08] text-[#ffd400]" : "border-white/[0.07] bg-[#111] text-white/48"}`}><Icon className="h-4 w-4" /></span>
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
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={submit} className={`hidden h-[40px] items-center overflow-hidden rounded-[12px] border bg-[#090909] transition-all duration-200 sm:flex ${searchOpen ? "w-[260px] border-white/[0.15] px-1.5" : "w-10 border-white/[0.1]"}`}>
            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-white/50 transition hover:bg-white/[0.04] hover:text-white" aria-label="Search">
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            {searchOpen && <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent pr-3 text-[13px] text-white outline-none placeholder:text-white/28" />}
          </form>

          <button onClick={() => setMobileOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/[0.1] bg-[#090909] text-white transition hover:border-[#ffd400]/28 hover:text-[#ffd400] md:hidden" aria-label="Menu">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.07] bg-[#070707] px-5 pb-5 pt-4 md:hidden">
          <form onSubmit={submit} className="mb-3 flex h-11 items-center gap-2 rounded-[14px] border border-white/[0.09] bg-[#10100f] px-3 focus-within:border-[#ffd400]/35">
            <Search className="h-4 w-4 text-[#ffd400]/65" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" />
          </form>

          <nav className="grid grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border px-2 py-3.5 text-xs font-medium transition ${active(item) ? "border-white/[0.15] bg-white/[0.07] text-white" : "border-white/[0.08] bg-[#10100f] text-white/68"}`}>
                  <Icon className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-[#0d0d0c] p-2">
            {UTILITY_ITEMS.filter((item) => !item.divider).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-white/62 transition hover:bg-white/[0.04] hover:text-[#ffd400]">
                  <Icon className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
