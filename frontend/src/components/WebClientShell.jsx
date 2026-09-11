import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
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
  { to: "/browse/movie", label: "Movies", icon: Film },
  { to: "/browse/tv", label: "Series", icon: Tv2 },
  { to: "/my-list", label: "My List", icon: Bookmark },
];

const DOCK_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  { to: "/search", label: "Search", icon: Search },
  NAV_ITEMS[3],
  NAV_ITEMS[2],
];

const titleForPath = (pathname) => {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/browse/movie")) return "Movies";
  if (pathname.startsWith("/browse/tv")) return "Series";
  if (pathname.startsWith("/my-list")) return "My List";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/title/")) return "Details";
  return "SynFlix";
};

export const WebClientShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [playerSession, setPlayerSession] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  const immersive = location.pathname === "/" || location.pathname.startsWith("/title/");
  const routeKey = `${location.pathname}${location.search}`;
  const pageTitle = titleForPath(location.pathname);

  useEffect(() => {
    const handler = (event) => setPlayerSession(event.detail);
    window.addEventListener("synflix:web-play", handler);
    return () => window.removeEventListener("synflix:web-play", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      const editable = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (!editable && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (location.pathname.startsWith("/search")) {
      setQuery(new URLSearchParams(location.search).get("q") || "");
    }
  }, [location.pathname, location.search]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  const active = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const transition = useMemo(() => ({
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1],
  }), []);

  return (
    <div className="synflix-web-client synflix-web-client-v2">
      <header className={`synflix-liquid-header ${(scrolled || !immersive) ? "is-scrolled" : ""}`}>
        <div className="synflix-liquid-header-inner">
          <div className="synflix-liquid-left">
            <Link to="/" className="synflix-liquid-brand" aria-label="SynFlix home">
              <img src="/synflix-logo.webp" alt="" />
              <span>SynFlix</span>
            </Link>

            <div className="synflix-liquid-history" aria-label="Navigation history">
              <button type="button" onClick={() => navigate(-1)} aria-label="Back">
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" onClick={() => navigate(1)} aria-label="Forward">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <nav className="synflix-liquid-nav" aria-label="Primary navigation">
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

          <div className="synflix-liquid-actions">
            <span className="synflix-liquid-page-title">{pageTitle}</span>

            <form className="synflix-liquid-search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titles, people, genres"
                aria-label="Search movies and series"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X aria-hidden="true" />
                </button>
              ) : (
                <kbd>⌘K</kbd>
              )}
            </form>

            <Link to="/search" className="synflix-liquid-icon synflix-liquid-search-shortcut" aria-label="Search">
              <Search aria-hidden="true" />
            </Link>
            <Link to="/settings" className="synflix-liquid-icon" aria-label="Settings">
              <Settings aria-hidden="true" />
            </Link>
            <Link to="/settings" className="synflix-liquid-profile" aria-label="Profile and settings">
              <UserRound aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className={`synflix-site synflix-web-surface ${immersive ? "is-immersive" : ""}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            className="synflix-web-route"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="synflix-web-mobile-dock synflix-liquid-dock" aria-label="Adaptive navigation">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active(item) ? "is-active" : ""}
              aria-current={active(item) ? "page" : undefined}
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
