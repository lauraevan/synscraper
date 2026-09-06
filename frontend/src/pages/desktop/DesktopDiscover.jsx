import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, SlidersHorizontal } from "lucide-react";
import { discover } from "@/lib/api";
import { getWatchlist, toggleWatchlist } from "@/lib/storage";
import { DesktopPoster } from "@/components/DesktopMedia";

const GENRES = [
  ["All", ""], ["Action", 28], ["Adventure", 12], ["Animation", 16], ["Comedy", 35], ["Horror", 27], ["Mystery", 9648], ["Romance", 10749], ["Sci‑Fi", 878], ["Thriller", 53], ["Family", 10751], ["Fantasy", 14],
];

export default function DesktopDiscover() {
  const [type, setType] = useState("movie");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popularity.desc");
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const { data, isLoading } = useQuery({
    queryKey: ["desktop-discover", type, genre, sort],
    queryFn: () => discover(type, { ...(genre ? { with_genres: genre } : {}), sort_by: sort, "vote_count.gte": 40 }),
    staleTime: 45_000,
  });

  const savedKeys = useMemo(() => new Set(watchlist.map((item) => `${item.media_type}:${item.id}`)), [watchlist]);
  const toggle = (item) => { toggleWatchlist({ ...item, media_type: type }); setWatchlist(getWatchlist()); };

  return (
    <div className="desktop-page desktop-discover-page" data-testid="desktop-discover-page">
      <div className="desktop-page-heading desktop-discover-heading">
        <div><span className="desktop-eyebrow"><Compass aria-hidden="true" /> Catalog</span><h1>Discover</h1><p>Browse the catalog without leaving the desktop app.</p></div>
        <div className="desktop-discover-actions">
          <div className="desktop-segmented desktop-type-switch"><button type="button" data-active={type === "movie"} onClick={() => setType("movie")}>Movies</button><button type="button" data-active={type === "tv"} onClick={() => setType("tv")}>Series</button></div>
          <label className="desktop-select"><SlidersHorizontal aria-hidden="true" /><span className="sr-only">Sort catalog</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="popularity.desc">Popular</option><option value="vote_average.desc">Top rated</option><option value={type === "movie" ? "primary_release_date.desc" : "first_air_date.desc"}>Newest</option></select></label>
        </div>
      </div>

      <div className="desktop-genre-strip" aria-label="Genres">{GENRES.map(([label, id]) => <button type="button" key={label} data-active={String(genre) === String(id)} onClick={() => setGenre(id)}>{label}</button>)}</div>

      {isLoading ? <div className="desktop-loading"><span className="desktop-loader" /></div> : (
        <div className="desktop-discover-grid">{(data?.results || []).map((item) => <DesktopPoster key={`${type}:${item.id}`} item={{ ...item, media_type: type }} saved={savedKeys.has(`${type}:${item.id}`)} onToggle={toggle} />)}</div>
      )}
    </div>
  );
}
