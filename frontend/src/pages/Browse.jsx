import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Film, SlidersHorizontal, Tv2 } from "lucide-react";
import { discover, getGenres } from "@/lib/api";
import { MovieCard } from "@/components/MovieCard";
import { Spinner } from "@/components/Spinner";

export default function Browse() {
  const { mediaType } = useParams();
  const [genre, setGenre] = useState(null);
  const isTv = mediaType === "tv";

  const { data: genresData } = useQuery({ queryKey: ["genres", mediaType], queryFn: () => getGenres(mediaType) });
  const { data, isLoading } = useQuery({
    queryKey: ["discover", mediaType, genre],
    queryFn: () => discover(mediaType, genre ? { with_genres: genre, sort_by: "popularity.desc" } : { sort_by: "popularity.desc" }),
  });

  const genres = genresData?.genres || [];
  const results = data?.results || [];
  const label = isTv ? "TV Shows" : "Movies";

  return (
    <main data-testid="browse-page" className="min-h-screen bg-[#070707] px-5 pb-20 pt-28 md:px-8 md:pt-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-6 border-b border-white/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">{isTv ? <Tv2 className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />} Browse</div>
            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white md:text-5xl">{label}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/38">Find something worth watching without fighting the interface.</p>
          </div>
          <div className="inline-flex w-fit rounded-full border border-white/[0.09] bg-white/[0.025] p-1">
            <Link to="/browse/movie" className={`rounded-full px-4 py-2 text-xs font-semibold transition ${!isTv ? "bg-white text-black" : "text-white/45 hover:text-white"}`}>Movies</Link>
            <Link to="/browse/tv" className={`rounded-full px-4 py-2 text-xs font-semibold transition ${isTv ? "bg-white text-black" : "text-white/45 hover:text-white"}`}>TV</Link>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/28"><SlidersHorizontal className="h-3.5 w-3.5" /> Genre</div>
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-3">
            <button onClick={() => setGenre(null)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition ${!genre ? "border-white bg-white text-black" : "border-white/[0.09] bg-white/[0.025] text-white/48 hover:border-white/18 hover:text-white"}`}>All</button>
            {genres.map((item) => (
              <button key={item.id} data-testid={`genre-${item.id}`} onClick={() => setGenre(item.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition ${genre === item.id ? "border-white bg-white text-black" : "border-white/[0.09] bg-white/[0.025] text-white/48 hover:border-white/18 hover:text-white"}`}>{item.name}</button>
            ))}
          </div>
        </div>

        {isLoading ? <div className="grid min-h-[45vh] place-items-center"><Spinner /></div> : (
          <div className="mt-5 grid grid-cols-2 gap-x-3.5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {results.map((item) => <MovieCard key={item.id} item={item} fallbackType={mediaType} fluid />)}
          </div>
        )}

        {!isLoading && !results.length && <div className="mt-16 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-10 text-center text-sm text-white/38">Nothing matched this filter.</div>}
      </div>
    </main>
  );
}
