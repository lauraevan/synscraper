import { useEffect, useMemo, useState } from "react";
import { Bookmark, Clock3, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { getContinue, getWatchlist, removeContinue, toggleWatchlist } from "@/lib/storage";
import { DesktopContinueCard, DesktopPoster } from "@/components/DesktopMedia";

export default function DesktopLibrary() {
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const [continueItems, setContinueItems] = useState(() => getContinue());
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [query, setQuery] = useState("");

  const sync = () => {
    setWatchlist(getWatchlist());
    setContinueItems(getContinue());
  };

  useEffect(() => {
    window.addEventListener("synflix-library-change", sync);
    window.addEventListener("synflix-desktop-profile", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("synflix-library-change", sync);
      window.removeEventListener("synflix-desktop-profile", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const filtered = useMemo(() => {
    let items = [...watchlist];
    if (filter !== "all") items = items.filter((item) => item.media_type === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter((item) => String(item.title || item.name || "").toLowerCase().includes(q));
    }
    if (sort === "title") items.sort((a, b) => String(a.title || a.name || "").localeCompare(String(b.title || b.name || "")));
    else items.sort((a, b) => Number(b.added_at || 0) - Number(a.added_at || 0));
    return items;
  }, [watchlist, filter, query, sort]);

  const savedKeys = useMemo(() => new Set(watchlist.map((item) => `${item.media_type}:${item.id}`)), [watchlist]);

  const removeSaved = (item) => {
    toggleWatchlist(item);
    sync();
  };

  const clearContinue = (item) => {
    removeContinue(item.media_type, item.id);
    sync();
  };

  return (
    <div className="desktop-page desktop-library-page" data-testid="desktop-library-page">
      <div className="desktop-page-heading">
        <div><span className="desktop-eyebrow">Personal library</span><h1>Library</h1><p>Your watchlist and viewing history belong to this profile.</p></div>
      </div>

      {continueItems.length > 0 && (
        <section className="desktop-media-section">
          <header className="desktop-section-header"><div><h2><Clock3 aria-hidden="true" /> Continue watching</h2><p>{continueItems.length} unfinished title{continueItems.length === 1 ? "" : "s"}</p></div></header>
          <div className="desktop-continue-grid">
            {continueItems.map((item) => (
              <div className="desktop-continue-wrap" key={`${item.media_type}:${item.id}`}>
                <DesktopContinueCard item={item} />
                <button type="button" className="desktop-remove-progress" onClick={() => clearContinue(item)} title="Remove from continue watching" aria-label={`Remove ${item.title || item.name || "title"} from continue watching`}><Trash2 aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="desktop-media-section desktop-library-watchlist">
        <header className="desktop-section-header desktop-library-header">
          <div><h2><Bookmark aria-hidden="true" /> Watchlist</h2><p>{watchlist.length} saved title{watchlist.length === 1 ? "" : "s"}</p></div>
          <div className="desktop-library-controls">
            <label className="desktop-inline-search"><Search aria-hidden="true" /><span className="sr-only">Search watchlist</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search watchlist" /></label>
            <div className="desktop-segmented" aria-label="Filter watchlist">
              <button type="button" data-active={filter === "all"} onClick={() => setFilter("all")}>All</button>
              <button type="button" data-active={filter === "movie"} onClick={() => setFilter("movie")}>Movies</button>
              <button type="button" data-active={filter === "tv"} onClick={() => setFilter("tv")}>Series</button>
            </div>
            <label className="desktop-select"><SlidersHorizontal aria-hidden="true" /><span className="sr-only">Sort watchlist</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently added</option><option value="title">Title</option></select></label>
          </div>
        </header>

        {filtered.length ? (
          <div className="desktop-library-grid">
            {filtered.map((item) => <DesktopPoster key={`${item.media_type}:${item.id}`} item={item} saved={savedKeys.has(`${item.media_type}:${item.id}`)} onToggle={removeSaved} />)}
          </div>
        ) : (
          <div className="desktop-empty-state"><Bookmark aria-hidden="true" /><h3>{watchlist.length ? "No titles match" : "Your watchlist is empty"}</h3><p>{watchlist.length ? "Try another filter or search." : "Save something from Discover or a title page and it will appear here."}</p></div>
        )}
      </section>
    </div>
  );
}
