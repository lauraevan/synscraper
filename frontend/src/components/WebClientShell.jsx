import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
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

  const immersive = location.pathname === "/" || location.pathname.startsWith("/title/");
  const routeKey = `${location.pathname}${location.search}`;
  const pageTitle = titleForPath(location.pathname);

  useEffect(() => {
    const handler = (event) => setPlayerSession(event.detail);
    window.addEventListener("synflix:web-play", handler);
    return () => window.removeEventListener("synflix:web-play", handler);
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
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
  }), []);

  return (
    <div className="synflix-web-client">
      <aside className="synflix-client-rail" aria-label="SynFlix navigation">
        <Link to="/" className="synflix-client-mark" aria-label="SynFlix home">
          <img src="/synflix-logo.webp" alt="" />
        </Link>

        <nav className="synflix-client-rail-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active(item) ? "is-active" : ""}
                aria-label={item.label}
                data-label={item.label}
              >
                <Icon aria-hidden="true" />
              </Link>
            );
          })}
          <Link
            to="/search"
            className={location.pathname.startsWith("/search") ? "is-active" : ""}
            aria-label="Search"
            data-label="Search"
          >
            <Search aria-hidden="true" />
          </Link>
        </nav>

        <div className="synflix-client-rail-bottom">
          <Link
            to="/settings"
            className={location.pathname.startsWith("/settings") ? "is-active" : ""}
            aria-label="Settings"
            data-label="Settings"
          >
            <Settings aria-hidden="true" />
          </Link>
          <button type="button" className="synflix-client-avatar" aria-label="Profile" data-label="Profile">
            <UserRound aria-hidden="true" />
          </button>
        </div>
      </aside>

      <header className="synflix-client-topbar">
        <div className="synflix-client-history" aria-label="Navigation history">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate(1)} aria-label="Forward">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        <div className="synflix-client-section-title">
          <strong>{pageTitle}</strong>
        </div>

        <form className="synflix-client-search" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SynFlix"
            aria-label="Search movies and series"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X aria-hidden="true" />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </form>

        <div className="synflix-client-top-actions">
          <button type="button" aria-label="Notifications">
            <Bell aria-hidden="true" />
          </button>
          <Link to="/settings" className="synflix-client-profile-chip" aria-label="Open profile and settings">
            <span className="synflix-client-profile-dot"><UserRound aria-hidden="true" /></span>
            <span className="synflix-client-profile-copy">
              <strong>SynFlix</strong>
              <small>Profile</small>
            </span>
          </Link>
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

      <nav className="synflix-web-mobile-dock" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={active(item) ? "is-active" : ""}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link to="/search" className={location.pathname.startsWith("/search") ? "is-active" : ""}>
          <Search aria-hidden="true" />
          <span>Search</span>
        </Link>
      </nav>

      <WebPlayerOverlay session={playerSession} onClose={() => setPlayerSession(null)} />
    </div>
  );
};