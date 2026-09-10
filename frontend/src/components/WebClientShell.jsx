import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Film, Home, Search, Settings, Tv2, X } from "lucide-react";
import { WebPlayerOverlay } from "@/components/WebPlayerOverlay";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/browse/tv", label: "Series", icon: Tv2 },
  { to: "/my-list", label: "My List", icon: Bookmark },
];

export const WebClientShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [playerSession, setPlayerSession] = useState(null);

  const immersive = location.pathname === "/" || location.pathname.startsWith("/title/");
  const routeKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (event) => setPlayerSession(event.detail);
    window.addEventListener("synflix:web-play", handler);
    return () => window.removeEventListener("synflix:web-play", handler);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  const active = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const transition = useMemo(() => ({
    duration: 0.34,
    ease: [0.22, 1, 0.36, 1],
  }), []);

  return (
    <div className="synflix-web-client">
      <header className={`synflix-web-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="synflix-web-header-inner">
          <Link to="/" className="synflix-web-brand" aria-label="SynFlix home">
            <img src="/synflix-logo.webp" alt="" />
            <span>SynFlix</span>
          </Link>

          <nav className="synflix-web-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={active(item) ? "is-active" : ""}>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="synflix-web-header-tools">
            <form className="synflix-web-search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies and series"
                aria-label="Search SynFlix"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X /></button>
              ) : (
                <kbd>⌘K</kbd>
              )}
            </form>

            <Link to="/settings" className={`synflix-web-icon-button ${location.pathname.startsWith("/settings") ? "is-active" : ""}`} aria-label="Settings">
              <Settings />
            </Link>
          </div>
        </div>
      </header>

      <div className={`synflix-site synflix-web-surface ${immersive ? "is-immersive" : ""}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            className="synflix-web-route"
            initial={{ opacity: 0, y: 9, scale: 0.998 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.999 }}
            transition={transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="synflix-web-mobile-dock" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={active(item) ? "is-active" : ""}>
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link to="/search" className={location.pathname.startsWith("/search") ? "is-active" : ""}>
          <Search />
          <span>Search</span>
        </Link>
      </nav>

      <WebPlayerOverlay session={playerSession} onClose={() => setPlayerSession(null)} />
    </div>
  );
};
