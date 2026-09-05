import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { backdrop } from "@/lib/api";

const supportedSite = (site) => site === "YouTube" || site === "Vimeo";

const videoScore = (video) => {
  const type = String(video?.type || "").toLowerCase();
  const name = String(video?.name || "").toLowerCase();
  let score = 0;
  if (type === "trailer") score += 100;
  else if (type === "teaser") score += 80;
  else if (type === "clip") score += 55;
  else if (type === "featurette") score += 35;
  if (video?.official) score += 30;
  if (/official|trailer|teaser/.test(name)) score += 10;
  if (video?.site === "YouTube") score += 4;
  return score;
};

const backgroundUrl = (video) => {
  if (!video?.key) return "";
  const key = encodeURIComponent(video.key);
  if (video.site === "YouTube") {
    return `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${key}&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1`;
  }
  if (video.site === "Vimeo") {
    return `https://player.vimeo.com/video/${key}?autoplay=1&muted=1&background=1&loop=1&title=0&byline=0&portrait=0&api=1`;
  }
  return "";
};

export const DetailsTrailerBackground = ({ videos = [], title = "", backdropPath }) => {
  const frameRef = useRef(null);
  const ranked = useMemo(() => [...videos]
    .filter((video) => video?.key && supportedSite(video.site))
    .sort((a, b) => videoScore(b) - videoScore(a)), [videos]);
  const primary = ranked[0] || null;
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setMounted(false);
    setLoaded(false);
    setMuted(true);
    if (!primary) return undefined;
    const timer = window.setTimeout(() => setMounted(true), 900);
    return () => window.clearTimeout(timer);
  }, [primary?.key, primary?.site]);

  const sendCommand = (command) => {
    const win = frameRef.current?.contentWindow;
    if (!win || !primary) return;
    if (primary.site === "YouTube") {
      win.postMessage(JSON.stringify({ event: "command", func: command, args: [] }), "*");
    } else if (primary.site === "Vimeo") {
      if (command === "mute") win.postMessage({ method: "setVolume", value: 0 }, "*");
      if (command === "unMute") win.postMessage({ method: "setVolume", value: 1 }, "*");
      if (command === "pauseVideo") win.postMessage({ method: "pause" }, "*");
      if (command === "playVideo") win.postMessage({ method: "play" }, "*");
    }
  };

  useEffect(() => {
    if (!mounted || !primary) return undefined;
    const onVisibility = () => sendCommand(document.hidden ? "pauseVideo" : "playVideo");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mounted, primary]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sendCommand(next ? "mute" : "unMute");
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-label={`${title || "Title"} background`}>
      {backdropPath && (
        <img
          src={backdrop(backdropPath, "w1280")}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ${loaded ? "opacity-0" : "opacity-100"}`}
        />
      )}

      {mounted && primary && (
        <iframe
          ref={frameRef}
          src={backgroundUrl(primary)}
          title={`${title || "Title"} trailer background`}
          className={`pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      )}

      {loaded && primary && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute bottom-[86px] right-5 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/35 bg-black/30 text-white backdrop-blur-md transition hover:bg-white/12 md:right-8"
          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
          title={muted ? "Unmute trailer" : "Mute trailer"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
};
