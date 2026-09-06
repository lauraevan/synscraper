import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDetails, getHome } from "@/lib/api";
import { mediaTypeOf, titleOf, yearOf } from "@/lib/format";
import { getContinue } from "@/lib/storage";
import { DesktopContinueCard, DesktopRail } from "@/components/DesktopMedia";

const withType = (items = [], type) => items.map((item) => ({ ...item, media_type: item.media_type || type }));

function previewMode() {
  if (typeof window === "undefined") return false;
  try {
    return !window.__TAURI__ && !window.__TAURI_INTERNALS__ && window.sessionStorage.getItem("synflix-desktop-preview") === "1";
  } catch {
    return false;
  }
}

export default function DesktopHome() {
  const [continueItems, setContinueItems] = useState(() => getContinue());
  const [selected, setSelected] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["desktop-home"], queryFn: getHome, staleTime: 60_000 });

  useEffect(() => {
    const sync = () => setContinueItems(getContinue());
    window.addEventListener("synflix-library-change", sync);
    window.addEventListener("synflix-desktop-profile", sync);
    return () => {
      window.removeEventListener("synflix-library-change", sync);
      window.removeEventListener("synflix-desktop-profile", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && selected) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const popularMovies = withType(data?.popular_movies, "movie");
  const popularTv = withType(data?.popular_tv, "tv");
  const selectedType = selected ? mediaTypeOf(selected, "movie") : null;

  const { data: selectedDetails } = useQuery({
    queryKey: ["desktop-home-preview", selectedType, selected?.id],
    queryFn: () => getDetails(selectedType, selected.id),
    enabled: Boolean(selected?.id && selectedType),
    staleTime: 300_000,
  });

  const spotlight = selectedDetails ? { ...selectedDetails, media_type: selectedType } : selected;
  const selectedKey = selected ? `${selectedType}:${selected.id}` : null;

  const fallbackContinue = previewMode() && !continueItems.length
    ? [...popularMovies.slice(0, 4), ...popularTv.slice(0, 3)].map((item, index) => ({
        ...item,
        position: (index + 1) * 700,
        duration: 7200,
      }))
    : [];
  const continueDisplay = continueItems.length ? continueItems : fallbackContinue;

  if (isLoading && !data) {
    return <div className="desktop-page desktop-loading"><span className="desktop-loader" /></div>;
  }

  const cast = spotlight?.credits?.cast?.slice(0, 4).map((person) => person.name).filter(Boolean) || [];
  const genres = spotlight?.genres?.slice(0, 3).map((genre) => genre.name).filter(Boolean) || [];
  const runtime = spotlight?.runtime ? `${spotlight.runtime} min` : null;
  const rating = Number(spotlight?.vote_average) > 0 ? Number(spotlight.vote_average).toFixed(1) : null;

  return (
    <div className={`desktop-page desktop-home-page ${spotlight ? "has-spotlight" : ""}`} data-testid="desktop-home-page">
      {spotlight ? (
        <section className="desktop-stremio-spotlight" style={{ "--desktop-spotlight-image": `url(https://image.tmdb.org/t/p/original${spotlight.backdrop_path || ""})` }}>
          <div className="desktop-stremio-spotlight-copy">
            <h1>{titleOf(spotlight)}</h1>
            <div className="desktop-stremio-meta">
              {runtime ? <span>{runtime}</span> : null}
              {yearOf(spotlight) ? <span>{yearOf(spotlight)}</span> : null}
              {rating ? <span>{rating} <b>TMDB</b></span> : null}
              <span>{genres.length ? genres.join(" | ") : selectedType === "tv" ? "Series" : "Movie"}</span>
            </div>
            {spotlight.overview ? <p>{spotlight.overview}</p> : null}
            {cast.length ? <div className="desktop-stremio-cast">{cast.join(", ")}</div> : null}
          </div>
        </section>
      ) : null}

      {continueDisplay.length ? (
        <section className="desktop-media-section desktop-continue-section">
          <header className="desktop-section-header">
            <h2>Continue Watching</h2>
            <span className="desktop-see-all">See All <span aria-hidden="true">›</span></span>
          </header>
          <div className="desktop-continue-rail">
            {continueDisplay.slice(0, 10).map((item) => (
              <DesktopContinueCard
                key={`${item.media_type}:${item.id}`}
                item={item}
                onPreview={setSelected}
                selected={selectedKey === `${item.media_type}:${item.id}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <DesktopRail title="Popular Movies" items={popularMovies} fallbackType="movie" onPreview={setSelected} selectedKey={selectedKey} seeAll="/browse/movie" />
      <DesktopRail title="Popular Series" items={popularTv} fallbackType="tv" onPreview={setSelected} selectedKey={selectedKey} seeAll="/browse/tv" />
    </div>
  );
}
