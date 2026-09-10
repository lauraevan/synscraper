import { useQuery } from "@tanstack/react-query";
import { Hero } from "@/components/Hero";
import { Row } from "@/components/Row";
import { CinematicRow } from "@/components/CinematicRow";
import { TopTenRow } from "@/components/TopTenRow";
import { Spinner } from "@/components/Spinner";
import { discover, getHome } from "@/lib/api";

const withType = (items = [], mediaType) => items.map((item) => ({ ...item, media_type: item.media_type || mediaType }));
const uniqueById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item?.media_type || "movie"}:${item?.id}`;
    if (!item?.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const useMovieShelf = (key, params) => useQuery({
  queryKey: ["home-shelf", key],
  queryFn: () => discover("movie", params),
  staleTime: 10 * 60_000,
});

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    staleTime: 10 * 60_000,
  });
  const { data: actionData } = useMovieShelf("action", { with_genres: 28, sort_by: "popularity.desc", "vote_count.gte": 300 });
  const { data: comedyData } = useMovieShelf("comedy", { with_genres: 35, sort_by: "popularity.desc", "vote_count.gte": 250 });
  const { data: sciFiData } = useMovieShelf("scifi", { with_genres: 878, sort_by: "popularity.desc", "vote_count.gte": 250 });

  if (isLoading && !data) {
    return (
      <main className="min-h-screen bg-[#050505] pt-20" data-testid="home-page">
        <div className="grid min-h-[70vh] place-items-center"><Spinner /></div>
      </main>
    );
  }

  const trending = data?.trending || [];
  const popularMovies = withType(data?.popular_movies, "movie");
  const nowPlaying = withType(data?.now_playing, "movie");
  const popularTv = withType(data?.popular_tv, "tv");
  const upcoming = withType(data?.upcoming, "movie");
  const topTv = withType(data?.top_rated_tv, "tv");
  const action = withType(actionData?.results, "movie");
  const comedy = withType(comedyData?.results, "movie");
  const sciFi = withType(sciFiData?.results, "movie");
  const heroItems = trending.length ? trending : [...popularMovies, ...popularTv];
  const topMoviesToday = uniqueById([
    ...trending.filter((item) => item.media_type === "movie"),
    ...popularMovies,
    ...nowPlaying,
  ]).slice(0, 10);
  const newAndUpcoming = uniqueById([...nowPlaying, ...upcoming]).slice(0, 20);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] pb-20" data-testid="home-page">
      <Hero items={heroItems} />
      <div className="synflix-web-home-body relative z-[5] -mt-10 space-y-1 md:-mt-14">
        <Row title="Trending Now" items={trending} testId="row-trending" />
        <CinematicRow title="Featured Movies" subtitle="Big-screen picks selected from what people are watching now." items={popularMovies} testId="row-popular-movies" />
        <Row title="Popular Series" items={popularTv} fallbackType="tv" testId="row-popular-tv" />
        <TopTenRow items={topMoviesToday} />
        <Row title="New & Upcoming" items={newAndUpcoming} fallbackType="movie" testId="row-new-upcoming" />
        <Row title="Action" items={action} fallbackType="movie" testId="row-action" />
        <Row title="Science Fiction" items={sciFi} fallbackType="movie" testId="row-scifi" />
        <Row title="Comedy" items={comedy} fallbackType="movie" testId="row-comedy" />
        <Row title="Top Rated Series" items={topTv} fallbackType="tv" testId="row-top-rated-tv" />
      </div>
    </main>
  );
}
