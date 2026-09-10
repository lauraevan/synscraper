import "@/App.css";
import "@/synflix-site.css";
import "@/theme-system.css";
import "@/light-mode.css";
import "@/synflix-polish.css";
import "@/mobile-app.css";
import "@/web-premium.css";
import "@/ios-native.css";
import "@/desktop-app.css";
import "@/desktop-v2-polish.css";
import "@/desktop-reference-exact.css";
import "@/desktop-tv-reference.css";
import "@/desktop-product.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { DesktopShell } from "@/components/DesktopShell";
import { WebClientShell } from "@/components/WebClientShell";
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
import DesktopHome from "@/pages/desktop/DesktopHome";
import DesktopDiscover from "@/pages/desktop/DesktopDiscover";
import DesktopLibrary from "@/pages/desktop/DesktopLibrary";
import DesktopSearch from "@/pages/desktop/DesktopSearch";
import DesktopProfiles from "@/pages/desktop/DesktopProfiles";
import DesktopSettings from "@/pages/desktop/DesktopSettings";
import DesktopTitle from "@/pages/desktop/DesktopTitle";
import DesktopAddons from "@/pages/desktop/DesktopAddons";
import DesktopOnboarding from "@/pages/desktop/DesktopOnboarding";
import { isDesktopSignedIn } from "@/lib/desktopAccount";

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

const iosRuntime = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(window.__SYNFLIX_IOS__ || params.get("iosApp") === "1");
};

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

function DesktopRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DesktopHome />} />
      <Route path="/discover" element={<DesktopDiscover />} />
      <Route path="/browse/:mediaType" element={<DesktopDiscover />} />
      <Route path="/library" element={<DesktopLibrary />} />
      <Route path="/my-list" element={<DesktopLibrary />} />
      <Route path="/search" element={<DesktopSearch />} />
      <Route path="/addons" element={<DesktopAddons />} />
      <Route path="/profiles" element={<DesktopProfiles />} />
      <Route path="/settings" element={<DesktopSettings />} />
      <Route path="/title/:mediaType/:id" element={<DesktopTitle />} />
      <Route path="/watch/:mediaType/:id" element={<Watch />} />
      <Route path="/person/:id" element={<Person />} />
      <Route path="*" element={<DesktopHome />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const isWatch = location.pathname.startsWith("/watch/");
  const isEmbed = location.pathname.startsWith("/embed/");
  const isPlayerSurface = isWatch || isEmbed;
  const isDesktopApp = desktopRuntime() && !isEmbed;
  const isIOSApp = iosRuntime() && !isEmbed;
  const isWebClient = !isEmbed && !isDesktopApp && !isIOSApp;

  useEffect(() => {
    document.title = isPlayerSurface ? "SynPlayer · SynFlix" : "SynFlix";
    document.documentElement.dataset.synflixDesktop = isDesktopApp ? "true" : "false";
    document.documentElement.dataset.synflixIos = isIOSApp ? "true" : "false";
    document.documentElement.dataset.synflixWebClient = isWebClient ? "true" : "false";

    const syncBrowserChrome = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const light = document.documentElement.dataset.siteMode === "light";
        meta.setAttribute("content", isPlayerSurface || isDesktopApp || isIOSApp ? "#080a14" : light ? "#f5f3ed" : "#050505");
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
  }, [isPlayerSurface, isDesktopApp, isIOSApp, isWebClient, location.pathname]);

  if (isEmbed) return <AppRoutes />;

  if (isDesktopApp) {
    if (!isDesktopSignedIn()) return <DesktopOnboarding />;
    return (
      <DesktopShell>
        <DesktopRoutes />
      </DesktopShell>
    );
  }

  if (isIOSApp) {
    return (
      <div className={isPlayerSurface ? "synflix-ios-player-surface" : "synflix-site synflix-ios-native-surface"}>
        <AppRoutes />
      </div>
    );
  }

  if (isWatch) return <AppRoutes />;

  return (
    <WebClientShell>
      <AppRoutes />
    </WebClientShell>
  );
}

export default function App() {
  return (
    <div className="App min-h-screen bg-[#050505] text-white">
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
