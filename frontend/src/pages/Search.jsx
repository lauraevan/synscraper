import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { searchAll } from "@/lib/api";
import { MovieCard } from "@/components/MovieCard";
import { Spinner } from "@/components/Spinner";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const [value, setValue] = useState(query);

  useEffect(() => setValue(query), [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchAll(query),
    enabled: !!query.trim(),
  });

  const results = (data?.results || []).filter((item) => (item.media_type === "movie" || item.media_type === "tv") && item.poster_path);

  const submit = (e) => {
    e.preventDefault();
    const next = value.trim();
    setParams(next ? { q: next } : {});
  };

  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-28 md:px-8 md:pt-32" data-testid="search-page">
      <div className="mx-auto max-w-[1500px]">
        <div className="max-w-3xl">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">Search</div>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white md:text-5xl">Find your next watch.</h1>
          <form onSubmit={submit} className="mt-7 flex h-14 items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.035] px-4 transition focus-within:border-white/22 focus-within:bg-white/[0.045]">
            <SearchIcon className="h-5 w-5 shrink-0 text-white/35" />
            <input data-testid="search-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Movies, shows, people..." className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/28" autoFocus />
            <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/88">Search</button>
          </form>
        </div>

        {!query && (
          <div className="mt-14 max-w-2xl rounded-3xl border border-white/[0.07] bg-white/[0.025] p-8">
            <p className="text-sm font-medium text-white/72">Search the whole catalog</p>
            <p className="mt-2 text-sm leading-6 text-white/34">Type a movie or series title above. Results stay clean and go straight to details or playback.</p>
          </div>
        )}

        {query && <div className="mt-10 flex items-end justify-between gap-4 border-b border-white/[0.07] pb-4"><div><h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Results for “{query}”</h2><p className="mt-1 text-xs text-white/32">{isLoading ? "Searching…" : `${results.length} results`}</p></div></div>}

        {isLoading ? <div className="grid min-h-[40vh] place-items-center"><Spinner /></div> : query && results.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {results.map((item) => <MovieCard key={`${item.media_type}-${item.id}`} item={item} fluid />)}
          </div>
        ) : query && !isLoading ? (
          <div className="mt-12 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-10 text-center"><p className="text-sm font-medium text-white/64">No results</p><p className="mt-2 text-sm text-white/30">Try a shorter title or a different spelling.</p></div>
        ) : null}
      </div>
    </main>
  );
}
