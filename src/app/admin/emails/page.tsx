import { getRecentEmails } from "@/lib/admin/data";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  facture: "Facture", rappel: "Rappel", bienvenue: "Bienvenue", recu: "Reçu",
  reservation: "Réservation", adhesion: "Adhésion", autre: "Autre",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminEmailsPage() {
  const emails = await getRecentEmails();
  const sent = emails.filter((e) => e.status === "sent").length;
  const failed = emails.filter((e) => e.status === "failed").length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Emails envoyés</h1>
        <p className="mt-1 text-sm text-warmgray">
          Traçabilité de tous les emails (factures, rappels, bienvenue, reçus…) — {sent} envoyé(s) · {failed} échec(s).
        </p>
      </header>

      {emails.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-12 text-center text-sm text-warmgray">
          Aucun email envoyé pour le moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="hidden grid-cols-[auto_1.4fr_1.8fr_0.8fr_auto] gap-4 border-b border-border bg-cream px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-warmgray md:grid">
            <span></span><span>Destinataire</span><span>Objet</span><span>Type</span><span>Date</span>
          </div>
          <ul className="divide-y divide-border">
            {emails.map((e) => (
              <li key={e.id} className="grid grid-cols-1 gap-1 px-5 py-3 md:grid-cols-[auto_1.4fr_1.8fr_0.8fr_auto] md:items-center md:gap-4">
                <span className={`flex size-6 items-center justify-center rounded-full ${e.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {e.status === "sent" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                </span>
                <span className="truncate text-[13px] text-ink">{e.recipient}</span>
                <span className="truncate text-[13px] text-warmgray" title={e.error ?? ""}>
                  {e.subject}
                  {e.error ? <span className="ml-1 text-red-500">· {e.error}</span> : null}
                </span>
                <span className="text-[12px]">
                  <span className="rounded-full bg-peach-pale px-2 py-0.5 font-semibold text-coral-dark">{CAT_LABEL[e.category ?? "autre"] ?? e.category}</span>
                </span>
                <span className="text-[12px] text-warmgray">{fmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
