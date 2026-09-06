import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, ChevronDown, Dices, FileText, Film, Home, Search, Settings, Shield, SlidersHorizontal, Sparkles, Tv2, X } from "lucide-react";
import { InstallSynFlix } from "@/components/InstallSynFlix";

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
  const [gearOpen, setGearOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [q, setQ] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const gearRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setGearOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const close = (event) => {
      if (gearRef.current && !gearRef.current.contains(event.target)) setGearOpen(false);
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
    setMobileOpen(false);
  };

  const shellTone = scrolled || gearOpen
    ? "border-white/[0.18] bg-[#101318]/[0.58] shadow-[0_18px_54px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.10)]"
    : "border-white/[0.13] bg-[#101318]/[0.42] shadow-[0_16px_44px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.08)]";

  return (
    <header className="synflix-navbar pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="mx-auto w-full max-w-[1160px] px-3.5 pt-3.5 md:px-4 md:pt-4">
        <div className="pointer-events-auto flex justify-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className={`synflix-phone-menu-button flex h-12 items-center gap-2 rounded-full border px-3.5 text-white shadow-[0_12px_34px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl backdrop-saturate-150 transition-all ${mobileOpen ? "border-white/[0.18] bg-[#11151c]/80" : "border-white/[0.12] bg-[#11151c]/58"}`}
            aria-label="Open SynFlix menu"
            aria-expanded={mobileOpen}
          >
            <img src="/synflix-logo.webp" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[13px] font-semibold tracking-[-0.025em] text-white/90">SynFlix</span>
            <ChevronDown className={`h-4 w-4 text-white/55 transition-transform duration-200 ${mobileOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className={`pointer-events-auto hidden h-[68px] grid-cols-[auto_1fr_auto] items-center rounded-[35px] border px-5 backdrop-blur-[30px] backdrop-saturate-[175%] transition-all duration-300 md:grid xl:px-6 ${shellTone}`}>
          <Link
            to="/"
            onClick={() => setBrandOpen((v) => !v)}
            className="group flex shrink-0 items-center overflow-hidden"
            aria-label="SynFlix home"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center">
              <img src="/synflix-logo.webp" alt="" className="synflix-brand-logo h-10 w-10 object-contain transition-transform duration-300 group-active:scale-90" />
            </span>
            <span className={`whitespace-nowrap text-[15px] font-bold tracking-[-0.035em] text-[#ffd400] transition-all duration-300 ease-out ${brandOpen ? "ml-2 max-w-[78px] translate-x-0 opacity-100" : "ml-0 max-w-0 -translate-x-2 opacity-0"}`} aria-hidden={!brandOpen}>
              SynFlix
            </span>
          </Link>

          <nav className="hidden h-full items-center justify-center gap-2 md:flex lg:gap-3 xl:gap-4">
            {NAV_ITEMS.map((item) => {
              const selected = active(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative inline-flex h-full items-center whitespace-nowrap text-[12px] font-semibold tracking-[-0.02em] transition-colors duration-200 lg:text-[13px] xl:text-[14px] ${selected ? "text-white" : "text-white/58 hover:text-white/90"}`}
                >
                  <span>{item.label}</span>
                  <span className={`absolute bottom-[10px] left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-[#ffd400] transition-all duration-200 ${selected ? "w-4 opacity-100" : "w-0 opacity-0 group-hover:w-2.5 group-hover:opacity-55"}`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-1">
            <div className="mr-1.5 hidden h-6 w-px bg-white/[0.13] lg:block" />

            <Link
              to="/my-list"
              className={`hidden h-10 w-10 place-items-center rounded-full transition md:grid ${location.pathname.startsWith("/my-list") ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/76 hover:bg-white/[0.07] hover:text-white"}`}
              aria-label="My List"
            >
              <Bookmark className="h-[19px] w-[19px]" strokeWidth={2.1} />
            </Link>

            <Link
              to="/search"
              className={`grid h-10 w-10 place-items-center rounded-full transition lg:hidden ${location.pathname.startsWith("/search") ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/76 hover:bg-white/[0.07] hover:text-white"}`}
              aria-label="Search"
            >
              <Search className="h-[19px] w-[19px]" strokeWidth={2.1} />
            </Link>

            <form
              onSubmit={submit}
              className="hidden h-10 w-[168px] items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.055] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition focus-within:border-[#ffd400]/30 focus-within:bg-white/[0.075] lg:flex xl:w-[220px]"
            >
              <Search className="h-4 w-4 shrink-0 text-white/42" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30" />
              {q && (
                <button type="button" onClick={() => setQ("")} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/36 hover:bg-white/[0.07] hover:text-white/72" aria-label="Clear search">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            <div ref={gearRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setGearOpen((v) => !v)}
                className={`grid h-10 w-10 place-items-center rounded-full transition ${gearOpen ? "bg-[#ffd400]/[0.10] text-[#ffd400]" : "text-white/80 hover:bg-white/[0.07] hover:text-white"}`}
                aria-label="Open SynFlix menu"
                aria-expanded={gearOpen}
              >
                <Settings className={`h-[20px] w-[20px] transition-transform duration-300 ${gearOpen ? "rotate-45" : ""}`} strokeWidth={2.1} />
              </button>

              {gearOpen && (
                <div className="absolute right-0 top-[48px] w-[290px] overflow-hidden rounded-[18px] border border-white/[0.12] bg-[#0b0e13]/[0.78] p-2 shadow-[0_24px_68px_rgba(0,0,0,.58)] backdrop-blur-[28px] backdrop-saturate-150">
                  <div className="px-3 pb-2.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/55">SynFlix</div>
                  {UTILITY_ITEMS.map((item, index) => {
                    if (item.divider) return <div key={`divider-${index}`} className="my-1.5 h-px bg-white/[0.07]" />;
                    const Icon = item.icon;
                    const selected = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-[13px] px-3 py-3 transition ${selected ? "bg-[#ffd400]/[0.08]" : "hover:bg-white/[0.055]"}`}>
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${selected ? "border-[#ffd400]/20 bg-[#ffd400]/[0.07] text-[#ffd400]" : "border-white/[0.07] bg-white/[0.045] text-white/48"}`}><Icon className="h-4 w-4" /></span>
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
          </div>
        </div>

        {mobileOpen && (
          <div className="pointer-events-auto mt-2 max-h-[calc(100dvh-82px)] overflow-y-auto overscroll-contain rounded-[24px] border border-white/[0.13] bg-[#0b0f15]/[0.82] p-3 shadow-[0_24px_70px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-[28px] backdrop-saturate-150 md:hidden">
            <form onSubmit={submit} className="mb-3 flex h-11 items-center gap-2 rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-3 focus-within:border-[#ffd400]/35">
              <Search className="h-4 w-4 text-white/45" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/28" />
              {q && <button type="button" onClick={() => setQ("")} className="grid h-7 w-7 place-items-center rounded-full text-white/36" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
            </form>

            <nav className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const selected = active(item);
                return (
                  <Link key={item.to} to={item.to} className={`flex min-h-12 items-center gap-2.5 rounded-[14px] border px-3 py-3 text-xs font-medium transition ${selected ? "border-[#ffd400]/22 bg-[#ffd400]/[0.08] text-[#ffd400]" : "border-white/[0.07] bg-white/[0.035] text-white/64"}`}>
                    <Icon className="h-4 w-4" />{item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-2">
              {UTILITY_ITEMS.filter((item) => !item.divider).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="flex min-h-11 items-center gap-3 rounded-[11px] px-3 py-2.5 text-sm text-white/64 transition hover:bg-white/[0.05] hover:text-white">
                    <Icon className="h-4 w-4" />{item.label}
                  </Link>
                );
              })}
              <InstallSynFlix />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
