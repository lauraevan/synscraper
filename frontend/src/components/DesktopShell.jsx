import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  ChevronDown,
  Compass,
  Home,
  Maximize2,
  Minimize2,
  Search,
  Settings,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { getActiveDesktopProfile } from "@/lib/desktopProfile";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/library", label: "Library", icon: Bookmark },
  { to: "/search", label: "Search", icon: Search },
];

const BOTTOM_ITEMS = [
  { to: "/profiles", label: "Profiles", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
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
  const [profile, setProfile] = useState(() => getActiveDesktopProfile());

  const active = (item) => {
    if (item.exact) return location.pathname === item.to;
    if (item.to === "/library" && location.pathname === "/my-list") return true;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      navigate("/search");
      searchRef.current?.focus();
      return;
    }
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  useEffect(() => {
    const appWindow = getDesktopWindow();
    if (!appWindow?.isMaximized) return;
    appWindow.isMaximized().then(setMaximized).catch(() => {});
  }, []);

  useEffect(() => {
    const syncProfile = () => setProfile(getActiveDesktopProfile());
    window.addEventListener("synflix-desktop-profile", syncProfile);
    window.addEventListener("synflix-desktop-profiles", syncProfile);
    return () => {
      window.removeEventListener("synflix-desktop-profile", syncProfile);
      window.removeEventListener("synflix-desktop-profiles", syncProfile);
    };
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
        } catch {
          // Browser preview or unsupported window API.
        }
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
    } catch {
      // No-op in browser preview mode.
    }
  };

  const toggleFullscreen = async () => {
    const appWindow = getDesktopWindow();
    if (!appWindow?.isFullscreen || !appWindow?.setFullscreen) return;
    try {
      const full = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!full);
    } catch {
      // No-op in browser preview mode.
    }
  };

  return (
    <div className="synflix-desktop-app min-h-screen bg-[#07090f] text-white">
      <a href="#synflix-desktop-main" className="synflix-desktop-skip-link">Skip to content</a>

      <div className="synflix-desktop-titlebar" data-tauri-drag-region>
        <div className="synflix-desktop-titlebrand" data-tauri-drag-region>
          <img src="/synflix-logo.webp" alt="" aria-hidden="true" />
          <span data-tauri-drag-region>SynFlix</span>
        </div>
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
              <Link key={item.to} to={item.to} data-label={item.label} data-active={selected ? "true" : "false"} aria-current={selected ? "page" : undefined} aria-label={item.label}>
                <Icon aria-hidden="true" /><span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <nav className="synflix-desktop-side-bottom" aria-label="Application">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = active(item);
            return (
              <Link key={item.to} to={item.to} data-label={item.label} data-active={selected ? "true" : "false"} aria-current={selected ? "page" : undefined} aria-label={item.label}>
                <Icon aria-hidden="true" /><span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="synflix-desktop-toolbar">
        <div className="synflix-desktop-toolbar-spacer" data-tauri-drag-region />
        <form className="synflix-desktop-search" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" />
          <label htmlFor="synflix-desktop-search-input" className="sr-only">Search SynFlix</label>
          <input id="synflix-desktop-search-input" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movies, series, people…" autoComplete="off" />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </form>
        <div className="synflix-desktop-toolbar-actions">
          <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Fullscreen (F11)"><Maximize2 aria-hidden="true" /></button>
          <Link to="/profiles" className="synflix-desktop-profile" aria-label={`Profile: ${profile?.name || "My Profile"}`} title="Switch profile">
            <span className="desktop-avatar desktop-avatar--tiny" data-avatar={profile?.avatar || "spark"}><span>{(profile?.name || "S").slice(0, 1).toUpperCase()}</span></span>
            <span className="synflix-desktop-profile-name">{profile?.name || "My Profile"}</span>
            <ChevronDown aria-hidden="true" />
          </Link>
        </div>
      </div>

      <main id="synflix-desktop-main" tabIndex="-1" className="synflix-desktop-content">{children}</main>
    </div>
  );
}
