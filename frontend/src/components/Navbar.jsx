import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Cloud, Menu, Search, X } from "lucide-react";

export const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [q, setQ] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
        setSearchOpen(false);
    }, [location.pathname]);

    const links = [
        { to: "/demo", label: "Demo" },
        { to: "/docs", label: "Docs" },
        { to: "/browse/movie", label: "Browse" },
    ];

    const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

    const submit = (e) => {
        e.preventDefault();
        if (!q.trim()) return;
        navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    };

    return (
        <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-black/80 backdrop-blur-2xl" : "bg-gradient-to-b from-black/80 to-transparent"}`}>
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 md:px-8">
                <Link to="/" className="flex items-center gap-2.5 text-white">
                    <Cloud className="h-7 w-7 stroke-[1.7]" />
                    <span className="text-[15px] font-semibold tracking-tight">Synapse Player</span>
                </Link>

                <nav className="ml-6 hidden items-center gap-7 text-sm md:flex">
                    {links.map((link) => (
                        <Link key={link.to} to={link.to} className={`transition-colors ${isActive(link.to) ? "text-white" : "text-white/50 hover:text-white"}`}>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <form onSubmit={submit} className="hidden sm:block">
                        <div className={`flex h-9 items-center overflow-hidden rounded-full border transition-all ${searchOpen ? "w-56 border-white/15 bg-white/[0.06] px-2" : "w-9 border-transparent"}`}>
                            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="grid h-8 w-8 shrink-0 place-items-center text-white/65 hover:text-white" aria-label="Search">
                                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                            </button>
                            {searchOpen && (
                                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/30" placeholder="Search titles" />
                            )}
                        </div>
                    </form>

                    <Link to="/demo" className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85 sm:inline-flex">
                        Launch demo
                    </Link>

                    <button onClick={() => setMobileOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white md:hidden" aria-label="Menu">
                        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <div className="border-t border-white/10 bg-black/95 px-5 py-4 backdrop-blur-2xl md:hidden">
                    <div className="mx-auto flex max-w-7xl flex-col gap-1">
                        {links.map((link) => (
                            <Link key={link.to} to={link.to} className="rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white">
                                {link.label}
                            </Link>
                        ))}
                        <Link to="/demo" className="mt-2 rounded-xl bg-white px-3 py-3 text-center text-sm font-semibold text-black">Launch demo</Link>
                    </div>
                </div>
            )}
        </header>
    );
};
