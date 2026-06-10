import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return { title: data ? `À propos — ${data.displayName}` : "Lieu introuvable" };
}

export default async function AProposPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  if (!data || !data.content.pages.apropos) notFound();

  const { org, displayName, content: c } = data;
  const t = getTheme(c.theme);
  const nav = buildNav(org.slug, c);

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-14">
        <h1 className={t.classes.h1}>{c.about_title || "À propos"}</h1>
        {c.about_text ? (
          <div className={`mt-6 space-y-4 ${t.classes.body}`}>
            {c.about_text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ) : (
          <p className={`mt-6 ${t.classes.muted}`}>Présentation à venir.</p>
        )}
        {(org.address || org.hours) ? (
          <p className={`mt-8 text-sm ${t.classes.muted}`}>
            {[org.address, org.hours].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </section>

      {c.gallery_urls.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 pb-14">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {c.gallery_urls.map((url, i) => (
              <div key={i} className={`aspect-video overflow-hidden ${t.classes.image}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PublicSiteShell>
  );
}
