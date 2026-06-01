"use client";

import { useRouter } from "next/navigation";
import { Inbox, CalendarCheck, CalendarDays, FileText, Receipt } from "lucide-react";

/**
 * Barre d'actions rapides du tableau de bord.
 * Tous les raccourcis pointent vers les modules réels (tous construits).
 */
export function DashboardQuickbar({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const go = (segment: string) => router.push(`/dashboard/${orgSlug}/${segment}`);

  return (
    <>
      <button type="button" className="mc-dq-btn" onClick={() => go("demandes")}>
        <Inbox className="mc-dq-ic size-3.5" />
        <span>Demande</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => go("reservations")}>
        <CalendarCheck className="mc-dq-ic size-3.5" />
        <span>Réservation</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => go("evenements")}>
        <CalendarDays className="mc-dq-ic size-3.5" />
        <span>Événement</span>
      </button>
      <button type="button" className="mc-dq-btn" onClick={() => go("documents")}>
        <FileText className="mc-dq-ic size-3.5" />
        <span>Document</span>
      </button>
      <button type="button" className="mc-dq-btn primary" onClick={() => go("finances")}>
        <Receipt className="mc-dq-ic size-3.5" />
        <span>Transaction</span>
      </button>
    </>
  );
}
