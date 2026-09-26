import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dices, Info, Play, RefreshCw, Star } from "lucide-react";
import { backdrop, discover, img } from "@/lib/api";
import { ratingStr, titleOf, yearOf } from "@/lib/format";

const pickRandom = (items = []) => {
  const usable = items.filter((item) => item?.id && item?.poster_path && item?.backdrop_path);
  if (!usable.length) return null;
  return usable[Math.floor(Math.random() * usable.length)];
};

export default function Roulette() {
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState(0);

  const spin = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    setError("");
    setRotation((value) => value + 720 + Math.floor(Math.random() * 720));
    try {
      const page = 1 + Math.floor(Math.random() * 20);
      const data = await discover("movie", { sort_by: "popularity.desc", "vote_count.gte": 150, page });
      const next = pickRandom(data?.results || []);
      if (!next) throw new Error("No movie was returned");
      await new Promise((resolve) => setTimeout(resolve, 650));
      setMovie({ ...next, media_type: "movie" });
    } catch (err) {
      setError(err?.message || "Film roulette could not find a movie.");
    } finally {
      setSpinning(false);
    }
  }, [spinning]);

  useEffect(() => { spin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-[#070707] pt-[68px]" data-testid="roulette-page">
      <section className="relative min-h-[calc(100vh-68px)] overflow-hidden">
        {movie?.backdrop_path && <img src={backdrop(movie.backdrop_path, "original")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 transition duration-700" />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(255,212,0,.08),transparent_34%),linear-gradient(90deg,#070707_0%,rgba(7,7,7,.92)_42%,rgba(7,7,7,.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#070707_0%,transparent_56%,rgba(7,7,7,.3)_100%)]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-68px)] max-w-[1500px] items-center gap-12 px-5 py-12 md:px-8 lg:grid-cols-[460px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-6 text-center lg:text-left">
              <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/70"><Dices className="h-3.5 w-3.5" /> Surprise me</div>
              <h1 className="text-5xl font-semibold tracking-[-0.055em] text-white md:text-6xl">Film Roulette</h1>
              <p className="mt-3 text-sm leading-6 text-white/38">Can’t choose? Spin and let SynFlix pick a movie for you.</p>
            </div>

            <div className="relative mx-auto aspect-square w-[290px] sm:w-[350px]">
              <div className="absolute left-1/2 top-[-7px] z-20 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#ffd400] drop-shadow-[0_4px_10px_rgba(255,212,0,.25)]" />
              <div
                className="absolute inset-0 rounded-full border border-white/12 shadow-[0_28px_80px_rgba(0,0,0,.5)] transition-transform duration-[900ms] ease-[cubic-bezier(.15,.75,.12,1)]"
                style={{ transform: `rotate(${rotation}deg)`, background: "conic-gradient(from 0deg,#ffd400 0 12.5%,#131313 12.5% 25%,#2b2b2b 25% 37.5%,#ffd400 37.5% 50%,#151515 50% 62.5%,#3a3a3a 62.5% 75%,#ffd400 75% 87.5%,#111 87.5% 100%)" }}
              >
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, index) => (
                  <span key={deg} className="absolute left-1/2 top-1/2 text-[11px] font-black uppercase tracking-[0.14em] text-black/70" style={{ transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-132px) rotate(90deg)` }}>{index % 2 === 0 ? "FILM" : "SPIN"}</span>
                ))}
              </div>
              <button
                onClick={spin}
                disabled={spinning}
                className="absolute left-1/2 top-1/2 z-10 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[8px] border-[#070707] bg-[#ffd400] text-black shadow-[0_8px_30px_rgba(0,0,0,.5)] transition hover:scale-105 disabled:cursor-wait disabled:opacity-70"
                aria-label="Spin film roulette"
              >
                <RefreshCw className={`h-8 w-8 ${spinning ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="min-w-0">
            {error ? (
              <div className="rounded-3xl border border-red-400/15 bg-red-400/[0.04] p-8 text-sm text-white/54">{error}<button onClick={spin} className="ml-3 font-semibold text-[#ffd400]">Try again</button></div>
            ) : movie ? (
              <div className={`grid gap-7 transition duration-500 sm:grid-cols-[190px_minmax(0,1fr)] ${spinning ? "translate-y-2 opacity-45 blur-[2px]" : "opacity-100"}`}>
                <div className="aspect-[2/3] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#111] shadow-[0_24px_70px_rgba(0,0,0,.5)]">
                  <img src={img(movie.poster_path, "w500")} alt={titleOf(movie)} className="h-full w-full object-cover" />
                </div>
                <div className="self-end pb-2">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/65">Tonight’s pick</div>
                  <h2 className="text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-white md:text-6xl">{titleOf(movie)}</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm text-white/44">
                    {Number(movie.vote_average) > 0 && <span className="inline-flex items-center gap-1.5 font-medium text-[#ffd400]"><Star className="h-3.5 w-3.5 fill-current" />{ratingStr(movie.vote_average)}</span>}
                    {yearOf(movie) && <span>{yearOf(movie)}</span>}
                    <span>Movie</span>
                  </div>
                  {movie.overview && <p className="mt-5 max-w-2xl text-sm leading-7 text-white/48 md:text-[15px]">{movie.overview}</p>}
                  <div className="mt-7 flex flex-wrap gap-2.5">
                    <button onClick={() => navigate(`/watch/movie/${movie.id}`)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ffd400] px-5 text-sm font-semibold text-black transition hover:bg-[#ffe04a]"><Play className="h-4 w-4 fill-current" /> Play</button>
                    <button onClick={() => navigate(`/title/movie/${movie.id}`)} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/14 bg-black/30 px-5 text-sm font-medium text-white/75 transition hover:border-[#ffd400]/30 hover:text-[#ffd400]"><Info className="h-4 w-4" /> Details</button>
                    <button onClick={spin} disabled={spinning} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-white/56 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} /> Spin again</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/32">Picking a movie…</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
