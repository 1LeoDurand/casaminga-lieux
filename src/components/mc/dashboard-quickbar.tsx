"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Inbox, CalendarCheck, CalendarDays, FileText, Receipt } from "lucide-react";

/**
 * Barre d'actions rapides du tableau de bord (fidèle .dash-quickbar).
 * Seule « Demande » est branchée (route Demandes) ; les autres annoncent
 * leur arrivée tant que le module n'est pas construit.
 */
export function DashboardQuickbar({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();

  const soon = (label: string) =>
    toast.info(`« ${label} » — bientôt disponible`, {
      description: "Action rapide branchée dans une prochaine version.",
    });

  return (
    <>
      <button
        type="button"
        className="mc-dq-btn"
        onClick={() => router.push(`/dashboard/${orgSlug}/demandes`)}
      >
        <Inbox className="mc-dq-ic size-3.5" />
        <span>Demande</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => soon("Réservation")}>
        <CalendarCheck className="mc-dq-ic size-3.5" />
        <span>Réservation</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => soon("Événement")}>
        <CalendarDays className="mc-dq-ic size-3.5" />
        <span>Événement</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => soon("Document")}>
        <FileText className="mc-dq-ic size-3.5" />
        <span>Document</span>
      </button>
      <button
        type="button"
        className="mc-dq-btn primary"
        onClick={() => soon("Facture")}
      >
        <Receipt className="mc-dq-ic size-3.5" />
        <span>Facture</span>
      </button>
    </>
  );
}
