import { Bookmark, Check, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { img } from "@/lib/api";
import { mediaTypeOf, titleOf } from "@/lib/format";

export function DesktopPoster({ item, fallbackType = "movie", onToggle, saved = false, onPreview, selected = false }) {
  const navigate = useNavigate();
  const mediaType = mediaTypeOf(item, fallbackType);
  const title = titleOf(item);
  const open = () => navigate(`/title/${mediaType}/${item.id}`);

  return (
    <article className="desktop-poster-card" data-selected={selected ? "true" : "false"} onMouseEnter={() => onPreview?.({ ...item, media_type: mediaType })}>
      <div className="desktop-poster-art-wrap">
        <button type="button" className="desktop-poster-art" onClick={open} onFocus={() => onPreview?.({ ...item, media_type: mediaType })} aria-label={`Open ${title}`}>
          {item.poster_path ? <img src={img(item.poster_path, "w500")} alt="" loading="lazy" /> : <div className="desktop-poster-fallback">{title.slice(0, 1)}</div>}
          <span className="desktop-poster-play" aria-hidden="true"><Play /></span>
        </button>
        {onToggle ? (
          <button type="button" className="desktop-poster-save" onClick={() => onToggle(item)} aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`} title={saved ? "Remove from watchlist" : "Add to watchlist"}>
            {saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function DesktopRail({ title, items = [], fallbackType = "movie", savedKeys, onToggle, onPreview, selectedKey, seeAll }) {
  if (!items.length) return null;
  return (
    <section className="desktop-media-section">
      <header className="desktop-section-header">
        <h2>{title}</h2>
        {seeAll ? <Link to={seeAll} className="desktop-see-all">See All <span aria-hidden="true">›</span></Link> : null}
      </header>
      <div className="desktop-poster-rail">
        {items.map((item) => {
          const type = mediaTypeOf(item, fallbackType);
          const key = `${type}:${item.id}`;
          return (
            <DesktopPoster
              key={key}
              item={{ ...item, media_type: type }}
              fallbackType={fallbackType}
              saved={savedKeys?.has(key)}
              onToggle={onToggle}
              onPreview={onPreview}
              selected={selectedKey === key}
            />
          );
        })}
      </div>
    </section>
  );
}

export function DesktopContinueCard({ item, onPreview, selected = false }) {
  const navigate = useNavigate();
  const pct = item.duration ? Math.max(0, Math.min(1, item.position / item.duration)) : 0;
  const path = `/watch/${item.media_type}/${item.id}${item.media_type === "tv" ? `?season=${item.season || 1}&episode=${item.episode || 1}` : ""}`;
  const title = item.title || item.name || "Untitled";

  return (
    <button
      type="button"
      className="desktop-continue-card"
      data-selected={selected ? "true" : "false"}
      onClick={() => navigate(path)}
      onMouseEnter={() => onPreview?.(item)}
      onFocus={() => onPreview?.(item)}
      aria-label={`Continue ${title}`}
    >
      <div className="desktop-continue-art">
        {item.poster_path ? <img src={img(item.poster_path, "w500")} alt="" loading="lazy" /> : item.backdrop_path ? <img src={img(item.backdrop_path, "w780")} alt="" loading="lazy" /> : <div className="desktop-poster-fallback">{title.slice(0, 1)}</div>}
        <span className="desktop-continue-play"><Play aria-hidden="true" /></span>
        <div className="desktop-progress-track"><span style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      </div>
    </button>
  );
}
