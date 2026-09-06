import "@/App.css";
import "@/synflix-site.css";
import "@/theme-system.css";
import "@/light-mode.css";
import "@/synflix-polish.css";
import "@/mobile-app.css";
import "@/desktop-app.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { MobileDock } from "@/components/MobileDock";
import { DesktopShell } from "@/components/DesktopShell";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import Title from "@/pages/Title";
import Watch from "@/pages/Watch";
import Search from "@/pages/Search";
import MyList from "@/pages/MyList";
import Demo from "@/pages/Demo";
import Docs from "@/pages/Docs";
import Api from "@/pages/Api";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Person from "@/pages/Person";
import Roulette from "@/pages/Roulette";
import Settings from "@/pages/Settings";

const desktopRuntime = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("desktopApp") === "1") {
    try { window.sessionStorage.setItem("synflix-desktop-preview", "1"); } catch { /* noop */ }
  }
  let preview = false;
  try { preview = window.sessionStorage.getItem("synflix-desktop-preview") === "1"; } catch { /* noop */ }
  return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__ || preview);
};

function Footer() {
  return (
    <footer className="border-t border-[#ffd400]/10 bg-[#070707] px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 text-white">
            <img src="/synflix-logo.webp" alt="SynFlix" className="synflix-brand-logo h-9 w-9" />
            <span className="synflix-brand-text text-[15px] font-semibold tracking-[-0.02em]">SynFlix</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/34">Discover, preview, save, and watch from your available sources in one clean place.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/38">
          <Link to="/browse/movie" className="transition hover:text-[#ffd400]">Movies</Link>
          <Link to="/browse/tv" className="transition hover:text-[#ffd400]">TV</Link>
          <Link to="/roulette" className="transition hover:text-[#ffd400]">Roulette</Link>
          <Link to="/my-list" className="transition hover:text-[#ffd400]">My List</Link>
          <Link to="/settings" className="transition hover:text-[#ffd400]">Settings</Link>
          <Link to="/synplayer-api" className="transition hover:text-[#ffd400]">API</Link>
          <Link to="/privacy" className="transition hover:text-[#ffd400]">Privacy</Link>
          <Link to="/terms" className="transition hover:text-[#ffd400]">Terms</Link>
          <Link to="/demo" className="transition hover:text-[#ffd400]">Demo</Link>
          <Link to="/docs" className="transition hover:text-[#ffd400]">Docs</Link>
        </div>
      </div>
    </footer>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/synplayer-api" element={<Api />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/roulette" element={<Roulette />} />
      <Route path="/person/:id" element={<Person />} />
      <Route path="/browse/:mediaType" element={<Browse />} />
      <Route path="/title/:mediaType/:id" element={<Title />} />
      <Route path="/watch/:mediaType/:id" element={<Watch />} />
      <Route path="/embed/:mediaType/:id" element={<Watch embed />} />
      <Route path="/search" element={<Search />} />
      <Route path="/my-list" element={<MyList />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const isWatch = location.pathname.startsWith("/watch/");
  const isEmbed = location.pathname.startsWith("/embed/");
  const isPlayerSurface = isWatch || isEmbed;
  const isDesktopApp = desktopRuntime() && !isEmbed;

  useEffect(() => {
    document.title = isPlayerSurface ? "SynPlayer · SynFlix" : "SynFlix";
    document.documentElement.dataset.synflixDesktop = isDesktopApp ? "true" : "false";

    const syncBrowserChrome = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const light = document.documentElement.dataset.siteMode === "light";
        meta.setAttribute("content", isPlayerSurface || isDesktopApp ? "#07090f" : light ? "#f5f3ed" : "#070707");
      }
    };
    syncBrowserChrome();
    window.addEventListener("synflix-preferences", syncBrowserChrome);

    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.setAttribute("rel", "icon");
      document.head.appendChild(icon);
    }
    icon.setAttribute("href", "/synflix-logo.webp");

    return () => window.removeEventListener("synflix-preferences", syncBrowserChrome);
  }, [isPlayerSurface, isDesktopApp, location.pathname]);

  if (isEmbed) return <AppRoutes />;

  if (isDesktopApp) {
    return (
      <DesktopShell>
        <div className={isWatch ? "" : "synflix-site"}>
          <AppRoutes />
        </div>
      </DesktopShell>
    );
  }

  return (
    <div className={isPlayerSurface ? "" : "synflix-site"}>
      {!isPlayerSurface && <Navbar />}
      <AppRoutes />
      {!isPlayerSurface && <MobileDock />}
      {!isPlayerSurface && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <div className="App min-h-screen bg-[#070707] text-white">
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
