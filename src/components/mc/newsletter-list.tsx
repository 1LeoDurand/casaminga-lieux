"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, Clock, Check, FileText, Send, Settings } from "lucide-react";
import { newCampaignAction, deleteCampaignAction } from "@/app/(admin)/dashboard/[org]/communication/newsletter-actions";
import type { NewsletterCampaign, NewsletterSettings } from "@/lib/newsletter/types";

interface GroupLite { id: string; name: string; memberCount: number }

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

function StatusBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    brouillon:   { label: "Brouillon",   cls: "bg-warmgray/15 text-warmgray" },
    programmee:  { label: "Programmée",  cls: "bg-blue-50 text-blue-600" },
    envoyee:     { label: "Envoyée",     cls: "bg-[#e8f5ee] text-[#2f8a4c]" },
  };
  const s = map[statut] ?? { label: statut, cls: "bg-warmgray/15 text-warmgray" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {statut === "envoyee" ? <Check className="size-3" /> : statut === "programmee" ? <Clock className="size-3" /> : <FileText className="size-3" />}
      {s.label}
    </span>
  );
}

function ModeChip({ settings }: { settings: NewsletterSettings | null }) {
  if (!settings?.actif) return null;
  const labels: Record<string, string> = {
    manuel:        "Manuel",
    recurrent:     `Toutes les ${settings.frequence_semaines} sem.`,
    sur_evenement: "Sur nouvel événement",
  };
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-warmgray">
      <Clock className="size-3.5 text-coral" />
      <span>Cadence : <strong>{labels[settings.mode] ?? settings.mode}</strong></span>
    </div>
  );
}

export function NewsletterList({
  campaigns,
  settings,
  orgId,
  orgSlug,
  groups: _groups,
}: {
  campaigns: NewsletterCampaign[];
  settings: NewsletterSettings | null;
  orgId: string;
  orgSlug: string;
  groups: GroupLite[];
}) {
  const [pending, start] = useTransition();

  function handleNew() {
    start(async () => {
      await newCampaignAction(orgId, orgSlug, settings?.blocs_template as never[] ?? []);
    });
  }

  function handleDelete(id: string, sujet: string) {
    if (!confirm(`Supprimer « ${sujet || "Sans titre"} » ?`)) return;
    start(async () => {
      const res = await deleteCampaignAction(id, orgSlug);
      if (res.ok) toast.success("Campagne supprimée");
      else toast.error("Erreur");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">Newsletter</h2>
          <ModeChip settings={settings} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/${orgSlug}/communication/settings`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:border-coral/40"
          >
            <Settings className="size-3.5" /> Réglages
          </Link>
          <button
            type="button"
            onClick={handleNew}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-[13px] font-bold text-white shadow transition hover:bg-coral-dark disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Nouvelle campagne
          </button>
        </div>
      </div>

      {/* Liste */}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-14 text-center">
          <Send className="mx-auto size-8 text-warmgray/40" />
          <p className="mt-3 text-sm font-semibold text-ink">Aucune campagne pour l'instant</p>
          <p className="mt-1 text-[13px] text-warmgray">Créez votre première newsletter.</p>
          <button
            type="button"
            onClick={handleNew}
            disabled={pending}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-2.5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-50"
          >
            <Plus className="size-4" /> Créer une campagne
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 transition hover:border-coral/30">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge statut={c.statut} />
                  <span className="truncate text-[13px] font-bold text-ink">
                    {c.sujet || "Sans titre"}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-warmgray">
                  {c.statut === "envoyee"
                    ? `Envoyée le ${fmtDate(c.envoyee_le)} · ${c.nb_envoyes ?? 0} destinataire(s)`
                    : c.statut === "programmee"
                    ? `Programmée pour le ${fmtDate(c.programmee_pour)}`
                    : `Modifiée le ${fmtDate(c.updated_at)} · ${c.blocs?.length ?? 0} bloc(s)`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {c.statut !== "envoyee" && (
                  <Link
                    href={`/dashboard/${orgSlug}/communication/${c.id}`}
                    className="rounded-full border border-border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-coral/40"
                  >
                    Ouvrir
                  </Link>
                )}
                {c.statut === "envoyee" && c.html_archive && (
                  <Link
                    href={`/dashboard/${orgSlug}/communication/${c.id}`}
                    className="rounded-full border border-border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-coral/40"
                  >
                    Voir archive
                  </Link>
                )}
                {c.statut !== "envoyee" && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.sujet)}
                    disabled={pending}
                    className="rounded-full p-1.5 text-warmgray hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
