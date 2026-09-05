import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Film, Home, Menu, Search, Tv2, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/browse/tv", label: "TV", icon: Tv2 },
  { to: "/my-list", label: "My List", icon: Bookmark },
];

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [searchOpen]);

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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || mobileOpen ? "border-b border-[#ffd400]/10 bg-[#080807]/94 backdrop-blur-xl" : "bg-gradient-to-b from-black/80 via-black/35 to-transparent"}`}>
      <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-5 px-5 md:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="SynFlix home">
          <img src="/synflix-logo.webp" alt="" className="synflix-brand-logo h-9 w-9" />
          <span className="synflix-brand-text text-[16px] font-semibold tracking-[-0.03em]">SynFlix</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-[#ffd400]/10 bg-black/30 p-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${active(item) ? "bg-[#ffd400] text-black" : "text-white/52 hover:bg-[#ffd400]/10 hover:text-[#ffd400]"}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={submit} className={`hidden items-center overflow-hidden rounded-full border bg-black/35 transition-all duration-200 sm:flex ${searchOpen ? "w-[260px] border-[#ffd400]/35 px-1.5" : "w-10 border-white/[0.08]"}`}>
            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/58 transition hover:bg-[#ffd400]/10 hover:text-[#ffd400]" aria-label="Search">
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            {searchOpen && <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent pr-3 text-[13px] text-white outline-none placeholder:text-white/28" />}
          </form>

          <button onClick={() => setMobileOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.09] bg-black/35 text-white transition hover:border-[#ffd400]/28 hover:text-[#ffd400] md:hidden" aria-label="Menu">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#ffd400]/10 bg-[#080807]/96 px-5 pb-5 pt-4 backdrop-blur-xl md:hidden">
          <form onSubmit={submit} className="mb-3 flex h-11 items-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-3 focus-within:border-[#ffd400]/35">
            <Search className="h-4 w-4 text-[#ffd400]/65" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SynFlix" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" />
          </form>
          <nav className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-sm font-medium transition ${active(item) ? "border-[#ffd400] bg-[#ffd400] text-black" : "border-white/[0.08] bg-white/[0.035] text-white/68 hover:border-[#ffd400]/25 hover:text-[#ffd400]"}`}>
                  <Icon className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex gap-4 px-1 text-xs text-white/32"><Link to="/demo" className="hover:text-[#ffd400]">Demo</Link><Link to="/docs" className="hover:text-[#ffd400]">Docs</Link></div>
        </div>
      )}
    </header>
  );
};
