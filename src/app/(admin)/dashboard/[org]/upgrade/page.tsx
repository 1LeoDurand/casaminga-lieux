import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Sparkles, Building2, ArrowLeft } from "lucide-react";
import { getOrganizationBySlug } from "@/lib/data";
import { getOrgSubscription, effectiveTier } from "@/lib/modules-data";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    key: "free",
    name: "Gratuit",
    price: "0 €",
    period: "pour toujours",
    description: "Le socle pour démarrer — adhésions, événements et site public.",
    color: "border-border",
    badge: null,
    features: [
      "Adhésions & campagnes en ligne",
      "Billetterie événements + QR scan",
      "Site public (vitrine + agenda)",
      "CRM contacts de base",
      "Gestion d'équipe",
    ],
    cta: null,
    ctaHref: null,
  },
  {
    key: "complete",
    name: "Asso complète",
    price: "29 €",
    period: "/ mois",
    description: "Tous les modules débloqués pour gérer votre structure de A à Z.",
    color: "border-coral",
    badge: "Recommandé",
    features: [
      "Tout du plan Gratuit",
      "Facturation & dépenses",
      "Finances & caisse certifiée NF525",
      "Subventions & aide IA au dossier",
      "Documents & gouvernance",
      "Résidences d'artistes",
      "Espaces & réservations",
      "Newsletter & communication",
      "Pôles & budget par pôle",
      "Impact & partenaires",
      "Automatisations",
    ],
    cta: "Devenir membre fondateur",
    ctaHref: "mailto:contact@casaminga.com?subject=Membre%20fondateur%20Casa%20Minga&body=Bonjour%20L%C3%A9o%2C%0A%0AJe%20souhaite%20passer%20%C3%A0%20l%27Asso%20compl%C3%A8te.",
  },
  {
    key: "multilieu",
    name: "Multi-lieux",
    price: "49 €",
    period: "/ mois + 8 € / lieu",
    description: "Pour les structures qui gèrent plusieurs sites avec une administration mutualisée.",
    color: "border-slate-300",
    badge: null,
    features: [
      "Tout de l'Asso complète",
      "Établissements multiples illimités",
      "Site public par lieu",
      "Agenda & adhérents scopés par lieu",
      "Administration mutualisée",
    ],
    cta: "Nous contacter",
    ctaHref: "mailto:contact@casaminga.com?subject=Offre%20Multi-lieux%20Casa%20Minga",
  },
];

export default async function UpgradePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) notFound();

  const sub = await getOrgSubscription(organization.id);
  const currentTier = effectiveTier(sub);
  const isFounder = sub.founding_member;

  return (
    <div className="mx-auto max-w-4xl">
      {/* En-tête */}
      <div className="mb-8">
        <Link
          href={`/dashboard/${org}`}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-warmgray hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Retour
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          <h1 className="font-heading text-2xl font-extrabold text-ink">
            Choisissez votre offre
          </h1>
        </div>
        <p className="mt-2 text-warmgray">
          Le socle (adhésions, événements, site public) est <strong>gratuit à vie</strong>. Débloquez
          les modules avancés quand vous en avez besoin.
        </p>
        {isFounder && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-[13px] font-semibold text-amber-800">
            ⭐ Vous êtes membre fondateur — Asso complète offerte à vie. Merci !
          </div>
        )}
      </div>

      {/* Grille des plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.key;
          return (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 ${plan.color} ${isCurrent ? "ring-2 ring-coral/30" : ""}`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                  {plan.badge}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                  Votre plan
                </span>
              )}

              <div className="mb-4">
                <div className="font-heading text-lg font-extrabold text-ink">{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-extrabold text-ink">{plan.price}</span>
                  <span className="text-[13px] text-warmgray">{plan.period}</span>
                </div>
                <p className="mt-2 text-[13px] text-warmgray">{plan.description}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta && plan.ctaHref ? (
                <a
                  href={plan.ctaHref}
                  className={`mc-btn w-full justify-center text-center ${plan.key === "complete" ? "mc-btn-coral" : "mc-btn-outline"}`}
                >
                  {plan.cta}
                </a>
              ) : (
                <div className="rounded-xl bg-cream px-4 py-2.5 text-center text-[13px] font-semibold text-warmgray">
                  {isCurrent ? "Plan actuel" : "Plan de base"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Améliorations à venir */}
      <div className="mt-8 rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <h2 className="font-heading text-base font-bold text-ink">Améliorations à venir</h2>
        </div>
        <p className="mb-4 text-[13px] text-warmgray">
          Ces fonctionnalités sont en cours de conception — elles seront intégrées dans les prochaines versions.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "🤝", label: "Communauté", desc: "Annonces internes, tableau d'affichage et vie collective du lieu." },
          ].map((item) => (
            <li key={item.label} className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-[#FAFAF7] p-3.5">
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{item.label}</p>
                <p className="text-[12px] text-warmgray">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Philosophie + soutien */}
      <div className="mt-8 rounded-2xl border border-border bg-peach-pale p-6 text-center">
        <Building2 className="mx-auto mb-3 size-8 text-coral-dark" />
        <h2 className="font-heading text-base font-bold text-ink">
          Casa Minga croit au modèle win-win
        </h2>
        <p className="mt-2 text-[13px] text-warmgray max-w-xl mx-auto">
          Le socle gratuit est financé par les structures qui en ont les moyens. Si Casa Minga
          vous apporte de la valeur mais que votre budget est serré, contactez-nous — on trouvera
          une solution.
        </p>
        <a
          href="mailto:contact@casaminga.com?subject=Je%20soutiens%20Casa%20Minga"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-coral px-5 py-2.5 text-[13px] font-bold text-white hover:bg-coral-dark transition-colors"
        >
          ❤️ Je soutiens Casa Minga
        </a>
        <p className="mt-2 text-[11px] text-warmgray">
          Don libre — directement à l&apos;équipe qui développe l&apos;outil
        </p>
      </div>
    </div>
  );
}
