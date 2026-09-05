import "@/App.css";
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

function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#070707] px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white text-[13px] font-black text-black">S</span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">SynScraper</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/34">A quiet, content-first way to browse and play from your available sources.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/38">
          <Link to="/browse/movie" className="transition hover:text-white">Movies</Link>
          <Link to="/browse/tv" className="transition hover:text-white">TV</Link>
          <Link to="/my-list" className="transition hover:text-white">My List</Link>
          <Link to="/demo" className="transition hover:text-white">Demo</Link>
          <Link to="/docs" className="transition hover:text-white">Docs</Link>
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  const location = useLocation();
  const isWatch = location.pathname.startsWith("/watch/");

  return (
    <>
      {!isWatch && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/browse/:mediaType" element={<Browse />} />
        <Route path="/title/:mediaType/:id" element={<Title />} />
        <Route path="/watch/:mediaType/:id" element={<Watch />} />
        <Route path="/search" element={<Search />} />
        <Route path="/my-list" element={<MyList />} />
      </Routes>
      {!isWatch && <Footer />}
    </>
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
