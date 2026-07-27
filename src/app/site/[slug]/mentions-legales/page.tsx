import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";
import { buildLegalInfo, HEBERGEUR, EDITEUR_LOGICIEL, A_COMPLETER } from "@/lib/site-public/legal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  return {
    title: data ? `Mentions légales — ${data.displayName}` : "Lieu introuvable",
    // Une page légale n'a aucune raison d'être indexée : elle dilue le
    // référencement du lieu sans jamais répondre à une recherche.
    robots: { index: false, follow: true },
  };
}

export default async function MentionsLegalesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  if (!data) notFound();

  const { org, displayName, content: c } = data;
  const t = getTheme(c.theme);
  const nav = buildNav(org.slug, c);
  const legal = buildLegalInfo(org);

  const Ligne = ({ label, value }: { label: string; value: string | null }) => (
    <p className={t.classes.body}>
      <strong>{label} : </strong>
      {value ?? <span className={t.classes.muted}>{A_COMPLETER}</span>}
    </p>
  );

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14">
        <h1 className={t.classes.h1}>Mentions légales</h1>

        <h2 className={`${t.classes.h2} mt-10`}>Éditeur du site</h2>
        <div className="mt-4 space-y-2">
          <Ligne label="Dénomination" value={legal.nom} />
          <Ligne label="Forme juridique" value={legal.structure} />
          <Ligne label="Siège" value={legal.adresse} />
          <Ligne label="Courriel" value={legal.email} />
          {legal.telephone ? <Ligne label="Téléphone" value={legal.telephone} /> : null}
          <Ligne label="SIRET / RNA" value={legal.siret} />
          <Ligne label="Directeur ou directrice de la publication" value={null} />
        </div>

        <h2 className={`${t.classes.h2} mt-10`}>Hébergement</h2>
        <div className="mt-4 space-y-2">
          <p className={t.classes.body}>
            Le site est hébergé par <strong>{HEBERGEUR.nom}</strong>, {HEBERGEUR.adresse}.
          </p>
          <p className={t.classes.body}>
            Il est édité au moyen du logiciel {EDITEUR_LOGICIEL}, qui agit comme
            sous-traitant au sens du RGPD.
          </p>
        </div>

        <h2 className={`${t.classes.h2} mt-10`}>Propriété intellectuelle</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Les textes et les photographies publiés sur ce site appartiennent à{" "}
          {legal.nom}, sauf mention contraire. Toute reproduction sans
          autorisation préalable est interdite.
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Données personnelles</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Le traitement des données est décrit dans la{" "}
          <a href={`/site/${org.slug}/confidentialite`} className="underline">
            politique de confidentialité
          </a>
          .
        </p>
      </section>
    </PublicSiteShell>
  );
}
