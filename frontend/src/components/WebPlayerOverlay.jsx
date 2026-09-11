import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ListVideo, X } from "lucide-react";
import { getDetails, getSeason, img } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SystemPlayer } from "@/components/SystemPlayer";

export const WebPlayerOverlay = ({ session, onClose }) => {
  const [current, setCurrent] = useState(session);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    setCurrent(session);
    setEpisodesOpen(false);
  }, [session]);

  const close = useCallback(() => {
    setEpisodesOpen(false);
    setCurrent(null);
    onClose?.();
  }, [onClose]);

  const mediaType = current?.mediaType || "movie";
  const id = current?.id;
  const season = Number(current?.season || 1);
  const episode = Number(current?.episode || 1);

  const { data: details } = useQuery({
    queryKey: ["details", mediaType, String(id || "")],
    queryFn: () => getDetails(mediaType, id),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });

  const { data: seasonData } = useQuery({
    queryKey: ["season", String(id || ""), season],
    queryFn: () => getSeason(id, season),
    enabled: Boolean(id) && mediaType === "tv",
    staleTime: 3 * 60_000,
  });

  useEffect(() => {
    if (!current) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (episodesOpen) setEpisodesOpen(false);
      else close();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, current, episodesOpen]);

  const validSeasons = useMemo(
    () => (details?.seasons || []).filter((item) => item.season_number > 0),
    [details]
  );
  const episodes = seasonData?.episodes || [];
  const hasNext = mediaType === "tv" && episode < episodes.length;

  if (!current) return null;

  const meta = {
    title: details ? titleOf(details) : current.meta?.title,
    poster_path: details?.poster_path || current.meta?.poster_path,
    backdrop_path: details?.backdrop_path || current.meta?.backdrop_path,
    release_date: details?.release_date || current.meta?.release_date,
    first_air_date: details?.first_air_date || current.meta?.first_air_date,
  };

  const pickEpisode = (episodeNumber) => {
    setCurrent((value) => ({ ...value, episode: episodeNumber }));
    setEpisodesOpen(false);
  };

  const pickSeason = (seasonNumber) => {
    setCurrent((value) => ({ ...value, season: seasonNumber, episode: 1 }));
  };

  const nextEpisode = () => {
    if (hasNext) pickEpisode(episode + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="synflix-player3"
        className="synflix-player3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        data-testid="web-player-overlay"
      >
        <div className="synflix-player3-stage">
          <SystemPlayer
            key={`${mediaType}-${id}-${season}-${episode}`}
            mediaType={mediaType}
            id={id}
            meta={meta}
            season={season}
            episode={episode}
            hasNext={hasNext}
            onNextEpisode={nextEpisode}
            onBack={close}
            fullscreen
          />
        </div>

        <div className="synflix-player3-title" aria-live="polite">
          <strong>{meta.title || "SynFlix"}</strong>
          {mediaType === "tv" && <span>S{season} · E{episode}</span>}
        </div>

        {mediaType === "tv" && episodes.length > 0 && (
          <button
            type="button"
            className={`synflix-player3-episodes-toggle ${episodesOpen ? "is-active" : ""}`}
            onClick={() => setEpisodesOpen((value) => !value)}
            aria-expanded={episodesOpen}
            aria-label="Choose episode"
          >
            <ListVideo aria-hidden="true" />
            <span>Episodes</span>
            <ChevronDown aria-hidden="true" />
          </button>
        )}

        <AnimatePresence>
          {episodesOpen && (
            <motion.aside
              className="synflix-player3-drawer"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 22 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="synflix-player3-drawer-head">
                <div>
                  <small>{meta.title || "Series"}</small>
                  <strong>Episodes</strong>
                </div>
                <div className="synflix-player3-drawer-tools">
                  {validSeasons.length > 1 && (
                    <label>
                      <span className="sr-only">Season</span>
                      <select value={season} onChange={(event) => pickSeason(Number(event.target.value))}>
                        {validSeasons.map((item) => (
                          <option key={item.id} value={item.season_number}>
                            {item.name || `Season ${item.season_number}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" />
                    </label>
                  )}
                  <button type="button" onClick={() => setEpisodesOpen(false)} aria-label="Close episode list">
                    <X aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="synflix-player3-episode-list">
                {episodes.map((item) => {
                  const selected = item.episode_number === episode;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickEpisode(item.episode_number)}
                      className={selected ? "is-current" : ""}
                    >
                      <span className="synflix-player3-thumb">
                        {item.still_path ? (
                          <img src={img(item.still_path, "w300")} alt="" loading="lazy" />
                        ) : (
                          <span className="synflix-player3-thumb-empty" />
                        )}
                        <em>{item.episode_number}</em>
                      </span>
                      <span className="synflix-player3-episode-copy">
                        <strong>{item.name || `Episode ${item.episode_number}`}</strong>
                        <span>{item.runtime ? `${item.runtime} min` : `Season ${season}`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
