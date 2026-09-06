import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { searchAll } from "@/lib/api";
import { getWatchlist, toggleWatchlist } from "@/lib/storage";
import { mediaTypeOf } from "@/lib/format";
import { DesktopPoster } from "@/components/DesktopMedia";

export default function DesktopSearch() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const q = params.get("q") || "";
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const { data, isLoading } = useQuery({ queryKey: ["desktop-search", q], queryFn: () => searchAll(q), enabled: Boolean(q.trim()), staleTime: 20_000 });
  const results = data?.results || data?.items || [];
  const savedKeys = useMemo(() => new Set(watchlist.map((item) => `${item.media_type}:${item.id}`)), [watchlist]);

  const submit = (e) => { e.preventDefault(); const value = query.trim(); setParams(value ? { q: value } : {}); };
  const toggle = (item) => { const type = mediaTypeOf(item, "movie"); toggleWatchlist({ ...item, media_type: type }); setWatchlist(getWatchlist()); };

  return (
    <div className="desktop-page desktop-search-page" data-testid="desktop-search-page">
      <div className="desktop-page-heading"><div><span className="desktop-eyebrow">Find anything</span><h1>Search</h1></div></div>
      <form className="desktop-search-large" onSubmit={submit}><Search aria-hidden="true" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search movies, series, people…" /><button type="submit">Search</button></form>
      {!q ? <div className="desktop-search-hint">Start typing a movie or series title.</div> : isLoading ? <div className="desktop-loading"><span className="desktop-loader" /></div> : results.length ? <div className="desktop-discover-grid">{results.map((item) => { const type = mediaTypeOf(item, "movie"); return <DesktopPoster key={`${type}:${item.id}`} item={{ ...item, media_type: type }} saved={savedKeys.has(`${type}:${item.id}`)} onToggle={toggle} />; })}</div> : <div className="desktop-empty-state"><Search aria-hidden="true" /><h3>No results</h3><p>Try a different title.</p></div>}
    </div>
  );
}
