import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Play, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { backdrop, discover, getHome } from "@/lib/api";
import { mediaTypeOf, titleOf, yearOf } from "@/lib/format";
import { getContinue, getWatchlist, toggleWatchlist } from "@/lib/storage";
import { getActiveDesktopProfile, getDesktopPreferences } from "@/lib/desktopProfile";
import { DesktopContinueCard, DesktopRail } from "@/components/DesktopMedia";

const GENRES = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  horror: 27,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  family: 10751,
  fantasy: 14,
};

const withType = (items = [], type) => items.map((item) => ({ ...item, media_type: item.media_type || type }));

export default function DesktopHome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => getActiveDesktopProfile());
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const [continueItems, setContinueItems] = useState(() => getContinue());
  const [prefs, setPrefs] = useState(() => getDesktopPreferences());
  const { data, isLoading } = useQuery({ queryKey: ["desktop-home"], queryFn: getHome, staleTime: 60_000 });

  const chosenGenre = prefs.favoriteGenres?.[0];
  const genreId = GENRES[chosenGenre];
  const { data: personalMovies } = useQuery({
    queryKey: ["desktop-personal", "movie", genreId],
    queryFn: () => discover("movie", { with_genres: genreId, sort_by: "popularity.desc", "vote_count.gte": 100 }),
    enabled: Boolean(genreId),
    staleTime: 120_000,
  });

  useEffect(() => {
    const sync = () => {
      setProfile(getActiveDesktopProfile());
      setWatchlist(getWatchlist());
      setContinueItems(getContinue());
      setPrefs(getDesktopPreferences());
    };
    window.addEventListener("synflix-desktop-profile", sync);
    window.addEventListener("synflix-desktop-preferences", sync);
    window.addEventListener("synflix-library-change", sync);
    return () => {
      window.removeEventListener("synflix-desktop-profile", sync);
      window.removeEventListener("synflix-desktop-preferences", sync);
      window.removeEventListener("synflix-library-change", sync);
    };
  }, []);

  const trending = data?.trending || [];
  const popularMovies = withType(data?.popular_movies, "movie");
  const popularTv = withType(data?.popular_tv, "tv");
  const feature = trending.find((item) => item.backdrop_path) || popularMovies[0] || popularTv[0];
  const featureType = feature ? mediaTypeOf(feature, "movie") : "movie";
  const savedKeys = useMemo(() => new Set(watchlist.map((item) => `${item.media_type}:${item.id}`)), [watchlist]);

  const toggle = (item) => {
    const type = mediaTypeOf(item, "movie");
    toggleWatchlist({
      ...item,
      media_type: type,
      title: titleOf(item),
    });
    setWatchlist(getWatchlist());
  };

  if (isLoading && !data) {
    return <div className="desktop-page desktop-loading"><span className="desktop-loader" /></div>;
  }

  return (
    <div className="desktop-page desktop-home-page" data-testid="desktop-home-page">
      <div className="desktop-page-heading desktop-home-heading">
        <div>
          <span className="desktop-eyebrow">For {profile?.name || "you"}</span>
          <h1>Home</h1>
        </div>
        <button type="button" className="desktop-soft-button" onClick={() => navigate("/settings")}><Sparkles aria-hidden="true" /> Personalize</button>
      </div>

      {feature && (
        <section className="desktop-feature" style={{ "--desktop-feature-image": `url(${backdrop(feature.backdrop_path, "w1280")})` }}>
          <div className="desktop-feature-shade" />
          <div className="desktop-feature-copy">
            <span className="desktop-feature-kicker">Featured for you</span>
            <h2>{titleOf(feature)}</h2>
            <div className="desktop-feature-meta"><span>{yearOf(feature)}</span><span>·</span><span>{featureType === "tv" ? "Series" : "Movie"}</span>{Number(feature.vote_average) > 0 ? <><span>·</span><span>{Number(feature.vote_average).toFixed(1)} rating</span></> : null}</div>
            {feature.overview ? <p>{feature.overview}</p> : null}
            <div className="desktop-feature-actions">
              <button type="button" className="desktop-primary-button" onClick={() => navigate(`/watch/${featureType}/${feature.id}${featureType === "tv" ? "?season=1&episode=1" : ""}`)}><Play aria-hidden="true" /> Play</button>
              <button type="button" className="desktop-secondary-button" onClick={() => toggle(feature)}>{savedKeys.has(`${featureType}:${feature.id}`) ? <Bookmark aria-hidden="true" /> : <Plus aria-hidden="true" />} {savedKeys.has(`${featureType}:${feature.id}`) ? "In watchlist" : "Watchlist"}</button>
            </div>
          </div>
        </section>
      )}

      {continueItems.length > 0 && (
        <section className="desktop-media-section">
          <header className="desktop-section-header"><div><h2>Continue watching</h2><p>Pick up exactly where you stopped.</p></div></header>
          <div className="desktop-continue-rail">{continueItems.slice(0, 10).map((item) => <DesktopContinueCard key={`${item.media_type}:${item.id}`} item={item} />)}</div>
        </section>
      )}

      {watchlist.length > 0 && <DesktopRail title="Your watchlist" subtitle="Saved on this profile" items={watchlist.slice(0, 16)} savedKeys={savedKeys} onToggle={toggle} />}
      {genreId && <DesktopRail title={`Because you like ${chosenGenre}`} subtitle="Recommendations shaped by your profile" items={withType(personalMovies?.results, "movie")} savedKeys={savedKeys} onToggle={toggle} />}
      <DesktopRail title="Trending" subtitle="Popular across SynFlix right now" items={trending} savedKeys={savedKeys} onToggle={toggle} />
      <DesktopRail title="Movies" subtitle="Popular films" items={popularMovies} fallbackType="movie" savedKeys={savedKeys} onToggle={toggle} />
      <DesktopRail title="Series" subtitle="Popular shows" items={popularTv} fallbackType="tv" savedKeys={savedKeys} onToggle={toggle} />
    </div>
  );
}
