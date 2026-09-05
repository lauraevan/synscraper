import { useQuery } from "@tanstack/react-query";
import { Hero } from "@/components/Hero";
import { Row } from "@/components/Row";
import { Spinner } from "@/components/Spinner";
import { getHome } from "@/lib/api";

const withType = (items = [], mediaType) => items.map((item) => ({ ...item, media_type: item.media_type || mediaType }));

export default function Home() {
  const { data, isLoading } = useQuery({ queryKey: ["home"], queryFn: getHome });

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
  const heroItems = trending.length ? trending : [...popularMovies, ...popularTv];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pb-14" data-testid="home-page">
      <Hero items={heroItems} />
      <div className="-mt-2 space-y-1">
        <Row title="Trending now" subtitle="What people are watching this week" items={trending} testId="row-trending" />
        <Row title="Popular movies" items={popularMovies} fallbackType="movie" testId="row-popular-movies" />
        <Row title="Now playing" items={nowPlaying} fallbackType="movie" testId="row-now-playing" />
        <Row title="Popular TV" items={popularTv} fallbackType="tv" testId="row-popular-tv" />
        <Row title="Top rated movies" items={topMovies} fallbackType="movie" testId="row-top-rated-movies" />
        <Row title="Coming soon" items={upcoming} fallbackType="movie" testId="row-upcoming" />
        <Row title="Top rated TV" items={topTv} fallbackType="tv" testId="row-top-rated-tv" />
      </div>
    </main>
  );
}
