import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicSite } from "@/lib/site-public/page-data";
import { getTheme } from "@/lib/site-public/themes";
import { PublicSiteShell, buildNav } from "@/components/mc/public-site-shell";
import { buildLegalInfo, HEBERGEUR, A_COMPLETER } from "@/lib/site-public/legal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSite(slug);
  return {
    title: data ? `Politique de confidentialité — ${data.displayName}` : "Lieu introuvable",
    robots: { index: false, follow: true },
  };
}

export default async function ConfidentialitePage({
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
  const contact = legal.email ?? A_COMPLETER;

  return (
    <PublicSiteShell slug={org.slug} displayName={displayName} content={c} nav={nav}>
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14">
        <h1 className={t.classes.h1}>Politique de confidentialité</h1>
        <p className={`mt-4 ${t.classes.body}`}>
          {legal.nom} est responsable des données collectées sur ce site. Cette
          page décrit ce qui est collecté, pourquoi, et comment exercer vos
          droits.
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Ce que nous collectons</h2>
        <ul className={`mt-4 list-disc space-y-2 pl-5 ${t.classes.body}`}>
          <li>
            <strong>Formulaire de contact</strong> : votre nom, votre adresse
            électronique et votre message, pour vous répondre.
          </li>
          <li>
            <strong>Inscription à la lettre d&apos;information</strong> : votre
            adresse électronique, avec confirmation par courriel. La date, la
            source et l&apos;adresse IP de cette confirmation sont conservées
            comme preuve de votre consentement, ainsi que le RGPD l&apos;exige.
          </li>
          <li>
            <strong>Adhésion, réservation, billetterie</strong>, le cas échéant :
            les informations nécessaires à la gestion de votre demande.
          </li>
          <li>
            <strong>Mesure des envois</strong> : nos lettres d&apos;information
            peuvent contenir une image de mesure et des liens de redirection,
            qui indiquent si un message a été ouvert et quels liens ont été
            suivis. Cette mesure est agrégée et ne sert qu&apos;à améliorer nos
            envois. Elle disparaît dès que vous vous désabonnez.
          </li>
        </ul>

        <h2 className={`${t.classes.h2} mt-10`}>Sur quelle base</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          La lettre d&apos;information repose sur votre <strong>consentement</strong>,
          que vous pouvez retirer à tout moment. Les adhésions, réservations et
          réponses à vos messages reposent sur l&apos;exécution de la relation
          que vous avez engagée avec nous.
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Combien de temps</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Les messages de contact sont conservés le temps du traitement de votre
          demande. Les données d&apos;adhésion sont conservées pendant la durée
          de l&apos;adhésion, puis pendant la durée légale applicable aux
          documents comptables et associatifs. Votre inscription à la lettre
          d&apos;information est conservée jusqu&apos;à votre désabonnement.
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Qui y a accès</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Les données ne sont ni vendues ni transmises à des tiers à des fins
          commerciales. Elles sont accessibles à l&apos;équipe de {legal.nom} et
          traitées au moyen du logiciel Casa Minga Lieux, qui agit comme
          sous-traitant. Le site est hébergé par {HEBERGEUR.nom} ({HEBERGEUR.adresse}).
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Vos droits</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, d&apos;opposition, de limitation et de portabilité.
          Chaque lettre d&apos;information comporte un lien de désabonnement en
          un clic. Pour toute autre demande, écrivez à <strong>{contact}</strong>.
        </p>
        <p className={`mt-4 ${t.classes.body}`}>
          Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission
          nationale de l&apos;informatique et des libertés (CNIL),{" "}
          <a href="https://www.cnil.fr" className="underline" rel="noopener noreferrer" target="_blank">
            cnil.fr
          </a>
          .
        </p>

        <h2 className={`${t.classes.h2} mt-10`}>Cookies et mesure d&apos;audience</h2>
        <p className={`mt-4 ${t.classes.body}`}>
          Ce site ne dépose aucun cookie publicitaire et ne pratique aucun
          profilage. L&apos;éditeur du logiciel mesure l&apos;audience de la
          plateforme au moyen de Google Analytics, avec adresse IP anonymisée.
        </p>
        <p className={`mt-4 ${t.classes.body}`}>
          Cette mesure n&apos;est activée <strong>qu&apos;après votre
          acceptation</strong> dans le bandeau affiché à votre première visite.
          Si vous la refusez, aucun script de mesure n&apos;est chargé. Les
          cookies strictement nécessaires au fonctionnement du site (session,
          panier de réservation) ne relèvent pas de ce consentement.
        </p>
      </section>
    </PublicSiteShell>
  );
}
