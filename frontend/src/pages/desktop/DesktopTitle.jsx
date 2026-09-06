import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ChevronLeft, Play, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { backdrop, getDetails, getSeason, img } from "@/lib/api";
import { ratingStr, runtimeStr, titleOf, yearOf } from "@/lib/format";
import { getWatchlist, toggleWatchlist } from "@/lib/storage";
import { DesktopRail } from "@/components/DesktopMedia";

function EpisodeBrowser({ id, seasons = [] }) {
  const navigate = useNavigate();
  const valid = seasons.filter((season) => season.season_number > 0);
  const [season, setSeason] = useState(valid[0]?.season_number || 1);
  const { data, isLoading } = useQuery({ queryKey: ["desktop-season", id, season], queryFn: () => getSeason(id, season), enabled: Boolean(id && season) });
  return (
    <section className="desktop-media-section desktop-episodes-section">
      <header className="desktop-section-header desktop-episodes-header"><div><h2>Episodes</h2><p>Choose a season and episode.</p></div><label className="desktop-select"><span className="sr-only">Season</span><select value={season} onChange={(e) => setSeason(Number(e.target.value))}>{valid.map((item) => <option key={item.id} value={item.season_number}>{item.name}</option>)}</select></label></header>
      {isLoading ? <div className="desktop-loading"><span className="desktop-loader" /></div> : <div className="desktop-episode-list">{(data?.episodes || []).map((episode) => <button type="button" key={episode.id} className="desktop-episode" onClick={() => navigate(`/watch/tv/${id}?season=${season}&episode=${episode.episode_number}`)}><div className="desktop-episode-art">{episode.still_path ? <img src={img(episode.still_path, "w500")} alt="" loading="lazy" /> : null}<span><Play aria-hidden="true" /></span></div><div><strong>{episode.episode_number}. {episode.name}</strong><small>{episode.runtime ? `${episode.runtime}m` : ""}{episode.air_date ? ` · ${episode.air_date}` : ""}</small><p>{episode.overview}</p></div></button>)}</div>}
    </section>
  );
}

export default function DesktopTitle() {
  const { mediaType, id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["desktop-title", mediaType, id], queryFn: () => getDetails(mediaType, id), staleTime: 300_000 });
  const [watchlist, setWatchlist] = useState(() => getWatchlist());

  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  const savedKeys = useMemo(() => new Set(watchlist.map((item) => `${item.media_type}:${item.id}`)), [watchlist]);
  const saved = savedKeys.has(`${mediaType}:${id}`) || savedKeys.has(`${mediaType}:${Number(id)}`);

  if (isLoading || !data) return <div className="desktop-page desktop-loading"><span className="desktop-loader" /></div>;

  const title = titleOf(data);
  const similar = data.recommendations?.results || data.similar?.results || [];
  const genres = data.genres || [];
  const toggle = (item = data) => {
    toggleWatchlist({ media_type: mediaType, id: Number(id), title, poster_path: item.poster_path, backdrop_path: item.backdrop_path, vote_average: item.vote_average, release_date: item.release_date, first_air_date: item.first_air_date });
    setWatchlist(getWatchlist());
  };

  return (
    <div className="desktop-page desktop-title-page" data-testid="desktop-title-page">
      <button type="button" className="desktop-back-button" onClick={() => navigate(-1)}><ChevronLeft aria-hidden="true" /> Back</button>
      <section className="desktop-title-hero" style={{ "--desktop-title-image": `url(${backdrop(data.backdrop_path, "w1280")})` }}>
        <div className="desktop-title-shade" />
        <div className="desktop-title-copy">
          <span className="desktop-eyebrow">{mediaType === "tv" ? "Series" : "Movie"}</span>
          <h1>{title}</h1>
          <div className="desktop-title-meta">{Number(data.vote_average) > 0 ? <span><Star aria-hidden="true" /> {ratingStr(data.vote_average)}</span> : null}<span>{yearOf(data)}</span>{mediaType === "movie" && data.runtime ? <span>{runtimeStr(data.runtime)}</span> : null}{mediaType === "tv" && data.number_of_seasons ? <span>{data.number_of_seasons} season{data.number_of_seasons === 1 ? "" : "s"}</span> : null}</div>
          <div className="desktop-title-genres">{genres.slice(0, 4).map((genre) => <span key={genre.id}>{genre.name}</span>)}</div>
          {data.overview ? <p className="desktop-title-overview">{data.overview}</p> : null}
          <div className="desktop-title-actions"><button type="button" className="desktop-primary-button" onClick={() => navigate(`/watch/${mediaType}/${id}${mediaType === "tv" ? "?season=1&episode=1" : ""}`)}><Play aria-hidden="true" /> Play</button><button type="button" className="desktop-secondary-button" onClick={() => toggle()}>{saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{saved ? "In watchlist" : "Add to watchlist"}</button></div>
        </div>
      </section>
      {mediaType === "tv" && data.seasons ? <EpisodeBrowser id={id} seasons={data.seasons} /> : null}
      <DesktopRail title="More like this" subtitle="Related titles" items={similar} fallbackType={mediaType} savedKeys={savedKeys} onToggle={(item) => { toggleWatchlist({ ...item, media_type: mediaType }); setWatchlist(getWatchlist()); }} />
    </div>
  );
}
