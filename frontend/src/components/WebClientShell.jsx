import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Film,
  Home,
  Search,
  Settings,
  Tv2,
  UserRound,
  X,
} from "lucide-react";
import { WebPlayerOverlay } from "@/components/WebPlayerOverlay";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse/tv", label: "Series", icon: Tv2 },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/my-list", label: "My List", icon: Bookmark },
];

const MOBILE_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  { to: "/search", label: "Search", icon: Search },
  NAV_ITEMS[2],
  NAV_ITEMS[3],
];

export const WebClientShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [playerSession, setPlayerSession] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  const immersive = location.pathname === "/" || location.pathname.startsWith("/title/");
  const routeKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    const handler = (event) => setPlayerSession(event.detail);
    window.addEventListener("synflix:web-play", handler);
    return () => window.removeEventListener("synflix:web-play", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      const editable = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }

      if (!editable && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (location.pathname.startsWith("/search")) {
      setQuery(new URLSearchParams(location.search).get("q") || "");
    } else {
      setQuery("");
      setSearchOpen(false);
    }
  }, [location.pathname, location.search]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    setSearchOpen(false);
  };

  const active = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  return (
    <div className="synflix-web3">
      <header className={`synflix-web3-header ${(scrolled || !immersive) ? "is-solid" : ""}`}>
        <div className="synflix-web3-header-inner">
          <Link to="/" className="synflix-web3-brand" aria-label="SynFlix home">
            <img src="/synflix-logo.webp" alt="" />
            <span>SynFlix</span>
          </Link>

          <nav className="synflix-web3-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={active(item) ? "is-active" : ""}
                aria-current={active(item) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="synflix-web3-actions">
            <form className={`synflix-web3-search ${searchOpen ? "is-open" : ""}`} onSubmit={submitSearch} role="search">
              <button
                type="button"
                className="synflix-web3-search-trigger"
                aria-label="Search"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
              >
                <Search aria-hidden="true" />
              </button>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search SynFlix"
                aria-label="Search movies and series"
              />
              {searchOpen && (
                <button
                  type="button"
                  className="synflix-web3-search-close"
                  aria-label="Close search"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                    searchRef.current?.blur();
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </form>

            <Link to="/my-list" className="synflix-web3-icon-action synflix-web3-list-action" aria-label="My List">
              <Bookmark aria-hidden="true" />
            </Link>
            <Link to="/settings" className="synflix-web3-icon-action" aria-label="Settings">
              <Settings aria-hidden="true" />
            </Link>
            <Link to="/settings" className="synflix-web3-profile" aria-label="Profile">
              <UserRound aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className={`synflix-site synflix-web3-surface ${immersive ? "is-immersive" : ""}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            className="synflix-web3-route"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="synflix-web3-dock" aria-label="Navigation">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={selected ? "is-active" : ""}
              aria-current={selected ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <WebPlayerOverlay session={playerSession} onClose={() => setPlayerSession(null)} />
    </div>
  );
};
