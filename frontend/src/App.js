import "@/App.css";
import "@/synflix-site.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import Title from "@/pages/Title";
import Watch from "@/pages/Watch";
import Search from "@/pages/Search";
import MyList from "@/pages/MyList";
import Demo from "@/pages/Demo";
import Docs from "@/pages/Docs";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

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
          <Link to="/my-list" className="transition hover:text-[#ffd400]">My List</Link>
          <Link to="/privacy" className="transition hover:text-[#ffd400]">Privacy</Link>
          <Link to="/terms" className="transition hover:text-[#ffd400]">Terms</Link>
          <Link to="/demo" className="transition hover:text-[#ffd400]">Demo</Link>
          <Link to="/docs" className="transition hover:text-[#ffd400]">Docs</Link>
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  const location = useLocation();
  const isWatch = location.pathname.startsWith("/watch/");

  useEffect(() => {
    document.title = isWatch ? "SynPlayer" : "SynFlix";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isWatch ? "#000000" : "#ffd400");

    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.setAttribute("rel", "icon");
      document.head.appendChild(icon);
    }
    icon.setAttribute("href", "/synflix-logo.webp");
  }, [isWatch]);

  return (
    <div className={isWatch ? "" : "synflix-site"}>
      {!isWatch && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/browse/:mediaType" element={<Browse />} />
        <Route path="/title/:mediaType/:id" element={<Title />} />
        <Route path="/watch/:mediaType/:id" element={<Watch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/my-list" element={<MyList />} />
      </Routes>
      {!isWatch && <Footer />}
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
