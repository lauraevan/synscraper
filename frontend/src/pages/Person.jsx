import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Clapperboard, MapPin, Star } from "lucide-react";
import { backdrop, getPerson, img } from "@/lib/api";
import { ratingStr, titleOf, yearOf } from "@/lib/format";
import { Spinner } from "@/components/Spinner";
import { Row } from "@/components/Row";

const readableDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
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

const CreditGrid = ({ title, items, navigate }) => {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/60"><span className="h-px w-5 bg-[#ffd400]/55" /> Filmography</div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-white md:text-2xl">{title}</h2>
        </div>
        <span className="text-xs text-white/28">{items.length} credit{items.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <button
            key={`${item.media_type}-${item.id}`}
            onClick={() => navigate(`/title/${item.media_type}/${item.id}`)}
            className="group min-w-0 text-left"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] border border-white/[0.07] bg-white/[0.03] transition duration-300 group-hover:-translate-y-1 group-hover:border-[#ffd400]/28">
              {item.poster_path ? <img src={img(item.poster_path, "w342")} alt={titleOf(item)} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center p-4 text-center text-xs text-white/24">{titleOf(item)}</div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
            <h3 className="mt-2.5 truncate text-[13px] font-medium text-white/82 group-hover:text-white">{titleOf(item)}</h3>
            <p className="mt-1 truncate text-[11px] text-white/34">
              {yearOf(item) || "—"}{item.character ? ` · ${item.character}` : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default function Person() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["person", id], queryFn: () => getPerson(id) });

  useEffect(() => window.scrollTo(0, 0), [id]);

  const credits = useMemo(() => uniqueCredits(data?.combined_credits?.cast || []), [data]);
  const ranked = useMemo(() => [...credits].sort((a, b) => (Number(b.popularity) + Number(b.vote_count || 0) / 1000) - (Number(a.popularity) + Number(a.vote_count || 0) / 1000)), [credits]);
  const movieCredits = useMemo(() => credits.filter((item) => item.media_type === "movie").sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || ""))), [credits]);
  const tvCredits = useMemo(() => credits.filter((item) => item.media_type === "tv").sort((a, b) => String(b.first_air_date || "").localeCompare(String(a.first_air_date || ""))), [credits]);

  if (isLoading || !data) return <div className="grid min-h-screen place-items-center bg-[#070707]"><Spinner /></div>;

  const backdropCredit = ranked.find((item) => item.backdrop_path);
  const heroBackdrop = backdropCredit?.backdrop_path ? backdrop(backdropCredit.backdrop_path, "original") : null;
  const knownFor = ranked.slice(0, 12).map((item) => ({ ...item, media_type: item.media_type }));

  return (
    <main className="min-h-screen bg-[#070707]" data-testid="person-page">
      <section className="relative overflow-hidden border-b border-white/[0.06] pt-[68px]">
        {heroBackdrop && <img src={heroBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.18] blur-[1px]" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#070707_0%,rgba(7,7,7,.93)_42%,rgba(7,7,7,.76)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#070707_0%,transparent_65%)]" />

        <div className="relative mx-auto max-w-[1500px] px-5 py-14 md:px-8 md:py-20">
          <button onClick={() => navigate(-1)} className="mb-8 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-black/38 text-white/70 transition hover:border-[#ffd400]/35 hover:text-[#ffd400]"><ChevronLeft className="h-5 w-5" /></button>
          <div className="grid items-end gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="aspect-[2/3] w-full max-w-[260px] overflow-hidden rounded-[24px] border border-white/[0.09] bg-white/[0.035] shadow-[0_24px_70px_rgba(0,0,0,.45)]">
              {data.profile_path ? <img src={img(data.profile_path, "h632")} alt={data.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl font-semibold text-[#ffd400]/22">{data.name?.[0]}</div>}
            </div>

            <div className="max-w-4xl pb-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffd400]/15 bg-[#ffd400]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd400]/70"><Clapperboard className="h-3 w-3" /> {data.known_for_department || "Performer"}</div>
              <h1 className="text-5xl font-semibold leading-none tracking-[-0.055em] text-white md:text-7xl">{data.name}</h1>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/46">
                {data.birthday && <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#ffd400]/65" />Born {readableDate(data.birthday)}</span>}
                {data.place_of_birth && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ffd400]/65" />{data.place_of_birth}</span>}
              </div>

              {data.biography ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/52 md:text-[15px]">{data.biography}</p> : <p className="mt-6 text-sm text-white/32">No biography is available yet.</p>}

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-2xl font-semibold tracking-[-0.04em] text-white">{movieCredits.length}</div><div className="mt-1 text-xs text-white/32">Movie credits</div></div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-2xl font-semibold tracking-[-0.04em] text-white">{tvCredits.length}</div><div className="mt-1 text-xs text-white/32">TV credits</div></div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="inline-flex items-center gap-2 text-2xl font-semibold tracking-[-0.04em] text-white"><Star className="h-5 w-5 fill-[#ffd400] text-[#ffd400]" />{ranked[0]?.vote_average ? ratingStr(ranked[0].vote_average) : "—"}</div><div className="mt-1 text-xs text-white/32">Top credited rating</div></div>
              </div>

              {data.also_known_as?.length > 0 && <p className="mt-5 text-xs leading-5 text-white/28"><span className="text-white/48">Also known as:</span> {data.also_known_as.slice(0, 5).join(", ")}</p>}
            </div>
          </div>
        </div>
      </section>

      {knownFor.length > 0 && <Row title="Known for" subtitle={`Popular titles featuring ${data.name}`} items={knownFor} testId="row-person-known-for" />}
      <CreditGrid title="Movies" items={movieCredits} navigate={navigate} />
      <CreditGrid title="TV appearances" items={tvCredits} navigate={navigate} />
      <div className="h-12" />
    </main>
  );
}
