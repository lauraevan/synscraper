import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Compass,
  Home,
  LibraryBig,
  ListFilter,
  Maximize2,
  Minimize2,
  Puzzle,
  Search,
  Settings,
  Share2,
  Square,
  UserRound,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/discover", label: "Discover", icon: Compass, plainDiscover: true },
  { to: "/library", label: "Library", icon: LibraryBig },
  { to: "/discover?filters=1", label: "Filters", icon: ListFilter, query: "filters=1" },
  { to: "/profiles", label: "Profiles", icon: Puzzle },
];

const getDesktopWindow = () => {
  if (typeof window === "undefined") return null;
  const api = window.__TAURI__?.window;
  if (!api) return null;
  try {
    return api.getCurrentWindow?.() || api.appWindow || null;
  } catch {
    return null;
  }
};

export function DesktopShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [maximized, setMaximized] = useState(false);

  const active = (item) => {
    if (item.exact) return location.pathname === item.to;
    if (item.query) return location.pathname === "/discover" && location.search.includes(item.query);
    if (item.plainDiscover) return location.pathname === "/discover" && !location.search.includes("filters=1");
    if (item.to === "/library" && location.pathname === "/my-list") return true;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  useEffect(() => {
    const appWindow = getDesktopWindow();
    if (!appWindow?.isMaximized) return;
    appWindow.isMaximized().then(setMaximized).catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = async (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(-1);
        return;
      }
      if (!typing && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!typing && event.key === "F11") {
        event.preventDefault();
        const appWindow = getDesktopWindow();
        if (!appWindow?.isFullscreen || !appWindow?.setFullscreen) return;
        try {
          const full = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!full);
        } catch {}
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const windowAction = async (action) => {
    const appWindow = getDesktopWindow();
    if (!appWindow) return;
    try {
      if (action === "minimize") await appWindow.minimize?.();
      if (action === "maximize") {
        await appWindow.toggleMaximize?.();
        const next = await appWindow.isMaximized?.();
        if (typeof next === "boolean") setMaximized(next);
      }
      if (action === "close") await appWindow.close?.();
    } catch {}
  };

  const toggleFullscreen = async () => {
    const appWindow = getDesktopWindow();
    if (!appWindow?.isFullscreen || !appWindow?.setFullscreen) return;
    try {
      const full = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!full);
    } catch {}
  };

  const share = async () => {
    const payload = { title: "SynFlix", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard?.writeText(window.location.href);
    } catch {}
  };

  return (
    <div className="synflix-desktop-app min-h-screen text-white">
      <a href="#synflix-desktop-main" className="synflix-desktop-skip-link">Skip to content</a>

      <div className="synflix-desktop-titlebar" data-tauri-drag-region>
        <div className="synflix-desktop-titlebrand" data-tauri-drag-region><span className="sr-only">SynFlix</span></div>
        <div className="synflix-desktop-drag-zone" data-tauri-drag-region aria-hidden="true" />
        <div className="synflix-desktop-window-controls" aria-label="Window controls">
          <button type="button" onClick={() => windowAction("minimize")} aria-label="Minimize window"><Minimize2 aria-hidden="true" /></button>
          <button type="button" onClick={() => windowAction("maximize")} aria-label={maximized ? "Restore window" : "Maximize window"}>{maximized ? <Square aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>
          <button type="button" className="synflix-desktop-close" onClick={() => windowAction("close")} aria-label="Close SynFlix"><X aria-hidden="true" /></button>
        </div>
      </div>

      <aside className="synflix-desktop-sidebar" aria-label="SynFlix navigation">
        <Link to="/" className="synflix-desktop-logo" aria-label="SynFlix home"><img src="/synflix-logo.webp" alt="" aria-hidden="true" /></Link>
        <nav className="synflix-desktop-side-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = active(item);
            return (
              <Link key={item.label} to={item.to} data-label={item.label} data-active={selected ? "true" : "false"} aria-current={selected ? "page" : undefined} aria-label={item.label}>
                <Icon aria-hidden="true" /><span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <nav className="synflix-desktop-side-bottom" aria-label="Application">
          <Link to="/settings" data-label="Settings" data-active={location.pathname === "/settings" ? "true" : "false"} aria-current={location.pathname === "/settings" ? "page" : undefined} aria-label="Settings"><Settings aria-hidden="true" /><span className="sr-only">Settings</span></Link>
        </nav>
      </aside>

      <div className="synflix-desktop-toolbar">
        <div className="synflix-desktop-toolbar-spacer" data-tauri-drag-region />
        <form className="synflix-desktop-search" onSubmit={submitSearch} role="search">
          <label htmlFor="synflix-desktop-search-input" className="sr-only">Search SynFlix</label>
          <input id="synflix-desktop-search-input" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" autoComplete="off" />
          <Search aria-hidden="true" />
        </form>
        <div className="synflix-desktop-toolbar-actions">
          <button type="button" onClick={share} aria-label="Share" title="Share"><Share2 aria-hidden="true" /></button>
          <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Fullscreen (F11)"><Maximize2 aria-hidden="true" /></button>
          <button type="button" aria-label="Notifications" title="No new notifications"><Bell aria-hidden="true" /></button>
          <Link to="/profiles" className="synflix-desktop-profile" aria-label="Profiles" title="Profiles"><UserRound aria-hidden="true" /></Link>
        </div>
      </div>

      <main id="synflix-desktop-main" tabIndex="-1" className="synflix-desktop-content">{children}</main>
    </div>
  );
}
