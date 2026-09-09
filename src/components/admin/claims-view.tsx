"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, ExternalLink, Phone, Mail, CalendarClock } from "lucide-react";
import { approveClaim, refuseClaim } from "@/app/admin/revendications/actions";
import type { ClaimRow } from "@/lib/admin/data";

/**
 * Les revendications que la voie automatique n'a pas pu trancher.
 *
 * Chaque carte porte le seul indice réellement discriminant : le domaine du
 * courriel du demandeur correspond-il au site du lieu ? Quand oui, la décision
 * se prend en trois secondes. Quand non, le téléphone du lieu est à un clic.
 *
 * Accepter envoie l'invitation à l'adresse saisie par le demandeur — celle dont
 * on ne pouvait précisément rien conclure. C'est un acte de confiance, pas une
 * formalité : le libellé du bouton le dit.
 */
export function ClaimsView({ claims }: { claims: ClaimRow[] }) {
  const [rows, setRows] = useState(claims);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function accepter(c: ClaimRow) {
    setBusy(c.id);
    const res = await approveClaim(c.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? "Échec.");
      return;
    }
    setRows((r) => r.filter((x) => x.id !== c.id));
    toast.success(`Invitation envoyée à ${c.email}`);
  }

  async function refuser(c: ClaimRow) {
    setBusy(c.id);
    const res = await refuseClaim(c.id, reason);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? "Échec.");
      return;
    }
    setRows((r) => r.filter((x) => x.id !== c.id));
    setRefusing(null);
    setReason("");
    toast.success("Demande refusée.");
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center">
        <p className="text-sm text-warmgray">
          Aucune demande en attente. Les revendications vérifiées automatiquement
          n&apos;apparaissent pas ici : elles n&apos;ont besoin de personne.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((c) => (
        <article key={c.id} className="rounded-xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-[17px] font-extrabold text-ink">{c.orgName}</h2>
              <p className="mt-0.5 text-[12.5px] text-warmgray">
                {c.nbEvenements} événement{c.nbEvenements > 1 ? "s" : ""} à venir
                {c.eventTitle ? ` · demande partie de « ${c.eventTitle} »` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[11.5px] text-warmgray">{fmtDate(c.created_at)}</span>
          </div>

          {/* Le demandeur */}
          <div className="mt-4 rounded-lg bg-[#FAFAF7] p-4">
            <p className="text-[14px] font-semibold text-ink">
              {c.fullName}
              {c.roleLabel ? <span className="font-normal text-warmgray"> · {c.roleLabel}</span> : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-coral">
                <Mail className="size-[14px]" /> {c.email}
              </a>
              {c.phone && (
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-coral">
                  <Phone className="size-[14px]" /> {c.phone}
                </a>
              )}
              {c.orgWebsite && (
                <a
                  href={c.orgWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-coral"
                >
                  <ExternalLink className="size-[14px]" /> Site du lieu
                </a>
              )}
            </div>
            {c.message && (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{c.message}</p>
            )}
          </div>

          {/* Le seul indice qui compte */}
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${
              c.domaineConcordant
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {c.domaineConcordant
              ? "Le domaine du courriel est celui du site du lieu."
              : c.orgWebsite
                ? "Le domaine du courriel ne correspond pas au site du lieu. Un appel lève le doute."
                : "Ce lieu n'a ni adresse ni site publiés : rien ne permet de recouper. Un appel s'impose."}
          </p>

          {/* Décision */}
          {refusing === c.id ? (
            <div className="mt-4 flex flex-col gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif, pour s'en souvenir (non envoyé au demandeur)"
                className="w-full rounded-lg border border-border px-3 py-2 text-[13px] outline-none focus:border-coral"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => refuser(c)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Confirmer le refus
                </button>
                <button
                  type="button"
                  onClick={() => { setRefusing(null); setReason(""); }}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-warmgray"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === c.id}
                onClick={() => accepter(c)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                <Check className="size-[15px]" />
                {busy === c.id ? "Envoi…" : `Envoyer l'invitation à ${c.email}`}
              </button>
              <button
                type="button"
                disabled={busy === c.id}
                onClick={() => setRefusing(c.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-warmgray disabled:opacity-50"
              >
                <X className="size-[15px]" /> Refuser
              </button>
              <span className="inline-flex items-center gap-1.5 self-center text-[12px] text-warmgray">
                <CalendarClock className="size-[13px]" /> Lien valable 30 jours
              </span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
