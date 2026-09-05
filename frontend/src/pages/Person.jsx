import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Camera, ChevronLeft, Clapperboard, ExternalLink, Film, MapPin, Star, Tv2, UserRound } from "lucide-react";
import { backdrop, getPerson, img } from "@/lib/api";
import { ratingStr, titleOf, yearOf } from "@/lib/format";
import { Spinner } from "@/components/Spinner";
import { Row } from "@/components/Row";

const readableDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const yearsBetween = (birthday, endDate) => {
  if (!birthday) return null;
  const start = new Date(`${birthday}T00:00:00`);
  const end = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  let years = end.getFullYear() - start.getFullYear();
  const month = end.getMonth() - start.getMonth();
  if (month < 0 || (month === 0 && end.getDate() < start.getDate())) years -= 1;
  return years;
};

const uniqueCredits = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || !["movie", "tv"].includes(item.media_type)) return false;
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ProfilePhotos = ({ profiles = [], name, limit = 10 }) => {
  const photos = profiles.filter((photo) => photo?.file_path).slice(0, limit);
  if (!photos.length) return null;
  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/60"><span className="h-px w-5 bg-[#ffd400]/55" /> Gallery</div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">Photos</h2>
        </div>
        <span className="text-xs text-white/28">{profiles.length} available</span>
      </div>
      <div className="scrollbar-none flex snap-x gap-3.5 overflow-x-auto pb-2">
        {photos.map((photo, index) => (
          <div key={`${photo.file_path}-${index}`} className="aspect-[2/3] w-[150px] shrink-0 snap-start overflow-hidden rounded-[18px] border border-white/[0.07] bg-white/[0.025] sm:w-[180px]">
            <img src={img(photo.file_path, "h632")} alt={`${name} ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
};

const Facts = ({ data, movieCredits, tvCredits, ranked }) => {
  const age = yearsBetween(data.birthday, data.deathday);
  const debut = [...movieCredits, ...tvCredits]
    .filter((item) => item.release_date || item.first_air_date)
    .sort((a, b) => String(a.release_date || a.first_air_date).localeCompare(String(b.release_date || b.first_air_date)))[0];
  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Movie credits</div><div className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{movieCredits.length}</div></div>
        <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">TV credits</div><div className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{tvCredits.length}</div></div>
        <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Age</div><div className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white">{age ?? "—"}</div></div>
        <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">First credit</div><div className="mt-2 truncate text-lg font-semibold tracking-[-0.025em] text-white">{debut ? titleOf(debut) : "—"}</div><div className="mt-1 text-xs text-white/30">{debut ? yearOf(debut) : ""}</div></div>
      </div>
      {ranked[0]?.vote_average ? <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/14 bg-[#ffd400]/[0.045] px-3 py-2 text-xs text-white/48"><Star className="h-3.5 w-3.5 fill-[#ffd400] text-[#ffd400]" /> Highest-rated prominent credit: <span className="font-medium text-white/78">{ratingStr(ranked[0].vote_average)}</span></div> : null}
    </section>
  );
};

export default function Person() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["person", id], queryFn: () => getPerson(id) });
  const [tab, setTab] = useState("overview");
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setTab("overview");
    setBioExpanded(false);
  }, [id]);

  const credits = useMemo(() => uniqueCredits(data?.combined_credits?.cast || []), [data]);
  const ranked = useMemo(() => [...credits].sort((a, b) => (Number(b.popularity) + Number(b.vote_count || 0) / 1000) - (Number(a.popularity) + Number(a.vote_count || 0) / 1000)), [credits]);
  const movieCredits = useMemo(() => credits.filter((item) => item.media_type === "movie").sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || ""))), [credits]);
  const tvCredits = useMemo(() => credits.filter((item) => item.media_type === "tv").sort((a, b) => String(b.first_air_date || "").localeCompare(String(a.first_air_date || ""))), [credits]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center bg-[#070707]"><Spinner /></div>;

  const backdropCredit = ranked.find((item) => item.backdrop_path);
  const heroBackdrop = backdropCredit?.backdrop_path ? backdrop(backdropCredit.backdrop_path, "original") : null;
  const knownFor = ranked.slice(0, 12).map((item) => ({ ...item, media_type: item.media_type }));
  const profiles = data.images?.profiles || [];
  const external = data.external_ids || {};
  const tabs = [
    { id: "overview", label: "Overview", icon: UserRound },
    { id: "movies", label: `Movies ${movieCredits.length ? `(${movieCredits.length})` : ""}`, icon: Film },
    { id: "tv", label: `TV ${tvCredits.length ? `(${tvCredits.length})` : ""}`, icon: Tv2 },
    { id: "photos", label: `Photos ${profiles.length ? `(${profiles.length})` : ""}`, icon: Camera },
  ];

  return (
    <main className="min-h-screen bg-[#070707]" data-testid="person-page">
      <section className="relative overflow-hidden border-b border-white/[0.06] pt-[68px]">
        {heroBackdrop && <img src={heroBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.18] blur-[1px]" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#070707_0%,rgba(7,7,7,.94)_44%,rgba(7,7,7,.75)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#070707_0%,transparent_65%)]" />

        <div className="relative mx-auto max-w-[1500px] px-5 py-12 md:px-8 md:py-16">
          <button onClick={() => navigate(-1)} className="mb-7 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/38 text-white/70 transition hover:border-[#ffd400]/35 hover:text-[#ffd400]"><ChevronLeft className="h-5 w-5" /></button>
          <div className="grid items-end gap-7 md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]">
            <div className="aspect-[2/3] w-full max-w-[230px] overflow-hidden rounded-[24px] border border-white/[0.09] bg-white/[0.035] shadow-[0_24px_70px_rgba(0,0,0,.45)]">
              {data.profile_path ? <img src={img(data.profile_path, "h632")} alt={data.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl font-semibold text-[#ffd400]/22">{data.name?.[0]}</div>}
            </div>

            <div className="max-w-4xl pb-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/15 bg-[#ffd400]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/70"><Clapperboard className="h-3 w-3" /> {data.known_for_department || "Performer"}</div>
              <h1 className="text-5xl font-semibold leading-none tracking-[-0.055em] text-white md:text-7xl">{data.name}</h1>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/46">
                {data.birthday && <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#ffd400]/65" />Born {readableDate(data.birthday)}</span>}
                {data.deathday && <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#ffd400]/65" />Died {readableDate(data.deathday)}</span>}
                {data.place_of_birth && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ffd400]/65" />{data.place_of_birth}</span>}
              </div>

              {data.biography ? (
                <div className="mt-5 max-w-3xl">
                  <p className={`${bioExpanded ? "" : "line-clamp-4"} whitespace-pre-line text-sm leading-7 text-white/52 md:text-[15px]`}>{data.biography}</p>
                  {data.biography.length > 420 && <button onClick={() => setBioExpanded((v) => !v)} className="mt-2 text-xs font-semibold text-[#ffd400]/75 hover:text-[#ffd400]">{bioExpanded ? "Show less" : "Read full biography"}</button>}
                </div>
              ) : <p className="mt-5 text-sm text-white/32">No biography is available yet.</p>}

              <div className="mt-5 flex flex-wrap gap-2">
                {external.imdb_id && <a href={`https://www.imdb.com/name/${external.imdb_id}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]">IMDb <ExternalLink className="h-3 w-3" /></a>}
                {external.instagram_id && <a href={`https://www.instagram.com/${external.instagram_id}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]">Instagram <ExternalLink className="h-3 w-3" /></a>}
                {external.twitter_id && <a href={`https://x.com/${external.twitter_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:border-[#ffd400]/25 hover:text-[#ffd400]">X <ExternalLink className="h-3 w-3" /></a>}
              </div>

              {data.also_known_as?.length > 0 && <p className="mt-4 text-xs leading-5 text-white/28"><span className="text-white/48">Also known as:</span> {data.also_known_as.slice(0, 6).join(", ")}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-[68px] z-30 border-b border-white/[0.06] bg-[#070707]/92 backdrop-blur-xl">
        <div className="scrollbar-none mx-auto flex max-w-[1500px] gap-1.5 overflow-x-auto px-5 py-3 md:px-8">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-medium transition ${active ? "bg-[#ffd400] text-black" : "border border-white/[0.07] bg-white/[0.025] text-white/42 hover:border-[#ffd400]/25 hover:text-[#ffd400]"}`}><Icon className="h-3.5 w-3.5" />{item.label}</button>;
          })}
        </div>
      </div>

      {tab === "overview" && (
        <>
          <Facts data={data} movieCredits={movieCredits} tvCredits={tvCredits} ranked={ranked} />
          {knownFor.length > 0 && <Row title="Known for" subtitle={`Popular titles featuring ${data.name}`} items={knownFor} testId="row-person-known-for" />}
          <ProfilePhotos profiles={profiles} name={data.name} limit={8} />
        </>
      )}

      {tab === "movies" && <Row title={`${data.name} in movies`} subtitle={`${movieCredits.length} movie credits — scroll sideways instead of down a giant page.`} items={movieCredits.slice(0, 50)} fallbackType="movie" testId="row-person-movies" />}
      {tab === "tv" && <Row title={`${data.name} on TV`} subtitle={`${tvCredits.length} television credits.`} items={tvCredits.slice(0, 50)} fallbackType="tv" testId="row-person-tv" />}
      {tab === "photos" && <ProfilePhotos profiles={profiles} name={data.name} limit={18} />}
      <div className="h-12" />
    </main>
  );
}
