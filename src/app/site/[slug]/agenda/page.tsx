import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvenementsForOrg } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";
import { eventTypeLabel, eventRange, isFuture } from "@/lib/events-meta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  return { title: data ? `Agenda — ${data.displayName}` : "Lieu introuvable" };
}

function monthLabel(iso: string) {
  const label = new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  if (!data || !data.content.pages.agenda) notFound();

  const { org, establishment, displayName, content: c } = data;
  const t = getTheme(c.theme);
  const accent = c.accent_color || t.preview.accent;
  const nav = buildNav(org.slug, c);

  const eventsRaw = await getEvenementsForOrg(org.id);
  const events = eventsRaw
    .filter((e) => e.status === "publie" && isFuture(e.start_at) && e.show_on_public_site)
    .filter((e) => !establishment || e.establishment_id === establishment.id)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  // Groupement par mois
  const byMonth = new Map<string, typeof events>();
  for (const e of events) {
    const key = monthLabel(e.start_at);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-5xl px-6 pb-14 pt-14">
        <h1 className={t.classes.h1}>Agenda</h1>
        <p className={`mt-3 ${t.classes.muted}`}>Tous les rendez-vous à venir du lieu.</p>

        {/* Abonnement / intégration : flux iCal consommable par Google Agenda,
            Outlook, Apple Calendar et les plugins d'agenda (WordPress…). */}
        <a
          href={`/site/${org.slug}/agenda.ics`}
          className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${t.classes.muted}`}
          style={{ border: `1px solid ${accent}40` }}
        >
          📅 S&apos;abonner à l&apos;agenda (iCal)
        </a>

        {events.length === 0 ? (
          <div className={`mt-8 px-6 py-12 text-center text-sm ${t.classes.card} ${t.classes.muted}`}>
            Pas d&apos;événement prévu pour l&apos;instant — revenez bientôt&nbsp;!
          </div>
        ) : (
          [...byMonth.entries()].map(([month, list]) => (
            <div key={month} className="mt-10">
              <h2 className={`mb-4 ${t.classes.h2}`}>{month}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((e) => (
                  <Link
                    key={e.id}
                    href={`/site/${org.slug}/agenda/${e.id}`}
                    className={`group flex flex-col p-5 transition hover:opacity-95 ${t.classes.card}`}
                  >
                    {e.photos?.[0] ? (
                      <div className={`mb-3 aspect-video overflow-hidden ${t.classes.image}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.photos[0]} alt="" className="size-full object-cover transition group-hover:scale-105" />
                      </div>
                    ) : null}
                    <span
                      className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: `${accent}1a`, color: accent }}
                    >
                      {eventTypeLabel(e.type)}
                    </span>
                    <h3 className={`mt-2.5 text-[15px] font-bold leading-snug ${t.classes.heading}`}>{e.title}</h3>
                    <p className={`mt-1.5 text-[13px] ${t.classes.muted}`}>{eventRange(e.start_at, e.end_at)}</p>
                    <span className="mt-3 text-[12px] font-semibold" style={{ color: accent }}>
                      {e.price === 0 || e.price === null ? "Entrée libre" : `${e.price} €`} →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </PublicSiteShell>
  );
}
