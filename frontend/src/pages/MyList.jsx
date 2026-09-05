import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { MovieCard } from "@/components/MovieCard";
import { getWatchlist } from "@/lib/storage";

export default function MyList() {
  const items = getWatchlist();

  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-28 md:px-8 md:pt-32" data-testid="my-list-page">
      <div className="mx-auto max-w-[1500px]">
        <div className="border-b border-white/[0.07] pb-7">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32"><Bookmark className="h-3.5 w-3.5" /> Library</div>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white md:text-5xl">My List</h1>
          <p className="mt-3 text-sm text-white/38">Everything you saved, in one place.</p>
        </div>

        {items.length ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3.5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {items.map((item) => <MovieCard key={`${item.media_type}-${item.id}`} item={item} fallbackType={item.media_type} fluid />)}
          </div>
        ) : (
          <div className="mt-10 flex min-h-[380px] flex-col items-center justify-center rounded-[28px] border border-white/[0.07] bg-white/[0.02] px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.04] text-white/48"><Bookmark className="h-5 w-5" /></div>
            <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-white/82">Nothing saved yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/34">Add movies and shows from any card or title page and they’ll stay here.</p>
            <Link to="/browse/movie" className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/88">Browse movies</Link>
          </div>
        )}
      </div>
    </main>
  );
}
