import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpacesForOrg } from "@/lib/data";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  return { title: data ? `Espaces — ${data.displayName}` : "Lieu introuvable" };
}

function price(s: { price_hour: number | null; price_day: number | null }): string | null {
  const parts: string[] = [];
  if (s.price_hour) parts.push(`${s.price_hour} €/h`);
  if (s.price_day) parts.push(`${s.price_day} €/jour`);
  return parts.length ? parts.join(" · ") : null;
}

export default async function EspacesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  if (!data || !data.content.pages.espaces) notFound();

  const { org, establishment, displayName, content: c } = data;
  const t = getTheme(c.theme);
  const accent = c.accent_color || t.preview.accent;
  const nav = buildNav(org.slug, c);

  const spacesRaw = await getSpacesForOrg(org.id);
  const spaces = spacesRaw
    .filter((s) => s.status === "disponible")
    .filter((s) => !establishment || s.establishment_id === establishment.id);

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-5xl px-6 pb-14 pt-14">
        <h1 className={t.classes.h1}>Nos espaces</h1>
        <p className={`mt-3 max-w-2xl ${t.classes.muted}`}>
          Salles, ateliers et espaces de travail à réserver pour vos activités, réunions et événements.
        </p>

        {spaces.length === 0 ? (
          <div className={`mt-8 px-6 py-12 text-center text-sm ${t.classes.card} ${t.classes.muted}`}>
            Les espaces réservables seront bientôt présentés ici.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {spaces.map((s) => {
              const tarif = price(s);
              return (
                <div key={s.id} className={`flex flex-col overflow-hidden ${t.classes.card}`}>
                  {s.photos?.[0] ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photos[0]} alt={s.name} className="size-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9]" style={{ background: `${accent}1f` }} />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className={`text-lg font-bold ${t.classes.heading}`}>{s.name}</h2>
                    <p className={`mt-1 text-[13px] ${t.classes.muted}`}>
                      {[
                        s.capacity ? `${s.capacity} pers.` : null,
                        s.area ? `${s.area} m²` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {s.description ? (
                      <p className={`mt-2.5 flex-1 text-sm ${t.classes.body}`}>{s.description}</p>
                    ) : <div className="flex-1" />}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {tarif ? (
                        <span className="text-sm font-bold" style={{ color: accent }}>{tarif}</span>
                      ) : <span className={`text-sm ${t.classes.muted}`}>Tarif sur demande</span>}
                      <a
                        href={`/site/${org.slug}#contact`}
                        className={`inline-flex items-center px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 ${t.classes.btn}`}
                        style={{ background: accent }}
                      >
                        Demander une réservation
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PublicSiteShell>
  );
}
