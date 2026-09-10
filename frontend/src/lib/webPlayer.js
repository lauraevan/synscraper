export const isPremiumWebClient = () =>
  typeof window !== "undefined" &&
  document.documentElement.dataset.synflixWebClient === "true";

export const playbackPath = ({ mediaType, id, season = 1, episode = 1 }) => {
  const base = `/watch/${mediaType}/${id}`;
  return mediaType === "tv" ? `${base}?season=${season}&episode=${episode}` : base;
};

export const requestWebPlayback = (request, navigate) => {
  const detail = {
    mediaType: request.mediaType || request.type || "movie",
    id: String(request.id),
    season: Number(request.season || 1),
    episode: Number(request.episode || 1),
    meta: request.meta || null,
    autoplay: request.autoplay !== false,
  };

  if (isPremiumWebClient()) {
    window.dispatchEvent(new CustomEvent("synflix:web-play", { detail }));
    return true;
  }

  if (navigate) navigate(playbackPath(detail));
  return false;
};
