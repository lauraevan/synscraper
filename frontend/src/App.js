import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

function Shell() {
    const location = useLocation();
    const isWatch = location.pathname.startsWith("/watch/");

    return (
        <>
            {!isWatch && <Navbar />}
            <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/browse/:mediaType" element={<Browse />} />
                <Route path="/title/:mediaType/:id" element={<Title />} />
                <Route path="/watch/:mediaType/:id" element={<Watch />} />
                <Route path="/search" element={<Search />} />
                <Route path="/my-list" element={<MyList />} />
            </Routes>

            {!isWatch && (
                <footer className="border-t border-white/10 bg-black px-5 py-10 md:px-10">
                    <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-white/45 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-lg font-semibold tracking-tight text-white">SynScraper</p>
                            <p className="mt-1 max-w-xl">A multi-source HLS player with adaptive quality, captions, source failover, PiP and a custom playback interface.</p>
                        </div>
                        <div className="text-left md:text-right">
                            <p>Metadata by TMDB.</p>
                            <p className="mt-1">Built for the SynScraper stack.</p>
                        </div>
                    </div>
                </footer>
            )}
        </>
    );
}

function App() {
    return (
        <div className="App min-h-screen bg-black text-white">
            <BrowserRouter>
                <Shell />
            </BrowserRouter>
            <Toaster position="top-center" theme="dark" />
        </div>
    );
}

export default App;
