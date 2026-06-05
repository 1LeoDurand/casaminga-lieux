"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2, ExternalLink, Loader2, FlaskConical } from "lucide-react";
import { createDemoOrgAction, resetDemoOrgAction, deleteDemoOrgAction } from "@/app/admin/demos/actions";
import type { DemoArchetype } from "@/lib/admin/demo-seeder";
import type { DemoOrgRow } from "@/app/admin/demos/page";

const ARCHETYPES: { key: DemoArchetype; label: string; emoji: string; description: string }[] = [
  { key: "tiers-lieu",  label: "Tiers-lieu",  emoji: "🏠", description: "La Friche Commune — ateliers, résidences, événements, espaces" },
  { key: "association", label: "Association", emoji: "🤝", description: "Les Amis du Quartier — membres, AG, adhésions, finances" },
  { key: "coworking",   label: "Coworking",   emoji: "💻", description: "L'Atelier Partagé — espaces, réservations, facturation" },
];

const ARCHETYPE_SLUG: Record<DemoArchetype, string> = {
  "tiers-lieu":  "demo-tiers-lieu",
  "association": "demo-association",
  "coworking":   "demo-coworking",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DemosView({ demoOrgs }: { demoOrgs: DemoOrgRow[] }) {
  const [pending, start] = useTransition();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  function isActive(archetype: DemoArchetype) {
    return demoOrgs.some((o) => o.demo_archetype === archetype);
  }

  function getOrg(archetype: DemoArchetype) {
    return demoOrgs.find((o) => o.demo_archetype === archetype);
  }

  function handleCreate(archetype: DemoArchetype) {
    setLoadingKey(`create-${archetype}`);
    start(async () => {
      const res = await createDemoOrgAction(archetype);
      if (res.ok) toast.success(`Démo ${archetype} créée ✓`);
      else toast.error(res.error ?? "Erreur");
      setLoadingKey(null);
    });
  }

  function handleReset(archetype: DemoArchetype) {
    if (!confirm(`Réinitialiser la démo ${archetype} ? Toutes les données seront effacées et recréées.`)) return;
    setLoadingKey(`reset-${archetype}`);
    start(async () => {
      const res = await resetDemoOrgAction(archetype);
      if (res.ok) toast.success(`Démo ${archetype} réinitialisée ✓`);
      else toast.error(res.error ?? "Erreur");
      setLoadingKey(null);
    });
  }

  function handleDelete(org: DemoOrgRow) {
    if (!confirm(`Supprimer définitivement « ${org.name} » ?`)) return;
    setLoadingKey(`delete-${org.id}`);
    start(async () => {
      const res = await deleteDemoOrgAction(org.id);
      if (res.ok) toast.success("Démo supprimée");
      else toast.error("Erreur");
      setLoadingKey(null);
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <div className="flex items-center gap-2.5">
          <FlaskConical className="size-6 text-coral" strokeWidth={1.8} />
          <h1 className="font-heading text-2xl font-extrabold text-ink">Organisations de démonstration</h1>
        </div>
        <p className="mt-1 text-sm text-warmgray">
          Orgs fictives pour tester et présenter la plateforme. Exclues du portail public, sans emails réels.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {ARCHETYPES.map((arch) => {
          const active = isActive(arch.key);
          const org = getOrg(arch.key);
          const isLoading = (k: string) => pending && loadingKey === k;

          return (
            <div
              key={arch.key}
              className={`rounded-2xl border bg-white ${active ? "border-border" : "border-dashed border-border"}`}
            >
              <div className="flex items-center gap-4 p-5">
                {/* Icône + infos */}
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl">
                  {arch.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-[15px] font-bold text-ink">{arch.label}</span>
                    {active && (
                      <span className="rounded-full bg-[#e8f5ee] px-2 py-0.5 text-[11px] font-semibold text-[#2f8a4c]">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-warmgray">{arch.description}</div>
                  {org && (
                    <div className="mt-0.5 text-[12px] text-warmgray">
                      /{org.slug} · créée le {fmtDate(org.created_at)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {active && org ? (
                    <>
                      {/* Voir comme */}
                      <Link
                        href={`/dashboard/${ARCHETYPE_SLUG[arch.key]}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[12px] font-semibold text-ink hover:border-coral/40"
                      >
                        <ExternalLink className="size-3.5" />
                        Voir comme
                      </Link>

                      {/* Réinitialiser */}
                      <button
                        type="button"
                        onClick={() => handleReset(arch.key)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[12px] font-semibold text-warmgray hover:border-coral/40 hover:text-ink disabled:opacity-40"
                      >
                        {isLoading(`reset-${arch.key}`)
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <RotateCcw className="size-3.5" />}
                        Réinitialiser
                      </button>

                      {/* Supprimer */}
                      <button
                        type="button"
                        onClick={() => handleDelete(org)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[12px] font-semibold text-warmgray hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                      >
                        {isLoading(`delete-${org.id}`)
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Trash2 className="size-3.5" />}
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCreate(arch.key)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-[13px] font-bold text-white shadow transition hover:bg-coral-dark disabled:opacity-50"
                    >
                      {isLoading(`create-${arch.key}`)
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <Plus className="size-3.5" />}
                      Créer
                    </button>
                  )}
                </div>
              </div>

              {/* Note si active : garde-fous */}
              {active && (
                <div className="border-t border-border/60 px-5 py-2.5 text-[11.5px] text-warmgray">
                  🛡️ Emails non envoyés · 🔒 Invisible sur le portail public · ♻️ Réinitialisable à tout moment
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note globale */}
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-white/50 p-5 text-[13px] text-warmgray">
        <strong className="text-ink">Impersonation :</strong> "Voir comme" ouvre le vrai dashboard de l'org démo dans un nouvel onglet. En tant que super-admin, vous avez accès à toutes les organisations sans être membre. Les données sont 100% fictives et remplaçables.
      </div>
    </div>
  );
}
