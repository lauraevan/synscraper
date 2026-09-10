import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ListVideo, Maximize2, Minimize2, X } from "lucide-react";
import { getDetails, getSeason, img } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SynapsePlayer } from "@/components/SynapsePlayer";
import { Spinner } from "@/components/Spinner";

export const WebPlayerOverlay = ({ session, onClose }) => {
  const [current, setCurrent] = useState(session);
  const [minimized, setMinimized] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    setCurrent(session);
    setMinimized(false);
    setEpisodesOpen(false);
  }, [session]);

  const mediaType = current?.mediaType || "movie";
  const id = current?.id;
  const season = Number(current?.season || 1);
  const episode = Number(current?.episode || 1);

  const { data: details, isLoading } = useQuery({
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
    if (!current || minimized) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [current, minimized]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (episodesOpen) setEpisodesOpen(false);
      else if (minimized) onClose();
      else setMinimized(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, minimized, episodesOpen, onClose]);

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
        key="synflix-web-player"
        className={`synflix-web-player-layer ${minimized ? "is-minimized" : "is-expanded"}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        data-testid="web-player-overlay"
      >
        {!minimized && <div className="synflix-web-player-backdrop" onClick={() => setMinimized(true)} />}

        <motion.section
          layout
          className="synflix-web-player-window"
          transition={{ layout: { type: "spring", stiffness: 330, damping: 34, mass: 0.82 } }}
        >
          <div className="synflix-web-player-chrome">
            <div className="synflix-web-player-title">
              <span className="synflix-web-player-live-dot" />
              <span className="truncate">{meta.title || "SynFlix"}</span>
              {mediaType === "tv" && <span className="synflix-web-player-episode-label">S{season} · E{episode}</span>}
            </div>

            <div className="synflix-web-player-actions">
              {mediaType === "tv" && episodes.length > 0 && !minimized && (
                <button type="button" onClick={() => setEpisodesOpen((value) => !value)} aria-label="Episodes" className={episodesOpen ? "is-active" : ""}>
                  <ListVideo />
                </button>
              )}
              <button type="button" onClick={() => setMinimized((value) => !value)} aria-label={minimized ? "Expand player" : "Minimize player"}>
                {minimized ? <Maximize2 /> : <Minimize2 />}
              </button>
              <button type="button" onClick={onClose} aria-label="Close player"><X /></button>
            </div>
          </div>

          <div className="synflix-web-player-stage">
            {isLoading && !details ? (
              <div className="synflix-web-player-loading"><Spinner label="Preparing SynPlayer…" /></div>
            ) : (
              <SynapsePlayer
                key={`${mediaType}-${id}-${season}-${episode}`}
                mediaType={mediaType}
                id={id}
                meta={meta}
                season={season}
                episode={episode}
                hasNext={hasNext}
                onNextEpisode={nextEpisode}
                onBack={minimized ? undefined : () => setMinimized(true)}
              />
            )}
          </div>

          <AnimatePresence>
            {episodesOpen && !minimized && (
              <motion.aside
                className="synflix-web-episode-drawer"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="synflix-web-episode-drawer-head">
                  <div>
                    <span>Episodes</span>
                    <strong>{meta.title || "Series"}</strong>
                  </div>
                  {validSeasons.length > 1 && (
                    <label>
                      <span className="sr-only">Season</span>
                      <select value={season} onChange={(event) => pickSeason(Number(event.target.value))}>
                        {validSeasons.map((item) => <option key={item.id} value={item.season_number}>{item.name || `Season ${item.season_number}`}</option>)}
                      </select>
                      <ChevronDown />
                    </label>
                  )}
                </div>

                <div className="synflix-web-episode-list">
                  {episodes.map((item) => {
                    const selected = item.episode_number === episode;
                    return (
                      <button key={item.id} type="button" onClick={() => pickEpisode(item.episode_number)} className={selected ? "is-current" : ""}>
                        <span className="synflix-web-episode-thumb">
                          {item.still_path ? <img src={img(item.still_path, "w300")} alt="" loading="lazy" /> : <span />}
                          <em>{item.episode_number}</em>
                        </span>
                        <span className="synflix-web-episode-copy">
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
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
};
