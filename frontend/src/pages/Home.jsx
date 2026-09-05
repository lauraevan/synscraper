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
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const useMovieShelf = (key, params) => useQuery({
  queryKey: ["home-shelf", key],
  queryFn: () => discover("movie", params),
  staleTime: 5 * 60_000,
});

export default function Home() {
  const { data, isLoading } = useQuery({ queryKey: ["home"], queryFn: getHome });
  const { data: actionData } = useMovieShelf("action", { with_genres: 28, sort_by: "popularity.desc", "vote_count.gte": 300 });
  const { data: comedyData } = useMovieShelf("comedy", { with_genres: 35, sort_by: "popularity.desc", "vote_count.gte": 250 });
  const { data: familyData } = useMovieShelf("family", { with_genres: 10751, sort_by: "popularity.desc", "vote_count.gte": 100 });
  const { data: sciFiData } = useMovieShelf("scifi", { with_genres: 878, sort_by: "popularity.desc", "vote_count.gte": 250 });

  if (isLoading && !data) {
    return <main className="min-h-screen bg-[#070707] pt-20" data-testid="home-page"><div className="grid min-h-[70vh] place-items-center"><Spinner /></div></main>;
  }

  const trending = data?.trending || [];
  const popularMovies = withType(data?.popular_movies, "movie");
  const nowPlaying = withType(data?.now_playing, "movie");
  const popularTv = withType(data?.popular_tv, "tv");
  const topMovies = withType(data?.top_rated_movies, "movie");
  const upcoming = withType(data?.upcoming, "movie");
  const topTv = withType(data?.top_rated_tv, "tv");
  const action = withType(actionData?.results, "movie");
  const comedy = withType(comedyData?.results, "movie");
  const family = withType(familyData?.results, "movie");
  const sciFi = withType(sciFiData?.results, "movie");
  const heroItems = trending.length ? trending : [...popularMovies, ...popularTv];
  const topMoviesToday = uniqueById([
    ...trending.filter((item) => item.media_type === "movie"),
    ...popularMovies,
  ]).slice(0, 10);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pb-14" data-testid="home-page">
      <Hero items={heroItems} />
      <div className="-mt-2 space-y-1">
        <Row title="Trending now" subtitle="What people are watching this week" items={trending} testId="row-trending" />
        <CinematicRow title="Popular movies" subtitle="Big-screen favorites, presented in a wider cinematic rail." items={popularMovies} testId="row-popular-movies" />
        <Row title="Now playing" items={nowPlaying} fallbackType="movie" testId="row-now-playing" />
        <Row title="Popular TV" items={popularTv} fallbackType="tv" testId="row-popular-tv" />
        <CinematicRow title="Top rated movies" subtitle="Critically loved films, flipped for a different rhythm." items={topMovies} reverse testId="row-top-rated-movies" />
        <TopTenRow items={topMoviesToday} />
        <Row title="Action hits" subtitle="Big action, fast pacing, zero patience." items={action} fallbackType="movie" testId="row-action" />
        <Row title="Comedy night" subtitle="Easy picks when you just want something fun." items={comedy} fallbackType="movie" testId="row-comedy" />
        <Row title="Sci-fi worlds" subtitle="Future tech, strange worlds, and impossible ideas." items={sciFi} fallbackType="movie" testId="row-scifi" />
        <Row title="Family favorites" subtitle="Crowd-friendly movies for everyone." items={family} fallbackType="movie" testId="row-family" />
        <Row title="Coming soon" items={upcoming} fallbackType="movie" testId="row-upcoming" />
        <Row title="Top rated TV" items={topTv} fallbackType="tv" testId="row-top-rated-tv" />
      </div>
    </main>
  );
}
