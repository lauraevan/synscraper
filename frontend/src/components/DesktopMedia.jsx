import { Bookmark, Check, Play, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { img } from "@/lib/api";
import { mediaTypeOf, titleOf, yearOf } from "@/lib/format";

export function DesktopPoster({ item, fallbackType = "movie", onToggle, saved = false, compact = false }) {
  const navigate = useNavigate();
  const mediaType = mediaTypeOf(item, fallbackType);
  const title = titleOf(item);
  const open = () => navigate(`/title/${mediaType}/${item.id}`);

  return (
    <article className={`desktop-poster-card ${compact ? "desktop-poster-card--compact" : ""}`}>
      <button type="button" className="desktop-poster-art" onClick={open} aria-label={`Open ${title}`}>
        {item.poster_path ? <img src={img(item.poster_path, "w342")} alt="" loading="lazy" /> : <div className="desktop-poster-fallback">{title.slice(0, 1)}</div>}
        <div className="desktop-poster-hover">
          <span className="desktop-poster-play"><Play aria-hidden="true" /></span>
        </div>
        {Number(item.vote_average) > 0 && (
          <span className="desktop-poster-rating"><Star aria-hidden="true" />{Number(item.vote_average).toFixed(1)}</span>
        )}
      </button>
      <div className="desktop-poster-meta">
        <button type="button" onClick={open} className="desktop-poster-title">{title}</button>
        <div className="desktop-poster-subline">
          <span>{yearOf(item) || (mediaType === "tv" ? "Series" : "Movie")}</span>
          <span>·</span>
          <span>{mediaType === "tv" ? "Series" : "Movie"}</span>
        </div>
      </div>
      {onToggle && (
        <button type="button" onClick={() => onToggle(item)} className="desktop-poster-save" aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`} title={saved ? "Remove from watchlist" : "Add to watchlist"}>
          {saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        </button>
      )}
    </article>
  );
}

export function DesktopRail({ title, subtitle, items = [], fallbackType = "movie", savedKeys, onToggle }) {
  if (!items.length) return null;
  return (
    <section className="desktop-media-section">
      <header className="desktop-section-header">
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
      </header>
      <div className="desktop-poster-rail">
        {items.map((item) => {
          const type = mediaTypeOf(item, fallbackType);
          const key = `${type}:${item.id}`;
          return <DesktopPoster key={key} item={{ ...item, media_type: type }} fallbackType={fallbackType} saved={savedKeys?.has(key)} onToggle={onToggle} />;
        })}
      </div>
    </section>
  );
}

export function DesktopContinueCard({ item }) {
  const navigate = useNavigate();
  const title = item.title || item.name || "Untitled";
  const pct = item.duration ? Math.max(0, Math.min(1, item.position / item.duration)) : 0;
  const path = `/watch/${item.media_type}/${item.id}${item.media_type === "tv" ? `?season=${item.season || 1}&episode=${item.episode || 1}` : ""}`;

  return (
    <button type="button" className="desktop-continue-card" onClick={() => navigate(path)}>
      <div className="desktop-continue-art">
        {item.backdrop_path ? <img src={img(item.backdrop_path, "w780")} alt="" loading="lazy" /> : item.poster_path ? <img src={img(item.poster_path, "w500")} alt="" loading="lazy" /> : null}
        <span className="desktop-continue-play"><Play aria-hidden="true" /></span>
        <div className="desktop-progress-track"><span style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      </div>
      <div className="desktop-continue-copy">
        <strong>{title}</strong>
        <span>{item.media_type === "tv" ? `S${item.season || 1} E${item.episode || 1}` : `${Math.round(pct * 100)}% watched`}</span>
      </div>
    </button>
  );
}
